/**
 * 微信运行时的薄封装。所有对全局 wx 的访问都收口在这里：
 *  - 在微信 / 开发者工具中：调用真实能力；
 *  - 在 Node 单测中：wx 不存在时安全降级，绝不抛错。
 */
const g = typeof globalThis !== 'undefined' ? globalThis : {}
const wx = g.wx || null

function hasWx() {
  return !!wx
}

function getWindowInfo() {
  try {
    if (wx && typeof wx.getWindowInfo === 'function') {
      const i = wx.getWindowInfo()
      return {
        width: i.windowWidth || 375,
        height: i.windowHeight || 667,
        dpr: i.pixelRatio || 1,
        safeTop: (i.safeArea && i.safeArea.top) || 0,
        safeBottom: i.screenHeight && i.safeArea ? i.screenHeight - i.safeArea.bottom : 0
      }
    }
    if (wx && typeof wx.getSystemInfoSync === 'function') {
      const i = wx.getSystemInfoSync()
      return {
        width: i.windowWidth || 375,
        height: i.windowHeight || 667,
        dpr: i.pixelRatio || 1,
        safeTop: (i.safeArea && i.safeArea.top) || 0,
        safeBottom: i.screenHeight && i.safeArea ? i.screenHeight - i.safeArea.bottom : 0
      }
    }
  } catch (e) {}
  return { width: 375, height: 667, dpr: 1, safeTop: 20, safeBottom: 0 }
}

/* ---- 持久化 ---- */
function storageGet(key) {
  try {
    if (wx) return wx.getStorageSync(key)
  } catch (e) {}
  return ''
}
function storageSet(key, value) {
  try {
    if (wx) wx.setStorageSync(key, value)
  } catch (e) {}
}
function storageRemove(key) {
  try {
    if (wx) wx.removeStorageSync(key)
  } catch (e) {}
}

/* ---- 触摸事件 ---- */
function onTouch(cb) {
  if (!wx) return
  wx.onTouchStart((e) => cb('start', e))
  wx.onTouchMove((e) => cb('move', e))
  wx.onTouchEnd((e) => cb('end', e))
  wx.onTouchCancel((e) => cb('cancel', e))
}

function pointOf(e) {
  const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || {}
  return { x: t.clientX || 0, y: t.clientY || 0 }
}

/* ---- 震动反馈（轻） ---- */
function vibrate(kind) {
  try {
    if (!wx) return
    if (kind === 'long' && wx.vibrateLong) wx.vibrateLong({})
    else if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
  } catch (e) {}
}

/* ---- 分享 ---- */
function enableShare(menu) {
  try {
    if (wx && wx.showShareMenu) {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })
    }
    if (wx && wx.onShareAppMessage) {
      wx.onShareAppMessage(() => menu || { title: '知识到了！每天知道一点新东西' })
    }
  } catch (e) {}
}

function shareAppMessage(data) {
  try {
    if (wx && wx.shareAppMessage) wx.shareAppMessage(data)
  } catch (e) {}
}

/* ---- 微信原生右上角胶囊（···/⊙）位置，逻辑像素 ---- */
function getMenuRect() {
  try {
    if (wx && typeof wx.getMenuButtonBoundingClientRect === 'function') {
      const r = wx.getMenuButtonBoundingClientRect()
      if (r && r.width && r.bottom) {
        return {
          left: r.left, right: r.right, top: r.top, bottom: r.bottom,
          width: r.width, height: r.height,
          centerX: (r.left + r.right) / 2,
          centerY: (r.top + r.bottom) / 2
        }
      }
    }
  } catch (e) {}
  return null
}

/* ---- 前后台 / 网络 ---- */
function onAppShow(cb) {
  try {
    if (wx && wx.onShow) wx.onShow(cb)
  } catch (e) {}
}
function onAppHide(cb) {
  try {
    if (wx && wx.onHide) wx.onHide(cb)
  } catch (e) {}
}
function getNetworkType() {
  return new Promise((resolve) => {
    if (!wx || !wx.getNetworkType) return resolve('wifi')
    wx.getNetworkType({ success: (r) => resolve(r.networkType), fail: () => resolve('unknown') })
  })
}
function onNetworkChange(cb) {
  try {
    if (wx && wx.onNetworkStatusChange) wx.onNetworkStatusChange((r) => cb(r.networkType, r.isConnected))
  } catch (e) {}
}

module.exports = {
  hasWx,
  getWindowInfo,
  storageGet,
  storageSet,
  storageRemove,
  onTouch,
  pointOf,
  vibrate,
  enableShare,
  shareAppMessage,
  onAppShow,
  onAppHide,
  getNetworkType,
  onNetworkChange,
  getMenuRect,
  rawWx: wx
}
