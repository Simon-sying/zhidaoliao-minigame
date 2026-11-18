const BaseScene = require('./base')
const T = require('../core/theme')

class MyKnowledgeScene extends BaseScene {
  onEnter() {
    this.app.analytics.log('knowledge_page_show')
    const pad = this.app.pad()
    this.listY = this.app.headerH() + 214
    this.list = this.addScroll({
      x: pad,
      y: this.listY,
      w: this.app.contentW(),
      h: this.app.h - T.metrics.safeBottom - 12 - this.listY,
      rowH: 76,
      gap: 10,
      items: this.app.categories,
      onTap: (cat) => this.app.go('casual', { categoryId: cat.id })
    })
    this.list.renderRow = (ctx, cat, i, x, y, w, h) => this.drawCategory(ctx, cat, x, y, w, h)
  }
  onResume() {}

  statsFor(cat) {
    const m = this.app.mastery.loadAll()
    const kidSet = new Set(this.app.bank.getByCategory(cat.id).map((q) => q.knowledgeId))
    let sum = 0
    let touched = 0
    kidSet.forEach((kid) => {
      if (m[kid] && m[kid].seen > 0) {
        sum += m[kid].v
        touched += 1
      }
    })
    return { total: kidSet.size, touched, avg: touched ? Math.round(sum / touched) : 0 }
  }

  drawCategory(c, cat, x, y, w, h) {
    const ui = this.app.ui
    const st = this.statsFor(cat)
    ui.card(c, x, y, w, h, T.RADIUS.md)
    c.font = '600 22px ' + T.FONT.family
    c.textBaseline = 'middle'
    c.fillText(cat.emoji, x + 22, y + h / 2)
    ui.drawText(c, cat.name, x + 54, y + 13, w - 120, { size: 15.5, weight: '700', color: T.COLORS.ink })
    ui.drawText(c, `已学 ${st.touched}/${st.total} 个知识点`, x + 54, y + 38, w - 120, { size: 12, color: T.COLORS.faint })
    c.textAlign = 'right'
    c.font = T.font('800', 17)
    c.textBaseline = 'middle'
    c.fillStyle = st.avg >= 80 ? T.COLORS.green : T.COLORS.primaryDeep
    c.fillText(`${st.avg}%`, x + w - 16, y + 28)
    c.textAlign = 'left'
    ui.progressBar(c, x + 54, y + h - 18, w - 74, 7, st.avg, st.avg >= 80 ? T.COLORS.green : T.COLORS.primary)
  }

  render(c) {
    this.beginRender()
    const ui = this.app.ui
    const m = T.metrics
    const pad = this.app.pad()
    const cw = this.app.contentW()
    const y0 = this.app.headerH() + 4

    this.app.drawHeader(c, '我的知识')

    const learned = this.app.mastery.learnedCount()
    const mastered = this.app.mastery.masteredCount()
    const total = this.app.knowledge.count()
    const coverage = total ? Math.round((learned / total) * 100) : 0

    // 总览卡
    ui.card(c, pad, y0, cw, 104, T.RADIUS.lg)
    ui.drawText(c, '🧠 我的认知成长', pad + 18, y0 + 16, cw - 36, { size: 15, weight: '700', color: T.COLORS.ink })
    const nums = [
      { v: learned, k: '已学知识点' },
      { v: mastered, k: '已掌握' },
      { v: total, k: '知识点总数' }
    ]
    nums.forEach((n, i) => {
      const cx = pad + 18 + i * ((cw - 36) / 3) + (cw - 36) / 6
      c.textAlign = 'center'
      c.font = T.font('800', 24)
      c.fillStyle = T.COLORS.primaryDeep
      c.textBaseline = 'top'
      c.fillText(`${n.v}`, cx, y0 + 44)
      c.font = T.font('normal', 11.5)
      c.fillStyle = T.COLORS.faint
      c.fillText(n.k, cx, y0 + 78)
      c.textAlign = 'left'
    })

    // 错题 / 收藏入口
    const entryY = y0 + 114
    const wrongCount = this.app.progress.activeWrong().length
    const favCount = this.app.progress.getFavorites().length
    const ew = (cw - 12) / 2
    const entry = (x, emoji, label, n, target) => {
      ui.fillRoundRect(c, x, entryY, ew, 58, T.RADIUS.md, T.COLORS.card)
      ui.strokeRoundRect(c, x, entryY, ew, 58, T.RADIUS.md, T.COLORS.line, 1)
      c.font = '600 20px ' + T.FONT.family
      c.textBaseline = 'middle'
      c.fillText(emoji, x + 22, entryY + 29)
      ui.drawText(c, label, x + 50, entryY + 11, ew - 90, { size: 14.5, weight: '600', color: T.COLORS.ink })
      ui.drawText(c, `${n} 项`, x + 50, entryY + 32, ew - 90, { size: 12, color: T.COLORS.faint })
      this.button({ x, y: entryY, w: ew, h: 58, type: 'none', onTap: () => this.app.go(target) })
    }
    entry(pad, '📝', '错题本', wrongCount, 'wrong')
    entry(pad + ew + 12, '⭐', '我的收藏', favCount, 'favorites')

    ui.drawText(c, '分类掌握度（点击可针对该分类刷题）', pad, this.listY - 24, cw, { size: 12.5, color: T.COLORS.faint })
    this.list.draw(c)
  }
}

module.exports = MyKnowledgeScene
