/**
 * 排行榜服务：云端可用时走 CloudBase（权威校验 + 全局今日榜）；
 * 未开启云开发时返回“本地预览数据”，并且绝不给玩家伪造名次或写入成绩
 * （对应设计文档：无网络不得伪造排行榜成绩）。
 */
const cloud = require('./cloud')
const challenges = require('./challenges')
const util = require('../utils/util')
const config = require('../config/index.js')

const BOT_NAMES = [
  '知识达人', '小明', '小王', '小李', '小张', '好奇猫', '天天向上', '答案捕手',
  '学习委员', '海盐苏打', '晨读的人', '十万个为什么', '小知', '阿基米德的浴缸',
  '错题终结者', '小博', '菠萝油王子', '认真的蜗牛', '信息差粉碎机', '小满'
]

function mode() {
  return cloud.isAvailable() ? 'cloud' : 'local'
}

/** 提交今日成绩；本地模式只返回 submitted:false，不伪造排名 */
async function submit(payload) {
  if (cloud.isAvailable()) {
    const result = await cloud.callFunction('submitScore', payload)
    return { mode: 'cloud', ...(result || {}) }
  }
  return { mode: 'local', submitted: false }
}

async function getBoard() {
  if (cloud.isAvailable()) {
    try {
      const result = await cloud.callFunction('getLeaderboard', {
        challengeId: challenges.todayId(),
        limit: 50
      })
      return { mode: 'cloud', ...(result || { list: [], myRank: null }) }
    } catch (e) {
      return { mode: 'cloud-error', list: [], myRank: null, error: String(e && e.message) }
    }
  }
  // 虚拟预览榜仅用于开发联调（DEBUG 开启时）；发布版云未开启时返回空榜，不伪造任何玩家
  const showPreview = config.APP.DEBUG && config.CLOUD.SHOW_PREVIEW_BOARD_WHEN_LOCAL
  return {
    mode: 'local',
    preview: showPreview,
    challengeId: challenges.todayId(),
    list: showPreview ? previewList() : [],
    mine: null,
    myRank: null
  }
}

/** 基于日期确定性生成预览榜单（仅开发联调用，名字/分数都是虚拟的） */
function previewList() {
  const seedStr = 'board_' + challenges.todayId()
  const rng = util.seeded(util.hashStr(seedStr))
  const names = util.shuffle(BOT_NAMES.slice(), rng)
  const list = []
  let score = 990
  for (let i = 0; i < names.length; i++) {
    score = Math.max(520, score - Math.floor(rng() * 28))
    const correctCount = Math.max(5, Math.min(10, Math.round(score / 100)))
    list.push({
      rank: i + 1,
      nickname: names[i],
      avatar: '',
      score,
      correctCount,
      isBot: true
    })
  }
  return list
}

module.exports = { mode, submit, getBoard }
