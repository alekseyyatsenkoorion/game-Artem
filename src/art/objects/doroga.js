// Дорога (вид сбоку, в разрезе): трава снята → ложе → чисто → песок → ровный песок → щебень →
// ровный щебень → укатанное основание → асфальт кучей → гладкий асфальт → разметка (+ знак).
import { C, G, rect, pitRough, pitClean, pitFill, lumps, speckle, box, shape, circle, line, makeLayers, OUTLINE } from './common.js';

const PIT = { x0: 14, x1: 586, d: 92, s: 16 };
const BOT = G + PIT.d + 4;
const SAND = G + 60, GRAVEL = G + 28, ASPH = G - 14;

function road(g, color, light) {
  shape(g, color, (q) => { q.moveTo(8, GRAVEL + 2); q.lineTo(8, ASPH + 6); q.quadraticCurveTo(8, ASPH, 16, ASPH); q.lineTo(584, ASPH); q.quadraticCurveTo(592, ASPH, 592, ASPH + 6); q.lineTo(592, GRAVEL + 2); q.closePath(); }, 4);
  g.fillStyle = light; g.fillRect(14, ASPH + 4, 572, 5);
}

function car(g, x, base) {
  shape(g, '#ff8a1a', (q) => { q.moveTo(x, base - 16); q.lineTo(x + 18, base - 46); q.lineTo(x + 74, base - 46); q.lineTo(x + 96, base - 24); q.lineTo(x + 116, base - 20); q.lineTo(x + 116, base - 8); q.lineTo(x, base - 8); q.closePath(); }, 4);
  for (const [a, b] of [[x + 24, x + 46], [x + 52, x + 76]]) {
    g.fillStyle = '#9fdcff'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
    g.beginPath(); g.moveTo(a, base - 26); g.lineTo(a + (a === x + 24 ? 6 : 0), base - 40); g.lineTo(b - (b === x + 76 ? 0 : 0), base - 40); g.lineTo(b + (b === x + 76 ? 12 : 0), base - 26); g.closePath(); g.fill(); g.stroke();
  }
  circle(g, x + 108, base - 16, 4, '#fff6a8', 2);
  for (const cx of [x + 26, x + 90]) { circle(g, cx, base - 8, 13, '#26262b', 3); circle(g, cx, base - 8, 5, '#c9ccd2'); }
}

export const art = makeLayers('doroga', {
  'bez-travy'(g) {
    box(g, 6, G - 6, 588, 22, 6, C.pad, 4);
    // снятый дёрн лежит валиками по краям
    for (const x of [26, 574]) { g.fillStyle = C.grass; g.strokeStyle = OUTLINE; g.lineWidth = 3; g.beginPath(); g.ellipse(x, G - 6, 18, 7, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
  },
  lozhe(g) { pitRough(g, PIT, 8); },
  'lozhe-chisto'(g) { pitClean(g, PIT); },
  'pesok-kucha'(g) { pitFill(g, PIT, SAND + 8, BOT, C.sand, C.sandDark, true, 31); },
  pesok(g) { pitFill(g, PIT, SAND, BOT, C.sand, C.sandDark, false, 32); },
  'shcheben-kucha'(g) { pitFill(g, PIT, GRAVEL + 8, SAND + 2, C.gravel, C.gravelDark, true, 33); },
  shcheben(g) { pitFill(g, PIT, GRAVEL, SAND + 2, C.gravel, C.gravelDark, false, 34); },
  osnovanie(g) {
    pitFill(g, PIT, GRAVEL, SAND + 2, '#8e949c', '#6a7079', false, 35);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
    for (let x = 40; x < 560; x += 60) { g.beginPath(); g.moveTo(x, GRAVEL + 4); g.lineTo(x + 30, GRAVEL + 4); g.stroke(); }
  },
  'asfalt-kucha'(g) {
    g.save(); g.beginPath(); g.rect(10, 0, 580, 440); g.clip();
    lumps(g, 10, 590, ASPH + 8, GRAVEL + 4, '#3a3c42', '#5d6169', 36);
    g.restore();
  },
  asfalt(g) { road(g, C.asphalt, C.asphaltLight); },
  razmetka(g) {
    g.fillStyle = '#ffffff'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
    for (let x = 26; x < 580; x += 70) { g.fillRect(x, ASPH + 12, 40, 7); g.strokeRect(x, ASPH + 12, 40, 7); }
    // бордюр и знак
    for (const x of [6, 590]) box(g, x - 6, ASPH - 6, 12, 30, 3, '#e8e8e8', 3);
    box(g, 556, 150, 8, ASPH - 150, 3, '#9aa0aa', 3);
    circle(g, 560, 138, 30, '#2f7de1', 4);
    line(g, 544, 138, 574, 138, '#ffffff', 7);
    shape(g, '#ffffff', (q) => { q.moveTo(580, 138); q.lineTo(566, 126); q.lineTo(566, 150); q.closePath(); }, 2);
    // по новой дороге уже едет машинка
    car(g, 150, ASPH + 2);
  },
});
