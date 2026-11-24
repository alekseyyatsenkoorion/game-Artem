// Гараж (spec.md, раздел 4 «Гараж»).
// Все машины на своих местах: закрытые — силуэтом, открытые несобранные — кучкой деталей,
// собранные — целиком. Тык по собранной: она выезжает крупно, голос называет её и говорит факт,
// вокруг три значка: собрать заново, пазл (16 и 25), помыть. Про конкретные машины здесь ничего нет:
// всё из ctx.data.machines. Машины открывает стройка (Progress.completeObject), не гараж.
// Факты гараж ведёт сам: по кругу по machine.facts, начиная с factWithPicture, чтобы в первый же
// раз была картинка. Пока звучит этот факт (и ещё FACT_CARD_HOLD с), рядом с машиной карточка fact/<id>.
// Режим выбора для каната: params {mode: 'tug'} — тык по открытой машине открывает канат с ней;
// проигравшая машина едет на мойку, потом снова выбор.
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand, drawGlowRect } from '../core/ui.js';
import { roundRect, inRect, easeOut, easeInOut, lerp } from '../core/draw-utils.js';
import contentData from '../data/index.js';

// Сцены, которые открывает гараж. Значок показывается, только если сцена зарегистрирована.
// Мастерская и заправка — остановки на карте, в гараже их нет.
export const GARAGE_SCENES = ['assembly', 'puzzle', 'wash'];

// Значки вокруг крупной машины.
export const ICONS = [
  { icon: 'ui/icon-assembly', scene: 'assembly' },
  { icon: 'ui/icon-puzzle16', scene: 'puzzle', size: 16 },
  { icon: 'ui/icon-puzzle25', scene: 'puzzle', size: 25 },
  { icon: 'ui/icon-wash', scene: 'wash' },
];

const TO_WASH_DELAY = 2.2; // проиграл канат: голос «поехали на мойку», потом мойка

const COLS = 5;
const SLOT_W = 184, SLOT_GAP = 12;
const ROW_H = 250, ROW_GAP = 24;
const TOP = 120;
const FLOOR_PAD = 34; // от низа места до «пола», на котором стоит машина
const PILE_PARTS = 3;
const LAYER_ID = 'garage/layer'; // запечённый неподвижный ряд
const ICONS_POP = 0.6;
const DIM = 0.75; // затемнение ряда под крупной машиной

const ZOOM_TIME = 0.5;
const UNZOOM_TIME = 0.35;
const ARRIVE_TIME = 1.6;
const BIG_BOX = { x: 212, y: 112, w: 600, h: 400 }; // крупная машина
const ICON = 120, ICON_GAP = 26, ICON_Y = 560;
// Карточка с картинкой к факту: справа от крупной машины, машина отъезжает влево.
export const FACT_CARD = { x: 612, y: 150, w: 392, h: 292 }; // картинка 360×260 + поля 16
const FACT_PAD = 16;
const BIG_BOX_CARD = { x: 20, y: 112, w: 572, h: 400 }; // крупная машина, пока видна карточка
const FACT_CARD_HOLD = 2; // с после фразы
const FACT_CARD_FADE = 0.35;
const SHIFT_TIME = 0.4;

// Очередь фактов: счётчик на уровне модуля, живёт, пока открыта игра.
const factCounters = {};
export function factOrder(m) {
  const facts = (m && m.facts) || [];
  const start = Math.max(0, facts.indexOf(m.factWithPicture));
  return facts.slice(start).concat(facts.slice(0, start));
}
export function nextFact(m) {
  const order = factOrder(m);
  if (!order.length) return null;
  const i = factCounters[m.id] || 0;
  factCounters[m.id] = (i + 1) % order.length;
  return order[i];
}
export function resetFacts() {
  for (const k of Object.keys(factCounters)) delete factCounters[k];
}

function sortedMachines(list) {
  return (list || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
}

function fit(size, box, alignBottom) {
  const k = Math.min(box.w / size.w, box.h / size.h);
  const w = size.w * k, h = size.h * k;
  return { x: box.x + (box.w - w) / 2, y: alignBottom ? box.y + box.h - h : box.y + (box.h - h) / 2, w, h };
}

export class GarageScene extends Scene {
  static id = 'garage';

  static assets() {
    const ids = ['bg/garage', 'ui/hand', 'ui/lock'];
    for (const ic of ICONS) ids.push(ic.icon);
    for (const m of contentData.machines || []) {
      ids.push('machine/' + m.id + '/whole/idle', 'machine/' + m.id + '/whole/silhouette');
      if (m.factWithPicture) ids.push('fact/' + m.id);
      for (const p of (m.parts || []).slice(0, PILE_PARTS)) ids.push('machine/' + m.id + '/part/' + p.id);
    }
    return ids;
  }

  enter(params) {
    const { ctx } = this;
    this.tugMode = !!(params && params.mode === 'tug');
    this.toWash = null; // {machine, t} — после проигрыша в канат
    this.machines = sortedMachines(ctx.data.machines);
    this.t = 0;
    this.mode = 'row'; // row | zoom | big | unzoom
    this.modeT = 0;
    this.selected = null; // id крупной машины
    this.icons = [];
    this.pending = null; // {scene, machine, from: 'row' | 'big'} — что открыто из гаража
    this.arrivals = {}; // id машины → время с начала приезда
    this.shake = {}; // id машины → оставшееся время покачивания
    this.bounce = 0;
    this.card = null; // {machine, img, started, speaking, hold, a} — карточка к факту
    this.cardToken = 0;
    this.shift = 0; // 0..1 — насколько крупная машина отъехала влево под карточку
    this.hint = new IdleHint();
    this.dirty = false;
    this._layout();
    this._refresh();
    this.unsubscribe = ctx.progress.on('change', () => { this.dirty = true; });
    if (this.tugMode) ctx.audio.say('tug-pick');
  }

  exit() {
    if (this.unsubscribe) { try { this.unsubscribe(); } catch (e) { /* ничего */ } }
    this.unsubscribe = null;
    this.ctx.assets.release([LAYER_ID]);
    this.layerKey = null;
  }

  // ---------- состояние ----------

  _layout() {
    const n = this.machines.length;
    const cols = Math.min(COLS, Math.max(1, n));
    const rows = Math.max(1, Math.ceil(n / cols));
    const rowH = Math.min(ROW_H, Math.floor((768 - TOP - 20 - (rows - 1) * ROW_GAP) / rows));
    const totalH = rows * rowH + (rows - 1) * ROW_GAP;
    const top = Math.max(TOP, Math.round((768 - totalH) / 2 + 30));
    // Публичное поле для тестов и e2e: {machine, rect, state}.
    this.slots = this.machines.map((m, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const rowW = inRow * SLOT_W + (inRow - 1) * SLOT_GAP;
      const x0 = Math.round((1024 - rowW) / 2);
      const col = i % cols;
      return { machine: m.id, rect: { x: x0 + col * (SLOT_W + SLOT_GAP), y: top + row * (rowH + ROW_GAP), w: SLOT_W, h: rowH }, state: 'locked' };
    });
  }

  _refresh() {
    const p = this.ctx.progress;
    for (const s of this.slots) {
      if (!p.isUnlocked(s.machine)) s.state = 'locked';
      else if (!p.isAssembled(s.machine)) s.state = 'parts';
      else s.state = 'ready';
    }
    this.dirty = false;
    // Сброс прогресса с экрана взрослых: крупная машина больше не собрана — назад к ряду.
    if (this.selected && this._slot(this.selected).state !== 'ready') {
      this._hideCard();
      this.selected = null;
      this.icons = [];
      this.mode = 'row';
    } else if (this.selected) {
      this.icons = this._makeIcons(this.selected);
    }
  }

  _machine(id) { return this.machines.find((m) => m.id === id) || null; }
  _slot(id) { return this.slots.find((s) => s.machine === id) || null; }

  _hasScene(id) {
    const sc = this.ctx.scenes;
    return !(sc && typeof sc.has === 'function' && !sc.has(id));
  }

  // Машина, которая ждёт сборки: первая открытая и несобранная.
  waiting() {
    const s = this.slots.find((x) => x.state === 'parts');
    return s ? s.machine : null;
  }

  // Режим каната: первая открытая машина (для подсказки и e2e).
  firstOpen() {
    const s = this.slots.find((x) => x.state !== 'locked');
    return s ? s.machine : null;
  }

  // Что ждём от ребёнка (для e2e): в режиме каната — тык по открытой машине.
  get target() {
    if (!this.tugMode || this.mode !== 'row' || this.toWash || this.pending) return null;
    const id = this.firstOpen();
    if (!id) return null;
    const r = this._slotMachineRect(this._slot(id));
    return { kind: 'tap', x: Math.round(r.x + r.w / 2), y: Math.round(r.y + r.h / 2) };
  }

  _makeIcons(id) {
    const list = ICONS.filter((ic) => GARAGE_SCENES.includes(ic.scene) && this._hasScene(ic.scene));
    const total = list.length * ICON + Math.max(0, list.length - 1) * ICON_GAP;
    const x0 = Math.round((1024 - total) / 2);
    return list.map((ic, i) => {
      const params = { machine: id };
      if (ic.size) params.size = ic.size;
      const locked = ic.size === 25 && this.ctx.progress.puzzleState(id, 16) !== 'done';
      return { icon: ic.icon, scene: ic.scene, params, locked, rect: { x: x0 + i * (ICON + ICON_GAP), y: ICON_Y, w: ICON, h: ICON } };
    });
  }

  // ---------- геометрия машин ----------

  _slotMachineRect(slot) {
    const m = this._machine(slot.machine);
    const r = slot.rect;
    const box = { x: r.x + 4, y: r.y + 40, w: r.w - 8, h: r.h - FLOOR_PAD - 40 };
    return fit(m.size, box, true);
  }

  _bigRect(id) {
    const size = this._machine(id).size;
    const a = fit(size, BIG_BOX, true);
    if (this.shift <= 0) return a;
    const b = fit(size, BIG_BOX_CARD, true);
    const k = easeInOut(Math.min(1, this.shift));
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) };
  }

  // Карточка к факту (для тестов): {machine, img, rect, alpha} или null, если не видна.
  factCard() {
    const c = this.card;
    if (!c || c.a <= 0) return null;
    return { machine: c.machine, img: c.img, rect: Object.assign({}, FACT_CARD), alpha: c.a };
  }

  _hideCard() {
    this.card = null;
    this.cardToken++;
  }

  // Где сейчас рисуется выбранная машина (с учётом выезда).
  selectedRect() {
    if (!this.selected) return null;
    const from = this._slotMachineRect(this._slot(this.selected));
    const to = this._bigRect(this.selected);
    let k = 1;
    if (this.mode === 'zoom') k = easeOut(this.modeT / ZOOM_TIME);
    else if (this.mode === 'unzoom') k = 1 - easeInOut(this.modeT / UNZOOM_TIME);
    return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), w: lerp(from.w, to.w, k), h: lerp(from.h, to.h, k) };
  }

  // ---------- действия ----------

  _select(id) {
    const m = this._machine(id);
    this.selected = id;
    this.mode = 'zoom';
    this.modeT = 0;
    this.icons = this._makeIcons(id);
    this.ctx.audio.play('horn/' + id);
    const audio = this.ctx.audio;
    const named = audio.say(m.namePhrase);
    const fact = nextFact(m);
    this._hideCard();
    if (!fact) return;
    const spoken = audio.say(fact);
    if (fact !== m.factWithPicture) return;
    const token = this.cardToken;
    const card = { machine: id, img: 'fact/' + id, started: false, speaking: true, hold: FACT_CARD_HOLD, a: 0 };
    this.card = card;
    // карточка появляется, когда имя договорено и начинается факт; держится, пока звучит факт
    Promise.resolve(named).then(() => { if (this.cardToken === token) card.started = true; });
    Promise.resolve(spoken).then(() => { if (this.cardToken === token) { card.started = true; card.speaking = false; } });
  }

  _unselect() {
    this._hideCard();
    this.mode = 'unzoom';
    this.modeT = 0;
  }

  _open(scene, params, from) {
    if (!this._hasScene(scene)) return;
    this._hideCard();
    this.pending = { scene, machine: params.machine, from };
    this.ctx.scenes.open(scene, params);
  }

  slotAt(x, y) {
    return this.slots.find((s) => inRect(x, y, s.rect, 4)) || null;
  }

  iconAt(x, y) {
    return this.icons.find((ic) => inRect(x, y, ic.rect, 10)) || null;
  }

  onPointer(e) {
    if (e.type !== 'down') return;
    this.hint.reset();
    if (this.toWash) return;
    if (this.mode === 'row') {
      const s = this.slotAt(e.x, e.y);
      if (!s) return;
      if (s.state === 'locked') {
        this.shake[s.machine] = 0.5;
        this.ctx.audio.say('garage-locked');
      } else if (this.tugMode) {
        this.ctx.audio.play('horn/' + s.machine);
        this._open('tug', { machine: s.machine }, 'row');
      } else if (s.state === 'parts') {
        this._open('assembly', { machine: s.machine }, 'row');
      } else {
        this._select(s.machine);
      }
    } else if (this.mode === 'big') {
      const ic = this.iconAt(e.x, e.y);
      if (ic) {
        if (ic.locked) { this.ctx.audio.say('puzzle-locked'); return; }
        this._open(ic.scene, Object.assign({}, ic.params), 'big');
        return;
      }
      const r = this.selectedRect();
      if (r && inRect(e.x, e.y, r, 10)) {
        this.bounce = 0.5;
        this.ctx.audio.play('horn/' + this.selected);
        return;
      }
      this._unselect();
    }
  }

  onResult(result) {
    const pending = this.pending;
    this.pending = null;
    this.hint.reset();
    this._refresh();
    // канат проигран — машина в луже, едет на мойку
    if (pending && pending.scene === 'tug' && result && result.done && result.won === false && this._hasScene('wash')) {
      this.toWash = { machine: pending.machine, t: 0 };
      this.ctx.audio.say('tug-to-wash');
    }
    if (!pending || pending.from !== 'big' || !this.selected || this._slot(this.selected).state !== 'ready') {
      this.selected = null;
      this.icons = [];
      this.mode = 'row';
    } else {
      this.mode = 'big';
      this.icons = this._makeIcons(this.selected);
    }
    this.modeT = 0;
    this.ctx.timer.checkpoint();
  }

  update(dt) {
    this.t += dt;
    this.modeT += dt;
    if (this.dirty) this._refresh();
    if (this.bounce > 0) this.bounce = Math.max(0, this.bounce - dt);
    for (const k of Object.keys(this.shake)) {
      this.shake[k] -= dt;
      if (this.shake[k] <= 0) delete this.shake[k];
    }
    if (this.toWash) {
      this.toWash.t += dt;
      if (this.toWash.t >= TO_WASH_DELAY) {
        const m = this.toWash.machine;
        this.toWash = null;
        this._open('wash', { machine: m }, 'row');
      }
      return;
    }
    for (const k of Object.keys(this.arrivals)) {
      this.arrivals[k] += dt;
      if (this.arrivals[k] >= ARRIVE_TIME) delete this.arrivals[k];
    }
    this._updateCard(dt);
    if (this.mode === 'zoom' && this.modeT >= ZOOM_TIME) { this.mode = 'big'; this.modeT = 0; }
    if (this.mode === 'unzoom' && this.modeT >= UNZOOM_TIME) {
      this.mode = 'row'; this.modeT = 0; this.selected = null; this.icons = [];
    }
    const calm = (this.mode === 'row' || this.mode === 'big') && !Object.keys(this.arrivals).length;
    if (!calm) return;
    if (this.ctx.timer.checkpoint()) return;
    if (this.hint.update(dt)) this.ctx.audio.say(this.tugMode ? 'tug-pick' : this.mode === 'big' ? 'garage-actions' : 'garage-hint');
  }

  _updateCard(dt) {
    const c = this.card;
    if (c && (this.mode === 'zoom' || this.mode === 'big')) {
      if (!c.speaking) c.hold -= dt;
      if (c.hold > 0) {
        if (c.started && this.mode === 'big') c.a = Math.min(1, c.a + dt / FACT_CARD_FADE);
      } else {
        c.a = Math.max(0, c.a - dt / FACT_CARD_FADE);
        if (c.a <= 0) this._hideCard();
      }
    } else if (c) {
      this._hideCard();
    }
    const want = this.card ? 1 : 0;
    if (this.shift < want) this.shift = Math.min(want, this.shift + dt / SHIFT_TIME);
    else if (this.shift > want) this.shift = Math.max(want, this.shift - dt / SHIFT_TIME);
  }

  // ---------- рисование ----------

  // Неподвижный ряд (фон, боксы, стоящие машины) «запекается» в одну картинку и перерисовывается
  // только при изменении состояния: 10 крупных картинок, уменьшаемых каждый кадр, не тянут
  // старый iPad (тест 5.3). Анимированное (покачивание, приезд, подсветка) рисуется поверх.
  _animating(id) {
    return id === this.selected || !!this.shake[id] || this.arrivals[id] !== undefined;
  }

  _layer() {
    const dim = this.mode === 'big';
    const withIcons = dim && this.iconsBaked();
    const key = this.slots.map((s) => s.machine + ':' + s.state + (this._animating(s.machine) ? '*' : '')).join('|') + (dim ? '|dim' : '')
      + (withIcons ? '|' + this.selected + ':' + this.icons.map((i) => i.icon + (i.locked ? 'L' : '')).join(',') : '');
    if (key !== this.layerKey) {
      const a = this.ctx.assets;
      const still = this.slots.filter((s) => !this._animating(s.machine));
      a.release([LAYER_ID]);
      a.register({ [LAYER_ID]: { w: 1024, h: 768, draw: (g) => {
        g.drawImage(a.image('bg/garage'), 0, 0, 1024, 768);
        for (const s of this.slots) this._drawSlotBase(g, s);
        for (const s of still) this._drawSlotMachine(g, s, 0);
        // под крупной машиной ряд затемнён — тоже один раз, а не каждый кадр
        if (dim) { g.fillStyle = 'rgba(20,30,45,' + DIM + ')'; g.fillRect(0, 0, 1024, 768); }
        if (withIcons) this._drawIcons(g, true);
      } } });
      this.layerKey = key;
    }
    return this.ctx.assets.image(LAYER_ID);
  }

  draw(g) {
    const a = this.ctx.assets;
    g.drawImage(this._layer(), 0, 0, 1024, 768);
    const wait = this.tugMode ? null : this.waiting();
    if (wait && this.mode === 'row') {
      const r = this._slot(wait).rect;
      drawGlowRect(g, r.x + r.w / 2, r.y + r.h / 2 - 6, r.w - 34, r.h - 40, this.t);
    }
    for (const s of this.slots) {
      if (s.machine === this.selected || !this._animating(s.machine)) continue;
      let dx = 0;
      if (this.shake[s.machine]) dx = Math.sin(this.shake[s.machine] * 40) * 6;
      if (this.arrivals[s.machine] !== undefined) {
        const mr = this._slotMachineRect(s);
        dx = (1 - easeOut(this.arrivals[s.machine] / ARRIVE_TIME)) * (1100 - mr.x);
      }
      this._drawSlotMachine(g, s, dx);
    }

    if (this.selected) {
      const k = this.mode === 'zoom' ? easeOut(this.modeT / ZOOM_TIME)
        : this.mode === 'unzoom' ? 1 - this.modeT / UNZOOM_TIME : 1;
      if (this.mode !== 'big') {
        g.fillStyle = 'rgba(20,30,45,' + (DIM * Math.max(0, k)).toFixed(3) + ')';
        g.fillRect(0, 0, 1024, 768);
      }
      const r = this.selectedRect();
      this._drawPodium(g, k);
      const dy = this.bounce > 0 ? -Math.abs(Math.sin(this.bounce * 18)) * 14 : Math.sin(this.t * 2) * 2 * k;
      g.drawImage(a.image('machine/' + this.selected + '/whole/idle'), Math.round(r.x), Math.round(r.y + dy), Math.round(r.w), Math.round(r.h));
      if (this.mode === 'big' && !this.iconsBaked()) this._drawIcons(g, false);
      this._drawFactCard(g);
    }

    if (this.hint.showHand()) {
      if (this.mode === 'row' && wait) {
        const r = this._slotMachineRect(this._slot(wait));
        const cx = r.x + r.w / 2, cy = r.y + r.h * 0.5;
        drawHand(g, a, cx, cy, cx, cy, this.hint.handPhase());
      } else if (this.mode === 'row' && this.target) {
        const tg = this.target;
        drawHand(g, a, tg.x, tg.y, tg.x, tg.y, this.hint.handPhase());
      } else if (this.mode === 'big' && this.icons.length) {
        const r = this.icons[0].rect;
        drawHand(g, a, r.x + r.w / 2, r.y + r.h / 2, r.x + r.w / 2, r.y + r.h / 2, this.hint.handPhase());
      }
    }
  }

  _drawSlotBase(g, s) {
    const r = s.rect;
    const floor = r.y + r.h - FLOOR_PAD;
    // бокс гаража: тёмная ниша, над ней поднятые ворота, внизу пол с жёлтой разметкой
    g.fillStyle = 'rgba(40,48,62,0.30)';
    roundRect(g, r.x, r.y, r.w, r.h, 16); g.fill();
    g.fillStyle = s.state === 'locked' ? '#9aa3ad' : '#f2c14e';
    roundRect(g, r.x + 4, r.y + 4, r.w - 8, 26, 10); g.fill();
    g.fillStyle = s.state === 'locked' ? '#86909b' : '#d9a52c';
    g.fillRect(r.x + 10, r.y + 13, r.w - 20, 3);
    g.fillRect(r.x + 10, r.y + 21, r.w - 20, 3);
    g.fillStyle = 'rgba(60,70,85,0.45)';
    g.fillRect(r.x + 6, floor, r.w - 12, FLOOR_PAD - 8);
    g.fillStyle = '#ffd34d';
    g.fillRect(r.x + 4, floor - 8, 6, FLOOR_PAD);
    g.fillRect(r.x + r.w - 10, floor - 8, 6, FLOOR_PAD);
  }

  _drawSlotMachine(g, s, dx) {
    const a = this.ctx.assets;
    const m = this._machine(s.machine);
    const floor = s.rect.y + s.rect.h - FLOOR_PAD;
    const r0 = this._slotMachineRect(s);
    const mr = { x: r0.x + dx, y: r0.y, w: r0.w, h: r0.h };
    // тень
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.beginPath(); g.ellipse(mr.x + mr.w / 2, floor + 2, mr.w / 2, 8, 0, 0, Math.PI * 2); g.fill();
    if (s.state === 'locked') {
      g.save();
      g.globalAlpha = 0.55;
      g.drawImage(a.image('machine/' + m.id + '/whole/silhouette'), mr.x, mr.y, mr.w, mr.h);
      g.restore();
    } else if (s.state === 'parts') {
      // контур будущей машины и кучка деталей перед ним
      g.save();
      g.globalAlpha = 0.28;
      g.drawImage(a.image('machine/' + m.id + '/whole/silhouette'), mr.x, mr.y, mr.w, mr.h);
      g.restore();
      this._drawPile(g, m, mr.x + mr.w / 2, floor);
    } else {
      g.drawImage(a.image('machine/' + m.id + '/whole/idle'), mr.x, mr.y, mr.w, mr.h);
    }
  }

  _drawPile(g, m, cx, floor) {
    const a = this.ctx.assets;
    const parts = (m.parts || []).slice(0, PILE_PARTS);
    const spots = [[-44, 0], [44, 0], [0, -34]]; // две детали внизу, третья сверху
    parts.forEach((p, i) => {
      const sp = spots[i % spots.length];
      const k = Math.min(80 / p.w, 64 / p.h);
      const w = p.w * k, h = p.h * k;
      g.drawImage(a.image('machine/' + m.id + '/part/' + p.id), cx + sp[0] - w / 2, floor + sp[1] - h, w, h);
    });
  }

  // Значки «выскакивают» первые полсекунды, потом вместе с подиумом запекаются в слой.
  iconsBaked() { return this.mode === 'big' && this.modeT >= ICONS_POP; }

  _drawPodium(g, k) {
    const r = this.selectedRect();
    g.fillStyle = 'rgba(255,255,255,' + (0.25 * k).toFixed(3) + ')';
    g.beginPath(); g.ellipse(r.x + r.w / 2, r.y + r.h + 4, r.w / 2 + 30, 26 * k + 6, 0, 0, Math.PI * 2); g.fill();
  }

  _drawFactCard(g) {
    const c = this.card;
    if (!c || c.a <= 0 || (this.mode !== 'big' && this.mode !== 'zoom')) return;
    const k = easeOut(c.a);
    const s = 0.85 + 0.15 * k;
    const r = FACT_CARD;
    const w = r.w * s, h = r.h * s, p = FACT_PAD * s;
    const x = r.x + (r.w - w) / 2, y = r.y + (r.h - h) / 2;
    g.save();
    g.globalAlpha = k;
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 18;
    g.shadowOffsetY = 6;
    g.fillStyle = '#ffffff';
    roundRect(g, x, y, w, h, 24 * s); g.fill();
    g.shadowColor = 'rgba(0,0,0,0)';
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;
    g.drawImage(this.ctx.assets.image(c.img), x + p, y + p, w - 2 * p, h - 2 * p);
    g.restore();
  }

  _drawIcons(g, still) {
    const a = this.ctx.assets;
    this.icons.forEach((ic, i) => {
      const r = ic.rect;
      const pop = still ? 1 : Math.min(1, this.modeT * 4 - i * 0.15);
      if (pop <= 0) return;
      const s = 0.6 + 0.4 * easeOut(pop);
      const w = r.w * s, h = r.h * s;
      g.save();
      if (ic.locked) g.globalAlpha = 0.6;
      g.drawImage(a.image(ic.icon), r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
      g.restore();
      if (ic.locked) g.drawImage(a.image('ui/lock'), r.x + r.w - 54, r.y + r.h - 58, 64, 64);
    });
  }
}
