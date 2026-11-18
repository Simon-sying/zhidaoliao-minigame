/**
 * 将本地题库导出到 submitScore 云函数目录，使云端能权威复核每日挑战。
 * 用法：node scripts/export-bank.js
 * 每次题库更新 / 发版前运行一次，并重新上传 submitScore 云函数。
 */
const fs = require('fs')
const path = require('path')
const bank = require('../src/data/questions')

const outDir = path.join(__dirname, '..', 'cloudfunctions', 'submitScore')
const outFile = path.join(outDir, 'bank.json')

const payload = {
  version: bank.version,
  generatedAt: new Date().toISOString(),
  count: bank.count(),
  questions: bank.getAll()
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(payload, null, 0), 'utf8')
console.log(`已导出 ${payload.count} 题（题库 v${payload.version}）-> ${path.relative(process.cwd(), outFile)}`)
