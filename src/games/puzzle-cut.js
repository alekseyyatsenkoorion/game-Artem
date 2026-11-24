// Нарезка пазла (spec.md, раздел 4 «Пазлы»): куски с фигурными краями — выступ или впадина на каждом
// внутреннем крае. Режет код по маске, без случайности: одна и та же сетка всегда режется одинаково.
// Выступ — круг, центр которого вынесен за край; впадина соседа — тот же круг. Поэтому куски
// стыкуются без щелей и наложений, а принадлежность точки куску считается точно (pieceContains).

export const TAB_R = 0.17;   // радиус выступа, доля меньшей стороны клетки
export const TAB_D = 0.12;   // насколько центр выступа вынесен за край

// Направление выступа на внутреннем крае: +1 — у куска слева/сверху выступ, −1 — впадина.
// Детерминированно от номера края, чтобы картинка была «настоящим пазлом», а не шахматкой.
function edgeSign(kind, a, b, n) {
  const h = ((a * 7 + b * 13 + n * 3 + (kind === 'v' ? 5 : 11)) * 2654435761) >>> 0;
  return (h >>> 7) & 1 ? 1 : -1;
}

// Режет картинку w×h на cols×rows кусков. Возвращает {cols, rows, w, h, cw, ch, r, d, pieces}.
// Кусок: {index, col, row, x, y, w, h, edges:{top, right, bottom, left}} — x, y, w, h — клетка без выступов;
// edges: 0 — ровный край картинки, +1 — выступ наружу, −1 — впадина.
export function cutPuzzle(cols, rows, w, h) {
  const cw = w / cols, ch = h / rows;
  const m = Math.min(cw, ch);
  const r = TAB_R * m, d = TAB_D * m;
  const n = cols * rows;
  const vert = []; // vert[row][c] — край между колонками c и c+1
  const hor = [];  // hor[row][c] — край между рядами row и row+1
  for (let y = 0; y < rows; y++) { vert.push([]); for (let x = 0; x < cols - 1; x++) vert[y].push(edgeSign('v', x, y, n)); }
  for (let y = 0; y < rows - 1; y++) { hor.push([]); for (let x = 0; x < cols; x++) hor[y].push(edgeSign('h', x, y, n)); }
  const pieces = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      pieces.push({
        index: y * cols + x, col: x, row: y,
        x: x * cw, y: y * ch, w: cw, h: ch,
        edges: {
          top: y === 0 ? 0 : -hor[y - 1][x],
          right: x === cols - 1 ? 0 : vert[y][x],
          bottom: y === rows - 1 ? 0 : hor[y][x],
          left: x === 0 ? 0 : -vert[y][x - 1],
        },
      });
    }
  }
  return { cols, rows, w, h, cw, ch, r, d, pieces };
}

// Насколько кусок выходит за свою клетку (для рамки рисования и раскладки).
export function pieceMargin(cut) { return cut.r + cut.d + 2; }

// Центры кругов выступов/впадин куска: [{x, y, sign}] в координатах картинки.
function knobs(cut, p) {
  const out = [];
  const mx = p.x + p.w / 2, my = p.y + p.h / 2;
  if (p.edges.top) out.push({ x: mx, y: p.y - p.edges.top * cut.d, sign: p.edges.top });
  if (p.edges.bottom) out.push({ x: mx, y: p.y + p.h + p.edges.bottom * cut.d, sign: p.edges.bottom });
  if (p.edges.left) out.push({ x: p.x - p.edges.left * cut.d, y: my, sign: p.edges.left });
  if (p.edges.right) out.push({ x: p.x + p.w + p.edges.right * cut.d, y: my, sign: p.edges.right });
  return out;
}

// Принадлежит ли точка (u, v) картинки куску p — точная маска куска.
export function pieceContains(cut, p, u, v) {
  const r2 = cut.r * cut.r;
  let inside = u >= p.x && u < p.x + p.w && v >= p.y && v < p.y + p.h;
  for (const k of knobs(cut, p)) {
    const dx = u - k.x, dy = v - k.y;
    if (dx * dx + dy * dy < r2) inside = k.sign > 0 ? true : false;
  }
  // выступ куска не может уйти дальше соседней клетки
  return inside && u >= 0 && v >= 0 && u < cut.w && v < cut.h;
}

// Чей кусок в точке картинки (u, v) — номер или −1.
export function pieceAt(cut, u, v) {
  for (const p of cut.pieces) if (pieceContains(cut, p, u, v)) return p.index;
  return -1;
}

// Путь контура куска на холсте: (ox, oy) — где на экране лежит левый верхний угол клетки, k — масштаб.
// cont = true — продолжить уже начатый путь (несколько кусков одним путём: одна обрезка на всех).
export function tracePiece(g, cut, p, ox, oy, k, cont) {
  const r = cut.r * k, d = cut.d * k;
  const t = Math.sqrt(Math.max(0, r * r - d * d)); // полуширина шейки
  const w = p.w * k, h = p.h * k;
  if (!cont) g.beginPath();
  g.moveTo(ox, oy);
  // каждая сторона: от точки (ax, ay) к (bx, by), направление (dx, dy), нормаль наружу (nx, ny)
  const side = (ax, ay, bx, by, nx, ny, sign) => {
    if (!sign) { g.lineTo(bx, by); return; }
    const len = Math.hypot(bx - ax, by - ay);
    const dx = (bx - ax) / len, dy = (by - ay) / len;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const cx = mx + nx * d * sign, cy = my + ny * d * sign;
    const sx = mx - dx * t, sy = my - dy * t;
    const ex = mx + dx * t, ey = my + dy * t;
    g.lineTo(sx, sy);
    const a0 = Math.atan2(sy - cy, sx - cx);
    const a1 = Math.atan2(ey - cy, ex - cx);
    const af = Math.atan2(ny * sign, nx * sign); // дальняя точка круга
    const TAU = Math.PI * 2;
    const norm = (a) => ((a % TAU) + TAU) % TAU;
    const cwSweep = norm(a1 - a0);
    const clockwise = norm(af - a0) < cwSweep;
    g.arc(cx, cy, r, a0, a1, !clockwise);
    g.lineTo(bx, by);
  };
  side(ox, oy, ox + w, oy, 0, -1, p.edges.top);
  side(ox + w, oy, ox + w, oy + h, 1, 0, p.edges.right);
  side(ox + w, oy + h, ox, oy + h, 0, 1, p.edges.bottom);
  side(ox, oy + h, ox, oy, -1, 0, p.edges.left);
  g.closePath();
}
