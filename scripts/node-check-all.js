// 递归对工程内所有 .js 做 node --check（排除 node_modules）。
// 用法：node scripts/node-check-all.js
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((ent) => {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) return
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (ent.isFile() && ent.name.endsWith('.js')) out.push(p)
  })
  return out
}

const files = walk(root, [])
let failed = 0
files.forEach((f) => {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' })
  } catch (e) {
    failed += 1
    console.error('SYNTAX FAIL:', path.relative(root, f))
    console.error(String(e.stderr || e.stdout || e.message))
  }
})
console.log(`Checked ${files.length} files, failures: ${failed}`)
process.exit(failed ? 1 : 0)
