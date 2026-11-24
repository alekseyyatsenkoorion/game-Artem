// Башенный кран: жёлтая решётчатая башня, длинная стрела вправо, противовес слева, крюк.
import kran from '../../data/machines/bashennyi-kran.js';
import { OUTLINE, STEEL, box, shape, circle, line, lattice, rectWindow, hazard, makeMachine } from '../parts-common.js';

const Y = '#ffc21a', Y_DARK = '#d99a00', CONCRETE = '#b8b2a7';

function hookBlock(g, cx, top, ropeTop) {
  line(g, cx - 4, ropeTop, cx - 4, top, OUTLINE, 3); line(g, cx + 4, ropeTop, cx + 4, top, OUTLINE, 3);
  box(g, cx - 18, top, 36, 30, 6, Y);
  hazard(g, cx - 13, top + 7, 26, 16, Y, OUTLINE);
  g.strokeStyle = OUTLINE; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, top + 30); g.lineTo(cx, top + 42); g.arc(cx - 10, top + 48, 10, 0, Math.PI * 0.95); g.stroke();
  g.strokeStyle = '#c9ccd2'; g.lineWidth = 5; g.stroke();
}

function trolley(g, cx) {
  box(g, cx - 22, 0, 44, 14, 4, STEEL, 3);
  circle(g, cx - 12, 4, 5, '#c9ccd2'); circle(g, cx + 12, 4, 5, '#c9ccd2');
}

function kryuk(g, w, h) {
  trolley(g, w / 2);
  hookBlock(g, w / 2, 96, 14);
}

const PART_DRAW = {
  osnova: (g, w, h) => {
    box(g, 4, 14, w - 8, h - 16, 6, CONCRETE);
    g.strokeStyle = '#8f8a80'; g.lineWidth = 4;
    for (const x of [48, 90, 132]) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x, h - 4); g.stroke(); }
    box(g, w / 2 - 40, 0, 80, 18, 4, Y_DARK, 4);
  },
  bashnya: (g, w, h) => lattice(g, 6, 2, w - 12, h - 4, Y, true),
  'sekciya-bashni': (g, w, h) => lattice(g, 6, 2, w - 12, h - 4, Y, true),
  verhushka: (g, w, h) => {
    // пик
    g.strokeStyle = OUTLINE; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(10, 52); g.lineTo(30, 6); g.lineTo(50, 52); g.moveTo(18, 34); g.lineTo(42, 34); g.stroke();
    g.strokeStyle = Y; g.lineWidth = 4; g.stroke();
    circle(g, 30, 8, 6, '#e8412c', 3);
    // голова башни, к ней крепятся стрелы
    box(g, 2, 50, w - 4, 40, 6, Y_DARK);
    lattice(g, 8, 56, w - 16, 28, Y, false);
    box(g, 4, 92, w - 8, 14, 4, STEEL, 4);
    lattice(g, 6, 106, w - 12, 12, Y, true);
  },
  kabina: (g, w, h) => { box(g, 4, 4, w - 8, h - 8, 10, Y); rectWindow(g, 14, 14, w - 28, 30); },
  strela: (g, w, h) => lattice(g, 0, 6, w, h - 12, Y, false),
  'sekciya-strely': (g, w, h) => { lattice(g, 0, 6, w - 10, h - 12, Y, false); box(g, w - 14, 4, 12, h - 8, 4, Y_DARK, 3); },
  kontrstrela: (g, w, h) => { lattice(g, 4, 6, w - 4, h - 12, Y, false); box(g, 0, h - 12, w, 10, 3, Y_DARK, 3); },
  protivoves: (g, w, h) => {
    line(g, 16, 0, 16, 10, OUTLINE, 6); line(g, w - 16, 0, w - 16, 10, OUTLINE, 6);
    for (let i = 0; i < 3; i++) box(g, 4, 8 + i * 27, w - 8, 26, 4, CONCRETE, 4);
  },
  kryuk,
};

function work(g, W, H, drawWhole) {
  drawWhole(g, { skip: ['kryuk'] });
  // крюк опущен, на нём красный контейнер
  const p = kran.parts.find((q) => q.id === 'kryuk');
  const cx = p.x + p.w / 2 + 20;
  g.save(); g.translate(cx - 40, p.y); trolley(g, 40); g.restore();
  hookBlock(g, cx, 250, p.y + 14);
  line(g, cx - 6, 304, cx - 46, 322, OUTLINE, 3); line(g, cx - 6, 304, cx + 40, 322, OUTLINE, 3);
  box(g, cx - 56, 320, 112, 62, 6, '#e8412c');
  g.strokeStyle = '#b52b1b'; g.lineWidth = 5;
  for (let x = cx - 40; x < cx + 50; x += 18) { g.beginPath(); g.moveTo(x, 328); g.lineTo(x, 374); g.stroke(); }
}

export const machine = makeMachine(kran, PART_DRAW, {
  work,
  blobs: [[180, 300, 16], [180, 180, 14], [60, 140, 16], [320, 70, 12], [520, 70, 12], [180, 370, 14]],
});
export const art = machine.art;
