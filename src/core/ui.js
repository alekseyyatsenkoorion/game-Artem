// Рисование ядра: крестик, экран ожидания, рука-подсказка, «поверни планшет».
// И общий помощник подсказок по простою (spec.md, раздел 5: 5 с — рука, 10 с — голос).
import { roundRect, CROSS_ZONE, easeInOut, lerp } from './draw-utils.js';

function drawCrossIcon(g, w, h) {
  const cx = w / 2, cy = h / 2, r = w / 2 - 6;
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath(); g.arc(cx + 2, cy + 3, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e0453a'; g.lineWidth = 6;
  g.beginPath(); g.arc(cx, cy, r - 3, 0, Math.PI * 2); g.stroke();
  g.lineCap = 'round'; g.lineWidth = 9;
  const k = r * 0.42;
  g.beginPath(); g.moveTo(cx - k, cy - k); g.lineTo(cx + k, cy + k); g.moveTo(cx + k, cy - k); g.lineTo(cx - k, cy + k); g.stroke();
}

function drawHandIcon(g, w, h) {
  // Мультяшная рука с указательным пальцем; кончик пальца — в точке (w*0.35, 4).
  g.save();
  g.lineJoin = 'round';
  g.fillStyle = '#ffd9b3';
  g.strokeStyle = '#8a5a3c';
  g.lineWidth = 4;
  const fx = w * 0.35;
  g.beginPath();
  g.moveTo(fx - 11, 18);
  g.quadraticCurveTo(fx - 11, 4, fx, 4);
  g.quadraticCurveTo(fx + 11, 4, fx + 11, 18);
  g.lineTo(fx + 11, 52);
  g.quadraticCurveTo(fx + 22, 44, fx + 30, 52);
  g.quadraticCurveTo(fx + 40, 48, fx + 46, 58);
  g.quadraticCurveTo(fx + 56, 56, fx + 58, 68);
  g.lineTo(fx + 56, 98);
  g.quadraticCurveTo(fx + 50, h - 6, fx + 18, h - 6);
  g.lineTo(fx - 6, h - 6);
  g.quadraticCurveTo(fx - 30, h - 10, fx - 34, 96);
  g.lineTo(fx - 40, 72);
  g.quadraticCurveTo(fx - 42, 60, fx - 30, 62);
  g.lineTo(fx - 11, 78);
  g.closePath();
  g.fill(); g.stroke();
  g.restore();
}


// ---------- значки гаража (ui/icon-…): круглая плашка с картинкой, без надписей ----------

function badge(g, w, h, color) {
  const cx = w / 2, cy = h / 2, r = w / 2 - 6;
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.beginPath(); g.arc(cx + 2, cy + 4, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 6;
  g.beginPath(); g.arc(cx, cy, r - 3, 0, Math.PI * 2); g.stroke();
}

function drawGear(g, cx, cy, r, color) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = i % 2 ? r * 0.78 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
  g.fillStyle = '#3b7dd8';
  g.beginPath(); g.arc(cx, cy, r * 0.32, 0, Math.PI * 2); g.fill();
}

function drawWrench(g, x1, y1, x2, y2, color, jaw) {
  g.strokeStyle = color; g.lineCap = 'round'; g.lineWidth = 16;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.fillStyle = color;
  g.beginPath(); g.arc(x2, y2, 17, 0, Math.PI * 2); g.fill();
  g.save();
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.translate(x2, y2); g.rotate(a);
  g.fillStyle = jaw; g.fillRect(4, -7, 20, 14);
  g.restore();
}

function drawIconAssembly(g, w, h) {
  badge(g, w, h, '#3b7dd8');
  drawGear(g, w * 0.4, h * 0.42, 28, '#ffd34d');
  drawGear(g, w * 0.64, h * 0.64, 20, '#ffffff');
}

function puzzleGrid(g, w, h, n, color) {
  badge(g, w, h, color);
  const s = w * 0.5, x0 = (w - s) / 2, y0 = (h - s) / 2, c = s / n;
  const colors = ['#ffd34d', '#ff8a3d', '#7ed957', '#5cc8ff'];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      g.fillStyle = colors[(i + j) % colors.length];
      g.fillRect(x0 + i * c + 1.5, y0 + j * c + 1.5, c - 3, c - 3);
    }
  }
}
function drawIconPuzzle16(g, w, h) { puzzleGrid(g, w, h, 4, '#8b5cf6'); }
function drawIconPuzzle25(g, w, h) { puzzleGrid(g, w, h, 5, '#d0459a'); }
function drawIconPuzzle36(g, w, h) { puzzleGrid(g, w, h, 6, '#e0782a'); }

function drawIconWash(g, w, h) {
  badge(g, w, h, '#25a7e0');
  g.fillStyle = '#ffffff';
  const b = [[0.38, 0.4, 17], [0.62, 0.36, 12], [0.56, 0.6, 20], [0.36, 0.66, 10]];
  for (const [x, y, r] of b) {
    g.beginPath(); g.arc(w * x, h * y, r, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(37,167,224,0.5)';
  for (const [x, y, r] of b) { g.beginPath(); g.arc(w * x + r * 0.3, h * y - r * 0.3, r * 0.3, 0, Math.PI * 2); g.fill(); }
}

function drawIconRepair(g, w, h) {
  badge(g, w, h, '#f08a24');
  drawWrench(g, w * 0.3, h * 0.72, w * 0.62, h * 0.38, '#ffffff', '#f08a24');
}

function drawIconFuel(g, w, h) {
  badge(g, w, h, '#2fa84f');
  // колонка
  g.fillStyle = '#ffffff';
  roundRect(g, w * 0.3, h * 0.28, w * 0.28, h * 0.46, 6); g.fill();
  g.fillStyle = '#2fa84f';
  g.fillRect(w * 0.34, h * 0.33, w * 0.2, h * 0.12);
  // шланг и пистолет
  g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(w * 0.58, h * 0.4); g.quadraticCurveTo(w * 0.76, h * 0.42, w * 0.72, h * 0.62); g.stroke();
  g.fillStyle = '#ffd34d';
  g.beginPath(); g.arc(w * 0.72, h * 0.66, 7, 0, Math.PI * 2); g.fill();
}

function drawLockIcon(g, w, h) {
  g.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(g, w * 0.2 + 2, h * 0.45 + 3, w * 0.6, h * 0.45, 8); g.fill();
  g.strokeStyle = '#c9ced8'; g.lineWidth = 9;
  g.beginPath(); g.arc(w / 2, h * 0.45, w * 0.2, Math.PI, 0); g.stroke();
  g.fillStyle = '#ffc21a';
  roundRect(g, w * 0.2, h * 0.45, w * 0.6, h * 0.45, 8); g.fill();
  g.fillStyle = '#7a5a00';
  g.beginPath(); g.arc(w / 2, h * 0.63, 6, 0, Math.PI * 2); g.fill();
  g.fillRect(w / 2 - 3, h * 0.63, 6, 12);
}

export const UI_ART = {
  'ui/cross': { w: 80, h: 80, draw: drawCrossIcon },
  'ui/hand': { w: 110, h: 130, draw: drawHandIcon },
  'ui/icon-assembly': { w: 120, h: 120, draw: drawIconAssembly },
  'ui/icon-puzzle16': { w: 120, h: 120, draw: drawIconPuzzle16 },
  'ui/icon-puzzle25': { w: 120, h: 120, draw: drawIconPuzzle25 },
  'ui/icon-puzzle36': { w: 120, h: 120, draw: drawIconPuzzle36 },
  'ui/icon-wash': { w: 120, h: 120, draw: drawIconWash },
  'ui/icon-repair': { w: 120, h: 120, draw: drawIconRepair },
  'ui/icon-fuel': { w: 120, h: 120, draw: drawIconFuel },
  'ui/lock': { w: 80, h: 80, draw: drawLockIcon },
};

export class CoreUI {
  constructor({ assets }) {
    this.assets = assets;
    this.t = 0;
  }

  tick(dt) { this.t += dt; }

  drawCross(g, pressed) {
    const s = pressed ? 0.9 : 1;
    const w = 80 * s;
    g.drawImage(this.assets.image('ui/cross'), CROSS_ZONE.x + 8 + (80 - w) / 2, CROSS_ZONE.y + 8 + (80 - w) / 2, w, w);
  }

  drawLoading(g) {
    g.fillStyle = '#8fd3ff';
    g.fillRect(0, 0, 1024, 768);
    // крутящееся колесо
    g.save();
    g.translate(512, 384);
    g.rotate(this.t * 4);
    g.fillStyle = '#333';
    g.beginPath(); g.arc(0, 0, 60, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#bbb';
    g.beginPath(); g.arc(0, 0, 28, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#555';
    for (let i = 0; i < 5; i++) { g.rotate(Math.PI * 2 / 5); g.beginPath(); g.arc(0, 18, 6, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }

  drawHand(g, x1, y1, x2, y2, phase) { drawHand(g, this.assets, x1, y1, x2, y2, phase); }
  drawGlow(g, x, y, r, t) { drawGlow(g, x, y, r, t); }

  // Повернуть планшет: рисуется поверх, если экран стоит вертикально.
  drawRotate(g, w, h) {
    g.fillStyle = '#20314a';
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    const k = Math.min(w, h) / 600;
    g.scale(k, k);
    const a = (Math.sin(this.t * 2) + 1) / 2 * (Math.PI / 2);
    g.rotate(-a);
    g.fillStyle = '#e8eef7';
    roundRect(g, -90, -130, 180, 260, 20); g.fill();
    g.fillStyle = '#6ab0ff';
    roundRect(g, -76, -112, 152, 224, 8); g.fill();
    g.restore();
  }

  // Индикатор родительского жеста: дуги в углах.
  drawGestureProgress(g, p) {
    if (p <= 0) return;
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 8;
    for (const x of [60, 964]) {
      g.beginPath(); g.arc(x, 60, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); g.stroke();
    }
    g.restore();
  }
}

// Подсказки по простою (просьба Alex 24.11): только если 30 с на экране ничего не делают —
// рука и голос, дальше раз в 30 с. Любое касание сбрасывает счёт.
export const HINT = { hand: 30, voice: 30, every: 30 }; // секунды
export class IdleHint {
  constructor({ handAfter = HINT.hand, voiceAfter = HINT.voice, voiceEvery = HINT.every } = {}) {
    this.handAfter = handAfter;
    this.voiceAfter = voiceAfter;
    this.voiceEvery = voiceEvery;
    this.idle = 0;
    this.nextVoice = voiceAfter;
  }

  reset() { this.idle = 0; this.nextVoice = this.voiceAfter; }

  // Возвращает true, если пора сказать задание голосом.
  update(dt) {
    this.idle += dt;
    if (this.idle >= this.nextVoice) {
      this.nextVoice += this.voiceEvery;
      return true;
    }
    return false;
  }

  showHand() { return this.idle >= this.handAfter; }
  handPhase() { return ((this.idle - this.handAfter) % 1.6) / 1.6; }
}

// Для сцен: рука-подсказка и подсветка.
// Рука показывает движение от (x1, y1) к (x2, y2); фаза 0..1. Если точки совпадают — тык.
export function drawHand(g, assets, x1, y1, x2, y2, phase) {
  const img = assets.image('ui/hand');
  const tap = Math.abs(x1 - x2) + Math.abs(y1 - y2) < 4;
  let x, y, alpha = 1, press = 0;
  if (tap) {
    x = x1; y = y1;
    press = Math.sin(phase * Math.PI * 2) > 0.3 ? 1 : 0;
  } else {
    const k = easeInOut(Math.min(1, Math.max(0, (phase - 0.15) / 0.65)));
    x = lerp(x1, x2, k); y = lerp(y1, y2, k);
    if (phase < 0.1) alpha = phase / 0.1;
    if (phase > 0.85) alpha = Math.max(0, (1 - phase) / 0.15);
  }
  g.save();
  g.globalAlpha = alpha;
  if (press) {
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill();
  }
  g.drawImage(img, x - 110 * 0.35, y - 4 + press * 6, 110, 130);
  g.restore();
}

// Подсветка нужного предмета: мягкое пульсирующее кольцо.
export function drawGlow(g, x, y, r, t) {
  const a = 0.35 + 0.25 * Math.sin(t * 5);
  g.save();
  g.strokeStyle = 'rgba(255, 236, 80,' + a.toFixed(3) + ')';
  g.lineWidth = 14;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.restore();
}


// Подсветка прямоугольного предмета: пульсирующая рамка со скруглёнными углами.
export function drawGlowRect(g, cx, cy, w, h, t) {
  const a = 0.45 + 0.3 * Math.sin(t * 5);
  const pad = 12 + 4 * Math.sin(t * 5);
  g.save();
  g.strokeStyle = 'rgba(255, 240, 90,' + a.toFixed(3) + ')';
  g.lineWidth = 10;
  roundRect(g, cx - w / 2 - pad, cy - h / 2 - pad, w + pad * 2, h + pad * 2, 18);
  g.stroke();
  g.restore();
}
