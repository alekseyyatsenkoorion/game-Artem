// Общие помощники рисования машин: колесо, гусеница, кабина, труба, фара, мигалка,
// сборка картинок машины (детали, позы idle/work/dirty/silhouette). Один стиль для всех машин:
// толстая тёмная обводка, сочные цвета, скруглённые формы.
import { roundRect } from '../core/draw-utils.js';

export const OUTLINE = '#2a2230';
export const STEEL = '#3b4250';
export const STEEL_LIGHT = '#9aa0aa';
export const GLASS = '#9fdcff';
export const LAMP = '#fff6a8';
export const TIRE = '#26262b';

export const TAU = Math.PI * 2;

// Залитая фигура с обводкой: path(g) строит контур.
export function shape(g, fill, path, lw = 5) {
  g.lineJoin = 'round';
  g.fillStyle = fill;
  g.strokeStyle = OUTLINE; g.lineWidth = lw;
  g.beginPath(); path(g); g.fill(); g.stroke();
}

export function box(g, x, y, w, h, r, fill, lw = 5) {
  g.lineJoin = 'round';
  g.fillStyle = fill;
  g.strokeStyle = OUTLINE; g.lineWidth = lw;
  roundRect(g, x, y, w, h, r); g.fill(); g.stroke();
}

export function circle(g, cx, cy, r, fill, lw = 0) {
  g.fillStyle = fill;
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  if (lw) { g.strokeStyle = OUTLINE; g.lineWidth = lw; g.stroke(); }
}

export function poly(g, pts) {
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}

export function line(g, x1, y1, x2, y2, color, lw) {
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}

// Колесо: шина с протектором, диск, болты. hub — цвет диска.
export function drawWheel(g, cx, cy, r, hub = '#c9ccd2') {
  g.fillStyle = TIRE;
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.fillStyle = '#3d3d44';
  const n = Math.max(8, Math.round(r / 4));
  const tw = Math.max(4, r * 0.16);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    g.save(); g.translate(cx + Math.cos(a) * (r - tw * 0.5), cy + Math.sin(a) * (r - tw * 0.5)); g.rotate(a);
    g.fillRect(-tw / 2, -tw * 0.9, tw, tw * 1.8); g.restore();
  }
  g.fillStyle = hub;
  g.beginPath(); g.arc(cx, cy, r * 0.52, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = Math.max(2, r * 0.06);
  g.beginPath(); g.arc(cx, cy, r * 0.52, 0, TAU); g.stroke();
  g.fillStyle = '#6b707a';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3, r * 0.07, 0, TAU); g.fill();
  }
  g.fillStyle = '#4b4f57';
  g.beginPath(); g.arc(cx, cy, r * 0.16, 0, TAU); g.fill();
}

// Гусеница: лента с траками, внутри катки и звёздочка.
export function drawTrack(g, x, y, w, h, accent = '#ffc21a') {
  const r = h / 2;
  g.lineJoin = 'round';
  g.fillStyle = TIRE;
  g.strokeStyle = OUTLINE; g.lineWidth = 5;
  roundRect(g, x, y, w, h, r); g.fill(); g.stroke();
  // траки по краю
  g.fillStyle = '#4a4a52';
  for (let tx = x + r * 0.6; tx < x + w - r * 0.6; tx += 22) {
    g.fillRect(tx, y + 1, 12, 7);
    g.fillRect(tx, y + h - 8, 12, 7);
  }
  // внутренняя часть
  g.fillStyle = '#55565f';
  roundRect(g, x + 10, y + 10, w - 20, h - 20, r - 10); g.fill();
  // катки
  const n = Math.max(3, Math.round((w - 2 * r) / (h * 0.55)) + 1);
  const rr = (h - 20) * 0.32;
  for (let i = 0; i < n; i++) {
    const cx = x + r + (i * (w - 2 * r)) / (n - 1);
    circle(g, cx, y + h / 2, rr, '#8d929c');
    circle(g, cx, y + h / 2, rr * 0.4, accent);
  }
  // большие колёса по краям
  circle(g, x + r, y + r, r - 14, '#c9ccd2', 3);
  circle(g, x + r, y + r, (r - 14) * 0.35, accent);
  circle(g, x + w - r, y + r, r - 14, '#c9ccd2', 3);
  circle(g, x + w - r, y + r, (r - 14) * 0.35, accent);
}

// Окно с бликом: прямоугольник или многоугольник.
export function drawWindow(g, pts) {
  g.fillStyle = GLASS;
  g.strokeStyle = OUTLINE; g.lineWidth = 4; g.lineJoin = 'round';
  g.beginPath(); poly(g, pts); g.fill(); g.stroke();
  // блик
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [px, py] of pts) { minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py); }
  const ww = maxX - minX, hh = maxY - minY;
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = Math.max(3, Math.min(ww, hh) * 0.1); g.lineCap = 'round';
  g.beginPath(); g.moveTo(minX + ww * 0.2, maxY - hh * 0.2); g.lineTo(minX + ww * 0.42, minY + hh * 0.25); g.stroke();
}

export function rectWindow(g, x, y, w, h) {
  drawWindow(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
}

// Кабина-коробка: крыша, окно спереди (справа), дверь.
export function drawCab(g, x, y, w, h, color, dark) {
  box(g, x + 3, y + 3, w - 6, h - 6, 14, color);
  // крыша
  g.fillStyle = dark;
  roundRect(g, x + 3, y + 3, w - 6, 12, 6); g.fill();
  const wx = x + w * 0.14, wy = y + h * 0.16;
  drawWindow(g, [[wx, wy], [x + w * 0.78, wy], [x + w - 12, y + h * 0.55], [wx, y + h * 0.55]]);
  g.strokeStyle = dark; g.lineWidth = 4;
  g.beginPath(); g.moveTo(wx, y + h * 0.62); g.lineTo(x + w * 0.7, y + h * 0.62); g.lineTo(x + w * 0.7, y + h - 12); g.stroke();
  g.fillStyle = OUTLINE;
  roundRect(g, x + w * 0.5, y + h * 0.7, w * 0.14, 7, 3); g.fill();
}

// Выхлопная труба с крышечкой.
export function drawPipe(g, x, y, w, h) {
  const pw = Math.min(w * 0.55, 26);
  const px = x + (w - pw) / 2;
  box(g, px, y + 10, pw, h - 10, 5, '#5a5f6b', 4);
  box(g, px - 4, y + 4, pw + 8, 12, 4, '#2f333b', 4);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(px + 4, y + 20, 5, h - 34);
}

// Фара: светящийся круг.
export function drawLamp(g, cx, cy, r) {
  circle(g, cx, cy, r * 1.25, '#9aa0aa', 3);
  circle(g, cx, cy, r, LAMP, 3);
  circle(g, cx - r * 0.3, cy - r * 0.3, r * 0.3, '#ffffff');
}

// Мигалка на крыше.
export function drawBeacon(g, cx, by, r) {
  box(g, cx - r * 1.2, by - r * 0.5, r * 2.4, r * 0.5, 3, STEEL, 3);
  g.fillStyle = '#ff8a1a'; g.strokeStyle = OUTLINE; g.lineWidth = 4;
  g.beginPath(); g.arc(cx, by - r * 0.5, r, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
  circle(g, cx - r * 0.35, by - r * 0.95, r * 0.25, '#ffe2b0');
}

// Предупреждающие полоски «жёлтый-чёрный» в прямоугольнике.
export function hazard(g, x, y, w, h, c1 = '#ffcf3a', c2 = STEEL) {
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = c2; g.fillRect(x, y, w, h);
  g.fillStyle = c1;
  for (let sx = x - h; sx < x + w + h; sx += 28) {
    g.beginPath(); poly(g, [[sx, y + h], [sx + h, y], [sx + h + 14, y], [sx + 14, y + h]]); g.fill();
  }
  g.restore();
}

// Решётка (ферма) между двумя линиями — для башенного крана.
export function lattice(g, x, y, w, h, color, vertical) {
  g.strokeStyle = OUTLINE; g.lineWidth = 7; g.lineCap = 'round';
  const seg = vertical ? w : h;
  g.beginPath();
  if (vertical) {
    for (let yy = y; yy < y + h - 1; yy += seg) { g.moveTo(x, yy); g.lineTo(x + w, Math.min(y + h, yy + seg)); g.moveTo(x + w, yy); g.lineTo(x, Math.min(y + h, yy + seg)); }
    g.moveTo(x, y); g.lineTo(x, y + h); g.moveTo(x + w, y); g.lineTo(x + w, y + h);
  } else {
    for (let xx = x; xx < x + w - 1; xx += seg) { g.moveTo(xx, y + h); g.lineTo(Math.min(x + w, xx + seg / 2), y); g.lineTo(Math.min(x + w, xx + seg), y + h); }
    g.moveTo(x, y); g.lineTo(x + w, y); g.moveTo(x, y + h); g.lineTo(x + w, y + h);
  }
  g.stroke();
  g.strokeStyle = color; g.lineWidth = 4;
  g.stroke();
}

// Комья грязи для позы dirty.
export function mudBlobs(g, blobs) {
  g.fillStyle = 'rgba(110, 72, 32, 0.78)';
  for (const [x, y, r] of blobs) {
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.arc(x + r * 0.8, y + r * 0.3, r * 0.6, 0, TAU); g.arc(x - r * 0.6, y + r * 0.5, r * 0.45, 0, TAU); g.fill();
  }
  g.fillStyle = 'rgba(80, 50, 20, 0.6)';
  for (const [x, y, r] of blobs) {
    g.beginPath(); g.arc(x + r * 1.4, y - r * 0.6, r * 0.22, 0, TAU); g.arc(x - r * 1.1, y - r * 0.4, r * 0.18, 0, TAU); g.fill();
  }
}

// Песок/земля кучкой.
export function pile(g, cx, by, w, h, color, dark) {
  g.fillStyle = color; g.strokeStyle = OUTLINE; g.lineWidth = 4;
  g.beginPath(); g.moveTo(cx - w / 2, by); g.quadraticCurveTo(cx - w * 0.2, by - h * 1.2, cx, by - h); g.quadraticCurveTo(cx + w * 0.25, by - h * 1.1, cx + w / 2, by); g.closePath(); g.fill(); g.stroke();
  if (dark) {
    g.fillStyle = dark;
    for (let i = 0; i < 7; i++) circle(g, cx - w * 0.3 + (i * w * 0.6) / 6, by - h * (0.25 + 0.35 * ((i * 37) % 10) / 10), 4);
  }
}

// Рисует деталь машины в её прямоугольнике.
export function drawPartAt(g, partDraw, p, dx = 0, dy = 0) {
  g.save();
  g.translate(p.x + dx, p.y + dy);
  partDraw[p.id](g, p.w, p.h);
  g.restore();
}

// Поворот группы деталей вокруг точки (для поз work).
export function rotated(g, px, py, a, fn) {
  g.save();
  g.translate(px, py); g.rotate(a); g.translate(-px, -py);
  fn();
  g.restore();
}

// Собирает функции рисования машины: drawWhole(g, opts), drawWork, drawDirty, drawSilhouette
// и словарь картинок для AssetLoader.
// opts.special(g, p) — вернуть true, если деталь нарисована особым способом (поза work).
export function makeMachine(machine, partDraw, { work, blobs = [] } = {}) {
  const sorted = machine.parts.slice().sort((a, b) => a.z - b.z);
  const { w: W, h: H } = machine.size;

  function drawWhole(g, opts = {}) {
    for (const p of sorted) {
      if (opts.skip && opts.skip.includes(p.id)) continue;
      if (opts.special && opts.special(g, p)) continue;
      drawPartAt(g, partDraw, p);
    }
  }
  const drawWork = work ? (g) => work(g, W, H, drawWhole) : (g) => drawWhole(g);
  function drawDirty(g) {
    drawWhole(g);
    // грязь ложится только на машину
    g.globalCompositeOperation = 'source-atop';
    mudBlobs(g, blobs);
    g.globalCompositeOperation = 'source-over';
  }
  function drawSilhouette(g) {
    drawWhole(g);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#5a6b80';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }

  const art = {};
  const id = machine.id;
  for (const p of machine.parts) {
    art['machine/' + id + '/part/' + p.id] = { w: p.w, h: p.h, draw: (g) => partDraw[p.id](g, p.w, p.h) };
  }
  art['machine/' + id + '/whole/idle'] = { w: W, h: H, draw: (g) => drawWhole(g) };
  art['machine/' + id + '/whole/work'] = { w: W, h: H, draw: drawWork };
  art['machine/' + id + '/whole/dirty'] = { w: W, h: H, draw: drawDirty };
  art['machine/' + id + '/whole/silhouette'] = { w: W, h: H, draw: drawSilhouette };
  return { art, drawWhole, drawWork, drawDirty, drawSilhouette, size: machine.size };
}

// Кабина грузовика (нос вправо), как у самосвала: скошенное лобовое окно, фара, бампер.
export function drawTruckCab(g, w, h, color, dark) {
  const sx = w / 190, sy = h / 170;
  g.save(); g.scale(sx, sy);
  shape(g, color, (q) => {
    q.moveTo(4, 166); q.lineTo(4, 26); q.quadraticCurveTo(4, 4, 26, 4); q.lineTo(118, 4);
    q.quadraticCurveTo(132, 4, 140, 16); q.lineTo(176, 78); q.quadraticCurveTo(186, 86, 186, 104); q.lineTo(186, 166); q.closePath();
  }, 5 / Math.min(sx, sy));
  drawWindow(g, [[24, 22], [116, 22], [152, 82], [24, 82]]);
  g.strokeStyle = dark; g.lineWidth = 4;
  g.beginPath(); g.moveTo(24, 96); g.lineTo(140, 96); g.lineTo(140, 154); g.stroke();
  g.fillStyle = OUTLINE; roundRect(g, 104, 108, 26, 8, 4); g.fill();
  drawLamp(g, 172, 122, 10);
  g.fillStyle = STEEL_LIGHT; roundRect(g, 160, 144, 26, 20, 5); g.fill();
  g.restore();
}
