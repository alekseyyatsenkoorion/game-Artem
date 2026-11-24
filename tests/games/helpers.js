// Помощники тестов зоны «Мини-игры»: мир со сценой, холст, который считает, где что нарисовано.
import { Scene } from '../../src/core/scene.js';
import data from '../../src/data/index.js';
import art from '../../src/art/index.js';
import { UI_ART } from '../../src/core/ui.js';
import { CROSS_ZONE, rectsOverlap } from '../../src/core/draw-utils.js';
import { makeWorld, memoryStorage, seededRandom, tick } from '../core/helpers.js';

export { data, tick };
export const MACHINES = data.machines.map((m) => m.id);

export class Home extends Scene {
  static id = 'home';
  enter() { this.results = []; }
  onResult(r) { this.results.push(r); }
}

// Реестр картинок: настоящие картинки зоны «Контент» и ядра; чего ещё нет — пустая картинка нужного размера,
// чтобы тесты логики не зависели от того, докуда дошла зона «Контент».
export function registryFor(SceneCls, params, { stub = true } = {}) {
  const reg = Object.assign({}, art, UI_ART);
  if (!stub) return reg;
  const m = data.machines.find((x) => x.id === params.machine);
  for (const id of SceneCls.assets(params)) {
    if (reg[id]) continue;
    let w = 1024, h = 768;
    if (id.startsWith('puzzle/')) { w = 640; h = 480; }
    const part = /^machine\/[^/]+\/part\/(.+)$/.exec(id);
    if (part && m) { const p = m.parts.find((q) => q.id === part[1]); if (p) { w = p.w; h = p.h; } }
    if (/\/whole\//.test(id) && m) { w = m.size.w; h = m.size.h; }
    reg[id] = { w, h, draw() {} };
  }
  return reg;
}

export async function openScene(SceneCls, params, opts = {}) {
  const storage = opts.storage || memoryStorage();
  const w = makeWorld({
    data: opts.data || data,
    art: registryFor(SceneCls, params, opts),
    scenes: [Home, SceneCls],
    storage,
    random: opts.random || seededRandom(opts.seed || 7),
  });
  if (opts.before) opts.before(w);
  await w.scenes.open('home');
  const home = w.scenes.currentScene();
  await w.scenes.open(SceneCls.id, params);
  return { w, home, s: w.scenes.currentScene(), storage };
}

export function settle(s, sec = 0.5, dt = 0.02) { for (let t = 0; t < sec; t += dt) s.update(dt); }

// Довести сцену до finish: голос «договаривает» фразы.
export async function runToFinish(w, s, maxSec = 12) {
  for (let i = 0; i < maxSec / 0.02 && w.scenes.currentScene() === s; i++) {
    s.update(0.02);
    if (i % 10 === 0) { w.voices.finishCurrent(); await tick(); }
  }
}

// Холст, который следит за преобразованиями и запоминает охват всего, что нарисовано.
export function trackingGraphics() {
  const drawn = [];
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let path = [];
  let subs = []; // законченные подпути (каждый moveTo начинает новый)
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
    save() { stack.push(m.slice()); },
    restore() { if (stack.length) m = stack.pop(); },
    translate(x, y) { mul([1, 0, 0, 1, x, y]); },
    scale(x, y) { mul([x, 0, 0, y, 0, 0]); },
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); mul([c, s, -s, c, 0, 0]); },
    transform(a, b, c, d, e, f) { mul([a, b, c, d, e, f]); },
    setTransform(a, b, c, d, e, f) { m = [a, b, c, d, e, f]; },
    resetTransform() { m = [1, 0, 0, 1, 0, 0]; },
    beginPath() { path = []; subs = []; },
    closePath() {},
    moveTo(x, y) { if (path.length) subs.push(path); path = []; addPts([[x, y]]); },
    lineTo(x, y) { addPts([[x, y]]); },
    quadraticCurveTo(a, b, x, y) { addPts([[a, b], [x, y]]); },
    bezierCurveTo(a, b, c, d, x, y) { addPts([[a, b], [c, d], [x, y]]); },
    arc(x, y, r) { addPts(rectPts(x - r, y - r, 2 * r, 2 * r)); },
    arcTo(a, b, x, y) { addPts([[a, b], [x, y]]); },
    ellipse(x, y, rx, ry) { const r = Math.max(rx, ry); addPts(rectPts(x - r, y - r, 2 * r, 2 * r)); },
    rect(x, y, w, h) { addPts(rectPts(x, y, w, h)); },
    fill() { commit('fill'); },
    stroke() { commit('stroke'); },
    clip() {},
    fillRect(x, y, w, h) { drawn.push(Object.assign(bbox(rectPts(x, y, w, h).map(([a, b]) => tp(a, b))), { op: 'fillRect' })); },
    strokeRect(x, y, w, h) { drawn.push(Object.assign(bbox(rectPts(x, y, w, h).map(([a, b]) => tp(a, b))), { op: 'strokeRect' })); },
    clearRect() {},
    drawImage(img, ...a) {
      let x, y, w, h;
      if (a.length === 8) { x = a[4]; y = a[5]; w = a[6]; h = a[7]; } else { x = a[0]; y = a[1]; w = a.length >= 4 ? a[2] : (img.width || 0); h = a.length >= 4 ? a[3] : (img.height || 0); }
      drawn.push(Object.assign(bbox(rectPts(x, y, w, h).map(([p, q]) => tp(p, q))), { op: 'drawImage' }));
    },
    fillText() { drawn.push({ x: 0, y: 0, w: 0, h: 0, op: 'fillText' }); },
    strokeText() { drawn.push({ x: 0, y: 0, w: 0, h: 0, op: 'fillText' }); },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (t) => ({ width: String(t).length * 10 }),
    setLineDash() {},
  };
  return new Proxy(api, {
    get(t, k) { return k in t ? t[k] : () => {}; },
    set(t, k, v) { t[k] = v; return true; },
  });
}

// Что нарисовано в зоне крестика, кроме фона во весь экран.
export function crossZoneViolations(g) {
  return g.drawn.filter((d) => !(d.x <= 0 && d.y <= 0 && d.w >= 1024 && d.h >= 768) && d.w >= 0 && rectsOverlap({ x: d.x, y: d.y, w: Math.max(d.w, 1), h: Math.max(d.h, 1) }, CROSS_ZONE));
}

// Всё нарисованное лежит в пределах экрана (с небольшим запасом на тени и подсветку).
// Рука-подсказка (110×130) может уходить ладонью за нижний край — кончик пальца должен быть на экране.
export function offscreen(g, pad = 24) {
  return g.drawn.filter((d) => {
    if (d.op === 'drawImage' && Math.round(d.w) === 110 && Math.round(d.h) === 130) return d.x + 38 < 0 || d.x + 38 > 1024 || d.y < 0 || d.y > 768;
    return d.x < -pad || d.y < -pad || d.x + d.w > 1024 + pad || d.y + d.h > 768 + pad;
  });
}

export function textCalls(g) { return g.drawn.filter((d) => d.op === 'fillText'); }

// Протереть область пальцем: змейкой по прямоугольнику.
export function rubRect(s, r, step = 30) {
  let first = true;
  for (let y = r.y; y <= r.y + r.h; y += step) {
    const row = [];
    for (let x = r.x; x <= r.x + r.w; x += step) row.push(x);
    if (((y - r.y) / step) % 2) row.reverse();
    for (const x of row) {
      s.onPointer({ type: first ? 'down' : 'move', x, y });
      first = false;
    }
  }
  s.onPointer({ type: 'up', x: r.x, y: r.y });
}
