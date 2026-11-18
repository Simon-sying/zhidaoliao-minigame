/**
 * 核心纯逻辑 / 服务层单测（无第三方依赖，直接 node 运行）。
 * 用法：node test/logic.test.js
 * 运行前会注入一个内存版 wx 全局，供存储 / 平台模块在 Node 下工作。
 */
// ---- 内存版 wx，必须在 require 业务模块之前注入 ----
const mem = {}
globalThis.wx = {
  getStorageSync: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : ''),
  setStorageSync: (k, v) => {
    mem[k] = v
  },
  removeStorageSync: (k) => delete mem[k],
  getSystemInfoSync: () => ({
    windowWidth: 375,
    windowHeight: 667,
    pixelRatio: 2,
    statusBarHeight: 20,
    safeArea: { top: 20, bottom: 647 },
    screenHeight: 667
  })
}

const assert = require('assert')
const bank = require('../src/data/questions')
const categories = require('../src/data/categories')
const knowledge = require('../src/data/knowledge')
const util = require('../src/utils/util')
const mastery = require('../src/services/mastery')
const progress = require('../src/services/progress')
const quiz = require('../src/services/quiz')
const challenges = require('../src/services/challenges')
const leaderboard = require('../src/services/leaderboard')
const config = require('../src/config/index.js')
const cloudDaily = require('../cloudfunctions/submitScore/daily')
const serverBank = require('../cloudfunctions/submitScore/bank.json')

let passed = 0
function ok(name, cond) {
  assert.ok(cond, name)
  passed += 1
  console.log('  ✓ ' + name)
}
function eq(name, a, b) {
  assert.strictEqual(a, b, `${name}（期望 ${b}，实际 ${a}）`)
  passed += 1
  console.log('  ✓ ' + name)
}

async function main() {
  console.log('\n[题库与数据]')
  eq('题库 500 题', bank.count(), 500)
  eq('十大分类', categories.length, 10)
  eq('知识点目录非空', knowledge.count() > 0, true)

  console.log('\n[计分规则]')
  eq('5 秒满分速度分', challenges.scoreOne(5).total, 100)
  eq('25 秒无速度分', challenges.scoreOne(25).total, 90)
  eq('超过 25 秒不扣分', challenges.scoreOne(60).total, 90)
  eq('服务端与客户端同口径(5s)', cloudDaily.scoreOne(5).total, challenges.scoreOne(5).total)
  eq('服务端与客户端同口径(25s)', cloudDaily.scoreOne(25).total, challenges.scoreOne(25).total)

  console.log('\n[确定性每日题序：客户端 vs 云函数（无尽模式）]')
  const sampleDates = []
  const base = new Date(2026, 0, 1)
  for (let i = 0; i < 60; i++) {
    const d = new Date(base.getTime() + i * 17 * 86400000) // 跨步长，覆盖不同月/年
    sampleDates.push(util.dateCompact(d))
  }
  ;['20260920', '20261231', '20270101', '20240229'].forEach((s) => sampleDates.push(s))
  sampleDates.forEach((compact) => {
    const clientIds = quiz.buildDailySet(compact, categories).map((q) => q.id)
    const serverIds = cloudDaily.buildSet(compact, serverBank).map((q) => q.id)
    eq(`题序一致 ${compact}`, clientIds.join(','), serverIds.join(','))
    eq(`题序覆盖全题库 ${compact}`, clientIds.length, bank.count())
    eq(`题序无重复 ${compact}`, new Set(clientIds).size, clientIds.length)
  })
  // 前缀截断（玩家只答了前 N 题）也必须跨端一致
  eq(
    '前 30 题前缀一致',
    quiz.buildDailySet('20260920', categories, 30).map((q) => q.id).join(','),
    cloudDaily.buildSet('20260920', serverBank, 30).map((q) => q.id).join(',')
  )
  const day1 = quiz.buildDailySet('20260920', categories).map((q) => q.id)
  const day1b = quiz.buildDailySet('20260920', categories).map((q) => q.id)
  eq('同一天结果稳定', day1.join(','), day1b.join(','))

  console.log('\n[掌握度增减规则]')
  mastery.loadAll()
  eq('首次答对 +20', mastery.record('TEST_K', 'Q1', true, { isRecheck: false }).after, 20)
  eq('同知识点第二题 +20', mastery.record('TEST_K', 'Q2', true, { isRecheck: false }).after, 40)
  eq('第三题起 +30', mastery.record('TEST_K', 'Q3', true, { isRecheck: false }).after, 70)
  eq('首次答错只 +5', mastery.record('TEST_W', 'Q1', false, { isRecheck: false }).after, 5)
  eq('连续答错 -10 且下限 0', mastery.record('TEST_W', 'Q1', false, { isRecheck: false }).after, 0)
  mastery.record('TEST_C', 'Q1', true)
  mastery.record('TEST_C', 'Q2', true)
  mastery.record('TEST_C', 'Q3', true)
  mastery.record('TEST_C', 'Q4', true)
  eq('掌握度上限 100', mastery.record('TEST_C', 'Q5', true).after, 100)
  mastery.record('TEST_R', 'Q1', false)
  mastery.record('TEST_R', 'Q1', true)
  eq('复测通过清零连错', mastery.loadAll()['TEST_R'].wrongStreak, 0)

  console.log('\n[进度 / 错题 / 收藏]')
  progress.onLaunch()
  eq('首日连续天数 1', progress.getUser().streak, 1)
  progress.recordCasualAnswer(true)
  eq('累计题数累加', progress.getUser().totalAnswered, 1)
  const someQ = bank.getAll()[0]
  progress.addWrong(someQ)
  eq('错题入袋', progress.activeWrong().length, 1)
  progress.resolveWrong(someQ.id)
  eq('掌握后移出错题', progress.activeWrong().length, 0)
  progress.toggleFavorite(someQ.id)
  eq('收藏生效', progress.getFavorites().includes(someQ.id), true)

  console.log('\n[局内状态：生命 / 道具 / 复活]')
  const run = challenges.startRun()
  eq('初始 3 条生命', run.hearts, 3)
  eq('初始 2 个「减半」', run.h50, 2)
  eq('初始 1 个「正确答案」', run.hAnswer, 1)
  eq('初始 1 个「延时」', run.hTime, 1)
  eq('复活次数初始 0', run.reviveCount, 0)
  // 跳到第一道选择题（判断题只有 2 个选项，减半按设计只排除 1 项，不是本测试目标）
  let firstIdx = run.index
  while (run.set[firstIdx].options.length < 3) firstIdx += 1
  run.index = firstIdx
  const firstQ = run.set[run.index]
  // 「减半」道具
  const elim1 = challenges.useHint5050(run)
  eq('减半排除 2 个选项', elim1.length, 2)
  eq('减半后剩 1 个', run.h50, 1)
  ok('排除项不含正确答案', elim1.indexOf(firstQ.answer) === -1)
  challenges.useHint5050(run)
  eq('减半用完为 0', run.h50, 0)
  eq('无减半时返回 null', challenges.useHint5050(run), null)
  eq('看广告可补充减半', challenges.addHint5050(run), true)
  eq('补充后减半为 1', run.h50, 1)
  // 「正确答案」道具
  const ai = challenges.useHintAnswer(run)
  eq('正确答案道具返回正确项下标', ai, firstQ.answer)
  eq('正确答案剩 0 个', run.hAnswer, 0)
  eq('使用正确答案清空排除项', run.eliminated.length, 0)
  eq('无正确答案时返回 null', challenges.useHintAnswer(run), null)
  eq('看广告可补充正确答案', challenges.addHintAnswer(run), true)
  eq('补充后正确答案为 1', run.hAnswer, 1)
  // 「延时」道具
  eq('延时道具返回增加秒数 10', challenges.useHintTime(run), config.CHALLENGE.TIME_EXTEND_SECONDS)
  eq('延时剩 0 个', run.hTime, 0)
  eq('无延时返回 null', challenges.useHintTime(run), null)
  eq('看广告可补充延时', challenges.addHintTime(run), true)
  eq('补充后延时为 1', run.hTime, 1)
  eq('生命未满可 +1', challenges.addHeart(run), true)
  run.hearts = config.CHALLENGE.MAX_LIVES_CAP
  eq('生命达上限不可再加', challenges.addHeart(run), false)
  run.hearts = 0
  const r1 = challenges.reviveRun()
  ok('第 1 次复活成功', !!r1 && r1.hearts === 1 && r1.reviveCount === 1)
  r1.hearts = 0
  challenges.reviveRun()
  challenges.getRun().hearts = 0
  challenges.reviveRun()
  eq('每局最多复活 3 次', challenges.getRun().reviveCount, 3)
  eq('超过复活上限返回 null', challenges.reviveRun(), null)

  console.log('\n[无尽挑战 Payload 自检]')
  const set = challenges.getTodaySet()
  const tNow = Date.now()
  // 构造一局命尽局：前 13 题中错 4 题（含 1 次复活），最后一题答错耗尽生命，前缀严格对齐
  const N = 13
  const wrongPos = new Set([3, 7, 10, 12])
  const runAnswers = set.slice(0, N).map((q, i) => {
    if (wrongPos.has(i)) return { qId: q.id, chosen: (q.answer + 1) % q.options.length, correct: false, seconds: 6 }
    return { qId: q.id, chosen: q.answer, correct: true, seconds: 5 }
  })
  const payload = challenges.buildPayload({ answers: runAnswers, startedAt: tNow - 70000, finishedAt: tNow, reviveCount: 1 })
  eq('作答题数 13', payload.totalCount, 13)
  eq('答对 9 题', payload.correctCount, 9)
  eq('答错 4 题', payload.wrongCount, 4)
  eq('携带复活次数', payload.reviveCount, 1)
  eq('命尽+复活局通过校验', challenges.validatePayload(payload).valid, true)

  const noReviveAnswers = set.slice(0, 4).map((q, i) => {
    if (i === 3) return { qId: q.id, chosen: (q.answer + 1) % q.options.length, correct: false, seconds: 6 }
    return { qId: q.id, chosen: q.answer, correct: true, seconds: 5 }
  })
  const noRevive = challenges.buildPayload({ answers: noReviveAnswers, startedAt: tNow - 30000, finishedAt: tNow, reviveCount: 0 })
  eq('3 命无复活命尽局通过', challenges.validatePayload(noRevive).valid, true)

  // 超时题：chosen=-1 记为答错，单题用时 25 秒
  const timeoutAnswers = set.slice(0, 4).map((q, i) => {
    if (i === 0) return { qId: q.id, chosen: -1, correct: false, seconds: 25 }
    return { qId: q.id, chosen: q.answer, correct: true, seconds: 5 }
  })
  const timeoutRun = challenges.buildPayload({ answers: timeoutAnswers, startedAt: tNow - 40000, finishedAt: tNow, reviveCount: 0 })
  eq('超时局答对 3 题', timeoutRun.correctCount, 3)
  eq('超时局分数 390', timeoutRun.score, 390)
  eq('超时局通过校验', challenges.validatePayload(timeoutRun).valid, true)

  // 使用「延时」后本题作答更慢（30 秒）合法，但速度分为 0；4 题都延时作答只得基础分
  const delayedAnswers = set.slice(0, 4).map((q) => ({ qId: q.id, chosen: q.answer, correct: true, seconds: 30 }))
  const delayedRun = challenges.buildPayload({ answers: delayedAnswers, startedAt: tNow - 130000, finishedAt: tNow, reviveCount: 0 })
  eq('延时局答对 4 题', delayedRun.correctCount, 4)
  eq('延时作答只拿基础分 4×90=360', delayedRun.score, 360)
  eq('延时作答通过校验', challenges.validatePayload(delayedRun).valid, true)

  const slowAnswer = Object.assign({}, timeoutRun, {
    answers: timeoutRun.answers.slice(),
    questionIds: timeoutRun.questionIds.slice(),
    score: timeoutRun.score
  })
  slowAnswer.answers[1] = { qId: slowAnswer.answers[1].qId, chosen: set[1].answer, seconds: 999 }
  eq('单题用时超过物理上限被拦截', challenges.validatePayload(slowAnswer).valid, false)

  const tamperScore = Object.assign({}, payload, { score: 999999 })
  eq('虚高分数被拦截', challenges.validatePayload(tamperScore).valid, false)
  const lie = Object.assign({}, payload, { correctCount: 13 })
  eq('虚报正确数被拦截', challenges.validatePayload(lie).valid, false)
  const tooManyWrong = Object.assign({}, noRevive, { reviveCount: 0, questionIds: noRevive.questionIds, answers: noRevive.answers })
  tooManyWrong.answers = set.slice(0, 5).map((q, i) => ({ qId: q.id, chosen: (q.answer + 1) % q.options.length, correct: false, seconds: 6 }))
  tooManyWrong.questionIds = tooManyWrong.answers.map((a) => a.qId)
  eq('错题数超过生命被拦截', challenges.validatePayload(tooManyWrong).valid, false)
  const swapped = Object.assign({}, payload)
  swapped.questionIds = swapped.questionIds.slice()
  swapped.questionIds[0] = set[N + 5].id
  eq('换题/非题序被拦截', challenges.validatePayload(swapped).valid, false)
  const tooFast = Object.assign({}, payload, { durationSec: 0 })
  eq('异常时长被拦截', challenges.validatePayload(tooFast).valid, false)

  console.log('\n[排行榜本地模式]')
  const board = await leaderboard.getBoard()
  eq('未开云时为本地模式', board.mode, 'local')
  eq('发布版不返回虚拟榜', board.list.length, 0)
  eq('发布版 preview=false', board.preview, false)
  eq('本地模式不产生我的名次', board.myRank, null)
  // 调试模式下才生成确定性的虚拟预览榜
  config.APP.DEBUG = true
  const dbg = await leaderboard.getBoard()
  eq('调试模式预览榜 20 条', dbg.list.length, 20)
  eq('调试模式 preview=true', dbg.preview, true)
  const dbg2 = await leaderboard.getBoard()
  eq('预览数据两次一致', dbg2.list.map((x) => x.nickname).join(','), dbg.list.map((x) => x.nickname).join(','))
  config.APP.DEBUG = false

  console.log(`\n✅ 全部通过，共 ${passed} 项断言`)
}

main().catch((e) => {
  console.error('\n❌ 测试失败：', e.message)
  console.error(e.stack)
  process.exit(1)
})
