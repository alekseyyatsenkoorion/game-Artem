// Каток: зелёный, жёлтая кабина, большой валец спереди.
import katok from '../../data/machines/katok.js';
import { OUTLINE, box, shape, circle, drawWheel, drawCab, drawPipe, drawBeacon, hazard, makeMachine } from '../parts-common.js';

const GREEN = '#3cb44b', GREEN_DARK = '#2a8a37', YELLOW = '#ffc21a', YELLOW_DARK = '#d99a00';

function valec(g, w, h, phase = 0) {
  // вилка, держащая валец
  shape(g, GREEN, (q) => { q.moveTo(0, 2); q.lineTo(96, 2); q.lineTo(118, 96); q.lineTo(82, 104); q.lineTo(66, 46); q.lineTo(0, 46); q.closePath(); });
  // сам валец
  circle(g, 100, 100, 88, '#8d929c', 5);
  circle(g, 100, 100, 74, '#b4b9c2');
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 8; g.lineCap = 'round';
  g.beginPath(); g.arc(100, 100, 62, Math.PI * 1.1 + phase, Math.PI * 1.45 + phase); g.stroke();
  circle(g, 100, 100, 30, GREEN, 4);
  circle(g, 100, 100, 10, OUTLINE);
  g.fillStyle = YELLOW;
  for (let i = 0; i < 6; i++) { const a = phase + (i / 6) * Math.PI * 2; circle(g, 100 + Math.cos(a) * 20, 100 + Math.sin(a) * 20, 4, YELLOW); }
}

const PART_DRAW = {
  'koleso-zadnee': (g, w, h) => drawWheel(g, w / 2, h / 2, w / 2 - 2, YELLOW),
  rama: (g, w, h) => { box(g, 3, 4, w - 6, h - 8, 10, GREEN); hazard(g, 14, h - 24, w - 28, 12); },
  kabina: (g, w, h) => { drawCab(g, 0, 24, w, h - 24, YELLOW, YELLOW_DARK); drawBeacon(g, w / 2, 28, 18); },
  motor: (g, w, h) => {
    shape(g, GREEN, (q) => { q.moveTo(2, h - 4); q.lineTo(2, 10); q.lineTo(w - 30, 10); q.quadraticCurveTo(w - 2, 12, w - 2, 40); q.lineTo(w - 2, h - 4); q.closePath(); });
    g.strokeStyle = GREEN_DARK; g.lineWidth = 6; g.lineCap = 'round';
    for (let x = 22; x < w - 30; x += 22) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x, 70); g.stroke(); }
  },
  truba: (g, w, h) => drawPipe(g, 0, 0, w, h),
  valec: (g, w, h) => valec(g, w, h, 0),
};

function work(g, W, H, drawWhole) {
  // гладкий асфальт позади, неровный впереди
  g.fillStyle = '#4a4d55'; g.fillRect(0, H - 14, 470, 14);
  g.strokeStyle = '#8d929c'; g.lineWidth = 5; g.lineCap = 'round';
  for (const [x, y] of [[8, 230], [0, 260], [14, 290]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26, y); g.stroke(); }
  drawWhole(g, {
    special(g2, p) {
      if (p.id !== 'valec') return false;
      g2.save(); g2.translate(p.x, p.y); valec(g2, p.w, p.h, 0.6); g2.restore();
      return true;
    },
  });
  // пар от горячего асфальта
  g.strokeStyle = 'rgba(140,150,165,0.9)'; g.lineWidth = 6; g.lineCap = 'round';
  for (const x of [210, 260, 310]) { g.beginPath(); g.moveTo(x, 322); g.quadraticCurveTo(x - 12, 310, x, 298); g.quadraticCurveTo(x + 12, 286, x, 274); g.stroke(); }
}

export const machine = makeMachine(katok, PART_DRAW, {
  work,
  blobs: [[110, 160, 22], [100, 270, 20], [320, 150, 20], [480, 220, 26], [540, 300, 18], [200, 100, 16]],
});
export const art = machine.art;
