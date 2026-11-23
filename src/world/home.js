// Главный экран (spec.md, раздел 4): три входа — карта, гараж, перетягивание каната.
// На этапе 2 работает только гараж; карта и канат нарисованы закрытыми (шлагбаум и замок).
// Чтобы открыть вход на этапе 3, достаточно поставить ему active: true в списке ENTRIES
// (и зарегистрировать сцену): вход сам станет рабочим.
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand, drawGlowRect } from '../core/ui.js';
import { roundRect, inRect } from '../core/draw-utils.js';
import contentData from '../data/index.js';

// Входы главного экрана. rect — зона касания в логических координатах (≥ 100 px).
export const ENTRIES = [
  { id: 'map', scene: 'map', active: false, rect: { x: 36, y: 250, w: 256, h: 380 } },
  { id: 'garage', scene: 'garage', active: true, rect: { x: 318, y: 150, w: 388, h: 480 } },
  { id: 'tug', scene: 'tug', active: false, rect: { x: 732, y: 250, w: 256, h: 380 } },
];

const GO_DELAY = 0.7; // ворота «зовут» машину, потом открывается гараж
const GROUND = 612;

function firstMachine(list) {
  const sorted = (list || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  return sorted[0] || null;
}

export class HomeScene extends Scene {
  static id = 'home';

  static assets() {
    const m = firstMachine(contentData.machines);
    const ids = ['bg/home', 'ui/hand', 'ui/lock'];
    if (m) ids.push('machine/' + m.id + '/whole/idle');
    return ids;
  }

  enter() {
    this.machine = firstMachine(this.ctx.data.machines);
    const has = (id) => !this.ctx.scenes || !this.ctx.scenes.has || this.ctx.scenes.has(id);
    // Публичное поле для тестов и e2e: {id, scene, rect, active}.
    this.entries = ENTRIES.map((e) => ({ id: e.id, scene: e.scene, rect: { ...e.rect }, active: !!e.active && has(e.scene) }));
    this.state = 'idle'; // idle | going
    this.going = null;
    this.t = 0;
    this.stateT = 0;
    this.shake = {}; // id входа → оставшееся время покачивания
    this.hint = new IdleHint();
  }

  entryAt(x, y) {
    // промах рядом с целью засчитывается
    return this.entries.find((e) => inRect(x, y, e.rect, 16)) || null;
  }

  _horn() {
    if (this.machine) this.ctx.audio.play('horn/' + this.machine.id);
  }

  onPointer(e) {
    if (e.type !== 'down') return;
    this.hint.reset();
    if (this.state !== 'idle') return;
    const en = this.entryAt(e.x, e.y);
    if (!en) return;
    if (!en.active) {
      this.shake[en.id] = 0.5;
      this._horn();
      this.ctx.audio.say('home-closed');
      return;
    }
    this.state = 'going';
    this.going = en;
    this.stateT = 0;
    if (this.machine) this.ctx.audio.play('engine/' + this.machine.id);
    this._horn();
  }

  onResult() {
    this.state = 'idle';
    this.going = null;
    this.hint.reset();
    this.ctx.timer.checkpoint();
  }

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    for (const k of Object.keys(this.shake)) {
      this.shake[k] -= dt;
      if (this.shake[k] <= 0) delete this.shake[k];
    }
    if (this.state === 'idle') {
      // главный экран — безопасная точка для родительского таймера
      if (this.ctx.timer.checkpoint()) return;
      if (this.hint.update(dt)) this.ctx.audio.say('home-hint');
    } else if (this.state === 'going' && this.stateT >= GO_DELAY) {
      const en = this.going;
      this.state = 'idle';
      this.going = null;
      this.hint.reset();
      this.ctx.scenes.open(en.scene, {});
    }
  }

  // ---------- рисование ----------

  draw(g) {
    const a = this.ctx.assets;
    g.drawImage(a.image('bg/home'), 0, 0, 1024, 768);
    for (const en of this.entries) {
      const dx = this.shake[en.id] ? Math.sin(this.shake[en.id] * 40) * 6 : 0;
      g.save();
      g.translate(dx, 0);
      if (en.id === 'garage') this._drawGarage(g, en);
      else if (en.id === 'map') this._drawMap(g, en);
      else if (en.id === 'tug') this._drawTug(g, en);
      if (!en.active) this._drawClosed(g, en);
      g.restore();
    }
    const garage = this.entries.find((e) => e.id === 'garage' && e.active);
    if (garage && this.state === 'idle' && this.hint.showHand()) {
      const r = garage.rect;
      drawGlowRect(g, r.x + r.w / 2, r.y + r.h / 2, r.w - 20, r.h - 20, this.t);
      const cx = r.x + r.w / 2, cy = r.y + r.h * 0.62;
      drawHand(g, a, cx, cy, cx, cy, this.hint.handPhase());
    }
  }

  // Здание гаража с открытыми воротами, из ворот выглядывает машина.
  _drawGarage(g, en) {
    const r = en.rect;
    const x = r.x + 14, w = r.w - 28, top = r.y + 90;
    // тень
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath(); g.ellipse(r.x + r.w / 2, GROUND + 6, r.w / 2 + 10, 16, 0, 0, Math.PI * 2); g.fill();
    // стены
    g.fillStyle = '#e8574a';
    g.fillRect(x, top, w, GROUND - top);
    g.fillStyle = '#c94235';
    for (let yy = top + 24; yy < GROUND; yy += 28) g.fillRect(x, yy, w, 3);
    // крыша
    g.fillStyle = '#3d5a80';
    g.beginPath();
    g.moveTo(x - 22, top + 6); g.lineTo(r.x + r.w / 2, r.y + 8); g.lineTo(x + w + 22, top + 6); g.closePath();
    g.fill();
    g.fillStyle = '#2c4363';
    g.fillRect(x - 22, top, w + 44, 14);
    // круглое окошко с шестерёнкой под крышей
    const ox = r.x + r.w / 2, oy = r.y + 62;
    g.fillStyle = '#ffd34d';
    g.beginPath(); g.arc(ox, oy, 24, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2c4363';
    g.beginPath(); g.arc(ox, oy, 9, 0, Math.PI * 2); g.fill();
    // проём ворот
    const gx = x + 34, gw = w - 68, gy = top + 70, gh = GROUND - gy;
    g.fillStyle = '#3a3f4a';
    g.fillRect(gx, gy, gw, gh);
    g.fillStyle = '#4a5060';
    g.fillRect(gx, gy + gh * 0.55, gw, gh * 0.45);
    // поднятые ворота-гармошка
    g.fillStyle = '#f2c14e';
    g.fillRect(gx - 6, gy - 30, gw + 12, 30);
    g.fillStyle = '#d9a52c';
    for (let i = 1; i < 3; i++) g.fillRect(gx - 6, gy - 30 + i * 10, gw + 12, 2);
    // машина выглядывает из ворот
    if (this.machine) {
      const m = this.machine;
      const img = this.ctx.assets.image('machine/' + m.id + '/whole/idle');
      const k = Math.min((gw + 70) / m.size.w, (gh - 20) / m.size.h);
      const mw = m.size.w * k, mh = m.size.h * k;
      let drive = 0;
      if (this.state === 'going' && this.going === en) drive = Math.min(1, this.stateT / GO_DELAY) * 40;
      const bob = Math.sin(this.t * 2) * 2;
      g.save();
      g.beginPath(); g.rect(gx - 60, gy, gw + 120, gh + 30); g.clip();
      g.drawImage(img, r.x + r.w / 2 - mw / 2, GROUND - mh + 4 + bob + drive * 0.2, mw, mh);
      g.restore();
    }
    // въезд
    g.fillStyle = '#9aa0a8';
    g.fillRect(gx - 20, GROUND - 4, gw + 40, 12);
  }

  // Карта-дорожка: щит с картой, извилистая дорога и флажок.
  _drawMap(g, en) {
    const r = en.rect;
    const bx = r.x + 16, by = r.y + 40, bw = r.w - 32, bh = 230;
    this._posts(g, r, bx, by + bh, bw);
    g.fillStyle = '#ffffff';
    roundRect(g, bx - 6, by - 6, bw + 12, bh + 12, 22); g.fill();
    g.fillStyle = '#9bd77a';
    roundRect(g, bx, by, bw, bh, 18); g.fill();
    g.fillStyle = '#6db0e8';
    g.beginPath(); g.ellipse(bx + bw * 0.75, by + bh * 0.25, 34, 20, 0, 0, Math.PI * 2); g.fill();
    // дорога
    g.strokeStyle = '#7b7f87'; g.lineWidth = 22; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(bx + 24, by + bh - 24);
    g.bezierCurveTo(bx + bw * 0.9, by + bh - 30, bx + 10, by + bh * 0.4, bx + bw * 0.55, by + 40);
    g.stroke();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.setLineDash([10, 10]);
    g.beginPath();
    g.moveTo(bx + 24, by + bh - 24);
    g.bezierCurveTo(bx + bw * 0.9, by + bh - 30, bx + 10, by + bh * 0.4, bx + bw * 0.55, by + 40);
    g.stroke();
    g.setLineDash([]);
    // остановки
    for (const [px, py] of [[0.2, 0.86], [0.62, 0.72], [0.36, 0.5]]) {
      g.fillStyle = '#ffd34d';
      g.beginPath(); g.arc(bx + bw * px, by + bh * py, 11, 0, Math.PI * 2); g.fill();
    }
    // флажок у цели
    const fx = bx + bw * 0.55, fy = by + 40;
    g.strokeStyle = '#5b3a1e'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - 44); g.stroke();
    g.fillStyle = '#e8574a';
    g.beginPath(); g.moveTo(fx, fy - 44); g.lineTo(fx + 34, fy - 34); g.lineTo(fx, fy - 24); g.closePath(); g.fill();
  }

  // Канат: две стороны тянут, посередине лужа.
  _drawTug(g, en) {
    const r = en.rect;
    const bx = r.x + 16, by = r.y + 40, bw = r.w - 32, bh = 230;
    this._posts(g, r, bx, by + bh, bw);
    g.fillStyle = '#ffffff';
    roundRect(g, bx - 6, by - 6, bw + 12, bh + 12, 22); g.fill();
    g.fillStyle = '#ffe7a8';
    roundRect(g, bx, by, bw, bh, 18); g.fill();
    const cy = by + bh * 0.62;
    // лужа
    g.fillStyle = '#7c5a3a';
    g.beginPath(); g.ellipse(bx + bw / 2, cy + 34, 46, 16, 0, 0, Math.PI * 2); g.fill();
    // канат
    g.strokeStyle = '#b07a3a'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(bx + 52, cy); g.quadraticCurveTo(bx + bw / 2, cy + 14, bx + bw - 52, cy); g.stroke();
    g.strokeStyle = '#8a5a26'; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const xx = bx + 64 + i * (bw - 128) / 6;
      g.beginPath(); g.moveTo(xx - 4, cy - 4); g.lineTo(xx + 4, cy + 6); g.stroke();
    }
    // две машинки-кубика
    const car = (x, color, flip) => {
      g.fillStyle = color;
      roundRect(g, x - 34, cy - 46, 68, 40, 8); g.fill();
      roundRect(g, x + (flip ? -30 : 2), cy - 74, 30, 30, 6); g.fill();
      g.fillStyle = '#bfe6ff';
      g.fillRect(x + (flip ? -25 : 7), cy - 68, 20, 14);
      g.fillStyle = '#333';
      g.beginPath(); g.arc(x - 20, cy - 4, 12, 0, Math.PI * 2); g.arc(x + 20, cy - 4, 12, 0, Math.PI * 2); g.fill();
    };
    car(bx + 46, '#ffb321', false);
    car(bx + bw - 46, '#3b7dd8', true);
  }

  _posts(g, r, bx, bottom, bw) {
    g.fillStyle = '#8a5a3c';
    g.fillRect(bx + 26, bottom, 16, GROUND - bottom);
    g.fillRect(bx + bw - 42, bottom, 16, GROUND - bottom);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.beginPath(); g.ellipse(r.x + r.w / 2, GROUND + 4, r.w / 2 - 20, 10, 0, 0, Math.PI * 2); g.fill();
  }

  // Закрытый вход: побледнел, перед ним шлагбаум, на нём замок.
  _drawClosed(g, en) {
    const r = en.rect;
    g.fillStyle = 'rgba(235,240,245,0.45)';
    roundRect(g, r.x + 4, r.y + 28, r.w - 8, 262, 24); g.fill();
    // шлагбаум
    const y = r.y + 300;
    g.fillStyle = '#5d6977';
    g.fillRect(r.x + 8, y - 6, 22, GROUND - y + 6);
    g.save();
    g.beginPath(); roundRect(g, r.x + 14, y, r.w - 24, 30, 10); g.clip();
    g.fillStyle = '#ffffff';
    g.fillRect(r.x + 14, y, r.w - 24, 30);
    g.fillStyle = '#e0453a';
    for (let xx = r.x; xx < r.x + r.w; xx += 44) {
      g.beginPath();
      g.moveTo(xx, y + 30); g.lineTo(xx + 22, y); g.lineTo(xx + 44, y); g.lineTo(xx + 22, y + 30);
      g.closePath(); g.fill();
    }
    g.restore();
    g.drawImage(this.ctx.assets.image('ui/lock'), r.x + r.w / 2 - 50, r.y + 105, 100, 100);
  }
}
