const BaseScene = require('./base')
const T = require('../core/theme')
const pf = require('../core/platform')
const util = require('../utils/util')

class ChallengeScene extends BaseScene {
  onEnter(params) {
    const svc = this.app.challenges
    if (params && params.resume) {
      // 看广告复活：复用本局（reviveRun 已 +1 命并把 index 推到下一题）
      this.run = svc.getRun()
    } else {
      // 正常开局：介绍页已 startRun；若被直接进入则兜底新建
      this.run = svc.getRun() || svc.startRun()
    }
    this.limit = this.app.config.CHALLENGE.PER_QUESTION_SEC
    this.curLimit = this.limit // 本题实际倒计时（用「延时」道具后增加）
    this.phase = 'answer'
    this.selected = null
    this.lastCorrect = false
    this.timedOut = false
    this.revealNextAt = 0
    this.qStart = Date.now()
    this.done = false
  }

  currentQ() {
    return this.run.set[this.run.index]
  }

  liveScore() {
    let s = 0
    this.run.answers.forEach((a) => {
      s += this.app.challenges.scoreOne(a.seconds).total
    })
    return s
  }

  remainSec() {
    return Math.max(0, this.curLimit - (Date.now() - this.qStart) / 1000)
  }

  isEliminated(i) {
    return this.run.eliminated.indexOf(i) !== -1
  }

  /**
   * 本题选项显示置换表：当天已答过的题（"重复出现"）才乱序，其余原序。
   * 乱序只发生在渲染层，作答/提交仍用原始下标，答案校验与减半排除不受影响。
   */
  permOf(q) {
    const run = this.run
    const repeat = run.doneAtStart.indexOf(q.id) !== -1
    const seed = util.hashStr(q.id + '_opt_' + run.dateCompact + '_' + run.runSeed)
    return util.optionPerm(q.options.length, { shuffle: repeat, seed })
  }

  /** 统一结算一次作答 */
  settle(i, correct, seconds, viaHint) {
    const q = this.currentQ()
    this.selected = i
    this.lastCorrect = correct
    this.phase = 'reveal'
    this.run.answers.push({ qId: q.id, chosen: i, correct, seconds })
    if (!correct) this.run.hearts -= 1
    this.app.challenges.markDayDone(q.id, this.run.dateCompact) // 当天去重：答过即记录
    this.app.analytics.log('challenge_answer', {
      qId: q.id,
      correct,
      index: this.run.index,
      seconds,
      hearts: this.run.hearts,
      hint: viaHint ? 'answer' : ''
    })
    pf.vibrate(correct ? 'short' : 'long')
    this.revealNextAt = Date.now() + (correct ? 480 : 1100)
  }

  choose(i) {
    if (this.phase !== 'answer' || this.done) return
    const orig = this._perm && this._perm[i] != null ? this._perm[i] : i // 显示位 -> 原始下标
    if (this.isEliminated(orig)) {
      this.app.toast('该选项已被减半排除')
      return
    }
    const q = this.currentQ()
    const seconds = Math.max(0.3, Math.min(this.curLimit, Math.round(((Date.now() - this.qStart) / 1000) * 10) / 10))
    this.timedOut = false
    this.settle(orig, orig === q.answer, seconds, false)
  }

  /** 超时未作答：按答错处理，用时记本题实际倒计时 */
  onTimeout() {
    this.timedOut = true
    this.settle(-1, false, this.curLimit, false)
  }

  /** 「正确答案」道具：立即按答对锁定，但只拿基础分（不拿速度分） */
  useAnswerProp() {
    if (this.phase !== 'answer' || this.done) return
    const idx = this.app.challenges.useHintAnswer(this.run)
    if (idx === null) return
    pf.vibrate('short')
    this.app.analytics.log('challenge_hint_answer', { index: this.run.index, left: this.run.hAnswer })
    this.timedOut = false
    this.settle(idx, true, this.app.config.CHALLENGE.SPEED_NO_BONUS_SECONDS, true)
  }

  async onProp(kind) {
    if (this.phase !== 'answer' || this.done) return
    const svc = this.app.challenges
    if (kind === '50') {
      if (this.run.h50 > 0) {
        const elim = svc.useHint5050(this.run)
        if (elim) {
          pf.vibrate('short')
          this.app.analytics.log('challenge_hint_5050', { index: this.run.index, left: this.run.h50 })
        }
        return
      }
      if (!this.app.ads.isReal()) return this.app.toast('减半道具即将开放')
      const r = await this.app.ads.showRewardAd('hint50')
      if (r.rewarded) this.app.toast(svc.addHint5050(this.run) ? '获得 1 个减半' : '获取失败')
      else if (r.tooFrequent) this.app.toast('广告刚刚看过，稍等一下吧')
    } else if (kind === 'answer') {
      if (this.run.hAnswer > 0) return this.useAnswerProp()
      if (!this.app.ads.isReal()) return this.app.toast('正确答案道具即将开放')
      const r = await this.app.ads.showRewardAd('hintAnswer')
      if (r.rewarded) this.app.toast(svc.addHintAnswer(this.run) ? '获得 1 个正确答案' : '获取失败')
      else if (r.tooFrequent) this.app.toast('广告刚刚看过，稍等一下吧')
    } else if (kind === 'time') {
      if (this.run.hTime > 0) {
        const add = svc.useHintTime(this.run)
        if (add) {
          this.curLimit += add // 本题倒计时延长，qStart 不变，进度条自动回弹
          pf.vibrate('short')
          this.app.analytics.log('challenge_hint_time', { index: this.run.index, left: this.run.hTime, curLimit: this.curLimit })
          this.app.toast(`本题时间 +${add} 秒`)
        }
        return
      }
      if (!this.app.ads.isReal()) return this.app.toast('延时道具即将开放')
      const r2 = await this.app.ads.showRewardAd('hintTime')
      if (r2.rewarded) this.app.toast(svc.addHintTime(this.run) ? '获得 1 个延时' : '获取失败')
      else if (r2.tooFrequent) this.app.toast('广告刚刚看过，稍等一下吧')
    }
  }

  /** 答题中看广告 +1 生命（仅广告可用时显示入口） */
  async onAddHeart() {
    if (this.phase !== 'answer' || this.done) return
    const svc = this.app.challenges
    if (this.run.hearts >= this.app.config.CHALLENGE.MAX_LIVES_CAP) return this.app.toast('生命已满')
    const r = await this.app.ads.showRewardAd('heart')
    if (r.rewarded) {
      svc.addHeart(this.run)
      this.app.toast('生命 +1')
    } else if (r.tooFrequent) {
      this.app.toast('广告刚刚看过，稍等一下吧')
    }
  }

  update(dt) {
    super.update(dt)
    if (this.phase === 'answer' && this.remainSec() <= 0) {
      this.onTimeout()
      return
    }
    if (this.phase === 'reveal' && Date.now() >= this.revealNextAt) {
      const svc = this.app.challenges
      if (!this.lastCorrect && this.run.hearts <= 0) {
        this.finish(false)
        return
      }
      const hasMore = svc.advanceRun(this.run)
      if (hasMore) {
        this.phase = 'answer'
        this.selected = null
        this.timedOut = false
        this.curLimit = this.limit // 每题重置倒计时（延时只对本题生效）
        this.qStart = Date.now()
        this.app.analytics.log('challenge_question_show', { index: this.run.index, hearts: this.run.hearts })
      } else {
        this.finish(true) // 答穿整条题序（极难），通关
      }
    }
  }

  finish(cleared) {
    if (this.done) return
    this.done = true
    const finishedAt = Date.now()
    const payload = this.app.challenges.buildPayload({
      answers: this.run.answers,
      startedAt: this.run.startedAt,
      finishedAt,
      reviveCount: this.run.reviveCount,
      runSeed: this.run.runSeed,
      doneAtStart: this.run.doneAtStart
    })
    this.app.progress.recordChallengeResult({ score: payload.score, correctCount: payload.correctCount })
    this.app.analytics.log('challenge_finish', {
      challengeId: payload.challengeId,
      score: payload.score,
      correctCount: payload.correctCount,
      wrongCount: payload.wrongCount,
      reviveCount: payload.reviveCount,
      cleared
    })
    const newly = this.app.achievements.evaluate()
    this.app.go('result', {
      payload,
      cleared,
      revivedCount: this.run.reviveCount,
      canRevive: this.run.reviveCount < this.app.config.CHALLENGE.MAX_REVIVE_PER_GAME,
      achievementToast: newly.length ? `${newly[0].emoji} ${newly[0].name}` : ''
    }, { replace: true })
  }

  drawHearts(c, x, y) {
    const cap = this.app.config.CHALLENGE.START_LIVES
    const total = Math.max(cap, this.run.hearts)
    c.textBaseline = 'middle'
    c.font = '600 16px ' + T.FONT.family
    c.textAlign = 'left'
    // 真机上 ❤️(U+2764+U+FE0F) 的变体符常无字形、渲染成豆腐块；
    // 改用单码点 ♥(U+2665) + fillStyle 着色，跨端一致、稳定。
    let cx = x
    for (let i = 0; i < total; i++) {
      const alive = i < this.run.hearts
      c.fillStyle = alive ? T.COLORS.red : '#D8E0E8'
      const ch = '♥'
      c.fillText(ch, cx, y)
      cx += c.measureText(ch).width + 6
    }
    c.fillStyle = T.COLORS.ink
    c.textBaseline = 'top'
    return cx - x
  }

  /** 顶部道具栏中的单个道具按钮 */
  drawProp(c, kind, x, y, w, h) {
    const META = {
      50: { short: '减半', icon: '🎯', left: this.run.h50, bg: '#E9F3FF', border: T.COLORS.primary, fg: T.COLORS.primaryDeep },
      answer: { short: '答案', icon: '✨', left: this.run.hAnswer, bg: '#E4F7F4', border: T.COLORS.teal, fg: '#0E857D' },
      time: { short: '延时', icon: '⏰', left: this.run.hTime, bg: '#FFF3E2', border: '#F5A623', fg: '#B26A00' }
    }
    const m = META[kind]
    const realAd = this.app.ads.isReal()
    const disabled = this.phase !== 'answer'
    let bg = '#FFFFFF'
    let border = T.COLORS.line
    let fg = T.COLORS.faint
    if (m.left > 0) {
      bg = m.bg
      border = m.border
      fg = m.fg
    }
    c.save()
    if (disabled) c.globalAlpha = 0.5
    this.app.ui.fillRoundRect(c, x, y, w, h, 10, bg)
    this.app.ui.strokeRoundRect(c, x, y, w, h, 10, border, 1.4)
    const label = m.left > 0
      ? `${m.icon} ${m.short} ×${m.left}`
      : (realAd ? `🎬 ${m.short}` : `${m.icon} ${m.short} ×0`)
    this.app.ui.drawCenteredText(c, label, x + w / 2, y + h / 2 + 0.5, { size: 12.5, weight: '700', color: fg })
    c.restore()
    if (!disabled) {
      this.button({ x, y, w, h, type: 'none', onTap: () => this.onProp(kind) })
    }
  }

  drawTimer(c, x, y, w) {
    const ratio = Math.max(0, Math.min(1, this.remainSec() / this.curLimit))
    const color = ratio > 0.5 ? T.COLORS.teal : ratio > 0.25 ? '#F5A623' : T.COLORS.red
    this.app.ui.fillRoundRect(c, x, y, w, 8, 4, '#E7EDF4')
    if (ratio > 0) this.app.ui.fillRoundRect(c, x, y, Math.max(8, w * ratio), 8, 4, color)
    // 剩余秒数（使用延时后会显示本题总时长）
    c.textAlign = 'right'
    c.textBaseline = 'bottom'
    c.font = T.font('700', 12.5)
    c.fillStyle = ratio <= 0.25 ? T.COLORS.red : T.COLORS.sub
    c.fillText(`⏱ ${Math.ceil(this.remainSec())}s`, x + w, y - 3)
    c.textAlign = 'left'
    c.textBaseline = 'top'
  }

  drawOption(c, i, x, y, w, h) {
    const q = this.currentQ()
    const orig = this._perm && this._perm[i] != null ? this._perm[i] : i // 显示位 -> 原始下标
    const labels = q.type === 'judge' ? ['✓', '✕'] : ['A', 'B', 'C', 'D']
    let bg = T.COLORS.card
    let border = T.COLORS.line
    let badgeBg = '#EEF3F8'
    let badgeFg = T.COLORS.sub
    let dim = false
    if (this.phase === 'reveal') {
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
      if (this.isEliminated(orig) && orig !== q.answer && orig !== this.selected) dim = true
    } else if (this.isEliminated(orig)) {
      bg = '#F1F4F8'
      border = '#E3E9F0'
      badgeBg = '#E3E9F0'
      badgeFg = T.COLORS.faint
      dim = true
    }
    c.save()
    if (dim) c.globalAlpha = 0.4
    this.app.ui.fillRoundRect(c, x, y, w, h, T.RADIUS.md, bg)
    this.app.ui.strokeRoundRect(c, x, y, w, h, T.RADIUS.md, border, 1.5)
    this.app.ui.fillRoundRect(c, x + 12, y + h / 2 - 15, 30, 30, 15, badgeBg)
    this.app.ui.drawCenteredText(c, labels[i], x + 27, y + h / 2 + 0.5, { size: 15, weight: '700', color: badgeFg })
    c.font = T.font('normal', 16)
    const lines = this.app.ui.wrapLines(c, q.options[orig], w - 70, 16, 'normal')
    const totalH = lines.length * 22
    this.app.ui.drawText(c, q.options[orig], x + 54, y + (h - totalH) / 2, w - 68, { size: 16, color: T.COLORS.ink, lineHeight: 22 })
    if (this.phase === 'answer' && this.isEliminated(orig)) {
      c.strokeStyle = T.COLORS.faint
      c.lineWidth = 2
      c.beginPath()
      c.moveTo(x + 54, y + h / 2)
      c.lineTo(x + w - 18, y + h / 2)
      c.stroke()
    }
    c.restore()
  }

  render(c) {
    this.beginRender()
    const ui = this.app.ui
    const m = T.metrics
    const pad = this.app.pad()
    const cw = this.app.contentW()
    const q = this.currentQ()
    if (!q || this.done) return
    this._perm = this.permOf(q)

    this.app.drawHeader(c, '排名挑战')

    // 第一行：生命 / 题号 / 得分（三段式：左生命块、中题号、右得分）
    const infoY = this.app.headerH() - 2
    const rowCy = infoY + 11
    const heartsW = this.drawHearts(c, pad, rowCy)
    let leftEnd = pad + heartsW
    if (this.app.ads.isReal()) {
      this.button({ x: pad + heartsW + 2, y: infoY - 2, w: 34, h: 24, type: 'none', onTap: () => this.onAddHeart() })
      ui.drawCenteredText(c, '＋♥', pad + heartsW + 19, rowCy, { size: 12.5, weight: '700', color: T.COLORS.teal })
      leftEnd = pad + heartsW + 36
    }
    // 得分右对齐区预留宽度
    const scoreW = 64
    ui.drawText(c, `得分 ${this.liveScore()}`, this.app.w - pad - scoreW, infoY, scoreW, {
      size: 13, weight: '700', color: T.COLORS.primaryDeep, align: 'right'
    })
    // 题号在「生命块右侧 → 得分块左侧」之间居中，不与任何元素重叠
    const qLeft = leftEnd + 10
    const qRight = this.app.w - pad - scoreW - 6
    const qCx = Math.max(qLeft + 20, (qLeft + qRight) / 2)
    ui.drawCenteredText(c, `第 ${this.run.index + 1} 题`, qCx, rowCy, {
      size: 14, weight: '700', color: T.COLORS.ink
    })

    // 第二行：顶部道具栏（减半 / 正确答案 / 延时）
    const propY = infoY + 26
    const gap = 8
    const propW = (cw - gap * 2) / 3
    const propH = 34
    const kinds = ['50', 'answer', 'time']
    kinds.forEach((kind, i) => {
      this.drawProp(c, kind, pad + i * (propW + gap), propY, propW, propH)
    })

    // 第三行：倒计时条
    const timerY = propY + propH + 22
    this.drawTimer(c, pad, timerY, cw)

    // 题干
    const qy = timerY + 22
    c.font = T.font('700', 19)
    const qLines = ui.wrapLines(c, q.question, cw - 36, 19, '700')
    let extra = 0
    if (q.scenario) {
      c.font = T.font('normal', 14)
      extra = ui.wrapLines(c, q.scenario, cw - 52, 14, 'normal').length * 21 + 12
    }
    const qh = 24 + qLines.length * 28 + extra + 18
    ui.card(c, pad, qy, cw, qh, T.RADIUS.lg)
    let iy = qy + 18
    if (q.scenario) {
      c.font = T.font('normal', 14)
      const sLines = ui.wrapLines(c, q.scenario, cw - 52, 14, 'normal')
      const sh = sLines.length * 21 + 12
      ui.fillRoundRect(c, pad + 18, iy - 4, cw - 36, sh, 8, '#F3F8FF')
      ui.drawText(c, '📍 ' + q.scenario, pad + 26, iy + 2, cw - 52, { size: 14, color: T.COLORS.primaryDeep, lineHeight: 21 })
      iy += sh + 10
    }
    ui.drawText(c, q.question, pad + 18, iy, cw - 50, { size: 19, weight: '700', color: T.COLORS.ink, lineHeight: 28 })

    // 选项
    const optH = 50
    const optGap = 10
    const optY0 = qy + qh + 12
    q.options.forEach((_, i) => {
      const oy = optY0 + i * (optH + optGap)
      this.drawOption(c, i, pad, oy, cw, optH)
      if (this.phase === 'answer' && !this.isEliminated(this._perm[i])) {
        this.button({ x: pad, y: oy, w: cw, h: optH, type: 'none', onTap: () => this.choose(i) })
      }
    })

    // 判题瞬间的轻提示
    if (this.phase === 'reveal') {
      const txt = this.lastCorrect
        ? '知道了！'
        : (this.timedOut ? '时间到！' : (this.run.hearts > 0 ? '原来如此！' : '生命耗尽！'))
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.font = T.font('800', 24)
      c.fillStyle = this.lastCorrect ? T.COLORS.green : T.COLORS.red
      c.fillText(this.lastCorrect ? '✅ ' + txt : '❌ ' + txt, this.app.w / 2, this.app.h - m.safeBottom - 34)
      c.textAlign = 'left'
      c.textBaseline = 'top'
    }
  }
}

module.exports = ChallengeScene
