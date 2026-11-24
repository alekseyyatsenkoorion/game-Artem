// Забор: полоса → ямки → привезли столбы и доски → столбы → бетон → доски → покраска (+ цветы).
import { C, G, pad, plank, nails, concrete, boardPile, flowers, bush, box, shape, rect, makeLayers, OUTLINE } from './common.js';

const POSTS = [80, 220, 380, 520];
const HOLE_W = 40, HOLE_D = 52, POST_W = 24, POST_TOP = 196;
const RAILS = [232, 282];

function post(g, x, fill, topY = POST_TOP, bottom = G + HOLE_D - 4) {
  shape(g, fill, (q) => {
    q.moveTo(x - POST_W / 2, bottom); q.lineTo(x - POST_W / 2, topY + 10); q.lineTo(x, topY - 4); q.lineTo(x + POST_W / 2, topY + 10); q.lineTo(x + POST_W / 2, bottom); q.closePath();
  }, 4);
}

function rails(g, colors) {
  let i = 0;
  for (const y of RAILS) for (let p = 0; p < 3; p++) {
    const x0 = POSTS[p] - 18, x1 = POSTS[p + 1] + 18;
    plank(g, x0, y, x1 - x0, 26, colors[i++ % colors.length]);
  }
}

export const art = makeLayers('zabor', {
  polosa(g) { pad(g, 30, 570); },
  yamki(g) {
    for (const x of POSTS) {
      box(g, x - HOLE_W / 2, G - 2, HOLE_W, HOLE_D, 6, C.dirtDark, 4);
      g.fillStyle = C.dirt; g.beginPath(); g.arc(x - 6, G + HOLE_D - 12, 8, 0, Math.PI * 2); g.arc(x + 8, G + HOLE_D - 10, 6, 0, Math.PI * 2); g.fill();
    }
  },
  material(g) {
    // доски и столбы аккуратно лежат на земле между ямками (низкая стопка — потом её закроют цветы)
    boardPile(g, 120, G - 4, 86, 3);
    boardPile(g, 268, G - 4, 92, 2);
    boardPile(g, 420, G - 4, 80, 3);
  },
  stolby(g) { for (const x of POSTS) post(g, x, C.wood); },
  beton(g) {
    for (const x of POSTS) concrete(g, x - HOLE_W / 2, G - 6, HOLE_W, HOLE_D + 4);
    for (const x of POSTS) box(g, x - POST_W / 2 - 2, G - 10, POST_W + 4, 8, 3, C.concreteDark, 3);
  },
  doski(g) {
    rails(g, [C.wood, C.woodLight]);
    for (const y of RAILS) nails(g, POSTS.map((x) => [x, y + 13]));
  },
  kraska(g) {
    for (const x of POSTS) post(g, x, '#2f7de1', POST_TOP, G - 10);
    rails(g, ['#e8412c', '#ffc21a', '#43b649', '#ffc21a', '#43b649', '#e8412c']);
    for (const y of RAILS) nails(g, POSTS.map((x) => [x, y + 13]));
    // цветы и кустики вдоль забора
    bush(g, 160, G - 2, 90, 40); bush(g, 440, G - 2, 100, 42);
    flowers(g, 228, 372, G - 2, 4); flowers(g, 40, 112, G - 2, 6); flowers(g, 500, 580, G - 2, 8);
  },
});
