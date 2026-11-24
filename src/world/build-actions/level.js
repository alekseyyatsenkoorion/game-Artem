// level — бульдозер или грейдер: ребёнок ведёт машину пальцем по площадке, бугры исчезают.
import { TraceAction, GROUND } from './common.js';

export class LevelAction extends TraceAction {
  onStep() { this.play('fx/dig'); }
  drawTrail(g) {
    const m = this.movingRect();
    const front = m ? m.x + m.w - 30 : this.pointAt(this.pos).x;
    if (this.done) return;
    g.fillStyle = '#9b6b45';
    const a = this.area();
    for (let x = a.x0 + 10; x <= a.x1 + 20; x += 88) {
      if (x < front) continue;
      g.beginPath(); g.ellipse(x, GROUND, 40, 22, 0, Math.PI, 0); g.fill();
    }
  }
  drawTool(g, x, y) {
    g.fillStyle = '#f2c14e';
    g.fillRect(x - 40, y - 20, 80, 40);
  }
}
