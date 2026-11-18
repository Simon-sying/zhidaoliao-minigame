// 登录：用微信上下文换取 openid，并在 users 集合做一次 upsert。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return { ok: false, reason: 'no_openid' }

  const now = db.serverDate()
  const users = db.collection('users')
  const found = await users.where({ _id: openid }).count()
  if (found.total === 0) {
    await users.add({
      data: {
        _id: openid,
        nickname: '',
        avatar: '',
        createTime: now,
        lastLoginTime: now,
        totalPlayCount: 0,
        totalQuestionCount: 0
      }
    })
  } else {
    await users.doc(openid).update({ data: { lastLoginTime: now } })
  }
  return { ok: true, openid }
}
