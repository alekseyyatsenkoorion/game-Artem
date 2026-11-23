// Гараж (spec.md, раздел 4 «Гараж»; раздел 8 «Временное правило этапа 2»).
// Все машины на своих местах: закрытые — силуэтом, открытые несобранные — кучкой деталей,
// собранные — целиком. Тык по собранной: она выезжает крупно, голос называет её и говорит факт,
// вокруг значки мини-игр. Про конкретные машины здесь ничего нет: всё из ctx.data.machines.
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand, drawGlowRect } from '../core/ui.js';
import { roundRect, inRect, easeOut, easeInOut, lerp } from '../core/draw-utils.js';
import contentData from '../data/index.js';

// Сцены, которые гараж открывает на этапе 2. Значок показывается, только если сцена зарегистрирована.
export const STAGE2_SCENES = ['assembly', 'puzzle', 'wash', 'repair', 'fuel'];

// Значки вокруг крупной машины. Мастерская и заправка — временно для этапа 2 (spec.md, раздел 8);
// на этапе 3 они переедут на карту.
export const ICONS = [
  { icon: 'ui/icon-assembly', scene: 'assembly' },
  { icon: 'ui/icon-puzzle16', scene: 'puzzle', size: 16 },
  { icon: 'ui/icon-puzzle25', scene: 'puzzle', size: 25 },
  { icon: 'ui/icon-wash', scene: 'wash' },
  { icon: 'ui/icon-repair', scene: 'repair' },
  { icon: 'ui/icon-fuel', scene: 'fuel' },
];

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
      for (const p of (m.parts || []).slice(0, PILE_PARTS)) ids.push('machine/' + m.id + '/part/' + p.id);
    }
    return ids;
  }

  enter() {
    const { ctx } = this;
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
    this.hint = new IdleHint();
    this.dirty = false;
    this._layout();
    this._refresh();
    this.unsubscribe = ctx.progress.on('change', () => { this.dirty = true; });
    // Временное правило этапа 2: собранная машина открывает следующую. Догоняем, если машина
    // была собрана раньше (например, в версии этапа 1), а следующая ещё не приехала.
    for (let i = 0; i + 1 < this.machines.length; i++) {
      const id = this.machines[i].id;
      if (ctx.progress.isAssembled(id)) this._unlockNext(id, false);
    }
    this._refresh();
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

  // Временное правило этапа 2: открыть следующую по порядку машину. Возвращает её id или null.
  _unlockNext(id, announce) {
    const i = this.machines.findIndex((m) => m.id === id);
    const next = i >= 0 ? this.machines[i + 1] : null;
    if (!next || this.ctx.progress.isUnlocked(next.id)) return null;
    this.ctx.progress.unlock(next.id);
    this.arrivals[next.id] = 0;
    if (announce !== false) {
      this.ctx.audio.play('horn/' + next.id);
      this.ctx.audio.say('garage-new');
    }
    return next.id;
  }

  _makeIcons(id) {
    const list = ICONS.filter((ic) => STAGE2_SCENES.includes(ic.scene) && this._hasScene(ic.scene));
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
    return fit(this._machine(id).size, BIG_BOX, true);
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
    this.ctx.audio.say(m.namePhrase);
    this.ctx.audio.fact(id);
  }

  _unselect() {
    this.mode = 'unzoom';
    this.modeT = 0;
  }

  _open(scene, params, from) {
    if (!this._hasScene(scene)) return;
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
    if (this.mode === 'row') {
      const s = this.slotAt(e.x, e.y);
      if (!s) return;
      if (s.state === 'locked') {
        this.shake[s.machine] = 0.5;
        this.ctx.audio.say('garage-locked');
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
    let arrived = null;
    if (result && result.done && pending && pending.scene === 'assembly') {
      arrived = this._unlockNext(result.machine || pending.machine);
      this._refresh();
    }
    if (arrived || !pending || pending.from !== 'big' || !this.selected || this._slot(this.selected).state !== 'ready') {
      // новая машина приехала — показываем ряд
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
    for (const k of Object.keys(this.arrivals)) {
      this.arrivals[k] += dt;
      if (this.arrivals[k] >= ARRIVE_TIME) delete this.arrivals[k];
    }
    if (this.mode === 'zoom' && this.modeT >= ZOOM_TIME) { this.mode = 'big'; this.modeT = 0; }
    if (this.mode === 'unzoom' && this.modeT >= UNZOOM_TIME) {
      this.mode = 'row'; this.modeT = 0; this.selected = null; this.icons = [];
    }
    const calm = (this.mode === 'row' || this.mode === 'big') && !Object.keys(this.arrivals).length;
    if (!calm) return;
    if (this.ctx.timer.checkpoint()) return;
    if (this.hint.update(dt)) this.ctx.audio.say(this.mode === 'big' ? 'garage-actions' : 'garage-hint');
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
        if (withIcons) { this._drawPodium(g, 1); this._drawIcons(g, true); }
      } } });
      this.layerKey = key;
    }
    return this.ctx.assets.image(LAYER_ID);
  }

  draw(g) {
    const a = this.ctx.assets;
    g.drawImage(this._layer(), 0, 0, 1024, 768);
    const wait = this.waiting();
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
      if (!this.iconsBaked()) this._drawPodium(g, k);
      const dy = this.bounce > 0 ? -Math.abs(Math.sin(this.bounce * 18)) * 14 : Math.sin(this.t * 2) * 2 * k;
      g.drawImage(a.image('machine/' + this.selected + '/whole/idle'), Math.round(r.x), Math.round(r.y + dy), Math.round(r.w), Math.round(r.h));
      if (this.mode === 'big' && !this.iconsBaked()) this._drawIcons(g, false);
    }

    if (this.hint.showHand()) {
      if (this.mode === 'row' && wait) {
        const r = this._slotMachineRect(this._slot(wait));
        const cx = r.x + r.w / 2, cy = r.y + r.h * 0.5;
        drawHand(g, a, cx, cy, cx, cy, this.hint.handPhase());
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
