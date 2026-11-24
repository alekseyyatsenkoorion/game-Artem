// Детская площадка: площадка → ямки под опоры → опоры залиты → горка → качели →
// песочница → песок → мягкое покрытие → скамейки → деревья → покраска.
import { C, G, pad, plank, nails, concrete, tree, rect, box, shape, circle, line, speckle, lumps, makeLayers, OUTLINE } from './common.js';

const HOLES = [92, 128, 262, 382];
const HW = 26, HD = 40;
const PLAIN = { metal: '#b8bec7', metalDark: '#8d939c', wood: C.wood, chute: '#c9ccd2' };
const BRIGHT = { metal: '#2f7de1', metalDark: '#1f5bb0', wood: '#ffc21a', chute: '#e8412c' };
const BRIGHT2 = { metal: '#43b649', metalDark: '#2b8a33', wood: '#ff8a1a', chute: '#ffcf3a' };

function slide(g, p) {
  // лесенка: две ноги и ступеньки
  for (const x of [HOLES[0], HOLES[1]]) line(g, x, G - 4, x, 208, OUTLINE, 14);
  for (const x of [HOLES[0], HOLES[1]]) line(g, x, G - 4, x, 208, p.metal, 8);
  for (let y = 312; y > 222; y -= 22) { line(g, HOLES[0], y, HOLES[1], y, OUTLINE, 9); line(g, HOLES[0], y, HOLES[1], y, p.metalDark, 5); }
  // площадка с крышей-домиком
  box(g, 78, 206, 66, 12, 4, p.wood, 4);
  shape(g, p.chute, (q) => { q.moveTo(72, 166); q.lineTo(110, 132); q.lineTo(150, 166); q.closePath(); }, 4);
  line(g, 84, 166, 84, 206, OUTLINE, 6); line(g, 138, 166, 138, 206, OUTLINE, 6);
  // скат
  shape(g, p.chute, (q) => { q.moveTo(140, 206); q.bezierCurveTo(176, 236, 186, 318, 236, 322); q.lineTo(236, 336); q.bezierCurveTo(176, 334, 166, 250, 132, 220); q.closePath(); }, 4);
  line(g, 216, 324, 216, G - 4, OUTLINE, 6);
}

function swing(g, p) {
  const top = 176, x0 = HOLES[2], x1 = HOLES[3];
  for (const [a, b] of [[x0 - 14, x0 + 16], [x1 + 14, x1 - 16]]) {
    line(g, a, G - 4, b, top, OUTLINE, 14); line(g, a, G - 4, b, top, p.metal, 8);
  }
  line(g, x0 - 6, top, x1 + 6, top, OUTLINE, 16); line(g, x0 - 6, top, x1 + 6, top, p.metalDark, 10);
  for (const cx of [300, 344]) {
    line(g, cx - 12, top + 4, cx - 12, 292, '#5a5f6b', 4); line(g, cx + 12, top + 4, cx + 12, 292, '#5a5f6b', 4);
    box(g, cx - 20, 290, 40, 10, 4, p.wood, 3);
  }
}

function sandboxBoards(g, fill) {
  plank(g, 468, 296, 14, 44, fill);
  plank(g, 576, 296, 14, 44, fill);
  plank(g, 458, 288, 46, 12, fill);
  plank(g, 554, 288, 44, 12, fill);
}

function bench(g, x, fill) {
  box(g, x, 296, 64, 9, 3, fill, 3);
  box(g, x + 2, 278, 60, 9, 3, fill, 3);
  line(g, x + 10, 305, x + 10, G - 2, OUTLINE, 6); line(g, x + 54, 305, x + 54, G - 2, OUTLINE, 6);
}

export const art = makeLayers('ploshchadka', {
  ploshchadka(g) { pad(g, 10, 596); },
  yamki(g) { for (const x of HOLES) box(g, x - HW / 2, G - 2, HW, HD, 5, C.dirtDark, 4); },
  opory(g) {
    for (const x of HOLES) concrete(g, x - HW / 2 - 2, G - 8, HW + 4, HD + 6);
  },
  gorka(g) { slide(g, PLAIN); },
  kacheli(g) { swing(g, PLAIN); },
  pesochnitsa(g) { sandboxBoards(g, C.wood); nails(g, [[475, 294], [583, 294]]); },
  pesok(g) {
    rect(g, 482, 310, 94, 30, C.sand, 0);
    g.save(); g.beginPath(); g.rect(482, 0, 94, 440); g.clip();
    lumps(g, 478, 580, 304, G, C.sand, C.sandDark, 51);
    g.restore();
  },
  pokrytie(g) {
    // мягкое резиновое покрытие под горкой и качелями
    box(g, 14, G - 8, 440, 16, 6, '#e05a4a', 4);
    g.fillStyle = '#43b649';
    for (let x = 30; x < 440; x += 56) g.fillRect(x, G - 4, 26, 8);
  },
  skameiki(g) { bench(g, 4, C.wood); bench(g, 392, C.wood); },
  derevya(g) { tree(g, 176, G - 6, 0.95); tree(g, 322, G - 6, 1.05); tree(g, 536, G - 6, 0.9); },
  kraska(g) {
    slide(g, BRIGHT); swing(g, BRIGHT2);
    sandboxBoards(g, '#ff6fa8');
    rect(g, 482, 294, 94, 46, C.sand, 0);
    speckle(g, 486, 300, 572, 336, C.sandDark, 52, 12);
    box(g, 520, 292, 22, 20, 4, '#2f7de1', 3);
    bench(g, 4, '#43b649'); bench(g, 392, '#b36bff');
  },
});
