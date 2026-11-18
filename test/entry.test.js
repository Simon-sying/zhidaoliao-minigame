/**
 * 入口冒烟：模拟“没有小程序 App 全局”的小游戏运行时，直接加载 game.js，
 * 确认 start() 能执行、进入首页并真正画出内容（防止黑屏类启动错误）。
 * 用法：node test/entry.test.js
 */
const noop = function () {}
let fillCount = 0
let frameCb = null

function makeCtx() {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'measureText') return (s) => ({ width: String(typeof s === 'string' ? s : '').length * 14 + 6 })
        if (prop === 'fillRect') return () => {
          fillCount += 1
        }
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop: noop })
        return noop
      },
      set() {
        return true
      }
    }
  )
}

const storage = {}
const ctx = makeCtx()
globalThis.wx = {
  createCanvas: () => ({ width: 393, height: 852, getContext: () => ctx, addEventListener: noop, style: {} }),
  getWindowInfo: () => ({ windowWidth: 393, windowHeight: 852, pixelRatio: 3, safeArea: { top: 47, bottom: 818 }, screenHeight: 852 }),
  getSystemInfoSync: () => ({ windowWidth: 393, windowHeight: 852, pixelRatio: 3, safeArea: { top: 47, bottom: 818 }, screenHeight: 852, statusBarHeight: 47 }),
  getStorageSync: (k) => (Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : ''),
  setStorageSync: (k, v) => {
    storage[k] = v
  },
  removeStorageSync: (k) => delete storage[k],
  onTouchStart: noop, onTouchMove: noop, onTouchEnd: noop, onTouchCancel: noop,
  vibrateShort: noop, vibrateLong: noop, showToast: noop,
  showModal: (o) => o.success && o.success({ confirm: true, cancel: false }),
  showShareMenu: noop, onShareAppMessage: noop, shareAppMessage: noop,
  onNetworkStatusChange: noop,
  getNetworkType: (o) => o.success && o.success({ networkType: 'wifi' })
}
// 小游戏把 requestAnimationFrame 挂在全局（而非 wx 上）
globalThis.requestAnimationFrame = (cb) => {
  frameCb = cb
  return 1
}

// 关键：故意不定义全局 App，模拟真实小游戏环境
const assert = require('assert')
assert.strictEqual(typeof App, 'undefined', '测试环境不应存在 App 全局') // eslint-disable-line

const app = require('../game.js')

assert.strictEqual(app.current.name, 'home', '启动后应直接进入首页')
assert.strictEqual(typeof frameCb, 'function', '应已注册首帧回调')
frameCb(16)
assert.ok(fillCount > 0, '首帧应实际绘制（fillRect 被调用），否则会黑屏')

console.log('✅ 入口冒烟通过：无 App 全局下 game.js 正常启动，进入首页并完成首帧绘制')
process.exit(0)
