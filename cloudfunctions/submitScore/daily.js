/**
 * 服务端“无尽挑战”确定性逻辑 —— 必须与客户端保持一致：
 *  src/utils/util.js（seeded/hashStr/shuffle/scoreQuestion）
 *  src/services/quiz.js（buildDailySet）
 *  test/logic.test.js 会用多个日期交叉校验一致性。
 */
const CFG = {
  START_LIVES: 3,
  PER_QUESTION_SEC: 25,
  HINT_5050_PER_GAME: 2,
  HINT_ANSWER_PER_GAME: 1,
  HINT_TIME_PER_GAME: 1,
  TIME_EXTEND_SECONDS: 10,
  HINT_EXCLUDE_OPTIONS: 2,
  MAX_LIVES_CAP: 5,
  MAX_REVIVE_PER_GAME: 3,
  BASE_SCORE_PER_Q: 90,
  MAX_SPEED_BONUS_PER_Q: 10,
  SPEED_FULL_BONUS_SECONDS: 5,
  SPEED_NO_BONUS_SECONDS: 25,
  MAX_ANSWER_SECONDS: 120,
  MIN_DURATION_SEC: 1,
  MAX_DURATION_SEC: 7200
}
// 分类顺序必须与 src/data/categories.js 完全一致
const CATEGORY_IDS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}
function seeded(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function shuffle(arr, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 生成指定日期的挑战题序（全题库确定性洗牌）。
 * @param {string} dateCompact YYYYMMDD
 * @param {{version:string, questions:Array}} bankData 随包题库
 * @param {number} count 取前 N 题；缺省返回整条序列
 * @param {number} [runSeed] 本局随机 seed：客户端每局对当天题池洗一次牌，
 *   随成绩上报；云端据此重放成本局题序逐题复核（只改顺序，不改题目集合）。
 */
function buildSet(dateCompact, bankData, count, runSeed, doneAtStart) {
  const rng = seeded(hashStr('daily_' + dateCompact + '_v' + bankData.version))
  let seq = shuffle(bankData.questions, rng)
  if (runSeed != null && !isNaN(Number(runSeed))) {
    if (Array.isArray(doneAtStart) && doneAtStart.length) {
      // 开局时已做过的题排到队尾，未做过的题用本局 seed 洗牌在前（与客户端 startRun 一致）
      const fresh = seq.filter((q) => doneAtStart.indexOf(q.id) === -1)
      const done = seq.filter((q) => doneAtStart.indexOf(q.id) !== -1)
      seq = shuffle(fresh, seeded(Number(runSeed) >>> 0)).concat(done)
    } else {
      seq = shuffle(seq, seeded(Number(runSeed) >>> 0))
    }
  }
  const n = typeof count === 'number' && count > 0 ? Math.min(count, seq.length) : seq.length
  return seq.slice(0, n)
}

function scoreOne(seconds) {
  const t = clamp(
    (seconds - CFG.SPEED_FULL_BONUS_SECONDS) / (CFG.SPEED_NO_BONUS_SECONDS - CFG.SPEED_FULL_BONUS_SECONDS),
    0,
    1
  )
  const bonus = Math.round(CFG.MAX_SPEED_BONUS_PER_Q * (1 - t))
  return { base: CFG.BASE_SCORE_PER_Q, bonus, total: CFG.BASE_SCORE_PER_Q + bonus }
}

module.exports = { CFG, CATEGORY_IDS, buildSet, scoreOne, seeded, hashStr, shuffle }
