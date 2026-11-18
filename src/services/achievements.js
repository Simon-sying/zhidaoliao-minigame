/**
 * 成就系统（设计文档第 63 节，第一版仅简单成就，全部本地判定）。
 */
const progress = require('./progress')
const mastery = require('./mastery')
const storage = require('../core/storage')

const DEFS = [
  { id: 'first_answer', emoji: '🌱', name: '第一次答题', desc: '完成你的第一道题' },
  { id: 'learn_10', emoji: '🧠', name: '学会 10 个知识', desc: '掌握度达到“掌握”的知识点累计 10 个' },
  { id: 'learn_50', emoji: '📚', name: '学会 50 个知识', desc: '掌握度达标的知识点累计 50 个' },
  { id: 'streak_7', emoji: '🔥', name: '连续学习 7 天', desc: '连续 7 天回来答题' },
  { id: 'first_challenge', emoji: '🏆', name: '第一次参加排名', desc: '完成一局每日挑战' },
  { id: 'top_1000', emoji: '🥇', name: '今日前 1000', desc: '在云端今日榜进入前 1000 名' },
  { id: 'fav_10', emoji: '💡', name: '收藏 10 个知识', desc: '收藏 10 道有价值的题' }
]

function bestCloudRank() {
  const map = storage.get(progress.K.DAILY, null) || {}
  let best = null
  Object.keys(map).forEach((date) => {
    const rank = map[date] && map[date].challenge && map[date].challenge.cloudRank
    if (typeof rank === 'number' && (best === null || rank < best)) best = rank
  })
  return best
}

function metric(id) {
  const u = progress.getUser()
  switch (id) {
    case 'first_answer':
      return u.totalAnswered >= 1
    case 'learn_10':
      return mastery.masteredCount() >= 10
    case 'learn_50':
      return mastery.masteredCount() >= 50
    case 'streak_7':
      return u.streak >= 7
    case 'first_challenge':
      return u.challengeFinished >= 1
    case 'top_1000': {
      const r = bestCloudRank()
      return r !== null && r <= 1000
    }
    case 'fav_10':
      return progress.getFavorites().length >= 10
    default:
      return false
  }
}

/** 计算当前条件，解锁新成就，返回本次新解锁的定义列表（可用于弹提示） */
function evaluate() {
  const newly = []
  DEFS.forEach((def) => {
    if (metric(def.id) && progress.unlockAchievement(def.id)) newly.push(def)
  })
  return newly
}

function list() {
  const unlocked = progress.getAchievements()
  return DEFS.map((def) => ({ ...def, unlocked: !!unlocked[def.id], unlockedAt: unlocked[def.id] || null }))
}

module.exports = { DEFS, evaluate, list, bestCloudRank }
