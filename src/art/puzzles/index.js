// 20 картинок пазлов 640×480 (spec.md, «Пазлы»), пока нет картинок из ChatGPT.
// 16 — машина смотрит влево, природа; 25 — машина смотрит вправо и работает, стройка;
// 36 — машина смотрит влево на готовую постройку (machine.puzzles[36].object), рисуются её слои.
import { machines } from '../machines/index.js';
import { drawWithLoad } from '../machines/pogruzchik.js';
import { TAU, box } from '../parts-common.js';
import * as S from './scenery.js';
import { art as objectArt } from '../objects/index.js';
import objectsData from '../../data/objects/index.js';
import contentData from '../../data/index.js';

const { PW, PH } = S;

// Рисует машину: низ — на линии gy, центр по x — cx. facing 'left' — зеркально.
function place(g, id, { facing, pose = 'idle', cx = 320, gy = 440, maxW = 430, maxH = 290, custom }) {
  const m = machines[id];
  const { w, h } = m.size;
  const s = Math.min(maxW / w, maxH / h);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath(); g.ellipse(cx, gy, w * s * 0.5, 12, 0, 0, TAU); g.fill();
  g.save();
  if (facing === 'left') { g.translate(cx + (w * s) / 2, gy - h * s); g.scale(-s, s); }
  else { g.translate(cx - (w * s) / 2, gy - h * s); g.scale(s, s); }
  if (custom) custom(g);
  else if (pose === 'work') m.drawWork(g);
  else m.drawWhole(g);
  g.restore();
}

function meadowFlowers(g, r, y0, y1, n, colors) {
  for (let i = 0; i < n; i++) S.stemFlower(g, r() * PW, y0 + r() * (y1 - y0), 10 + r() * 14, colors[i % colors.length], 5 + r() * 3);
}

// ---------------- 16: природа, смотрит влево ----------------

function n1Samosval(g) { // поле подсолнухов
  const r = S.rng(11);
  S.sky(g, '#5fc0ff', '#d7f1ff', 300);
  S.sun(g, 560, 70, 34);
  S.cloud(g, 70, 70, 1.1); S.cloud(g, 300, 50, 0.9);
  S.hills(g, 250, '#9bd77a', 22, 1);
  S.tree(g, 470, 250, 0.9);
  S.hills(g, 300, '#7cc85a', 14, 4);
  for (let i = 0; i < 16; i++) S.sunflower(g, 10 + i * 40 + r() * 10, 330, 40 + r() * 20, 0.7);
  S.ground(g, 380, '#d9b77c', '#c49a5e');
  S.stones(g, r, 390, 470, 14, '#b9a58a');
  place(g, 'samosval', { facing: 'left', cx: 330, gy: 430 });
  for (let i = 0; i < 6; i++) S.sunflower(g, 20 + i * 120 + r() * 30, 480, 50 + r() * 20, 0.9);
  S.tufts(g, r, 440, 478, 20);
}

function n2Traktor(g) { // речка с мостиком
  const r = S.rng(12);
  S.sky(g, '#6cc4ff', '#e2f6ff', 260);
  S.sun(g, 70, 60, 32);
  S.cloud(g, 380, 60, 1); S.cloud(g, 200, 110, 0.7);
  S.hills(g, 210, '#8fd16d', 16, 2);
  S.spruce(g, 420, 230, 1); S.spruce(g, 480, 236, 1.2); S.spruce(g, 550, 230, 0.9);
  S.ground(g, 230, '#7cc85a');
  meadowFlowers(g, r, 236, 270, 14, ['#ff6f91', '#ffffff', '#ffd23f']);
  // речка
  g.fillStyle = '#3aa0ff'; g.strokeStyle = '#2a2230'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 280); g.quadraticCurveTo(320, 260, PW, 290); g.lineTo(PW, 350); g.quadraticCurveTo(320, 330, 0, 345); g.closePath(); g.fill(); g.stroke();
  S.waves(g, 290, 340, '#bfe8ff');
  S.bridge(g, 40, 296, 170);
  S.reeds(g, 600, 300, 0.8); S.reeds(g, 250, 345, 0.7);
  g.fillStyle = '#8fd16d'; g.fillRect(0, 352, PW, 128);
  S.stones(g, r, 352, 372, 10);
  place(g, 'traktor', { facing: 'left', cx: 360, gy: 450, maxW: 420, maxH: 250 });
  S.tufts(g, r, 455, 478, 18);
  meadowFlowers(g, r, 458, 476, 8, ['#ffd23f', '#ff6f91']);
}

function n3Buldozer(g) { // холм, вдали горы
  const r = S.rng(13);
  S.sky(g, '#7ccfff', '#eaf8ff', 320);
  S.cloud(g, 40, 60, 0.9); S.cloud(g, 460, 40, 1.1);
  S.sun(g, 330, 60, 26);
  S.mountains(g, 280, [[90, 260, 190], [250, 240, 150], [420, 300, 210], [590, 230, 160]], '#6d8fd6');
  S.mountains(g, 290, [[170, 200, 90], [520, 220, 100]], '#5a7cc4', null);
  S.hills(g, 300, '#9bd77a', 12, 5);
  g.fillStyle = '#6cbf4c'; g.strokeStyle = '#2a2230'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-10, 480); g.quadraticCurveTo(320, 280, 650, 480); g.closePath(); g.fill(); g.stroke();
  S.tree(g, 40, 430, 0.8); S.tree(g, 600, 440, 0.7, '#3fa34d');
  meadowFlowers(g, r, 400, 476, 14, ['#ffffff', '#ffd23f', '#ff6f91', '#7b8cff']);
  place(g, 'buldozer', { facing: 'left', cx: 320, gy: 400, maxW: 400, maxH: 240 });
  S.tufts(g, r, 410, 478, 26, '#3f8f3a');
}

function n4Katok(g) { // озеро с камышами
  const r = S.rng(14);
  S.sky(g, '#68c2ff', '#e6f7ff', 230);
  S.cloud(g, 100, 70, 1); S.cloud(g, 470, 50, 0.8);
  S.sun(g, 590, 60, 28);
  S.hills(g, 200, '#86cf68', 14, 3);
  S.tree(g, 90, 220, 0.8); S.tree(g, 210, 214, 0.7, '#3fa34d'); S.spruce(g, 520, 222, 0.9);
  g.fillStyle = '#2f8fe8'; g.strokeStyle = '#2a2230'; g.lineWidth = 3;
  g.beginPath(); g.ellipse(320, 280, 360, 70, 0, 0, TAU); g.fill(); g.stroke();
  S.waves(g, 236, 330, '#9fd6ff', 60);
  S.lily(g, 120, 300); S.lily(g, 470, 270); S.lily(g, 560, 310); S.lily(g, 260, 250);
  S.reeds(g, 30, 340, 1); S.reeds(g, 600, 345, 1.1); S.reeds(g, 560, 340, 0.8);
  S.ground(g, 340, '#8fd16d', '#d9c58a');
  S.stones(g, r, 345, 360, 8);
  place(g, 'katok', { facing: 'left', cx: 320, gy: 450, maxW: 420, maxH: 250 });
  S.tufts(g, r, 450, 478, 20);
  meadowFlowers(g, r, 455, 478, 7, ['#ffffff', '#ff9ad5']);
}

function n5Mixer(g) { // дорога через осенний лес
  const r = S.rng(15);
  S.sky(g, '#8fd0ff', '#fff2d6', 320);
  S.cloud(g, 300, 50, 1); S.cloud(g, 60, 120, 0.7); S.cloud(g, 520, 90, 0.8);
  const crowns = ['#ffb020', '#ff7a1a', '#e8412c', '#ffd23f'];
  for (let i = 0; i < 9; i++) S.tree(g, 20 + i * 75, 300, 1.1 + (i % 3) * 0.15, crowns[i % 4]);
  S.ground(g, 300, '#c9a05a');
  for (let i = 0; i < 7; i++) S.tree(g, 40 + i * 100 + r() * 20, 350, 0.8, crowns[(i + 2) % 4]);
  // дорога
  g.fillStyle = '#7b7f87'; g.fillRect(0, 360, PW, 90);
  g.fillStyle = '#f4f4f4'; for (let x = 10; x < PW; x += 90) g.fillRect(x, 402, 50, 8);
  S.leaves(g, r, 300, 360, 40); S.leaves(g, r, 452, 480, 26);
  g.fillStyle = '#c9a05a'; g.fillRect(0, 450, PW, 30); S.leaves(g, r, 452, 480, 30);
  place(g, 'betonomeshalka', { facing: 'left', cx: 320, gy: 440 });
}

function n6Ekskavator(g) { // луг с цветами, ковш опущен
  const r = S.rng(16);
  S.sky(g, '#5fc0ff', '#e2f6ff', 280);
  S.sun(g, 80, 70, 30);
  S.cloud(g, 330, 60, 1); S.cloud(g, 520, 100, 0.8);
  S.hills(g, 230, '#a6dd84', 18, 1.5);
  S.bush(g, 470, 260, 1); S.tree(g, 590, 270, 0.9);
  S.hills(g, 280, '#74c25a', 10, 3);
  meadowFlowers(g, r, 285, 340, 30, ['#e8412c', '#3a6bff', '#ffffff', '#ffd23f']);
  place(g, 'ekskavator', { facing: 'left', cx: 320, gy: 430, maxW: 430, maxH: 270 });
  meadowFlowers(g, r, 440, 478, 18, ['#e8412c', '#3a6bff', '#ffffff']);
  S.tufts(g, r, 430, 478, 24);
}

function n7Pogruzchik(g) { // зима, ковш снега, ёлки
  const r = S.rng(17);
  S.sky(g, '#9fd6ff', '#eef8ff', 300);
  S.cloud(g, 80, 60, 0.9, '#f5fbff'); S.cloud(g, 400, 40, 1.1, '#f5fbff');
  S.hills(g, 250, '#f5fbff', 18, 2);
  for (let i = 0; i < 8; i++) S.spruce(g, 30 + i * 85, 270 + (i % 2) * 14, 0.9 + (i % 3) * 0.2, '#2f9e52', true);
  S.ground(g, 300, '#ffffff');
  g.fillStyle = '#dbeeff'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(50 + i * 110, 330 + (i % 2) * 40, 60, 16, 0, 0, TAU); g.fill(); }
  place(g, 'pogruzchik', { facing: 'left', cx: 320, gy: 440, maxW: 420, maxH: 280, custom: (q) => drawWithLoad(q, '#ffffff') });
  S.spruce(g, 40, 480, 0.8, '#2f9e52', true); S.spruce(g, 600, 480, 0.9, '#2f9e52', true);
  S.snowflakes(g, r, 50);
}

function n8Avtokran(g) { // берег моря, стрела сложена
  const r = S.rng(18);
  S.sky(g, '#5fc0ff', '#d8f3ff', 230);
  S.sun(g, 80, 60, 30);
  S.cloud(g, 330, 60, 0.9);
  g.fillStyle = '#2f7de1'; g.fillRect(0, 200, PW, 150);
  S.waves(g, 214, 345, '#9fd6ff');
  S.sailboat(g, 250, 230, 0.8);
  S.lighthouse(g, 560, 300, 1);
  g.fillStyle = '#f2d589'; g.strokeStyle = '#2a2230'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 340); g.quadraticCurveTo(320, 310, PW, 330); g.lineTo(PW, PH); g.lineTo(0, PH); g.closePath(); g.fill(); g.stroke();
  S.stones(g, r, 340, 470, 10, '#b9a58a');
  for (let i = 0; i < 8; i++) S.shell(g, r() * PW, 350 + r() * 120, i % 2 ? '#ffb3a7' : '#ffe0a3');
  place(g, 'avtokran', { facing: 'left', cx: 320, gy: 450, maxW: 460, maxH: 290 });
}

function n9Greider(g) { // степь на закате
  const r = S.rng(19);
  S.sky(g, '#ff8a65', '#ffd59a', 320);
  g.fillStyle = 'rgba(255,170,200,0.5)'; g.fillRect(0, 0, PW, 120);
  S.sun(g, 470, 250, 60, '#ffef7a', false);
  S.cloud(g, 60, 70, 1, '#ffd0e0'); S.cloud(g, 300, 110, 0.8, '#ffe0c0');
  S.hills(g, 280, '#d9a441', 10, 2);
  S.windmill(g, 120, 290, 1);
  S.tree(g, 590, 290, 0.8, '#7a9a3a');
  S.ground(g, 300, '#e8b84a');
  g.strokeStyle = '#c48a1a'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 140; i++) { const x = r() * PW, y = 300 + r() * 180; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y - 18); g.stroke(); }
  g.fillStyle = '#c9a070'; g.fillRect(0, 410, PW, 40);
  place(g, 'greider', { facing: 'left', cx: 320, gy: 440 });
  g.strokeStyle = '#ffd25a'; g.lineWidth = 4;
  for (let i = 0; i < 50; i++) { const x = r() * PW, y = 450 + r() * 30; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x - 3, y - 22); g.stroke(); }
}

function n10Kran(g) { // радуга и облака, стрела влево
  const r = S.rng(20);
  S.sky(g, '#62c3ff', '#e8f8ff', 400);
  S.rainbow(g, 320, 420, 330);
  S.cloud(g, 10, 110, 1.3); S.cloud(g, 520, 90, 1.2); S.cloud(g, 280, 30, 0.8); S.cloud(g, 120, 260, 0.9);
  S.hills(g, 400, '#8fd16d', 16, 1);
  g.fillStyle = '#6cbf4c'; g.strokeStyle = '#2a2230'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(-10, 480); g.quadraticCurveTo(320, 370, 650, 480); g.closePath(); g.fill(); g.stroke();
  S.tree(g, 50, 470, 0.9); S.tree(g, 600, 470, 0.8, '#3fa34d');
  S.bush(g, 140, 470, 1); S.bush(g, 510, 476, 0.9, '#3fa34d', '#ffd23f');
  place(g, 'bashennyi-kran', { facing: 'left', cx: 330, gy: 440, maxW: 520, maxH: 420 });
  meadowFlowers(g, r, 448, 478, 12, ['#ff6f91', '#ffffff', '#ffd23f']);
}

// ---------------- 25: стройка, смотрит вправо, работает ----------------

function siteBase(g, seed, opts = {}) {
  const r = S.rng(seed);
  S.sky(g, opts.top || '#62c3ff', opts.bottom || '#e2f6ff', 320);
  const sunX = opts.sunX || 580;
  S.sun(g, sunX, 60, 28);
  // облака в разных местах у каждой картинки, чтобы кусочки неба различались
  for (let i = 0; i < 4; i++) {
    const x = 20 + i * 150 + r() * 60, y = 50 + r() * 140;
    if (Math.abs(x + 30 - sunX) < 90 && y < 120) continue;
    S.cloud(g, x, y, 0.55 + r() * 0.5, i % 2 ? '#ffffff' : '#f4f9ff');
  }
  if (opts.city !== false) S.cityline(g, 290, opts.cityColor);
  S.hills(g, 300, '#9bd77a', 10, seed % 7);
  S.ground(g, 310, opts.ground || '#d9b77c', '#c49a5e');
  S.tracks(g, 455);
  S.stones(g, r, 320, 470, 12, '#b9a58a');
  return r;
}

function s1Samosval(g) { // высыпает песок
  siteBase(g, 21);
  S.barrierFence(g, 10, 330, 620);
  S.cone(g, 600, 470); S.cone(g, 560, 450, 0.8);
  S.puddle(g, 520, 462, 30);
  S.pile(g, 90, 440, 170, 90, '#f2c66d', '#c99a3a');
  place(g, 'samosval', { facing: 'right', pose: 'work', cx: 360, gy: 440, maxW: 400 });
}

function s2Traktor(g) { // прицеп с досками вдоль строящегося забора
  const r = siteBase(g, 22, { ground: '#b5d98a', city: false });
  S.tree(g, 560, 300, 0.8); S.tree(g, 80, 300, 0.7, '#3fa34d');
  S.woodFence(g, 10, 380, 620, 7);
  S.planks(g, 470, 470, 4, 150);
  S.cone(g, 30, 470);
  place(g, 'traktor', { facing: 'right', pose: 'work', cx: 300, gy: 450, maxW: 440 });
  S.tufts(g, r, 455, 478, 12);
}

function s3Buldozer(g) { // толкает кучу земли
  siteBase(g, 23, { ground: '#d2a86a', top: '#7ccfff' });
  S.tapePosts(g, 20, 350, 600, 6);
  S.cone(g, 40, 470, 0.9); S.cone(g, 600, 400, 0.8);
  place(g, 'buldozer', { facing: 'right', pose: 'work', cx: 280, gy: 445, maxW: 400 });
  S.pile(g, 560, 445, 150, 100, '#a4733e', '#7a5229');
  S.stones(g, S.rng(5), 430, 440, 4, '#8a8f99');
}

function s4Katok(g) { // укатывает новую дорогу
  const r = siteBase(g, 24, { ground: '#c7d98f', city: true, cityColor: '#c6b0e8' });
  // светлая неровная подсыпка впереди, тёмный асфальт позади
  g.fillStyle = '#c9c2b0'; g.fillRect(0, 380, PW, 80);
  g.fillStyle = '#4a4d55'; g.fillRect(0, 380, 380, 80);
  g.fillStyle = '#a8a08c'; for (let i = 0; i < 30; i++) { const x = 400 + r() * 240, y = 384 + r() * 72; g.beginPath(); g.arc(x, y, 3 + r() * 3, 0, TAU); g.fill(); }
  S.barrierFence(g, 10, 370, 620, 40);
  S.cone(g, 600, 478); S.cone(g, 40, 478); S.cone(g, 500, 478, 0.8);
  place(g, 'katok', { facing: 'right', pose: 'work', cx: 280, gy: 445, maxW: 400 });
}

function s5Mixer(g) { // льёт бетон в опалубку
  siteBase(g, 25, { ground: '#d9b77c', sunX: 80 });
  S.bricks(g, 520, 380, 4, 5);
  S.planks(g, 520, 470, 3, 110);
  // опалубка с бетоном сзади машины (слева)
  box(g, 10, 410, 150, 44, 3, '#7d828c');
  g.strokeStyle = '#2a2230'; g.lineWidth = 3;
  box(g, 6, 404, 158, 12, 2, '#d99a3a'); box(g, 6, 448, 158, 12, 2, '#d99a3a');
  S.cone(g, 610, 478, 0.8);
  place(g, 'betonomeshalka', { facing: 'right', pose: 'work', cx: 340, gy: 440, maxW: 400 });
}

function s6Ekskavator(g) { // копает котлован
  siteBase(g, 26, { ground: '#d6ad70' });
  S.tapePosts(g, 380, 360, 250, 4);
  S.cone(g, 30, 380, 0.8); S.cone(g, 600, 470);
  // котлован справа и куча земли слева
  g.fillStyle = '#7a5229'; g.strokeStyle = '#2a2230'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(420, 432); g.lineTo(640, 432); g.lineTo(640, 480); g.lineTo(460, 480); g.closePath(); g.fill(); g.stroke();
  S.pile(g, 70, 445, 140, 80, '#a4733e', '#7a5229');
  place(g, 'ekskavator', { facing: 'right', pose: 'work', cx: 320, gy: 440, maxW: 420 });
}

function s7Pogruzchik(g) { // песок у строящегося дома
  siteBase(g, 27, { city: false });
  // кирпичный дом без крыши
  box(g, 360, 170, 240, 150, 3, '#d0553a');
  g.strokeStyle = '#a8432c'; g.lineWidth = 2;
  for (let y = 185; y < 320; y += 15) { g.beginPath(); g.moveTo(362, y); g.lineTo(598, y); g.stroke(); }
  S.windowsGrid(g, 360, 180, 3, 2, 80, 66, ['#9fdcff']);
  S.bricks(g, 380, 170, 3, 2);
  S.pile(g, 80, 440, 160, 100, '#f2c66d', '#c99a3a');
  S.pile(g, 570, 440, 130, 70, '#9aa0aa', '#6b707a');
  place(g, 'pogruzchik', { facing: 'right', pose: 'work', cx: 300, gy: 445, maxW: 380 });
}

function s8Avtokran(g) { // поднимает плиту к дому
  siteBase(g, 28, { city: false, top: '#5fb8ff' });
  // недостроенный дом из плит
  S.buildingUnderway(g, 470, 330, 160, 6, 3, '#e0c9a6');
  S.barrierFence(g, 0, 340, 460, 40);
  S.cone(g, 610, 478);
  place(g, 'avtokran', { facing: 'right', pose: 'work', cx: 260, gy: 450, maxW: 460, maxH: 360 });
}

function s9Greider(g) { // ровняет дорогу
  const r = siteBase(g, 29, { ground: '#cfa76a', city: false });
  S.hills(g, 300, '#8fd16d', 18, 2);
  g.fillStyle = '#cfa76a'; g.fillRect(0, 330, PW, 150);
  g.fillStyle = '#b88e52'; g.fillRect(0, 380, PW, 70);
  for (let x = 20; x < PW; x += 80) { box(g, x - 4, 330, 8, 44, 2, '#ffffff', 2); g.fillStyle = '#e8412c'; g.fillRect(x - 3, 340, 6, 10); }
  S.pile(g, 580, 380, 100, 50, '#f2c66d', '#c99a3a');
  S.cone(g, 30, 478); S.cone(g, 610, 478);
  S.stones(g, r, 455, 478, 8, '#9a7a4a');
  place(g, 'greider', { facing: 'right', pose: 'work', cx: 310, gy: 445, maxW: 440 });
}

function s10Kran(g) { // строит многоэтажный дом
  siteBase(g, 30, { city: false, top: '#4fb4ff' });
  S.cloud(g, 480, 120, 0.7);
  S.buildingUnderway(g, 290, 440, 200, 8, 5, '#f0b07a');
  S.barrierFence(g, 0, 470, 640, 30);
  place(g, 'bashennyi-kran', { facing: 'right', pose: 'work', cx: 300, gy: 440, maxW: 560, maxH: 430 });
  S.cone(g, 620, 478, 0.7);
}

const P = {
  samosval: [n1Samosval, s1Samosval],
  traktor: [n2Traktor, s2Traktor],
  buldozer: [n3Buldozer, s3Buldozer],
  katok: [n4Katok, s4Katok],
  betonomeshalka: [n5Mixer, s5Mixer],
  ekskavator: [n6Ekskavator, s6Ekskavator],
  pogruzchik: [n7Pogruzchik, s7Pogruzchik],
  avtokran: [n8Avtokran, s8Avtokran],
  greider: [n9Greider, s9Greider],
  'bashennyi-kran': [n10Kran, s10Kran],
};

// ---------------- 36: рядом с готовой постройкой, смотрит влево ----------------

function finished(objectId) {
  const o = objectsData.find((x) => x.id === objectId);
  const layers = [];
  if (o) for (const st of o.steps) if (st.layer && !layers.includes(st.layer)) layers.push(st.layer);
  return layers.map((l) => objectArt['object/' + objectId + '/layer/' + l]).filter(Boolean);
}

function postroika(machineId, objectId, seed) {
  return (g) => {
    const r = S.rng(seed);
    // горизонт высоко: небо — только верхняя четверть, остальное — постройка, машина и луг
    S.sky(g, '#5fc0ff', '#e6f7ff', 200);
    S.sun(g, 600, 40, 26);
    for (let i = 0; i < 3; i++) S.cloud(g, 20 + i * 200 + r() * 60, 20 + r() * 50, 0.45 + r() * 0.3);
    S.hills(g, 150, '#9bd77a', 12, seed % 7);
    S.ground(g, 170, '#8fcf6a', '#6fb24f');
    S.tufts(g, r, 170, 478, 30);
    for (let i = 0; i < 8; i++) S.stemFlower(g, r() * PW, 200 + r() * 270, 12 + r() * 10, ['#ff6fa0', '#ffd23f', '#ffffff', '#b58cff'][i % 4]);
    S.bush(g, 600, 230, 0.7); S.tree(g, 40, 215, 0.6);
    // постройка слева, крупно: слой 600×440, земля внутри слоя y=340 → на линии 455
    const k = 1.0;
    g.save(); g.translate(-40, 455 - 340 * k); g.scale(k, k);
    for (const L of finished(objectId)) { g.save(); L.draw(g, 600, 440); g.restore(); }
    g.restore();
    place(g, machineId, { facing: 'left', cx: 500, gy: 468, maxW: 260, maxH: 220 });
  };
}

export const art = {};
let seed36 = 31;
for (const id of Object.keys(P)) {
  art['puzzle/' + id + '/16'] = { w: PW, h: PH, draw: P[id][0] };
  art['puzzle/' + id + '/25'] = { w: PW, h: PH, draw: P[id][1] };
  const md = contentData.machines.find((m) => m.id === id);
  const obj = md && md.puzzles && md.puzzles[36] && md.puzzles[36].object;
  art['puzzle/' + id + '/36'] = { w: PW, h: PH, draw: postroika(id, obj, seed36++) };
}
