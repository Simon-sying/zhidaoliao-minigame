const BaseScene = require('./base')
const T = require('../core/theme')

class LeaderboardScene extends BaseScene {
  onEnter() {
    this.app.analytics.log('leaderboard_show')
    this.status = 'loading'
    this.data = { mode: 'local', list: [], mine: null, myRank: null, preview: false }
    this.ch = this.app.progress.getChallengeState()

    const pad = this.app.pad()
    this.listTop = 0
    this.list = this.addScroll({ x: pad, y: 0, w: this.app.contentW(), h: 10, rowH: 62, gap: 10 })
    this.load()
  }

  async load() {
    this.status = 'loading'
    const available = await this.app.cloud.init()
    if (available) {
      // 给云调用一个很短的兜底，避免一直 loading
      this.data = await Promise.race([
        this.app.leaderboard.getBoard(),
        new Promise((r) => setTimeout(() => r({ mode: 'timeout', list: [], myRank: null }), 8000))
      ])
    } else {
      this.data = await this.app.leaderboard.getBoard()
    }
    this.status = 'done'
    this._needLayout = true
  }

  layout() {
    this.list.y = this.listY
    this.list.h = Math.max(120, this.app.h - T.metrics.safeBottom - 150 - this.listY)
    this.list.setItems(this.data.list || [])
  }

  medalColor(rank) {
    if (rank === 1) return '#F5B400'
    if (rank === 2) return '#9AA7B5'
    if (rank === 3) return '#D08A45'
    return '#E4EBF2'
  }

  drawRow(c, item, i, x, y, w, h) {
    this.app.ui.card(c, x, y, w, h, T.RADIUS.md)
    // 名次
    const rank = item.rank || i + 1
    const mc = this.medalColor(rank)
    this.app.ui.fillRoundRect(c, x + 12, y + h / 2 - 15, 30, 30, 15, mc)
    this.app.ui.drawCenteredText(c, `${rank}`, x + 27, y + h / 2 + 0.5, {
      size: 15,
      weight: '800',
      color: rank <= 3 ? '#fff' : T.COLORS.sub
    })
    // 昵称
    const name = item.nickname || '神秘玩家'
    this.app.ui.drawText(c, name, x + 54, y + 12, w - 150, { size: 15.5, weight: '600', color: T.COLORS.ink })
    this.app.ui.drawText(c, `速度分 ${item.score}`, x + 54, y + 35, w - 150, { size: 12, color: T.COLORS.faint })
    // 答对题数（右对齐，无尽排名的主指标）
    c.textAlign = 'right'
    c.font = T.font('800', 17)
    c.fillStyle = T.COLORS.primaryDeep
    c.textBaseline = 'middle'
    c.fillText(`${item.correctCount} 题`, x + w - 18, y + h / 2)
    c.textAlign = 'left'
  }

  render(c) {
    this.beginRender()
    const ui = this.app.ui
    const m = T.metrics
    const pad = this.app.pad()
    const cw = this.app.contentW()

    this.app.drawHeader(c, '今日排行榜')
    let y = this.app.headerH() - 4
    ui.drawText(c, `📅 ${this.app.challenges.todayId().replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')} · 无尽挑战 · 三条生命`, pad, y, cw, { size: 12.5, color: T.COLORS.faint })
    y += 24

    // 我的名次横幅
    let bannerText
    let bannerBg
    let bannerFg
    if (this.status !== 'done') {
      bannerText = '正在加载排行榜…'
      bannerBg = '#EEF3F8'
      bannerFg = T.COLORS.sub
    } else if (this.data.mode === 'cloud' && this.data.myRank) {
      bannerText = `🎯 我的今日排名：第 ${this.data.myRank} 名 · 答对 ${this.ch.bestCorrect || 0} 题`
      bannerBg = T.COLORS.greenSoft
      bannerFg = '#15803F'
    } else if (this.data.mode === 'cloud' && this.ch.bestScore) {
      bannerText = `今日已挑战，最佳答对 ${this.ch.bestCorrect || 0} 题，成绩已提交，等待排名刷新`
      bannerBg = T.COLORS.yellowSoft
      bannerFg = '#B0740A'
    } else if (this.data.preview) {
      bannerText = '本地预览榜单（开发调试）：以下为虚拟数据，不会生成真实名次'
      bannerBg = T.COLORS.yellowSoft
      bannerFg = '#B0740A'
    } else if (this.data.mode === 'local') {
      bannerText = '每日排行榜即将开放，先去完成今日挑战吧'
      bannerBg = '#E9F3FF'
      bannerFg = T.COLORS.primaryDeep
    } else {
      bannerText = '暂时没有拉取到云端榜单，请稍后重试'
      bannerBg = '#FDECEC'
      bannerFg = T.COLORS.red
    }
    c.font = T.font('600', 13)
    const bLines = ui.wrapLines(c, bannerText, cw - 32, 13, '600')
    const bH = bLines.length * 20 + 18
    ui.fillRoundRect(c, pad, y, cw, bH, T.RADIUS.md, bannerBg)
    ui.drawText(c, bannerText, pad + 16, y + 9, cw - 32, { size: 13, weight: '600', color: bannerFg, lineHeight: 20 })
    y += bH + 12

    this.listY = y
    if (this.status === 'done') {
      if (this._needLayout) {
        this.list.renderRow = (ctx, item, i, x, yy, w, h) => this.drawRow(ctx, item, i, x, yy, w, h)
        this.layout()
        this._needLayout = false
      }
      this.list.draw(c)
    }
    if (this.status === 'loading') {
      ui.drawText(c, '☁️ 加载中…', 0, y + 80, this.app.w, { size: 14, color: T.COLORS.faint, align: 'center' })
    }
    if (this.status === 'done' && (!this.data.list || !this.data.list.length)) {
      const emptyText = this.data.mode === 'local'
        ? '排行榜即将开放，敬请期待'
        : '今天还没有人上榜，去做第一个吧'
      ui.drawText(c, emptyText, 0, y + 80, this.app.w, { size: 14, color: T.COLORS.faint, align: 'center' })
    }

    // 底部按钮
    const by = this.app.h - m.safeBottom - 62
    this.button({ x: pad + 20, y: by, w: cw - 40, h: 48, emoji: '🏆', text: this.ch.played ? '再去挑战' : '参加今日挑战', type: 'primary', fontSize: 16, onTap: () => this.app.go('challengeIntro') }).draw(c)
  }
}

module.exports = LeaderboardScene
