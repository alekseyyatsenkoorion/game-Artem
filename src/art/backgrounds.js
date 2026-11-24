// Фоны сцен, нарисованные кодом. Если в assets/gpt/ появится картинка из ChatGPT, загрузчик возьмёт её.
import { roundRect } from '../core/draw-utils.js';

const W = 1024, H = 768;

function sky(g, top, bottom, h = H) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, W, h);
}

function cloud(g, x, y, s) {
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.arc(x, y, 28 * s, 0, Math.PI * 2);
  g.arc(x + 32 * s, y - 14 * s, 34 * s, 0, Math.PI * 2);
  g.arc(x + 68 * s, y, 26 * s, 0, Math.PI * 2);
  g.rect(x, y, 68 * s, 26 * s);
  g.fill();
}

function hills(g, y, color, amp, seed) {
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, y - Math.sin(x / 140 + seed) * amp - Math.sin(x / 61 + seed * 2) * amp * 0.3);
  g.lineTo(W, H); g.closePath(); g.fill();
}

function drawHome(g) {
  sky(g, '#6cc4ff', '#d7f1ff', 520);
  g.fillStyle = '#fff3a0';
  g.beginPath(); g.arc(880, 110, 56, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,243,160,0.35)';
  g.beginPath(); g.arc(880, 110, 80, 0, Math.PI * 2); g.fill();
  cloud(g, 160, 120, 1.1); cloud(g, 520, 80, 0.8); cloud(g, 700, 190, 0.7);
  hills(g, 430, '#9bd77a', 30, 1);
  hills(g, 480, '#74c25a', 22, 3);
  // площадка и дорога
  g.fillStyle = '#d9b77c'; g.fillRect(0, 560, W, 208);
  g.fillStyle = '#7b7f87'; g.fillRect(0, 610, W, 90);
  g.fillStyle = '#f4f4f4';
  for (let x = 20; x < W; x += 110) g.fillRect(x, 650, 60, 10);
  // конусы
  for (const x of [90, 940]) {
    g.fillStyle = '#ff7a1a';
    g.beginPath(); g.moveTo(x - 22, 600); g.lineTo(x, 540); g.lineTo(x + 22, 600); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.fillRect(x - 12, 566, 24, 8);
  }
}

function drawAssembly(g) {
  sky(g, '#8fd6ff', '#e4f6ff', 500);
  cloud(g, 640, 90, 0.8); cloud(g, 860, 150, 0.6);
  hills(g, 420, '#a9dd8a', 18, 2);
  // пол мастерской под машиной
  g.fillStyle = '#e8d3a8'; g.fillRect(0, 440, W, 80);
  g.fillStyle = '#d2b886'; g.fillRect(0, 440, W, 6);
  // верстак для деталей
  g.fillStyle = '#c98a4b'; g.fillRect(0, 492, W, 276);
  g.strokeStyle = '#a86d35'; g.lineWidth = 3;
  for (let y = 530; y < H; y += 46) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let i = 0; i < 9; i++) {
    const y = 530 + (i % 5) * 46;
    const x = (i * 173) % W;
    g.beginPath(); g.moveTo(x, y - 46); g.lineTo(x, y); g.stroke();
  }
  g.fillStyle = '#8f5a2a'; g.fillRect(0, 492, W, 10);
}

function drawLocked(g) {
  sky(g, '#0d1a3a', '#24406e', H);
  // звёзды
  g.fillStyle = '#fff8d0';
  let s = 7;
  for (let i = 0; i < 60; i++) {
    s = (s * 9301 + 49297) % 233280;
    const x = (s / 233280) * W;
    s = (s * 9301 + 49297) % 233280;
    const y = (s / 233280) * 380;
    g.beginPath(); g.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2); g.fill();
  }
  // луна
  g.fillStyle = '#fff3b0';
  g.beginPath(); g.arc(840, 130, 64, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0f1d40';
  g.beginPath(); g.arc(868, 112, 58, 0, Math.PI * 2); g.fill();
  // гараж
  g.fillStyle = '#3a4a6a'; g.fillRect(0, 600, W, 168);
  g.fillStyle = '#5a6f99';
  roundRect(g, 220, 300, 584, 310, 12); g.fill();
  g.fillStyle = '#2c3954';
  g.beginPath(); g.moveTo(190, 310); g.lineTo(512, 190); g.lineTo(834, 310); g.closePath(); g.fill();
  g.fillStyle = '#1b2438'; g.fillRect(270, 360, 484, 250);
}


// ---------- фоны этапа 2 ----------
// Левый верхний угол 96×96 — спокойный (там крестик). Центр — без мелочей: там игровые предметы.

function tileWall(g, x0, y0, x1, y1, size, c1, c2, grout) {
  g.fillStyle = grout; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let y = y0, r = 0; y < y1; y += size, r++) for (let x = x0, c = 0; x < x1; x += size, c++) {
    g.fillStyle = (r + c) % 2 ? c1 : c2;
    g.fillRect(x + 2, y + 2, size - 4, size - 4);
  }
}

function wrench(g, x, y, a, s, color = '#9aa0aa') {
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  g.fillStyle = color; g.strokeStyle = '#2a2230'; g.lineWidth = 3;
  roundRect(g, -6, 0, 12, 70, 5); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 0, 14, 0.5, Math.PI * 2 - 0.5 + Math.PI * 0, false); g.lineTo(0, 0); g.closePath(); g.fill(); g.stroke();
  g.restore();
}

function hammer(g, x, y, a, s) {
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  g.fillStyle = '#c98a4b'; g.strokeStyle = '#2a2230'; g.lineWidth = 3;
  roundRect(g, -5, 0, 10, 70, 4); g.fill(); g.stroke();
  g.fillStyle = '#5a5f6b'; roundRect(g, -20, -10, 40, 18, 4); g.fill(); g.stroke();
  g.restore();
}

function drawGarage(g) {
  // задняя стена
  g.fillStyle = '#cfe6f5'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#bcd9ee';
  for (let x = 0; x < W; x += 64) g.fillRect(x, 0, 4, H);
  // окна под потолком (не в углу крестика)
  for (const x of [260, 460, 660, 860]) {
    g.fillStyle = '#8fb3cc'; roundRect(g, x - 6, 30, 112, 70, 10); g.fill();
    g.fillStyle = '#e8f7ff'; roundRect(g, x, 36, 100, 58, 8); g.fill();
    g.fillStyle = '#8fb3cc'; g.fillRect(x + 48, 36, 4, 58);
  }
  // лампы
  g.fillStyle = '#fff3b0';
  for (const x of [160, 512, 864]) { g.beginPath(); g.ellipse(x, 120, 50, 10, 0, 0, Math.PI * 2); g.fill(); }
  // два ряда мест по 5 (места гаража: верх 152..402, низ 426..676)
  const x0 = 28, sw = 184, gap = 12;
  for (const [top, floor] of [[152, 368], [426, 642]]) {
    // пол ряда
    g.fillStyle = '#9aa5b1'; g.fillRect(0, floor, W, 34);
    g.fillStyle = '#87929e'; g.fillRect(0, floor, W, 5);
    for (let i = 0; i < 5; i++) {
      const x = x0 + i * (sw + gap);
      // ниша-бокс
      g.fillStyle = 'rgba(255,255,255,0.35)';
      roundRect(g, x, top + 30, sw, floor - top - 30, 14); g.fill();
      // жёлтая разметка между местами
      g.fillStyle = '#ffcf3a';
      g.fillRect(x - gap / 2 - 3, floor + 8, 6, 26);
      g.fillRect(x + 20, floor + 18, sw - 40, 6);
    }
    g.fillStyle = '#ffcf3a'; g.fillRect(x0 + 5 * (sw + gap) - gap / 2 - 3, floor + 8, 6, 26);
  }
  // нижняя полоса пола
  g.fillStyle = '#8a95a1'; g.fillRect(0, 676, W, 92);
  g.fillStyle = '#ffcf3a';
  for (let x = 20; x < W; x += 120) g.fillRect(x, 716, 70, 10);
  // инструменты по краям нижнего ряда пола
  wrench(g, 980, 700, 0.6, 0.7); hammer(g, 940, 690, -0.5, 0.8);
}

function drawPuzzle(g) {
  // спокойный деревянный стол
  g.fillStyle = '#e8c79a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#dcb886'; g.lineWidth = 3;
  for (let y = 40; y < H; y += 64) {
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x / 90 + y) * 4);
    g.stroke();
  }
  g.fillStyle = '#d9b07a';
  for (let y = 0; y < H; y += 128) g.fillRect(0, y, W, 3);
  // мягкая тень под полем пазла
  g.fillStyle = 'rgba(120, 80, 40, 0.12)';
  roundRect(g, 200, 150, 624, 474, 22); g.fill();
}

function drawWash(g) {
  // плитка
  tileWall(g, 0, 0, W, 560, 64, '#bfe4ff', '#d6efff', '#a9d2ef');
  // трубы и душ сверху
  g.fillStyle = '#5a6b80'; g.fillRect(140, 40, 760, 18);
  for (const x of [300, 512, 724]) {
    g.fillRect(x - 6, 58, 12, 30);
    g.fillStyle = '#7f90a6'; roundRect(g, x - 30, 84, 60, 18, 8); g.fill(); g.fillStyle = '#5a6b80';
  }
  // шланги на стенах
  for (const [x, flip] of [[60, 1], [964, -1]]) {
    g.fillStyle = '#7f90a6'; roundRect(g, x - 18, 180, 36, 30, 6); g.fill();
    g.strokeStyle = '#2f9e52'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, 200); g.bezierCurveTo(x + 60 * flip, 260, x - 40 * flip, 330, x + 10 * flip, 400);
    g.bezierCurveTo(x + 40 * flip, 440, x - 10 * flip, 470, x, 500); g.stroke();
    g.fillStyle = '#ffcf3a'; roundRect(g, x - 10, 490, 20, 40, 6); g.fill();
  }
  // пол с лужицами и решёткой слива
  g.fillStyle = '#9fb4c7'; g.fillRect(0, 560, W, 208);
  g.fillStyle = '#8aa1b6'; g.fillRect(0, 560, W, 8);
  g.fillStyle = 'rgba(160, 215, 255, 0.7)';
  for (const [x, y, w] of [[150, 640, 90], [820, 700, 110], [470, 730, 70]]) { g.beginPath(); g.ellipse(x, y, w, 14, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#5a6b80'; roundRect(g, 432, 680, 160, 26, 6); g.fill();
  g.fillStyle = '#9fb4c7'; for (let x = 444; x < 590; x += 18) g.fillRect(x, 686, 8, 14);
  // пузырьки
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
  for (const [x, y, r] of [[200, 500, 14], [230, 470, 9], [840, 490, 12], [870, 520, 8], [180, 420, 7]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
}

function drawRepair(g) {
  // стена мастерской
  g.fillStyle = '#f3d9b5'; g.fillRect(0, 0, W, 560);
  g.fillStyle = '#ecc996'; g.fillRect(0, 470, W, 90);
  // доска с инструментами (справа от зоны крестика, не над насосом справа)
  g.fillStyle = '#c98a4b'; roundRect(g, 150, 40, 560, 180, 12); g.fill();
  g.fillStyle = '#b5773c';
  for (let x = 170; x < 700; x += 26) for (let y = 60; y < 210; y += 26) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
  wrench(g, 210, 70, 0, 1); wrench(g, 270, 70, 0, 0.85, '#c9ccd2'); wrench(g, 320, 70, 0, 0.7);
  hammer(g, 400, 80, 0, 1.1);
  // отвёртки
  for (const [x, c] of [[470, '#e8412c'], [510, '#2f7de1'], [550, '#ffc21a']]) {
    g.fillStyle = c; roundRect(g, x - 9, 70, 18, 50, 6); g.fill();
    g.fillStyle = '#9aa0aa'; g.fillRect(x - 3, 120, 6, 60);
  }
  // пила
  g.fillStyle = '#c9ccd2'; g.beginPath(); g.moveTo(600, 80); g.lineTo(690, 80); g.lineTo(690, 110); g.lineTo(600, 130); g.closePath(); g.fill();
  g.fillStyle = '#e8412c'; roundRect(g, 588, 74, 24, 50, 6); g.fill();
  // полка со стопкой шин слева
  for (let i = 0; i < 3; i++) {
    g.fillStyle = '#26262b'; g.beginPath(); g.ellipse(70, 548 - i * 30, 56, 16, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a4a52'; g.beginPath(); g.ellipse(70, 544 - i * 30, 26, 7, 0, 0, Math.PI * 2); g.fill();
  }
  // пол
  g.fillStyle = '#9aa5b1'; g.fillRect(0, 560, W, 208);
  g.fillStyle = '#87929e'; g.fillRect(0, 560, W, 6);
  g.fillStyle = '#ffcf3a';
  for (let x = 30; x < W; x += 140) g.fillRect(x, 740, 80, 10);
  g.fillStyle = 'rgba(60,60,70,0.18)'; g.beginPath(); g.ellipse(300, 700, 60, 10, 0, 0, Math.PI * 2); g.fill();
}

function drawFuel(g) {
  sky(g, '#8fd6ff', '#e4f6ff', 520);
  cloud(g, 560, 120, 0.8); cloud(g, 820, 80, 0.6);
  hills(g, 470, '#a9dd8a', 18, 4);
  // навес заправки
  g.fillStyle = '#e8412c'; roundRect(g, 120, 150, 860, 46, 10); g.fill();
  g.fillStyle = '#ffffff'; g.fillRect(120, 184, 860, 8);
  g.fillStyle = '#c9ccd2';
  for (const x of [150, 940]) { g.fillRect(x - 12, 196, 24, 380); }
  g.fillStyle = '#fff3b0';
  for (const x of [300, 520, 740]) { g.beginPath(); g.ellipse(x, 198, 40, 6, 0, 0, Math.PI * 2); g.fill(); }
  // заправочная площадка
  g.fillStyle = '#b8bec7'; g.fillRect(0, 560, W, 208);
  g.fillStyle = '#a3aab4'; g.fillRect(0, 560, W, 6);
  g.strokeStyle = '#a3aab4'; g.lineWidth = 3;
  for (let x = 0; x < W; x += 128) { g.beginPath(); g.moveTo(x, 566); g.lineTo(x - 60, H); g.stroke(); }
  // островок под колонку слева
  g.fillStyle = '#7b7f87'; roundRect(g, 60, 640, 240, 30, 8); g.fill();
  g.fillStyle = '#ffcf3a';
  for (let x = 70; x < 290; x += 40) g.fillRect(x, 646, 20, 18);
  g.fillStyle = '#ffffff';
  for (let x = 380; x < W; x += 130) g.fillRect(x, 720, 70, 10);
}

export const art = {
  'bg/home': { w: W, h: H, draw: drawHome },
  'bg/assembly': { w: W, h: H, draw: drawAssembly },
  'bg/locked': { w: W, h: H, draw: drawLocked },
  'bg/garage': { w: W, h: H, draw: drawGarage },
  'bg/puzzle': { w: W, h: H, draw: drawPuzzle },
  'bg/wash': { w: W, h: H, draw: drawWash },
  'bg/repair': { w: W, h: H, draw: drawRepair },
  'bg/fuel': { w: W, h: H, draw: drawFuel },
};
