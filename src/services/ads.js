/**
 * 激励视频广告（设计文档第 21~23 节：全部为用户主动触发的奖励位）。
 * - 未开通流量主 / 未配置广告位 / 开发工具报错：自动走“模拟广告”，绝不卡死流程。
 * - 真实广告只有在用户“完整观看”后才发奖励（res.isEnded）。
 */
const pf = require('../core/platform')
const config = require('../config/index.js')
const progress = require('./progress')

let adInstance = null
let pendingResolve = null
let lastShowAt = 0

function realEnabled() {
  const wx = pf.rawWx
  return !!(config.ADS.ENABLED && config.ADS.REWARDED_VIDEO_UNIT_ID && wx && typeof wx.createRewardedVideoAd === 'function')
}

function settle(result) {
  if (result.rewarded && !result.free) progress.recordAdWatched()
  if (pendingResolve) {
    const resolve = pendingResolve
    pendingResolve = null
    resolve(result)
  }
}

function ensureAd() {
  if (adInstance || !realEnabled()) return adInstance
  const wx = pf.rawWx
  try {
    adInstance = wx.createRewardedVideoAd({ adUnitId: config.ADS.REWARDED_VIDEO_UNIT_ID })
    adInstance.onError(() => {
      pendingResolve = null
      mockAd().then(settle) // 真实广告异常时平滑降级，保证流程不中断
    })
    adInstance.onClose((res) => {
      settle({ rewarded: !!(res && res.isEnded), mocked: false })
    })
  } catch (e) {
    adInstance = null
  }
  return adInstance
}

/** 广告位未接入时的降级：发布版直接发奖不打断；调试版用弹窗模拟完整观看 */
function mockAd() {
  return new Promise((resolve) => {
    if (!config.APP.DEBUG) {
      resolve({ rewarded: true, mocked: true, free: true })
      return
    }
    const wx = pf.rawWx
    if (wx && typeof wx.showModal === 'function') {
      wx.showModal({
        title: '（调试）模拟激励视频',
        content: '正式开通流量主并配置广告位后，此处会播放真实激励视频。点击“完整观看”模拟看完并领取奖励。',
        confirmText: '完整观看',
        cancelText: '取消',
        success: (r) => resolve({ rewarded: !!r.confirm, mocked: true }),
        fail: () => resolve({ rewarded: true, mocked: true })
      })
    } else {
      resolve({ rewarded: true, mocked: true })
    }
  })
}

/**
 * 展示激励广告。
 * @param {string} reason 触发场景：retry（失败再战）/ summary（知识总结）/ hint（提示）
 * @returns {Promise<{rewarded:boolean, mocked?:boolean, tooFrequent?:boolean}>}
 */
function showRewardAd(reason) {
  const now = Date.now()
  if (realEnabled() && lastShowAt && now - lastShowAt < config.ADS.MIN_INTERVAL_MS) {
    return Promise.resolve({ rewarded: false, tooFrequent: true })
  }
  if (!realEnabled()) return mockAd().then((r) => settle(r) || r)

  const ad = ensureAd()
  if (!ad) return mockAd().then((r) => settle(r) || r)
  lastShowAt = now

  return new Promise((resolve) => {
    pendingResolve = resolve
    const fallback = () => mockAd().then(settle)
    try {
      ad
        .show()
        .catch(() => ad.load().then(() => ad.show()).catch(fallback))
    } catch (e) {
      fallback()
    }
  })
}

function isReal() {
  return realEnabled()
}

module.exports = { showRewardAd, isReal }
