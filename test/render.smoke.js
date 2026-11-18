/**
 * 离屏渲染冒烟测试：用假 Canvas 实例化整个 App，逐页 render，
 * 并自动答完一局每日挑战进入结果页，捕捉任何“运行期绘图 / 交互”错误。
 * 用法：node test/render.smoke.js
 */
const noop = function () {}
function makeCtx() {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'measureText') return (s) => ({ width: String(typeof s === 'string' ? s : '').length * 14 + 6 })
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
  createCanvas: () => ({ width: 375, height: 667, getContext: () => ctx, addEventListener: noop, style: {} }),
  getWindowInfo: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2, safeArea: { top: 44, bottom: 623 }, screenHeight: 667 }),
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2, safeArea: { top: 44, bottom: 623 }, screenHeight: 667, statusBarHeight: 44 }),
  getStorageSync: (k) => (Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : ''),
  setStorageSync: (k, v) => {
    storage[k] = v
  },
  removeStorageSync: (k) => delete storage[k],
  onTouchStart: noop,
  onTouchMove: noop,
  onTouchEnd: noop,
  onTouchCancel: noop,
  vibrateShort: noop,
  vibrateLong: noop,
  showToast: noop,
  showModal: (o) => o.success && o.success({ confirm: true, cancel: false }),
  showShareMenu: noop,
  onShareAppMessage: noop,
  shareAppMessage: noop,
  onNetworkStatusChange: noop,
  getNetworkType: (o) => o.success && o.success({ networkType: 'wifi' }),
  requestAnimationFrame: () => 0 // 不让主循环在 Node 里自转
}

const { createApp } = require('../src/core/app')
const bank = require('../src/data/questions')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let rendered = 0
function renderCurrent(tag) {
  const s = globalApp.current
  globalApp.current.render(globalApp.ctx)
  rendered += 1
  if (!Array.isArray(s._btns)) throw new Error(`${tag}: 按钮数组异常`)
}

var globalApp

async function main() {
  const app = createApp()
  globalApp = app
  app.start()

  // 准备错题 / 收藏数据，让列表页画到非空行
  const qs = bank.getAll()
  app.progress.addWrong(qs[0])
  app.progress.addWrong(qs[5])
  app.progress.toggleFavorite(qs[10].id)
  app.progress.toggleFavorite(qs[20].id)
  app.progress.toggleFavorite(qs[30].id)

  const staticRoutes = [
    ['home', {}],
    ['myKnowledge', {}],
    ['wrong', {}],
    ['favorites', {}],
    ['achievements', {}],
    ['challengeIntro', {}],
    ['knowledgeCard', { qId: qs[0].id, from: 'wrong' }],
    ['knowledgeCard', { qId: qs[10].id, from: 'favorite' }],
    ['casual', {}]
  ]
  for (const [name, params] of staticRoutes) {
    app.go(name, params, { replace: true })
    renderCurrent(name)
  }

  // 真实触摸：首页每个入口按钮 start/end 命中并跳转
  app.go('home', {}, { replace: true })
  renderCurrent('home-tap')
  const homeBtns = app.current._btns.slice()
  for (const b of homeBtns) {
    app.go('home', {}, { replace: true })
    renderCurrent('home')
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    app.current.onTouchStart(cx, cy)
    app.current.onTouchEnd(cx, cy)
    await sleep(5)
    renderCurrent('nav-' + app.current.name)
  }

  // 休闲答题：作答一次并渲染反馈态
  app.go('casual', {}, { replace: true })
  renderCurrent('casual')
  const casual = app.current
  if (typeof casual.choose === 'function' && casual.q) {
    casual.choose(casual.q.answer)
    renderCurrent('casual-reveal')
  }

  // 排行榜（本地预览，异步加载后渲染）
  app.go('leaderboard', {}, { replace: true })
  await sleep(30)
  renderCurrent('leaderboard-loaded')

  // 完整打一局无尽挑战（连错三题、生命耗尽）→ 结果页
  app.go('challenge', {}, { replace: true })
  let guard = 0
  while (app.current.name === 'challenge' && guard < 40) {
    const s = app.current
    renderCurrent('challenge-' + guard)
    if (s.phase === 'answer') {
      const wrongOpt = (s.currentQ().answer + 1) % s.currentQ().options.length
      s.choose(wrongOpt) // 每题都答错，3 题后生命耗尽
    }
    s.revealNextAt = Date.now()
    s.update(0.016)
    guard += 1
  }
  if (app.current.name !== 'result') throw new Error('生命耗尽后未进入结果页，当前：' + app.current.name)
  await sleep(50)
  renderCurrent('result-done')
  if (app.current.status !== 'done') throw new Error('结果页提交状态未结束')

  // 结果页跳榜
  app.go('leaderboard', {}, { replace: true })
  await sleep(30)
  renderCurrent('leaderboard-after-result')

  console.log(`✅ 渲染冒烟通过：覆盖全部页面，共渲染 ${rendered} 帧，无运行期错误`)
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ 渲染冒烟失败：', e.message)
  console.error(e.stack)
  process.exit(1)
})
