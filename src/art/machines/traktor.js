// Трактор: красный, большое заднее колесо, маленькое переднее, зелёный прицеп.
import traktor from '../../data/machines/traktor.js';
import { roundRect } from '../../core/draw-utils.js';
import { OUTLINE, box, shape, circle, line, drawWheel, drawWindow, drawPipe, drawLamp, makeMachine } from '../parts-common.js';

const RED = '#e8412c', RED_DARK = '#b52b1b', GREEN = '#43b649', GREEN_DARK = '#2b8a33';
const BOARD = '#f2b54a', BOARD_DARK = '#c98a2a', LOG = '#a0632c';

function pricep(g, w, h, loaded) {
  // дышло к трактору
  line(g, 200, 112, w, 118, OUTLINE, 12); line(g, 200, 112, w - 2, 118, '#5a5f6b', 7);
  if (loaded) {
    // брёвна и доски над бортом
    for (let i = 0; i < 3; i++) {
      box(g, 14 + i * 6, 2 + i * 16, 200, 16, 5, i % 2 ? BOARD : BOARD_DARK, 3);
    }
    for (const [cx, cy] of [[40, 22], [80, 26], [120, 22], [160, 26]]) {
      circle(g, cx, cy, 14, LOG, 3); circle(g, cx, cy, 7, '#d9a066');
    }
  }
  // кузов прицепа
  box(g, 6, 34, 210, 86, 10, GREEN);
  g.strokeStyle = GREEN_DARK; g.lineWidth = 5;
  for (const y of [62, 90]) { g.beginPath(); g.moveTo(16, y); g.lineTo(206, y); g.stroke(); }
  for (const x of [60, 110, 160]) { g.beginPath(); g.moveTo(x, 42); g.lineTo(x, 112); g.stroke(); }
  // рама и колесо
  box(g, 30, 118, 170, 14, 5, '#5a5f6b', 4);
  shape(g, GREEN_DARK, (q) => { q.arc(110, 166, 62, Math.PI, 0); q.closePath(); }, 4);
  drawWheel(g, 110, 166, 52, '#ffc21a');
}

function kabina(g, w, h) {
  // крыло над колесом
  shape(g, RED_DARK, (q) => { q.moveTo(2, h - 2); q.quadraticCurveTo(w / 2, h - 52, w - 2, h - 2); q.lineTo(w - 2, h - 20); q.quadraticCurveTo(w / 2, h - 70, 2, h - 20); q.closePath(); }, 4);
  // крыша
  box(g, 8, 6, w - 16, 20, 8, RED);
  // стойки и стекло
  drawWindow(g, [[24, 26], [w - 24, 26], [w - 24, 112], [24, 112]]);
  box(g, 16, 22, 14, 112, 5, RED, 4);
  box(g, w - 30, 22, 14, 112, 5, RED, 4);
  box(g, 10, 110, w - 20, 34, 8, RED);
  g.fillStyle = OUTLINE; roundRect(g, w - 70, 122, 26, 8, 4); g.fill();
}

function motor(g, w, h) {
  drawPipe(g, 100, 0, 36, 80);
  shape(g, RED, (q) => { q.moveTo(2, 74); q.lineTo(w - 26, 74); q.quadraticCurveTo(w - 4, 76, w - 4, 98); q.lineTo(w - 4, 172); q.lineTo(2, 172); q.closePath(); });
  // решётка радиатора и полоски
  g.fillStyle = '#3b4250'; roundRect(g, w - 30, 100, 20, 60, 5); g.fill();
  g.strokeStyle = RED_DARK; g.lineWidth = 5;
  for (let x = 20; x < w - 50; x += 22) { g.beginPath(); g.moveTo(x, 96); g.lineTo(x, 150); g.stroke(); }
  drawLamp(g, w - 40, 88, 9);
  box(g, 40, 172, 70, 18, 5, '#5a5f6b', 4);
}

const PART_DRAW = {
  pricep: (g, w, h) => pricep(g, w, h, false),
  kabina,
  motor,
  'koleso-zadnee': (g, w, h) => drawWheel(g, w / 2, h / 2, w / 2 - 2, '#ffc21a'),
  'koleso-perednee': (g, w, h) => drawWheel(g, w / 2, h / 2, w / 2 - 2, '#ffc21a'),
};

function smoke(g, x, y) {
  g.fillStyle = 'rgba(200,205,215,0.9)'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  for (const [dx, dy, r] of [[0, 0, 12], [18, -12, 15], [42, -20, 13]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
}

function work(g, W, H, drawWhole) {
  drawWhole(g, {
    special(g2, p) {
      if (p.id !== 'pricep') return false;
      g2.save(); g2.translate(p.x, p.y); pricep(g2, p.w, p.h, true); g2.restore();
      return true;
    },
  });
  smoke(g, 560, 28);
}

export const machine = makeMachine(traktor, PART_DRAW, {
  work,
  blobs: [[60, 190, 24], [170, 200, 20], [320, 120, 22], [500, 160, 24], [360, 250, 18], [540, 300, 16]],
});
export const art = machine.art;
