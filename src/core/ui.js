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

export const UI_ART = {
  'ui/cross': { w: 80, h: 80, draw: drawCrossIcon },
  'ui/hand': { w: 110, h: 130, draw: drawHandIcon },
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

// Подсказки по простою: через 5 с — рука, через 10 с — голос, дальше голос раз в 15 с.
export class IdleHint {
  constructor({ handAfter = 5, voiceAfter = 10, voiceEvery = 15 } = {}) {
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
