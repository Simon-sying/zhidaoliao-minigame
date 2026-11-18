/**
 * 场景基类：统一管理“每帧重建的按钮”和“持久化的滚动列表”，以及触摸命中。
 *  - 按钮无状态，可在 render 中每帧创建（位置稳定即可）；
 *  - ScrollView 必须在 onEnter 创建一次（保存 offset/惯性），render 中只 draw。
 */
const { Button, ScrollView } = require('../core/ui')
const pf = require('../core/platform')

class BaseScene {
  constructor(app) {
    this.app = app
    this._btns = []
    this._scrolls = []
    this._down = null
    this._activeScroll = null
  }

  onEnter() {}
  onResume() {}

  /** 在 render 开头调用，清空本帧按钮（滚动列表不清） */
  beginRender() {
    this._btns = []
  }
  button(o) {
    const b = new Button(o)
    this._btns.push(b)
    return b
  }
  addScroll(o) {
    const sv = new ScrollView(o)
    this._scrolls.push(sv)
    return sv
  }

  scrollAt(x, y) {
    return this._scrolls.find((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h)
  }
  buttonAt(x, y, requireEnabled) {
    for (let i = this._btns.length - 1; i >= 0; i--) {
      const b = this._btns[i]
      if (b.contains(x, y) && (!requireEnabled || !b.disabled)) return b
    }
    return null
  }

  onTouchStart(x, y) {
    const sv = this.scrollAt(x, y)
    if (sv) {
      this._activeScroll = sv
      sv.onTouchStart(x, y)
      return
    }
    this._down = { x, y }
  }
  onTouchMove(x, y) {
    if (this._activeScroll) this._activeScroll.onTouchMove(x, y)
  }
  onTouchEnd(x, y) {
    if (this._activeScroll) {
      this._activeScroll.onTouchEnd(x, y)
      this._activeScroll = null
      return
    }
    if (this._down) {
      const dist = Math.hypot(x - this._down.x, y - this._down.y)
      if (dist < 14) {
        const b = this.buttonAt(x, y, true)
        if (b && b.contains(this._down.x, this._down.y)) {
          pf.vibrate('short')
          b.onTap && b.onTap()
        }
      }
      this._down = null
    }
  }

  update(dt) {
    this._scrolls.forEach((s) => s.update(dt))
  }
}

module.exports = BaseScene
