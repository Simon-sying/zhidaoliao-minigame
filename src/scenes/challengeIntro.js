const BaseScene = require('./base')
const T = require('../core/theme')

class ChallengeIntroScene extends BaseScene {
  onEnter() {
    this.app.analytics.log('challenge_intro_show')
    this.state = this.app.progress.getChallengeState()
  }
  onResume() {
    this.state = this.app.progress.getChallengeState()
  }

  start() {
    this.app.challenges.startRun()
    this.app.progress.markChallengePlayed()
    this.app.analytics.log('challenge_start', { challengeId: this.app.challenges.todayId(), revive: false })
    this.app.go('challenge')
  }

  // 另开一局始终免费（广告只用于“复活续关 / 提示 / 加命”，不强迫看广告才能玩）
  startAgain() {
    this.start()
  }

  render(c) {
    this.beginRender()
    const ui = this.app.ui
    const m = T.metrics
    const pad = this.app.pad()
    const cw = this.app.contentW()
    const ch = this.state

    this.app.drawHeader(c, '无尽排名挑战')
    let y = this.app.headerH() + 6

    let desc = '所有玩家今天按同一套题序无限闯关。每题 25 秒倒计时，答对继续，答错或超时扣除一条生命，三条生命耗尽即结算——看谁答对得最多、又快又准。'
    let descColor = T.COLORS.sub
    if (ch.played) {
      if (ch.cloudRank) desc = `今天已挑战。最佳答对 ${ch.bestCorrect || 0} 题（${ch.bestScore || 0} 分），云端第 ${ch.cloudRank} 名。`
      else desc = `今天已挑战，最佳答对 ${ch.bestCorrect || 0} 题（${ch.bestScore || 0} 分）。每天只取你的最好成绩上榜。`
      descColor = T.COLORS.ink
    }
    const rules = [
      '∞ 题目无限，全体同一题序，看你闯到第几题',
      '⏱ 每题 25 秒倒计时，超时按答错处理',
      '♥ 三条生命，答错或超时扣一条，归零立即结算',
      '🎯 每局 2 个「减半」：排除两个错误选项',
      '✨ 每局 1 个「正确答案」：直接锁定，不加速分',
      '⏰ 每局 1 个「延时」：本题倒计时再加 10 秒',
      '🎬 命尽可看视频复活续关（广告开放后生效）'
    ]
    // 卡片高度随描述行数与规则条数自适应，避免文字溢出容器
    c.font = T.font('normal', 13.5)
    const dLines = ui.wrapLines(c, desc, cw - 40, 13.5, 'normal')
    const cardH = 52 + dLines.length * 20 + 12 + rules.length * 22 + 16

    ui.card(c, pad, y, cw, cardH, T.RADIUS.lg)
    ui.drawText(c, '🏆 今日挑战', pad + 20, y + 20, cw - 40, { size: 20, weight: '800', color: T.COLORS.ink })
    ui.drawText(c, desc, pad + 20, y + 52, cw - 40, { size: 13.5, color: descColor, lineHeight: 20 })
    const ruleY = y + 52 + dLines.length * 20 + 12
    rules.forEach((r, i) => {
      ui.drawText(c, r, pad + 20, ruleY + i * 22, cw - 40, { size: 12.8, color: T.COLORS.sub })
    })

    // 按钮区
    const btnW = cw - 40
    const bx = pad + 20
    const by = this.app.h - m.safeBottom - 196

    if (!ch.played) {
      this.button({ x: bx, y: by, w: btnW, h: 54, emoji: '🚀', text: '开始今日挑战', type: 'primary', fontSize: 18, onTap: () => this.start() }).draw(c)
      ui.drawText(c, '全体公平同题序，每天只取最佳成绩', 0, by + 62, this.app.w, { size: 11.5, color: T.COLORS.faint, align: 'center' })
    } else {
      this.button({ x: bx, y: by, w: btnW, h: 54, emoji: '🔁', text: '再挑战一次', type: 'teal', fontSize: 17, onTap: () => this.startAgain() }).draw(c)
      ui.drawText(c, '每天可反复挑战，只取最佳成绩；命尽时可看视频复活续关', 0, by + 62, this.app.w, { size: 11.5, color: T.COLORS.faint, align: 'center' })
      this.button({ x: bx, y: by + 90, w: btnW, h: 48, emoji: '📊', text: '查看今日排行榜', type: 'gray', fontSize: 15.5, onTap: () => this.app.go('leaderboard') }).draw(c)
    }

    this.button({ x: bx, y: this.app.h - m.safeBottom - 62, w: btnW, h: 46, emoji: '📖', text: '先去休闲刷题热身', type: 'ghost', fontSize: 15, onTap: () => this.app.go('casual') }).draw(c)
  }
}

module.exports = ChallengeIntroScene
