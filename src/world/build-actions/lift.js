// lift — груз висит на крюке крана; ребёнок переносит его на подсвеченное место.
import { DragAction } from './common.js';

const TIP_Y = 130;

export class LiftAction extends DragAction {
  source() { return { x: 330, y: 300 }; }
  fallbackSpot(i) {
    const n = this.repeats;
    return { x: Math.round(520 + (i + 0.5) * 380 / n), y: 440 };
  }
  itemSize() { return { w: 140, h: 60 }; }
  minY() { return TIP_Y + 60; }
  drawPile() {}
  // стрела дорисовывается от рабочей части в позе idle — поза не меняется
  drawMachineBase(g) {
    const r = this.homeRect();
    if (r) this.drawMachine(g, r, 'idle');
  }
  drawItem(g, x, y, alpha = 1) {
    const s = this.itemSize();
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = '#9aa0a6';
    g.fillRect(x - s.w / 2, y - s.h / 2, s.w, s.h);
    g.fillStyle = '#7d838a';
    g.fillRect(x - s.w / 2, y + s.h / 2 - 10, s.w, 10);
    g.fillStyle = '#c9ced4';
    g.fillRect(x - s.w / 2 + 14, y - s.h / 2 + 10, 34, 22);
    g.fillRect(x + s.w / 2 - 48, y - s.h / 2 + 10, 34, 22);
    g.restore();
  }
  // Откуда растёт стрела: конец рабочей части машины (стрела, крюк) по её данным; иначе верх справа.
  pivot(r) {
    const m = this.env.machine;
    const p = m && (m.parts || []).find((q) => q.id === m.workPart);
    if (!p || !m.size) return { x: r.x + r.w * 0.9, y: r.y + r.h * 0.1 };
    const k = r.w / m.size.w;
    return { x: r.x + (p.x + p.w * 0.9) * k, y: r.y + (p.y + Math.min(p.h / 2, 25)) * k };
  }
  // стрела крана от машины к точке над грузом, трос и крюк
  drawCarrier(g) {
    const s = this.itemSize();
    const top = this.item.y - s.h / 2;
    const r = this.homeRect();
    g.save();
    g.lineCap = 'round';
    if (r) {
      const { x: px, y: py } = this.pivot(r);
      g.strokeStyle = '#f2b51c'; g.lineWidth = 16;
      g.beginPath(); g.moveTo(px, py); g.lineTo(this.item.x, TIP_Y); g.stroke();
      g.strokeStyle = '#c98f0a'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(px, py); g.lineTo(this.item.x, TIP_Y); g.stroke();
    }
    // кран на объекте (env.onSite): трос спускается из-за верхнего края экрана (у крестика — пониже)
    const ropeTop = r || !this.env.onSite ? TIP_Y : this.item.x < 130 ? 104 : -10;
    g.strokeStyle = '#333'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(this.item.x, ropeTop); g.lineTo(this.item.x, top - 16); g.stroke();
    // крюк
    g.strokeStyle = '#555'; g.lineWidth = 6;
    g.beginPath(); g.arc(this.item.x, top - 8, 9, Math.PI * 1.1, Math.PI * 2.1); g.stroke();
    g.beginPath(); g.moveTo(this.item.x - 30, top); g.lineTo(this.item.x, top - 12); g.lineTo(this.item.x + 30, top); g.stroke();
    g.restore();
  }
}
