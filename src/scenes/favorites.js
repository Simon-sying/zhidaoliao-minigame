const BaseScene = require('./base')
const T = require('../core/theme')

class FavoritesScene extends BaseScene {
  onEnter() {
    const pad = this.app.pad()
    this.listY = this.app.headerH() + 24
    this.list = this.addScroll({
      x: pad,
      y: this.listY,
      w: this.app.contentW(),
      h: this.app.h - T.metrics.safeBottom - 12 - this.listY,
      rowH: 74,
      gap: 10,
      items: [],
      onTap: (q) => this.app.go('knowledgeCard', { qId: q.id, from: 'favorite' })
    })
    this.list.renderRow = (ctx, q, i, x, y, w, h) => this.drawRow(ctx, q, x, y, w, h)
    this.refresh()
  }
  onResume() {
    this.refresh()
  }
  refresh() {
    const items = this.app.progress
      .getFavorites()
      .map((id) => this.app.bank.getById(id))
      .filter(Boolean)
    this.list.setItems(items)
    this.count = items.length
  }

  drawRow(c, q, x, y, w, h) {
    const ui = this.app.ui
    const cat = this.app.categories.find((cc) => cc.id === q.categoryId)
    ui.card(c, x, y, w, h, T.RADIUS.md)
    c.font = '600 18px ' + T.FONT.family
    c.textBaseline = 'middle'
    c.fillText(cat.emoji, x + 18, y + h / 2)
    c.font = T.font('normal', 14.5)
    const lines = ui.wrapLines(c, q.question, w - 96, 14.5, 'normal').slice(0, 2)
    ui.drawText(c, lines.join('\n'), x + 50, y + 11, w - 84, { size: 14.5, color: T.COLORS.ink, lineHeight: 21 })
    c.textAlign = 'right'
    c.font = '600 15px ' + T.FONT.family
    c.fillStyle = T.COLORS.yellow
    c.fillText('★', x + w - 18, y + h / 2)
    c.textAlign = 'left'
  }

  render(c) {
    this.beginRender()
    const pad = this.app.pad()
    this.app.drawHeader(c, '我的收藏')
    this.app.ui.drawText(c, '值得反复看的知识，都收在这里', pad, this.app.headerH() - 4, this.app.contentW(), { size: 12, color: T.COLORS.faint })

    if (this.count === 0) {
      this.app.ui.drawText(c, '⭐', 0, this.app.h / 2 - 70, this.app.w, { size: 48, align: 'center' })
      this.app.ui.drawText(c, '还没有收藏', 0, this.app.h / 2 - 10, this.app.w, { size: 17, weight: '700', color: T.COLORS.ink, align: 'center' })
      this.app.ui.drawText(c, '答题时点亮 ☆，把有价值的知识存下来', 0, this.app.h / 2 + 18, this.app.w, { size: 13, color: T.COLORS.faint, align: 'center' })
      this.button({ x: pad + 20, y: this.app.h / 2 + 56, w: this.app.contentW() - 40, h: 48, emoji: '🧠', text: '去休闲刷题', type: 'primary', onTap: () => this.app.go('casual') }).draw(c)
    } else {
      this.list.draw(c)
    }
  }
}

module.exports = FavoritesScene
