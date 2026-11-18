/**
 * 应用核心：Canvas/DPR 初始化、场景路由、触摸分发、全局 Toast/Modal、主循环。
 * 场景（scenes/*）只关心 onEnter/update/render/onTouch*，互不直接依赖。
 */
const pf = require('./platform')
const T = require('./theme')
const ui = require('./ui')
const config = require('../config/index.js')

const progress = require('../services/progress')
const mastery = require('../services/mastery')
const quiz = require('../services/quiz')
const challenges = require('../services/challenges')
const ads = require('../services/ads')
const cloud = require('../services/cloud')
const leaderboard = require('../services/leaderboard')
const analytics = require('../services/analytics')
const achievements = require('../services/achievements')
const bank = require('../data/questions')
const knowledge = require('../data/knowledge')
const categories = require('../data/categories')
const util = require('../utils/util')

const HomeScene = require('../scenes/home')
const CasualScene = require('../scenes/casual')
const ChallengeIntroScene = require('../scenes/challengeIntro')
const ChallengeScene = require('../scenes/challenge')
const ResultScene = require('../scenes/result')
const LeaderboardScene = require('../scenes/leaderboard')
const MyKnowledgeScene = require('../scenes/myKnowledge')
const WrongScene = require('../scenes/wrong')
const FavoritesScene = require('../scenes/favorites')
const AchievementsScene = require('../scenes/achievements')
const KnowledgeCardScene = require('../scenes/knowledgeCard')

const ROUTES = {
  home: HomeScene,
  casual: CasualScene,
  challengeIntro: ChallengeIntroScene,
  challenge: ChallengeScene,
  result: ResultScene,
  leaderboard: LeaderboardScene,
  myKnowledge: MyKnowledgeScene,
  wrong: WrongScene,
  favorites: FavoritesScene,
  achievements: AchievementsScene,
  knowledgeCard: KnowledgeCardScene
}

function createApp() {
  const canvas = pf.hasWx() && pf.rawWx.createCanvas ? pf.rawWx.createCanvas() : null
  const ctx = canvas ? canvas.getContext('2d') : null
  const info = pf.getWindowInfo()

  const app = {
    canvas,
    ctx,
    w: info.width,
    h: info.height,
    dpr: info.dpr,
    C: T.COLORS,
    ui,
    theme: T,
    util,
    config,
    progress,
    mastery,
    quiz,
    challenges,
    ads,
    cloud,
    leaderboard,
    analytics,
    achievements,
    bank,
    knowledge,
    categories,
    current: null,
    stack: [],
    toast: null,
    modal: null,
    backPressed: false
  }

  /* ---------------- 布局 ---------------- */
  function applyMetrics() {
    const i = pf.getWindowInfo()
    app.w = i.width
    app.h = i.height
    app.dpr = i.dpr
    if (canvas) {
      canvas.width = Math.round(i.width * i.dpr)
      canvas.height = Math.round(i.height * i.dpr)
    }
    T.metrics.dpr = i.dpr
    T.metrics.width = i.width
    T.metrics.height = i.height
    T.metrics.safeTop = Math.max(10, i.safeTop)
    T.metrics.safeBottom = Math.max(8, i.safeBottom)
    T.metrics.contentPad = 20
    // 右上角微信原生胶囊（···/⊙）真实位置，用于标题避让与纵向对齐
    T.metrics.menuRect = pf.getMenuRect()
    if (ctx) ctx.setTransform(i.dpr, 0, 0, i.dpr, 0, 0)
  }

  app.pad = () => T.metrics.contentPad
  app.contentW = () => app.w - T.metrics.contentPad * 2

  /* ---------------- 导航 ---------------- */
  app.go = function (name, params, opts) {
    const Cls = ROUTES[name]
    if (!Cls) return
    const scene = new Cls(app)
    scene.name = name
    if (app.current && !(opts && opts.replace)) app.stack.push(app.current)
    app.current = scene
    analytics.log('scene_enter', { scene: name })
    scene.onEnter(params || {})
  }
  app.back = function () {
    const prev = app.stack.pop()
    if (prev) {
      app.current = prev
      if (prev.onResume) prev.onResume()
    } else {
      app.go('home', {}, { replace: true })
    }
  }
  app.canBack = () => app.stack.length > 0

  /* ---------------- 反馈组件 ---------------- */
  app.toast = function (msg, duration) {
    app.toastMsg = { msg, until: Date.now() + (duration || 1600) }
  }
  app.confirm = function (o) {
    return new Promise((resolve) => {
      app.modal = {
        title: o.title || '',
        content: o.content || '',
        confirmText: o.confirmText || '确定',
        cancelText: o.cancelText === undefined ? '取消' : o.cancelText,
        confirmType: o.confirmType || 'primary',
        resolve
      }
    })
  }
  function closeModal(val) {
    if (app.modal && app.modal.resolve) app.modal.resolve(val)
    app.modal = null
  }

  /* ---------------- 头部 ---------------- */
  // 头部高度 = 胶囊底部 + 间距（无胶囊时回退到 safeTop+50）
  app.headerH = () => {
    const m = T.metrics
    const bottom = m.menuRect ? m.menuRect.bottom : m.safeTop + 44
    return Math.ceil(bottom + 8)
  }
  // 返回按钮纵向对齐胶囊中心，避免真机上与状态栏/胶囊错位
  app.backRect = () => {
    const m = T.metrics
    const menu = m.menuRect
    const h = menu ? Math.max(34, menu.height) : 36
    const y = menu ? menu.centerY - h / 2 : m.safeTop + 6
    return { x: 12, y, w: 40, h }
  }

  app.drawHeader = function (context, title) {
    const m = T.metrics
    const c = context
    c.textBaseline = 'top'
    if (app.canBack()) {
      const b = app.backRect()
      const cx = b.x + b.w / 2
      const cy = b.y + b.h / 2
      ui.fillRoundRect(c, b.x, b.y, b.w, b.h, 20, '#EAF1F8')
      c.strokeStyle = T.COLORS.ink
      c.lineWidth = 2.2
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(cx + 4, cy - 8)
      c.lineTo(cx - 4, cy)
      c.lineTo(cx + 4, cy + 8)
      c.stroke()
    }
    // 标题在「返回键右缘 → 胶囊左缘」之间水平居中，并纵向对齐胶囊中心；
    // 真机胶囊位置/大小与 iPhone 15 模拟器不同，用真实胶囊坐标避免文字重叠。
    const menu = m.menuRect
    const left = app.canBack() ? app.backRect().x + app.backRect().w + 10 : app.pad()
    const right = menu ? Math.max(left + 40, menu.left - 8) : app.w - app.pad()
    const cx = (left + right) / 2
    const cy = menu ? menu.centerY : m.safeTop + 14
    ui.drawCenteredText(c, title, cx, cy, {
      size: 18,
      weight: '700',
      color: T.COLORS.ink
    })
  }

  function hitBack(x, y) {
    if (!app.canBack()) return false
    const b = app.backRect()
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
  }

  /* ---------------- 触摸 ---------------- */
  function dispatch(type, x, y) {
    const s = app.current
    if (!s) return
    if (type === 'start') s.onTouchStart && s.onTouchStart(x, y)
    else if (type === 'move') s.onTouchMove && s.onTouchMove(x, y)
    else if (type === 'end') s.onTouchEnd && s.onTouchEnd(x, y)
    else if (type === 'cancel' && s.onTouchEnd) s.onTouchEnd(x, y)
  }

  function modalButtons() {
    const m = app.modal
    const width = app.contentW() - 8
    const btnH = 44
    const top = m._contentBottom + 18
    const gap = 12
    if (m.cancelText === null) {
      return [{ x: app.pad() + 4, y: top, w: width, h: btnH, text: m.confirmText, type: m.confirmType, val: true }]
    }
    const wBtn = (width - gap) / 2
    return [
      { x: app.pad() + 4, y: top, w: wBtn, h: btnH, text: m.cancelText, type: 'gray', val: false },
      { x: app.pad() + 4 + wBtn + gap, y: top, w: wBtn, h: btnH, text: m.confirmText, type: m.confirmType, val: true }
    ]
  }

  pf.onTouch((type, e) => {
    const p = pf.pointOf(e)
    const x = p.x
    const y = p.y

    if (app.modal) {
      if (type === 'start') app._modalPress = null
      if (type === 'end') {
        const btns = modalButtons()
        const hit = btns.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
        if (hit) {
          pf.vibrate('short')
          closeModal(hit.val)
        }
      }
      return
    }

    if (type === 'start') {
      app.backPressed = hitBack(x, y)
    }
    if (app.backPressed && type === 'end') {
      if (hitBack(x, y)) {
        pf.vibrate('short')
        app.back()
        return
      }
      app.backPressed = false
    }
    if (!app.backPressed) dispatch(type, x, y)
    if (type === 'end') app.backPressed = false
  })

  /* ---------------- 渲染 ---------------- */
  function drawToast(c) {
    if (!app.toastMsg || Date.now() > app.toastMsg.until) return
    const msg = app.toastMsg.msg
    c.font = T.font('500', 15)
    const tw = c.measureText(msg).width
    const bw = tw + 36
    const bh = 42
    const bx = (app.w - bw) / 2
    const by = app.h * 0.72
    ui.fillRoundRect(c, bx, by, bw, bh, 21, 'rgba(28,42,58,0.9)')
    c.fillStyle = '#fff'
    c.textBaseline = 'middle'
    c.textAlign = 'center'
    c.fillText(msg, bx + bw / 2, by + bh / 2 + 0.5)
    c.textAlign = 'left'
  }

  function layoutModal() {
    const m = app.modal
    const width = app.contentW()
    const x = app.pad()
    let y = T.metrics.safeTop + 24
    if (m.title) {
      m._titleY = y
      y += 30
    }
    m._contentY = y
    const lines = ui.wrapLines(ctx, m.content, width - 40, 15, 'normal')
    m._contentLines = lines.length
    m._contentBottom = y + lines.length * Math.round(15 * 1.5)
    m._cardX = x
    m._cardW = width
    m._cardY = T.metrics.safeTop + 8
    m._cardH = (m._contentBottom - m._cardY) + 78
  }

  function drawModal(c) {
    if (!app.modal) return
    layoutModal()
    const m = app.modal
    c.fillStyle = T.COLORS.mask
    c.fillRect(0, 0, app.w, app.h)
    ui.card(c, m._cardX, m._cardY, m._cardW, m._cardH, T.RADIUS.lg)
    let ty = m._cardY + 22
    if (m.title) {
      ui.drawText(c, m.title, m._cardX + 20, ty, m._cardW - 40, { size: 18, weight: '700', color: T.COLORS.ink })
      ty += 32
    }
    ui.drawText(c, m.content, m._cardX + 20, ty, m._cardW - 40, { size: 15, lineHeight: 23, color: T.COLORS.sub })
    const btns = modalButtons()
    btns.forEach((b) => {
      const btn = new ui.Button({ x: b.x, y: b.y, w: b.w, h: b.h, text: b.text, type: b.type === 'primary' ? 'primary' : 'gray', fontSize: 16 })
      btn.draw(c)
    })
  }

  let lastTs = 0
  function frame(ts) {
    const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016)
    lastTs = ts
    const c = ctx
    if (c) {
      c.setTransform(app.dpr, 0, 0, app.dpr, 0, 0)
      c.fillStyle = T.COLORS.bg
      c.fillRect(0, 0, app.w, app.h)
      if (app.current) {
        app.current.update && app.current.update(dt)
        app.current.render(c)
      }
      drawToast(c)
      drawModal(c)
    }
    const raf = (pf.rawWx && pf.rawWx.requestAnimationFrame) || (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : null)
    if (raf) raf(frame)
  }

  /* ---------------- 启动 ---------------- */
  app.start = function () {
    applyMetrics()
    progress.onLaunch()
    analytics.log('app_launch', { v: config.APP.VERSION, qv: bank.version, count: bank.count() })
    pf.enableShare({ title: `${config.APP.NAME}！每天知道一点新东西，来测测你能答对几题？` })
    cloud.init() // 非阻塞；真正用到时各页面会 await
    pf.onNetworkChange((type, connected) => analytics.log('network_change', { type, connected }))
    app.go('home', {}, { replace: true })
    const raf = (pf.rawWx && pf.rawWx.requestAnimationFrame) || (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : null)
    if (raf) raf(frame)
    else setInterval(() => frame(Date.now()), 1000 / 60)
  }

  return app
}

module.exports = { createApp }
