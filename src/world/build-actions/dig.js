// dig — тык в экскаватор: один тык — один ковш.
import { TapAction, GROUND } from './common.js';

export class DigAction extends TapAction {
  get duration() { return 1.0; }
  onTap() {
    this.play('fx/dig');
    const r = this.hitRect();
    this.burst(r.x + r.w + 50, GROUND - 10, 9, '#8a5a3c', { vx: -140, up: 320, floor: GROUND - 4, life: 1 });
  }
  pose(t) {
    const work = t < 0.75;
    return { dx: work ? Math.sin(t * 40) * 2 : 0, dy: 0, pose: work ? 'work' : 'idle' };
  }
}
