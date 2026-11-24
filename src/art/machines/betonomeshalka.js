// Бетономешалка: синяя кабина, барабан в красно-белую спираль, лоток сзади.
import mixer from '../../data/machines/betonomeshalka.js';
import { roundRect } from '../../core/draw-utils.js';
import { OUTLINE, STEEL, box, shape, line, drawWheel, drawTruckCab, hazard, pile, makeMachine } from '../parts-common.js';

const BLUE = '#2f7de1', BLUE_DARK = '#1f5bb0', RED = '#e8412c', WHITE = '#fbfbf7';

function drumPath(q) {
  q.moveTo(14, -34);
  q.quadraticCurveTo(120, -86, 230, -70);
  q.quadraticCurveTo(300, -60, 300, 0);
  q.quadraticCurveTo(300, 60, 230, 70);
  q.quadraticCurveTo(120, 86, 14, 34);
  q.closePath();
}

function baraban(g, w, h, phase = 0) {
  // опоры барабана
  box(g, 50, 120, 22, h - 120, 4, STEEL, 4);
  box(g, 240, 110, 26, h - 110, 4, STEEL, 4);
  g.save();
  g.translate(16, 104); g.rotate(-0.16);
  g.fillStyle = WHITE; g.strokeStyle = OUTLINE; g.lineWidth = 5; g.lineJoin = 'round';
  g.beginPath(); drumPath(g); g.fill();
  // спиральные полосы
  g.save(); g.beginPath(); drumPath(g); g.clip();
  g.fillStyle = RED;
  for (let x = -200 + (phase % 1) * 72; x < 360; x += 72) {
    g.beginPath(); g.moveTo(x, -90); g.lineTo(x + 36, -90); g.quadraticCurveTo(x + 90, 0, x + 156, 90); g.lineTo(x + 120, 90); g.quadraticCurveTo(x + 54, 0, x, -90); g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, -60, 300, 14);
  g.restore();
  g.beginPath(); drumPath(g); g.stroke();
  // горловина сзади
  box(g, 0, -22, 22, 44, 6, '#8d929c', 4);
  g.restore();
}

function lotok(g, w, h) {
  shape(g, '#9aa0aa', (q) => { q.moveTo(w - 2, 6); q.lineTo(w - 2, 30); q.lineTo(18, h - 4); q.lineTo(4, h - 16); q.closePath(); }, 4);
  line(g, w - 10, 16, 14, h - 16, '#6b707a', 4);
}

function bak(g, w, h) {
  box(g, 6, 8, w - 12, h - 16, 14, '#e8f4ff');
  g.fillStyle = BLUE; roundRect(g, 10, 30, w - 20, 22, 4); g.fill();
  box(g, 14, 0, w - 28, 12, 4, STEEL, 3);
  box(g, 18, h - 12, w - 36, 12, 3, STEEL, 3);
}

const PART_DRAW = {
  rama: (g, w, h) => { box(g, 2, 3, w - 4, h - 6, 8, STEEL, 4); hazard(g, 12, 9, w - 24, h - 18); },
  'koleso-zadnee': (g, w, h) => { drawWheel(g, 52, h / 2, 48); drawWheel(g, w - 52, h / 2, 48); },
  'koleso-perednee': (g, w, h) => drawWheel(g, w / 2, h / 2, 48),
  kabina: (g, w, h) => drawTruckCab(g, w, h, BLUE, BLUE_DARK),
  baraban: (g, w, h) => baraban(g, w, h, 0),
  lotok,
  'bak-vody': bak,
};

function work(g, W, H, drawWhole) {
  drawWhole(g, {
    special(g2, p) {
      if (p.id !== 'baraban') return false;
      g2.save(); g2.translate(p.x, p.y); baraban(g2, p.w, p.h, 0.5); g2.restore();
      return true;
    },
  });
  // бетон течёт по лотку на землю
  g.fillStyle = '#7d828c'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  g.beginPath(); g.moveTo(4, 200); g.quadraticCurveTo(-2, 270, 8, H - 20); g.lineTo(26, H - 20); g.quadraticCurveTo(20, 270, 22, 204); g.closePath(); g.fill(); g.stroke();
  pile(g, 22, H, 44, 26, '#7d828c');
}

export const machine = makeMachine(mixer, PART_DRAW, {
  work,
  blobs: [[120, 120, 24], [260, 90, 20], [470, 150, 22], [200, 230, 18], [530, 320, 16], [90, 300, 18]],
});
export const art = machine.art;
