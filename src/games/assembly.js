// Сборка машины (spec.md, раздел 4 «Сборка машины»). Заготовка этапа 1; на этапе 2 переходит зоне «Мини-игры».
// Ребёнок перетаскивает детали на контур; рядом с местом деталь прилипает, на чужое место не встаёт.
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand, drawGlowRect } from '../core/ui.js';
import { dist, easeOut, lerp, shuffle, logError } from '../core/draw-utils.js';
import contentData from '../data/index.js';

export const SNAP_DISTANCE = 90;       // центр детали ближе к центру своего места — встаёт
const MIN_TOUCH = 100;                 // зона касания не меньше ~2 см
const NEAR_MISS = 110;                 // промах рядом с деталью засчитывается
const TRAY = { x: 30, y: 512, w: 964, h: 246 };
const GAP = 26;
const ORIGIN_Y = 108;
const DRIVE_START = 1.4;
const MAX_FINISH_WAIT = 6;             // не ждём голос дольше

// Раскладка деталей на верстаке: высокие детали первыми, каждая в первый ряд, где есть место;
// внутри ряда порядок случайный. Если места не хватает — детали уменьшаются.
export function layoutTray(parts, random) {
  const byHeight = parts.slice().sort((a, b) => b.h - a.h || b.w - a.w);
  for (let s = 1; s >= 0.5; s -= 0.05) {
    const rows = [];
    for (const p of byHeight) {
      const w = p.w * s;
      let row = rows.find((r) => r.w + GAP + w <= TRAY.w);
      if (!row) { row = { items: [], w: -GAP, h: 0 }; rows.push(row); }
      row.items.push(p);
      row.w += GAP + w;
      row.h = Math.max(row.h, p.h * s);
    }
    const total = rows.reduce((a, r) => a + r.h, 0) + GAP * (rows.length - 1);
    if (total <= TRAY.h || s <= 0.5) {
      const out = {};
      let y = TRAY.y + (TRAY.h - total) / 2;
      for (const r of shuffle(rows, random)) {
        let x = TRAY.x + (TRAY.w - r.w) / 2;
        for (const p of shuffle(r.items, random)) {
          const w = p.w * s;
          out[p.id] = { cx: x + w / 2, cy: y + r.h / 2, s };
          x += w + GAP;
        }
        y += r.h + GAP;
      }
      return out;
    }
  }
  return {};
}

export class AssemblyScene extends Scene {
  static id = 'assembly';

  static assets(params) {
    const m = contentData.machines.find((x) => x.id === (params && params.machine));
    if (!m) return ['bg/assembly'];
    return ['bg/assembly', 'ui/hand', 'machine/' + m.id + '/whole/idle', 'machine/' + m.id + '/whole/silhouette']
      .concat(m.parts.map((p) => 'machine/' + m.id + '/part/' + p.id));
  }

  enter(params) {
    const ctx = this.ctx;
    const m = ctx.data.machines.find((x) => x.id === params.machine);
    if (!m || !Array.isArray(m.parts) || !m.parts.length || !m.size) {
      logError('Assembly', 'нет описания машины', params.machine);
      this.broken = true;
      return;
    }
    this.machine = m;
    this.ox = Math.round((ctx.screen.width - m.size.w) / 2);
    this.oy = ORIGIN_Y;
    const tray = layoutTray(m.parts, ctx.random);
    this.parts = m.parts.map((def) => {
      const home = tray[def.id] || { cx: 512, cy: 640, s: 0.6 };
      return {
        def,
        img: 'machine/' + m.id + '/part/' + def.id,
        slot: { cx: this.ox + def.x + def.w / 2, cy: this.oy + def.y + def.h / 2 },
        home,
        cx: home.cx, cy: home.cy, s: home.s,
        placed: false,
        anim: null,
      };
    });
    this.drag = null;
    this.state = 'play';
    this.t = 0;
    this.doneT = 0;
    this.praiseDone = false;
    this.finished = false;
    this.hint = new IdleHint();
    this.engine = null;
    const acc = ctx.data.phrases[m.nameAccPhrase] || '';
    ctx.audio.say('assembly-task', { machine: acc });
  }

  // ---------- логика (её проверяют тесты группы 2) ----------

  partById(id) { return this.parts.find((p) => p.def.id === id); }
  placedCount() { return this.parts.filter((p) => p.placed).length; }
  isAssembled() { return this.parts.every((p) => p.placed); }

  // Деталь отпущена в точке (cx, cy) — центр детали. Возвращает true, если встала.
  tryPlace(part, cx, cy) {
    if (part.placed) return false;
    if (dist(cx, cy, part.slot.cx, part.slot.cy) <= SNAP_DISTANCE) {
      this._animate(part, part.slot.cx, part.slot.cy, 1, 0.12);
      part.placed = true;
      this.ctx.audio.play('fx/snap');
      this.ctx.audio.say(part.def.namePhrase);
      if (this.isAssembled()) this._complete();
      return true;
    }
    this._animate(part, part.home.cx, part.home.cy, part.home.s, 0.35);
    return false;
  }

  nextHintPart() {
    const order = this.parts.slice().sort((a, b) => a.def.z - b.def.z);
    return order.find((p) => !p.placed && p !== (this.drag && this.drag.part)) || null;
  }

  _animate(part, x, y, s, dur) {
    part.anim = { fx: part.cx, fy: part.cy, fs: part.s, tx: x, ty: y, ts: s, t: 0, dur };
  }

  _complete() {
    this.state = 'done';
    this.doneT = 0;
    this.ctx.progress.setAssembled(this.machine.id);
    this.ctx.audio.praise().then(() => { this.praiseDone = true; });
  }

  // Какую деталь взял палец: ближайшая к точке касания; рядом с деталью промах засчитывается.
  _hit(x, y) {
    let best = null, bestD = Infinity;
    const free = this.parts.filter((p) => !p.placed);
    for (let i = free.length - 1; i >= 0; i--) {
      const p = free[i];
      const w = p.def.w * p.s, h = p.def.h * p.s;
      const dx = Math.max(0, Math.abs(x - p.cx) - w / 2);
      const dy = Math.max(0, Math.abs(y - p.cy) - h / 2);
      const d = Math.hypot(dx, dy);
      // маленькую деталь можно взять с запасом до ~2 см
      const reach = Math.max(NEAR_MISS / 2, (MIN_TOUCH - Math.min(w, h)) / 2, NEAR_MISS);
      if (d <= reach && d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  onPointer(e) {
    if (this.broken || this.state !== 'play') return;
    if (e.type === 'down') {
      this.hint.reset();
      const p = this._hit(e.x, e.y);
      if (!p) return;
      p.anim = null;
      this.drag = { part: p, dx: p.cx - e.x, dy: p.cy - e.y };
      // поднятая деталь — поверх остальных
      this.parts.splice(this.parts.indexOf(p), 1);
      this.parts.push(p);
      this.hint.reset();
      return;
    }
    if (!this.drag) return;
    const d = this.drag;
    if (e.type === 'move') {
      d.part.cx = e.x + d.dx;
      d.part.cy = e.y + d.dy;
      this.hint.reset();
    } else if (e.type === 'up') {
      this.drag = null;
      d.part.cx = e.x + d.dx;
      d.part.cy = e.y + d.dy;
      this.tryPlace(d.part, d.part.cx, d.part.cy);
      this.hint.reset();
    } else if (e.type === 'cancel') {
      this.drag = null;
      this._animate(d.part, d.part.home.cx, d.part.home.cy, d.part.home.s, 0.35);
    }
  }

  update(dt) {
    if (this.broken) { this.broken = false; this.ctx.scenes.back(); return; }
    this.t += dt;
    for (const p of this.parts) {
      if (this.drag && this.drag.part === p) {
        p.s = Math.min(1, p.s + dt * 4);
        continue;
      }
      if (p.anim) {
        const a = p.anim;
        a.t += dt;
        const k = easeOut(a.t / a.dur);
        p.cx = lerp(a.fx, a.tx, k); p.cy = lerp(a.fy, a.ty, k); p.s = lerp(a.fs, a.ts, k);
        if (a.t >= a.dur) p.anim = null;
      }
    }
    if (this.state === 'play') {
      if (this.hint.update(dt)) this.ctx.audio.say('assembly-hint');
      return;
    }
    // финал: заводится, гудит, уезжает
    const before = this.doneT;
    this.doneT += dt;
    if (before < 0.5 && this.doneT >= 0.5) this.engine = this.ctx.audio.play('engine/' + this.machine.id);
    if (before < 1.0 && this.doneT >= 1.0) this.ctx.audio.play('horn/' + this.machine.id);
    const gone = this._driveX() > this.ctx.screen.width;
    if (!this.finished && gone && (this.praiseDone || this.doneT > MAX_FINISH_WAIT)) {
      this.finished = true;
      this.ctx.scenes.finish({ done: true, machine: this.machine.id });
    }
  }

  _driveX() {
    const t = this.doneT - DRIVE_START;
    return t > 0 ? t * t * 520 + t * 120 : 0;
  }

  canExit() {
    // финальная анимация: выход откладывается не дольше чем на 1,5 секунды
    return !(this.state === 'done' && this.doneT < 1.5);
  }

  pause() {
    if (this.drag) {
      const p = this.drag.part;
      this.drag = null;
      this._animate(p, p.home.cx, p.home.cy, p.home.s, 0.35);
    }
    this.engine = null;
  }

  exit() {
    if (this.engine) { this.engine.stop(); this.engine = null; }
    this.parts = [];
    this.drag = null;
  }

  // ---------- рисование ----------

  draw(g) {
    const a = this.ctx.assets;
    g.drawImage(a.image('bg/assembly'), 0, 0, 1024, 768);
    if (!this.machine) return;
    const m = this.machine;
    if (this.state === 'done') {
      const x = this.ox + this._driveX();
      const shake = this.doneT > 0.5 && this.doneT < DRIVE_START + 0.3 ? Math.sin(this.doneT * 60) * 3 : 0;
      // пыль из-под колёс
      if (this.doneT > DRIVE_START) {
        g.fillStyle = 'rgba(210,190,150,0.7)';
        for (let i = 0; i < 4; i++) {
          const r = 16 + i * 8 + (this.doneT * 20) % 10;
          g.beginPath(); g.arc(x - 20 - i * 34, this.oy + m.size.h - 16 - i * 6, r, 0, Math.PI * 2); g.fill();
        }
      }
      g.drawImage(a.image('machine/' + m.id + '/whole/idle'), x, this.oy + shake, m.size.w, m.size.h);
      return;
    }
    // контур машины
    g.save();
    g.globalAlpha = 0.45;
    g.drawImage(a.image('machine/' + m.id + '/whole/silhouette'), this.ox, this.oy, m.size.w, m.size.h);
    g.restore();
    // вставшие детали — по слоям
    const placed = this.parts.filter((p) => p.placed && !p.anim).sort((p, q) => p.def.z - q.def.z);
    for (const p of placed) g.drawImage(a.image(p.img), this.ox + p.def.x, this.oy + p.def.y, p.def.w, p.def.h);
    // подсветка нужной детали
    const hp = this.nextHintPart();
    if (hp && !this.drag) drawGlowRect(g, hp.cx, hp.cy, hp.def.w * hp.s, hp.def.h * hp.s, this.t);
    // свободные и летящие детали
    for (const p of this.parts) {
      if (p.placed && !p.anim) continue;
      const w = p.def.w * p.s, h = p.def.h * p.s;
      if (this.drag && this.drag.part === p) {
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.beginPath(); g.ellipse(p.cx + 10, p.cy + h / 2 + 10, w / 2, 14, 0, 0, Math.PI * 2); g.fill();
      }
      g.drawImage(a.image(p.img), p.cx - w / 2, p.cy - h / 2, w, h);
    }
    // рука-подсказка: от детали к её месту
    if (hp && !this.drag && this.hint.showHand()) {
      drawHand(g, a, hp.cx, hp.cy, hp.slot.cx, hp.slot.cy, this.hint.handPhase());
    }
  }
}
