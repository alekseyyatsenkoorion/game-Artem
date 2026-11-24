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
    const k = clamp(1 - (front - (SITE.x - 140)) / 280, 0.12, 1);
    g.fillStyle = '#e2b65a';
    g.beginPath(); g.ellipse(SITE.x, GROUND, 150, 90 * k, 0, Math.PI, 0); g.fill();
    // разровненный слой позади
    const x0 = SITE.x - 160;
    if (front > x0) { g.fillStyle = '#e8c97a'; g.fillRect(x0, GROUND - 10, Math.min(front, SITE.x + 160) - x0, 12); }
  }
  drawTool(g, x, y) {
    g.fillStyle = '#f2c14e';
    g.fillRect(x - 40, y - 20, 80, 40);
  }
}
