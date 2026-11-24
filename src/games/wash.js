// Мойка (spec.md, раздел 4 «Мойка»): вода → пена → вода пальцем по машине.
// Грязь исчезает там, где прошёл палец; шаг завершается при очистке ≥ 90% площади машины.
// Упрямая грязь — примерно в одной мойке из трёх, не два раза подряд; второй круг — только по 2–3 пятнам.
// Грязь, вода и пена рисуются кругами по клеткам сетки (без пиксельных масок и getImageData).
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand, drawGlowRect } from '../core/ui.js';
import { dist, roundRect } from '../core/draw-utils.js';
import { staticMachine, validMachine, drawBackground, cellsForRects, RubGrid, fillCells, drawSparkles, Finale, stopSound } from './common.js';

export const PHASES = ['water', 'foam', 'rinse'];
export const CELL = 24;
export const BRUSH = 46;
export const CLEAN_ENOUGH = 0.9;
export const STUBBORN_CHANCE = 0.5; // с запретом «два раза подряд» даёт около 1/3 моек
const SPOT_R = 42;
const PHASE_VOICE = { water: 'wash-water', foam: 'wash-foam', rinse: 'wash-rinse' };
const PHASE_SOUND = { water: 'fx/water', foam: 'fx/foam', rinse: 'fx/water' };

// Упрямая ли грязь в этой мойке. Не зависит от машины; после упрямой — всегда обычная.
export function decideStubborn(random, lastWasStubborn) {
  if (lastWasStubborn) return false;
  return random() < STUBBORN_CHANCE;
}

// 2–3 пятна упрямой грязи: центры среди клеток машины, подальше друг от друга.
export function pickSpots(cells, random) {
  const want = random() < 0.5 ? 2 : 3;
  const spots = [];
  for (let minGap = 160; spots.length < want && minGap >= 0; minGap -= 40) {
    for (let tries = 0; tries < 60 && spots.length < want; tries++) {
      const c = cells[Math.floor(random() * cells.length)];
      if (!c) break;
      if (spots.every((s) => dist(s.x, s.y, c.x, c.y) >= Math.max(minGap, SPOT_R * 1.2))) spots.push({ x: c.x, y: c.y, r: SPOT_R });
    }
  }
  return spots;
}

export class WashScene extends Scene {
  static id = 'wash';

  static assets(params) {
    const m = staticMachine(params);
    const list = ['bg/wash', 'ui/hand'];
    if (!m) return list;
    return list.concat(['machine/' + m.id + '/whole/idle', 'machine/' + m.id + '/whole/dirty']);
  }

  enter(params) {
    const ctx = this.ctx;
    this.t = 0;
    this.hint = new IdleHint();
    this.finale = null;
    this.sound = null;
    this.finger = null;
    this.cells = [];
    const m = validMachine(ctx, params.machine, 'Wash');
    if (!m) { this.broken = true; return; }
    this.machine = m;
    this.ox = Math.round((ctx.screen.width - m.size.w) / 2);
    this.oy = Math.round(660 - m.size.h);
    this.bounds = { x: this.ox, y: this.oy, w: m.size.w, h: m.size.h };
    this.cells = cellsForRects(m.parts, this.ox, this.oy, CELL);
    for (const c of this.cells) c.level = 0; // 0 грязь, 1 мокро, 2 пена, 3 чисто
    const last = !!(ctx.progress.wash() || {}).lastWasStubborn;
    this.stubborn = decideStubborn(ctx.random, last);
    ctx.progress.saveWash({ lastWasStubborn: this.stubborn });
    this.round = 1;
    this.spots = [];
    this.state = 'play';
    this._startPhase('water');
  }

  // ---------- логика ----------

  _startPhase(phase) {
    this.phase = phase;
    const lvl = PHASES.indexOf(phase) + 1;
    const active = this.round === 1 ? this.cells : this.cells.filter((c) => c.spot);
    this.grid = new RubGrid(active, BRUSH);
    this.grid.onRub = (c) => { if (c.level < lvl) c.level = lvl; };
    if (this.round === 2 && phase === 'water') this.ctx.audio.say('wash-stubborn', {}, { priority: 'high' });
    else this.ctx.audio.say(PHASE_VOICE[phase]);
    this.hint.reset();
  }

  // Доля протёртой площади на текущем шаге.
  progressFraction() { return this.grid ? this.grid.fraction() : 1; }

  // Палец в точке (x, y): протираем; при ≥ 90% шаг закончен.
  rub(x, y) {
    if (this.state !== 'play') return;
    this.grid.rubTo(x, y);
    if (this.grid.fraction() >= CLEAN_ENOUGH) this._phaseDone();
  }

  lift() { if (this.grid) this.grid.lift(); this.sound = stopSound(this.sound); }

  _phaseDone() {
    this.grid.completeAll();
    this.grid.lift();
    this.sound = stopSound(this.sound);
    const i = PHASES.indexOf(this.phase);
    if (i < PHASES.length - 1) { this._startPhase(PHASES[i + 1]); return; }
    if (this.round === 1 && this.stubborn) {
      // упрямая грязь: 2–3 пятна, второй круг только по ним
      this.round = 2;
      this.spots = pickSpots(this.cells, this.ctx.random);
      for (const c of this.cells) {
        c.spot = this.spots.some((s) => dist(s.x, s.y, c.x, c.y) <= s.r);
        c.level = c.spot ? 0 : 3;
      }
      this._startPhase('water');
      return;
    }
    for (const c of this.cells) c.level = 3;
    this.phase = 'done';
    this.state = 'done';
    this.ctx.audio.play('fx/win');
    this.ctx.audio.play('horn/' + this.machine.id);
    this.finale = new Finale(this.ctx, { done: true, machine: this.machine.id, rounds: this.round }, { phrase: 'wash-done', minWait: 2.4 });
  }

  isClean() { return this.cells.every((c) => c.level === 3); }
  dirtyCells() { return this.cells.filter((c) => c.level === 0); }

  onPointer(e) {
    if (this.broken || this.state !== 'play') return;
    this.hint.reset();
    if (e.type === 'down') {
      this.finger = { x: e.x, y: e.y };
      this.sound = stopSound(this.sound);
      this.sound = this.ctx.audio.play(PHASE_SOUND[this.phase], { loop: true, volume: 0.6 });
      this.rub(e.x, e.y);
    } else if (e.type === 'move') {
      if (!this.finger) return;
      this.finger = { x: e.x, y: e.y };
      this.rub(e.x, e.y);
    } else {
      this.finger = null;
      this.lift();
    }
  }

  update(dt) {
    if (this.broken) { this.broken = false; this.ctx.scenes.back(); return; }
    this.t += dt;
    if (this.state === 'play') {
      if (this.hint.update(dt)) this.ctx.audio.say('wash-hint');
    } else if (this.finale) {
      this.finale.update(dt);
    }
  }

  canExit() { return !(this.finale && !this.finale.canExit()); }

  pause() { this.finger = null; this.lift(); }

  exit() { this.finger = null; this.lift(); this.cells = []; }

  // ---------- рисование ----------

  _drawTool(g, x, y) {
    if (this.phase === 'foam') {
      g.fillStyle = '#ffd34d';
      roundRect(g, x - 36, y - 24, 72, 48, 14); g.fill();
      g.fillStyle = '#f2b500';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x - 22 + i * 11, y - 4 + (i % 2) * 10, 4, 0, Math.PI * 2); g.fill(); }
      return;
    }
    // струя воды
    g.fillStyle = 'rgba(120,200,255,0.55)';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = this.t * 9 + i * 0.8;
      const r = 18 + (i * 7) % 26;
      g.moveTo(x + Math.cos(a) * r + 7, y + Math.sin(a) * r);
      g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 7, 0, Math.PI * 2);
    }
    g.fill();
    g.fillStyle = '#3b7dd8';
    roundRect(g, x + 10, y + 18, 26, 64, 10); g.fill();
  }

  draw(g) {
    const a = this.ctx.assets;
    drawBackground(g, a, 'bg/wash', '#bfe6ff', '#9fb4c7');
    if (!this.machine) return;
    const m = this.machine;
    const base = this.round === 1 && (this.phase === 'water' || this.phase === 'foam') ? 'dirty' : 'idle';
    g.drawImage(a.image('machine/' + m.id + '/whole/' + base), this.ox, this.oy, m.size.w, m.size.h);
    if (this.state === 'done') {
      drawSparkles(g, this.ox, this.oy, m.size.w, m.size.h, this.t);
      return;
    }
    // грязь, вода, пена — круги по клеткам
    const r2 = this.round === 2;
    fillCells(g, this.cells, CELL * (r2 ? 0.8 : 0.74), r2 ? 'rgba(96,60,24,0.92)' : 'rgba(110,72,32,0.5)', (c) => c.level === 0);
    if (r2) fillCells(g, this.cells, CELL * 0.7, 'rgba(120,84,44,0.6)', (c) => c.level === 1);
    // мокро: лёгкий голубой блеск и редкие капли
    fillCells(g, this.cells, CELL * 0.74, 'rgba(120,190,255,0.16)', (c) => c.level === 1);
    fillCells(g, this.cells, CELL * 0.22, 'rgba(210,238,255,0.85)', (c) => c.level === 1 && (Math.round(c.x / CELL) * 7 + Math.round(c.y / CELL) * 3) % 5 === 0);
    fillCells(g, this.cells, CELL * 0.85, '#ffffff', (c) => c.level === 2);
    fillCells(g, this.cells, CELL * 0.3, 'rgba(200,225,255,0.9)', (c) => c.level === 2 && ((c.x + c.y) / CELL) % 3 < 1);
    const box = this.grid && this.grid.remainingBox();
    if (box && !this.finger) {
      drawGlowRect(g, box.cx, box.cy, box.w + CELL * 2, box.h + CELL * 2, this.t);
      if (this.hint.showHand()) {
        const half = Math.max(60, box.w / 2);
        drawHand(g, a, box.cx - half, box.cy, box.cx + half, box.cy, this.hint.handPhase());
      }
    }
    if (this.finger) this._drawTool(g, this.finger.x, this.finger.y);
  }
}
