// haul-away — тык в гружёную машину: она увозит груз за край экрана и возвращается пустой.
import { TapAction, easeInOut } from './common.js';

export class HaulAwayAction extends TapAction {
  get duration() { return 2.0; }
  onTap() {
    if (this.env.machine) this.play('engine/' + this.env.machine.id);
  }
  pose(t) {
    const r = this.hitRect();
    const far = -(r.x + r.w + 40);
    let dx;
    if (t < 0.9) dx = far * easeInOut(t / 0.9);
    else if (t < 1.1) dx = far;
    else dx = far * (1 - easeInOut((t - 1.1) / 0.9));
    return { dx, dy: 0, pose: t < 1.0 ? 'work' : 'idle' };
  }
  draw(g) {
    // груз в кузове, пока машина не уехала
    super.draw(g);
    const r = this.homeRect();
    if (!r || this.anim >= 1.0 || this.done) return;
    const p = this.anim >= 0 ? this.pose(this.anim) : { dx: 0 };
    g.fillStyle = '#8a5a3c';
    g.beginPath();
    g.ellipse(r.x + p.dx + r.w * (this.env.mirror ? 0.7 : 0.3), r.y + r.h * 0.12, r.w * 0.2, r.h * 0.12, 0, Math.PI, 0);
    g.fill();
  }
}
