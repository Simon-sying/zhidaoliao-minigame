const BaseScene = require('./base')
const T = require('../core/theme')

class ResultScene extends BaseScene {
  onEnter(params) {
    this.payload = params.payload
    this.cleared = !!params.cleared
    this.canRevive = params.canRevive !== false
    this.achievementToast = params.achievementToast || ''
    this.status = 'loading' // loading | done
    this.submitInfo = { mode: 'local', submitted: false, rank: null, reason: '', error: '' }
    if (this.achievementToast) {
      setTimeout(() => this.app.toast(`解锁成就：${this.achievementToast}`), 400)
    }
    this.submit()
  }

  async submit() {
    this.status = 'loading'
    const available = await this.app.cloud.init()
    try {
      if (available) {
        const res = await this.app.leaderboard.submit(this.payload)
        if (res && res.ok !== false && (res.rank || res.submitted || res.recordId)) {
          this.submitInfo = {
            mode: 'cloud',
            submitted: true,
            rank: typeof res.rank === 'number' ? res.rank : null,
            correctCount: typeof res.correctCount === 'number' ? res.correctCount : this.payload.correctCount,
            score: res.score,
            reason: res.reason || '',
            recordId: res.recordId || ''
          }
          this.app.progress.setCloudSubmitted({ id: res.recordId || '', rank: this.submitInfo.rank })
        } else {
          this.submitInfo = { mode: 'cloud', submitted: false, rank: null, reason: (res && res.reason) || '提交未通过校验', error: (res && res.error) || '' }
        }
      } else {
        this.submitInfo = { mode: 'local', submitted: false, rank: null, reason: 'cloud_off' }
      }
    } catch (e) {
      this.submitInfo = { mode: 'cloud', submitted: false, rank: null, reason: 'error', error: String(e && e.message) }
    }
    this.status = 'done'
    this.app.analytics.log('leaderboard_submit_result', this.submitInfo)
  }

  /** 看广告复活，续上本局从下一题继续（仅广告真实可用） */
  async revive() {
    if (!this.canRevive || !this.app.ads.isReal()) return
    this.app.analytics.log('ad_request', { scene: 'retry' })
    const r = await this.app.ads.showRewardAd('retry')
    this.app.analytics.log(r.rewarded ? 'ad_reward' : 'ad_close', { scene: 'retry' })
    if (!r.rewarded) {
      if (r.tooFrequent) this.app.toast('广告刚刚看过，稍等一下吧')
      return
    }
    const run = this.app.challenges.reviveRun()
    if (!run) {
      this.app.toast('本局复活次数已用完')
      return
    }
    this.app.progress.markReviveUsed()
    this.app.analytics.log('challenge_start', { challengeId: this.payload.challengeId, revive: true })
    this.app.go('challenge', { resume: true }, { replace: true })
  }

  /** 免费另开一局 */
  restart() {
    this.app.challenges.startRun()
    this.app.progress.markChallengePlayed()
    this.app.analytics.log('challenge_start', { challengeId: this.payload.challengeId, revive: false, restart: true })
    this.app.go('challenge', {}, { replace: true })
  }

  render(c) {
    this.beginRender()
    const ui = this.app.ui
    const m = T.metrics
    const pad = this.app.pad()
    const cw = this.app.contentW()
    const p = this.payload
    const correct = p.correctCount

    this.app.drawHeader(c, '今日成绩')
    let y = this.app.headerH() + 10

    // 主成绩卡：答对题数为核心
    const cardH = 208
    ui.card(c, pad, y, cw, cardH, T.RADIUS.lg)
    const emoji = this.cleared ? '🏆' : correct >= 20 ? '🔥' : correct >= 10 ? '🎯' : '💪'
    c.font = '600 48px ' + T.FONT.family
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(emoji, this.app.w / 2, y + 46)
    c.textAlign = 'left'

    ui.drawText(c, `${correct}`, 0, y + 74, this.app.w - 30, { size: 50, weight: '800', color: this.cleared ? T.COLORS.teal : T.COLORS.primary, align: 'center' })
    ui.drawText(c, '题', this.app.w / 2 + 34, y + 104, 40, { size: 15, color: T.COLORS.faint, align: 'left' })

    const sub = this.cleared
      ? '太强了，你答穿了今日题序！'
      : `三条生命用尽，答对 ${correct} 题，再来一局冲更远？`
    ui.drawText(c, sub, pad + 20, y + 140, cw - 40, { size: 14, color: T.COLORS.sub, align: 'center', lineHeight: 20 })

    // 三项小数据
    const statY = y + 178
    const stats = [
      { k: '总得分', v: `${p.score}` },
      { k: '答错', v: `${p.wrongCount} 题` },
      { k: '用时', v: `${p.durationSec}s` }
    ]
    stats.forEach((s, i) => {
      const sx = pad + (cw / 3) * i
      c.textAlign = 'center'
      c.font = T.font('700', 16)
      c.fillStyle = T.COLORS.ink
      c.fillText(s.v, sx + cw / 6, statY)
      c.font = T.font('normal', 11.5)
      c.fillStyle = T.COLORS.faint
      c.fillText(s.k, sx + cw / 6, statY + 20)
      c.textAlign = 'left'
    })

    y += cardH + 12

    // 排名 / 提交状态
    let statusText
    let statusColor
    if (this.status === 'loading') {
      statusText = '☁️ 正在提交成绩并计算排名…'
      statusColor = T.COLORS.sub
    } else if (this.submitInfo.submitted) {
      const cc = this.submitInfo.correctCount
      statusText = this.submitInfo.rank
        ? `🎉 提交成功！你答对 ${cc} 题，今日榜排第 ${this.submitInfo.rank} 名`
        : `🎉 成绩已提交，答对 ${cc} 题`
      statusColor = '#15803F'
    } else if (this.submitInfo.mode === 'local') {
      statusText = this.app.config.APP.DEBUG
        ? '当前为本地模式（云开发未开启或无网络）：可正常答题，但本次成绩不进入排行榜，也不会生成名次。'
        : '成绩已保存在本机。每日排行榜即将开放，开启后即可参与全国排名。'
      statusColor = '#B0740A'
    } else {
      statusText = '成绩暂未通过云端校验或提交失败，本次未进入排行榜。可在网络正常时再挑战一次。'
      statusColor = T.COLORS.red
    }
    c.font = T.font('500', 13)
    const stLines = ui.wrapLines(c, statusText, cw - 40, 13, '500')
    const stH = stLines.length * 20 + 20
    ui.fillRoundRect(c, pad, y, cw, stH, T.RADIUS.md, this.submitInfo.submitted ? T.COLORS.greenSoft : '#FFF7E8')
    ui.drawText(c, statusText, pad + 20, y + 10, cw - 40, { size: 13, weight: '500', color: statusColor, lineHeight: 20 })
    y += stH + 12

    // 按钮
    const bx = pad + 20
    const bw = cw - 40
    if (this.status === 'done' && this.canRevive) {
      if (this.app.ads.isReal()) {
        this.button({ x: bx, y, w: bw, h: 50, emoji: '🎬', text: '看视频复活 · 继续本局', type: 'teal', fontSize: 16.5, onTap: () => this.revive() }).draw(c)
      } else {
        this.button({ x: bx, y, w: bw, h: 50, emoji: '🎬', text: '复活续关即将开放', type: 'gray', fontSize: 16, disabled: true }).draw(c)
      }
      y += 60
    }
    this.button({ x: bx, y, w: bw, h: 48, emoji: '🔁', text: '再来一局', type: 'primary', fontSize: 16, onTap: () => this.restart() }).draw(c)
    y += 56
    this.button({ x: bx, y, w: bw, h: 46, emoji: '📊', text: '查看今日排行榜', type: 'gray', fontSize: 15.5, onTap: () => this.app.go('leaderboard') }).draw(c)
    y += 54
    this.button({ x: bx, y, w: bw, h: 44, emoji: '🏠', text: '返回首页', type: 'ghost', fontSize: 15, onTap: () => this.app.go('home', {}, { replace: true }) }).draw(c)
  }
}

module.exports = ResultScene
