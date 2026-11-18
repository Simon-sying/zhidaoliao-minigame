/**
 * 命名空间化的本地持久存储（JSON 序列化、容错、无 wx 时内存兜底）。
 * 对应设计文档第 45 节：userSettings / questionProgress / knowledgeMastery /
 * wrongQuestions / favoriteQuestions / achievements / dailyLocalState。
 */
const pf = require('./platform')
const { STORAGE_KEYS } = require('../config/index.js')

const memoryStore = {}

function k(key) {
  return STORAGE_KEYS.PREFIX + key
}

function get(key, defaultValue) {
  const full = k(key)
  try {
    let raw
    if (pf.hasWx()) {
      raw = pf.storageGet(full)
    } else {
      raw = Object.prototype.hasOwnProperty.call(memoryStore, full) ? memoryStore[full] : ''
    }
    if (raw === '' || raw === null || raw === undefined) return defaultValue === undefined ? null : defaultValue
    if (typeof raw === 'string') {
      if (raw === 'null') return null
      return JSON.parse(raw)
    }
    return raw // 开发者工具可能直接返回对象
  } catch (e) {
    return defaultValue === undefined ? null : defaultValue
  }
}

function set(key, value) {
  const full = k(key)
  const raw = JSON.stringify(value)
  try {
    if (pf.hasWx()) pf.storageSet(full, raw)
    else memoryStore[full] = raw
  } catch (e) {
    memoryStore[full] = raw // 存储超限 / 异常时至少在内存保留
  }
  return value
}

function remove(key) {
  const full = k(key)
  try {
    if (pf.hasWx()) pf.storageRemove(full)
    else delete memoryStore[full]
  } catch (e) {}
}

/** 仅供单测：清空内存态 */
function _reset() {
  Object.keys(memoryStore).forEach((m) => delete memoryStore[m])
}

module.exports = { get, set, remove, _reset }
