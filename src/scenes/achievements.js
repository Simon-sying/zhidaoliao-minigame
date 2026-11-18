const BaseScene = require('./base')
const T = require('../core/theme')

class AchievementsScene extends BaseScene {
  onEnter() {
    this.app.analytics.log('achievements_show')
    this.refresh()
    const pad = this.app.pad()
    this.listY = this.app.headerH() + 92
    this.list = this.addScroll({
      x: pad,
      y: this.listY,
      w: this.app.contentW(),
      h: this.app.h - T.metrics.safeBottom - 12 - this.listY,
      rowH: 78,
      gap: 10,
      items: this.items
    })
    this.list.renderRow = (ctx, a, i, x, y, w, h) => this.drawRow(ctx, a, x, y, w, h)
  }
  onResume() {
    this.refresh()
    this.list.setItems(this.items)
  }
  refresh() {
    this.items = this.app.achievements.list()
    this.unlocked = this.items.filter((a) => a.unlocked).length
  }

  drawRow(c, a, x, y, w, h) {
    const ui = this.app.ui
    ui.card(c, x, y, w, h, T.RADIUS.md)
    if (!a.unlocked) c.globalAlpha = 0.55
    ui.fillRoundRect(c, x + 14, y + h / 2 - 21, 42, 42, T.RADIUS.md, a.unlocked ? '#FFF4DE' : '#EEF2F6')
    c.font = '600 24px ' + T.FONT.family
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(a.emoji, x + 35, y + h / 2 + 1)
    c.textAlign = 'left'
    ui.drawText(c, a.name, x + 68, y + 14, w - 150, { size: 15.5, weight: '700', color: T.COLORS.ink })
    c.font = T.font('normal', 12.5)
    const dLines = ui.wrapLines(c, a.desc, w - 150, 12.5, 'normal').slice(0, 2)
    ui.drawText(c, dLines.join('\n'), x + 68, y + 38, w - 150, { size: 12.5, color: T.COLORS.faint, lineHeight: 17 })
    const tag = a.unlocked ? '已获得' : '未解锁'
    c.font = T.font('600', 11.5)
    const tw = c.measureText(tag).width + 18
    ui.fillRoundRect(c, x + w - 14 - tw, y + 14, tw, 24, 12, a.unlocked ? T.COLORS.greenSoft : '#EEF2F6')
    ui.drawCenteredText(c, tag, x + w - 14 - tw / 2, y + 26.5, { size: 11.5, weight: '600', color: a.unlocked ? '#15803F' : T.COLORS.faint })
    c.globalAlpha = 1
  }

  render(c) {
    this.beginRender()
    const ui = this.app.ui
    const pad = this.app.pad()
    const cw = this.app.contentW()
    const y0 = this.app.headerH() + 4

    this.app.drawHeader(c, '我的成就')
    ui.card(c, pad, y0, cw, 64, T.RADIUS.md)
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.font = T.font('800', 22)
    c.fillStyle = T.COLORS.primaryDeep
    c.fillText(`${this.unlocked} / ${this.items.length}`, pad + 20, y0 + 33)
    ui.drawText(c, '已点亮的成就', pad + 96, y0 + 16, cw - 120, { size: 13, color: T.COLORS.faint })
    ui.drawText(c, '坚持每天回来，把知识一点点攒起来', pad + 96, y0 + 36, cw - 120, { size: 12.5, color: T.COLORS.sub })

    this.list.draw(c)
  }
}

module.exports = AchievementsScene
