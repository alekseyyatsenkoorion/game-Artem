// Грейдер: жёлтый, длинная рама, нож под рамой, кабина сзади, мигалка.
import greider from '../../data/machines/greider.js';
import { OUTLINE, STEEL, box, shape, line, drawWheel, drawCab, drawPipe, drawLamp, drawBeacon, makeMachine, pile } from '../parts-common.js';

const Y = '#ffc21a', Y_DARK = '#d99a00';

function rama(g, w, h) {
  // тяги к ножу и поворотный круг
  line(g, 40, 40, 70, 122, OUTLINE, 14); line(g, 40, 40, 70, 122, STEEL, 8);
  line(g, 190, 40, 160, 122, OUTLINE, 14); line(g, 190, 40, 160, 122, STEEL, 8);
  g.fillStyle = '#5a5f6b'; g.strokeStyle = OUTLINE; g.lineWidth = 4;
  g.beginPath(); g.ellipse(115, 118, 72, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  // изогнутая балка и передняя вилка
  shape(g, Y, (q) => {
    q.moveTo(0, 8); q.lineTo(250, 8); q.quadraticCurveTo(310, 8, 312, 60); q.lineTo(306, h - 2); q.lineTo(266, h - 2);
    q.lineTo(268, 64); q.quadraticCurveTo(266, 46, 240, 46); q.lineTo(0, 46); q.closePath();
  });
  g.fillStyle = Y_DARK; g.fillRect(10, 34, 236, 6);
}

function nozh(g, w, h) {
  shape(g, '#9aa0aa', (q) => {
    q.moveTo(6, 10); q.quadraticCurveTo(w / 2, 26, w - 6, 10); q.lineTo(w - 4, 66); q.quadraticCurveTo(w / 2, 82, 4, 66); q.closePath();
  });
  g.strokeStyle = '#d9dce2'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(14, 62); g.quadraticCurveTo(w / 2, 76, w - 14, 62); g.stroke();
  box(g, w / 2 - 50, 0, 100, 14, 4, STEEL, 3);
}

const PART_DRAW = {
  'koleso-zadnee': (g, w, h) => { box(g, 56, h / 2 - 8, w - 112, 16, 6, STEEL, 3); drawWheel(g, 56, h / 2, 52); drawWheel(g, w - 56, h / 2, 52); },
  'koleso-perednee': (g, w, h) => drawWheel(g, w / 2, h / 2, w / 2 - 3),
  motor: (g, w, h) => {
    box(g, 4, 6, w - 4, h - 10, 12, Y);
    g.strokeStyle = Y_DARK; g.lineWidth = 6; g.lineCap = 'round';
    for (let x = 30; x < w - 10; x += 22) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, 60); g.stroke(); }
    box(g, 6, 66, 16, 20, 4, '#e8412c', 3);
  },
  kabina: (g, w, h) => drawCab(g, 0, 0, w, h, Y, Y_DARK),
  mayachok: (g, w, h) => drawBeacon(g, w / 2, h - 2, 18),
  truba: (g, w, h) => drawPipe(g, 0, 0, w, h),
  rama,
  fara: (g, w, h) => { box(g, 6, h - 16, w - 12, 12, 4, STEEL, 3); drawLamp(g, 18, h - 28, 11); drawLamp(g, w - 18, h - 28, 11); },
  nozh,
};

function work(g, W, H, drawWhole) {
  // нож опущен до земли, перед ним валик земли
  pile(g, 470, H, 120, 26, '#a4733e', '#7a5229');
  drawWhole(g, {
    special(g2, p) {
      if (p.id !== 'nozh') return false;
      g2.save(); g2.translate(p.x, p.y + 18); nozh(g2, p.w, p.h); g2.restore();
      return true;
    },
  });
  g.fillStyle = 'rgba(200,170,120,0.75)';
  for (const [x, y, r] of [[500, 300, 14], [520, 312, 10], [280, 318, 10]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
}

export const machine = makeMachine(greider, PART_DRAW, {
  work,
  blobs: [[80, 170, 20], [200, 180, 18], [130, 280, 20], [400, 120, 18], [560, 280, 18], [380, 260, 16]],
});
export const art = machine.art;
