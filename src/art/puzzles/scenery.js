// Детали пейзажей для картинок пазлов: небо, облака, деревья, цветы, стройка.
// Всё детерминировано: «случайность» — свой генератор с зерном, чтобы картинка была всегда одна.
import { roundRect } from '../../core/draw-utils.js';
import { OUTLINE, TAU, box, shape, circle, line, poly, hazard, pile } from '../parts-common.js';

export const PW = 640, PH = 480;

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function sky(g, top, bottom, h = PH) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, PW, h);
}

export function sun(g, x, y, r, color = '#ffe14d', rays = true) {
  if (rays) {
    g.strokeStyle = color; g.lineWidth = 6; g.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.beginPath(); g.moveTo(x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10)); g.lineTo(x + Math.cos(a) * (r + 26), y + Math.sin(a) * (r + 26)); g.stroke();
    }
  }
  circle(g, x, y, r, color, 4);
}

export function cloud(g, x, y, s, color = '#ffffff') {
  g.fillStyle = color; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, 22 * s, Math.PI * 0.5, Math.PI * 1.5);
  g.arc(x + 26 * s, y - 16 * s, 26 * s, Math.PI, Math.PI * 1.9);
  g.arc(x + 60 * s, y - 8 * s, 22 * s, Math.PI * 1.2, Math.PI * 0.1);
  g.arc(x + 70 * s, y + 8 * s, 14 * s, Math.PI * 1.5, Math.PI * 0.5);
  g.closePath(); g.fill(); g.stroke();
}

export function hills(g, y, color, amp, seed, freq = 90) {
  g.fillStyle = color; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-10, PH + 10);
  for (let x = -10; x <= PW + 10; x += 10) g.lineTo(x, y - Math.sin(x / freq + seed) * amp - Math.sin(x / 37 + seed * 3) * amp * 0.25);
  g.lineTo(PW + 10, PH + 10); g.closePath(); g.fill(); g.stroke();
}

export function ground(g, y, color, edge) {
  g.fillStyle = color; g.fillRect(0, y, PW, PH - y);
  if (edge) { g.fillStyle = edge; g.fillRect(0, y, PW, 6); }
}

export function mountains(g, baseY, peaks, color, snow = '#ffffff') {
  for (const [x, w, h] of peaks) {
    shape(g, color, (q) => poly(q, [[x - w / 2, baseY], [x, baseY - h], [x + w / 2, baseY]]), 3);
    if (snow) shape(g, snow, (q) => poly(q, [[x - w * 0.14, baseY - h * 0.72], [x, baseY - h], [x + w * 0.14, baseY - h * 0.72], [x + w * 0.05, baseY - h * 0.78], [x - w * 0.04, baseY - h * 0.7]]), 3);
  }
}

export function tree(g, x, gy, s, crown = '#4cbb4a', trunk = '#8b5a2b') {
  box(g, x - 7 * s, gy - 46 * s, 14 * s, 46 * s, 3, trunk, 3);
  g.fillStyle = crown; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  g.beginPath();
  g.arc(x, gy - 74 * s, 30 * s, 0, TAU); g.moveTo(x - 6 * s, gy - 56 * s);
  g.arc(x - 22 * s, gy - 56 * s, 20 * s, 0, TAU); g.moveTo(x + 42 * s, gy - 56 * s);
  g.arc(x + 22 * s, gy - 56 * s, 20 * s, 0, TAU);
  g.fill(); g.stroke();
  g.fill();
}

export function spruce(g, x, gy, s, color = '#2f9e52', snowy = false) {
  box(g, x - 6 * s, gy - 18 * s, 12 * s, 18 * s, 2, '#7a4a22', 3);
  for (let i = 0; i < 3; i++) {
    const top = gy - 18 * s - (i + 1) * 30 * s, half = (36 - i * 8) * s;
    shape(g, color, (q) => poly(q, [[x - half, top + 40 * s], [x, top], [x + half, top + 40 * s]]), 3);
    if (snowy) shape(g, '#ffffff', (q) => poly(q, [[x - half * 0.5, top + 20 * s], [x, top], [x + half * 0.5, top + 20 * s], [x, top + 14 * s]]), 2);
  }
}

export function flower(g, x, y, r, petal, center = '#ffd23f') {
  g.fillStyle = petal; g.strokeStyle = OUTLINE; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, TAU); g.fill(); g.stroke();
  }
  circle(g, x, y, r * 0.6, center, 2);
}

export function stemFlower(g, x, gy, h, petal, r = 7) {
  line(g, x, gy, x, gy - h, '#2f8a3a', 3);
  flower(g, x, gy - h, r, petal);
}

export function tufts(g, rnd, y0, y1, n, color = '#2f8a3a') {
  g.strokeStyle = color; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rnd() * PW, y = y0 + rnd() * (y1 - y0);
    g.beginPath(); g.moveTo(x - 6, y - 10); g.lineTo(x, y); g.lineTo(x + 2, y - 14); g.moveTo(x, y); g.lineTo(x + 8, y - 9); g.stroke();
  }
}

export function stones(g, rnd, y0, y1, n, color = '#9aa0aa') {
  for (let i = 0; i < n; i++) {
    const x = rnd() * PW, y = y0 + rnd() * (y1 - y0), r = 5 + rnd() * 7;
    g.fillStyle = color; g.strokeStyle = OUTLINE; g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y, r * 1.3, r, 0, 0, TAU); g.fill(); g.stroke();
  }
}

export function sunflower(g, x, gy, h, s = 1) {
  line(g, x, gy, x, gy - h, '#2f8a3a', 5 * s);
  shape(g, '#3fa34d', (q) => { q.ellipse(x - 12 * s, gy - h * 0.45, 12 * s, 5 * s, -0.5, 0, TAU); }, 2);
  g.fillStyle = '#ffc21a'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.beginPath(); g.ellipse(x + Math.cos(a) * 15 * s, gy - h + Math.sin(a) * 15 * s, 9 * s, 4.5 * s, a, 0, TAU); g.fill(); g.stroke();
  }
  circle(g, x, gy - h, 11 * s, '#6b3f1d', 2);
}

export function reeds(g, x, gy, s = 1) {
  for (const [dx, h] of [[-8, 70], [0, 90], [9, 64]]) {
    line(g, x + dx * s, gy, x + dx * s, gy - h * s, '#3f8f3a', 4 * s);
    box(g, x + dx * s - 5 * s, gy - h * s - 4 * s, 10 * s, 26 * s, 5 * s, '#8b5a2b', 2);
  }
}

export function waves(g, y0, y1, color, step = 46) {
  g.strokeStyle = color; g.lineWidth = 4; g.lineCap = 'round';
  let row = 0;
  for (let y = y0; y < y1; y += 22, row++) {
    for (let x = (row % 2) * step / 2 - 20; x < PW; x += step) {
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 8, x + 20, y); g.stroke();
    }
  }
}

export function lily(g, x, y) {
  g.fillStyle = '#4cbb4a'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
  g.beginPath(); g.ellipse(x, y, 22, 9, 0, 0.3, TAU - 0.1); g.lineTo(x, y); g.closePath(); g.fill(); g.stroke();
  flower(g, x + 4, y - 4, 4, '#ffb0d0', '#ffe14d');
}

export function snowflakes(g, rnd, n) {
  g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rnd() * PW, y = rnd() * PH, r = 4 + rnd() * 5;
    g.beginPath();
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI; g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.stroke();
  }
}

export function rainbow(g, cx, cy, r) {
  const cols = ['#ff4d4d', '#ff9a1a', '#ffe14d', '#4cbb4a', '#3aa0ff', '#4a5bd6', '#9b59d0'];
  g.lineWidth = 18;
  cols.forEach((c, i) => { g.strokeStyle = c; g.beginPath(); g.arc(cx, cy, r - i * 17, Math.PI, 0); g.stroke(); });
}

export function lighthouse(g, x, gy, s) {
  const w0 = 34 * s, w1 = 22 * s, h = 150 * s;
  g.save();
  g.beginPath(); poly(g, [[x - w0, gy], [x - w1, gy - h], [x + w1, gy - h], [x + w0, gy]]);
  g.fillStyle = '#ffffff'; g.fill(); g.clip();
  g.fillStyle = '#e8412c';
  for (let i = 0; i < 5; i += 2) g.fillRect(x - w0, gy - h + (i * h) / 5, w0 * 2, h / 5);
  g.restore();
  g.strokeStyle = OUTLINE; g.lineWidth = 3;
  g.beginPath(); poly(g, [[x - w0, gy], [x - w1, gy - h], [x + w1, gy - h], [x + w0, gy]]); g.stroke();
  box(g, x - w1 - 4, gy - h - 26 * s, (w1 + 4) * 2, 26 * s, 3, '#fff3a0', 3);
  shape(g, '#e8412c', (q) => poly(q, [[x - w1 - 8, gy - h - 26 * s], [x, gy - h - 48 * s], [x + w1 + 8, gy - h - 26 * s]]), 3);
}

export function sailboat(g, x, y, s) {
  shape(g, '#e8412c', (q) => poly(q, [[x - 40 * s, y], [x + 40 * s, y], [x + 28 * s, y + 16 * s], [x - 28 * s, y + 16 * s]]), 3);
  line(g, x, y, x, y - 70 * s, OUTLINE, 3);
  shape(g, '#ffffff', (q) => poly(q, [[x + 4, y - 6], [x + 4, y - 66 * s], [x + 40 * s, y - 6]]), 3);
  shape(g, '#ffe14d', (q) => poly(q, [[x - 4, y - 10], [x - 4, y - 56 * s], [x - 28 * s, y - 10]]), 3);
}

export function shell(g, x, y, c = '#ffb3a7') {
  g.fillStyle = c; g.strokeStyle = OUTLINE; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x - 10, y); g.arc(x, y, 10, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y - 8); g.moveTo(x, y); g.lineTo(x, y - 10); g.moveTo(x, y); g.lineTo(x + 6, y - 8); g.stroke();
}

export function windmill(g, x, gy, s) {
  shape(g, '#f4e3c3', (q) => poly(q, [[x - 18 * s, gy], [x - 10 * s, gy - 90 * s], [x + 10 * s, gy - 90 * s], [x + 18 * s, gy]]), 3);
  shape(g, '#b5562e', (q) => poly(q, [[x - 14 * s, gy - 90 * s], [x, gy - 108 * s], [x + 14 * s, gy - 90 * s]]), 3);
  g.save(); g.translate(x, gy - 92 * s); g.rotate(0.4);
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); box(g, -5 * s, -60 * s, 10 * s, 56 * s, 2, '#fff8e6', 2); }
  g.restore();
  circle(g, x, gy - 92 * s, 5 * s, OUTLINE);
}

export function leaves(g, rnd, y0, y1, n) {
  const cols = ['#ffb020', '#ff7a1a', '#e8412c', '#ffd23f'];
  for (let i = 0; i < n; i++) {
    const x = rnd() * PW, y = y0 + rnd() * (y1 - y0);
    g.fillStyle = cols[i % 4]; g.strokeStyle = OUTLINE; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(x, y, 7, 4, rnd() * 3, 0, TAU); g.fill(); g.stroke();
  }
}

export function bridge(g, x, y, w) {
  box(g, x, y, w, 16, 3, '#b07a3c', 3);
  for (let px = x + 6; px < x + w; px += 18) line(g, px, y + 2, px, y + 14, '#8b5a2b', 2);
  for (const px of [x + 10, x + w / 2, x + w - 10]) { box(g, px - 5, y - 34, 10, 34, 2, '#8b5a2b', 2); box(g, px - 5, y + 14, 10, 30, 2, '#8b5a2b', 2); }
  box(g, x + 4, y - 32, w - 8, 8, 2, '#c48a48', 2);
}

// ---------- стройка ----------

export function cone(g, x, gy, s = 1) {
  shape(g, '#ff7a1a', (q) => poly(q, [[x - 16 * s, gy - 4], [x, gy - 44 * s], [x + 16 * s, gy - 4]]), 3);
  g.fillStyle = '#ffffff'; g.fillRect(x - 9 * s, gy - 28 * s, 18 * s, 7 * s);
  box(g, x - 22 * s, gy - 6, 44 * s, 6, 2, '#ff7a1a', 3);
}

export function barrierFence(g, x, gy, w, h = 46) {
  for (let px = x; px <= x + w; px += 60) box(g, px - 4, gy - h - 10, 8, h + 10, 2, '#5a5f6b', 2);
  g.save(); g.beginPath(); g.rect(x, gy - h, w, h * 0.45); g.clip();
  hazard(g, x, gy - h, w, h * 0.45, '#ffffff', '#e8412c'); g.restore();
  g.strokeStyle = OUTLINE; g.lineWidth = 3; g.strokeRect(x, gy - h, w, h * 0.45);
}

export function tapePosts(g, x, gy, w, n = 4) {
  for (let i = 0; i < n; i++) box(g, x + (i * w) / (n - 1) - 4, gy - 50, 8, 50, 2, '#e8412c', 2);
  g.save(); g.beginPath(); g.rect(x, gy - 46, w, 10); g.clip(); hazard(g, x, gy - 46, w, 10, '#ffffff', '#e8412c'); g.restore();
}

export function bricks(g, x, gy, cols, rows) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols - (r % 2 ? 1 : 0); c++) {
    box(g, x + c * 30 + (r % 2) * 15, gy - (r + 1) * 15, 30, 15, 2, '#d0553a', 2);
  }
}

export function planks(g, x, gy, n, w = 140) {
  for (let i = 0; i < n; i++) box(g, x + (i % 2) * 6, gy - (i + 1) * 11, w, 11, 3, i % 2 ? '#f2b54a' : '#d99a3a', 2);
}

export function woodFence(g, x, gy, w, built) {
  const posts = Math.floor(w / 50) + 1;
  for (let i = 0; i < posts; i++) box(g, x + i * 50 - 6, gy - 80, 12, 80, 2, '#8b5a2b', 2);
  for (let i = 0; i < posts - 1; i++) {
    if (i >= built) continue;
    for (const y of [gy - 64, gy - 40]) box(g, x + i * 50, y, 50, 12, 2, '#d99a3a', 2);
  }
}

export function windowsGrid(g, x, y, cols, rows, cw, ch, colors) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    box(g, x + c * cw + cw * 0.2, y + r * ch + ch * 0.2, cw * 0.6, ch * 0.55, 3, colors[(r + c) % colors.length], 2);
  }
}

// Строящийся дом: нижние этажи с окнами, верхние — голые плиты.
export function buildingUnderway(g, x, gy, w, floors, done, color = '#f0b07a') {
  const fh = 44;
  for (let f = 0; f < floors; f++) {
    const y = gy - (f + 1) * fh;
    if (f < done) {
      box(g, x, y, w, fh, 2, color, 3);
      windowsGrid(g, x, y, Math.floor(w / 44), 1, w / Math.floor(w / 44), fh, ['#9fdcff', '#bfe8ff']);
    } else {
      box(g, x, y + fh - 10, w, 10, 2, '#b8b2a7', 3);
      for (let c = 0; c <= 2; c++) box(g, x + c * (w - 12) / 2, y, 12, fh - 10, 2, '#b8b2a7', 2);
    }
  }
}

export function tracks(g, y, color = 'rgba(90,60,30,0.35)') {
  g.strokeStyle = color; g.lineWidth = 3;
  for (let x = 0; x < PW; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 10); g.stroke(); g.beginPath(); g.moveTo(x, y + 18); g.lineTo(x + 8, y + 28); g.stroke(); }
}

export function cityline(g, baseY, color = '#a9c7e8') {
  const r = rng(77);
  g.fillStyle = color; g.strokeStyle = OUTLINE; g.lineWidth = 2;
  for (let x = 0; x < PW; x += 46) {
    const h = 40 + r() * 70;
    g.beginPath(); g.rect(x, baseY - h, 40, h); g.fill(); g.stroke();
    g.fillStyle = '#e6f1fb';
    for (let wy = baseY - h + 8; wy < baseY - 10; wy += 16) { g.fillRect(x + 8, wy, 8, 8); g.fillRect(x + 24, wy, 8, 8); }
    g.fillStyle = color;
  }
}

export function puddle(g, x, y, w) {
  g.fillStyle = '#7fc8ef'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
  g.beginPath(); g.ellipse(x, y, w, w * 0.25, 0, 0, TAU); g.fill(); g.stroke();
}

export function bush(g, x, gy, s, color = '#3fa34d', berry = '#ff6fa0') {
  g.fillStyle = color; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  g.beginPath(); g.arc(x - 18 * s, gy - 14 * s, 18 * s, Math.PI, 0); g.arc(x + 4 * s, gy - 22 * s, 22 * s, Math.PI, 0); g.arc(x + 24 * s, gy - 12 * s, 16 * s, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
  for (let i = 0; i < 5; i++) circle(g, x - 24 * s + i * 12 * s, gy - 14 * s - (i % 2) * 10 * s, 4 * s, berry, 1.5);
}

export { roundRect, pile };
