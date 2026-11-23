// «Машины спят» — экран блокировки родительского таймера. Снимается только жестом взрослого.
import { Scene } from '../core/scene.js';
import contentData from '../data/index.js';

export class LockedScene extends Scene {
  static id = 'locked';

  static assets() {
    const m = contentData.machines[0];
    return ['bg/locked', 'machine/' + m.id + '/whole/idle'];
  }

  enter() {
    this.machine = this.ctx.data.machines[0];
    this.t = 0;
    this.leaving = false;
  }

  _leaveIfUnlocked() {
    if (!this.leaving && !this.ctx.timer.isLocked()) {
      this.leaving = true;
      this.ctx.scenes.back();
    }
  }

  onResult() { this._leaveIfUnlocked(); }

  update(dt) {
    this.t += dt;
    this._leaveIfUnlocked();
  }

  draw(g) {
    const a = this.ctx.assets;
    g.drawImage(a.image('bg/locked'), 0, 0, 1024, 768);
    const m = this.machine;
    const k = 0.78;
    const w = m.size.w * k, h = m.size.h * k;
    const x = 512 - w / 2, y = 600 - h;
    g.save();
    g.globalAlpha = 0.75;
    g.drawImage(a.image('machine/' + m.id + '/whole/idle'), x, y, w, h);
    g.restore();
    // «з-з-з» — рисованные буквы Z, всплывают над машиной
    g.save();
    g.strokeStyle = '#fff8d0';
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = (this.t * 0.4 + i / 3) % 1;
      const s = 14 + i * 8 + ph * 10;
      const zx = x + w * 0.78 + ph * 60 + i * 20;
      const zy = y - 10 - ph * 120 - i * 30;
      g.globalAlpha = Math.sin(ph * Math.PI);
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(zx - s, zy - s); g.lineTo(zx + s, zy - s); g.lineTo(zx - s, zy + s); g.lineTo(zx + s, zy + s);
      g.stroke();
    }
    g.restore();
  }
}
