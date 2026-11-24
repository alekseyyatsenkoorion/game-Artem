// Гараж: площадка → котлован → чисто → щебень кучей → ровный щебень → опалубка → пол →
// стены (3 плиты) → крыша → ворота и покраска.
import { C, G, pad, pitRough, pitClean, pitFill, plank, nails, concrete, rect, box, line, streetLamp, bush, flowers, makeLayers, OUTLINE } from './common.js';

const PIT = { x0: 150, x1: 450, d: 46, s: 10 };
const FLOOR_TOP = 324, FLOOR_BOT = 360;
const L0 = 160, L1 = 186, R0 = 414, R1 = 440, TOP = 196;

function wallsAndGate(g, wall, wallDark) {
  rect(g, L1, TOP + 18, R0 - L1, FLOOR_TOP - TOP - 18, wallDark, 4); // задняя стена
  rect(g, L0, TOP + 18, L1 - L0, FLOOR_TOP - TOP - 18, wall, 4);
  rect(g, R0, TOP + 18, R1 - R0, FLOOR_TOP - TOP - 18, wall, 4);
}

export const art = makeLayers('garazh', {
  ploshchadka(g) { pad(g, 90, 570); },
  kotlovan(g) { pitRough(g, PIT, 6); },
  'kotlovan-chisto'(g) { pitClean(g, PIT); },
  'shcheben-kucha'(g) { pitFill(g, PIT, G + 14, G + PIT.d + 4, C.gravel, C.gravelDark, true, 21); },
  shcheben(g) { pitFill(g, PIT, FLOOR_BOT - 4, G + PIT.d + 4, C.gravel, C.gravelDark, false, 22); },
  opalubka(g) {
    plank(g, PIT.x0 - 4, FLOOR_TOP - 8, 14, FLOOR_BOT - FLOOR_TOP + 6);
    plank(g, PIT.x1 - 10, FLOOR_TOP - 8, 14, FLOOR_BOT - FLOOR_TOP + 6);
    plank(g, PIT.x0 + 10, FLOOR_TOP - 2, 135, 12, C.woodLight);
    plank(g, PIT.x0 + 155, FLOOR_TOP - 2, 135, 12, C.woodLight);
    nails(g, [[PIT.x0 + 3, FLOOR_TOP + 4], [PIT.x1 - 3, FLOOR_TOP + 4]]);
  },
  pol(g) { concrete(g, PIT.x0 - 8, FLOOR_TOP - 4, PIT.x1 - PIT.x0 + 16, FLOOR_BOT - FLOOR_TOP + 6); },
  steny(g) {
    concrete(g, L1, TOP + 14, R0 - L1, FLOOR_TOP - TOP - 14, 3);
    g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(L1 + 2, TOP + 16, R0 - L1 - 4, FLOOR_TOP - TOP - 18);
    concrete(g, L0, TOP + 14, L1 - L0, FLOOR_TOP - TOP - 14);
    concrete(g, R0, TOP + 14, R1 - R0, FLOOR_TOP - TOP - 14);
  },
  krysha(g) {
    g.save(); g.translate(300, TOP + 6); g.rotate(-0.04);
    concrete(g, -162, -12, 324, 26, 2);
    g.restore();
  },
  'vorota-kraska'(g) {
    wallsAndGate(g, '#2f7de1', '#2563b8');
    // ворота-рольставни
    rect(g, L1 + 6, TOP + 40, R0 - L1 - 12, FLOOR_TOP - TOP - 44, '#c9ccd2', 4);
    g.strokeStyle = '#9aa0aa'; g.lineWidth = 4;
    for (let y = TOP + 56; y < FLOOR_TOP - 6; y += 14) { g.beginPath(); g.moveTo(L1 + 10, y); g.lineTo(R0 - 10, y); g.stroke(); }
    box(g, 280, FLOOR_TOP - 30, 40, 10, 4, '#3b4250', 3);
    box(g, L1 + 2, TOP + 22, R0 - L1 - 4, 18, 4, '#ffcf3a', 4);
    // лампа над воротами
    box(g, 292, TOP + 22, 16, 10, 3, '#3b4250', 3);
    g.fillStyle = 'rgba(255,246,168,0.6)'; g.beginPath(); g.arc(300, TOP + 36, 12, 0, Math.PI); g.fill();
    bush(g, 510, G - 2, 90, 42); flowers(g, 96, 146, G - 2, 15);
  },
});
