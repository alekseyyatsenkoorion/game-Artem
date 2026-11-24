// stack — перетаскивать ряды кирпичей: каждый следующий ряд ложится выше.
import { DragAction } from './common.js';

export class StackAction extends DragAction {
  source() {
    const r = this.homeRect();
    if (r) return { x: Math.round(r.x + r.w / 2), y: Math.round(r.y - 50) };
    return { x: 220, y: 552 };
  }
  fallbackSpot(i) { return { x: 700, y: 574 - i * 46 }; }
  // ряды снизу вверх; если рядам тесно (низкая длинная часть: перила, секции) — секции слева направо
  splitAxis() {
    const b = this.env.box;
    return b && b.h / this.repeats >= 20 ? 'y' : 'x';
  }
  itemSize() { return { w: 160, h: 44 }; }
  drawItem(g, x, y, alpha = 1) {
    const s = this.itemSize();
    const x0 = x - s.w / 2, y0 = y - s.h / 2;
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = '#e8e1d5';
    g.fillRect(x0, y0, s.w, s.h);
    g.fillStyle = '#c8553d';
    const bw = 38, bh = 18;
    for (let row = 0; row < 2; row++) {
      const off = row ? bw / 2 : 0;
      for (let bx = -off; bx < s.w; bx += bw + 2) {
        const a = Math.max(0, bx), b = Math.min(s.w, bx + bw);
        if (b > a) g.fillRect(x0 + a, y0 + 3 + row * (bh + 2), b - a, bh);
      }
    }
    g.restore();
  }
}
