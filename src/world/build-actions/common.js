// Общая основа действий стройки (contracts.md, раздел 8, «Действия стройки»).
// Каждое действие — модуль с одним интерфейсом:
//   start(repeat)  — начать повтор номер repeat (с 0);
//   update(dt), draw(g), onPointer(e);
//   target()       — что ждём от ребёнка: {kind: 'tap' | 'hold' | 'drag' | 'trace', ...} или null (идёт анимация);
//   done           — true, когда повтор закончен (вместе с анимацией);
//   fraction()     — 0..1, насколько сделан текущий повтор (для частичного показа слоя);
//   cancel()       — палец пропал или пауза: вернуть перетаскиваемое, заглушить звук;
//   stop()         — выход из сцены: заглушить всё.
// Действие ничего не знает о конкретных машинах и объектах: всё приходит в env от сцены стройки.
import { dist, clamp, lerp, easeOut, easeInOut, inRect } from '../../core/draw-utils.js';
import { drawGlow, drawGlowRect } from '../../core/ui.js';
import { partOf, safePoint } from './layer-box.js';

export const GROUND = 600; // земля на фоне bg/build
export const SITE = { x: 700, y: 560 }; // середина площадки объекта
export const HIT_PAD = 40; // промах рядом с машиной засчитывается
export const PICK_R = 100; // радиус, в котором берётся предмет
export const DROP_R = 120; // радиус, в котором предмет встаёт на место
export const TRACE_TOL = 100; // насколько далеко от дорожки можно вести палец

export { dist, clamp, lerp, easeOut, easeInOut, inRect };

// Точки ломаной через каждые step пикселей (для дорожек, которые ведёт палец).
export function densify(points, step = 50) {
  const out = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const n = Math.max(1, Math.ceil(dist(a.x, a.y, b.x, b.y) / step));
    for (let k = 1; k <= n; k++) out.push({ x: lerp(a.x, b.x, k / n), y: lerp(a.y, b.y, k / n) });
  }
  return out;
}

export class BaseAction {
  constructor(env) {
    this.env = env;
    this.step = env.step;
    this.repeats = Math.max(1, env.step.repeats | 0 || 1);
    this.repeat = 0;
    this.done = false;
    this.t = 0;
    this.particles = [];
    this.sounds = [];
  }

  get kind() { return 'tap'; }
  start(repeat) { this.repeat = repeat | 0; this.done = false; this.t = 0; this.reset(); }
  reset() {}
  update(dt) {
    this.t += dt;
    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt;
      if (p.floor !== undefined && p.y > p.floor) { p.y = p.floor; p.vx *= 0.5; p.vy = 0; }
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
  }
  draw(g) {}
  onPointer(e) {}
  target() { return null; }
  fraction() { return 0; }
  cancel() { this._stopSounds(); }
  stop() { this._stopSounds(); }

  // ---------- помощники ----------

  // Где машина стоит без дела (слева от объекта) или null, если шаг без машины.
  homeRect() { return this.env.machine ? this.env.homeRect() : null; }
  play(id, opts) {
    const h = this.env.ctx.audio.play(id, opts);
    if (opts && opts.loop) this.sounds.push(h);
    return h;
  }
  _stopSounds() {
    for (const h of this.sounds) { try { h.stop(); } catch (e) { /* ничего */ } }
    this.sounds = [];
  }
  rnd() { return this.env.ctx.random(); }
  burst(x, y, n, color, opts = {}) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + (this.rnd() - 0.5) * (opts.spread || 40), y,
        vx: (opts.vx || 0) + (this.rnd() - 0.5) * (opts.vxs || 160), vy: -(opts.up || 260) * (0.5 + this.rnd() * 0.6),
        r: 6 + this.rnd() * 8, color, t: 0, life: opts.life || 1.2, floor: opts.floor,
      });
    }
  }
  drawParticles(g) {
    for (const p of this.particles) {
      g.globalAlpha = clamp(1.4 - p.t / p.life, 0, 1);
      g.fillStyle = p.color;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }
  drawMachine(g, rect, pose, dx = 0, dy = 0) {
    if (rect) this.env.drawMachine(g, { x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h }, pose);
  }
  glowRect(g, r) { drawGlowRect(g, r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, this.env.time()); }
  glow(g, x, y, r) { drawGlow(g, x, y, r, this.env.time()); }
}

// ---------- тык: машина делает одно движение за тык (dig, haul-in, haul-away) ----------

export class TapAction extends BaseAction {
  get kind() { return 'tap'; }
  get duration() { return 1; }
  reset() { this.anim = -1; }
  // Куда тыкать: машина, а если шага без машины — круг на площадке.
  hitRect() {
    const r = this.homeRect();
    if (r) return r;
    return { x: SITE.x - 90, y: SITE.y - 150, w: 180, h: 180 };
  }
  target() {
    if (this.anim >= 0 || this.done) return null;
    const r = this.hitRect();
    return { kind: 'tap', x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) };
  }
  onPointer(e) {
    if (e.type !== 'down' || this.anim >= 0 || this.done) return;
    if (!inRect(e.x, e.y, this.hitRect(), HIT_PAD)) return;
    this.anim = 0;
    this.onTap();
  }
  onTap() {}
  fraction() { return this.anim < 0 ? 0 : clamp(this.anim / this.duration, 0, 1); }
  update(dt) {
    super.update(dt);
    if (this.anim < 0 || this.done) return;
    const before = this.anim;
    this.anim += dt;
    this.onAnim(before, this.anim);
    if (this.anim >= this.duration) this.done = true;
  }
  onAnim(from, to) {}
  // Смещение и поза машины в момент анимации.
  pose() { return { dx: 0, dy: 0, pose: 'idle' }; }
  draw(g) {
    const r = this.homeRect();
    const idle = this.anim < 0 && !this.done;
    if (r) {
      if (idle) this.glowRect(g, r);
      const p = this.anim >= 0 ? this.pose(this.anim) : { dx: 0, dy: Math.sin(this.env.time() * 3) * 2, pose: 'idle' };
      this.drawMachine(g, r, p.pose, p.dx, p.dy);
    } else if (idle) {
      const h = this.hitRect();
      this.glow(g, h.x + h.w / 2, h.y + h.h / 2, 80);
    }
    this.drawParticles(g);
  }
}

// ---------- держать: бетономешалка льёт, пока палец на ней (pour) ----------

export const HOLD_TIME = 1.5;

export class HoldAction extends BaseAction {
  get kind() { return 'hold'; }
  reset() { this.fill = 0; this.holding = false; this.after = -1; this.pour = null; }
  hitRect() {
    const r = this.homeRect();
    return r || { x: SITE.x - 90, y: SITE.y - 150, w: 180, h: 180 };
  }
  target() {
    if (this.after >= 0 || this.done) return null;
    const r = this.hitRect();
    return { kind: 'hold', x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2), seconds: Math.max(0.1, +((1 - this.fill) * HOLD_TIME).toFixed(2)) };
  }
  fraction() { return this.fill; }
  _release() {
    this.holding = false;
    if (this.pour) { try { this.pour.stop(); } catch (e) { /* ничего */ } }
    this.sounds = this.sounds.filter((h) => h !== this.pour);
    this.pour = null;
  }
  onPointer(e) {
    if (this.after >= 0 || this.done) return;
    if (e.type === 'down' && inRect(e.x, e.y, this.hitRect(), HIT_PAD)) {
      this.holding = true;
      if (!this.pour) this.pour = this.play('fx/pour', { loop: true });
    } else if (e.type === 'up' || e.type === 'cancel') {
      this._release();
    }
  }
  cancel() { this._release(); super.cancel(); }
  // Струя: откуда льётся и куда.
  spout() {
    const r = this.hitRect();
    return { x: r.x + r.w * 0.98, y: r.y + r.h * 0.45, tx: r.x + r.w + 70, ty: GROUND - 6 };
  }
  update(dt) {
    super.update(dt);
    if (this.done) return;
    if (this.after >= 0) {
      this.after += dt;
      if (this.after >= 0.5) this.done = true;
      return;
    }
    if (!this.holding) return;
    this.fill = Math.min(1, this.fill + dt / HOLD_TIME);
    const s = this.spout();
    if (this.rnd() < 0.7) this.particles.push({ x: s.x + (this.rnd() - 0.5) * 10, y: s.y, vx: 90 + this.rnd() * 40, vy: 20, r: 7 + this.rnd() * 5, color: '#9aa0a6', t: 0, life: 0.7, floor: GROUND - 4 });
    if (this.fill >= 1) { this._release(); this.after = 0; }
  }
  draw(g) {
    const r = this.hitRect();
    const idle = this.after < 0 && !this.done;
    if (this.homeRect()) {
      if (idle && !this.holding) this.glowRect(g, r);
      this.drawMachine(g, r, this.holding ? 'work' : 'idle', 0, this.holding ? Math.sin(this.env.time() * 30) * 1.5 : 0);
    } else if (idle && !this.holding) this.glow(g, r.x + r.w / 2, r.y + r.h / 2, 80);
    this.drawParticles(g);
    // шкала-кольцо над машиной
    const cx = r.x + r.w / 2, cy = Math.max(150, r.y - 70);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(cx, cy, 50, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#c9ced8'; g.lineWidth = 16;
    g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.stroke();
    if (this.fill > 0) {
      g.strokeStyle = '#2fa84f';
      g.beginPath(); g.arc(cx, cy, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.fill); g.stroke();
    }
    g.fillStyle = '#9aa0a6';
    g.beginPath(); g.arc(cx, cy, 14 + 8 * this.fill, 0, Math.PI * 2); g.fill();
  }
}

// ---------- вести пальцем по дорожке (level, spread, roll, paint, line) ----------

export class TraceAction extends BaseAction {
  get kind() { return 'trace'; }
  // Дорожка: для машины — от её места вправо по земле; иначе задаёт подкласс.
  // Если известно, где появится новая часть (env.box), дорожка идёт по земле до её правого края.
  makePath() {
    const r = this.homeRect();
    const b = this.env.box;
    if (!r) {
      const ax = this.area();
      return densify([{ x: ax.x0, y: GROUND - 40 }, { x: ax.x1, y: GROUND - 40 }], 50);
    }
    const y = Math.round(r.y + r.h / 2);
    const x0 = Math.round(r.x + r.w / 2);
    const xMax = Math.round(1024 - r.w / 2 - 16);
    const x1 = b ? Math.round(clamp(b.x + b.w, Math.min(xMax, x0 + 240), xMax)) : xMax;
    return densify([{ x: x0, y }, { x: x1, y }], 50);
  }
  // Участок земли, где работаем: по ширине новой части или общий.
  area() {
    const b = this.env.box;
    if (!b) return { x0: 440, x1: 960 };
    let x0 = clamp(b.x, 120, 980), x1 = clamp(b.x + b.w, 120, 980);
    if (x1 - x0 < 240) { const c = (x0 + x1) / 2; x0 = clamp(c - 120, 120, 740); x1 = x0 + 240; }
    return { x0: Math.round(x0), x1: Math.round(x1) };
  }
  reset() {
    this.path = this.makePath();
    this.len = [0];
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1], b = this.path[i];
      this.len.push(this.len[i - 1] + dist(a.x, a.y, b.x, b.y));
    }
    this.total = this.len[this.len.length - 1];
    this.pos = 0;
    this.tracing = false;
    this.back = -1; // машина возвращается на место
    this.lastSound = -1;
  }
  fraction() { return this.total ? clamp(this.pos / this.total, 0, 1) : 1; }
  pointAt(s) {
    s = clamp(s, 0, this.total);
    for (let i = 1; i < this.path.length; i++) {
      if (s <= this.len[i] || i === this.path.length - 1) {
        const a = this.path[i - 1], b = this.path[i];
        const seg = this.len[i] - this.len[i - 1] || 1;
        const k = clamp((s - this.len[i - 1]) / seg, 0, 1);
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
      }
    }
    return { x: this.path[0].x, y: this.path[0].y };
  }
  // Ближайшая точка дорожки к пальцу среди участка, куда можно продвинуться (не дальше 220 px вперёд).
  project(x, y) {
    let best = null;
    for (let i = 1; i < this.path.length; i++) {
      if (this.len[i - 1] > this.pos + 220) break;
      if (this.len[i] < this.pos - 120) continue;
      const a = this.path[i - 1], b = this.path[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const l2 = dx * dx + dy * dy || 1;
      const k = clamp(((x - a.x) * dx + (y - a.y) * dy) / l2, 0, 1);
      const px = a.x + dx * k, py = a.y + dy * k;
      const d = dist(x, y, px, py);
      const s = Math.min(this.len[i - 1] + k * Math.sqrt(l2), this.pos + 220);
      if (!best || d < best.d - 1 || (Math.abs(d - best.d) <= 1 && s > best.s)) best = { d, s };
    }
    return best;
  }
  finished() { return this.pos >= this.total - 12; }
  target() {
    if (this.done || this.back >= 0 || this.finished()) return null;
    const p = this.pointAt(this.pos);
    const rest = this.path.filter((q, i) => this.len[i] > this.pos + 1);
    return { kind: 'trace', x: Math.round(p.x), y: Math.round(p.y), path: [{ x: Math.round(p.x), y: Math.round(p.y) }].concat(rest.map((q) => ({ x: q.x, y: q.y }))) };
  }
  // Можно начать вести: палец около текущей точки (или по самой машине).
  canGrab(x, y) {
    const p = this.pointAt(this.pos);
    if (dist(x, y, p.x, p.y) <= TRACE_TOL + 10) return true;
    const m = this.movingRect();
    return !!(m && inRect(x, y, m, 20));
  }
  onPointer(e) {
    if (this.done || this.back >= 0 || this.finished()) return;
    if (e.type === 'down') {
      this.tracing = this.canGrab(e.x, e.y);
      if (this.tracing) this.follow(e.x, e.y);
    } else if (e.type === 'move') {
      if (this.tracing) this.follow(e.x, e.y);
    } else {
      this.tracing = false;
    }
  }
  follow(x, y) {
    const b = this.project(x, y);
    if (b && b.d <= TRACE_TOL && b.s > this.pos) {
      this.pos = b.s;
      this.onAdvance();
    }
    if (this.finished()) { this.tracing = false; this.onFinish(); }
  }
  onAdvance() {
    const n = Math.floor(this.pos / 160);
    if (n !== this.lastSound) { this.lastSound = n; this.onStep(); }
  }
  onStep() {}
  onFinish() {
    if (this.homeRect()) this.back = 0;
    else this.back = 0; // без машины — короткая пауза, чтобы увидеть результат
  }
  cancel() { this.tracing = false; super.cancel(); }
  update(dt) {
    super.update(dt);
    if (this.done || this.back < 0) return;
    this.back += dt;
    if (this.back >= this.backTime()) this.done = true;
  }
  backTime() { return this.homeRect() ? 0.9 : 0.5; }
  // Машина, которую ведёт палец: её прямоугольник в текущей точке.
  movingRect() {
    const r = this.homeRect();
    if (!r) return null;
    let s = this.pos;
    if (this.back >= 0) s = this.total * (1 - easeInOut(this.back / this.backTime()));
    const p = this.pointAt(s);
    const h = this.path[0];
    return { x: r.x + (p.x - h.x), y: r.y + (p.y - h.y), w: r.w, h: r.h };
  }
  // Пунктир дорожки впереди.
  drawGuide(g, color = 'rgba(255,255,255,0.9)') {
    if (this.done || this.back >= 0) return;
    g.save();
    g.strokeStyle = color; g.lineWidth = 10; g.lineCap = 'round';
    g.setLineDash([4, 26]);
    g.beginPath();
    const p0 = this.pointAt(this.pos);
    g.moveTo(p0.x, p0.y);
    for (let i = 0; i < this.path.length; i++) if (this.len[i] > this.pos) g.lineTo(this.path[i].x, this.path[i].y);
    g.stroke();
    g.setLineDash([]);
    // флажок в конце дорожки
    const e = this.path[this.path.length - 1];
    g.fillStyle = '#ffd34d';
    g.beginPath(); g.arc(e.x, e.y, 16, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  drawMover(g) {
    const m = this.movingRect();
    if (m) {
      const idle = !this.tracing && this.back < 0 && !this.done;
      if (idle) this.glowRect(g, m);
      this.drawMachine(g, m, this.tracing ? 'work' : 'idle', 0, this.tracing ? Math.sin(this.env.time() * 25) * 1.5 : 0);
    } else if (!this.done && this.back < 0) {
      const p = this.pointAt(this.pos);
      if (!this.tracing) this.glow(g, p.x, p.y, 46);
      this.drawTool(g, p.x, p.y);
    }
  }
  drawTool(g, x, y) {}
  draw(g) {
    this.drawTrail(g);
    this.drawGuide(g);
    this.drawMover(g);
    this.drawParticles(g);
  }
  drawTrail(g) {}
}

// ---------- перетащить на подсвеченное место (lift, place, stack) ----------

export class DragAction extends BaseAction {
  get kind() { return 'drag'; }
  reset() {
    this.item = Object.assign({}, this.source());
    this.held = false;
    this.anim = null; // {from, to, t, dur, snap}
  }
  source() { return { x: 220, y: 548 }; }
  // Место для повтора i: часть прямоугольника новой части объекта (env.box), иначе общее место.
  spot(i) {
    const r = this.spotRect(i);
    if (!r) return this.fallbackSpot(i);
    return safePoint({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, { minX: 180, maxX: 944, minY: this.minY() });
  }
  fallbackSpot(i) {
    const n = this.repeats;
    return { x: Math.round(480 + (i + 0.5) * 440 / n), y: 560 };
  }
  // Как делить новую часть между повторами: 'x' — слева направо, 'y' — рядами снизу вверх.
  splitAxis() { return 'x'; }
  spotRect(i) {
    const b = this.env.box;
    return b ? partOf(b, i, this.repeats, this.splitAxis()) : null;
  }
  itemSize() { return { w: 130, h: 56 }; }
  fraction() { return this.anim && this.anim.snap ? clamp(this.anim.t / this.anim.dur, 0, 1) : 0; }
  target() {
    if (this.done || this.anim || this.held) return null;
    const t = this.spot(this.repeat);
    return { kind: 'drag', x: Math.round(this.item.x), y: Math.round(this.item.y), to: { x: t.x, y: t.y } };
  }
  onPointer(e) {
    if (this.done || this.anim) return;
    if (e.type === 'down') {
      if (dist(e.x, e.y, this.item.x, this.item.y) <= PICK_R) {
        this.held = true;
        this.off = { x: this.item.x - e.x, y: this.item.y - e.y };
      }
    } else if (e.type === 'move') {
      if (!this.held) return;
      this.item.x = clamp(e.x + this.off.x, 60, 964);
      this.item.y = clamp(e.y + this.off.y, this.minY(), 720);
    } else if (e.type === 'up') {
      if (!this.held) return;
      this.held = false;
      const t = this.spot(this.repeat);
      if (dist(this.item.x, this.item.y, t.x, t.y) <= DROP_R) this._animTo(t, true);
      else this._animTo(this.source(), false);
    } else if (e.type === 'cancel') {
      if (this.held) { this.held = false; this._animTo(this.source(), false); }
    }
  }
  minY() { return 130; }
  cancel() {
    if (this.held) { this.held = false; this.item = Object.assign({}, this.source()); }
    if (this.anim && !this.anim.snap) { this.anim = null; this.item = Object.assign({}, this.source()); }
    super.cancel();
  }
  _animTo(to, snap) {
    this.anim = { from: { x: this.item.x, y: this.item.y }, to: { x: to.x, y: to.y }, t: 0, dur: snap ? 0.3 : 0.35, snap };
  }
  update(dt) {
    super.update(dt);
    if (!this.anim || this.done) return;
    const a = this.anim;
    a.t += dt;
    const k = easeOut(a.t / a.dur);
    this.item.x = lerp(a.from.x, a.to.x, k);
    this.item.y = lerp(a.from.y, a.to.y, k);
    if (a.snap && !a.sounded && a.t >= a.dur) {
      a.sounded = true;
      this.play('fx/snap');
      this.burst(a.to.x, a.to.y, 8, '#fff3a0', { up: 200, life: 0.6 });
    }
    if (a.t >= a.dur + (a.snap ? 0.35 : 0)) {
      this.anim = null;
      if (a.snap) this.done = true;
    }
  }
  drawItem(g, x, y, alpha = 1) {
    const s = this.itemSize();
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(x - s.w / 2 + 4, y - s.h / 2 + 5, s.w, s.h);
    g.fillStyle = '#d9a05b';
    g.fillRect(x - s.w / 2, y - s.h / 2, s.w, s.h);
    g.fillStyle = '#b37a3c';
    g.fillRect(x - s.w / 2, y - 3, s.w, 6);
    g.restore();
  }
  drawSpot(g, t) {
    const r = this.spotRect(this.repeat);
    const s = r ? { w: clamp(r.w, 80, 400), h: clamp(r.h, 44, 300) } : this.itemSize();
    // подсветка целиком на экране и не у крестика
    s.w = Math.min(s.w, 2 * (t.x - 100), 2 * (1020 - t.x));
    s.h = Math.min(s.h, 2 * (t.y - 100), 2 * (740 - t.y));
    g.save();
    g.globalAlpha = 0.45 + 0.2 * Math.sin(this.env.time() * 5);
    g.fillStyle = '#ffffff';
    g.fillRect(t.x - s.w / 2, t.y - s.h / 2, s.w, s.h);
    g.restore();
    drawGlowRect(g, t.x, t.y, s.w, s.h, this.env.time());
  }
  drawPlaced(g) {
    const n = this.repeat + (this.done ? 1 : 0);
    for (let i = 0; i < n; i++) { const t = this.spot(i); this.drawItem(g, t.x, t.y); }
  }
  drawPile(g) {
    // запас ещё не перенесённых предметов под тем, что берём
    const left = this.repeats - this.repeat - 1;
    const s = this.source();
    for (let i = Math.min(2, left); i >= 1; i--) this.drawItem(g, s.x + i * 6, s.y + i * 10, 0.9);
  }
  drawMachineBase(g) {
    const r = this.homeRect();
    if (r) this.drawMachine(g, r, this.held || this.anim ? 'work' : 'idle');
  }
  draw(g) {
    this.drawMachineBase(g);
    this.drawPlaced(g);
    const waiting = !this.done && !(this.anim && this.anim.snap);
    if (waiting) this.drawSpot(g, this.spot(this.repeat));
    if (!this.done) {
      this.drawPile(g);
      this.drawCarrier(g);
      if (!this.held && !this.anim) this.glow(g, this.item.x, this.item.y, 80);
      this.drawItem(g, this.item.x, this.item.y);
    }
    this.drawParticles(g);
  }
  drawCarrier(g) {}
}
