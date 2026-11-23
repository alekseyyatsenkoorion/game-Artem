// Заправка (spec.md, раздел 4 «Заправка»): шланг от колонки тянется пальцем к баку;
// пока пистолет у бака — шкала растёт; отпустил — шкала не сбрасывается, шланг возвращается.
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand, drawGlow } from '../core/ui.js';
import { dist, easeOut, lerp, roundRect } from '../core/draw-utils.js';
import { staticMachine, validMachine, drawBackground, drawSparkles, Finale, stopSound } from './common.js';

export const FILL_TIME = 3.5;       // секунд у бака до полной шкалы
export const TANK_REACH = 90;       // пистолет ближе к баку — заправляет
export const STATION = { x: 100, y: 250, w: 150, h: 410 };
export const GAUGE = { x: 130, y: 300, w: 90, h: 250 };
export const NOZZLE_REST = { x: 300, y: 470 };
const GRAB_REACH = 80;

export class FuelScene extends Scene {
  static id = 'fuel';

  static assets(params) {
    const m = staticMachine(params);
    const list = ['bg/fuel', 'ui/hand'];
    if (!m) return list;
    return list.concat(['machine/' + m.id + '/whole/idle']);
  }

  enter(params) {
    const ctx = this.ctx;
    this.t = 0;
    this.hint = new IdleHint();
    this.finale = null;
    this.sound = null;
    this.engine = null;
    const m = validMachine(ctx, params.machine, 'Fuel', ['fuelPoint']);
    if (!m || typeof m.fuelPoint.x !== 'number' || typeof m.fuelPoint.y !== 'number') { this.broken = true; return; }
    this.machine = m;
    this.ox = Math.round(1024 - 30 - m.size.w);
    this.oy = Math.round(660 - m.size.h);
    this.bounds = { x: this.ox, y: this.oy, w: m.size.w, h: m.size.h };
    this.tank = { x: this.ox + m.fuelPoint.x, y: this.oy + m.fuelPoint.y, r: TANK_REACH };
    this.hose = { x: NOZZLE_REST.x, y: NOZZLE_REST.y, rest: { x: NOZZLE_REST.x, y: NOZZLE_REST.y }, held: false, anim: null };
    this.level = 0;
    this.filling = false;
    this.state = 'play';
    const acc = (ctx.data.phrases && ctx.data.phrases[m.nameAccPhrase]) || '';
    ctx.audio.say('fuel-task', { machine: acc });
  }

  // ---------- логика ----------

  atTank() { return dist(this.hose.x, this.hose.y, this.tank.x, this.tank.y) <= TANK_REACH; }

  grab(x, y) {
    if (this.state !== 'play') return false;
    if (dist(x, y, this.hose.x, this.hose.y) > GRAB_REACH) return false;
    this.hose.held = true;
    this.hose.anim = null;
    this.hose.dx = this.hose.x - x; this.hose.dy = this.hose.y - y;
    return true;
  }

  moveTo(x, y) {
    if (!this.hose.held) return;
    this.hose.x = x + this.hose.dx; this.hose.y = y + this.hose.dy;
  }

  release() {
    if (!this.hose.held) return;
    this.hose.held = false;
    this.hose.anim = { fx: this.hose.x, fy: this.hose.y, t: 0, dur: 0.4 };
    this._setFilling(false);
  }

  _setFilling(on) {
    if (on === this.filling) return;
    this.filling = on;
    this.sound = stopSound(this.sound);
    if (on) this.sound = this.ctx.audio.play('fx/pour', { loop: true, volume: 0.6 });
  }

  onPointer(e) {
    if (this.broken || this.state !== 'play') return;
    this.hint.reset();
    if (e.type === 'down') this.grab(e.x, e.y);
    else if (e.type === 'move') this.moveTo(e.x, e.y);
    else this.release(); // up и cancel: шланг возвращается, шкала остаётся
  }

  update(dt) {
    if (this.broken) { this.broken = false; this.ctx.scenes.back(); return; }
    this.t += dt;
    const h = this.hose;
    if (h.anim) {
      h.anim.t += dt;
      const k = easeOut(h.anim.t / h.anim.dur);
      h.x = lerp(h.anim.fx, h.rest.x, k); h.y = lerp(h.anim.fy, h.rest.y, k);
      if (h.anim.t >= h.anim.dur) h.anim = null;
    }
    if (this.state === 'play') {
      const on = h.held && this.atTank();
      this._setFilling(on);
      if (on) {
        this.level = Math.min(1, this.level + dt / FILL_TIME);
        if (this.level >= 1) this._complete();
      }
      if (this.state === 'play' && this.hint.update(dt)) this.ctx.audio.say('fuel-hint');
    } else if (this.finale) {
      this.finale.update(dt);
    }
  }

  _complete() {
    this.state = 'done';
    this.level = 1;
    this.release();
    this._setFilling(false);
    this.ctx.audio.play('fx/win');
    this.engine = this.ctx.audio.play('engine/' + this.machine.id);
    this.finale = new Finale(this.ctx, { done: true, machine: this.machine.id }, { phrase: 'fuel-done', minWait: 2.4 });
  }

  canExit() { return !(this.finale && !this.finale.canExit()); }

  pause() {
    if (this.hose && this.hose.held) this.release();
    this.filling = false;
    this.sound = stopSound(this.sound);
    this.engine = stopSound(this.engine);
  }

  exit() { this.pause(); }

  // ---------- рисование ----------

  draw(g) {
    const a = this.ctx.assets;
    drawBackground(g, a, 'bg/fuel', '#bfe6ff', '#9aa5b1');
    if (!this.machine) return;
    const m = this.machine;
    const shake = this.state === 'done' ? Math.sin(this.t * 50) * 2 : 0;
    g.drawImage(a.image('machine/' + m.id + '/whole/idle'), this.ox, this.oy + shake, m.size.w, m.size.h);
    // крышка бака — куда подносить шланг
    const T = this.tank;
    g.fillStyle = '#3b4250';
    g.beginPath(); g.arc(T.x, T.y, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = this.level >= 1 ? '#ffd34d' : '#c9ccd2';
    g.beginPath(); g.arc(T.x, T.y, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3b4250';
    g.fillRect(T.x - 9, T.y - 3, 18, 6);
    // колонка
    const S = STATION, G = GAUGE;
    g.fillStyle = '#2fa84f';
    roundRect(g, S.x, S.y, S.w, S.h, 18); g.fill();
    g.fillStyle = '#1f7a37';
    roundRect(g, S.x - 10, S.y + S.h - 30, S.w + 20, 30, 8); g.fill();
    g.fillStyle = '#ffffff';
    roundRect(g, G.x - 6, G.y - 6, G.w + 12, G.h + 12, 12); g.fill();
    g.fillStyle = '#ffd34d';
    const lh = G.h * this.level;
    if (lh > 0) { roundRect(g, G.x, G.y + G.h - lh, G.w, lh, 8); g.fill(); }
    // шланг
    const h = this.hose;
    g.strokeStyle = '#26262b'; g.lineWidth = 14; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(S.x + S.w - 10, S.y + 70);
    g.quadraticCurveTo(S.x + S.w + 40, Math.max(S.y + 70, h.y) + 160, h.x - 20, h.y + 10);
    g.stroke();
    // пистолет
    g.save();
    g.translate(h.x, h.y);
    g.fillStyle = '#ffc21a';
    roundRect(g, -34, -22, 62, 44, 12); g.fill();
    g.fillStyle = '#3b4250';
    g.fillRect(24, -10, 34, 16);
    g.fillRect(-14, 20, 14, 24);
    g.restore();
    if (this.filling) {
      g.fillStyle = 'rgba(255,211,77,0.8)';
      for (let i = 0; i < 3; i++) {
        const k = ((this.t * 3 + i / 3) % 1);
        g.beginPath(); g.arc(h.x + 60, h.y + 10 + k * 30, 6, 0, Math.PI * 2); g.fill();
      }
    }
    if (this.state === 'done') { drawSparkles(g, this.ox, this.oy, m.size.w, m.size.h, this.t); return; }
    // подсветка: пистолет, а когда он в руке — бак
    if (h.held) drawGlow(g, this.tank.x, this.tank.y, 46, this.t);
    else drawGlow(g, h.x, h.y, 56, this.t);
    if (!h.held && this.hint.showHand()) drawHand(g, a, h.x, h.y, this.tank.x, this.tank.y, this.hint.handPhase());
  }
}
