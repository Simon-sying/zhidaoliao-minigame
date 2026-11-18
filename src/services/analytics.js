/**
 * 数据埋点（设计文档第 53 节）。
 * 第一阶段：事件先在本地排队保存，离线不丢；云端开启后可批量上报（预留 flush）。
 * 所有埋点失败都不应影响游戏流程。
 */
const storage = require('../core/storage')
const { nowSec } = require('../utils/util')

const KEY = 'analyticsQueue'
const MAX_EVENTS = 500

function queue() {
  return storage.get(KEY, null) || []
}

function log(event, props) {
  try {
    const list = queue()
    list.push(Object.assign({ e: event, t: nowSec() }, props || {}))
    storage.set(KEY, list.slice(-MAX_EVENTS))
  } catch (e) {}
}

function all() {
  return queue()
}

function count(event) {
  const list = queue()
  return event ? list.filter((x) => x.e === event).length : list.length
}

function clear() {
  storage.set(KEY, [])
}

/**
 * 云端开启后批量上报。当前云函数集合未包含 analytics（MVP 不需要），
 * 因此默认仅本地保留；需要时在云开发中新增 analytics 云函数并打开开关即可。
 */
async function flush(enabled) {
  if (!enabled) return { flushed: 0 }
  // 预留：return cloud.callFunction('analytics', { events: all() }).then(clear)
  return { flushed: 0 }
}

module.exports = { log, all, count, clear, flush, KEY }
