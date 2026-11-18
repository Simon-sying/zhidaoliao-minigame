/** 纯函数工具：可在 Node 单测中直接引用（不依赖 wx）。 */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

/** yyyy-mm-dd（本地时区），作为每日挑战 / 每日签到的稳定 key */
function dateStr(d) {
  d = d || new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function dateCompact(d) {
  d = d || new Date()
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

function daysBetween(aStr, bStr) {
  const a = new Date(aStr + 'T00:00:00')
  const b = new Date(bStr + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

/** 确定性伪随机（mulberry32）：同一日期种子 -> 全体用户拿到同一套每日挑战题 */
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
  rng = rng || Math.random
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick(arr, rng) {
  rng = rng || Math.random
  return arr[Math.floor(rng() * arr.length)]
}

/**
 * 选项显示置换表：返回数组 perm，perm[displayIndex] = 原始选项下标。
 * 渲染时第 i 个位置显示 q.options[perm[i]]，玩家选择后仍按原始下标提交，
 * 这样答案校验、减半排除等逻辑全部不受影响（纯渲染层乱序）。
 * shuffle=false 时返回原序；seed 提供时确定性洗牌（同题同种子结果一致），否则用 Math.random。
 */
function optionPerm(optionCount, opts) {
  opts = opts || {}
  const n = optionCount || 0
  const perm = []
  for (let i = 0; i < n; i++) perm.push(i)
  if (!opts.shuffle || n < 2) return perm
  return shuffle(perm, opts.seed != null ? seeded(opts.seed) : Math.random)
}
function uid(prefix) {
  return (prefix || 'id_') + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

/** 计算每题得分：基础分 + 速度奖励 */
function scoreQuestion(answeredInSeconds, cfg) {
  cfg = cfg || require('../config/index.js').CHALLENGE
  const base = cfg.BASE_SCORE_PER_Q
  const t = clamp(
    (answeredInSeconds - cfg.SPEED_FULL_BONUS_SECONDS) /
      (cfg.SPEED_NO_BONUS_SECONDS - cfg.SPEED_FULL_BONUS_SECONDS),
    0,
    1
  )
  const bonus = Math.round(cfg.MAX_SPEED_BONUS_PER_Q * (1 - t))
  return { base, bonus, total: base + bonus }
}

module.exports = {
  clamp,
  pad2,
  dateStr,
  dateCompact,
  daysBetween,
  seeded,
  hashStr,
  shuffle,
  optionPerm,
  pick,
  uid,
  nowSec,
  scoreQuestion
}
