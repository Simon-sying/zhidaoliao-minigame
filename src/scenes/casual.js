const BaseScene = require('./base')
const T = require('../core/theme')
const pf = require('../core/platform')
const util = require('../utils/util')

class CasualScene extends BaseScene {
  onEnter(params) {
    this.app.analytics.log('casual_start', { category: (params && params.categoryId) || 'all' })
    this.categoryId = (params && params.categoryId) || null
    this.index = 0
    this.claimedSummaryAt = 0
    this.loadNext()
  }

  loadNext() {
    this.q = this.app.quiz.nextCasualQuestion(this.categoryId ? { categoryId: this.categoryId } : {})
    // 本轮已出过的题（"重复出现"）渲染时打乱选项位置，其余保持原序
    this.perm = util.optionPerm(this.q.options.length, {
      shuffle: this.app.quiz.isCasualRepeat(this.q.id),
      seed: util.hashStr(this.q.id + '_casual')
    })
    this.phase = 'answer' // answer | revealed
    this.selected = null
    this.hintShown = false
    this.lastResult = null
    this.qStart = Date.now()
    this.fav = this.app.progress.isFavorite(this.q.id)
    this.index += 1
    this.app.analytics.log('casual_question_show', { qId: this.q.id, category: this.q.categoryId })
  }

  choose(i) {
    if (this.phase !== 'answer') return
    const orig = this.perm && this.perm[i] != null ? this.perm[i] : i // 显示位 -> 原始下标
    const correct = orig === this.q.answer
    this.selected = orig
    this.phase = 'revealed'
    this.app.progress.recordCasualAnswer(correct)
    this.lastResult = this.app.mastery.record(this.q.knowledgeId, this.q.id, correct)
    if (correct) this.app.progress.resolveWrong(this.q.id)
    else this.app.progress.addWrong(this.q)
    this.app.analytics.log('casual_answer', { qId: this.q.id, correct })
    pf.vibrate(correct ? 'short' : 'long')
    const newly = this.app.achievements.evaluate()
    if (newly.length) this.app.toast(`解锁成就：${newly[0].emoji} ${newly[0].name}`)
  }

  toggleFav() {
    this.fav = this.app.progress.toggleFavorite(this.q.id)
    this.app.analytics.log('knowledge_favorite', { qId: this.q.id, fav: this.fav })
    this.app.toast(this.fav ? '已收藏到「我的知识」' : '已取消收藏')
  }

  async watchHint() {
    if (this.phase !== 'answer' || this.hintShown) return
    this.app.analytics.log('ad_request', { scene: 'hint' })
    const r = await this.app.ads.showRewardAd('hint')
    this.app.analytics.log(r.rewarded ? 'ad_reward' : 'ad_close', { scene: 'hint' })
    if (r.rewarded) this.hintShown = true
  }

  async watchSummary() {
    this.app.analytics.log('ad_request', { scene: 'summary' })
    const r = await this.app.ads.showRewardAd('summary')
    this.app.analytics.log(r.rewarded ? 'ad_reward' : 'ad_close', { scene: 'summary' })
    if (!r.rewarded) return
    this.claimedSummaryAt = this.index
    const d = this.app.progress.getDaily().casual
    const rate = d.answered ? Math.round((d.correct / d.answered) * 100) : 0
    const cat = this.app.knowledge.getCategoryName(this.q.categoryId)
    this.app.confirm({
      title: '🎒 今日知识总结',
      content: `今天你在休闲模式已答 ${d.answered} 题，答对 ${d.correct} 题，正确率 ${rate}%。\n刚刚这题来自「${cat}」：${this.q.knowledgeTip}\n保持节奏，又知道一点！`,
      cancelText: null,
      confirmText: '继续学习'
    })
  }

  drawOption(c, i, x, y, w, h) {
    const q = this.q
    const orig = this.perm && this.perm[i] != null ? this.perm[i] : i // 显示位 -> 原始下标
    const labels = q.type === 'judge' ? ['✓', '✕'] : ['A', 'B', 'C', 'D']
    let bg = T.COLORS.card
    let border = T.COLORS.line
    let badgeBg = '#EEF3F8'
    let badgeFg = T.COLORS.sub
    let fg = T.COLORS.ink

    if (this.phase === 'revealed') {
      if (orig === q.answer) {
        bg = T.COLORS.greenSoft
        border = T.COLORS.green
        badgeBg = T.COLORS.green
        badgeFg = '#fff'
      } else if (orig === this.selected) {
        bg = T.COLORS.redSoft
        border = T.COLORS.red
        badgeBg = T.COLORS.red
        badgeFg = '#fff'
      } else {
        bg = '#FAFBFD'
      }
    }

    this.app.ui.fillRoundRect(c, x, y, w, h, T.RADIUS.md, bg)
    this.app.ui.strokeRoundRect(c, x, y, w, h, T.RADIUS.md, border, 1.5)
    this.app.ui.fillRoundRect(c, x + 12, y + h / 2 - 15, 30, 30, 15, badgeBg)
    this.app.ui.drawCenteredText(c, labels[i], x + 27, y + h / 2 + 0.5, { size: 15, weight: '700', color: badgeFg })
    c.font = T.font('normal', 16)
    const lines = this.app.ui.wrapLines(c, q.options[orig], w - 70, 16, 'normal')
    const totalH = lines.length * 22
    this.app.ui.drawText(c, q.options[orig], x + 54, y + (h - totalH) / 2, w - 68, { size: 16, color: fg, lineHeight: 22 })
  }

  render(c) {
    this.beginRender()
    const ui = this.app.ui
    const m = T.metrics
    const pad = this.app.pad()
    const cw = this.app.contentW()
    const q = this.q
    const cat = this.app.categories.find((x) => x.id === q.categoryId)

    this.app.drawHeader(c, '休闲刷题')

    const topY = this.app.headerH() - 6
    const catName = `${cat.emoji} ${cat.name}`
    c.font = T.font('600', 12.5)
    const chipW = c.measureText(catName).width + 24
    ui.chip(c, catName, pad, topY, { bg: '#E9F3FF', fg: T.COLORS.primaryDeep, size: 12.5 })
    ui.drawText(c, `第 ${this.index} 题`, 0, topY + 4, this.app.w - pad, { size: 12.5, color: T.COLORS.faint, align: 'right' })

    // 题干卡高度
    const qx = pad
    const qy = topY + 36
    const qw = cw
    let qh = 18
    c.font = T.font('700', 19)
    const qLines = ui.wrapLines(c, q.question, qw - 36, 19, '700')
    qh += qLines.length * 28
    if (q.scenario) {
      c.font = T.font('normal', 14)
      qh += ui.wrapLines(c, q.scenario, qw - 52, 14, 'normal').length * 21 + 12
    }
    let hintLines = []
    if (this.hintShown) {
      c.font = T.font('600', 13.5)
      hintLines = ui.wrapLines(c, '💡 ' + q.tip, qw - 56, 13.5, '600')
      qh += hintLines.length * 20 + 28
    }
    qh += 58

    ui.card(c, qx, qy, qw, qh, T.RADIUS.lg)
    let iy = qy + 18
    if (q.scenario) {
      c.font = T.font('normal', 14)
      const sLines = ui.wrapLines(c, q.scenario, qw - 52, 14, 'normal')
      const sh = sLines.length * 21 + 12
      ui.fillRoundRect(c, qx + 18, iy - 4, qw - 36, sh, 8, '#F3F8FF')
      ui.drawText(c, '📍 ' + q.scenario, qx + 26, iy + 2, qw - 52, { size: 14, color: T.COLORS.primaryDeep, lineHeight: 21 })
      iy += sh + 10
    }
    ui.drawText(c, q.question, qx + 18, iy, qw - 50, { size: 19, weight: '700', color: T.COLORS.ink, lineHeight: 28 })
    iy += qLines.length * 28 + 12

    if (this.hintShown) {
      const hh = hintLines.length * 20 + 16
      ui.fillRoundRect(c, qx + 18, iy, qw - 36, hh, T.RADIUS.sm, T.COLORS.yellowSoft)
      ui.drawText(c, '💡 ' + q.tip, qx + 26, iy + 8, qw - 52, { size: 13.5, weight: '600', color: '#8A5A08', lineHeight: 20 })
    }

    // 收藏 / 提示
    this.button({
      x: qx + 18, y: qy + qh - 42, w: 96, h: 32, text: this.fav ? '★ 已收藏' : '☆ 收藏',
      type: this.fav ? 'light' : 'gray', fontSize: 13.5, onTap: () => this.toggleFav()
    }).draw(c)
    this.button({
      x: qx + qw - 18 - 150, y: qy + qh - 42, w: 150, h: 32,
      text: this.hintShown ? '💡 已提示' : '💡 看视频要提示',
      type: this.hintShown ? 'gray' : 'light', fontSize: 13.5,
      disabled: this.phase === 'revealed' || this.hintShown,
      onTap: () => this.watchHint()
    }).draw(c)

    // 选项
    const optY0 = qy + qh + 16
    const optH = 52
    const optGap = 10
    q.options.forEach((_, i) => {
      const oy = optY0 + i * (optH + optGap)
      this.drawOption(c, i, pad, oy, cw, optH)
      if (this.phase === 'answer') {
        this.button({ x: pad, y: oy, w: cw, h: optH, type: 'none', onTap: () => this.choose(i) })
      }
    })

    if (this.phase === 'revealed') this.drawFeedback(c)
  }

  drawFeedback(c) {
    const m = T.metrics
    const pad = this.app.pad()
    const cw = this.app.contentW()
    const correct = this.selected === this.q.answer
    const lr = this.lastResult || { after: 0, delta: 0 }

    let inner = 70
    c.font = T.font('normal', 14.5)
    inner += this.app.ui.wrapLines(c, this.q.explanation, cw - 40, 14.5, 'normal').length * 22
    c.font = T.font('600', 13.5)
    inner += this.app.ui.wrapLines(c, '💡 ' + this.q.tip, cw - 56, 13.5, '600').length * 20 + 28
    inner += 84
    const offerSummary = this.index % this.app.config.ADS.CASUAL_OFFER_INTERVAL === 0 && this.claimedSummaryAt !== this.index
    if (offerSummary) inner += 36
    if (!correct) {
      c.font = T.font('600', 14)
      inner += this.app.ui.wrapLines(c, this.q.options[this.q.answer], cw - 90, 14, '600').length * 21 + 8
    }
    const sheetH = Math.min(this.app.h - this.app.headerH() - 4, inner)
    const sy = this.app.h - m.safeBottom - sheetH - 6

    c.fillStyle = T.COLORS.mask
    c.fillRect(0, 0, this.app.w, this.app.h)
    this.app.ui.card(c, pad, sy, cw, sheetH, T.RADIUS.lg)

    let y = sy + 18
    c.font = T.font('800', 22)
    c.fillStyle = correct ? T.COLORS.green : T.COLORS.primary
    c.textBaseline = 'top'
    c.fillText(correct ? '✅ 知道了！' : '❌ 原来如此！', pad + 20, y)

    const deltaTxt = lr.delta > 0 ? `+${lr.delta}` : `${lr.delta}`
    const mrText = `掌握度 ${lr.after}%${lr.delta ? ' (' + deltaTxt + ')' : ''}`
    c.font = T.font('600', 12.5)
    const mrW = c.measureText(mrText).width + 20
    this.app.ui.fillRoundRect(c, pad + cw - 20 - mrW, y + 4, mrW, 26, 13, correct ? T.COLORS.greenSoft : T.COLORS.yellowSoft)
    this.app.ui.drawCenteredText(c, mrText, pad + cw - 20 - mrW / 2, y + 17.5, { size: 12.5, weight: '600', color: correct ? '#15803F' : '#B0740A' })
    y += 42

    if (!correct) {
      const ans = this.q.type === 'judge' ? this.q.options[this.q.answer] : this.q.options[this.q.answer]
      y = this.app.ui.drawText(c, `正确答案：${ans}`, pad + 20, y, cw - 40, { size: 14, weight: '600', color: T.COLORS.green, lineHeight: 21 })
      y += 8
    }
    y = this.app.ui.drawText(c, this.q.explanation, pad + 20, y, cw - 40, { size: 14.5, color: T.COLORS.ink, lineHeight: 22 })
    y += 10

    c.font = T.font('600', 13.5)
    const tipLines = this.app.ui.wrapLines(c, '💡 ' + this.q.tip, cw - 56, 13.5, '600')
    const tipH = tipLines.length * 20 + 16
    this.app.ui.fillRoundRect(c, pad + 20, y, cw - 40, tipH, T.RADIUS.sm, T.COLORS.yellowSoft)
    this.app.ui.drawText(c, '💡 ' + this.q.tip, pad + 28, y + 8, cw - 56, { size: 13.5, weight: '600', color: '#8A5A08', lineHeight: 20 })
    y += tipH + 12

    if (offerSummary) {
      this.button({ x: pad + 20, y, w: cw - 40, h: 30, text: '🎬 看视频 · 领取「今日知识总结」', type: 'text', fontSize: 13, onTap: () => this.watchSummary() }).draw(c)
    }

    const by = sy + sheetH - 56
    this.button({ x: pad + 20, y: by, w: 110, h: 42, text: this.fav ? '★ 已收藏' : '☆ 收藏', type: this.fav ? 'light' : 'gray', fontSize: 15, onTap: () => this.toggleFav() }).draw(c)
    this.button({ x: pad + cw - 20 - 168, y: by, w: 168, h: 42, text: '下一题 →', type: 'primary', fontSize: 16, onTap: () => this.loadNext() }).draw(c)
  }
}

module.exports = CasualScene
