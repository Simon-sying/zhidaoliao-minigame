/**
 * 知识点目录：从题目自动派生（单一数据源，避免知识表与题库不一致）。
 * 一个 knowledgeId 可对应多道不同场景的题 —— 对应设计文档第 15/16 节
 * “表层是题目、底层是知识点；同一认知换场景复测”。
 * 复习间隔沿用全局配置 REVIEW_INTERVAL_DAYS（1/3/7/15/30 天）。
 */
const bank = require('./questions')
const categories = require('./categories')
const { MASTERY } = require('../config/index.js')

const catalog = new Map()

bank.getAll().forEach((q) => {
  if (!catalog.has(q.knowledgeId)) {
    catalog.set(q.knowledgeId, {
      id: q.knowledgeId,
      categoryId: q.categoryId,
      title: q.knowledgeTitle || q.knowledgeId,
      tip: q.knowledgeTip || q.tip || '',
      questionIds: []
    })
  }
  catalog.get(q.knowledgeId).questionIds.push(q.id)
})

const categoryName = new Map(categories.map((c) => [c.id, c.name]))

function all() {
  return Array.from(catalog.values())
}
function get(id) {
  return catalog.get(id)
}
function getCategoryName(categoryId) {
  return categoryName.get(categoryId) || ''
}
/** 返回每个知识点关联的题目数 */
function questionCount(id) {
  const k = catalog.get(id)
  return k ? k.questionIds.length : 0
}
function reviewIntervals() {
  return MASTERY.REVIEW_INTERVAL_DAYS
}

module.exports = { all, get, getCategoryName, questionCount, reviewIntervals, count: () => catalog.size }
