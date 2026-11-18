/**
 * 题库聚合层：把 10 个分类文件合并，并建立 byId / byCategory / byKnowledge 索引。
 * 新增题库时，只需在 questions/ 下新增文件并在 BANK 数组里 require 一次。
 * 题目随版本发布打包进主包（纯文本，体积很小），第一版不依赖服务器下发。
 */
const config = require('../config/index.js')
const life = require('./questions/life')
const life2 = require('./questions/life2')
const life3 = require('./questions/life3')
const safe = require('./questions/safe')
const safe2 = require('./questions/safe2')
const science = require('./questions/science')
const science2 = require('./questions/science2')
const digital = require('./questions/digital')
const digital2 = require('./questions/digital2')
const money = require('./questions/money')
const money2 = require('./questions/money2')
const nature = require('./questions/nature')
const nature2 = require('./questions/nature2')
const body = require('./questions/body')
const body2 = require('./questions/body2')
const society = require('./questions/society')
const society2 = require('./questions/society2')
const world = require('./questions/world')
const world2 = require('./questions/world2')
const kid = require('./questions/kid')
const kid2 = require('./questions/kid2')

const BANK = [].concat(
  life, life2, life3,
  safe, safe2,
  science, science2,
  digital, digital2,
  money, money2,
  nature, nature2,
  body, body2,
  society, society2,
  world, world2,
  kid, kid2
)

const byId = new Map()
const byCategory = new Map()
const byKnowledge = new Map()

BANK.forEach((q) => {
  byId.set(q.id, q)
  if (!byCategory.has(q.categoryId)) byCategory.set(q.categoryId, [])
  byCategory.get(q.categoryId).push(q)
  if (!byKnowledge.has(q.knowledgeId)) byKnowledge.set(q.knowledgeId, [])
  byKnowledge.get(q.knowledgeId).push(q)
})

function getAll() {
  return BANK
}
function getById(id) {
  return byId.get(id)
}
function getByCategory(categoryId) {
  return byCategory.get(categoryId) || []
}
function getByKnowledge(knowledgeId) {
  return byKnowledge.get(knowledgeId) || []
}
function count() {
  return BANK.length
}

module.exports = {
  version: config.APP.QUESTION_VERSION,
  getAll,
  getById,
  getByCategory,
  getByKnowledge,
  count
}
