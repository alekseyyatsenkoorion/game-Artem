// Перетягивание каната (spec.md, раздел 4 «Перетягивание каната»).
// Слева машина игрока, справа соперник, между ними канат, посередине лужа.
// Каждый тык по своей машине — рывок каната к себе; соперник тянет ровно и постоянно.
// Случайностей в исходе нет: всё решает темп тыков (тесты 2.25–2.28, 2.43–2.46).
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand, drawGlowRect } from '../core/ui.js';
import { clamp, easeOut, lerp, logError } from '../core/draw-utils.js';
import { staticMachine, validMachine, hasImage, drawBackground, stopSound } from './common.js';

// ---------- модель (без экрана) ----------

// Положение каната p: 0 — середина; +1 — канат у игрока, соперник в луже (победа);
// −1 — канат у соперника, машина игрока в луже (поражение).
// Все числа подбора — здесь. Настоящий подбор темпа — на ребёнке (spec.md).
export const TAP_STEP = 0.105;   // рывок каната от одного тыка, доля пути от середины до края
export const MARGIN = 0.1;       // перевес в секунду, когда игрок тыкает ровно в нужном темпе
// tempo — нужный темп (тыков в секунду); rivalSpeed — как быстро тянет соперник (доля пути в секунду).
// rivalSpeed = tempo × TAP_STEP − MARGIN: ровный темп не ниже нужного всегда перетягивает.
// Без тыков от середины до лужи: 1 / rivalSpeed секунд — 9,1 / 4,7 / 3,1 с (не меньше 3 с, тест 2.45).
export const LEVELS = {
  easy: { tempo: 2, rivalSpeed: 0.11 },
  medium: { tempo: 3, rivalSpeed: 0.215 },
  hard: { tempo: 4, rivalSpeed: 0.32 },
};
export const LEVEL_ORDER = ['easy', 'medium', 'hard'];
// Ничьей и зависания нет (тест 2.26): после OVERTIME_AFTER секунд канат всё сильнее
// сползает к тому, кто впереди; в ROUND_LIMIT раунд решается по положению каната.
export const OVERTIME_AFTER = 20;
export const OVERTIME_ACCEL = 0.05;
export const ROUND_LIMIT = 45;

export function nextLevel(level) {
  const i = LEVEL_ORDER.indexOf(level);
  return LEVEL_ORDER[(i + 1) % LEVEL_ORDER.length];
}

// «Тянущий»: speed — ровная тяга в секунду (компьютер), step — рывок за тык (человек).
// Обе стороны устроены одинаково; второй стороной может управлять компьютер или человек (тест 2.28).
export class Puller {
  constructor({ speed = 0, step = TAP_STEP } = {}) {
    this.speed = speed;
    this.step = step;
  }
}

export function humanPuller() { return new Puller({ speed: 0, step: TAP_STEP }); }
export function computerPuller(level) {
  const L = LEVELS[level] || LEVELS.easy;
  return new Puller({ speed: L.rivalSpeed, step: TAP_STEP });
}

export class TugModel {
  constructor({ level = 'easy', player, rival } = {}) {
    this.level = LEVELS[level] ? level : 'easy';
    this.player = player || humanPuller();
    this.rival = rival || computerPuller(this.level);
    this.p = 0;
    this.t = 0;
    this.taps = 0;
    this.result = null; // 'won' | 'lost'
  }

  get over() { return this.result !== null; }

  // Тык стороны: 'player' тянет к +1, 'rival' — к −1.
  tap(side = 'player') {
    if (this.result) return false;
    const s = side === 'rival' ? this.rival : this.player;
    this.p += (side === 'rival' ? -1 : 1) * s.step;
    if (side !== 'rival') this.taps++;
    this._check();
    return true;
  }

  update(dt) {
    if (this.result || !(dt > 0)) return;
    this.t += dt;
    this.p += (this.player.speed - this.rival.speed) * dt;
    if (this.t > OVERTIME_AFTER) this.p += (this.p >= 0 ? 1 : -1) * OVERTIME_ACCEL * (this.t - OVERTIME_AFTER) * dt;
    this._check();
    if (!this.result && this.t >= ROUND_LIMIT) this.result = this.p > 0 ? 'won' : 'lost';
  }

  _check() {
    if (this.p >= 1) { this.p = 1; this.result = 'won'; }
    else if (this.p <= -1) { this.p = -1; this.result = 'lost'; }
  }
}

// Прогон раунда по записи тыков игрока (секунды от начала). Для тестов и подбора констант.
export function simulate(level, taps, { dt = 1 / 60, rival } = {}) {
  const m = new TugModel({ level, rival });
  const list = (taps || []).slice().sort((a, b) => a - b);
  let i = 0;
  while (!m.over) {
    m.update(dt);
    while (!m.over && i < list.length && list[i] <= m.t) { m.tap('player'); i++; }
  }
  return { result: m.result, time: m.t, p: m.p, taps: m.taps };
}

// ---------- сцена ----------

const GROUND_Y = 610;                   // низ колёс машин
export const PUDDLE = { x: 512, y: 600, rx: 150, ry: 34 };
const PLAYER_REAR_X = 352;              // задний край машины игрока при p ≥ 0
const RIVAL_REAR_X = 672;               // задний край соперника при p ≤ 0
const REACH = 95;                       // насколько проигрывающего подтаскивает к луже при |p| = 1
const PLAYER_SCALE = 0.44;
const RIVAL_SCALE = { easy: 0.4, medium: 0.47, hard: 0.55 }; // сильный — крупнее
const HOOK_H = 0.36;                    // крюк каната: доля высоты машины от земли
const TAP_PAD = 80;                     // промах рядом с машиной засчитывается
const INTRO_MAX = 4;                    // канат стоит, пока голос объясняет (или до первого тыка)
const SLIDE_TIME = 1.5;                 // съезжает в лужу
const FINISH_MIN = 2.6;
const FINISH_MAX = 6.5;
const PULL_VOICE_EVERY = 3.5;

export class TugScene extends Scene {
  static id = 'tug';

  // Соперника выбирают по прогрессу при входе: его картинки сцена догружает сама в enter и выгружает в exit.
  static assets(params) {
    const m = staticMachine(params);
    const list = ['bg/tug', 'ui/hand'];
    if (!m) return list;
    return list.concat(['machine/' + m.id + '/whole/idle', 'machine/' + m.id + '/whole/dirty']);
  }

  enter(params) {
    const ctx = this.ctx;
    this.t = 0;
    this.hint = new IdleHint();
    this.handles = [];
    this.engine = null;
    this.extraAssets = [];
    this.target = null;
    this.puffs = [];
    this.drops = [];
    const m = validMachine(ctx, params.machine, 'Tug');
    if (!m) { this.broken = true; return; }
    this.machine = m;
    const st = (ctx.progress.tug && ctx.progress.tug()) || {};
    this.tugState = { nextLevel: LEVELS[st.nextLevel] ? st.nextLevel : 'easy', wins: st.wins | 0, losses: st.losses | 0 };
    this.level = this.tugState.nextLevel;
    this.rivalMachine = this._pickRival(m.id, this.level, this.tugState.wins + this.tugState.losses);
    if (!this.rivalMachine) { this.broken = true; return; }
    const r = this.rivalMachine;
    this.extraAssets = ['machine/' + r.id + '/whole/idle', 'machine/' + r.id + '/whole/dirty'];
    for (const id of this.extraAssets) ctx.assets.image(id); // рисуем заранее, чтобы не было рывка в финале
    this.model = new TugModel({ level: this.level });
    this.ps = PLAYER_SCALE;
    this.rs = RIVAL_SCALE[this.level];
    this.vp = 0;          // положение каната на экране (плавно догоняет модель)
    this.vel = 0;         // сглаженная скорость каната — куда он уходит
    this.jerk = 0;
    this.pullCooldown = PULL_VOICE_EVERY;
    this.puffClock = 0;
    this.state = 'intro'; // intro → play → won / lost
    this.introVoiceDone = false;
    this.end = null;
    this.taps = 0;
    this._play('horn/' + m.id);
    ctx.audio.say('tug-start').then(() => { this.introVoiceDone = true; });
    this._updateTarget();
  }

  _pickRival(playerId, level, rounds) {
    const all = ((this.ctx.data && this.ctx.data.machines) || [])
      .filter((x) => x && x.id !== playerId && x.size && x.size.w > 0 && x.size.h > 0)
      .slice().sort((a, b) => (a.order | 0) - (b.order | 0));
    let list = all.filter((x) => x.tug === level);
    if (!list.length) list = all;
    if (!list.length) { logError('Tug', 'нет соперника для каната', playerId); return null; }
    return list[rounds % list.length];
  }

  _play(id, opts) {
    const h = this.ctx.audio.play(id, opts);
    this.handles = this.handles.filter((x) => x && !x.stopped);
    this.handles.push(h);
    return h;
  }

  _startEngine() {
    if (!this.engine && (this.state === 'play' || this.state === 'intro')) this.engine = this._play('engine/' + this.machine.id, { loop: true, volume: 0.3 });
  }

  // ---------- геометрия ----------

  _w(m, s) { return m.size.w * s; }
  _h(m, s) { return m.size.h * s; }

  // Задний край машины игрока (справа, машина смотрит влево) и соперника (слева, смотрит вправо).
  playerRear() {
    if (this.end && this.end.loser === 'player') return this.end.x;
    return PLAYER_REAR_X + Math.max(0, -this.vp) * REACH;
  }

  rivalRear() {
    if (this.end && this.end.loser === 'rival') return this.end.x;
    return RIVAL_REAR_X - Math.max(0, this.vp) * REACH;
  }

  _bottom(side) { return this.end && this.end.loser === side ? this.end.y : GROUND_Y; }
  _tilt(side) { return this.end && this.end.loser === side ? this.end.tilt : 0; }

  playerBounds() {
    const w = this._w(this.machine, this.ps), h = this._h(this.machine, this.ps);
    const rx = this.playerRear() - this.jerk * 10;
    return { x: rx - w, y: this._bottom('player') - h, w, h };
  }

  rivalBounds() {
    const r = this.rivalMachine;
    const w = this._w(r, this.rs), h = this._h(r, this.rs);
    return { x: this.rivalRear(), y: this._bottom('rival') - h, w, h };
  }

  _hook(side) {
    const m = side === 'player' ? this.machine : this.rivalMachine;
    const s = side === 'player' ? this.ps : this.rs;
    const x0 = side === 'player' ? this.playerRear() - this.jerk * 10 : this.rivalRear();
    const y0 = this._bottom(side);
    const a = this._tilt(side), hh = HOOK_H * this._h(m, s);
    return { x: x0 + hh * Math.sin(a), y: y0 - hh * Math.cos(a) };
  }

  _updateTarget() {
    if (this.state === 'intro' || this.state === 'play') {
      const b = this.playerBounds();
      this.target = { kind: 'tap', x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) };
    } else {
      this.target = null;
    }
  }

  // ---------- логика ----------

  hits(x, y) {
    const b = this.playerBounds();
    return x >= b.x - TAP_PAD && x <= b.x + b.w + TAP_PAD && y >= b.y - TAP_PAD && y <= b.y + b.h + TAP_PAD;
  }

  // Тык по своей машине: рывок каната к себе.
  pull() {
    if (this.state !== 'intro' && this.state !== 'play') return false;
    if (this.state === 'intro') this._beginPlay();
    this.model.tap('player');
    this.taps++;
    this.jerk = 1;
    const b = this.playerBounds();
    if (this.puffs.length < 12) this.puffs.push({ x: b.x + b.w * 0.25, y: GROUND_Y - 8, t: 0, dir: -1 });
    if (this.model.over) this._endRound();
    return true;
  }

  _beginPlay() {
    this.state = 'play';
    this._startEngine();
  }

  onPointer(e) {
    if (this.broken) return;
    if (e.type !== 'down') return;
    this.hint.reset();
    if (this.hits(e.x, e.y)) this.pull();
  }

  update(dt) {
    if (this.broken) { this.broken = false; this.ctx.scenes.back(); return; }
    this.t += dt;
    this.jerk = Math.max(0, this.jerk - dt / 0.15);
    this._updateParticles(dt);
    if (this.state === 'intro') {
      if (this.t >= INTRO_MAX || (this.introVoiceDone && this.t >= 1)) this._beginPlay();
    } else if (this.state === 'play') {
      const p0 = this.model.p;
      this.model.update(dt);
      const v = (this.model.p - p0) / dt;
      this.vel += (v - this.vel) * Math.min(1, dt * 2);
      if (this.model.over) this._endRound();
      else {
        this.pullCooldown -= dt;
        // канат уходит к сопернику — голос подгоняет (не чаще раза в 3,5 с)
        if (this.pullCooldown <= 0 && this.model.p < -0.12 && this.vel < -0.03) {
          this.pullCooldown = PULL_VOICE_EVERY;
          this.ctx.audio.say('tug-pull');
        }
        if (this.hint.update(dt)) this.ctx.audio.say('tug-start');
      }
    } else if (this.end) {
      this._updateEnd(dt);
    }
    // плавное положение каната на экране
    this.vp += (this.model.p - this.vp) * Math.min(1, dt * 12);
    this._updateTarget();
  }

  _updateParticles(dt) {
    for (const q of this.puffs) q.t += dt;
    this.puffs = this.puffs.filter((q) => q.t < 0.6);
    for (const d of this.drops) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 900 * dt; }
    this.drops = this.drops.filter((d) => d.t < 1);
    // пыль из-под колёс того, кто сейчас тянет
    if (this.state === 'play') {
      this.puffClock += dt;
      if (this.puffClock >= 0.35) {
        this.puffClock = 0;
        const b = this.rivalBounds();
        if (this.puffs.length < 12) this.puffs.push({ x: b.x + b.w * 0.75, y: GROUND_Y - 8, t: 0, dir: 1 });
      }
    }
  }

  _endRound() {
    const ctx = this.ctx;
    const won = this.model.result === 'won';
    this.vp = this.model.p;
    this.state = won ? 'won' : 'lost';
    this.won = won;
    this.engine = stopSound(this.engine);
    const loser = won ? 'rival' : 'player';
    const m = won ? this.rivalMachine : this.machine;
    const s = won ? this.rs : this.ps;
    const w = this._w(m, s);
    const fromX = won ? this.rivalRear() : this.playerRear();
    // машина съезжает задом в лужу и встаёт посередине неё
    const toX = won ? PUDDLE.x - w / 2 : PUDDLE.x + w / 2;
    this.end = { loser, t: 0, fromX, toX, x: fromX, y: GROUND_Y, tilt: 0, landed: false, dirty: 0, voiceDone: false, finished: false };
    // прогресс — сразу, выход может быть внезапным
    const ts = this.tugState;
    ctx.progress.saveTug({ nextLevel: nextLevel(this.level), wins: ts.wins + (won ? 1 : 0), losses: ts.losses + (won ? 0 : 1) });
    const done = () => { if (this.end) this.end.voiceDone = true; };
    if (won) {
      this._play('fx/win');
      this._play('horn/' + this.machine.id);
      ctx.audio.say('tug-won', {}, { priority: 'high' }).then(done);
    } else {
      const ph = ctx.data.phrases || {};
      const name = ph[this.rivalMachine.namePhrase] || '';
      ctx.audio.say('tug-lost', { machine: name }, { priority: 'high' }).then(done);
    }
    this._updateTarget();
  }

  _updateEnd(dt) {
    const E = this.end;
    E.t += dt;
    const k = Math.min(1, E.t / SLIDE_TIME);
    const kk = easeOut(k);
    E.x = lerp(E.fromX, E.toX, kk);
    E.y = GROUND_Y + (PUDDLE.y + 14 - GROUND_Y) * kk;
    // смешно покачивается, задирая нос
    const sign = E.loser === 'player' ? 1 : -1;
    E.tilt = sign * (0.1 * kk + 0.08 * Math.sin(E.t * 16) * (1 - k));
    if (!E.landed && k >= 0.8) {
      E.landed = true;
      this._play('fx/splash');
      for (let i = 0; i < 14; i++) {
        const a = Math.PI * (0.1 + 0.8 * i / 13);
        const sp = 260 + (i % 3) * 70;
        this.drops.push({ x: PUDDLE.x + Math.cos(a) * PUDDLE.rx * 0.6, y: PUDDLE.y, vx: Math.cos(a) * sp * 0.6, vy: -Math.sin(a) * sp, t: 0 });
      }
    }
    if (E.landed) E.dirty = Math.min(1, E.dirty + dt / 0.4);
    if (!E.finished && E.t >= FINISH_MIN && (E.voiceDone || E.t >= FINISH_MAX)) {
      E.finished = true;
      this.ctx.timer.checkpoint();
      this.ctx.scenes.finish({ done: true, won: this.won, level: this.level });
    }
  }

  canExit() { return !(this.end && this.end.t < 1.8); }

  pause() {
    this.engine = stopSound(this.engine);
    for (const h of this.handles) stopSound(h);
    this.handles = [];
  }

  resume() { if (this.state === 'play') this._startEngine(); }

  exit() {
    this.pause();
    if (this.extraAssets && this.extraAssets.length) {
      try { this.ctx.assets.release(this.extraAssets); } catch (e) { /* ничего */ }
      this.extraAssets = [];
    }
  }

  // ---------- рисование ----------

  draw(g) {
    const a = this.ctx.assets;
    const bgReady = hasImage(a, 'bg/tug');
    drawBackground(g, a, 'bg/tug', '#a8dcff', '#8bc34a');
    if (!this.machine || !this.rivalMachine) return;
    if (!bgReady) this._drawPuddle(g);
    this._drawRipples(g);
    const playing = this.state === 'play';
    const shake = playing ? Math.sin(this.t * 40) * 1.2 : 0;
    // канат под машинами не прячется: сначала машины, потом канат поверх крюков
    this._drawMachine(g, 'rival', playing ? -shake : 0);
    this._drawMachine(g, 'player', playing ? shake : 0);
    this._drawRope(g);
    this._drawPuffs(g);
    this._drawDrops(g);
    if (this.state === 'intro' || this.state === 'play') {
      const b = this.playerBounds();
      drawGlowRect(g, b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, this.t);
      if (this.hint.showHand()) drawHand(g, a, b.x + b.w / 2, b.y + b.h / 2, b.x + b.w / 2, b.y + b.h / 2, this.hint.handPhase());
    }
  }

  _drawPuddle(g) {
    const P = PUDDLE;
    g.save();
    g.fillStyle = '#6d5a3e';
    g.beginPath(); g.ellipse(P.x, P.y, P.rx + 12, P.ry + 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7fa7c9';
    g.beginPath(); g.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath(); g.ellipse(P.x - P.rx * 0.35, P.y - P.ry * 0.35, P.rx * 0.3, P.ry * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  _drawRipples(g) {
    const E = this.end;
    if (!E || !E.landed) return;
    const k = clamp((E.t - SLIDE_TIME * 0.8) / 1.2, 0, 1);
    if (k >= 1) return;
    g.save();
    g.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - k)).toFixed(3) + ')';
    g.lineWidth = 5;
    g.beginPath(); g.ellipse(PUDDLE.x, PUDDLE.y, PUDDLE.rx * (0.5 + 0.6 * k), PUDDLE.ry * (0.5 + 0.6 * k), 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  _drawMachine(g, side, dy) {
    const a = this.ctx.assets;
    const isPlayer = side === 'player';
    const m = isPlayer ? this.machine : this.rivalMachine;
    const s = isPlayer ? this.ps : this.rs;
    const x = isPlayer ? this.playerRear() - this.jerk * 10 : this.rivalRear();
    const y = this._bottom(side) + dy;
    const W = m.size.w, H = m.size.h;
    const E = this.end;
    const dirty = E && E.loser === side ? E.dirty : 0;
    g.save();
    g.translate(x, y);
    g.rotate(this._tilt(side));
    g.scale(isPlayer ? -s : s, s); // игрок смотрит влево, соперник — вправо: оба тянут от лужи
    if (dirty < 1) g.drawImage(a.image('machine/' + m.id + '/whole/idle'), 0, -H, W, H);
    if (dirty > 0) {
      g.globalAlpha = dirty;
      g.drawImage(a.image('machine/' + m.id + '/whole/dirty'), 0, -H, W, H);
    }
    g.restore();
  }

  _drawRope(g) {
    const A = this._hook('player'), B = this._hook('rival');
    const slack = this.end ? 26 : 8;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 + slack;
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = '#7a5020'; g.lineWidth = 13;
    g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(mx, my, B.x, B.y); g.stroke();
    g.strokeStyle = '#c99a52'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(A.x, A.y); g.quadraticCurveTo(mx, my, B.x, B.y); g.stroke();
    // крюки
    g.fillStyle = '#3b4250';
    g.beginPath(); g.arc(A.x, A.y, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(B.x, B.y, 9, 0, Math.PI * 2); g.fill();
    // красная ленточка посередине каната — видно, куда он ползёт
    const cx = 0.25 * A.x + 0.5 * mx + 0.25 * B.x;
    const cy = 0.25 * A.y + 0.5 * my + 0.25 * B.y;
    g.fillStyle = '#e53935';
    g.beginPath(); g.moveTo(cx - 9, cy - 4); g.lineTo(cx + 9, cy - 4); g.lineTo(cx + 4, cy + 34); g.lineTo(cx - 4, cy + 34); g.closePath(); g.fill();
    g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  _drawPuffs(g) {
    if (!this.puffs.length) return;
    g.save();
    for (const q of this.puffs) {
      const k = q.t / 0.6;
      g.globalAlpha = 0.55 * (1 - k);
      g.fillStyle = '#d8cbb0';
      g.beginPath(); g.arc(q.x + q.dir * 40 * k, q.y - 14 * k, 10 + 16 * k, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  _drawDrops(g) {
    if (!this.drops.length) return;
    g.save();
    g.fillStyle = '#5f9fd6';
    for (const d of this.drops) {
      if (d.y > PUDDLE.y + 10) continue;
      g.globalAlpha = Math.max(0, 1 - d.t);
      g.beginPath(); g.arc(d.x, d.y, 7, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
}
