// Двухуровневый паркинг: площадка → котлован → чисто → щебень → укатали → опалубка с арматурой →
// плита → колонны → плиты 2-го этажа → пандус → плиты крыши → асфальт на въезде → разметка →
// шлагбаум и фонари (+ машинки).
import { C, G, pad, pitRough, pitClean, pitFill, plank, concrete, rebarGrid, rect, box, shape, circle, line, streetLamp, flowers, makeLayers, OUTLINE } from './common.js';

const PIT = { x0: 30, x1: 440, d: 52, s: 10 };
const SLAB_T = 324, SLAB_B = G + 24;
const COLS = [50, 170, 290, 410], CW = 26;
const L2_T = 220, L2_B = 242, ROOF_T = 112, ROOF_B = 132;
const X0 = 30, X1 = 440;

function rampPath(q) {
  q.moveTo(X1 - 4, L2_T); q.lineTo(X1 + 30, L2_T); q.lineTo(572, G - 4); q.lineTo(572, G + 4); q.lineTo(X1 - 4, G + 4); q.closePath();
}

function car(g, x0, base0, color, k = 1.45) {
  g.save(); g.translate(x0, base0); g.scale(k, k);
  const x = 0, base = 0;
  shape(g, color, (q) => { q.moveTo(x, base - 12); q.lineTo(x + 10, base - 30); q.lineTo(x + 46, base - 30); q.lineTo(x + 60, base - 16); q.lineTo(x + 72, base - 14); q.lineTo(x + 72, base - 6); q.lineTo(x, base - 6); q.closePath(); }, 3);
  rect(g, x + 16, base - 26, 24, 10, '#9fdcff', 2);
  for (const cx of [x + 16, x + 56]) { circle(g, cx, base - 6, 8, '#26262b', 2); circle(g, cx, base - 6, 3, '#c9ccd2'); }
  g.restore();
}

export const art = makeLayers('parking', {
  ploshchadka(g) { pad(g, 14, 596); },
  kotlovan(g) { pitRough(g, PIT, 14); },
  'kotlovan-chisto'(g) { pitClean(g, PIT); },
  shcheben(g) { pitFill(g, PIT, SLAB_B + 2, G + PIT.d + 4, C.gravel, C.gravelDark, true, 81); },
  osnovanie(g) { pitFill(g, PIT, SLAB_B - 4, G + PIT.d + 4, '#8e949c', '#6a7079', false, 82); },
  'opalubka-armatura'(g) {
    plank(g, X0 - 6, SLAB_T - 4, 12, SLAB_B - SLAB_T + 2);
    plank(g, X1 - 6, SLAB_T - 4, 12, SLAB_B - SLAB_T + 2);
    rebarGrid(g, X0 + 12, SLAB_T + 4, X1 - X0 - 24, SLAB_B - SLAB_T - 10, 16);
  },
  plita(g) { concrete(g, X0 - 8, SLAB_T - 4, X1 - X0 + 16, SLAB_B - SLAB_T + 6); },
  kolonny(g) { for (const x of COLS) concrete(g, x - CW / 2, ROOF_B - 2, CW, SLAB_T - ROOF_B - 2); },
  'plity-2'(g) { concrete(g, X0 - 8, L2_T, X1 - X0 + 16, L2_B - L2_T, 3); },
  pandus(g) {
    shape(g, C.concrete, rampPath, 4);
    line(g, X1 + 30, L2_T + 6, 566, G - 8, C.concreteLight, 4);
    // бок пандуса: полосы опалубки
    g.strokeStyle = C.concreteDark; g.lineWidth = 3;
    for (let x = X1 + 24; x < 560; x += 26) { const y = L2_T + (x - X1 - 30) / (572 - X1 - 30) * (G - 4 - L2_T); g.beginPath(); g.moveTo(x, Math.max(L2_T + 8, y + 8)); g.lineTo(x, G); g.stroke(); }
  },
  krysha(g) { concrete(g, X0 - 8, ROOF_T, X1 - X0 + 16, ROOF_B - ROOF_T, 3); },
  'asfalt-vezd'(g) {
    g.save(); g.lineJoin = 'round';
    g.strokeStyle = OUTLINE; g.lineWidth = 12; g.beginPath(); g.moveTo(X1 + 30, L2_T - 1); g.lineTo(574, G - 5); g.stroke();
    g.strokeStyle = C.asphalt; g.lineWidth = 7; g.stroke();
    g.restore();
    rect(g, X0 - 8, SLAB_T - 10, X1 - X0 + 16, 8, C.asphalt, 3);
    rect(g, X0 - 8, L2_T - 8, X1 - X0 + 16, 8, C.asphalt, 3);
  },
  razmetka(g) {
    g.fillStyle = '#ffffff'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
    for (const y of [SLAB_T - 9, L2_T - 7]) for (let x = X0 + 10; x < X1 - 10; x += 100) { g.fillRect(x, y, 8, 6); g.strokeRect(x, y, 8, 6); g.fillRect(x + 18, y + 1, 60, 4); }
    for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; g.fillRect(X1 + 30 + t * (574 - X1 - 30) - 6, L2_T - 1 + t * (G - 5 - L2_T) - 2, 12, 3); }
  },
  'shlagbaum-fonari'(g) {
    // машинки на этажах
    car(g, 66, SLAB_T - 13, '#e8412c'); car(g, 304, SLAB_T - 13, '#ffc21a');
    car(g, 186, L2_T - 11, '#43b649'); car(g, 66, L2_T - 11, '#b36bff');
    // шлагбаум у въезда на пандус (поднят)
    box(g, 578, 292, 16, G - 292 - 4, 4, '#3b4250', 3);
    for (let i = 0; i < 5; i++) rect(g, 581, 200 + i * 18, 10, 18, i % 2 ? '#ffffff' : '#e8412c', 0);
    g.strokeStyle = OUTLINE; g.lineWidth = 3; g.strokeRect(581, 200, 10, 90);
    circle(g, 586, 298, 8, '#ffcf3a', 3);
    streetLamp(g, 60, ROOF_T, 64, 1);
    streetLamp(g, 410, ROOF_T, 64, -1);
    flowers(g, 452, 520, G - 4, 83);
  },
});
