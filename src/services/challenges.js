/**
 * 无尽排名挑战：当天确定性题池、计分、局内状态（生命/提示/复活）、
 * 成绩载荷构造与客户端基础自检。真正的权威校验在云函数 submitScore 中。
 *
 * 去重规则：当天"已答过的题"持久化在本地，新开局时未做题排前（本局 seed 洗牌）、
 * 已做题排后——今天做过的题不会立刻再遇到，答完当天一轮（全题库）才开始重复。
 * 本局开局时快照 doneAtStart 随成绩上报，云端据此重放题序逐题复核。
 */
const config = require('../config/index.js')
const categories = require('../data/categories')
const bank = require('../data/questions')
const quiz = require('./quiz')
const util = require('../utils/util')
const storage = require('../core/storage')

let cachedSet = null
let cachedId = null
// 当前进行中的一局（跨“挑战页 ↔ 结算页复活”保留，使复活能续答而非重开）
let activeRun = null

function C() {
  return config.CHALLENGE
}
function todayId(d) {
  return util.dateCompact(d || new Date())
}

function getTodaySet(d) {
  const id = todayId(d)
  if (cachedId !== id || !cachedSet) {
    cachedId = id
    cachedSet = quiz.buildDailySet(id, categories)
  }
  return cachedSet
}

/** 单题作答 -> 得分 */
function scoreOne(seconds) {
  return util.scoreQuestion(seconds, C())
}

/* ---------------- 当天已答题去重（本地持久化） ---------------- */
function dayDoneKey(dateCompact) {
  return 'challengeDone_' + (dateCompact || todayId())
}
/** 当天已答过的题目 id 列表 */
function getDayDone(dateCompact) {
  const d = storage.get(dayDoneKey(dateCompact), null) || { ids: [] }
  return Array.isArray(d.ids) ? d.ids : []
}
/** 记录一题已答（答对答错都算，答完立即持久化，中途退出也不丢） */
function markDayDone(qId, dateCompact) {
  const k = dayDoneKey(dateCompact || todayId())
  const d = storage.get(k, null) || { ids: [] }
  if (!Array.isArray(d.ids)) d.ids = []
  if (d.ids.indexOf(qId) === -1) d.ids.push(qId)
  storage.set(k, d)
}

/* ---------------- 局内状态 ---------------- */

/**
 * 开始一局新的无尽挑战。
 * 当天题池对全体玩家一致（公平、可云端复核）；已做过的题排到序列尾部，
 * 未做过的题用本局随机 seed 洗牌，既保证每次重开顺序不同，又避免今天重复做题。
 */
function startRun() {
  const dateCompact = todayId()
  const doneAtStart = getDayDone(dateCompact)
  const runSeed = (Math.random() * 0xffffffff) >>> 0
  const pool = getTodaySet()
  const fresh = pool.filter((q) => doneAtStart.indexOf(q.id) === -1)
  const done = pool.filter((q) => doneAtStart.indexOf(q.id) !== -1)
  const set = util.shuffle(fresh, util.seeded(runSeed)).concat(done)
  activeRun = {
    set,
    runSeed,
    doneAtStart,
    dateCompact,
    index: 0,
    answers: [],
    hearts: C().START_LIVES,
    h50: C().HINT_5050_PER_GAME, // 「减半」剩余数量
    hAnswer: C().HINT_ANSWER_PER_GAME, // 「正确答案」剩余数量
    hTime: C().HINT_TIME_PER_GAME, // 「延时」剩余数量
    reviveCount: 0,
    startedAt: Date.now(),
    eliminated: [] // 当前题被「减半」排除的选项下标
  }
  return activeRun
}

function getRun() {
  return activeRun
}

/**
 * 命尽后看广告复活：+1 生命、复活次数 +1，并推进到下一题继续。
 * 复活次数受每局上限约束。
 */
function reviveRun() {
  if (!activeRun) return null
  if (activeRun.reviveCount >= C().MAX_REVIVE_PER_GAME) return null
  activeRun.reviveCount += 1
  activeRun.hearts = Math.min(C().MAX_LIVES_CAP, activeRun.hearts + 1)
  // 命尽时 index 停在导致失败的错题，复活后跳到下一题
  activeRun.index += 1
  activeRun.eliminated = []
  return activeRun
}

/** 答对/答错后推进到下一题；返回是否还有题可答 */
function advanceRun(run) {
  run.index += 1
  run.eliminated = []
  return run.index < run.set.length
}

/** 答题中看广告临时 +1 生命（未命尽时），受上限约束 */
function addHeart(run) {
  if (!run) return false
  if (run.hearts >= C().MAX_LIVES_CAP) return false
  run.hearts += 1
  return true
}

/**
 * 「减半」道具要排除的错误选项下标（50/50）。
 * 选择题排除 2 个错误项（保留 1 对 1 错）；判断题只剩 1 个错误项时直接排除它。
 */
function hintEliminations(q) {
  const wrong = []
  for (let i = 0; i < q.options.length; i++) if (i !== q.answer) wrong.push(i)
  const keepOneWrong = q.options.length > 2
  const excludeCount = keepOneWrong
    ? Math.min(C().HINT_EXCLUDE_OPTIONS, wrong.length - 1)
    : wrong.length
  return util.shuffle(wrong, Math.random).slice(0, Math.max(0, excludeCount))
}

/** 使用「减半」：有库存则扣减并写入当前题排除项，返回排除下标；否则返回 null */
function useHint5050(run) {
  if (!run || run.h50 <= 0) return null
  const q = run.set[run.index]
  if (!q) return null
  run.h50 -= 1
  run.eliminated = hintEliminations(q)
  return run.eliminated
}

/** 看广告补充 1 个「减半」 */
function addHint5050(run) {
  if (!run) return false
  run.h50 += 1
  return true
}

/**
 * 使用「正确答案」：有库存则扣减并返回正确项下标（由场景立即按答对结算，
 * 但不拿速度分）；否则返回 null。
 */
function useHintAnswer(run) {
  if (!run || run.hAnswer <= 0) return null
  const q = run.set[run.index]
  if (!q) return null
  run.hAnswer -= 1
  run.eliminated = []
  return q.answer
}

/** 看广告补充 1 个「正确答案」 */
function addHintAnswer(run) {
  if (!run) return false
  run.hAnswer += 1
  return true
}

/**
 * 使用「延时」：有库存则扣减并返回本题增加的秒数（由场景把当前题倒计时延长）；
 * 只影响本题作答时长（速度分只减不增），不改变对错。否则返回 null。
 */
function useHintTime(run) {
  if (!run || run.hTime <= 0) return null
  run.hTime -= 1
  return C().TIME_EXTEND_SECONDS
}

/** 看广告补充 1 个「延时」 */
function addHintTime(run) {
  if (!run) return false
  run.hTime += 1
  return true
}

/* ---------------- 成绩载荷 / 校验 ---------------- */

/**
 * 由一局作答过程汇总成绩并构造提交载荷。
   run/session: { answers:[{qId, chosen, correct, seconds}], startedAt, hearts?, reviveCount?, runSeed?, doneAtStart? }
 */
function buildPayload(session) {
  const answers = session.answers || []
  let score = 0
  answers.forEach((a) => {
    score += scoreOne(a.seconds).total
  })
  const correctCount = answers.filter((a) => a.correct).length
  const durationSec = Math.max(0, Math.round(((session.finishedAt || Date.now()) - session.startedAt) / 1000))
  return {
    challengeId: todayId(new Date(session.startedAt)),
    runSeed: session.runSeed, // 本局洗牌 seed：云端据此重放题序逐题复核
    doneAtStart: Array.isArray(session.doneAtStart) ? session.doneAtStart : [], // 开局时当天已答题快照
    questionIds: answers.map((a) => a.qId),
    answers: answers.map((a) => ({ qId: a.qId, chosen: a.chosen, seconds: a.seconds })),
    durationSec,
    correctCount,
    wrongCount: answers.length - correctCount,
    totalCount: answers.length,
    score,
    reviveCount: session.reviveCount || 0,
    clientTs: session.finishedAt || Date.now()
  }
}

/**
 * 客户端基础自检（与云函数规则保持一致）：变长题序、严格前缀、
 * 错题数必须与生命+复活次数自洽。返回 { valid, errors }。
 */
function validatePayload(p) {
  const errors = []
  const cfg = C()
  if (!p || typeof p !== 'object') return { valid: false, errors: ['payload 为空'] }
  if (!/^\d{8}$/.test(String(p.challengeId))) errors.push('challengeId 非法')

  const seq = getTodaySet(safeParse(p.challengeId))
  // 本局题序 = 当天题池中「开局时未做过的题」用 runSeed 洗牌在前 + 「已做过的题」原序在后
  let ordered = seq
  if (p.runSeed != null && !isNaN(Number(p.runSeed))) {
    const done = Array.isArray(p.doneAtStart) ? p.doneAtStart : []
    const fresh = ordered.filter((q) => done.indexOf(q.id) === -1)
    const doneQ = ordered.filter((q) => done.indexOf(q.id) !== -1)
    ordered = util.shuffle(fresh, util.seeded(Number(p.runSeed) >>> 0)).concat(doneQ)
  }
  const seqIds = ordered.map((q) => q.id)
  const ids = Array.isArray(p.questionIds) ? p.questionIds : []
  const n = ids.length

  if (n < 1 || n > seqIds.length) errors.push('作答题数越界')
  if (new Set(ids).size !== n) errors.push('题目 ID 重复')
  // 作答题目必须严格等于“本局题序的前 N 题”（顺序一致，不能挑简单题）
  for (let i = 0; i < n; i++) {
    if (ids[i] !== seqIds[i]) {
      errors.push('作答题目与本局题序不一致')
      break
    }
  }
  if (!(p.correctCount >= 0 && p.correctCount <= n)) errors.push('正确数越界')
  if (typeof p.score !== 'number' || p.score < 0) errors.push('分数非法')
  if (!(typeof p.durationSec === 'number' && p.durationSec >= cfg.MIN_DURATION_SEC && p.durationSec <= cfg.MAX_DURATION_SEC)) {
    errors.push('答题时长异常')
  }
  const reviveCount = p.reviveCount || 0
  if (!(reviveCount >= 0 && reviveCount <= cfg.MAX_REVIVE_PER_GAME)) errors.push('复活次数越界')
  const wrongCount = n - (p.correctCount || 0)
  if (wrongCount < 0 || wrongCount > cfg.START_LIVES + reviveCount) errors.push('错题数与生命/复活次数不自洽')

  // 用本地题库复核：正确数与得分是否自洽
  if (Array.isArray(p.answers) && p.answers.length === n && n > 0) {
    let recomputedCorrect = 0
    let recomputedMax = 0
    p.answers.forEach((a, i) => {
      const q = bank.getById(a.qId)
      if (!q || a.qId !== seqIds[i]) {
        if (q) errors.push('作答顺序与题序不符: ' + a.qId)
        else errors.push('存在未知题目: ' + a.qId)
        return
      }
      // chosen === -1 表示该题超时未作答（按答错处理）；延时只增加用时、不产生速度分利益
      if (a.chosen !== -1 && (a.chosen < 0 || a.chosen >= q.options.length)) errors.push('选项越界: ' + a.qId)
      if (!(typeof a.seconds === 'number' && a.seconds >= 0 && a.seconds <= cfg.MAX_ANSWER_SECONDS)) {
        errors.push('单题用时异常: ' + a.qId)
      }
      if (a.chosen === q.answer) recomputedCorrect += 1
      recomputedMax += scoreOne(typeof a.seconds === 'number' ? Math.min(a.seconds, cfg.SPEED_NO_BONUS_SECONDS) : cfg.SPEED_NO_BONUS_SECONDS).total
    })
    if (recomputedCorrect !== p.correctCount) errors.push('正确数与作答记录不一致')
    if (p.score > recomputedMax + 1) errors.push('得分高于理论可得分')
  } else if (n > 0) {
    errors.push('作答明细不完整')
  }

  return { valid: errors.length === 0, errors }
}

// 由 YYYYMMDD 构造 Date（校验用，失败回退今天）
function safeParse(compact) {
  const s = String(compact)
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(4, 6))
  const d = Number(s.slice(6, 8))
  const dt = new Date(y, m - 1, d)
  return isNaN(dt.getTime()) ? new Date() : dt
}

/** 比较两局成绩：答对题数优先，同分再比总分（更快车） */
function isBetter(a, b) {
  if (!b) return true
  if ((a.correctCount || 0) !== (b.correctCount || 0)) return (a.correctCount || 0) > (b.correctCount || 0)
  return (a.score || 0) > (b.score || 0)
}

module.exports = {
  todayId,
  getTodaySet,
  scoreOne,
  getDayDone,
  markDayDone,
  startRun,
  getRun,
  reviveRun,
  advanceRun,
  addHeart,
  useHint5050,
  addHint5050,
  useHintAnswer,
  addHintAnswer,
  useHintTime,
  addHintTime,
  hintEliminations,
  buildPayload,
  validatePayload,
  isBetter
}
