const BaseScene = require('./base')
const T = require('../core/theme')

class KnowledgeCardScene extends BaseScene {
  onEnter(params) {
    this.q = this.app.bank.getById(params.qId)
    this.from = params.from || 'favorite'
    this.app.analytics.log('knowledge_view', { qId: params.qId, from: this.from })
    this.fav = this.app.progress.isFavorite(params.qId)
    this.masteryVal = this.app.mastery.valueOf(this.q ? this.q.knowledgeId : '')
  }

  markResolved() {
    if (!this.q) return
    this.app.progress.resolveWrong(this.q.id)
    this.app.toast('已标记掌握，移出错题本')
    this.app.back()
  }
  toggleFav() {
    if (!this.q) return
    this.fav = this.app.progress.toggleFavorite(this.q.id)
    this.app.toast(this.fav ? '已收藏' : '已取消收藏')
  }

  render(c) {
    this.beginRender()
    if (!this.q) {
      this.app.drawHeader(c, '知识卡片')
      this.app.ui.drawText(c, '题目不存在或已被移除', 0, this.app.h / 2, this.app.w, { size: 14, color: T.COLORS.faint, align: 'center' })
      return
    }
    const ui = this.app.ui
    const m = T.metrics
    const pad = this.app.pad()
    const cw = this.app.contentW()
    const q = this.q
    const cat = this.app.categories.find((x) => x.id === q.categoryId)

    this.app.drawHeader(c, '知识卡片')
    let y = this.app.headerH() + 4

    const chipText = `${cat.emoji} ${cat.name} · 掌握度 ${this.masteryVal}%`
    c.font = T.font('600', 12.5)
    ui.chip(c, chipText, pad, y, { bg: '#E9F3FF', fg: T.COLORS.primaryDeep, size: 12.5 })
    y += 38

    c.font = T.font('700', 19)
    const qLines = ui.wrapLines(c, q.question, cw - 36, 19, '700')
    let qh = 24 + qLines.length * 28
    if (q.scenario) {
      c.font = T.font('normal', 14)
      qh += ui.wrapLines(c, q.scenario, cw - 52, 14, 'normal').length * 21 + 12
    }
    ui.card(c, pad, y, cw, qh, T.RADIUS.lg)
    let iy = y + 18
    if (q.scenario) {
      c.font = T.font('normal', 14)
      const sLines = ui.wrapLines(c, q.scenario, cw - 52, 14, 'normal')
      const sh = sLines.length * 21 + 12
      ui.fillRoundRect(c, pad + 18, iy - 4, cw - 36, sh, 8, '#F3F8FF')
      ui.drawText(c, '📍 ' + q.scenario, pad + 26, iy + 2, cw - 52, { size: 14, color: T.COLORS.primaryDeep, lineHeight: 21 })
      iy += sh + 10
    }
    ui.drawText(c, q.question, pad + 18, iy, cw - 50, { size: 19, weight: '700', color: T.COLORS.ink, lineHeight: 28 })
    y += qh + 14

    // 正确答案
    const ans = q.type === 'judge' ? q.options[q.answer] : q.options[q.answer]
    ui.fillRoundRect(c, pad, y, cw, 46, T.RADIUS.md, T.COLORS.greenSoft)
    ui.drawText(c, `✅ 正确答案：${ans}`, pad + 16, y, cw - 32, { size: 14.5, weight: '700', color: '#15803F' })
    // 垂直居中近似
    y += 58

    // 解析
    c.font = T.font('800', 15)
    c.fillStyle = T.COLORS.ink
    c.textBaseline = 'top'
    c.fillText('为什么？', pad + 2, y)
    y += 26
    c.font = T.font('normal', 14.5)
    y = ui.drawText(c, q.explanation, pad, y, cw, { size: 14.5, color: T.COLORS.ink, lineHeight: 23 })
    y += 16

    // 记忆点
    c.font = T.font('600', 13.5)
    const tipLines = ui.wrapLines(c, '💡 ' + q.tip, cw - 16, 13.5, '600')
    const tipH = tipLines.length * 20 + 16
    ui.fillRoundRect(c, pad, y, cw, tipH, T.RADIUS.sm, T.COLORS.yellowSoft)
    ui.drawText(c, '💡 ' + q.tip, pad + 8, y + 8, cw - 16, { size: 13.5, weight: '600', color: '#8A5A08', lineHeight: 20 })

    // 底部按钮
    const by = this.app.h - m.safeBottom - 60
    if (this.from === 'wrong') {
      this.button({ x: pad, y: by, w: cw, h: 48, emoji: '✅', text: '我会了，移出错题本', type: 'green', fontSize: 16, onTap: () => this.markResolved() }).draw(c)
    } else {
      this.button({ x: pad, y: by, w: cw, h: 48, text: this.fav ? '★ 已收藏（点击取消）' : '☆ 收藏这道题', type: this.fav ? 'light' : 'gray', fontSize: 16, onTap: () => this.toggleFav() }).draw(c)
    }
  }
}

module.exports = KnowledgeCardScene
