// Где на экране появится новая часть объекта: прямоугольник непрозрачных пикселей слоя текущего шага.
// Сцена стройки считает его один раз на слой (кэш) и отдаёт действию в env.box (экранные координаты):
//   {x, y, w, h, row} — row: y самой «заполненной» строки (по ней ведётся разметка).
// Нет пикселей (тесты в Node, картинка-заглушка) или прямоугольник крошечный — null: действие берёт общее место.
// Ничего не знает о конкретных объектах.
import { CROSS_ZONE } from '../../core/draw-utils.js';

const ALPHA_MIN = 40; // почти прозрачные края не считаются
const PROBE_STEP = 2; // проверяется каждый второй пиксель по x и y (хватает, быстро на старом iPad)

// Пиксели картинки {data, width, height} или null, если их не достать.
// Картинки слоёв — холсты загрузчика (AssetLoader рисует их один раз), пиксели берутся с их же контекста.
function readPixels(img) {
  if (!img || !img.getContext || !(img.width > 0) || !(img.height > 0)) return null;
  try {
    const g = img.getContext('2d');
    if (!g || typeof g.getImageData !== 'function') return null;
    const d = g.getImageData(0, 0, img.width, img.height);
    if (d && d.data && d.data.length >= img.width * img.height * 4) return { data: d.data, width: img.width, height: img.height };
  } catch (e) { /* пиксели недоступны — общее место */ }
  return null;
}

// Прямоугольник непрозрачных пикселей слоя в координатах слоя (layerW × layerH) или null.
export function opaqueBox(img, layerW, layerH) {
  const px = readPixels(img);
  if (!px) return null;
  const { data, width, height } = px;
  const st = width >= 2 * layerW ? PROBE_STEP * 2 : width >= layerW ? PROBE_STEP : 1;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  const rows = new Array(height).fill(0);
  for (let y = 0; y < height; y += st) {
    let i = y * width * 4 + 3;
    for (let x = 0; x < width; x += st, i += 4 * st) {
      if (data[i] > ALPHA_MIN) {
        rows[y]++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  let best = y0;
  for (let y = y0; y <= y1; y += st) if (rows[y] > rows[best]) best = y;
  const kx = layerW / width, ky = layerH / height;
  return { x: x0 * kx, y: y0 * ky, w: (x1 - x0 + st) * kx, h: (y1 - y0 + st) * ky, row: (best + st / 2) * ky };
}

// Прямоугольник слоя → экран (слой нарисован в origin в размере layerW × layerH). Маленький — null.
export function screenBox(box, origin) {
  if (!box || box.w < 16 || box.h < 6 || box.w * box.h < 300) return null;
  return {
    x: Math.round(origin.x + box.x), y: Math.round(origin.y + box.y),
    w: Math.round(box.w), h: Math.round(box.h), row: Math.round(origin.y + box.row),
  };
}

// Часть i из n прямоугольника: по ширине слева направо ('x') или рядами снизу вверх ('y').
export function partOf(b, i, n, axis = 'x') {
  n = Math.max(1, n | 0);
  if (axis === 'y') {
    const h = b.h / n;
    return { x: b.x, y: b.y + b.h - (i + 1) * h, w: b.w, h };
  }
  const w = b.w / n;
  return { x: b.x + i * w, y: b.y, w, h: b.h };
}

// Точка цели на экране и не у крестика (слева сверху): x, y в пределах, вне угла CROSS_ZONE с запасом.
export function safePoint(p, { minX = 110, maxX = 990, minY = 130, maxY = 720, pad = 90 } = {}) {
  let x = Math.round(Math.min(maxX, Math.max(minX, p.x)));
  let y = Math.round(Math.min(maxY, Math.max(minY, p.y)));
  if (x < CROSS_ZONE.x + CROSS_ZONE.w + pad && y < CROSS_ZONE.y + CROSS_ZONE.h + pad) y = CROSS_ZONE.y + CROSS_ZONE.h + pad;
  return { x, y };
}
