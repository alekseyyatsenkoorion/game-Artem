// Автокран: красная кабина водителя, жёлтая поворотная часть с кабиной крановщика,
// телескопическая стрела с крюком, опоры. Верх холста свободен — туда поднимается стрела в позе work.
import avtokran from '../../data/machines/avtokran.js';
import { OUTLINE, STEEL, box, shape, circle, line, drawWheel, drawTruckCab, hazard, makeMachine, drawPartAt, rotated, rectWindow } from '../parts-common.js';

const RED = '#e8412c', RED_DARK = '#b52b1b', Y = '#ffc21a', Y_DARK = '#d99a00';

function strela(g, w, h) {
  box(g, 2, 4, 220, 42, 10, Y);
  box(g, 216, 9, 140, 32, 8, Y_DARK);
  box(g, 350, 13, 96, 24, 6, Y);
  circle(g, 446, 25, 11, STEEL, 3);
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(14, 12, 196, 6);
  // блок для крюка
  circle(g, 265, 40, 7, STEEL, 3);
  circle(g, 14, 25, 9, STEEL, 3);
}

function hook(g, cx, top) {
  box(g, cx - 16, top, 32, 28, 6, Y);
  hazard(g, cx - 12, top + 6, 24, 16, Y, OUTLINE);
  g.strokeStyle = OUTLINE; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, top + 28); g.lineTo(cx, top + 40); g.arc(cx - 10, top + 46, 10, 0, Math.PI * 0.95); g.stroke();
  g.strokeStyle = '#c9ccd2'; g.lineWidth = 5; g.stroke();
}

function kryuk(g, w, h) {
  line(g, w / 2, 0, w / 2, 26, OUTLINE, 3);
  hook(g, w / 2, 26);
}

function kabinaKrana(g, w, h) {
  box(g, 10, h - 26, w - 14, 22, 6, STEEL, 4);
  shape(g, Y, (q) => { q.moveTo(4, h - 24); q.lineTo(4, 40); q.quadraticCurveTo(4, 26, 18, 26); q.lineTo(70, 26); q.lineTo(80, 4); q.lineTo(w - 2, 4); q.lineTo(w - 2, h - 24); q.closePath(); });
  rectWindow(g, 16, 40, 44, 50);
  g.fillStyle = Y_DARK; g.fillRect(70, 60, w - 76, 8);
  circle(g, w - 10, 35, 9, STEEL, 3);
}

function opory(g, w, h, out) {
  box(g, 4, 4, w - 8, 22, 5, '#c9ccd2', 4);
  hazard(g, 10, 9, w - 20, 12, Y, OUTLINE);
  const len = out ? h - 20 : 26;
  box(g, 18, 24, 18, len, 4, STEEL, 3); box(g, w - 36, 24, 18, len, 4, STEEL, 3);
  box(g, 6, 24 + len - 4, 42, 12, 3, '#9aa0aa', 3); box(g, w - 48, 24 + len - 4, 42, 12, 3, '#9aa0aa', 3);
}

const PART_DRAW = {
  strela,
  'kabina-krana': kabinaKrana,
  kabina: (g, w, h) => drawTruckCab(g, w, h, RED, RED_DARK),
  kryuk,
  rama: (g, w, h) => { box(g, 2, 3, w - 4, h - 6, 8, STEEL, 4); hazard(g, 12, 9, w - 24, h - 18); },
  opory: (g, w, h) => opory(g, w, h, false),
  'koleso-zadnee': (g, w, h) => { drawWheel(g, 52, h / 2, 41); drawWheel(g, w - 52, h / 2, 41); },
  'koleso-perednee': (g, w, h) => { drawWheel(g, 50, h / 2, 41); drawWheel(g, w - 50, h / 2, 41); },
};

function work(g, W, H, drawWhole) {
  drawWhole(g, { skip: ['strela', 'kryuk', 'opory'] });
  const op = avtokran.parts.find((p) => p.id === 'opory');
  g.save(); g.translate(op.x, op.y); opory(g, op.w, op.h, true); g.restore();
  const sp = avtokran.parts.find((p) => p.id === 'strela');
  const px = sp.x + 14, py = sp.y + 25, a = -0.33;
  rotated(g, px, py, a, () => drawPartAt(g, PART_DRAW, sp));
  // трос с кончика стрелы и плита на крюке
  const tx = px + Math.cos(a) * 432, ty = py + Math.sin(a) * 432;
  line(g, tx, ty, tx, 64, OUTLINE, 3);
  hook(g, tx, 64);
  const sx = tx - 50;
  line(g, tx - 6, 118, sx + 6, 134, OUTLINE, 3); line(g, tx - 6, 118, sx + 84, 134, OUTLINE, 3);
  box(g, sx - 10, 132, 104, 26, 4, '#b8b2a7');
  g.fillStyle = '#9c968b'; g.fillRect(sx, 140, 84, 4);
}

export const machine = makeMachine(avtokran, PART_DRAW, {
  work,
  blobs: [[100, 200, 20], [300, 150, 18], [540, 240, 20], [130, 350, 20], [480, 350, 18], [60, 290, 14]],
});
export const art = machine.art;
