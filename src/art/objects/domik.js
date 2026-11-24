// Маленький домик: площадка → котлован → чистый котлован → опалубка → фундамент → кирпичи →
// стены → крыша → окна, дверь, покраска.
import { C, G, pad, pitRough, pitClean, plank, nails, concrete, bricks, gableRoof, windowBox, door, bush, flowers, box, rect, line, makeLayers, OUTLINE } from './common.js';

const PIT = { x0: 180, x1: 420, d: 52, s: 8 };
const F_TOP = 322, F_BOT = G + PIT.d - 2; // фундамент
const W0 = 196, W1 = 404, WALL_TOP = F_TOP - 3 * 40; // стены 3 ряда

function walls(g, fill) {
  rect(g, W0, WALL_TOP + 14, W1 - W0, F_TOP - WALL_TOP - 14, fill, 4);
}

export const art = makeLayers('domik', {
  ploshchadka(g) { pad(g, 110, 560); },
  kotlovan(g) { pitRough(g, PIT, 4); },
  'kotlovan-chisto'(g) { pitClean(g, PIT); },
  opalubka(g) {
    plank(g, PIT.x0 + 2, F_TOP - 6, 16, F_BOT - F_TOP + 8);
    plank(g, PIT.x1 - 18, F_TOP - 6, 16, F_BOT - F_TOP + 8);
    plank(g, PIT.x0 + 10, F_BOT - 12, PIT.x1 - PIT.x0 - 20, 12, C.woodLight);
    plank(g, PIT.x0 - 10, F_TOP - 12, PIT.x1 - PIT.x0 + 20, 10, C.woodLight);
    nails(g, [[PIT.x0 + 10, F_TOP - 7], [PIT.x1 - 10, F_TOP - 7]]);
  },
  fundament(g) { concrete(g, PIT.x0 - 6, F_TOP - 14, PIT.x1 - PIT.x0 + 12, F_BOT - F_TOP + 16); },
  kirpichi(g) {
    // поддон с кирпичами сбоку (потом за ним вырастет куст)
    box(g, 470, G - 12, 92, 12, 3, C.woodDark, 3);
    bricks(g, 476, G - 12, 80, 2, 18);
  },
  steny(g) { bricks(g, W0, F_TOP - 2, W1 - W0, 3, 40); },
  krysha(g) {
    gableRoof(g, 170, 430, WALL_TOP + 8, 76);
    box(g, 340, 96, 26, 48, 3, C.brick, 4); box(g, 334, 90, 38, 12, 3, C.brickDark, 4);
  },
  'okna-kraska'(g) {
    walls(g, '#ffe08a');
    g.strokeStyle = 'rgba(200,150,40,0.35)'; g.lineWidth = 3;
    for (let y = WALL_TOP + 34; y < F_TOP - 6; y += 22) { g.beginPath(); g.moveTo(W0 + 4, y); g.lineTo(W1 - 4, y); g.stroke(); }
    windowBox(g, 222, 224, 54, 46);
    door(g, 312, 228, 60, F_TOP - 230, '#e8412c');
    box(g, 302, F_TOP - 4, 80, 10, 3, C.concreteDark, 3);
    // куст и цветы закрывают поддон
    bush(g, 516, G - 2, 110, 56);
    flowers(g, 120, 176, G - 2, 3); flowers(g, 436, 466, G - 2, 12);
  },
});
