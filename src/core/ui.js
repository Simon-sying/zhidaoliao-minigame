/**
 * 轻量 Canvas UI 原语：圆角、卡片、文字排版、按钮、进度条、纵向滚动列表。
 * 全部基于逻辑像素绘制（app 已按 dpr 缩放 ctx）。
 */
const T = require('./theme')
const C = T.COLS = T.COLORS
const util = require('../utils/util')

function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fillRoundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color
  rrect(ctx, x, y, w, h, r)
  ctx.fill()
}

function strokeRoundRect(ctx, x, y, w, h, r, color, lw) {
  ctx.strokeStyle = color
  ctx.lineWidth = lw || 1
  rrect(ctx, x, y, w, h, r)
  ctx.stroke()
}

function card(ctx, x, y, w, h, r) {
  ctx.save()
  ctx.shadowColor = 'rgba(24, 54, 90, 0.08)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 4
  fillRoundRect(ctx, x, y, w, h, r || T.RADIUS.md, C.card)
  ctx.restore()
}

/* ---------------- 文字 ---------------- */
function wrapLines(ctx, text, maxWidth, size, weight) {
  ctx.font = T.font(weight || 'normal', size)
  const paragraphs = String(text == null ? '' : text).split('\n')
  const lines = []
  paragraphs.forEach((para, pi) => {
    let cur = ''
    for (let i = 0; i < para.length; i++) {
      const ch = para[i]
      const test = cur + ch
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur)
        cur = ch
      } else {
        cur = test
      }
    }
    lines.push(cur)
    if (pi < paragraphs.length - 1) lines.push('') // 段落空行（随后空串渲染为占位）
  })
  return lines.filter((l, i) => !(l === '' && i === lines.length - 1 && paragraphs[paragraphs.length - 1] === ''))
}

/**
 * 绘制多行文字。
 * opts: {size,color,weight,align:'left'|'center'|'right',lineHeight,x,y 为左上角}
 * @returns 绘制结束的 y（底部）
 */
function drawText(ctx, text, x, y, width, opts) {
  opts = opts || {}
  const size = opts.size || 16
  const lh = opts.lineHeight || Math.round(size * 1.45)
  const lines = wrapLines(ctx, text, width, size, opts.weight)
  ctx.font = T.font(opts.weight || 'normal', size)
  ctx.fillStyle = opts.color || C.ink
  ctx.textBaseline = 'top'
  lines.forEach((line, i) => {
    let tx = x
    if (opts.align === 'center') {
      const lw = ctx.measureText(line).width
      tx = x + (width - lw) / 2
    } else if (opts.align === 'right') {
      const lw = ctx.measureText(line).width
      tx = x + width - lw
    }
    ctx.fillText(line, tx, y + i * lh)
  })
  return y + lines.length * lh
}

/** 单行文字（垂直居中于 cy），用于按钮、角标 */
function drawCenteredText(ctx, text, cx, cy, opts) {
  opts = opts || {}
  ctx.font = T.font(opts.weight || 'normal', opts.size || 16)
  ctx.fillStyle = opts.color || C.ink
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(text, cx, cy)
  ctx.textAlign = 'left'
}

/* ---------------- 按钮 ---------------- */
const BTN_STYLE = {
  primary: { bg: C.primary, fg: '#fff', border: null },
  teal: { bg: C.teal, fg: '#fff', border: null },
  green: { bg: C.green, fg: '#fff', border: null },
  danger: { bg: C.red, fg: '#fff', border: null },
  ghost: { bg: 'transparent', fg: C.primary, border: C.primary },
  light: { bg: '#EEF5FF', fg: C.primary, border: null },
  gray: { bg: '#F0F3F7', fg: C.sub, border: null },
  text: { bg: 'transparent', fg: C.primary, border: null },
  none: { bg: 'transparent', fg: 'transparent', border: null }
}

class Button {
  constructor(o) {
    o = o || {}
    this.x = o.x || 0
    this.y = o.y || 0
    this.w = o.w || 0
    this.h = o.h || 48
    this.text = o.text || ''
    this.emoji = o.emoji || ''
    this.type = o.type || 'primary'
    this.fontSize = o.fontSize || 17
    this.radius = o.radius || T.RADIUS.md
    this.disabled = !!o.disabled
    this.pressed = false
    this.onTap = o.onTap || null
    this.style = BTN_STYLE[this.type] || BTN_STYLE.primary
  }
  contains(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h
  }
  draw(ctx) {
    const s = this.style
    const label = (this.emoji ? this.emoji + ' ' : '') + this.text
    ctx.save()
    if (this.disabled) ctx.globalAlpha = 0.45
    if (s.bg && s.bg !== 'transparent') {
      let bg = s.bg
      if (this.pressed) bg = this.type === 'light' || this.type === 'gray' ? '#E2E9F1' : undefined
      if (this.pressed && this.type === 'primary') bg = C.primaryDeep
      fillRoundRect(ctx, this.x, this.y, this.w, this.h, this.radius, bg || s.bg)
    }
    if (s.border) strokeRoundRect(ctx, this.x, this.y, this.w, this.h, this.radius, s.border, 1.5)
    if (this.pressed) ctx.globalAlpha = (this.disabled ? 0.45 : 0.8)
    drawCenteredText(ctx, label, this.x + this.w / 2, this.y + this.h / 2, {
      size: this.fontSize,
      weight: '600',
      color: s.fg
    })
    ctx.restore()
  }
}

/* ---------------- 进度条 ---------------- */
function progressBar(ctx, x, y, w, h, percent, color, trackColor) {
  fillRoundRect(ctx, x, y, w, h, h / 2, trackColor || '#E8EFF6')
  const p = util.clamp(percent, 0, 100)
  if (p > 0) fillRoundRect(ctx, x, y, Math.max(h, (w * p) / 100), h, h / 2, color || C.primary)
}

/* ---------------- 小标签 ---------------- */
function chip(ctx, text, x, y, opts) {
  opts = opts || {}
  const size = opts.size || 12
  ctx.font = T.font('500', size)
  const tw = ctx.measureText(text).width
  const padX = opts.padX || 8
  const h = opts.h || size + 8
  const w = tw + padX * 2
  fillRoundRect(ctx, x, y, w, h, h / 2, opts.bg || C.yellowSoft)
  drawCenteredText(ctx, text, x + w / 2, y + h / 2 + 0.5, { size, color: opts.fg || '#B0740A', weight: '500' })
  return w
}

/* ---------------- 纵向滚动列表 ---------------- */
class ScrollView {
  constructor(o) {
    this.x = o.x
    this.y = o.y
    this.w = o.w
    this.h = o.h
    this.rowH = o.rowH
    this.gap = o.gap || 0
    this.items = o.items || []
    this.renderRow = o.renderRow || function () {}
    this.onTap = o.onTap || null
    this.offset = 0
    this.maxOffset = 0
    this.dragging = false
    this._sy = 0
    this._so = 0
    this._moved = 0
    this._vy = 0
    this._ly = 0
    this.recalc()
  }
  setItems(items) {
    this.items = items || []
    this.offset = 0
    this.recalc()
  }
  recalc() {
    const total = this.items.length * this.rowH + Math.max(0, this.items.length - 1) * this.gap
    this.maxOffset = Math.max(0, total - this.h)
    this.offset = util.clamp(this.offset, 0, this.maxOffset)
  }
  onTouchStart(px, py) {
    this.dragging = true
    this._sy = py
    this._ly = py
    this._so = this.offset
    this._moved = 0
    this._vy = 0
  }
  onTouchMove(px, py) {
    if (!this.dragging) return
    const dy = py - this._sy
    this._moved = Math.max(this._moved, Math.abs(dy))
    this.offset = util.clamp(this._so - dy, -this.h * 0.15, this.maxOffset + this.h * 0.15)
    const dt = 1 / 60
    this._vy = (py - this._ly) / dt / 60 * -1 // 每秒像素，向上为正
    this._ly = py
  }
  onTouchEnd(px, py) {
    this.dragging = false
    if (this._moved < 8 && this.onTap) {
      const innerY = py - this.y + this.offset
      const step = this.rowH + this.gap
      const idx = Math.floor(innerY / step)
      if (idx >= 0 && idx < this.items.length) {
        const within = innerY - idx * step
        if (within <= this.rowH && px >= this.x && px <= this.x + this.w) this.onTap(this.items[idx], idx)
      }
    }
  }
  update(dt) {
    if (this.dragging) return
    if (Math.abs(this._vy) > 4) {
      this.offset = util.clamp(this.offset - this._vy * dt, 0, this.maxOffset)
      this._vy *= 0.92
    } else {
      // 橡皮筋回弹
      if (this.offset < 0) this.offset = Math.min(0, this.offset + (0 - this.offset) * 0.25)
      else if (this.offset > this.maxOffset) this.offset = Math.min(this.maxOffset, this.offset + (this.maxOffset - this.offset) * 0.25)
    }
  }
  draw(ctx) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(this.x, this.y, this.w, this.h)
    ctx.clip()
    const step = this.rowH + this.gap
    const start = Math.max(0, Math.floor(this.offset / step) - 1)
    const end = Math.min(this.items.length - 1, Math.ceil((this.offset + this.h) / step) + 1)
    for (let i = start; i <= end; i++) {
      const ry = this.y + i * step - this.offset
      this.renderRow(ctx, this.items[i], i, this.x, ry, this.w, this.rowH)
    }
    ctx.restore()
    // 滚动条
    if (this.maxOffset > 4) {
      const barH = Math.max(24, (this.h / (this.h + this.maxOffset)) * this.h)
      const barY = this.y + (this.offset / this.maxOffset) * (this.h - barH)
      fillRoundRect(ctx, this.x + this.w - 3, barY, 3, barH, 1.5, 'rgba(120,140,160,0.35)')
    }
  }
}

module.exports = {
  rrect,
  fillRoundRect,
  strokeRoundRect,
  card,
  wrapLines,
  drawText,
  drawCenteredText,
  Button,
  progressBar,
  chip,
  ScrollView
}
