// Мелкие помощники для рисования и анимации. Без состояния.

export const SCREEN = { width: 1024, height: 768 };

// Зона крестика: сцены здесь ничего не рисуют (contracts.md, раздел 1).
export const CROSS_ZONE = { x: 0, y: 0, w: 96, h: 96 };

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function easeOut(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t) * (1 - t); }
export function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

export function inRect(x, y, r, pad = 0) {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

// Рисует готовую картинку из AssetLoader в логическом размере.
export function drawAsset(g, assets, id, x, y, scale = 1) {
  const s = assets.size(id);
  g.drawImage(assets.image(id), x, y, s.w * scale, s.h * scale);
}

// Детерминированное перемешивание через ctx.random.
export function shuffle(list, random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

export function logError(module, ...args) {
  try { console.error('[' + module + ']', ...args); } catch (e) { /* ничего */ }
}
