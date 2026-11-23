// Главный экран. Заготовка этапа 1: одна машина, тык — она заводится, гудит и едет на сборку.
// На этапе 2 переходит зоне «Карта и стройка» (три входа: карта, гараж, канат).
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand } from '../core/ui.js';
import contentData from '../data/index.js';

const GROUND_Y = 655;
const START_DELAY = 1.3;

export class HomeScene extends Scene {
  static id = 'home';

  static assets() {
    const m = contentData.machines[0];
    return ['bg/home', 'ui/hand', 'machine/' + m.id + '/whole/idle'];
  }

  enter() {
    this.machine = this.ctx.data.machines[0];
    const s = this.machine.size;
    this.x0 = Math.round((this.ctx.screen.width - s.w) / 2);
    this.y0 = GROUND_Y - s.h;
    this.x = this.x0;
    this.state = 'idle'; // idle | starting | arrive
    this.t = 0;
    this.stateT = 0;
    this.hint = new IdleHint();
  }

  _truckRect() {
    const s = this.machine.size;
    return { x: this.x - 30, y: this.y0 - 30, w: s.w + 60, h: s.h + 60 };
  }

  onPointer(e) {
    if (e.type !== 'down') return;
    this.hint.reset();
    const r = this._truckRect();
    const onTruck = e.x >= r.x && e.x <= r.x + r.w && e.y >= r.y && e.y <= r.y + r.h;
    if (this.state !== 'idle') return;
    if (onTruck) {
      this.state = 'starting';
      this.stateT = 0;
      this.ctx.audio.play('engine/' + this.machine.id);
      this.ctx.audio.play('horn/' + this.machine.id);
    } else {
      this.ctx.audio.play('horn/' + this.machine.id);
    }
  }

  onResult(result) {
    this.hint.reset();
    if (result && result.done) {
      // собранная машина приезжает обратно
      this.state = 'arrive';
      this.stateT = 0;
      this.x = -this.machine.size.w;
      this.ctx.audio.play('horn/' + this.machine.id);
    } else {
      this.state = 'idle';
      this.x = this.x0;
    }
  }

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    if (this.state === 'idle') {
      // главный экран — безопасная точка для родительского таймера
      if (this.ctx.timer.checkpoint()) return;
      if (this.hint.update(dt)) {
        this.ctx.audio.say(this.ctx.progress.isAssembled(this.machine.id) ? 'home-ready' : 'home-hint');
      }
    } else if (this.state === 'starting') {
      if (this.stateT >= START_DELAY) {
        this.state = 'idle';
        this.ctx.scenes.open('assembly', { machine: this.machine.id });
      }
    } else if (this.state === 'arrive') {
      const k = Math.min(1, this.stateT / 1.4);
      const e = 1 - (1 - k) * (1 - k);
      this.x = -this.machine.size.w + (this.x0 + this.machine.size.w) * e;
      if (k >= 1) { this.state = 'idle'; this.x = this.x0; }
    }
  }

  draw(g) {
    const a = this.ctx.assets;
    const m = this.machine;
    g.drawImage(a.image('bg/home'), 0, 0, 1024, 768);
    let dy = 0;
    if (this.state === 'starting') dy = Math.sin(this.stateT * 50) * 3;
    else if (this.state === 'idle') dy = Math.sin(this.t * 2) * 2;
    // тень
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath(); g.ellipse(this.x + m.size.w / 2, GROUND_Y - 4, m.size.w / 2, 16, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(a.image('machine/' + m.id + '/whole/idle'), this.x, this.y0 + dy, m.size.w, m.size.h);
    if (this.state === 'idle' && this.hint.showHand()) {
      const cx = this.x0 + m.size.w * 0.7, cy = this.y0 + m.size.h * 0.35;
      drawHand(g, a, cx, cy, cx, cy, this.hint.handPhase());
    }
  }
}
