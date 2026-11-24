// Песочница: площадка → ямка → бортики из досок → песок кучей → ровный песок (+ зонтик, ведёрко).
import { C, G, pad, pitRough, plank, nails, lumps, speckle, rect, box, shape, circle, line, makeLayers, OUTLINE } from './common.js';

const PIT = { x0: 176, x1: 424, d: 34, s: 10 };
const IN0 = 186, IN1 = 414; // внутри бортиков

function sandBody(g, top) {
  rect(g, IN0, top, IN1 - IN0, G + PIT.d - top, C.sand, 4);
  speckle(g, IN0 + 6, top + 6, IN1 - 6, G + PIT.d - 4, C.sandDark, 11, 30);
}

export const art = makeLayers('pesochnitsa', {
  ploshchadka(g) { pad(g, 110, 490); },
  yama(g) { pitRough(g, PIT, 2); },
  bortiki(g) {
    plank(g, 166, 296, 20, G + PIT.d + 4 - 296); // левый бортик
    plank(g, 414, 296, 20, G + PIT.d + 4 - 296); // правый бортик
    plank(g, 150, 288, 70, 14, C.woodLight); // сиденья на уголках
    plank(g, 380, 288, 70, 14, C.woodLight);
    nails(g, [[176, 295], [210, 295], [390, 295], [424, 295]]);
  },
  'pesok-kucha'(g) {
    g.save(); g.beginPath(); g.rect(IN0 + 2, 0, IN1 - IN0 - 4, 440); g.clip();
    lumps(g, IN0 - 4, IN1 + 4, 330, G + PIT.d, C.sand, C.sandDark, 7);
    g.restore();
  },
  pesok(g) {
    sandBody(g, 312);
    // зонтик от солнца
    line(g, 300, 312, 300, 190, OUTLINE, 9); line(g, 300, 312, 300, 190, '#ffffff', 5);
    const cols = ['#e8412c', '#ffffff', '#e8412c', '#ffffff', '#e8412c', '#ffffff'];
    for (let i = 0; i < 6; i++) {
      const a0 = Math.PI + (i * Math.PI) / 6, a1 = Math.PI + ((i + 1) * Math.PI) / 6;
      shape(g, cols[i], (q) => { q.moveTo(300, 196); q.arc(300, 196, 96, a0, a1); q.closePath(); }, 4);
    }
    circle(g, 300, 98, 7, '#ffcf3a', 3);
    // ведёрко и совок
    shape(g, '#2f7de1', (q) => { q.moveTo(222, 280); q.lineTo(262, 280); q.lineTo(256, 312); q.lineTo(228, 312); q.closePath(); });
    g.strokeStyle = OUTLINE; g.lineWidth = 3; g.beginPath(); g.arc(242, 282, 18, Math.PI, 0); g.stroke();
    line(g, 340, 312, 372, 270, OUTLINE, 7); line(g, 340, 312, 372, 270, '#ffcf3a', 4);
    box(g, 364, 256, 18, 22, 5, '#43b649', 3);
    // песочный куличик
    shape(g, C.sandDark, (q) => { q.moveTo(380, 312); q.lineTo(388, 292); q.lineTo(404, 292); q.lineTo(410, 312); q.closePath(); }, 3);
  },
});
