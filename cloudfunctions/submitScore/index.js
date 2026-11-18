/**
 * 提交无尽挑战成绩并做基础防作弊：
 *  结构校验 + 当天题序“严格前缀”核对 + 用随包题库重算正确数与理论最高分 +
 *  错题数与生命/复活次数自洽 + 只保留每人每天最佳成绩（答对题数优先，再比速度分）。
 * 所有排行榜写入只能经此云函数，客户端无法直接改库。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const bank = require('./bank.json')
const daily = require('./daily')
const CFG = daily.CFG
const COL = 'challenge_scores'

function structuralErrors(e) {
  const errors = []
  if (!/^\d{8}$/.test(String(e.challengeId))) errors.push('challengeId 非法')
  const ids = Array.isArray(e.questionIds) ? e.questionIds : []
  const n = ids.length
  if (!(n >= 1 && n <= bank.questions.length)) errors.push('作答题数越界')
  if (new Set(ids).size !== n) errors.push('题目重复')
  if (!Array.isArray(e.answers) || e.answers.length !== n) errors.push('作答明细数量不正确')
  if (!(e.correctCount >= 0 && e.correctCount <= n)) errors.push('正确数越界')
  if (!(typeof e.score === 'number' && e.score >= 0)) errors.push('分数非法')
  if (!(typeof e.durationSec === 'number' && e.durationSec >= CFG.MIN_DURATION_SEC && e.durationSec <= CFG.MAX_DURATION_SEC)) {
    errors.push('答题时长异常')
  }
  const reviveCount = e.reviveCount || 0
  if (!(reviveCount >= 0 && reviveCount <= CFG.MAX_REVIVE_PER_GAME)) errors.push('复活次数越界')
  return errors
}

/** 用权威题库按当天题序逐题重算，返回错误列表 */
function recomputeErrors(e) {
  const errors = []
  const seq = daily.buildSet(String(e.challengeId), bank, undefined, e.runSeed, e.doneAtStart)
  if (!seq.length) {
    errors.push('今日题序缺失')
    return errors
  }
  const n = e.questionIds.length

  // 作答题目必须严格等于当天题序的前 N 题（顺序一致，防止挑题/换题）
  for (let i = 0; i < n; i++) {
    if (e.questionIds[i] !== seq[i].id) {
      errors.push('作答题目与当天题序不一致')
      break
    }
  }

  const byId = {}
  bank.questions.forEach((q) => (byId[q.id] = q))

  let correct = 0
  let maxScore = 0
  for (let i = 0; i < n; i++) {
    const q = seq[i]
    const a = e.answers[i]
    if (!a || a.qId !== q.id) {
      errors.push('缺少/错序作答: ' + q.id)
      continue
    }
    // chosen === -1 表示该题超时未作答（按答错处理）
    if (a.chosen !== -1 && !(typeof a.chosen === 'number' && a.chosen >= 0 && a.chosen < q.options.length)) {
      errors.push('选项越界: ' + q.id)
      continue
    }
    // 延时道具只增加单题用时（速度分只减不增），用物理硬上限拦截异常数据
    if (!(typeof a.seconds === 'number' && a.seconds >= 0 && a.seconds <= CFG.MAX_ANSWER_SECONDS)) errors.push('单题用时异常: ' + q.id)
    if (a.chosen === q.answer) correct += 1
    maxScore += daily.scoreOne(typeof a.seconds === 'number' ? Math.min(a.seconds, CFG.SPEED_NO_BONUS_SECONDS) : CFG.SPEED_NO_BONUS_SECONDS).total
  }

  if (correct !== e.correctCount) errors.push('正确数与重算结果不一致')
  if (e.score > maxScore + 1) errors.push('得分高于理论可得分')

  // 生命/复活自洽：错题数必须与“初始生命 + 复活次数”对得上。
  const wrong = n - correct
  const reviveCount = e.reviveCount || 0
  if (wrong > CFG.START_LIVES + reviveCount) errors.push('错题数超过可用生命')
  // 非通关局（没有答穿整条题序）应当是命尽结束，错题数恰为生命+复活数
  if (n < seq.length && wrong !== CFG.START_LIVES + reviveCount) errors.push('结束时生命未耗尽')
  // 总时长不能短于作答题数的物理下限
  if (e.durationSec < n * 0.3) errors.push('总时长与题数不匹配')

  return errors
}

/** 成绩更优：答对题数优先，再比总分（同题数下更快者），再比用时，再比提交先后 */
function betterThan(a, b) {
  if ((a.correctCount || 0) !== (b.correctCount || 0)) return (a.correctCount || 0) > (b.correctCount || 0)
  if ((a.score || 0) !== (b.score || 0)) return (a.score || 0) > (b.score || 0)
  if ((a.durationSec || 0) !== (b.durationSec || 0)) return (a.durationSec || 0) < (b.durationSec || 0)
  return (a.serverTs || 0) < (b.serverTs || 0)
}

async function rankOf(challengeId, score, correctCount, durationSec, serverTs) {
  const col = db.collection(COL)
  const queries = [
    { challengeId, correctCount: _.gt(correctCount) },
    { challengeId, correctCount, score: _.gt(score) },
    { challengeId, correctCount, score, durationSec: _.lt(durationSec) },
    { challengeId, correctCount, score, durationSec, serverTs: _.lt(serverTs) }
  ]
  let betterCount = 0
  for (let i = 0; i < queries.length; i++) {
    const r = await col.where(queries[i]).count()
    betterCount += r.total || 0
  }
  return betterCount + 1
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, reason: 'no_openid' }

  const structural = structuralErrors(event)
  if (structural.length) return { ok: false, reason: 'invalid', errors: structural }
  const verify = recomputeErrors(event)
  if (verify.length) return { ok: false, reason: 'answer_verify_failed', errors: verify }

  const col = db.collection(COL)
  const now = Date.now()
  const data = {
    challengeId: String(event.challengeId),
    openid: OPENID,
    score: event.score,
    correctCount: event.correctCount,
    wrongCount: (event.totalCount != null ? event.totalCount : event.questionIds.length) - event.correctCount,
    totalCount: event.totalCount != null ? event.totalCount : event.questionIds.length,
    durationSec: event.durationSec,
    revived: !!(event.reviveCount > 0),
    reviveCount: event.reviveCount || 0,
    updateTs: now
  }

  const existingRes = await col.where({ challengeId: data.challengeId, openid: OPENID }).limit(1).get()
  const existing = existingRes.data && existingRes.data[0]

  if (existing) {
    const candidate = { correctCount: data.correctCount, score: data.score, durationSec: data.durationSec, serverTs: existing.serverTs }
    if (!betterThan(candidate, existing)) {
      const rank = await rankOf(data.challengeId, existing.score, existing.correctCount, existing.durationSec, existing.serverTs)
      return { ok: true, submitted: false, better: false, reason: 'not_better', score: existing.score, rank, correctCount: existing.correctCount, recordId: existing._id }
    }
    await col.doc(existing._id).update({
      data: {
        score: data.score,
        correctCount: data.correctCount,
        wrongCount: data.wrongCount,
        totalCount: data.totalCount,
        durationSec: data.durationSec,
        revived: data.revived,
        reviveCount: data.reviveCount,
        updateTs: now
      }
    })
    const rank = await rankOf(data.challengeId, data.score, data.correctCount, data.durationSec, existing.serverTs)
    return { ok: true, submitted: true, better: true, score: data.score, rank, correctCount: data.correctCount, recordId: existing._id }
  }

  data.serverTs = now
  data.createTime = db.serverDate()
  const addRes = await col.add({ data })
  const rank = await rankOf(data.challengeId, data.score, data.correctCount, data.durationSec, data.serverTs)
  return { ok: true, submitted: true, better: true, score: data.score, rank, correctCount: data.correctCount, recordId: addRes._id }
}
