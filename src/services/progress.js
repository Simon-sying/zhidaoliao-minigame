/**
 * 本地学习进度与状态（设计文档第 45 节全部本地存储项）。
 * 纯本地、离线可用；云端只保存排行榜必需的成绩。
 */
const storage = require('../core/storage')
const { dateStr, daysBetween, nowSec } = require('../utils/util')

const K = {
  USER: 'userState',
  DAILY: 'dailyLocalState',
  WRONG: 'wrongQuestions',
  FAV: 'favoriteQuestions',
  ACH: 'achievements',
  SETTINGS: 'userSettings',
  CASUAL_DONE: 'casualDoneV1'
}

function today() {
  return dateStr()
}

function getUser() {
  return storage.get(K.USER, null) || {
    firstOpenDate: '',
    lastOpenDate: '',
    streak: 0,
    bestStreak: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    casualAnswered: 0,
    casualCorrect: 0,
    challengePlayed: 0,
    challengeFinished: 0,
    adsWatched: 0
  }
}
function saveUser(u) {
  storage.set(K.USER, u)
}

/** 启动时调用：初始化 + 计算连续学习天数 */
function onLaunch() {
  const u = getUser()
  const t = today()
  if (!u.firstOpenDate) {
    u.firstOpenDate = t
    u.streak = 1
  } else if (u.lastOpenDate !== t) {
    const gap = daysBetween(u.lastOpenDate, t)
    u.streak = gap === 1 ? u.streak + 1 : 1
  }
  u.lastOpenDate = t
  u.bestStreak = Math.max(u.bestStreak || 0, u.streak)
  saveUser(u)
  ensureDaily(t)
  return u
}

/* ---------------- 每日状态 ---------------- */
function getDailyMap() {
  return storage.get(K.DAILY, null) || {}
}
function ensureDaily(date) {
  const map = getDailyMap()
  if (!map[date]) {
    map[date] = {
      casual: { answered: 0, correct: 0 },
      challenge: {
        played: false,
        finished: false,
        bestCorrect: 0,
        bestScore: 0,
        reviveUsed: false,
        reviveCount: 0,
        cloudSubmitted: false,
        cloudRecordId: '',
        cloudRank: null
      }
    }
    storage.set(K.DAILY, map)
  }
  return map[date]
}
function getDaily(date) {
  return ensureDaily(date || today())
}
function patchDaily(date, fn) {
  const map = getDailyMap()
  const d = ensureDaily(date)
  fn(d)
  map[date] = d
  storage.set(K.DAILY, map)
  return d
}

/* ---------------- 休闲模式 ---------------- */
function recordCasualAnswer(isCorrect) {
  const u = getUser()
  u.totalAnswered += 1
  u.casualAnswered += 1
  if (isCorrect) {
    u.totalCorrect += 1
    u.casualCorrect += 1
  }
  saveUser(u)
  patchDaily(today(), (d) => {
    d.casual.answered += 1
    if (isCorrect) d.casual.correct += 1
  })
  return u.casualAnswered // 返回当前单调递增序号（供错题间隔复测使用）
}
function getSeq() {
  return getUser().casualAnswered
}

/* ---------------- 休闲模式去重：一轮无放回 ---------------- */
/**
 * 休闲刷题以"全题库一轮"为周期：答过的题不再出现，直到整轮答完才重置，
 * 新一轮里已答过的题（此时算"重复出现"）渲染时才会打乱选项位置。
 */
function getCasualDone() {
  return storage.get(K.CASUAL_DONE, null) || { ids: [], round: 0 }
}
function isCasualDone(qId) {
  return getCasualDone().ids.indexOf(qId) !== -1
}
/** 记录一道题已出；答满一轮（>= 全题库数量）后自动开启下一轮 */
function rememberCasual(qId, bankCount) {
  const d = getCasualDone()
  if (d.ids.indexOf(qId) === -1) d.ids.push(qId)
  if (typeof bankCount === 'number' && d.ids.length >= bankCount) {
    d.ids = []
    d.round += 1
  }
  storage.set(K.CASUAL_DONE, d)
  return d.round
}

/* ---------------- 错题本 ---------------- */
function getWrongList() {
  return storage.get(K.WRONG, null) || []
}
function addWrong(q) {
  const list = getWrongList()
  const exist = list.some((w) => w.qId === q.id && !w.resolved)
  if (exist) return
  list.push({
    qId: q.id,
    knowledgeId: q.knowledgeId,
    categoryId: q.categoryId,
    date: today(),
    seq: getSeq(),
    resolved: false
  })
  storage.set(K.WRONG, list)
}
function resolveWrong(qId) {
  const list = getWrongList()
  let changed = false
  list.forEach((w) => {
    if (w.qId === qId && !w.resolved) {
      w.resolved = true
      w.resolvedAt = nowSec()
      changed = true
    }
  })
  if (changed) storage.set(K.WRONG, list)
}
function activeWrong() {
  return getWrongList().filter((w) => !w.resolved)
}
function removeWrong(qId) {
  storage.set(
    K.WRONG,
    getWrongList().filter((w) => w.qId !== qId)
  )
}

/* ---------------- 收藏 ---------------- */
function getFavorites() {
  return storage.get(K.FAV, null) || []
}
function isFavorite(qId) {
  return getFavorites().indexOf(qId) !== -1
}
function toggleFavorite(qId) {
  let list = getFavorites()
  if (list.indexOf(qId) !== -1) list = list.filter((x) => x !== qId)
  else list = [qId].concat(list)
  storage.set(K.FAV, list)
  return list.indexOf(qId) !== -1
}

/* ---------------- 排名挑战 ---------------- */
function markChallengePlayed() {
  const u = getUser()
  u.challengePlayed += 1
  saveUser(u)
  patchDaily(today(), (d) => {
    d.challenge.played = true
  })
}
function recordChallengeResult(result) {
  const u = getUser()
  u.challengeFinished += 1
  saveUser(u)
  return patchDaily(today(), (d) => {
    d.challenge.finished = true
    // 最佳成绩：答对题数优先，同分再比总分
    const cur = { correctCount: d.challenge.bestCorrect || 0, score: d.challenge.bestScore || 0 }
    const incoming = { correctCount: result.correctCount || 0, score: result.score || 0 }
    const better =
      incoming.correctCount !== cur.correctCount
        ? incoming.correctCount > cur.correctCount
        : incoming.score > cur.score
    if (better) {
      d.challenge.bestScore = result.score
      d.challenge.bestCorrect = result.correctCount
    }
  })
}
function markReviveUsed() {
  patchDaily(today(), (d) => {
    d.challenge.reviveUsed = true
    d.challenge.reviveCount = (d.challenge.reviveCount || 0) + 1
  })
}
function setCloudSubmitted(record) {
  patchDaily(today(), (d) => {
    d.challenge.cloudSubmitted = true
    d.challenge.cloudRecordId = record.id || ''
    d.challenge.cloudRank = typeof record.rank === 'number' ? record.rank : null
  })
}
function getChallengeState(date) {
  return ensureDaily(date || today()).challenge
}

/* ---------------- 成就 ---------------- */
function getAchievements() {
  return storage.get(K.ACH, null) || {}
}
function unlockAchievement(id) {
  const map = getAchievements()
  if (map[id]) return false
  map[id] = nowSec()
  storage.set(K.ACH, map)
  return true
}

/* ---------------- 设置 ---------------- */
function getSettings() {
  return storage.get(K.SETTINGS, null) || { sound: true }
}
function saveSettings(s) {
  storage.set(K.SETTINGS, s)
}

/* ---------------- 广告 ---------------- */
function recordAdWatched() {
  const u = getUser()
  u.adsWatched += 1
  saveUser(u)
  return u.adsWatched
}

/* ---------------- 测试用 ---------------- */
function _reset() {
  Object.values(K).forEach((key) => storage.remove(key))
}

module.exports = {
  K,
  today,
  getUser,
  onLaunch,
  getDaily,
  ensureDaily,
  recordCasualAnswer,
  getSeq,
  getCasualDone,
  isCasualDone,
  rememberCasual,
  getWrongList,
  addWrong,
  resolveWrong,
  activeWrong,
  removeWrong,
  getFavorites,
  isFavorite,
  toggleFavorite,
  markChallengePlayed,
  recordChallengeResult,
  markReviveUsed,
  setCloudSubmitted,
  getChallengeState,
  getAchievements,
  unlockAchievement,
  getSettings,
  saveSettings,
  recordAdWatched,
  _reset
}
