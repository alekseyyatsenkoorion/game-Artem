// Карта-дорожка (spec.md, раздел 4 «Карта-дорожка»).
// Дорога-змейка из 10 участков, по участку на объект. Участок i — три остановки:
//   [сервис (по кругу: заправка, мойка, мастерская), стройка объекта i, сборка машины, которую открыл объект i];
// на последнем участке вместо сборки — финал: салют и парад всех открытых машин.
// Остановка — номер в плоском списке stops (ctx.progress.mapStop / setMapStop).
// Машина на карте — самая новая открытая и собранная машина (в начале — первая, самосвал).
// Тык по текущей остановке открывает её сцену; сделал — машина сама едет к следующей.
// Пройденные остановки можно переиграть тыком; будущие закрыты. Карту можно листать пальцем.
// Публичное поле target — {kind: 'tap', x, y} по текущей остановке или null (едем, листаем, салют).
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand, drawGlowRect } from '../core/ui.js';
import { clamp, lerp, easeInOut, easeOut, inRect, roundRect } from '../core/draw-utils.js';
import contentData from '../data/index.js';

export const SERVICES = ['fuel', 'wash', 'repair'];
const SERVICE_ICON = { fuel: 'ui/icon-fuel', wash: 'ui/icon-wash', repair: 'ui/icon-repair' };

const X0 = 300; // первая остановка в координатах карты
const SPACING = 330; // между остановками
const ROAD_Y = 545;
const ROAD_AMP = 85;
const CAM_LEFT = 380; // где на экране держим текущую остановку
const DRIVE_TIME = 2.0;
const PAN_SLOP = 24;
const RETURN_AFTER = 4;
const SIGN = 120;
const CAR_W = 190;
const PARADE_SPEED = 320;
const PARADE_GAP = 210;

function sortedByOrder(list) {
  return (list || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Плоский список остановок по данным объектов.
export function mapStops(objects) {
  const list = sortedByOrder(objects);
  const stops = [];
  list.forEach((o, i) => {
    stops.push({ kind: SERVICES[i % SERVICES.length], section: i });
    stops.push({ kind: 'build', section: i, object: o.id });
    if (i === list.length - 1) stops.push({ kind: 'finale', section: i });
    else if (o.unlocks) stops.push({ kind: 'assembly', section: i, machine: o.unlocks });
  });
  stops.forEach((s, i) => { s.index = i; });
  return stops;
}

export function roadY(wx) {
  return ROAD_Y + ROAD_AMP * Math.sin(((wx - X0) / SPACING) * Math.PI / 2);
}
export function stopX(i) { return X0 + i * SPACING; }

export class MapScene extends Scene {
  static id = 'map';

  static assets() {
    const ids = ['bg/map', 'ui/hand', 'ui/lock', 'ui/icon-fuel', 'ui/icon-wash', 'ui/icon-repair', 'ui/icon-assembly'];
    for (const m of contentData.machines || []) ids.push('machine/' + m.id + '/whole/idle', 'machine/' + m.id + '/whole/silhouette');
    return ids;
  }

  enter() {
    const { ctx } = this;
    this.machines = sortedByOrder(ctx.data.machines);
    this.stops = mapStops(ctx.data.objects);
    this.total = this.stops.length;
    this.t = 0;
    this.phase = 'idle'; // idle | drive | finale
    this.phaseT = 0;
    this.pending = null;
    this.shake = {};
    this.hint = new IdleHint();
    this.press = null; // {x, y, cam, panned}
    this.sinceTouch = 99;
    this.fireworks = [];
    this.parade = [];
    this.drive = null;
    this.carX = stopX(this.current());
    this.cam = this._camFor(this.carX);
    this.camGoal = this.cam;
  }

  // ---------- состояние ----------

  current() { return clamp(this.ctx.progress.mapStop() | 0, 0, this.total); }

  // Самая новая открытая и собранная машина; если собранных нет — первая открытая.
  car() {
    const p = this.ctx.progress;
    let best = null;
    for (const m of this.machines) if (p.isUnlocked(m.id) && p.isAssembled(m.id)) best = m;
    if (!best) best = this.machines.find((m) => p.isUnlocked(m.id)) || this.machines[0] || null;
    return best;
  }

  _camFor(wx) {
    const maxCam = Math.max(0, stopX(this.total - 1) + 300 - 1024);
    return clamp(wx - CAM_LEFT, 0, maxCam);
  }

  // Прямоугольник касания остановки на экране.
  stopRect(i) {
    const x = stopX(i) - this.cam, y = roadY(stopX(i));
    return { x: x - 95, y: y - 200, w: 190, h: 250 };
  }

  stopState(i) {
    const c = this.current();
    return i < c ? 'passed' : i === c ? 'current' : 'locked';
  }

  stopScene(stop) {
    if (stop.kind === 'build') return { scene: 'build', params: { object: stop.object } };
    if (stop.kind === 'assembly') return { scene: 'assembly', params: { machine: stop.machine } };
    if (stop.kind === 'finale') return null;
    const car = this.car();
    return { scene: stop.kind, params: { machine: car ? car.id : null } };
  }

  get target() {
    if (this.phase !== 'idle' || this.press || Math.abs(this.cam - this.camGoal) > 2) return null;
    const c = this.current();
    if (c >= this.total) return null;
    const r = this.stopRect(c);
    if (r.x + r.w / 2 < 0 || r.x + r.w / 2 > 1024) return null;
    return { kind: 'tap', x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h * 0.45) };
  }

  // ---------- действия ----------

  stopAt(x, y) {
    for (let i = 0; i < this.total; i++) if (inRect(x, y, this.stopRect(i), 10)) return i;
    // тык по машине около текущей остановки
    const c = this.current();
    if (c < this.total && this.phase === 'idle') {
      const r = this.carRect();
      if (r && inRect(x, y, r, 10)) return c;
    }
    return -1;
  }

  _tap(x, y) {
    if (this.phase !== 'idle') return;
    const i = this.stopAt(x, y);
    if (i < 0) return;
    const st = this.stopState(i);
    if (st === 'locked') {
      this.shake[i] = 0.5;
      this.ctx.audio.say('map-locked');
      return;
    }
    this._play(i);
  }

  _play(i) {
    const stop = this.stops[i];
    const car = this.car();
    if (car) this.ctx.audio.play('horn/' + car.id);
    if (stop.kind === 'finale') { this._startFinale(i); return; }
    const sc = this.stopScene(stop);
    const has = !this.ctx.scenes.has || this.ctx.scenes.has(sc.scene);
    if (!has || sc.params.machine === null) {
      // сцены нет (ещё не написана) — остановку не задерживаем
      if (i === this.current()) this._advance();
      return;
    }
    this.pending = { index: i, stop };
    this.ctx.scenes.open(sc.scene, sc.params);
  }

  _advance() {
    const c = this.current();
    if (c >= this.total) return;
    this.ctx.progress.setMapStop(c + 1);
    if (c + 1 >= this.total) return;
    this.phase = 'drive';
    this.phaseT = 0;
    this.drive = { from: stopX(c), to: stopX(c + 1) };
    const car = this.car();
    if (car) this.ctx.audio.play('engine/' + car.id);
    this.ctx.audio.say(this.stops[c + 1].kind === 'assembly' ? 'map-new-machine' : 'map-next');
  }

  onResult(result) {
    const p = this.pending;
    this.pending = null;
    this.hint.reset();
    this.sinceTouch = 99;
    this.carX = stopX(this.current());
    this.camGoal = this._camFor(this.carX);
    if (p && p.index === this.current()) {
      let ok = !!(result && result.done);
      // стройку достроили, но вышли крестиком во время салюта — всё равно пройдена
      if (!ok && p.stop.kind === 'build') ok = this.ctx.progress.objectState(p.stop.object).done;
      if (ok) this._advance();
    }
    this.ctx.timer.checkpoint();
  }

  _startFinale(i) {
    this.phase = 'finale';
    this.phaseT = 0;
    this.finaleStop = i;
    this.ctx.audio.say('map-finale');
    this.ctx.audio.play('fx/win');
    const p = this.ctx.progress;
    const list = this.machines.filter((m) => p.isUnlocked(m.id));
    this.parade = list.map((m, k) => ({ m, k }));
    this.paradeTime = (1024 + 200 + list.length * PARADE_GAP) / PARADE_SPEED;
  }

  _endFinale() {
    this.phase = 'idle';
    this.phaseT = 0;
    this.fireworks = [];
    if (this.finaleStop === this.current()) this.ctx.progress.setMapStop(this.total);
    this.hint.reset();
    this.ctx.timer.checkpoint();
  }

  onPointer(e) {
    if (e.type === 'down') {
      this.hint.reset();
      this.sinceTouch = 0;
      this.press = { x: e.x, y: e.y, cam: this.cam, panned: false };
    } else if (e.type === 'move') {
      if (!this.press || this.phase !== 'idle') return;
      const dx = e.x - this.press.x;
      if (!this.press.panned && Math.abs(dx) > PAN_SLOP) this.press.panned = true;
      if (this.press.panned) {
        this.camGoal = clamp(this.press.cam - dx, 0, this._camFor(1e9));
        this.cam = this.camGoal;
      }
      this.sinceTouch = 0;
    } else if (e.type === 'up') {
      const pr = this.press;
      this.press = null;
      this.sinceTouch = 0;
      if (pr && !pr.panned) this._tap(pr.x, pr.y);
    } else if (e.type === 'cancel') {
      this.press = null;
    }
  }

  update(dt) {
    this.t += dt;
    this.phaseT += dt;
    for (const k of Object.keys(this.shake)) {
      this.shake[k] -= dt;
      if (this.shake[k] <= 0) delete this.shake[k];
    }
    if (this.phase === 'drive') {
      const k = easeInOut(this.phaseT / DRIVE_TIME);
      this.carX = lerp(this.drive.from, this.drive.to, k);
      this.camGoal = this._camFor(this.carX);
      this.cam = this.camGoal;
      if (this.phaseT >= DRIVE_TIME) { this.phase = 'idle'; this.drive = null; this.carX = stopX(this.current()); this.hint.reset(); }
      return;
    }
    if (this.phase === 'finale') {
      this._updateFireworks(dt);
      if (this.phaseT >= Math.max(6, this.paradeTime)) this._endFinale();
      return;
    }
    // idle: камера возвращается к машине, если её листали
    this.carX = stopX(Math.min(this.current(), this.total - 1));
    if (!this.press) {
      this.sinceTouch += dt;
      if (this.sinceTouch >= RETURN_AFTER) this.camGoal = this._camFor(this.carX);
    }
    if (!this.press) {
      const d = this.camGoal - this.cam;
      this.cam = Math.abs(d) < 1 ? this.camGoal : this.cam + d * Math.min(1, dt * 6);
    }
    if (this.current() < this.total && this.hint.update(dt)) {
      this.camGoal = this._camFor(this.carX);
      this.ctx.audio.say('map-hint');
    }
  }

  _updateFireworks(dt) {
    const r = this.ctx.random;
    if (r() < dt * 3) {
      const x = 300 + r() * 600, y = 200 + r() * 140, c = Math.floor(r() * 5);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        this.fireworks.push({ x, y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, t: 0, c });
      }
      if (r() < 0.5) this.ctx.audio.play('fx/snap');
    }
    for (const f of this.fireworks) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 120 * dt; }
    this.fireworks = this.fireworks.filter((f) => f.t < 1.2);
  }

  // ---------- рисование ----------

  carRect() {
    const m = this.car();
    if (!m) return null;
    const k = CAR_W / m.size.w;
    const w = CAR_W, h = m.size.h * k;
    const x = this.carX - this.cam - w / 2 + 40;
    const y = roadY(this.carX) + 34 - h;
    return { x, y, w, h };
  }

  draw(g) {
    const a = this.ctx.assets;
    g.drawImage(a.image('bg/map'), 0, 0, 1024, 768);
    this._drawRoad(g);
    for (let i = 0; i < this.total; i++) {
      const x = stopX(i) - this.cam;
      if (x < -200 || x > 1224) continue;
      this._drawStop(g, i);
    }
    if (this.phase !== 'finale') {
      const r = this.carRect();
      if (r) {
        const bob = this.phase === 'drive' ? Math.sin(this.t * 20) * 2 : Math.sin(this.t * 2) * 1.5;
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath(); g.ellipse(r.x + r.w / 2, r.y + r.h - 2, r.w / 2, 9, 0, 0, Math.PI * 2); g.fill();
        g.drawImage(a.image('machine/' + this.car().id + '/whole/idle'), r.x, r.y + bob, r.w, r.h);
      }
    } else {
      this._drawFinale(g);
    }
    const tg = this.target;
    if (tg && this.hint.showHand()) drawHand(g, a, tg.x, tg.y, tg.x, tg.y, this.hint.handPhase());
  }

  _drawRoad(g) {
    const x0 = Math.max(stopX(0) - 260, this.cam - 40);
    const x1 = Math.min(stopX(this.total - 1) + 260, this.cam + 1064);
    if (x1 <= x0) return;
    const pts = [];
    for (let x = x0; x <= x1; x += 16) pts.push([x - this.cam, roadY(x)]);
    pts.push([x1 - this.cam, roadY(x1)]);
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); };
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#5d6470'; g.lineWidth = 78; path(); g.stroke();
    g.strokeStyle = '#8a9099'; g.lineWidth = 64; path(); g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.setLineDash([22, 22]); path(); g.stroke();
    g.setLineDash([]);
    // пройденный путь — жёлтой полосой по краю
    const done = stopX(Math.min(this.current(), this.total - 1));
    const dx1 = Math.min(x1, this.phase === 'drive' ? this.carX : done);
    if (dx1 > x0) {
      const dp = pts.filter((p) => p[0] + this.cam <= dx1);
      if (dp.length > 1) {
        g.strokeStyle = 'rgba(255,211,77,0.9)'; g.lineWidth = 8;
        g.beginPath(); g.moveTo(dp[0][0], dp[0][1] + 34); for (const p of dp) g.lineTo(p[0], p[1] + 34); g.stroke();
      }
    }
    g.restore();
  }

  _drawStop(g, i) {
    const a = this.ctx.assets;
    const stop = this.stops[i];
    const st = this.stopState(i);
    const wx = stopX(i);
    let x = wx - this.cam;
    if (this.shake[i]) x += Math.sin(this.shake[i] * 40) * 6;
    const y = roadY(wx);
    const cy = y - 150; // центр знака
    const bounce = st === 'current' && this.phase === 'idle' ? -Math.abs(Math.sin(this.t * 3)) * 8 : 0;
    // столбик
    g.fillStyle = '#8a5a3c';
    g.fillRect(x - 6, cy + 40, 12, y - 40 - cy - 40 + 20);
    if (st === 'current' && this.phase === 'idle') drawGlowRect(g, x, cy + bounce, SIGN + 6, SIGN + 6, this.t);
    g.save();
    if (st === 'locked') g.globalAlpha = 0.55;
    if (stop.kind === 'build') this._drawBuildSign(g, x, cy + bounce, stop, st);
    else if (stop.kind === 'assembly') this._drawAssemblySign(g, x, cy + bounce, stop);
    else if (stop.kind === 'finale') this._drawFinaleSign(g, x, cy + bounce);
    else g.drawImage(a.image(SERVICE_ICON[stop.kind]), x - SIGN / 2, cy - SIGN / 2 + bounce, SIGN, SIGN);
    g.restore();
    if (st === 'locked') g.drawImage(a.image('ui/lock'), x + 14, cy + 10, 56, 56);
    if (st === 'passed') this._star(g, x + SIGN / 2 - 12, cy - SIGN / 2 + 10, 18, '#ffd34d');
    // начало участка — флажок
    if (stop.kind === SERVICES[stop.section % SERVICES.length] && i > 0) this._sectionFlag(g, x - SPACING / 2, roadY(wx - SPACING / 2), stop.section);
  }

  _sectionFlag(g, x, y, section) {
    const colors = ['#e8574a', '#3b7dd8', '#2fa84f', '#f08a24', '#8b5cf6'];
    g.fillStyle = '#5b3a1e';
    g.fillRect(x - 3, y - 110, 6, 80);
    g.fillStyle = colors[section % colors.length];
    g.beginPath(); g.moveTo(x + 3, y - 110); g.lineTo(x + 46, y - 96); g.lineTo(x + 3, y - 82); g.closePath(); g.fill();
  }

  _star(g, x, y, r, color) {
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    g.closePath(); g.fill();
    g.strokeStyle = '#b8860b'; g.lineWidth = 2; g.stroke();
  }

  // Знак стройки: жёлтый круг, домик и кран; построенный объект — домик цветной.
  _drawBuildSign(g, x, cy, stop, st) {
    const done = this.ctx.progress.objectState(stop.object).done;
    const r = SIGN / 2 - 4;
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.beginPath(); g.arc(x + 2, cy + 4, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = done ? '#7ed957' : '#ffc21a';
    g.beginPath(); g.arc(x, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 6;
    g.beginPath(); g.arc(x, cy, r - 3, 0, Math.PI * 2); g.stroke();
    // домик
    g.fillStyle = done ? '#e8574a' : '#ffffff';
    g.fillRect(x - 30, cy - 2, 44, 34);
    g.fillStyle = done ? '#3d5a80' : '#ffffff';
    g.beginPath(); g.moveTo(x - 38, cy); g.lineTo(x - 8, cy - 28); g.lineTo(x + 22, cy); g.closePath(); g.fill();
    if (!done) {
      g.fillStyle = '#ffc21a';
      g.fillRect(x - 14, cy + 10, 12, 22);
    }
    // кран
    g.strokeStyle = '#333'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + 32, cy + 34); g.lineTo(x + 32, cy - 34); g.lineTo(x - 4, cy - 34); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + 6, cy - 34); g.lineTo(x + 6, cy - 16); g.stroke();
  }

  _drawAssemblySign(g, x, cy, stop) {
    const a = this.ctx.assets;
    const m = this.machines.find((q) => q.id === stop.machine);
    const p = this.ctx.progress;
    g.fillStyle = '#ffffff';
    roundRect(g, x - SIGN / 2 - 10, cy - SIGN / 2 + 6, SIGN + 20, SIGN - 12, 22); g.fill();
    g.fillStyle = '#e6eef7';
    roundRect(g, x - SIGN / 2 - 4, cy - SIGN / 2 + 12, SIGN + 8, SIGN - 24, 18); g.fill();
    if (m) {
      const pose = p.isAssembled(m.id) ? 'idle' : 'silhouette';
      const w = SIGN + 4, h = m.size.h * (w / m.size.w);
      g.drawImage(a.image('machine/' + m.id + '/whole/' + pose), x - w / 2, cy - h / 2 + 4, w, h);
    }
    g.drawImage(a.image('ui/icon-assembly'), x - SIGN / 2 - 18, cy - SIGN / 2 - 14, 54, 54);
  }

  _drawFinaleSign(g, x, cy) {
    const colors = ['#e8574a', '#ffd34d', '#3b7dd8', '#2fa84f', '#d0459a'];
    g.fillStyle = '#20314a';
    g.beginPath(); g.arc(x, cy, SIGN / 2 - 4, 0, Math.PI * 2); g.fill();
    g.lineWidth = 5; g.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + this.t * 0.5;
      g.strokeStyle = colors[i % colors.length];
      g.beginPath(); g.moveTo(x + Math.cos(ang) * 12, cy + Math.sin(ang) * 12); g.lineTo(x + Math.cos(ang) * 44, cy + Math.sin(ang) * 44); g.stroke();
    }
    this._star(g, x, cy, 16, '#ffd34d');
  }

  _drawFinale(g) {
    const a = this.ctx.assets;
    // тёмное вечернее небо для салюта
    g.fillStyle = 'rgba(20,30,60,' + (0.45 * Math.min(1, this.phaseT)).toFixed(3) + ')';
    g.fillRect(0, 0, 1024, 768);
    const colors = ['#e8574a', '#ffd34d', '#5cc8ff', '#7ed957', '#ff7ad9'];
    for (const f of this.fireworks) {
      g.globalAlpha = clamp(1 - f.t / 1.2, 0, 1);
      g.fillStyle = colors[f.c];
      g.beginPath(); g.arc(f.x, f.y, 6, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // парад: все открытые машины едут по дороге внизу слева направо
    const ground = 700;
    for (const { m, k } of this.parade) {
      const x = -200 + this.phaseT * PARADE_SPEED - k * PARADE_GAP;
      if (x < -200 || x > 1024) continue;
      const w = 180, h = m.size.h * (w / m.size.w);
      g.drawImage(a.image('machine/' + m.id + '/whole/idle'), x, ground - h + Math.sin(this.t * 12 + k) * 2, w, h);
    }
  }
}
