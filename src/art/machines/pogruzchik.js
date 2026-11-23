// Погрузчик: оранжевый, четыре больших колеса, высокая кабина, большой ковш спереди.
import pogruzchik from '../../data/machines/pogruzchik.js';
import { OUTLINE, STEEL, box, shape, circle, line, drawWheel, drawCab, drawPipe, drawLamp, hazard, makeMachine, drawPartAt, rotated } from '../parts-common.js';

const OR = '#ff8c1a', OR_DARK = '#d96a00', BUCKET = '#8d929c';

function strela(g, w, h) {
  line(g, 12, 18, 116, 86, OUTLINE, 22); line(g, 12, 18, 116, 86, OR, 14);
  line(g, 20, 52, 90, 60, OUTLINE, 12); line(g, 20, 52, 90, 60, '#c9ccd2', 6);
  circle(g, 12, 18, 9, STEEL, 3);
}

function kovsh(g, w, h, load) {
  // боковая стенка ковша; открытая сторона — диагональ спереди
  if (load) {
    g.fillStyle = load; g.strokeStyle = OUTLINE; g.lineWidth = 4;
    g.beginPath(); g.moveTo(80, 12); g.quadraticCurveTo(150, 10, 124, 146); g.closePath(); g.fill(); g.stroke();
  }
  shape(g, BUCKET, (q) => {
    q.moveTo(124, 152); q.lineTo(30, 154); q.quadraticCurveTo(6, 150, 6, 110); q.lineTo(10, 34);
    q.quadraticCurveTo(14, 6, 42, 6); q.lineTo(84, 8); q.closePath();
  });
  g.strokeStyle = '#6b707a'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(30, 130); g.quadraticCurveTo(22, 70, 40, 26); g.stroke();
  box(g, 60, 144, 68, 12, 3, '#d9dce2', 3);
  circle(g, 10, 12, 9, STEEL, 3);
}

const PART_DRAW = {
  'koleso-zadnee': (g, w, h) => drawWheel(g, w / 2, h / 2, w / 2 - 2, '#ffc21a'),
  'koleso-perednee': (g, w, h) => drawWheel(g, w / 2, h / 2, w / 2 - 2, '#ffc21a'),
  rama: (g, w, h) => { box(g, 3, 4, w - 6, h - 8, 12, OR); hazard(g, 16, h - 24, w - 32, 12); circle(g, w / 2 + 20, h / 2 - 6, 10, STEEL, 3); },
  lestnica: (g, w, h) => {
    box(g, 8, 2, 12, h - 4, 4, STEEL, 3); box(g, w - 20, 2, 12, h - 4, 4, STEEL, 3);
    for (let y = 22; y < h - 6; y += 26) box(g, 14, y, w - 28, 8, 3, '#c9ccd2', 3);
  },
  kabina: (g, w, h) => drawCab(g, 0, 0, w, h, OR, OR_DARK),
  motor: (g, w, h) => {
    drawPipe(g, 120, 0, 36, 50);
    shape(g, OR, (q) => { q.moveTo(w, 34); q.lineTo(40, 34); q.quadraticCurveTo(4, 36, 4, 70); q.lineTo(4, h - 2); q.lineTo(w, h - 2); q.closePath(); });
    g.strokeStyle = OR_DARK; g.lineWidth = 6; g.lineCap = 'round';
    for (let x = 50; x < w - 20; x += 22) { g.beginPath(); g.moveTo(x, 52); g.lineTo(x, 84); g.stroke(); }
    drawLamp(g, 20, 62, 8);
  },
  strela,
  kovsh: (g, w, h) => kovsh(g, w, h, null),
};

function work(g, W, H, drawWhole, load = '#f2c66d') {
  drawWhole(g, { skip: ['strela', 'kovsh'] });
  const sp = pogruzchik.parts.find((p) => p.id === 'strela');
  const kp = pogruzchik.parts.find((p) => p.id === 'kovsh');
  rotated(g, sp.x + 12, sp.y + 18, -0.42, () => drawPartAt(g, PART_DRAW, sp));
  // ковш поднят вместе с рычагами, в нём песок
  g.save(); g.translate(kp.x, kp.y - 66); kovsh(g, kp.w, kp.h, load); g.restore();
}

export const machine = makeMachine(pogruzchik, PART_DRAW, {
  work,
  blobs: [[100, 190, 22], [300, 200, 20], [110, 300, 20], [400, 300, 22], [280, 110, 16], [550, 260, 20]],
});
export const art = machine.art;

// Ковш поднят с грузом нужного цвета (для пазла: снег зимой).
export function drawWithLoad(g, color) {
  work(g, pogruzchik.size.w, pogruzchik.size.h, machine.drawWhole, color);
}
