// roll — каток: ребёнок ведёт его пальцем по полосе, позади остаётся гладкая укатанная полоса.
import { TraceAction, GROUND } from './common.js';

export class RollAction extends TraceAction {
  start(repeat) {
    super.start(repeat);
    if (this.env.machine) this.play('engine/' + this.env.machine.id);
  }
  drawTrail(g) {
    if (this.done) return;
    const x0 = this.path[0].x;
    const m = this.movingRect();
    const x1 = m ? m.x + m.w * 0.5 : this.pointAt(this.pos).x;
    g.fillStyle = '#7a7f87';
    g.fillRect(Math.max(400, x0), GROUND - 8, Math.max(0, x1 - Math.max(400, x0)), 14);
  }
  drawTool(g, x, y) {
    g.fillStyle = '#5d6977';
    g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.fill();
  }
}
