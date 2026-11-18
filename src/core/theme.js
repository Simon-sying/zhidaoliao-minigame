/**
 * 视觉主题：年轻 / 干净 / 轻松 / 知识感。
 * 颜色纪律（来自设计文档）：绿只用于正确、红只用于错误、黄用于知识提示。
 */
const COLORS = {
  primary: '#1F8FFF', // 明亮蓝
  primaryDeep: '#0E6FD6',
  teal: '#12B3A8', // 青绿
  bg: '#F3F7FB',
  card: '#FFFFFF',
  ink: '#1C2A3A', // 主文字
  sub: '#6A7B8C', // 次要文字
  faint: '#9AA9B7',
  line: '#E6EDF4',
  yellow: '#F5A623', // 知识提示
  yellowSoft: '#FFF4DE',
  green: '#20B55B', // 正确
  greenSoft: '#E7F8EE',
  red: '#EF4D4D', // 错误
  redSoft: '#FDECEC',
  white: '#FFFFFF',
  mask: 'rgba(20, 34, 51, 0.45)'
}

const RADIUS = { sm: 8, md: 14, lg: 22, pill: 999 }
const SPACE = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 }

// 运行时布局度量（由 app.init 注入屏幕尺寸 / dpr / 安全区）
const metrics = {
  dpr: 1,
  width: 375,
  height: 667,
  safeTop: 20,
  safeBottom: 0,
  contentPad: 20
}

const FONT = {
  family: '-apple-system, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif'
}

function font(weight, size) {
  return `${weight || 'normal'} ${size}px ${FONT.family}`
}

module.exports = { COLORS, RADIUS, SPACE, metrics, FONT, font }
