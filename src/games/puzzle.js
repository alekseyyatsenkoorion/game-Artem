// Пазл 16 и 25 (spec.md, раздел 4 «Пазлы»). Куски с фигурными краями, не поворачиваются;
// на поле бледный образец; кусок встаёт только на своё место; сохранение после каждого куска.
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand, drawGlowRect } from '../core/ui.js';
import { dist, easeOut, lerp, shuffle, logError, roundRect, CROSS_ZONE } from '../core/draw-utils.js';
import { cutPuzzle, tracePiece, pieceMargin } from './puzzle-cut.js';
import { staticMachine, validMachine, hasImage, drawBackground, drawSparkles, Finale } from './common.js';

export const SIZES = { 16: { cols: 4, rows: 4 }, 25: { cols: 5, rows: 5 } };
// Поле: у пазла 25 поле меньше, чтобы куски на лотке вокруг оставались крупными.
export const BOARDS = { 16: { x: 212, y: 159, w: 600, h: 450 }, 25: { x: 252, y: 150, w: 520, h: 390 } };
export const BOARD = BOARDS[16];
const GAP = 6;
const NEAR_MISS = 60;
const MIN_TOUCH = 100;

// Раскладка кусков вокруг поля: верх (кроме зоны крестика), низ, слева и справа от поля.
// Масштаб кусков на лотке — наибольший, при котором все помещаются без наложений.
export function layoutPuzzleTray(cut, board, random) {
  const m = pieceMargin(cut);
  const bw0 = cut.cw + 2 * m, bh0 = cut.ch + 2 * m;
  const n = cut.pieces.length;
  const cz = CROSS_ZONE.x + CROSS_ZONE.w + 4;
  const regions = [
    { x: cz, y: 4, w: 1024 - cz - 4, h: board.y - 8 },
    { x: 4, y: board.y + board.h + 4, w: 1016, h: 768 - board.y - board.h - 8 },
    { x: 4, y: board.y, w: board.x - 8, h: board.h },
    { x: board.x + board.w + 4, y: board.y, w: 1024 - board.x - board.w - 8, h: board.h },
  ];
  for (let s = 1; s >= 0.3; s -= 0.025) {
    const bw = bw0 * s, bh = bh0 * s;
    const slots = [];
    for (const r of regions) {
      const cols = Math.floor((r.w + GAP) / (bw + GAP));
      const rows = Math.floor((r.h + GAP) / (bh + GAP));
      if (cols < 1 || rows < 1) continue;
      const sx = (r.w - cols * bw) / (cols + 1), sy = (r.h - rows * bh) / (rows + 1);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          slots.push({ cx: r.x + sx + i * (bw + sx) + bw / 2, cy: r.y + sy + j * (bh + sy) + bh / 2, s });
        }
      }
    }
    if (slots.length >= n) {
      const chosen = shuffle(slots, random).slice(0, n);
      const order = shuffle(cut.pieces.map((p) => p.index), random);
      const out = {};
      order.forEach((idx, i) => { out[idx] = chosen[i]; });
      return out;
    }
  }
  const out = {};
  cut.pieces.forEach((p, i) => { out[p.index] = { cx: 60 + (i % 10) * 90, cy: 680, s: 0.3 }; });
  return out;
}

export class PuzzleScene extends Scene {
  static id = 'puzzle';

  static assets(params) {
    const m = staticMachine(params);
    const list = ['bg/puzzle', 'ui/hand', 'ui/lock'];
    if (!m) return list;
    const size = Number(params.size) === 25 ? 25 : 16;
    return list.concat(['puzzle/' + m.id + '/' + size, 'machine/' + m.id + '/whole/idle', 'machine/' + m.id + '/whole/work']);
  }

  enter(params) {
    const ctx = this.ctx;
    this.t = 0;
    this.pieces = [];
    this.drag = null;
    this.hint = new IdleHint();
    this.finale = null;
    this.state = 'play';
    const m = validMachine(ctx, params.machine, 'Puzzle');
    const size = Number(params.size);
    if (!m || !SIZES[size]) {
      if (m) logError('Puzzle', 'неизвестный размер пазла', params.size);
      this.broken = true;
      return;
    }
    this.machine = m;
    this.size = size;
    this.board = BOARDS[size];
    this.picId = 'puzzle/' + m.id + '/' + size;
    this.hasPic = hasImage(ctx.assets, this.picId);
    this.facing = (m.puzzles && m.puzzles[size] && m.puzzles[size].facing) || (size === 16 ? 'left' : 'right');
    if (size === 25 && ctx.progress.puzzleState(m.id, 16) !== 'done') {
      // пазл 25 закрыт, пока не собран 16
      this.state = 'locked';
      this.lockT = 0;
      this.lockVoice = false;
      ctx.audio.say('puzzle-locked').then(() => { this.lockVoice = true; });
      return;
    }
    const { cols, rows } = SIZES[size];
    this.cut = cutPuzzle(cols, rows, this.board.w, this.board.h);
    const tray = layoutPuzzleTray(this.cut, this.board, ctx.random);
    const saved = new Set(ctx.progress.puzzlePieces(m.id, size) || []);
    this.pieces = this.cut.pieces.map((cp) => {
      const home = tray[cp.index];
      const slot = { cx: this.board.x + cp.x + cp.w / 2, cy: this.board.y + cp.y + cp.h / 2 };
      const placed = saved.has(cp.index);
      return {
        index: cp.index, cp, home, slot, placed, anim: null,
        cx: placed ? slot.cx : home.cx, cy: placed ? slot.cy : home.cy, s: placed ? 1 : home.s,
      };
    });
    this.snap = 0.6 * Math.min(this.cut.cw, this.cut.ch);
    this._bakePieces();
    if (this.isComplete()) { this._complete(); return; }
    ctx.audio.say('puzzle-task');
  }

  // Скорость: каждый кусок рисуется один раз в готовую картинку через AssetLoader (как детали машин),
  // дальше — просто drawImage, без обрезки по контуру на каждом кадре. Без register — обрезка на лету.
  _bakePieces() {
    this.bakedIds = [];
    this.paleId = null;
    this.layerId = null;
    const a = this.ctx.assets;
    if (!a || typeof a.register !== 'function') return;
    const m = pieceMargin(this.cut);
    const entries = {};
    const B = this.board;
    this.paleId = this.picId + '/pale';
    entries[this.paleId] = {
      w: B.w, h: B.h,
      draw: (g) => {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, B.w, B.h);
        g.globalAlpha = 0.28;
        this._drawPicture(g, 0, 0, B.w, B.h, 0, 0, 1);
        g.globalAlpha = 1;
      },
    };
    this.bakedIds.push(this.paleId);
    this.layerId = this.picId + '/layer';
    this.layerKey = null;
    entries[this.layerId] = {
      w: 1024, h: 768,
      draw: (g) => { const lp = this._layerParts || this._split(); this._drawStatic(g, lp.placed, lp.resting); },
    };
    this.bakedIds.push(this.layerId);
    for (const p of this.pieces) {
      const cp = p.cp;
      const id = this.picId + '/piece/' + cp.index;
      entries[id] = {
        w: cp.w + 2 * m, h: cp.h + 2 * m,
        draw: (g) => {
          tracePiece(g, this.cut, cp, m, m, 1);
          g.save(); g.clip();
          this._drawPicture(g, cp.x - m, cp.y - m, cp.x + cp.w + m, cp.y + cp.h + m, m - cp.x, m - cp.y, 1);
          g.restore();
        },
      };
      p.img = id;
      this.bakedIds.push(id);
    }
    try { a.register(entries); } catch (e) { for (const p of this.pieces) p.img = null; this.bakedIds = []; this.paleId = null; this.layerId = null; }
  }

  // ---------- логика ----------

  placedIndices() { return this.pieces.filter((p) => p.placed).map((p) => p.index).sort((a, b) => a - b); }
  isComplete() { return this.pieces.length > 0 && this.pieces.every((p) => p.placed); }
  pieceByIndex(i) { return this.pieces.find((p) => p.index === i) || null; }

  // Кусок отпущен центром в (cx, cy). Встаёт только рядом со своим местом.
  tryPlace(p, cx, cy) {
    if (p.placed || this.state !== 'play') return false;
    if (dist(cx, cy, p.slot.cx, p.slot.cy) <= this.snap) {
      p.placed = true;
      this._animate(p, p.slot.cx, p.slot.cy, 1, 0.12);
      this.ctx.audio.play('fx/snap');
      this.ctx.progress.savePuzzle(this.machine.id, this.size, this.placedIndices());
      if (this.isComplete()) this._complete();
      return true;
    }
    this._animate(p, p.home.cx, p.home.cy, p.home.s, 0.35);
    return false;
  }

  nextHintPiece() {
    let best = null;
    for (const p of this.pieces) {
      if (p.placed || (this.drag && this.drag.piece === p)) continue;
      if (!best || p.index < best.index) best = p;
    }
    return best;
  }

  _animate(p, x, y, s, dur) { p.anim = { fx: p.cx, fy: p.cy, fs: p.s, tx: x, ty: y, ts: s, t: 0, dur }; }

  _complete() {
    this.state = 'done';
    this.drag = null;
    this.ctx.progress.savePuzzle(this.machine.id, this.size, this.pieces.map((p) => p.index));
    this.ctx.audio.play('fx/win');
    this.finale = new Finale(this.ctx, { done: true, machine: this.machine.id, size: this.size }, { phrase: 'puzzle-done' });
  }

  _hit(x, y) {
    let best = null, bestD = Infinity;
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      if (p.placed) continue;
      const w = p.cp.w * p.s, h = p.cp.h * p.s;
      const dx = Math.max(0, Math.abs(x - p.cx) - w / 2);
      const dy = Math.max(0, Math.abs(y - p.cy) - h / 2);
      const d = Math.hypot(dx, dy);
      const reach = Math.max(NEAR_MISS, (MIN_TOUCH - Math.min(w, h)) / 2);
      if (d <= reach && d < bestD - 0.5) { best = p; bestD = d; }
    }
    return best;
  }

  onPointer(e) {
    if (this.broken || this.state !== 'play') return;
    this.hint.reset();
    if (e.type === 'down') {
      const p = this._hit(e.x, e.y);
      if (!p) return;
      p.anim = null;
      this.drag = { piece: p, dx: p.cx - e.x, dy: p.cy - e.y };
      this.pieces.splice(this.pieces.indexOf(p), 1);
      this.pieces.push(p);
      return;
    }
    if (!this.drag) return;
    const d = this.drag;
    if (e.type === 'move') {
      d.piece.cx = e.x + d.dx; d.piece.cy = e.y + d.dy;
    } else if (e.type === 'up') {
      this.drag = null;
      d.piece.cx = e.x + d.dx; d.piece.cy = e.y + d.dy;
      this.tryPlace(d.piece, d.piece.cx, d.piece.cy);
    } else if (e.type === 'cancel') {
      this.drag = null;
      this._animate(d.piece, d.piece.home.cx, d.piece.home.cy, d.piece.home.s, 0.35);
    }
  }

  update(dt) {
    if (this.broken) { this.broken = false; this.ctx.scenes.back(); return; }
    this.t += dt;
    if (this.state === 'locked') {
      this.lockT += dt;
      if (!this.closed && this.lockT >= 1 && (this.lockVoice || this.lockT >= 4)) { this.closed = true; this.ctx.scenes.back(); }
      return;
    }
    for (const p of this.pieces) {
      if (this.drag && this.drag.piece === p) { p.s = Math.min(1, p.s + dt * 4); continue; }
      if (p.anim) {
        const a = p.anim;
        a.t += dt;
        const k = easeOut(a.t / a.dur);
        p.cx = lerp(a.fx, a.tx, k); p.cy = lerp(a.fy, a.ty, k); p.s = lerp(a.fs, a.ts, k);
        if (a.t >= a.dur) p.anim = null;
      }
    }
    if (this.state === 'play') {
      if (this.hint.update(dt)) this.ctx.audio.say('puzzle-hint');
    } else if (this.finale) {
      this.finale.update(dt);
    }
  }

  canExit() { return !(this.finale && !this.finale.canExit()); }

  pause() {
    if (this.drag) {
      const p = this.drag.piece;
      this.drag = null;
      this._animate(p, p.home.cx, p.home.cy, p.home.s, 0.35);
    }
  }

  exit() {
    this.drag = null;
    this.pieces = [];
    const ids = this.bakedIds || [];
    if (ids.length) {
      try {
        this.ctx.assets.release(ids);
        // готовые куски выгружены; в реестре не держим ссылку на сцену
        const stub = {};
        for (const id of ids) stub[id] = { w: 1, h: 1, draw() {} };
        this.ctx.assets.register(stub);
      } catch (e) { /* ничего */ }
      this.bakedIds = [];
      this.paleId = null;
      this.layerId = null;
      this._layerParts = null;
    }
  }

  // ---------- рисование ----------

  // Часть картинки (u0, v0)–(u1, v1) в координатах поля — на экран в (dx, dy) с масштабом k.
  _drawPicture(g, u0, v0, u1, v1, dx, dy, k) {
    const a = this.ctx.assets;
    u0 = Math.max(0, u0); v0 = Math.max(0, v0); u1 = Math.min(this.board.w, u1); v1 = Math.min(this.board.h, v1);
    if (u1 <= u0 || v1 <= v0) return;
    const X = dx + u0 * k, Y = dy + v0 * k, W = (u1 - u0) * k, H = (v1 - v0) * k;
    if (this.hasPic) {
      const img = a.image(this.picId);
      const iw = img.width || this.board.w, ih = img.height || this.board.h;
      // картинка любого размера: обрезаем по центру до пропорций поля
      let cw = iw, ch = iw * this.board.h / this.board.w;
      if (ch > ih) { ch = ih; cw = ih * this.board.w / this.board.h; }
      const ox = (iw - cw) / 2, oy = (ih - ch) / 2, f = cw / this.board.w;
      g.drawImage(img, ox + u0 * f, oy + v0 * f, (u1 - u0) * f, (v1 - v0) * f, X, Y, W, H);
      return;
    }
    // Картинки пазла ещё нет: природа или стройка и машина в нужную сторону.
    g.save();
    g.beginPath(); g.rect(X, Y, W, H); g.clip();
    g.translate(dx, dy); g.scale(k, k);
    const nature = this.size === 16;
    g.fillStyle = nature ? '#8fd6ff' : '#cfe8ff';
    g.fillRect(0, 0, this.board.w, this.board.h);
    g.fillStyle = nature ? '#6cc04a' : '#c99a5b';
    g.fillRect(0, this.board.h * 0.62, this.board.w, this.board.h * 0.38);
    g.fillStyle = nature ? '#ffe066' : '#ff9f1c';
    g.beginPath(); g.arc(nature ? this.board.w - 80 : 80, 70, 40, 0, Math.PI * 2); g.fill();
    const m = this.machine;
    const pose = nature ? 'idle' : 'work';
    const sc = Math.min((this.board.w - 60) / m.size.w, (this.board.h * 0.8) / m.size.h);
    const mw = m.size.w * sc, mh = m.size.h * sc;
    const mx = (this.board.w - mw) / 2, my = this.board.h * 0.9 - mh;
    const img = a.image('machine/' + m.id + '/whole/' + pose);
    if (this.facing === 'left') {
      g.translate(mx + mw, my); g.scale(-1, 1); g.drawImage(img, 0, 0, mw, mh);
    } else {
      g.drawImage(img, mx, my, mw, mh);
    }
    g.restore();
  }

  _tracePieces(g, list) {
    g.beginPath();
    for (const p of list) {
      const k = p.s;
      tracePiece(g, this.cut, p.cp, p.cx - p.cp.w * k / 2, p.cy - p.cp.h * k / 2, k, true);
    }
  }

  _drawPiece(g, p, k, lifted) {
    const cp = p.cp;
    const ox = p.cx - cp.w * k / 2, oy = p.cy - cp.h * k / 2; // экранный угол клетки
    const m = pieceMargin(this.cut);
    if (lifted) {
      g.save();
      g.translate(8, 10);
      tracePiece(g, this.cut, cp, ox, oy, k);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fill();
      g.restore();
    }
    if (p.img) {
      g.drawImage(this.ctx.assets.image(p.img), ox - m * k, oy - m * k, (cp.w + 2 * m) * k, (cp.h + 2 * m) * k);
    } else {
      g.save();
      tracePiece(g, this.cut, cp, ox, oy, k);
      g.clip();
      this._drawPicture(g, cp.x - m, cp.y - m, cp.x + cp.w + m, cp.y + cp.h + m, ox - cp.x * k, oy - cp.y * k, k);
      g.restore();
    }
    tracePiece(g, this.cut, cp, ox, oy, k);
    g.lineWidth = p.placed ? 1.5 : 3;
    g.strokeStyle = p.placed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)';
    g.stroke();
  }

  _split() {
    const placed = [], resting = [], moving = [];
    for (const p of this.pieces) {
      if (p.placed && !p.anim) placed.push(p);
      else if (!p.anim && !(this.drag && this.drag.piece === p)) resting.push(p);
      else moving.push(p);
    }
    return { placed, resting, moving };
  }

  // Неподвижная часть кадра: фон, поле, бледный образец, стоящие и лежащие куски.
  _drawStatic(g, placed, resting) {
    const a = this.ctx.assets;
    drawBackground(g, a, 'bg/puzzle', '#b8e0ff', '#a5d6a7');
    g.fillStyle = '#ffffff';
    roundRect(g, this.board.x - 10, this.board.y - 10, this.board.w + 20, this.board.h + 20, 16); g.fill();
    if (this.paleId) {
      g.drawImage(a.image(this.paleId), this.board.x, this.board.y, this.board.w, this.board.h);
    } else {
      g.save(); g.globalAlpha = 0.28;
      this._drawPicture(g, 0, 0, this.board.w, this.board.h, this.board.x, this.board.y, 1);
      g.restore();
    }
    const m = pieceMargin(this.cut);
    const baked = this.pieces.length > 0 && !!this.pieces[0].img;
    if (baked) {
      for (const p of placed.concat(resting)) {
        const cp = p.cp, k = p.s;
        g.drawImage(a.image(p.img), p.cx - (cp.w / 2 + m) * k, p.cy - (cp.h / 2 + m) * k, (cp.w + 2 * m) * k, (cp.h + 2 * m) * k);
      }
    } else {
      // без готовых кусков: одна обрезка на все стоящие и одна на все лежащие (рамки на лотке не пересекаются)
      if (placed.length) {
        const B = this.board;
        g.save(); this._tracePieces(g, placed); g.clip();
        this._drawPicture(g, 0, 0, B.w, B.h, B.x, B.y, 1);
        g.restore();
      }
      if (resting.length) {
        g.save(); this._tracePieces(g, resting); g.clip();
        for (const p of resting) {
          const cp = p.cp, k = p.s;
          const ox = p.cx - cp.w * k / 2, oy = p.cy - cp.h * k / 2;
          this._drawPicture(g, cp.x - m, cp.y - m, cp.x + cp.w + m, cp.y + cp.h + m, ox - cp.x * k, oy - cp.y * k, k);
        }
        g.restore();
      }
    }
    if (placed.length) { this._tracePieces(g, placed); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.stroke(); }
    if (resting.length) { this._tracePieces(g, resting); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke(); }
  }

  draw(g) {
    const a = this.ctx.assets;
    if (!this.machine) { drawBackground(g, a, 'bg/puzzle', '#b8e0ff', '#a5d6a7'); return; }
    if (this.state === 'locked' || this.state === 'done') {
      drawBackground(g, a, 'bg/puzzle', '#b8e0ff', '#a5d6a7');
      g.fillStyle = '#ffffff';
      roundRect(g, this.board.x - 10, this.board.y - 10, this.board.w + 20, this.board.h + 20, 16); g.fill();
      g.save(); g.globalAlpha = this.state === 'done' ? 1 : 0.35;
      this._drawPicture(g, 0, 0, this.board.w, this.board.h, this.board.x, this.board.y, 1);
      g.restore();
      if (this.state === 'done') { drawSparkles(g, this.board.x, this.board.y, this.board.w, this.board.h, this.t); return; }
      const s = 1 + 0.08 * Math.sin(this.t * 6);
      g.drawImage(a.image('ui/lock'), 512 - 60 * s, 384 - 60 * s, 120 * s, 120 * s);
      return;
    }
    const { placed, resting, moving } = this._split();
    if (this.layerId) {
      // Скорость: неподвижная часть — одна готовая картинка; перерисовывается, только когда куски поменялись.
      let key = '';
      for (const p of this.pieces) key += p.placed && !p.anim ? 'p' : (resting.indexOf(p) >= 0 ? 'r' : 'm');
      if (key !== this.layerKey) {
        this._layerParts = { placed, resting };
        this.layerKey = key;
        a.release([this.layerId]);
      }
      g.drawImage(a.image(this.layerId), 0, 0, 1024, 768);
    } else {
      this._drawStatic(g, placed, resting);
    }
    const hp = this.nextHintPiece();
    if (hp && !this.drag) drawGlowRect(g, hp.cx, hp.cy, hp.cp.w * hp.s, hp.cp.h * hp.s, this.t);
    for (const p of moving) this._drawPiece(g, p, p.s, !!(this.drag && this.drag.piece === p));
    if (hp && !this.drag && this.hint.showHand()) drawHand(g, a, hp.cx, hp.cy, hp.slot.cx, hp.slot.cy, this.hint.handPhase());
  }

}

