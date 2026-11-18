// 今日排行榜：取 Top N，并返回调用者自己的名次（若已提交）。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const COL = 'challenge_scores'

async function rankOf(challengeId, openid, score, correctCount, durationSec, serverTs) {
  const col = db.collection(COL)
  const queries = [
    { challengeId, correctCount: _.gt(correctCount) },
    { challengeId, correctCount, score: _.gt(score) },
    { challengeId, correctCount, score, durationSec: _.lt(durationSec) },
    { challengeId, correctCount, score, durationSec, serverTs: _.lt(serverTs) }
  ]
  let better = 0
  for (let i = 0; i < queries.length; i++) {
    const r = await col.where(queries[i]).count()
    better += r.total || 0
  }
  return better + 1
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const challengeId = String(event.challengeId || '').replace(/[^0-9]/g, '')
  if (!/^\d{8}$/.test(challengeId)) return { ok: false, reason: 'bad_challenge_id' }
  const limit = Math.min(50, Math.max(1, event.limit || 50))

  const res = await db
    .collection(COL)
    .where({ challengeId })
    .orderBy('correctCount', 'desc')
    .orderBy('score', 'desc')
    .orderBy('durationSec', 'asc')
    .orderBy('serverTs', 'asc')
    .limit(limit)
    .get()

  const list = res.data.map((d, i) => ({
    rank: i + 1,
    openid: d.openid,
    nickname: d.nickname || '',
    avatar: d.avatar || '',
    score: d.score,
    correctCount: d.correctCount
  }))

  let myRank = null
  let mine = null
  const mineRes = await db.collection(COL).where({ challengeId, openid: OPENID }).limit(1).get()
  const me = mineRes.data && mineRes.data[0]
  if (me) {
    myRank = await rankOf(challengeId, OPENID, me.score, me.correctCount, me.durationSec, me.serverTs)
    mine = { score: me.score, correctCount: me.correctCount, rank: myRank }
  }

  return { ok: true, challengeId, list, myRank, mine }
}
