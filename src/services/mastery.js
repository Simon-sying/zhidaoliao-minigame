/**
 * 知识掌握度（0~100），规则对应设计文档第 13/14 节：
 *  首次答对 +20 / 首次答错 +5 / 第二次答对 +20 / 第三次换场景答对 +30 /
 *  连续答错 -10；上限 100、下限 0。
 * 状态按 knowledgeId 维度持久化，与具体题目解耦，支持“换一道同知识点题复测”。
 */
const storage = require('../core/storage')
const { MASTERY } = require('../config/index.js')

const KEY = 'knowledgeMastery'

function loadAll() {
  return storage.get(KEY, {}) || {}
}
function saveAll(map) {
  storage.set(KEY, map)
}

function getState(map, knowledgeId) {
  if (!map[knowledgeId]) {
    map[knowledgeId] = {
      v: 0,
      seen: 0,
      correctQ: [], // 已答对过的不同题目 id
      wrongStreak: 0
    }
  }
  return map[knowledgeId]
}

/**
 * 记录一次作答结果。
 * @returns {{before:number, after:number, delta:number, band:object, isNewSceneCorrect:boolean}}
 */
function record(knowledgeId, questionId, isCorrect) {
  const map = loadAll()
  const st = getState(map, knowledgeId)
  const before = st.v
  let delta = 0
  let isNewSceneCorrect = false

  if (isCorrect) {
    st.wrongStreak = 0
    st.seen += 1
    if (st.correctQ.indexOf(questionId) === -1) {
      const distinctIndex = st.correctQ.length // 0:第一次 1:第二次 >=2:第三次及以上
      if (distinctIndex === 0) delta = MASTERY.FIRST_CORRECT
      else if (distinctIndex === 1) delta = MASTERY.SECOND_CORRECT
      else {
        delta = MASTERY.THIRD_SCENE_CORRECT
        isNewSceneCorrect = true
      }
      st.correctQ.push(questionId)
    }
    // 同一道题重复答对不再加分，防止刷分
  } else {
    st.seen += 1
    if (st.seen === 1) {
      delta = MASTERY.FIRST_WRONG
      st.wrongStreak = 1
    } else {
      st.wrongStreak += 1
      if (st.wrongStreak >= 2) delta = -MASTERY.CONSECUTIVE_WRONG_PENALTY
    }
  }

  st.v = Math.max(0, Math.min(MASTERY.MAX, st.v + delta))
  saveAll(map)
  return { before, after: st.v, delta, band: bandOf(st.v), isNewSceneCorrect }
}

function bandOf(value) {
  const v = Math.round(value)
  return MASTERY.BANDS.find((b) => v >= b.min && v <= b.max) || MASTERY.BANDS[0]
}

function valueOf(knowledgeId) {
  const m = loadAll()
  return m[knowledgeId] ? m[knowledgeId].v : 0
}

function isMastered(knowledgeId) {
  return valueOf(knowledgeId) >= 80
}

/** 已学（至少作答过一次）的知识点数量 */
function learnedCount() {
  const m = loadAll()
  return Object.keys(m).filter((id) => m[id].seen > 0).length
}

/** 已掌握（>=80）的知识点数量 */
function masteredCount() {
  const m = loadAll()
  return Object.keys(m).filter((id) => m[id].v >= 80).length
}

/** 分类维度的掌握度：该分类下“已学知识点平均掌握度 / 覆盖率”，用于“我的知识” */
function categoryStats(getByCategory) {
  const m = loadAll()
  const knowledgeSeen = new Set()
  // 以知识点为单位聚合
  const groups = {}
  Object.keys(m).forEach((kid) => {
    if (m[kid].seen > 0) knowledgeSeen.add(kid)
  })
  return function compute(categories, knowledge) {
    return categories.map((cat) => {
      const qs = getByCategory(cat.id)
      const kidSet = new Set(qs.map((q) => q.knowledgeId))
      let sum = 0
      let touched = 0
      kidSet.forEach((kid) => {
        if (m[kid] && m[kid].seen > 0) {
          sum += m[kid].v
          touched += 1
        }
      })
      const total = kidSet.size || 1
      const avg = touched ? Math.round(sum / touched) : 0
      const coverage = Math.round((touched / total) * 100)
      return { ...cat, knowledgeTotal: kidSet.size, touched, avg, coverage, percent: avg }
    })
  }
}

function _reset() {
  saveAll({})
}

module.exports = {
  record,
  bandOf,
  valueOf,
  isMastered,
  learnedCount,
  masteredCount,
  loadAll,
  categoryStats,
  _reset,
  KEY
}
