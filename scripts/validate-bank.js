/**
 * 题库质量校验（对应设计文档第 66 节）。
 * 用法：node scripts/validate-bank.js
 */
const bank = require('../src/data/questions')
const categories = require('../src/data/categories')

const errors = []
const seenIds = new Set()
const catIds = new Set(categories.map((c) => c.id))
const VALID_TYPES = new Set(['single', 'judge', 'scene', 'sort'])
const VALID_AGE = new Set(['all', 'child'])

bank.getAll().forEach((q) => {
  const where = `题目 ${q.id || '(无 id)'}`
  if (!q.id) errors.push(`${where}：缺少 id`)
  if (seenIds.has(q.id)) errors.push(`${where}：id 重复`)
  seenIds.add(q.id)
  if (!catIds.has(q.categoryId)) errors.push(`${where}：categoryId 不存在 -> ${q.categoryId}`)
  if (!q.knowledgeId) errors.push(`${where}：缺少 knowledgeId`)
  if (!q.knowledgeTitle) errors.push(`${where}：缺少 knowledgeTitle`)
  if (!VALID_TYPES.has(q.type)) errors.push(`${where}：type 非法 -> ${q.type}`)
  if (!VALID_AGE.has(q.ageLevel)) errors.push(`${where}：ageLevel 非法 -> ${q.ageLevel}`)
  if (!q.question || !q.question.trim()) errors.push(`${where}：题干为空`)
  if (q.type === 'scene' && (!q.scenario || !q.scenario.trim())) errors.push(`${where}：场景题缺少 scenario`)
  if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${where}：选项数量非法`)
  if (new Set(q.options).size !== q.options.length) errors.push(`${where}：选项重复`)
  if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= (q.options ? q.options.length : 0)) {
    errors.push(`${where}：answer 越界`)
  }
  if (q.type === 'judge' && JSON.stringify(q.options) !== JSON.stringify(['正确', '错误'])) {
    errors.push(`${where}：判断题选项必须为 ['正确','错误']`)
  }
  if (!q.explanation || !q.explanation.trim()) errors.push(`${where}：解析为空`)
  if (!q.tip || !q.tip.trim()) errors.push(`${where}：记忆点为空`)
})

// 分类覆盖统计
const perCat = {}
categories.forEach((c) => (perCat[c.id] = 0))
bank.getAll().forEach((q) => {
  if (perCat[q.categoryId] !== undefined) perCat[q.categoryId] += 1
})

console.log(`题库总数：${bank.count()}（v${bank.version}）`)
categories.forEach((c) => console.log(`  ${c.emoji} ${c.name}：${perCat[c.id]} 题`))

if (errors.length) {
  console.error(`\n发现 ${errors.length} 个问题：`)
  errors.forEach((e) => console.error('  ✗ ' + e))
  process.exit(1)
}
console.log('\n✅ 题库校验通过：题干 / 选项 / 答案 / 解析 / 记忆点 / 分类均合法')
