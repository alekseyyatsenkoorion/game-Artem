// Высокий (многоквартирный) дом: площадка → котлован → чисто → башенный кран → песок и щебень →
// укатали → опалубка → арматура → фундамент → 1-й этаж → перекрытие → 2-й, 3-й, 4-й этажи →
// крыша → окна и балконы → дорога во дворе → деревья и фонари.
import { C, G, pad, pitRough, pitClean, pitFill, plank, nails, concrete, rebarGrid, rect, box, shape, circle, line, tree, streetLamp, bush, flowers, makeLayers, OUTLINE } from './common.js';
import { lattice, hazard, drawWindow } from '../parts-common.js';

const PIT = { x0: 44, x1: 416, d: 72, s: 10 };
const F_TOP = 322, F_BOT = G + 52;
const B0 = 60, B1 = 400; // стены дома
const FH = 52, SH = 8; // высота этажа и плиты
// низ каждого этажа: этаж n (1..4) от floorBot(n) вверх на FH, сверху плита SH
const floorBot = (n) => F_TOP - (n - 1) * (FH + SH);
const ROOF_BOT = floorBot(5);
const PANEL = ['#f3e3c6', '#efd9b3'];
const MAST = 476, MW = 30, SEC = 92, JIB_Y = G - 14 - 3 * SEC - 14; // 36

function floor(g, n, withSlab) {
  const bot = floorBot(n), top = bot - FH;
  for (let i = 0; i < 4; i++) {
    const w = (B1 - B0) / 4;
    rect(g, B0 + i * w, top, w, FH, PANEL[(i + n) % 2], 4);
  }
  if (withSlab) concrete(g, B0 - 6, top - SH, B1 - B0 + 12, SH);
}

function floorWindows(g, n) {
  const bot = floorBot(n), top = bot - FH;
  const w = (B1 - B0) / 4;
  for (let i = 0; i < 4; i++) {
    const cx = B0 + i * w + w / 2;
    if (n === 1 && i === 1) {
      // подъезд: дверь и козырёк
      box(g, cx - 22, top + 6, 44, FH - 6, 4, '#8a4b2a', 4);
      drawWindow(g, [[cx - 14, top + 12], [cx + 14, top + 12], [cx + 14, top + 28], [cx - 14, top + 28]]);
      box(g, cx - 34, top - 2, 68, 8, 3, '#2f7de1', 3);
      continue;
    }
    rect(g, cx - 22, top + 7, 44, 28, '#ffffff', 3);
    drawWindow(g, [[cx - 18, top + 11], [cx + 18, top + 11], [cx + 18, top + 31], [cx - 18, top + 31]]);
    line(g, cx, top + 11, cx, top + 31, '#ffffff', 3);
    if (n > 1 && (i + n) % 2 === 0) {
      // балкон
      rect(g, cx - 30, top + 34, 60, 14, ['#e8412c', '#43b649', '#2f7de1', '#ffc21a'][(i + n) % 4], 3);
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      for (let x = cx - 22; x < cx + 26; x += 10) { g.beginPath(); g.moveTo(x, top + 36); g.lineTo(x, top + 46); g.stroke(); }
    }
  }
}

function crane(g) {
  // фундамент крана, башня из трёх секций, кабина, стрела, противовес, трос с крюком
  box(g, MAST - 30, G - 14, MW + 60, 14, 3, C.concreteDark, 4);
  for (let i = 0; i < 3; i++) {
    const bot = G - 14 - i * SEC, top = bot - SEC;
    lattice(g, MAST, top, MW, SEC, '#ffc21a', true);
  }
  const top = G - 14 - 3 * SEC; // 50
  box(g, MAST - 6, top - 6, MW + 12, 12, 3, '#ffc21a', 3);
  box(g, MAST + MW - 2, top - 2, 34, 26, 5, '#ffc21a', 4);
  drawWindow(g, [[MAST + MW + 4, top + 3], [MAST + MW + 26, top + 3], [MAST + MW + 26, top + 15], [MAST + MW + 4, top + 15]]);
  lattice(g, 150, JIB_Y, MAST - 150, 14, '#ffc21a', false);
  lattice(g, MAST + MW, JIB_Y, 590 - MAST - MW, 14, '#ffc21a', false);
  box(g, 552, JIB_Y + 12, 34, 26, 3, '#5a5f6b', 4);
  hazard(g, 553, JIB_Y + 13, 32, 8);
  // тросы-растяжки до верхушки
  line(g, MAST + MW / 2, JIB_Y - 22, 170, JIB_Y, OUTLINE, 3);
  line(g, MAST + MW / 2, JIB_Y - 22, 580, JIB_Y, OUTLINE, 3);
  shape(g, '#ffc21a', (q) => { q.moveTo(MAST + 2, JIB_Y); q.lineTo(MAST + MW / 2, JIB_Y - 24); q.lineTo(MAST + MW - 2, JIB_Y); q.closePath(); }, 3);
  // каретка и крюк
  box(g, 236, JIB_Y + 12, 24, 8, 2, '#5a5f6b', 3);
  const hy = JIB_Y + 40;
  line(g, 248, JIB_Y + 20, 248, hy, OUTLINE, 3);
  shape(g, '#e8412c', (q) => { q.moveTo(240, hy); q.lineTo(256, hy); q.lineTo(252, hy + 12); q.lineTo(244, hy + 12); q.closePath(); }, 3);
  g.strokeStyle = OUTLINE; g.lineWidth = 4; g.beginPath(); g.arc(248, hy + 18, 6, -0.3, Math.PI); g.stroke();
}

export const art = makeLayers('dom-mnogo', {
  ploshchadka(g) { pad(g, 20, 596); },
  kotlovan(g) { pitRough(g, PIT, 16); },
  'kotlovan-chisto'(g) { pitClean(g, PIT); },
  'bashennyi-kran'(g) { crane(g); },
  'pesok-shcheben'(g) {
    pitFill(g, PIT, G + PIT.d - 18, G + PIT.d + 4, C.sand, C.sandDark, false, 91);
    pitFill(g, PIT, F_BOT + 8, G + PIT.d - 16, C.gravel, C.gravelDark, true, 92);
  },
  osnovanie(g) { pitFill(g, PIT, F_BOT - 2, G + PIT.d - 16, '#8e949c', '#6a7079', false, 93); },
  opalubka(g) {
    plank(g, PIT.x0 - 4, F_TOP - 10, 14, F_BOT - F_TOP + 10);
    plank(g, PIT.x1 - 10, F_TOP - 10, 14, F_BOT - F_TOP + 10);
    plank(g, PIT.x0 - 10, F_TOP - 16, 190, 10, C.woodLight);
    plank(g, PIT.x0 + 190, F_TOP - 16, PIT.x1 - PIT.x0 - 180, 10, C.woodLight);
    nails(g, [[PIT.x0 + 3, F_TOP - 11], [PIT.x1 - 3, F_TOP - 11]]);
  },
  armatura(g) { rebarGrid(g, PIT.x0 + 18, F_TOP - 2, PIT.x1 - PIT.x0 - 36, F_BOT - F_TOP - 6, 20); },
  fundament(g) { concrete(g, PIT.x0 - 6, F_TOP - 18, PIT.x1 - PIT.x0 + 12, F_BOT - F_TOP + 20); },
  'etazh-1'(g) { floor(g, 1, false); },
  perekrytie(g) { concrete(g, B0 - 6, floorBot(2), B1 - B0 + 12, SH, 2); },
  'etazh-2'(g) { floor(g, 2, true); },
  'etazh-3'(g) { floor(g, 3, true); },
  'etazh-4'(g) { floor(g, 4, true); },
  krysha(g) {
    rect(g, B0 - 10, ROOF_BOT - 14, B1 - B0 + 20, 14, '#e8412c', 4);
    box(g, 300, ROOF_BOT - 26, 56, 14, 3, '#c9ccd2', 4);
    box(g, 110, ROOF_BOT - 24, 24, 12, 3, '#c9ccd2', 4);
  },
  'okna-balkony'(g) { for (let n = 1; n <= 4; n++) floorWindows(g, n); },
  'doroga-dvor'(g) {
    rect(g, 0, G - 6, 600, 18, C.asphalt, 4);
    g.fillStyle = '#ffffff';
    for (let x = 14; x < 600; x += 60) g.fillRect(x, G + 1, 30, 4);
    rect(g, 0, G - 10, 600, 5, '#e8e8e8', 2);
  },
  'derevya-fonari'(g) {
    tree(g, 436, G - 10, 0.8); tree(g, 540, G - 10, 0.8);
    streetLamp(g, 24, G - 10, 130, 1);
    streetLamp(g, 588, G - 10, 130, -1);
    bush(g, 106, G - 10, 64, 30); bush(g, 350, G - 10, 64, 30);
    flowers(g, 232, 300, G - 10, 94);
  },
});
