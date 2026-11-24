// line — вести пальцем по пунктиру: разметка остаётся белыми штрихами.
import { TraceAction, GROUND, densify } from './common.js';

const Y = GROUND - 8;

export class LineAction extends TraceAction {
  makePath() { return densify([{ x: 440, y: Y }, { x: 970, y: Y }], 50); }
  movingRect() { return null; }
  backTime() { return 0.5; }
  onStep() { this.play('fx/snap'); }
  drawTrail(g) {
    if (this.done || this.pos <= 0) return;
    const p = this.pointAt(this.pos);
    g.fillStyle = '#ffffff';
    for (let x = this.path[0].x; x < p.x; x += 50) g.fillRect(x, Y - 5, Math.min(30, p.x - x), 10);
  }
  draw(g) {
    const r = this.homeRect();
    if (r) this.drawMachine(g, r, 'idle');
    super.draw(g);
  }
  // кисточка
  drawTool(g, x, y) {
    g.save();
    g.strokeStyle = '#8a5a3c'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + 6, y - 20); g.lineTo(x + 30, y - 80); g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(x - 10, y - 26, 22, 26);
    g.restore();
  }
}
