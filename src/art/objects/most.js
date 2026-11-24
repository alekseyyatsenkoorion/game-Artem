// Мост через речку (речка — в первом слое): берега и подъезды → ямы под опоры → чисто →
// опалубка → опоры → балки → плиты → полотно → асфальт кучей → гладкий асфальт → перила →
// разметка и фонари.
import { C, G, rect, plank, concrete, lumps, speckle, rebarGrid, streetLamp, flowers, box, shape, circle, line, seeded, makeLayers, OUTLINE } from './common.js';

const LB = 150, RB = 450; // кромки берегов
const WATER = 394;
const PIERS = [196, 404], PW = 34, PIER_BOT = 432;
const BEAM_TOP = 300, BEAM_BOT = 322, PLATE_TOP = 288, DECK_TOP = 278, ASPH_TOP = 266;
const SPAN0 = 128, SPAN1 = 472;

function slopeY(x) { // глубина склона долины
  if (x <= LB || x >= RB) return G;
  if (x < 230) return G + (x - LB) / (230 - LB) * (WATER - G);
  if (x > 370) return G + (RB - x) / (RB - 370) * (WATER - G);
  return WATER;
}

function valleyPath(q) {
  q.moveTo(LB, G - 1); q.lineTo(230, WATER); q.lineTo(370, WATER); q.lineTo(RB, G - 1);
}

function ramp(g, side) {
  // насыпь подъезда: от земли поднимается к уровню моста, кончается у края берега
  shape(g, C.pad, (q) => {
    if (side < 0) { q.moveTo(0, G + 4); q.lineTo(0, G - 4); q.lineTo(SPAN0 + 6, ASPH_TOP + 10); q.lineTo(SPAN0 + 6, G + 4); }
    else { q.moveTo(600, G + 4); q.lineTo(600, G - 4); q.lineTo(SPAN1 - 6, ASPH_TOP + 10); q.lineTo(SPAN1 - 6, G + 4); }
    q.closePath();
  }, 4);
  speckle(g, side < 0 ? 40 : SPAN1 + 10, G - 16, side < 0 ? SPAN0 - 10 : 560, G - 2, C.padDark, side < 0 ? 66 : 67, 6);
}

export const art = makeLayers('most', {
  berega(g) {
    // долина с речкой: дальний берег, вода
    shape(g, '#93cf6b', (q) => { valleyPath(q); q.closePath(); }, 4);
    g.save(); g.beginPath(); valleyPath(g); g.lineTo(RB, 440); g.lineTo(LB, 440); g.closePath(); g.clip();
    g.fillStyle = '#7fbf5a';
    for (let x = 160; x < 450; x += 34) { g.beginPath(); g.ellipse(x, 372 + (x % 3) * 4, 14, 6, 0, 0, Math.PI * 2); g.fill(); }
    rect(g, 140, WATER, 320, 50, C.water, 0);
    g.fillStyle = C.dirt;
    g.beginPath(); g.moveTo(LB, G); g.lineTo(230, WATER); g.lineTo(230, 440); g.lineTo(LB - 10, 440); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(RB, G); g.lineTo(370, WATER); g.lineTo(370, 440); g.lineTo(RB + 10, 440); g.closePath(); g.fill();
    g.restore();
    rect(g, 228, WATER, 144, 46, C.water, 0);
    g.fillStyle = C.waterDark; g.fillRect(228, WATER + 24, 144, 22);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.lineCap = 'round';
    for (const [x, y] of [[250, 404], [300, 416], [340, 404], [270, 428], [330, 430]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y); g.stroke(); }
    g.strokeStyle = OUTLINE; g.lineWidth = 4; g.beginPath(); g.moveTo(LB, G); g.lineTo(230, WATER); g.moveTo(370, WATER); g.lineTo(RB, G); g.stroke();
    // камыши
    for (const x of [236, 244, 360]) { line(g, x, WATER + 2, x + 2, WATER - 26, C.grassDark, 4); box(g, x - 2, WATER - 34, 7, 14, 3, '#8a5a2b', 2); }
    // подъезды-насыпи на двух берегах
    ramp(g, -1); ramp(g, 1);
  },
  yamy(g) {
    for (const x of PIERS) {
      const top = slopeY(x) - 2;
      shape(g, C.dirtDark, (q) => { q.moveTo(x - PW / 2 - 6, top - 4); q.lineTo(x + PW / 2 + 6, top + 4 * (x < 300 ? 1 : -1)); q.lineTo(x + PW / 2, PIER_BOT); q.lineTo(x - PW / 2, PIER_BOT); q.closePath(); }, 4);
      g.fillStyle = C.dirt; const r = seeded(x);
      for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x - 12 + r() * 24, PIER_BOT - 6 - r() * 20, 5 + r() * 4, 0, Math.PI * 2); g.fill(); }
    }
  },
  'yamy-chisto'(g) {
    for (const x of PIERS) { box(g, x - PW / 2 - 2, slopeY(x) - 6, PW + 4, PIER_BOT - slopeY(x) + 8, 4, C.dirt, 4); g.fillStyle = C.dirtDark; g.fillRect(x - PW / 2 + 1, PIER_BOT - 8, PW - 2, 8); }
  },
  opalubka(g) {
    for (const x of PIERS) {
      plank(g, x - PW / 2 - 6, BEAM_BOT, 10, PIER_BOT - BEAM_BOT + 2);
      plank(g, x + PW / 2 - 4, BEAM_BOT, 10, PIER_BOT - BEAM_BOT + 2);
      rebarGrid(g, x - PW / 2 + 6, BEAM_BOT + 6, PW - 12, PIER_BOT - BEAM_BOT - 14, 11);
      for (let y = BEAM_BOT + 20; y < PIER_BOT; y += 40) plank(g, x - PW / 2 - 10, y, PW + 20, 8, C.woodLight);
    }
  },
  opory(g) {
    for (const x of PIERS) {
      concrete(g, x - PW / 2 - 6, BEAM_BOT - 2, PW + 12, PIER_BOT - BEAM_BOT + 6);
      box(g, x - PW / 2 - 14, BEAM_BOT - 8, PW + 28, 12, 3, C.concreteDark, 4);
    }
  },
  balki(g) {
    for (const [a, b] of [[SPAN0, PIERS[0]], [PIERS[0], PIERS[1]], [PIERS[1], SPAN1]]) {
      rect(g, a + 2, BEAM_TOP, b - a - 4, BEAM_BOT - BEAM_TOP, '#2f7de1', 4);
      g.fillStyle = '#1f5bb0'; g.fillRect(a + 4, BEAM_TOP + 7, b - a - 8, 8);
      for (let x = a + 14; x < b - 8; x += 26) circle(g, x, BEAM_TOP + 4, 2.4, '#ffffff');
    }
  },
  plity(g) { concrete(g, SPAN0 - 4, PLATE_TOP, SPAN1 - SPAN0 + 8, BEAM_TOP - PLATE_TOP + 1, 4); },
  polotno(g) { concrete(g, SPAN0 - 8, DECK_TOP, SPAN1 - SPAN0 + 16, PLATE_TOP - DECK_TOP + 4); },
  'asfalt-kucha'(g) {
    lumps(g, SPAN0 - 4, SPAN1 + 4, ASPH_TOP + 6, DECK_TOP + 2, '#3a3c42', '#5d6169', 61);
  },
  asfalt(g) {
    shape(g, C.asphalt, (q) => {
      q.moveTo(0, G - 6); q.lineTo(SPAN0 - 4, ASPH_TOP); q.lineTo(SPAN1 + 4, ASPH_TOP); q.lineTo(600, G - 6);
      q.lineTo(600, G + 2); q.lineTo(SPAN1 + 4, DECK_TOP + 2); q.lineTo(SPAN0 - 4, DECK_TOP + 2); q.lineTo(0, G + 2); q.closePath();
    }, 4);
    g.fillStyle = C.asphaltLight; g.fillRect(SPAN0, ASPH_TOP + 3, SPAN1 - SPAN0, 3);
  },
  perila(g) {
    const top = ASPH_TOP - 40;
    for (let i = 0; i < 4; i++) {
      const a = SPAN0 + i * (SPAN1 - SPAN0) / 4, b = a + (SPAN1 - SPAN0) / 4;
      line(g, a + 4, top, b - 4, top, OUTLINE, 10); line(g, a + 4, top, b - 4, top, '#ffcf3a', 5);
      line(g, a + 4, top + 18, b - 4, top + 18, OUTLINE, 8); line(g, a + 4, top + 18, b - 4, top + 18, '#ffcf3a', 4);
      for (let x = a + 6; x <= b - 4; x += (b - a - 10) / 4) { line(g, x, top - 2, x, ASPH_TOP, OUTLINE, 8); line(g, x, top - 2, x, ASPH_TOP, '#e8412c', 4); }
    }
  },
  'razmetka-fonari'(g) {
    g.fillStyle = '#ffffff'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
    for (let x = SPAN0; x < SPAN1 - 10; x += 56) { g.fillRect(x, ASPH_TOP + 5, 30, 5); g.strokeRect(x, ASPH_TOP + 5, 30, 5); }
    streetLamp(g, SPAN0 + 26, ASPH_TOP, 120, 1);
    streetLamp(g, 300, ASPH_TOP, 120, 1);
    streetLamp(g, SPAN1 - 26, ASPH_TOP, 120, -1);
    flowers(g, 8, 50, G - 4, 63); flowers(g, 556, 596, G - 4, 64);
  },
});
