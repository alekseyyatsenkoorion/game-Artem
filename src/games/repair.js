// Мастерская (spec.md, раздел 4 «Мастерская»): колесо, ржавчина или покраска — выпадает один.
// Колесо: тыкать по насосу, колесо надувается за PUMP_TAPS тыков и не перекачивается.
// Ржавчина: тереть пятно пальцем до ≥ 90%. Покраска: выбрать банку и закрасить облезлое место до ≥ 90%.
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand, drawGlowRect, drawGlow } from '../core/ui.js';
import { clamp, lerp, inRect, roundRect, dist, logError } from '../core/draw-utils.js';
import { staticMachine, validMachine, drawBackground, partAssets, cellsInCircle, RubGrid, fillCells, drawSparkles, Finale, stopSound } from './common.js';

export const KINDS = ['wheel', 'rust', 'paint'];
export const PUMP_TAPS = 5;
export const CLEAN_ENOUGH = 0.9;
export const SPOT_CELL = 14;
export const BRUSH = 30;
export const PUMP_RECT = { x: 780, y: 300, w: 180, h: 340 };
export const PAINTS = ['#e8412c', '#ffc21a', '#3b7dd8', '#2fa84f'];
const TOUCH_PAD = 40;
const TASK = { wheel: 'repair-wheel', rust: 'repair-rust', paint: 'repair-paint' };

// Вид ремонта: заданный или случайный. Колесо — только у машины с колёсами (wheels не пустой и детали есть);
// если колесо попросили у машины без колёс — случайно ржавчина или покраска, без ошибки.
export function chooseKind(kind, random, machine) {
  const parts = (machine && Array.isArray(machine.parts)) ? machine.parts : [];
  const hasWheels = !!(machine && Array.isArray(machine.wheels) && machine.wheels.some((id) => parts.some((p) => p && p.id === id)));
  if (KINDS.includes(kind) && (kind !== 'wheel' || hasWheels)) return kind;
  const list = hasWheels ? KINDS : KINDS.filter((k) => k !== 'wheel');
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

export class RepairScene extends Scene {
  static id = 'repair';

  static assets(params) {
    const m = staticMachine(params);
    const list = ['bg/repair', 'ui/hand'];
    if (!m) return list;
    return list.concat(['machine/' + m.id + '/whole/idle']).concat(partAssets(m));
  }

  enter(params) {
    const ctx = this.ctx;
    this.t = 0;
    this.hint = new IdleHint();
    this.finale = null;
    this.sound = null;
    this.finger = null;
    this.pressAnim = 0;
    this.kind = chooseKind(params.kind, ctx.random, (ctx.data.machines || []).find((x) => x && x.id === params.machine));
    const m = validMachine(ctx, params.machine, 'Repair');
    if (!m) { this.broken = true; return; }
    this.machine = m;
    this.ox = Math.round(40 + (680 - m.size.w) / 2);
    this.oy = Math.round(660 - m.size.h);
    this.bounds = { x: this.ox, y: this.oy, w: m.size.w, h: m.size.h };
    this.state = 'play';
    if (this.kind === 'wheel') {
      const wheels = (m.wheels || []).map((id) => m.parts.find((p) => p.id === id)).filter(Boolean);
      if (!wheels.length) { logError('Repair', 'у машины нет колёс', m.id); this.broken = true; return; }
      this.flatPart = wheels[Math.floor(ctx.random() * wheels.length) % wheels.length];
      this.taps = 0;
      this.pumpTaps = PUMP_TAPS;
      this.pressure = 0; // показанное давление, догоняет taps
      this.pumpRect = PUMP_RECT;
      const p = this.flatPart;
      this.wheelCenter = { x: this.ox + p.x + p.w / 2, y: this.oy + p.y + p.h / 2 };
    } else {
      this._makeSpot(m);
      this.cans = this.kind === 'paint' ? PAINTS.map((color, i) => ({ color, cx: 890, cy: 170 + i * 150, r: 62 })) : [];
      this.color = null;
    }
    ctx.audio.say(TASK[this.kind]);
  }

  _makeSpot(m) {
    const wheels = m.wheels || [];
    const cand = m.parts.filter((p) => !wheels.includes(p.id)).sort((a, b) => b.w * b.h - a.w * a.h);
    const list = cand.length ? cand.slice(0, 2) : m.parts.slice(0, 1);
    const p = list[Math.floor(this.ctx.random() * list.length) % list.length];
    const rect = { x: this.ox + p.x, y: this.oy + p.y, w: p.w, h: p.h };
    const R = clamp(Math.min(p.w, p.h) * 0.45, 38, 70);
    const cx = rect.x + rect.w / 2 + (this.ctx.random() - 0.5) * Math.max(0, rect.w - 2 * R) * 0.6;
    const cy = rect.y + rect.h / 2 + (this.ctx.random() - 0.5) * Math.max(0, rect.h - 2 * R) * 0.6;
    let cells = cellsInCircle(cx, cy, R, SPOT_CELL, [rect]);
    if (cells.length < 8) cells = cellsInCircle(cx, cy, R, SPOT_CELL);
    for (const c of cells) c.level = 0;
    this.spotPart = p.id;
    this.spot = { cx, cy, r: R };
    this.spotCells = cells;
    this.grid = new RubGrid(cells, BRUSH);
    this.grid.onRub = (c) => { c.level = 1; c.color = this.color; };
  }

  // ---------- логика ----------

  // Тык по насосу. Возвращает true, если колесо подкачалось.
  pump() {
    if (this.kind !== 'wheel' || this.state !== 'play') return false;
    if (this.taps >= this.pumpTaps) return false;
    this.taps++;
    this.pressAnim = 1;
    this.ctx.audio.play('fx/pump');
    if (this.taps >= this.pumpTaps) this._complete();
    return true;
  }

  inflation() { return this.kind === 'wheel' ? this.taps / this.pumpTaps : 0; }

  chooseColor(i) {
    if (this.kind !== 'paint' || !this.cans[i]) return false;
    this.color = this.cans[i].color;
    this.ctx.audio.play('fx/snap');
    return true;
  }

  rub(x, y) {
    if (this.state !== 'play' || this.kind === 'wheel') return;
    if (this.kind === 'paint' && !this.color) return;
    this.grid.rubTo(x, y);
    if (this.grid.fraction() >= CLEAN_ENOUGH) {
      this.grid.completeAll();
      this._complete();
    }
  }

  progressFraction() {
    if (this.kind === 'wheel') return this.inflation();
    return this.grid.fraction();
  }

  _complete() {
    this.state = 'done';
    this.finger = null;
    this.sound = stopSound(this.sound);
    if (this.grid) this.grid.lift();
    this.ctx.audio.play('fx/win');
    this.ctx.audio.play('horn/' + this.machine.id);
    this.finale = new Finale(this.ctx, { done: true, machine: this.machine.id, kind: this.kind }, { phrase: 'repair-done', minWait: 2.4 });
  }

  _canAt(x, y) {
    for (let i = 0; i < this.cans.length; i++) if (dist(x, y, this.cans[i].cx, this.cans[i].cy) <= this.cans[i].r + 12) return i;
    return -1;
  }

  onPointer(e) {
    if (this.broken || this.state !== 'play') return;
    this.hint.reset();
    if (this.kind === 'wheel') {
      if (e.type === 'down' && inRect(e.x, e.y, this.pumpRect, TOUCH_PAD)) this.pump();
      return;
    }
    if (e.type === 'down') {
      if (this.kind === 'paint') {
        const i = this._canAt(e.x, e.y);
        if (i >= 0) { this.chooseColor(i); return; }
        if (!this.color) return;
      }
      this.finger = { x: e.x, y: e.y };
      this.sound = stopSound(this.sound);
      this.sound = this.ctx.audio.play('fx/foam', { loop: true, volume: 0.4 });
      this.rub(e.x, e.y);
    } else if (e.type === 'move') {
      if (!this.finger) return;
      this.finger = { x: e.x, y: e.y };
      this.rub(e.x, e.y);
    } else {
      this.finger = null;
      this.grid.lift();
      this.sound = stopSound(this.sound);
    }
  }

  update(dt) {
    if (this.broken) { this.broken = false; this.ctx.scenes.back(); return; }
    this.t += dt;
    this.pressAnim = Math.max(0, this.pressAnim - dt * 4);
    if (this.kind === 'wheel') this.pressure = Math.min(this.taps, this.pressure + dt * 4);
    if (this.state === 'play') {
      if (this.hint.update(dt)) {
        const h = this.kind === 'wheel' ? 'repair-hint-wheel' : (this.kind === 'paint' && !this.color ? 'repair-paint' : 'repair-hint-rub');
        this.ctx.audio.say(h);
      }
    } else if (this.finale) {
      this.finale.update(dt);
    }
  }

  canExit() { return !(this.finale && !this.finale.canExit()); }

  pause() { this.finger = null; if (this.grid) this.grid.lift(); this.sound = stopSound(this.sound); }

  exit() { this.pause(); }

  // ---------- рисование ----------

  _drawMachine(g) {
    const a = this.ctx.assets;
    const m = this.machine;
    if (this.kind !== 'wheel') {
      g.drawImage(a.image('machine/' + m.id + '/whole/idle'), this.ox, this.oy, m.size.w, m.size.h);
      return;
    }
    const k = this.pressure / this.pumpTaps; // 0 — спущено, 1 — накачано
    const parts = m.parts.slice().sort((p, q) => (p.z || 0) - (q.z || 0));
    for (const p of parts) {
      const img = a.image('machine/' + m.id + '/part/' + p.id);
      if (p === this.flatPart) {
        const sy = lerp(0.62, 1, k), sx = lerp(1.14, 1, k);
        const w = p.w * sx, h = p.h * sy;
        g.drawImage(img, this.ox + p.x + (p.w - w) / 2, this.oy + p.y + p.h - h, w, h);
      } else {
        g.drawImage(img, this.ox + p.x, this.oy + p.y, p.w, p.h);
      }
    }
  }

  _drawPump(g) {
    const r = this.pumpRect;
    const press = this.pressAnim;
    const cx = r.x + r.w / 2;
    // шланг к колесу
    g.strokeStyle = '#26262b'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - 40, r.y + r.h - 30);
    g.quadraticCurveTo((cx + this.wheelCenter.x) / 2, r.y + r.h + 60, this.wheelCenter.x, this.wheelCenter.y);
    g.stroke();
    // подставка
    g.fillStyle = '#3b4250';
    roundRect(g, r.x, r.y + r.h - 40, r.w, 40, 10); g.fill();
    // цилиндр
    g.fillStyle = '#e8412c';
    roundRect(g, cx - 40, r.y + 120, 80, r.h - 150, 16); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(g, cx - 28, r.y + 134, 16, r.h - 180, 8); g.fill();
    // шток и ручка
    const hy = r.y + 20 + press * 70;
    g.fillStyle = '#c9ccd2';
    g.fillRect(cx - 8, hy, 16, r.y + 130 - hy);
    g.fillStyle = '#ffc21a';
    roundRect(g, r.x + 6, hy - 22, r.w - 12, 44, 20); g.fill();
    // шкала давления: полоски без цифр
    for (let i = 0; i < this.pumpTaps; i++) {
      g.fillStyle = i < this.taps ? '#2fa84f' : 'rgba(255,255,255,0.7)';
      g.beginPath(); g.arc(cx, r.y + r.h - 70 - i * 34, 12, 0, Math.PI * 2); g.fill();
    }
  }

  _drawCan(g, can, selected) {
    const x = can.cx, y = can.cy;
    g.fillStyle = '#c9ccd2';
    roundRect(g, x - 46, y - 44, 92, 96, 12); g.fill();
    g.fillStyle = can.color;
    roundRect(g, x - 46, y - 20, 92, 50, 6); g.fill();
    g.beginPath(); g.ellipse(x, y - 44, 46, 14, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6b707a'; g.lineWidth = 4;
    g.beginPath(); g.arc(x, y - 44, 40, Math.PI, 0); g.stroke();
    if (selected) {
      g.strokeStyle = '#ffffff'; g.lineWidth = 8;
      g.beginPath(); g.arc(x, y + 4, can.r, 0, Math.PI * 2); g.stroke();
    }
  }

  draw(g) {
    const a = this.ctx.assets;
    drawBackground(g, a, 'bg/repair', '#d7e3f0', '#8d99a6');
    if (!this.machine || this.broken) return;
    this._drawMachine(g);
    if (this.kind === 'wheel') this._drawPump(g);
    else {
      const rest = this.kind === 'rust';
      fillCells(g, this.spotCells, SPOT_CELL * 0.8, rest ? '#b5541c' : '#a9adb3', (c) => c.level === 0);
      fillCells(g, this.spotCells, SPOT_CELL * 0.3, rest ? '#7a3510' : '#5a5f66', (c) => c.level === 0 && ((c.x + c.y) / SPOT_CELL) % 3 < 1);
      if (!rest) {
        for (const col of PAINTS) fillCells(g, this.spotCells, SPOT_CELL * 0.85, col, (c) => c.level === 1 && c.color === col);
        for (const can of this.cans) this._drawCan(g, can, can.color === this.color);
      }
    }
    if (this.state === 'done') {
      drawSparkles(g, this.ox, this.oy, this.machine.size.w, this.machine.size.h, this.t);
      return;
    }
    // подсветка и рука
    const show = this.hint.showHand() && !this.finger;
    if (this.kind === 'wheel') {
      const r = this.pumpRect;
      drawGlowRect(g, r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, this.t);
      if (show) drawHand(g, a, r.x + r.w / 2, r.y + 20, r.x + r.w / 2, r.y + 20, this.hint.handPhase());
    } else if (this.kind === 'paint' && !this.color) {
      const c = this.cans[0];
      drawGlowRect(g, c.cx, 170 + 225, 130, 600, this.t);
      if (show) drawHand(g, a, c.cx, c.cy, c.cx, c.cy, this.hint.handPhase());
    } else if (!this.finger) {
      drawGlow(g, this.spot.cx, this.spot.cy, this.spot.r + 22, this.t);
      if (show) drawHand(g, a, this.spot.cx - this.spot.r, this.spot.cy, this.spot.cx + this.spot.r, this.spot.cy, this.hint.handPhase());
    }
    if (this.finger) {
      g.fillStyle = this.kind === 'paint' ? this.color : '#d9b38c';
      roundRect(g, this.finger.x - 30, this.finger.y - 20, 60, 40, 12); g.fill();
    }
  }
}
