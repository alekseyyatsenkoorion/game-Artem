// Общие данные и помощники тестов зоны «Карта и стройка».
// Тесты не зависят от готовности зоны «Контент»: если машин в данных меньше 10, добавляются копии
// первой машины; объекты стройки — свои (FIXTURE_OBJECTS) или настоящие из src/data; чего нет из картинок —
// простые прямоугольники нужного размера.
import realData from '../../src/data/index.js';
import realArt from '../../src/art/index.js';
import { UI_ART } from '../../src/core/ui.js';
import { CROSS_ZONE, rectsOverlap } from '../../src/core/draw-utils.js';
import { Scene } from '../../src/core/scene.js';
import { makeWorld, memoryStorage } from '../core/helpers.js';

export { realData };

const FALLBACK_PHRASES = {
  'home-hint': '{name}, нажми на гараж!',
  'home-closed': 'Сюда поедем потом!',
  'garage-hint': '{name}, выбери машину!',
  'garage-actions': 'Что будем делать? Собрать, пазл или помыть?',
  'garage-new': 'Новая машина приехала! Давай её соберём!',
  'garage-locked': 'Эта машина ещё не приехала. Собери другие машины!',
  'puzzle-locked': 'Сначала собери маленький пазл!',
};

export const ACTION_LIST = ['level', 'dig', 'haul-away', 'haul-in', 'spread', 'roll', 'pour', 'lift', 'place', 'stack', 'paint', 'line'];
// Какая машина делает действие в тестовых объектах (null — без машины).
const ACTION_MACHINE = {
  level: 2, dig: 5, 'haul-away': 0, 'haul-in': 1, spread: 6, roll: 3, pour: 4, lift: 7, place: null, stack: null, paint: null, line: null,
};

// 10 тестовых объектов: все 12 действий, повторы 1–5, шаги с машиной и без; объект i открывает машину i + 1.
function fixtureObjects(machines) {
  const out = [];
  let k = 0;
  for (let i = 0; i < 10; i++) {
    const id = 'fx-' + (i + 1);
    const n = 3 + (i % 4);
    const steps = [];
    for (let j = 0; j < n; j++, k++) {
      const action = ACTION_LIST[k % ACTION_LIST.length];
      const mi = ACTION_MACHINE[action];
      steps.push({ machine: mi === null ? null : machines[mi].id, action, repeats: 1 + (k % 5), phrase: 'step-' + id + '-' + (j + 1), layer: 'l' + (j + 1) });
    }
    out.push({ id, order: i + 1, namePhrase: 'object-' + id, nameAccPhrase: 'object-' + id + '-acc', unlocks: i < 9 ? machines[i + 1].id : null, steps });
  }
  return out;
}

const box = (w, h, color = '#e8a33a') => ({ w, h, draw: (g) => { g.fillStyle = color; g.fillRect(0, 0, w, h); } });

export function buildFixture({ objects = 'fixture' } = {}) {
  const sorted = realData.machines.slice().sort((a, b) => a.order - b.order);
  const base = sorted[0];
  const machines = sorted.slice(0, 10);
  const phrases = Object.assign({}, FALLBACK_PHRASES, realData.phrases);
  const art = Object.assign({}, realArt, UI_ART);
  for (let i = machines.length; i < 10; i++) {
    const id = 'test-m' + (i + 1);
    machines.push(Object.assign({}, base, {
      id, order: i + 1, namePhrase: 'machine-' + id, nameAccPhrase: 'machine-' + id + '-acc',
      facts: ['fact-' + id + '-1', 'fact-' + id + '-2'], factWithPicture: 'fact-' + id + '-1',
    }));
    phrases['machine-' + id] = 'Машина ' + (i + 1);
    phrases['machine-' + id + '-acc'] = 'машину ' + (i + 1);
    phrases['fact-' + id + '-1'] = 'Факт один про машину ' + (i + 1);
    phrases['fact-' + id + '-2'] = 'Факт два про машину ' + (i + 1);
    const prefix = 'machine/' + base.id + '/';
    for (const k of Object.keys(realArt)) if (k.startsWith(prefix)) art['machine/' + id + '/' + k.slice(prefix.length)] = realArt[k];
  }
  for (const m of machines) {
    for (const pose of ['idle', 'work', 'dirty', 'silhouette']) {
      const k = 'machine/' + m.id + '/whole/' + pose;
      if (!art[k]) art[k] = box(m.size.w, m.size.h);
    }
    for (const p of m.parts) if (!art['machine/' + m.id + '/part/' + p.id]) art['machine/' + m.id + '/part/' + p.id] = box(p.w, p.h);
    // картинка к факту (рисует зона «Контент»; пока её нет — прямоугольник 360×260)
    if (!art['fact/' + m.id]) art['fact/' + m.id] = box(360, 260, '#7bc4e8');
  }
  const objs = objects === 'real' ? realData.objects : fixtureObjects(machines);
  for (const o of objs) {
    if (!phrases['object-' + o.id]) phrases['object-' + o.id] = 'Объект ' + o.id;
    if (!phrases['object-' + o.id + '-acc']) phrases['object-' + o.id + '-acc'] = 'объект ' + o.id;
    for (const s of o.steps) {
      if (s.phrase && !phrases[s.phrase]) phrases[s.phrase] = 'Задание ' + s.phrase;
      const lid = 'object/' + o.id + '/layer/' + s.layer;
      if (!art[lid]) art[lid] = box(600, 440, 'rgba(120,90,60,0.3)');
    }
  }
  const bgDefault = box(1024, 768, '#ccc');
  for (const id of ['bg/garage', 'bg/home', 'bg/locked', 'bg/build', 'bg/map']) if (!art[id]) art[id] = bgDefault;
  const data = Object.assign({}, realData, { machines, phrases, objects: objs });
  return { data, art };
}

// Подмены сцен других зон: запоминают параметры; complete() завершает с результатом.
export const opened = [];
export function stub(id) {
  return class extends Scene {
    static id = id;
    enter(params) { this.params = params; opened.push({ id, params }); }
    complete(extra) {
      if (id === 'assembly') this.ctx.progress.setAssembled(this.params.machine);
      this.ctx.scenes.finish(Object.assign({ done: true, machine: this.params.machine }, extra || {}));
    }
  };
}

export function world(FX, scenes, opts = {}) {
  return makeWorld({ data: FX.data, art: FX.art, scenes, storage: opts.storage || memoryStorage() });
}

export const frames = (w, sec, dt = 0.05) => { for (let t = 0; t < sec - 1e-9; t += dt) { w.timer.tick(dt); w.scenes.update(dt); } };
export const tap = (w, x, y) => { w.scenes.pointer({ type: 'down', x, y }); w.scenes.pointer({ type: 'up', x, y }); };

// Выполнить ожидаемое действие сцены (поле target) — так же будет делать e2e.
export function perform(w, tg) {
  const P = (type, x, y) => w.scenes.pointer({ type, x, y });
  if (tg.kind === 'tap') { P('down', tg.x, tg.y); P('up', tg.x, tg.y); return; }
  if (tg.kind === 'hold') {
    P('down', tg.x, tg.y);
    frames(w, tg.seconds + 0.1);
    P('up', tg.x, tg.y);
    return;
  }
  if (tg.kind === 'drag') {
    P('down', tg.x, tg.y);
    for (let i = 1; i <= 8; i++) P('move', tg.x + (tg.to.x - tg.x) * i / 8, tg.y + (tg.to.y - tg.y) * i / 8);
    P('up', tg.to.x, tg.to.y);
    return;
  }
  if (tg.kind === 'trace') {
    const p = tg.path;
    P('down', p[0].x, p[0].y);
    for (const q of p.slice(1)) P('move', q.x, q.y);
    const e = p[p.length - 1];
    P('up', e.x, e.y);
  }
}

// Холст, который следит за преобразованиями и запоминает охват всего нарисованного.
export function trackingGraphics() {
  const drawn = [];
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let path = [];
  let subs = [];
  let alpha = 1;
  const tp = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const addPts = (pts) => { for (const [x, y] of pts) path.push(tp(x, y)); };
  const bbox = (pts) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
  const mul = (n) => {
    m = [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  };
  const commit = (op) => { for (const sp of subs.concat([path])) if (sp.length) drawn.push(Object.assign(bbox(sp), { op })); };
  const api = {
    drawn,
    save() { stack.push([m.slice(), alpha]); },
    restore() { if (stack.length) { const s = stack.pop(); m = s[0]; alpha = s[1]; } },
    translate(x, y) { mul([1, 0, 0, 1, x, y]); },
    scale(x, y) { mul([x, 0, 0, y, 0, 0]); },
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); mul([c, s, -s, c, 0, 0]); },
    beginPath() { path = []; subs = []; },
    closePath() {},
    moveTo(x, y) { if (path.length) subs.push(path); path = []; addPts([[x, y]]); },
    lineTo(x, y) { addPts([[x, y]]); },
    quadraticCurveTo(a, b, x, y) { addPts([[a, b], [x, y]]); },
    bezierCurveTo(a, b, c, d, x, y) { addPts([[a, b], [c, d], [x, y]]); },
    arc(x, y, r) { addPts(rectPts(x - r, y - r, 2 * r, 2 * r)); },
    ellipse(x, y, rx, ry) { addPts(rectPts(x - rx, y - ry, 2 * rx, 2 * ry)); },
    rect(x, y, w, h) { addPts(rectPts(x, y, w, h)); },
    fill() { commit('fill'); },
    stroke() { commit('stroke'); },
    clip() {},
    fillRect(x, y, w, h) { drawn.push(Object.assign(bbox(rectPts(x, y, w, h).map(([a, b]) => tp(a, b))), { op: 'fillRect' })); },
    strokeRect(x, y, w, h) { drawn.push(Object.assign(bbox(rectPts(x, y, w, h).map(([a, b]) => tp(a, b))), { op: 'strokeRect' })); },
    drawImage(img, x, y, w, h) { drawn.push(Object.assign(bbox(rectPts(x, y, w, h).map(([p, q]) => tp(p, q))), { op: 'drawImage', img, alpha })); },
    fillText() { drawn.push({ x: 0, y: 0, w: 0, h: 0, op: 'fillText' }); },
    strokeText() { drawn.push({ x: 0, y: 0, w: 0, h: 0, op: 'fillText' }); },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (t) => ({ width: String(t).length * 10 }),
    setLineDash() {},
  };
  return new Proxy(api, {
    get(t, k) { return k in t ? t[k] : () => {}; },
    set(t, k, v) { if (k === 'globalAlpha') alpha = v; t[k] = v; return true; },
  });
}

// Что нарисовано в зоне крестика, кроме фона во весь экран.
export function crossZoneViolations(g) {
  return g.drawn.filter((d) => !(d.x <= 0 && d.y <= 0 && d.w >= 1024 && d.h >= 768) && d.w >= 0 && rectsOverlap({ x: d.x, y: d.y, w: Math.max(d.w, 1), h: Math.max(d.h, 1) }, CROSS_ZONE));
}
export function offscreen(g, pad = 24) {
  return g.drawn.filter((d) => {
    if (d.op === 'drawImage' && Math.round(d.w) === 110 && Math.round(d.h) === 130) return d.x + 38 < 0 || d.x + 38 > 1024 || d.y < 0 || d.y > 768;
    return d.x < -pad || d.y < -pad || d.x + d.w > 1024 + pad || d.y + d.h > 768 + pad;
  });
}
export const textCalls = (g) => g.drawn.filter((d) => d.op === 'fillText');
