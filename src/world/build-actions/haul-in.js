// haul-in — тык в машину: она подъезжает к площадке, высыпает или выгружает и возвращается.
import { TapAction, GROUND, easeInOut } from './common.js';

const FWD = 180;

export class HaulInAction extends TapAction {
  get duration() { return 2.2; }
  onTap() {
    if (this.env.machine) this.play('engine/' + this.env.machine.id);
  }
  onAnim(from, to) {
    if (from < 0.8 && to >= 0.8) {
      this.play('fx/dig');
      const r = this.hitRect();
      const dx = this.env.machine ? FWD : 0;
      this.burst(r.x + dx + r.w + 30, r.y + r.h * 0.35, 14, '#e2b65a', { vx: 40, vxs: 120, up: 60, floor: GROUND - 4, life: 1.3 });
    }
  }
  pose(t) {
    let dx;
    if (t < 0.7) dx = FWD * easeInOut(t / 0.7);
    else if (t < 1.5) dx = FWD;
    else dx = FWD * (1 - easeInOut((t - 1.5) / 0.7));
    return { dx, dy: 0, pose: t >= 0.7 && t < 1.5 ? 'work' : 'idle' };
  }
}
