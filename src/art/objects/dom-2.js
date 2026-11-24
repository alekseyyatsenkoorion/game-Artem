// Двухэтажный дом: площадка → котлован → чисто → щебень → опалубка → арматура → фундамент →
// 1-й этаж → перекрытие → 2-й этаж → крыша → окна и двери → покраска и крыльцо.
import { C, G, pad, pitRough, pitClean, pitFill, plank, nails, concrete, rebarGrid, bricks, gableRoof, windowBox, door, bush, flowers, rect, box, line, makeLayers, OUTLINE } from './common.js';

const PIT = { x0: 140, x1: 460, d: 62, s: 10 };
const F_TOP = 322, F_BOT = G + 44;
const W0 = 156, W1 = 444;
const FL1 = F_TOP, SLAB_B = FL1 - 90, SLAB_T = SLAB_B - 12, FL2_TOP = SLAB_T - 90;

const WIN1 = [[182, 254], [362, 254]], WIN2 = [[182, 160], [272, 160], [362, 160]];

function openings(g) {
  for (const [x, y] of WIN1) windowBox(g, x, y, 56, 44);
  for (const [x, y] of WIN2) windowBox(g, x, y, 56, 44);
  door(g, 274, 248, 52, FL1 - 248, '#8a4b2a');
}

export const art = makeLayers('dom-2', {
  ploshchadka(g) { pad(g, 70, 580); },
  kotlovan(g) { pitRough(g, PIT, 12); },
  'kotlovan-chisto'(g) { pitClean(g, PIT); },
  shcheben(g) { pitFill(g, PIT, F_BOT, G + PIT.d + 4, C.gravel, C.gravelDark, false, 71); },
  opalubka(g) {
    plank(g, PIT.x0 - 2, F_TOP - 8, 14, F_BOT - F_TOP + 10);
    plank(g, PIT.x1 - 12, F_TOP - 8, 14, F_BOT - F_TOP + 10);
    plank(g, PIT.x0 - 10, F_TOP - 14, PIT.x1 - PIT.x0 + 20, 10, C.woodLight);
    nails(g, [[PIT.x0 + 5, F_TOP - 9], [PIT.x1 - 5, F_TOP - 9]]);
  },
  armatura(g) { rebarGrid(g, PIT.x0 + 20, F_TOP, PIT.x1 - PIT.x0 - 40, F_BOT - F_TOP - 6, 20); },
  fundament(g) { concrete(g, PIT.x0 - 6, F_TOP - 16, PIT.x1 - PIT.x0 + 12, F_BOT - F_TOP + 20); },
  'etazh-1'(g) { bricks(g, W0, FL1 - 2, W1 - W0, 3, 30); },
  perekrytie(g) { concrete(g, W0 - 8, SLAB_T, W1 - W0 + 16, SLAB_B - SLAB_T, 2); },
  'etazh-2'(g) { bricks(g, W0, SLAB_T, W1 - W0, 3, 30); },
  krysha(g) {
    gableRoof(g, W0 - 22, W1 + 22, FL2_TOP + 6, 48, '#2f7de1', '#1f5bb0');
    box(g, 380, 70, 28, 48, 3, C.brick, 4); box(g, 374, 64, 40, 12, 3, C.brickDark, 4);
  },
  'okna-dveri'(g) { openings(g); },
  'kraska-kryltso'(g) {
    rect(g, W0, FL2_TOP + 16, W1 - W0, SLAB_T - FL2_TOP - 16, '#ffd36b', 4);
    rect(g, W0, SLAB_B, W1 - W0, FL1 - SLAB_B - 2, '#ff9f6b', 4);
    concrete(g, W0 - 8, SLAB_T, W1 - W0 + 16, SLAB_B - SLAB_T);
    openings(g);
    // крыльцо: ступеньки и козырёк
    box(g, 256, FL1 - 4, 88, 10, 3, C.concreteDark, 3);
    box(g, 266, FL1 + 4, 68, 10, 3, C.concrete, 3);
    box(g, 260, 236, 80, 10, 3, '#2f7de1', 4);
    line(g, 266, 246, 266, 300, OUTLINE, 5); line(g, 334, 246, 334, 300, OUTLINE, 5);
    bush(g, 108, G - 2, 70, 40); bush(g, 500, G - 2, 90, 46);
    flowers(g, 160, 250, G - 2, 72); flowers(g, 350, 440, G - 2, 73);
  },
});
