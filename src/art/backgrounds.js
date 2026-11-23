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

export const art = {
  'bg/home': { w: W, h: H, draw: drawHome },
  'bg/assembly': { w: W, h: H, draw: drawAssembly },
  'bg/locked': { w: W, h: H, draw: drawLocked },
};
