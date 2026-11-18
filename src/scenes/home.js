const BaseScene = require('./base')
const T = require('../core/theme')

class HomeScene extends BaseScene {
  onEnter() {
    this.app.analytics.log('home_show')
    this.u = this.app.progress.getUser()
    this.daily = this.app.progress.getDaily()
  }
  onResume() {
    this.u = this.app.progress.getUser()
    this.daily = this.app.progress.getDaily()
  }

  entryCard(c, o) {
    const { ui } = this.app
    ui.card(c, o.x, o.y, o.w, o.h, T.RADIUS.lg)
    // 左侧图标
    const iconR = 26
    const icx = o.x + 30
    const icy = o.y + o.h / 2
    ui.fillRoundRect(c, icx - iconR, icy - iconR, iconR * 2, iconR * 2, T.RADIUS.md, o.soft)
    c.font = `600 26px ${T.FONT.family}`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(o.emoji, icx, icy + 1)
    c.textAlign = 'left'
    // 文案
    ui.drawText(c, o.title, o.x + 68, o.y + 24, o.w - 110, { size: 19, weight: '700', color: T.COLORS.ink })
    ui.drawText(c, o.sub, o.x + 68, o.y + 54, o.w - 100, { size: 13.5, color: T.COLORS.sub, lineHeight: 19 })
    if (o.meta) {
      ui.chip(c, o.meta, o.x + 68, o.y + o.h - 30, { bg: o.soft, fg: o.accent, size: 11.5 })
    }
    // 右侧箭头
    c.strokeStyle = T.COLORS.faint
    c.lineWidth = 2
    c.lineCap = 'round'
    const ax = o.x + o.w - 22
    const ay = o.y + o.h / 2
    c.beginPath()
    c.moveTo(ax - 4, ay - 8)
    c.lineTo(ax + 3, ay)
    c.lineTo(ax - 4, ay + 8)
    c.stroke()
  }

  render(c) {
    this.beginRender()
    const ui = this.app.ui
    const w = this.app.w
    const pad = this.app.pad()
    const m = T.metrics
    const cw = this.app.contentW()
    let y = m.safeTop + 14

    // 连续学习角标
    const streakText = `🔥 连续学习 ${this.u.streak || 1} 天`
    c.font = T.font('600', 12.5)
    const stW = c.measureText(streakText).width + 24
    ui.fillRoundRect(c, w - pad - stW, y, stW, 28, 14, '#FFF1E3')
    ui.drawCenteredText(c, streakText, w - pad - stW / 2, y + 14.5, { size: 12.5, weight: '600', color: '#C7741A' })
    y += 44

    // Logo
    const logoCy = y + 46
    // 用一个蓝→青纯色圆作底，叠加 emoji
    c.save()
    c.fillStyle = T.COLORS.primary
    c.beginPath()
    c.arc(w / 2, logoCy, 38, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 0.25
    c.fillStyle = T.COLORS.teal
    c.beginPath()
    c.arc(w / 2 + 14, logoCy - 12, 26, 0, Math.PI * 2)
    c.fill()
    c.restore()
    c.font = `600 40px ${T.FONT.family}`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('🧠', w / 2, logoCy + 1)
    c.textAlign = 'left'

    ui.drawText(c, this.app.config.APP.NAME, 0, logoCy + 50, w, { size: 34, weight: '800', color: T.COLORS.ink, align: 'center' })
    ui.drawText(c, this.app.config.APP.SLOGAN, 0, logoCy + 96, w, { size: 14.5, color: T.COLORS.sub, align: 'center' })

    let cardY = logoCy + 132
    const cardH = 104
    const gap = 14

    const casualMeta = this.daily.casual.answered > 0 ? `今日已答 ${this.daily.casual.answered} 题` : ''
    const ch = this.daily.challenge
    const challengeMeta = ch.played
      ? (ch.cloudRank ? `最佳 第${ch.cloudRank}名` : `最佳答对 ${ch.bestCorrect || 0} 题`)
      : '三条命 · 无限闯关'

    this.entryCard(c, {
      x: pad, y: cardY, w: cw, h: cardH, emoji: '🧠',
      title: '休闲刷题', sub: '错了也没关系，继续玩，每题都有干货解析',
      meta: casualMeta, accent: T.COLORS.primary, soft: '#E9F3FF'
    })
    this.button({ x: pad, y: cardY, w: cw, h: cardH, type: 'none', onTap: () => this.app.go('casual') })

    this.entryCard(c, {
      x: pad, y: cardY + cardH + gap, w: cw, h: cardH, emoji: '🏆',
      title: '排名挑战', sub: '三条生命无限闯关，看看今天你能答对多少题',
      meta: challengeMeta, accent: T.COLORS.teal, soft: '#E4F7F4'
    })
    this.button({ x: pad, y: cardY + cardH + gap, w: cw, h: cardH, type: 'none', onTap: () => this.app.go('challengeIntro') })

    // 次级入口
    const subY = cardY + cardH * 2 + gap * 2 + 10
    const subW = (cw - 12) / 2
    const mkSub = (x, emoji, label, target) => {
      ui.fillRoundRect(c, x, subY, subW, 56, T.RADIUS.md, T.COLORS.card)
      ui.strokeRoundRect(c, x, subY, subW, 56, T.RADIUS.md, T.COLORS.line, 1)
      ui.drawCenteredText(c, `${emoji}  ${label}`, x + subW / 2, subY + 28.5, { size: 15.5, weight: '600', color: T.COLORS.ink })
      this.button({ x, y: subY, w: subW, h: 56, type: 'none', onTap: () => this.app.go(target) })
    }
    mkSub(pad, '📚', '我的知识', 'myKnowledge')
    mkSub(pad + subW + 12, '🏅', '成就', 'achievements')

    // 底部状态：发布版不暴露任何调试信息
    const isCloud = this.app.cloud.isAvailable()
    if (this.app.config.APP.DEBUG) {
      const status = isCloud ? '☁️ 云端排行榜已连接' : '开发模式 · 排行榜为本地预览数据'
      ui.drawText(c, status, 0, this.app.h - m.safeBottom - 34, w, { size: 11.5, color: T.COLORS.faint, align: 'center' })
      ui.drawText(c, `v${this.app.config.APP.VERSION} · 题库 v${this.app.bank.version} · ${this.app.bank.count()} 题`, 0, this.app.h - m.safeBottom - 16, w, { size: 11, color: T.COLORS.faint, align: 'center' })
    } else if (isCloud) {
      ui.drawText(c, '🏆 今日排行榜已开启 · 完成挑战即可上榜', 0, this.app.h - m.safeBottom - 24, w, { size: 11.5, color: T.COLORS.faint, align: 'center' })
    }
  }
}

module.exports = HomeScene
