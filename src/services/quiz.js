/**
 * 抽题调度（休闲模式）+ 每日挑战题集生成。
 * 休闲模式要点（设计文档第 15 节）：错题不立即原样重复，间隔若干题后，
 * 优先用"同一知识点的另一道题"复测；未掌握 / 未学知识点优先。
 * 去重规则：以"全题库一轮"为周期——答过的题不再出现，直到整轮答完才重置；
 * 一轮内错题复测也只从未出题的姊妹题中选，不再原题复测。
 */
const bank = require('../data/questions')
const config = require('../config/index.js')
const util = require('../utils/util')
const progress = require('./progress')
const masterySvc = require('./mastery')

const RECENT_RING = 8
let recent = []

function remember(qId) {
  recent.push(qId)
  if (recent.length > RECENT_RING) recent = recent.slice(-RECENT_RING)
}
function _resetRecent() {
  recent = []
}

/** 休闲模式下一题 */
function nextCasualQuestion(options) {
  options = options || {}
  const seq = progress.getSeq()
  const gap = config.MASTERY.RECHECK_GAP
  const wrong = progress.activeWrong()
  const doneIds = progress.getCasualDone().ids
  const bankCount = bank.count()

  /** 本轮尚未出过的候选题（无放回池；池空时重置为新的一轮） */
  function freshPool(categoryId) {
    let pool = categoryId ? bank.getByCategory(categoryId) : bank.getAll()
    pool = pool.filter((q) => doneIds.indexOf(q.id) === -1)
    if (pool.length) return pool
    // 本轮已答完：开启下一轮，全量重新开始（此后遇到的题视为"重复出现"，会乱序选项）
    progress.rememberCasual('', bankCount)
    return categoryId ? bank.getByCategory(categoryId) : bank.getAll()
  }

  // 1) 到期的错题：优先用"本轮未出过的同知识点另一道题"换场景复测
  const due = wrong
    .filter((w) => seq - w.seq >= gap)
    .sort((a, b) => a.seq - b.seq)
  for (let i = 0; i < due.length; i++) {
    const w = due[i]
    const siblings = bank
      .getByKnowledge(w.knowledgeId)
      .filter((q) => q.id !== w.qId && doneIds.indexOf(q.id) === -1 && (!options.categoryId || q.categoryId === options.categoryId))
    if (siblings.length) {
      const q = util.pick(siblings)
      remember(q.id)
      progress.rememberCasual(q.id, bankCount)
      return q
    }
    // 没有未出题的姊妹题时，本轮不原题复测（保证一轮内不重复原题）
  }

  // 2) 加权随机：未学 / 掌握度低的知识点权重更高，从本轮未出题池中抽取
  let pool = freshPool(options.categoryId)
  const masteryMap = masterySvc.loadAll()

  const weighted = pool.map((q) => {
    const st = masteryMap[q.knowledgeId]
    let weight
    if (!st || st.seen === 0) weight = 10
    else weight = Math.max(1, 11 - Math.round(st.v / 10)) // 掌握越低权重越高
    return { q, weight }
  })
  let total = weighted.reduce((s, x) => s + x.weight, 0)
  let r = Math.random() * total
  for (let i = 0; i < weighted.length; i++) {
    r -= weighted[i].weight
    if (r <= 0) {
      remember(weighted[i].q.id)
      progress.rememberCasual(weighted[i].q.id, bankCount)
      return weighted[i].q
    }
  }

  // 3) 兜底：随机一道（候选池非空时几乎不会走到这里）
  const fallback = util.pick(pool.length ? pool : bank.getAll())
  remember(fallback.id)
  progress.rememberCasual(fallback.id, bankCount)
  return fallback
}

/** 该题在休闲模式本轮内是否已出过（"重复出现"→ 渲染时打乱选项位置） */
function isCasualRepeat(qId) {
  return progress.isCasualDone(qId)
}

/**
 * 生成指定日期的挑战题序（对全体用户确定一致，无尽闯关模式）：
 * 用日期做种子，把当天全题库确定性洗牌成一条长序列，玩家从头一路闯关。
 * 不使用 Math.random，保证同一天同一题库版本结果稳定、可在云端逐题复核。
 * @param {string} dateCompact 日期 YYYYMMDD
 * @param {Array} categories 保留参数（兼容旧调用），无尽模式不再按分类配额
 * @param {number} count 取前 N 题；缺省返回整条序列
 */
function buildDailySet(dateCompact, categories, count) {
  const rng = util.seeded(util.hashStr('daily_' + dateCompact + '_v' + bank.version))
  const seq = util.shuffle(bank.getAll(), rng)
  const n = typeof count === 'number' && count > 0 ? Math.min(count, seq.length) : seq.length
  return seq.slice(0, n)
}

module.exports = { nextCasualQuestion, isCasualRepeat, buildDailySet, remember, _resetRecent }
