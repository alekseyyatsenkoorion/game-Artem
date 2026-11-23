// Бульдозер: оранжевый, гусеницы, отвал спереди.
import buldozer from '../../data/machines/buldozer.js';
import { OUTLINE, box, shape, line, drawTrack, drawCab, drawPipe, drawLamp, pile, makeMachine } from '../parts-common.js';

const OR = '#ff8c1a', OR_DARK = '#d96a00';

function rama(g, w, h) {
  box(g, 4, 6, w - 8, h - 12, 12, OR);
  g.fillStyle = OR_DARK; g.fillRect(10, h - 30, w - 20, 10);
  // решётка мотора
  g.strokeStyle = OR_DARK; g.lineWidth = 6; g.lineCap = 'round';
  for (let x = 250; x < w - 30; x += 24) { g.beginPath(); g.moveTo(x, 22); g.lineTo(x, 50); g.stroke(); }
  box(g, w - 22, 20, 14, 40, 4, '#3b4250', 3);
}

function otval(g, w, h) {
  // толкатели
  line(g, 0, 90, 82, 150, OUTLINE, 20); line(g, 0, 90, 82, 150, OR_DARK, 13);
  line(g, 0, 46, 80, 70, OUTLINE, 14); line(g, 0, 46, 80, 70, '#c9ccd2', 8);
  // сам отвал — изогнутый
  shape(g, OR, (q) => {
    q.moveTo(76, 8); q.lineTo(112, 8); q.quadraticCurveTo(96, 110, 124, 196); q.lineTo(124, 214); q.lineTo(80, 214); q.quadraticCurveTo(64, 110, 76, 8); q.closePath();
  });
  g.strokeStyle = OR_DARK; g.lineWidth = 5;
  for (const y of [60, 110, 160]) { g.beginPath(); g.moveTo(76, y); g.lineTo(104, y); g.stroke(); }
  box(g, 78, 196, 48, 18, 4, '#9aa0aa', 4);
}

const PART_DRAW = {
  gusenica: (g, w, h) => drawTrack(g, 3, 3, w - 6, h - 6, OR),
  rama,
  kabina: (g, w, h) => drawCab(g, 0, 0, w, h, OR, OR_DARK),
  truba: (g, w, h) => drawPipe(g, 0, 0, w, h),
  fara: (g, w, h) => { box(g, w / 2 - 6, 30, 12, h - 30, 3, '#5a5f6b', 3); drawLamp(g, w / 2, 24, 17); },
  otval,
};

function work(g, W, H, drawWhole) {
  drawWhole(g);
  // земля перед отвалом и пыль
  pile(g, 612, H, 110, 96, '#a4733e', '#7a5229');
  g.fillStyle = 'rgba(200,170,120,0.7)';
  for (const [x, y, r] of [[30, 300, 18], [12, 280, 12], [50, 316, 12]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
}

export const machine = makeMachine(buldozer, PART_DRAW, {
  work,
  blobs: [[90, 190, 24], [220, 210, 20], [380, 180, 22], [150, 90, 18], [540, 270, 20], [300, 290, 18]],
});
export const art = machine.art;
