// paint — закрасить пальцем: ведёт валик змейкой по объекту.
import { TraceAction, densify } from './common.js';

const ROWS = [424, 484, 544];
const X0 = 480, X1 = 920;

export class PaintAction extends TraceAction {
  makePath() {
    const pts = [];
    ROWS.forEach((y, i) => {
      if (i % 2 === 0) pts.push({ x: X0, y }, { x: X1, y });
      else pts.push({ x: X1, y }, { x: X0, y });
    });
    return densify(pts, 50);
  }
  movingRect() { return null; }
  backTime() { return 0.5; }
  onStep() { this.play('fx/foam'); }
  drawTrail(g) {
    if (this.done || this.pos <= 0) return;
    g.save();
    g.strokeStyle = 'rgba(92,200,255,0.55)';
    g.lineWidth = 56; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length && this.len[i] <= this.pos; i++) g.lineTo(this.path[i].x, this.path[i].y);
    const p = this.pointAt(this.pos);
    g.lineTo(p.x, p.y);
    g.stroke();
    g.restore();
  }
  draw(g) {
    const r = this.homeRect();
    if (r) this.drawMachine(g, r, 'idle');
    super.draw(g);
  }
  // валик на ручке
  drawTool(g, x, y) {
    g.save();
    g.strokeStyle = '#8a5a3c'; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 22, y + 60); g.stroke();
    g.fillStyle = '#5cc8ff';
    g.fillRect(x - 34, y - 14, 68, 28);
    g.strokeStyle = '#ffffff'; g.lineWidth = 3;
    g.strokeRect(x - 34, y - 14, 68, 28);
    g.restore();
  }
}
