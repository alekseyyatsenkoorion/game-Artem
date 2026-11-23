// Общие помощники мини-игр (зона B): проверка описания машины, сетка «протирания» пальцем,
// финал сцены, мелкое рисование. Ничего про конкретную машину.
import { logError, dist } from '../core/draw-utils.js';
import contentData from '../data/index.js';

// Описание машины по id из данных (для static assets — из импорта данных, в сцене — из ctx.data).
export function machineFromData(data, id) {
  const list = (data && data.machines) || [];
  return list.find((m) => m && m.id === id) || null;
}

export function staticMachine(params) {
  return machineFromData(contentData, params && params.machine);
}

export function machineAssets(m, poses) {
  if (!m) return [];
  const out = poses.map((p) => 'machine/' + m.id + '/whole/' + p);
  return out;
}

export function partAssets(m) {
  if (!m || !Array.isArray(m.parts)) return [];
  return m.parts.map((p) => 'machine/' + m.id + '/part/' + p.id);
}

// Проверка обязательных полей. Возвращает машину или null (и пишет в журнал).
export function validMachine(ctx, id, scene, fields) {
  const m = machineFromData(ctx.data, id);
  const need = ['id', 'size', 'parts'].concat(fields || []);
  let bad = !m ? 'нет машины' : null;
  if (!bad) {
    for (const f of need) if (m[f] === undefined || m[f] === null) { bad = 'нет поля ' + f; break; }
  }
  if (!bad && (!Array.isArray(m.parts) || !m.parts.length)) bad = 'нет деталей';
  if (!bad && !(m.size.w > 0 && m.size.h > 0)) bad = 'нет размера';
  if (!bad) {
    for (const p of m.parts) {
      if (!p || typeof p.id !== 'string' || !(p.w > 0) || !(p.h > 0) || typeof p.x !== 'number' || typeof p.y !== 'number') { bad = 'неполная деталь'; break; }
    }
  }
  if (bad) {
    logError(scene, 'неполное описание машины', id, bad);
    return null;
  }
  return m;
}

// Есть ли картинка в реестре (если загрузчик умеет отвечать); иначе считаем, что есть.
export function hasImage(assets, id) {
  try { return typeof assets.has === 'function' ? !!assets.has(id) : true; } catch (e) { return true; }
}

// Фон сцены; если зона «Контент» его ещё не нарисовала — простое небо и земля.
export function drawBackground(g, assets, id, sky, ground) {
  if (hasImage(assets, id)) { g.drawImage(assets.image(id), 0, 0, 1024, 768); return; }
  g.fillStyle = sky || '#9ad8ff';
  g.fillRect(0, 0, 1024, 768);
  g.fillStyle = ground || '#8bc34a';
  g.fillRect(0, 560, 1024, 208);
}

// ---------- сетка «протирания» ----------

// Клетки по прямоугольникам деталей (в координатах экрана): центр клетки внутри хотя бы одной детали.
export function cellsForRects(rects, ox, oy, step) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
  }
  const cells = [];
  for (let y = minY + step / 2; y < maxY; y += step) {
    for (let x = minX + step / 2; x < maxX; x += step) {
      if (rects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)) cells.push({ x: ox + x, y: oy + y });
    }
  }
  return cells;
}

// Клетки в круге (cx, cy, r), ограниченные прямоугольниками (если они заданы).
export function cellsInCircle(cx, cy, r, step, rects) {
  const cells = [];
  for (let y = cy - r + step / 2; y < cy + r; y += step) {
    for (let x = cx - r + step / 2; x < cx + r; x += step) {
      if (dist(x, y, cx, cy) > r) continue;
      if (rects && !rects.some((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h)) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

// Набор клеток, которые палец «протирает». Площадь — доля протёртых клеток.
export class RubGrid {
  constructor(cells, brush) {
    this.cells = cells.map((c) => ({ x: c.x, y: c.y, done: false, ref: c }));
    this.onRub = null; // (исходная клетка) — когда клетку протёрли
    this.brush = brush;
    this.doneCount = 0;
    this.last = null;
  }

  // Палец в точке (x, y); если была предыдущая точка — протираем весь отрезок.
  rubTo(x, y) {
    let n = 0;
    if (this.last) {
      const d = dist(this.last.x, this.last.y, x, y);
      const steps = Math.max(1, Math.ceil(d / (this.brush / 3)));
      for (let i = 1; i <= steps; i++) {
        n += this.rubAt(this.last.x + (x - this.last.x) * i / steps, this.last.y + (y - this.last.y) * i / steps);
      }
    } else {
      n += this.rubAt(x, y);
    }
    this.last = { x, y };
    return n;
  }

  lift() { this.last = null; }

  rubAt(x, y) {
    let n = 0;
    const r2 = this.brush * this.brush;
    for (const c of this.cells) {
      if (c.done) continue;
      const dx = c.x - x, dy = c.y - y;
      if (dx * dx + dy * dy <= r2) { c.done = true; n++; if (this.onRub) this.onRub(c.ref); }
    }
    this.doneCount += n;
    return n;
  }

  fraction() { return this.cells.length ? this.doneCount / this.cells.length : 1; }

  completeAll() {
    for (const c of this.cells) { if (!c.done && this.onRub) this.onRub(c.ref); c.done = true; }
    this.doneCount = this.cells.length;
  }

  remaining() { return this.cells.filter((c) => !c.done); }

  // Центр оставшихся клеток и их охват — для руки-подсказки и подсветки.
  remainingBox() {
    const rest = this.remaining();
    if (!rest.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of rest) { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
}

// Круги по клеткам одним путём: дёшево, без getImageData.
export function fillCells(g, cells, r, color, pred) {
  g.fillStyle = color;
  g.beginPath();
  let any = false;
  for (const c of cells) {
    if (pred && !pred(c)) continue;
    g.moveTo(c.x + r, c.y);
    g.arc(c.x, c.y, r, 0, Math.PI * 2);
    any = true;
  }
  if (any) g.fill();
}

// Блёстки вокруг прямоугольника (финал).
export function drawSparkles(g, x, y, w, h, t) {
  g.save();
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 10; i++) {
    const k = (Math.sin(t * 3 + i * 1.7) + 1) / 2;
    const px = x + ((i * 97) % 100) / 100 * w;
    const py = y + ((i * 61) % 100) / 100 * h;
    const s = 6 + k * 14;
    g.globalAlpha = 0.4 + 0.6 * k;
    g.beginPath();
    g.moveTo(px, py - s); g.lineTo(px + s * 0.25, py - s * 0.25); g.lineTo(px + s, py);
    g.lineTo(px + s * 0.25, py + s * 0.25); g.lineTo(px, py + s); g.lineTo(px - s * 0.25, py + s * 0.25);
    g.lineTo(px - s, py); g.lineTo(px - s * 0.25, py - s * 0.25); g.closePath(); g.fill();
  }
  g.restore();
}

// Финал: похвала и фраза, через minWait..maxWait секунд — finish(result). canExit false не дольше 2 с.
export class Finale {
  constructor(ctx, result, { phrase, minWait = 2.2, maxWait = 6 } = {}) {
    this.ctx = ctx;
    this.result = result;
    this.t = 0;
    this.minWait = minWait;
    this.maxWait = maxWait;
    this.voiceDone = false;
    this.finished = false;
    const p = phrase ? ctx.audio.say(phrase) : Promise.resolve();
    const q = ctx.audio.praise();
    Promise.all([p, q]).then(() => { this.voiceDone = true; });
  }

  update(dt) {
    this.t += dt;
    if (this.finished) return;
    if (this.t >= this.minWait && (this.voiceDone || this.t >= this.maxWait)) {
      this.finished = true;
      this.ctx.scenes.finish(this.result);
    }
  }

  canExit() { return this.t >= 1.8; }
}

// Безопасная остановка звука.
export function stopSound(h) {
  try { if (h && h.stop) h.stop(); } catch (e) { /* ничего */ }
  return null;
}
