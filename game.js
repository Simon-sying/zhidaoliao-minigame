/**
 * 《知识到了》小游戏入口
 * 原生微信小游戏（无引擎、无第三方依赖、CommonJS），单一全屏 Canvas 自绘 UI。
 * 注意：小游戏运行时没有小程序的 App()/Page() 全局，入口只需创建并启动应用。
 */
const { createApp } = require('./src/core/app')

const app = createApp()
module.exports = app

try {
  app.start()
} catch (e) {
  // 启动期异常直接打到调试器，避免只看到黑屏不好排查
  console.error('[知识到了] 启动失败：', (e && e.stack) || e)
}
