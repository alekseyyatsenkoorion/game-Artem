// Самосвал: рисование деталей и поз. Координаты деталей — из src/data/machines/samosval.js.
import samosval from '../../data/machines/samosval.js';
import { roundRect } from '../../core/draw-utils.js';
import { drawWheel, makeMachine } from '../parts-common.js';

const RED = '#e8412c';
const RED_DARK = '#b52b1b';
const YELLOW = '#ffc21a';
const YELLOW_DARK = '#d99a00';
const STEEL = '#3b4250';
const GLASS = '#9fdcff';
const OUTLINE = '#2a2230';

function drawKuzov(g, w, h) {
  g.lineJoin = 'round';
  // корпус кузова
  g.fillStyle = YELLOW;
  g.strokeStyle = OUTLINE; g.lineWidth = 5;
  g.beginPath();
  g.moveTo(4, 14); g.lineTo(w - 4, 14); g.lineTo(w - 18, h - 4); g.lineTo(18, h - 4); g.closePath();
  g.fill(); g.stroke();
  // верхний бортик
  g.fillStyle = YELLOW_DARK;
  roundRect(g, 0, 4, w, 18, 6); g.fill(); g.stroke();
  // рёбра
  g.strokeStyle = YELLOW_DARK; g.lineWidth = 8;
  for (let i = 1; i <= 4; i++) {
    const x = 18 + i * (w - 36) / 5;
    g.beginPath(); g.moveTo(x, 30); g.lineTo(x - 2, h - 14); g.stroke();
  }
  // задний борт со шарниром
  g.fillStyle = STEEL;
  g.beginPath(); g.arc(22, h - 14, 9, 0, Math.PI * 2); g.fill();
}

function drawKabina(g, w, h) {
  g.lineJoin = 'round';
  g.fillStyle = RED;
  g.strokeStyle = OUTLINE; g.lineWidth = 5;
  g.beginPath();
  g.moveTo(4, h - 4); g.lineTo(4, 26);
  g.quadraticCurveTo(4, 4, 26, 4);
  g.lineTo(118, 4);
  g.quadraticCurveTo(132, 4, 140, 16);
  g.lineTo(176, 78);
  g.quadraticCurveTo(w - 4, 86, w - 4, 104);
  g.lineTo(w - 4, h - 4);
  g.closePath();
  g.fill(); g.stroke();
  // окно
  g.fillStyle = GLASS;
  g.beginPath();
  g.moveTo(24, 22); g.lineTo(116, 22); g.lineTo(152, 82); g.lineTo(24, 82); g.closePath();
  g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 4; g.stroke();
  // блик
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(40, 70); g.lineTo(62, 34); g.stroke();
  // дверь и ручка
  g.strokeStyle = RED_DARK; g.lineWidth = 4;
  g.beginPath(); g.moveTo(24, 96); g.lineTo(140, 96); g.lineTo(140, h - 16); g.stroke();
  g.fillStyle = OUTLINE;
  roundRect(g, 104, 108, 26, 8, 4); g.fill();
  // фара и бампер
  g.fillStyle = '#fff6a8';
  g.beginPath(); g.arc(w - 18, 122, 12, 0, Math.PI * 2); g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#9aa0aa';
  roundRect(g, w - 30, h - 26, 26, 20, 5); g.fill();
}

function drawRama(g, w, h) {
  g.fillStyle = STEEL;
  g.strokeStyle = OUTLINE; g.lineWidth = 4;
  roundRect(g, 2, 4, w - 4, h - 8, 8); g.fill(); g.stroke();
  // полоски
  g.fillStyle = '#ffcf3a';
  for (let x = 14; x < w - 20; x += 44) {
    g.beginPath(); g.moveTo(x, h - 8); g.lineTo(x + 16, 6); g.lineTo(x + 30, 6); g.lineTo(x + 14, h - 8); g.closePath(); g.fill();
  }
  // болты
  g.fillStyle = '#9aa0aa';
  for (let x = 30; x < w; x += 120) { g.beginPath(); g.arc(x, h / 2, 5, 0, Math.PI * 2); g.fill(); }
}

function drawRear(g, w, h) {
  drawWheel(g, 52, h / 2, 49);
  drawWheel(g, w - 52, h / 2, 49);
}

function drawFront(g, w, h) {
  drawWheel(g, w / 2, h / 2, 49);
}

export const PART_DRAW = {
  kuzov: drawKuzov,
  kabina: drawKabina,
  rama: drawRama,
  'koleso-zadnee': drawRear,
  'koleso-perednee': drawFront,
};

function drawWork(g, w, h, drawWhole) {
  // песок сыплется из поднятого кузова
  g.fillStyle = '#e9c46a';
  g.beginPath(); g.moveTo(6, 120); g.quadraticCurveTo(-4, 220, 10, h); g.lineTo(60, h); g.quadraticCurveTo(30, 220, 40, 130); g.closePath(); g.fill();
  const tilt = 0.42;
  drawWhole(g, {
    special(g2, p) {
      if (p.id !== samosval.workPart) return false;
      // кузов поднят: поворот вокруг заднего нижнего угла
      g2.save();
      g2.translate(p.x + 14, p.y + p.h - 4); g2.rotate(-tilt); g2.translate(-(p.x + 14), -(p.y + p.h - 4));
      g2.translate(p.x, p.y); PART_DRAW[p.id](g2, p.w, p.h);
      g2.restore();
      return true;
    },
  });
}

export const machine = makeMachine(samosval, PART_DRAW, {
  work: drawWork,
  blobs: [[80, 100, 30], [200, 140, 24], [420, 150, 26], [300, 205, 20], [470, 60, 18], [120, 270, 22]],
});
export const art = machine.art;
