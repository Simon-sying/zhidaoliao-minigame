/**
 * CloudBase 云开发接入。默认关闭（config.CLOUD.USE_CLOUD = false）。
 * 开启后：wx.cloud.init -> 调用 login 云函数换取 openid；
 * 任何初始化失败都会安全降级为本地模式，不影响休闲玩法。
 */
const pf = require('../core/platform')
const config = require('../config/index.js')

let available = false
let openid = null
let initializing = null

function isAvailable() {
  return available
}
function getOpenId() {
  return openid
}

function init() {
  if (initializing) return initializing
  initializing = (async () => {
    if (!config.CLOUD.USE_CLOUD) {
      available = false
      return false
    }
    const wx = pf.rawWx
    if (!wx || !wx.cloud) {
      available = false
      return false
    }
    try {
      wx.cloud.init({ env: config.CLOUD.ENV_ID || undefined, traceUser: true })
      const res = await wx.cloud.callFunction({ name: 'login' })
      openid = (res && res.result && res.result.openid) || null
      available = !!openid
    } catch (e) {
      available = false
      openid = null
    }
    return available
  })()
  return initializing
}

async function callFunction(name, data) {
  if (!available) throw new Error('cloud_unavailable')
  const wx = pf.rawWx
  const res = await wx.cloud.callFunction({ name, data: data || {} })
  return res && res.result
}

module.exports = { init, isAvailable, getOpenId, callFunction }
