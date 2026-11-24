// Общие помощники для слоёв объектов стройки. Все слои 600×440, прозрачный фон,
// линия земли y = 340 (ниже — подземная часть: котлован, ямы, фундамент).
import { roundRect } from '../../core/draw-utils.js';
import { OUTLINE, TAU, box, shape, circle, line, rectWindow } from '../parts-common.js';

export const LW = 600, LH = 440, G = 340;

export const C = {
  pad: '#d9b07a', padDark: '#b88a52',
  dirt: '#7a4f2a', dirtDark: '#5c3a1d', dirtLight: '#a8743f',
  sand: '#f6d57c', sandDark: '#dcb253',
  gravel: '#a3a8b0', gravelDark: '#6f7680', gravelLight: '#c9cdd3',
  concrete: '#c3c7cc', concreteDark: '#9a9fa6', concreteLight: '#dde0e3',
  wood: '#e9b062', woodDark: '#b97c34', woodLight: '#f5c987',
  brick: '#d9583b', brickDark: '#a83a22', mortar: '#f3dcc3',
  asphalt: '#45484f', asphaltLight: '#5d6169',
  rebar: '#b5622a',
  steel: '#7d8796', steelDark: '#5a6372',
  grass: '#6cc04a', grassDark: '#3f9a33',
  water: '#4fb3f0', waterDark: '#2f86c8',
  white: '#ffffff', lamp: '#fff6a8',
};

// Псевдослучайные числа для «камешков»: одинаковые при каждом рисовании.
export function seeded(seed) {
  let s = seed % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function rect(g, x, y, w, h, fill, lw = 4) {
  g.lineJoin = 'round';
  g.fillStyle = fill; g.fillRect(x, y, w, h);
  if (lw) { g.strokeStyle = OUTLINE; g.lineWidth = lw; g.strokeRect(x, y, w, h); }
}

// Выровненная площадка: светлая утоптанная земля поверх травы.
export function pad(g, x0, x1) {
  box(g, x0, G - 5, x1 - x0, 20, 8, C.pad, 4);
  g.strokeStyle = C.padDark; g.lineWidth = 3; g.lineCap = 'round';
  for (let x = x0 + 18; x < x1 - 20; x += 34) { g.beginPath(); g.moveTo(x, G + 4); g.lineTo(x + 14, G + 4); g.stroke(); }
}

// Котлован — трапеция: P = {x0, x1, d (глубина), s (скос стенки)}. Верх по y = G - 2.
export function pitPath(g, P) {
  g.moveTo(P.x0, G - 2); g.lineTo(P.x1, G - 2); g.lineTo(P.x1 - P.s, G + P.d); g.lineTo(P.x0 + P.s, G + P.d); g.closePath();
}

// Рисовать только внутри котлована.
export function inPit(g, P, fn) {
  g.save(); g.beginPath(); pitPath(g, P); g.clip(); fn(); g.restore();
}

// Свежевыкопанный котлован: неровные стенки и комья на дне.
export function pitRough(g, P, seed = 1) {
  shape(g, C.dirtDark, (q) => pitPath(q, P), 4);
  const r = seeded(seed);
  inPit(g, P, () => {
    g.fillStyle = C.dirt;
    for (let i = 0; i < 14; i++) {
      const x = P.x0 + P.s + r() * (P.x1 - P.x0 - 2 * P.s), y = G + P.d - 4 - r() * P.d * 0.4;
      g.beginPath(); g.arc(x, y, 6 + r() * 10, 0, TAU); g.fill();
    }
    g.fillStyle = C.dirtLight;
    for (let i = 0; i < 10; i++) {
      const x = P.x0 + r() * (P.x1 - P.x0), y = G + r() * P.d;
      g.beginPath(); g.arc(x, y, 2 + r() * 3, 0, TAU); g.fill();
    }
  });
  // рваная кромка сверху
  g.fillStyle = C.dirtLight; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  for (const x of [P.x0 + 6, P.x1 - 6]) { g.beginPath(); g.arc(x, G - 2, 7, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); }
}

// Аккуратный котлован: ровные стенки, чистое дно.
export function pitClean(g, P) {
  shape(g, C.dirt, (q) => pitPath(q, P), 4);
  inPit(g, P, () => {
    g.fillStyle = C.dirtDark; g.fillRect(P.x0, G + P.d - 8, P.x1 - P.x0, 8);
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 3;
    for (let y = G + 10; y < G + P.d - 8; y += 14) { g.beginPath(); g.moveTo(P.x0, y); g.lineTo(P.x1, y); g.stroke(); }
  });
  g.strokeStyle = OUTLINE; g.lineWidth = 4; g.beginPath(); pitPath(g, P); g.stroke();
}

// Насыпной материал внутри котлована: от дна до top. lumpy — бугристый верх (ещё не разровняли).
export function pitFill(g, P, top, bottom, fill, dots, lumpy, seed = 3) {
  inPit(g, P, () => {
    g.fillStyle = fill; g.strokeStyle = OUTLINE; g.lineWidth = 4; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(P.x0 - 10, bottom);
    if (lumpy) {
      const n = 7, w = (P.x1 - P.x0) / n;
      g.lineTo(P.x0 - 10, top + 10);
      for (let i = 0; i < n; i++) {
        const x = P.x0 + i * w;
        g.quadraticCurveTo(x + w / 2, top - 6 + (i % 2) * 6, x + w, top + 10);
      }
    } else {
      g.lineTo(P.x0 - 10, top);
      g.lineTo(P.x1 + 10, top);
    }
    g.lineTo(P.x1 + 10, bottom); g.closePath(); g.fill(); g.stroke();
    if (dots) speckle(g, P.x0, top + 4, P.x1, bottom, dots, seed, 40);
  });
  g.strokeStyle = OUTLINE; g.lineWidth = 4; g.beginPath(); pitPath(g, P); g.stroke();
}

// Бугристая куча без котлована: x0..x1, верх около top, низ bottom. Пики не выше top - 6.
export function lumps(g, x0, x1, top, bottom, fill, dots, seed = 5) {
  shape(g, fill, (q) => {
    const n = Math.max(3, Math.round((x1 - x0) / 50)), w = (x1 - x0) / n;
    q.moveTo(x0, bottom); q.lineTo(x0, top + 8);
    for (let i = 0; i < n; i++) q.quadraticCurveTo(x0 + i * w + w / 2, top - 6 + (i % 2) * 8, x0 + (i + 1) * w, top + 8);
    q.lineTo(x1, bottom); q.closePath();
  }, 4);
  if (dots) speckle(g, x0 + 6, top + 6, x1 - 6, bottom - 4, dots, seed, Math.round((x1 - x0) / 8));
}

export function speckle(g, x0, y0, x1, y1, color, seed, n) {
  const r = seeded(seed);
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    g.beginPath(); g.arc(x0 + r() * (x1 - x0), y0 + r() * Math.max(1, y1 - y0), 2 + r() * 3, 0, TAU); g.fill();
  }
}

// Доска с волокнами.
export function plank(g, x, y, w, h, fill = C.wood) {
  box(g, x, y, w, h, Math.min(4, w / 3, h / 3), fill, 3);
  g.strokeStyle = 'rgba(120, 70, 20, 0.35)'; g.lineWidth = 2;
  if (w >= h) { g.beginPath(); g.moveTo(x + 6, y + h * 0.45); g.lineTo(x + w * 0.6, y + h * 0.45); g.stroke(); }
  else { g.beginPath(); g.moveTo(x + w * 0.45, y + 6); g.lineTo(x + w * 0.45, y + h * 0.6); g.stroke(); }
}

// Гвоздики на доске.
export function nails(g, pts) { for (const [x, y] of pts) circle(g, x, y, 2.5, '#5a5f6b'); }

// Кирпичная кладка: rows рядов от низа bottom вверх, высота ряда rh.
export function bricks(g, x, bottom, w, rows, rh, fill = C.brick) {
  const top = bottom - rows * rh;
  g.fillStyle = C.mortar; g.fillRect(x, top, w, rows * rh);
  const bw = 36;
  for (let r = 0; r < rows; r++) {
    const y = bottom - (r + 1) * rh;
    const off = r % 2 ? -bw / 2 : 0;
    g.save(); g.beginPath(); g.rect(x, y, w, rh); g.clip();
    for (let bx = x + off; bx < x + w; bx += bw) {
      g.fillStyle = (Math.round((bx - x) / bw) + r) % 3 === 0 ? C.brickDark : fill;
      roundRect(g, bx + 2, y + 2, bw - 4, rh - 4, 2); g.fill();
    }
    g.restore();
  }
  g.strokeStyle = OUTLINE; g.lineWidth = 4; g.strokeRect(x, top, w, rows * rh);
}

// Бетонный блок / плита.
export function concrete(g, x, y, w, h, seams = 0) {
  rect(g, x, y, w, h, C.concrete, 4);
  g.fillStyle = C.concreteLight; g.fillRect(x + 2, y + 2, w - 4, Math.min(6, h / 3));
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < Math.round(w * h / 900); i++) {
    const r = seeded(i * 7 + w + h);
    g.beginPath(); g.arc(x + 6 + r() * (w - 12), y + 6 + r() * (h - 10), 1.8, 0, TAU); g.fill();
  }
  if (seams) {
    g.strokeStyle = C.concreteDark; g.lineWidth = 3;
    for (let i = 1; i < seams; i++) { const sx = x + (w * i) / seams; g.beginPath(); g.moveTo(sx, y + 3); g.lineTo(sx, y + h - 3); g.stroke(); }
  }
}

// Арматура — железная сетка.
export function rebarGrid(g, x, y, w, h, step = 20) {
  g.lineCap = 'round';
  for (const [col, lw] of [[OUTLINE, 6], [C.rebar, 3]]) {
    g.strokeStyle = col; g.lineWidth = lw;
    g.beginPath();
    for (let xx = x; xx <= x + w + 0.1; xx += step) { g.moveTo(xx, y); g.lineTo(xx, y + h); }
    for (let yy = y; yy <= y + h + 0.1; yy += step) { g.moveTo(x, yy); g.lineTo(x + w, yy); }
    g.stroke();
  }
}

// Окно с рамой и перекладиной.
export function windowBox(g, x, y, w, h, frame = '#ffffff') {
  box(g, x - 4, y - 4, w + 8, h + 8, 4, frame, 3);
  rectWindow(g, x, y, w, h);
  line(g, x + w / 2, y + 2, x + w / 2, y + h - 2, frame, 4);
  line(g, x + 2, y + h * 0.45, x + w - 2, y + h * 0.45, frame, 4);
  box(g, x - 8, y + h + 2, w + 16, 7, 3, frame, 3);
}

export function door(g, x, y, w, h, fill = '#8a4b2a') {
  box(g, x, y, w, h, 5, fill, 4);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
  g.strokeRect(x + 8, y + 10, w - 16, h * 0.35); g.strokeRect(x + 8, y + h * 0.5, w - 16, h * 0.4);
  circle(g, x + w - 11, y + h * 0.52, 4, '#ffcf3a', 2);
}

// Двускатная крыша: от x0 до x1 по низу base, конёк на высоте peak.
export function gableRoof(g, x0, x1, base, peak, fill = '#e8412c', dark = '#b52b1b') {
  shape(g, fill, (q) => { q.moveTo(x0, base); q.lineTo((x0 + x1) / 2, peak); q.lineTo(x1, base); q.closePath(); }, 5);
  // черепица
  g.save(); g.beginPath(); g.moveTo(x0, base); g.lineTo((x0 + x1) / 2, peak); g.lineTo(x1, base); g.closePath(); g.clip();
  g.strokeStyle = dark; g.lineWidth = 3;
  for (let y = peak + 18; y < base; y += 18) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
  g.restore();
  box(g, x0 - 6, base - 4, x1 - x0 + 12, 12, 5, dark, 4);
}

export function tree(g, x, base, s = 1) {
  box(g, x - 9 * s, base - 70 * s, 18 * s, 70 * s, 4, '#9b5b2a', 4);
  g.fillStyle = C.grass; g.strokeStyle = OUTLINE; g.lineWidth = 4;
  g.beginPath();
  g.arc(x, base - 110 * s, 40 * s, 0, TAU);
  g.moveTo(x - 30 * s + 32 * s, base - 80 * s); g.arc(x - 30 * s, base - 80 * s, 32 * s, 0, TAU);
  g.moveTo(x + 30 * s + 32 * s, base - 80 * s); g.arc(x + 30 * s, base - 80 * s, 32 * s, 0, TAU);
  g.stroke(); g.fill();
  g.fillStyle = C.grassDark;
  for (const [dx, dy] of [[-18, -96], [14, -120], [26, -82], [-34, -74]]) { g.beginPath(); g.arc(x + dx * s, base + dy * s, 6 * s, 0, TAU); g.fill(); }
  g.fillStyle = '#e8412c';
  for (const [dx, dy] of [[-8, -124], [32, -96], [-40, -90]]) { g.beginPath(); g.arc(x + dx * s, base + dy * s, 5 * s, 0, TAU); g.fill(); }
}

export function bush(g, x, base, w = 90, h = 46) {
  g.fillStyle = C.grassDark; g.strokeStyle = OUTLINE; g.lineWidth = 4;
  g.beginPath();
  const n = 3;
  for (let i = 0; i < n; i++) {
    const cx = x - w / 2 + w * (i + 0.5) / n, r = (w / n) * 0.72;
    g.moveTo(cx + r, base - h * 0.45); g.arc(cx, base - h * 0.45 - (i === 1 ? h * 0.2 : 0), r, 0, TAU);
  }
  g.stroke(); g.fill();
  g.fillRect(x - w / 2 + 4, base - h * 0.5, w - 8, h * 0.5);
  g.strokeStyle = OUTLINE; g.beginPath(); g.moveTo(x - w / 2 + 2, base); g.lineTo(x + w / 2 - 2, base); g.stroke();
  for (const [dx, dy, c] of [[-w * 0.25, -h * 0.6, '#ff6fa8'], [w * 0.1, -h * 0.85, '#ffcf3a'], [w * 0.3, -h * 0.5, '#ffffff']]) circle(g, x + dx, base + dy, 5, c, 2);
}

export function flowers(g, x0, x1, base, seed = 9) {
  const r = seeded(seed);
  const colors = ['#ff6fa8', '#ffcf3a', '#ffffff', '#b36bff', '#ff8a1a'];
  for (let x = x0; x < x1; x += 22 + r() * 10) {
    const h = 14 + r() * 14;
    line(g, x, base, x + 2, base - h, C.grassDark, 4);
    g.fillStyle = C.grass; g.beginPath(); g.ellipse(x - 6, base - h * 0.4, 7, 3, -0.5, 0, TAU); g.fill();
    circle(g, x + 2, base - h, 6, colors[Math.floor(r() * colors.length)], 2);
    circle(g, x + 2, base - h, 2.2, '#ff8a1a');
  }
}

// Уличный фонарь: столб от base вверх на h, плафон светится.
export function streetLamp(g, x, base, h, dir = 1) {
  box(g, x - 5, base - h, 10, h, 4, '#3b4250', 3);
  box(g, x - 12, base - 10, 24, 10, 3, '#3b4250', 3);
  g.strokeStyle = OUTLINE; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, base - h + 4); g.quadraticCurveTo(x, base - h - 16, x + 22 * dir, base - h - 14); g.stroke();
  g.strokeStyle = '#3b4250'; g.lineWidth = 4; g.stroke();
  g.fillStyle = 'rgba(255, 246, 168, 0.45)';
  g.beginPath(); g.arc(x + 26 * dir, base - h - 6, 20, 0, TAU); g.fill();
  shape(g, '#3b4250', (q) => { q.moveTo(x + 12 * dir, base - h - 12); q.lineTo(x + 40 * dir, base - h - 12); q.lineTo(x + 34 * dir, base - h - 2); q.lineTo(x + 18 * dir, base - h - 2); q.closePath(); }, 3);
  circle(g, x + 26 * dir, base - h + 2, 6, C.lamp, 2);
}

// Стопка досок, лежащих на земле (низкая — не выше 26 px).
export function boardPile(g, x, base, w, n = 3) {
  for (let i = 0; i < n; i++) plank(g, x + (i % 2) * 8, base - (i + 1) * 8, w - 8, 8, i % 2 ? C.woodLight : C.wood);
}

export { OUTLINE, TAU, box, shape, circle, line, roundRect };

// Словарь картинок для AssetLoader: 'object/<id>/layer/<layer>' → {w: 600, h: 440, draw}.
export function makeLayers(id, layers) {
  const art = {};
  for (const k of Object.keys(layers)) art['object/' + id + '/layer/' + k] = { w: LW, h: LH, draw: (g) => layers[k](g) };
  return art;
}
