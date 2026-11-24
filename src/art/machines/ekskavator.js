// Экскаватор: жёлтый, гусеницы, стрела, рукоять, ковш с зубьями.
import ekskavator from '../../data/machines/ekskavator.js';
import { OUTLINE, box, shape, circle, line, drawTrack, drawCab, drawPipe, pile, makeMachine, drawPartAt, rotated } from '../parts-common.js';

const Y = '#ffc21a', Y_DARK = '#d99a00', BUCKET = '#8d929c';

function korpus(g, w, h) {
  box(g, 60, 52, 220, h - 54, 8, '#3b4250', 4);
  box(g, 4, 4, w - 8, 52, 12, Y);
  g.fillStyle = Y_DARK; g.fillRect(12, 40, w - 24, 8);
}

function protivoves(g, w, h) {
  drawPipe(g, 140, 0, 36, 60);
  shape(g, Y, (q) => { q.moveTo(w, 44); q.lineTo(40, 44); q.quadraticCurveTo(4, 46, 4, 80); q.lineTo(4, h - 2); q.lineTo(w, h - 2); q.closePath(); });
  // решётка мотора
  g.strokeStyle = Y_DARK; g.lineWidth = 6; g.lineCap = 'round';
  for (let x = 70; x < w - 20; x += 22) { g.beginPath(); g.moveTo(x, 62); g.lineTo(x, 92); g.stroke(); }
  box(g, 6, 70, 30, h - 74, 8, '#3b4250', 4);
}

function strela(g, w, h) {
  shape(g, Y, (q) => {
    q.moveTo(2, 150); q.quadraticCurveTo(30, 40, 110, 8); q.lineTo(w, 8); q.lineTo(w, 42); q.lineTo(118, 44);
    q.quadraticCurveTo(60, 70, 40, 188); q.lineTo(10, 188); q.closePath();
  });
  // гидроцилиндр
  line(g, 44, 160, 110, 60, OUTLINE, 14); line(g, 44, 160, 110, 60, '#c9ccd2', 8);
  circle(g, w, 25, 13, '#3b4250', 4);
  circle(g, 22, 172, 12, '#3b4250', 4);
}

function rukoyat(g, w, h) {
  shape(g, Y, (q) => { q.moveTo(0, 8); q.lineTo(30, 6); q.lineTo(72, 160); q.lineTo(70, h); q.lineTo(30, h); q.lineTo(0, 44); q.closePath(); });
  line(g, 30, 30, 56, 150, '#c9ccd2', 7);
  circle(g, 0, 25, 13, '#3b4250', 4);
  circle(g, 48, h, 13, '#3b4250', 4);
}

function kovsh(g, w, h, full = false) {
  shape(g, BUCKET, (q) => {
    q.moveTo(64, 2); q.lineTo(112, 6); q.quadraticCurveTo(138, 50, 128, 96);
    q.quadraticCurveTo(116, 136, 70, 142); q.lineTo(26, 132); q.quadraticCurveTo(58, 110, 60, 60); q.closePath();
  });
  // зубья
  g.fillStyle = '#d9dce2'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const x = 30 + i * 14, y = 130 + i * 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 18, y + 10); g.lineTo(x + 6, y + 6); g.closePath(); g.fill(); g.stroke();
  }
  if (full) pile(g, 90, 40, 70, 30, '#a4733e', '#7a5229');
  circle(g, 88, 0, 13, '#3b4250', 4);
}

const PART_DRAW = {
  gusenica: (g, w, h) => drawTrack(g, 3, 3, w - 6, h - 6, Y),
  korpus,
  kabina: (g, w, h) => drawCab(g, 0, 0, w, h, Y, Y_DARK),
  protivoves,
  strela,
  rukoyat,
  kovsh: (g, w, h) => kovsh(g, w, h, false),
};

const ARM = ['strela', 'rukoyat', 'kovsh'];

function work(g, W, H, drawWhole) {
  drawWhole(g, { skip: ARM });
  // стрела поднята, в ковше земля
  rotated(g, 382, 192, -0.14, () => {
    for (const p of ekskavator.parts) {
      if (!ARM.includes(p.id)) continue;
      if (p.id === 'kovsh') { g.save(); g.translate(p.x - 30, p.y); kovsh(g, p.w, p.h, true); g.restore(); }
      else if (p.id === 'rukoyat') { g.save(); g.translate(p.x, p.y); g.translate(0, 25); g.rotate(0.15); g.translate(0, -25); rukoyat(g, p.w, p.h); g.restore(); }
      else drawPartAt(g, PART_DRAW, p);
    }
  });
  // комья падают
  g.fillStyle = '#7a5229';
  for (const [x, y, r] of [[520, 300, 8], [540, 330, 6], [505, 345, 7]]) circle(g, x, y, r, '#a4733e', 3);
}

export const machine = makeMachine(ekskavator, PART_DRAW, {
  work,
  blobs: [[80, 330, 24], [250, 330, 22], [120, 160, 20], [280, 240, 18], [560, 300, 20], [440, 90, 16]],
});
export const art = machine.art;
