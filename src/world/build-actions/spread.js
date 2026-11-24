// spread — машина едет по куче и разравнивает её.
import { TraceAction, GROUND, SITE, clamp } from './common.js';

export class SpreadAction extends TraceAction {
  onStep() {
    this.play('fx/dig');
    const p = this.pointAt(this.pos);
    this.burst(p.x + 60, GROUND - 10, 5, '#e2b65a', { up: 200, floor: GROUND - 4, life: 0.8 });
  }
  drawTrail(g) {
    if (this.done) return;
    const m = this.movingRect();
    const front = m ? m.x + m.w : this.pointAt(this.pos).x;
    // куча — посреди места новой части (env.box), иначе посреди площадки
    const a = this.area();
    const cx = this.env.box ? Math.round((a.x0 + a.x1) / 2) : SITE.x;
    const k = clamp(1 - (front - (cx - 140)) / 280, 0.12, 1);
    g.fillStyle = '#e2b65a';
    g.beginPath(); g.ellipse(cx, GROUND, 150, 90 * k, 0, Math.PI, 0); g.fill();
    // разровненный слой позади
    const x0 = cx - 160;
    if (front > x0) { g.fillStyle = '#e8c97a'; g.fillRect(x0, GROUND - 10, Math.min(front, cx + 160) - x0, 12); }
  }
  drawTool(g, x, y) {
    g.fillStyle = '#f2c14e';
    g.fillRect(x - 40, y - 20, 80, 40);
  }
}
