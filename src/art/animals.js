// Картинки к фактам-сравнениям (spec.md §3): «самосвал везёт четыре слона», «колесо выше мальчика» и т. п.
// Каждая — 360×260, прозрачный фон (карточку рисует сцена), без текста и цифр. id: 'fact/<машина>'.
import { roundRect } from '../core/draw-utils.js';
import { OUTLINE, TAU, GLASS, box, shape, circle, line, poly, drawWheel } from './parts-common.js';

const FW = 360, FH = 260;

const ELEPHANT = '#9aa3b5', ELEPHANT_DARK = '#7a8296', EAR = '#f3a6b8';
const SKIN = '#ffd2a8', HAIR = '#8a4b1f', SHIRT = '#e8412c', PANTS = '#3a6fd8', SHOE = '#3b3030';
const SAND = '#f6d57c', SAND_DARK = '#dcb253';
const WOOD = '#e9b062', WOOD_DARK = '#b97c34';
const Y = '#ffc21a', Y_DARK = '#d99a00';
const GIRAFFE = '#ffc94a', GIRAFFE_SPOT = '#c9772b';

function ellipse(g, cx, cy, rx, ry, fill, lw = 5) {
  shape(g, fill, (q) => q.ellipse(cx, cy, rx, ry, 0, 0, TAU), lw);
}

function eye(g, x, y, r) {
  circle(g, x, y, r, OUTLINE);
  circle(g, x - r * 0.3, y - r * 0.35, r * 0.35, '#ffffff');
}

// Слон боком, смотрит вправо. (x, y) — середина между ногами на земле; s — масштаб (s = 1: ~110 × 95).
export function elephant(g, x, y, s = 1, flip = false) {
  g.save(); g.translate(x, y); g.scale(flip ? -s : s, s);
  const lw = 5 / s;
  // хвостик
  line(g, -44, -50, -56, -30, OUTLINE, 4 / s);
  // дальние ноги
  for (const lx of [-28, 22]) box(g, lx, -32, 16, 32, 6, ELEPHANT_DARK, lw);
  // тело
  ellipse(g, 0, -48, 48, 32, ELEPHANT, lw);
  // ближние ноги
  for (const lx of [-40, 8]) box(g, lx, -30, 18, 30, 6, ELEPHANT, lw);
  for (const lx of [-40, 8]) { g.fillStyle = '#ffffff'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(lx + 4 + k * 5, -3, 2, Math.PI, 0); g.fill(); } }
  // хобот
  g.lineCap = 'round';
  g.strokeStyle = OUTLINE; g.lineWidth = 22;
  g.beginPath(); g.moveTo(58, -58); g.quadraticCurveTo(76, -40, 70, -14); g.stroke();
  g.strokeStyle = ELEPHANT; g.lineWidth = 15;
  g.beginPath(); g.moveTo(58, -58); g.quadraticCurveTo(76, -40, 70, -14); g.stroke();
  // голова
  circle(g, 46, -62, 24, ELEPHANT, lw);
  g.strokeStyle = ELEPHANT; g.lineWidth = 15;
  g.beginPath(); g.moveTo(56, -56); g.quadraticCurveTo(70, -46, 70, -30); g.stroke();
  // бивень
  shape(g, '#fffbe8', (q) => { q.moveTo(58, -46); q.quadraticCurveTo(70, -38, 76, -44); q.quadraticCurveTo(68, -50, 60, -52); }, 3 / s);
  // ухо
  ellipse(g, 32, -62, 15, 20, ELEPHANT_DARK, lw);
  ellipse(g, 32, -61, 9, 13, EAR, 0.01);
  eye(g, 55, -70, 4);
  // щёчка
  circle(g, 60, -60, 4, 'rgba(255,120,150,0.5)');
  g.restore();
}

// Мальчик в полный рост, смотрит на нас. (x, y) — между ступнями; h — рост в пикселях.
// pose: 'stand' — руки вниз, 'push' — руки вперёд-вниз (держит лопату), 'wave' — машет.
export function boy(g, x, y, h, pose = 'stand') {
  const s = h / 150;
  g.save(); g.translate(x, y); g.scale(s, s);
  const lw = 4 / s;
  // ноги
  box(g, -18, -58, 15, 54, 6, PANTS, lw);
  box(g, 3, -58, 15, 54, 6, PANTS, lw);
  box(g, -22, -10, 20, 10, 5, SHOE, lw);
  box(g, 2, -10, 20, 10, 5, SHOE, lw);
  // руки
  g.lineCap = 'round';
  const arm = (x1, y1, x2, y2) => {
    g.strokeStyle = OUTLINE; g.lineWidth = 15; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = SHIRT; g.lineWidth = 10; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    circle(g, x2, y2, 7, SKIN, lw);
  };
  if (pose === 'push') { arm(-18, -100, 22, -72); arm(18, -100, 40, -66); }
  else if (pose === 'wave') { arm(-20, -100, -36, -64); arm(20, -100, 40, -134); }
  else { arm(-20, -100, -32, -62); arm(20, -100, 32, -62); }
  // майка
  box(g, -24, -108, 48, 54, 12, SHIRT, lw);
  circle(g, 0, -84, 7, Y, 3 / s);
  // голова
  circle(g, 0, -128, 23, SKIN, lw);
  shape(g, HAIR, (q) => { q.moveTo(-23, -128); q.quadraticCurveTo(-24, -156, 0, -154); q.quadraticCurveTo(24, -156, 23, -128); q.quadraticCurveTo(12, -142, -4, -138); q.quadraticCurveTo(-14, -142, -23, -128); }, 3 / s);
  eye(g, -8, -127, 3.5); eye(g, 8, -127, 3.5);
  g.strokeStyle = OUTLINE; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.arc(0, -119, 7, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  circle(g, -14, -118, 4, 'rgba(255,110,110,0.45)'); circle(g, 14, -118, 4, 'rgba(255,110,110,0.45)');
  g.restore();
}

// Жирафик: (x, y) — ноги на земле, s — масштаб (s = 1: ~60 × 90), смотрит вправо. Голова в (24, -78).
export function giraffe(g, x, y, s = 1, flip = false) {
  g.save(); g.translate(x, y); g.scale(flip ? -s : s, s);
  const lw = 4.5;
  line(g, -22, -42, -30, -28, OUTLINE, lw);
  for (const lx of [-22, -10, 4, 16]) box(g, lx, -34, 9, 34, 3, GIRAFFE, lw);
  // шея
  shape(g, GIRAFFE, (q) => poly(q, [[0, -40], [14, -78], [28, -76], [22, -36]]), lw);
  ellipse(g, -2, -40, 26, 12, GIRAFFE, lw);
  // голова
  ellipse(g, 24, -78, 13, 8, GIRAFFE, lw);
  line(g, 16, -84, 14, -94, OUTLINE, lw); line(g, 23, -85, 24, -96, OUTLINE, lw);
  circle(g, 14, -94, 3.5, GIRAFFE_SPOT, 2); circle(g, 24, -96, 3.5, GIRAFFE_SPOT, 2);
  eye(g, 26, -81, 2.6);
  // пятна
  for (const [px, py, r] of [[-14, -42, 4.5], [-2, -36, 4.5], [10, -43, 3.5], [-6, -47, 3], [14, -56, 3.5], [19, -68, 3]]) circle(g, px, py, r, GIRAFFE_SPOT);
  g.restore();
}

// ── 1. Самосвал везёт четыре слона ──
function factSamosval(g) {
  const ground = 238;
  // слоны в кузове (кузов рисуется поверх, видны спины и головы)
  elephant(g, 62, 100, 0.62); elephant(g, 150, 98, 0.62);
  elephant(g, 96, 118, 0.62); elephant(g, 184, 116, 0.62);
  // кузов
  shape(g, Y, (q) => poly(q, [[14, 112], [236, 112], [224, 182], [26, 182]]));
  box(g, 8, 104, 234, 18, 6, Y_DARK);
  g.strokeStyle = Y_DARK; g.lineWidth = 7;
  for (let i = 1; i <= 4; i++) { const xx = 26 + i * 40; g.beginPath(); g.moveTo(xx, 128); g.lineTo(xx, 174); g.stroke(); }
  // рама
  box(g, 18, 178, 320, 18, 6, '#3b4250');
  // кабина
  shape(g, '#e8412c', (q) => { q.moveTo(244, 186); q.lineTo(244, 92); q.quadraticCurveTo(244, 78, 258, 78); q.lineTo(298, 78); q.lineTo(326, 128); q.quadraticCurveTo(342, 130, 342, 146); q.lineTo(342, 186); q.closePath(); });
  shape(g, GLASS, (q) => poly(q, [[256, 92], [294, 92], [314, 128], [256, 128]]), 4);
  line(g, 266, 120, 276, 100, 'rgba(255,255,255,0.85)', 5);
  circle(g, 336, 156, 6, '#fff6a8', 3);
  for (const wx of [72, 178, 296]) drawWheel(g, wx, ground - 28, 28, '#c9ccd2');
}

// ── 2. Колесо трактора выше мальчика ──
function factTraktor(g) {
  const ground = 246, r = 104, cx = 124, cy = ground - r;
  // колесо трактора: шина с ёлочкой
  circle(g, cx, cy, r, '#26262b', 5);
  g.save(); g.beginPath(); g.arc(cx, cy, r - 2, 0, TAU); g.clip();
  g.fillStyle = '#3d3d44';
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    g.save(); g.translate(cx, cy); g.rotate(a);
    g.beginPath(); poly(g, [[r - 22, -6], [r + 2, -14], [r + 2, -2], [r - 22, 6]]); g.fill();
    g.restore();
  }
  g.restore();
  circle(g, cx, cy, r * 0.58, '#2f2f35');
  circle(g, cx, cy, r * 0.5, '#e8412c', 5);
  circle(g, cx, cy, r * 0.32, '#b52b1b');
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; circle(g, cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4, 5, '#ffc21a', 2); }
  circle(g, cx, cy, 14, '#ffc21a', 4);
  // Мальчик рядом — ниже колеса
  boy(g, 290, ground, 150, 'wave');
  // пунктир от верха колеса к голове мальчика: «выше»
  g.setLineDash && g.setLineDash([8, 8]);
  line(g, cx, cy - r - 2, 340, cy - r - 2, '#43b649', 4);
  g.setLineDash && g.setLineDash([]);
  shape(g, '#43b649', (q) => poly(q, [[292, 54], [304, 42], [316, 54]]), 3);
  line(g, 304, 54, 304, 76, '#43b649', 6);
}

// ── 3. Бульдозер: мальчик толкает снег лопатой ──
function factBuldozer(g) {
  const ground = 230;
  // снежная земля
  shape(g, '#f4fbff', (q) => { q.moveTo(0, ground); q.quadraticCurveTo(180, ground - 10, 360, ground); q.lineTo(360, 258); q.lineTo(0, 258); q.closePath(); }, 4);
  // куча снега впереди лопаты
  shape(g, '#ffffff', (q) => { q.moveTo(232, ground + 2); q.quadraticCurveTo(236, 150, 290, 152); q.quadraticCurveTo(346, 156, 350, ground + 2); q.closePath(); }, 5);
  g.fillStyle = '#d6ecfa';
  g.beginPath(); g.ellipse(300, 205, 34, 14, 0, 0, TAU); g.fill();
  // след за лопатой
  g.fillStyle = '#d6ecfa'; roundRect(g, 30, ground + 4, 190, 10, 5); g.fill();
  // мальчик в шапке толкает
  g.save(); g.translate(120, ground); g.rotate(0.12); boy(g, 0, 0, 150, 'push'); g.restore();
  // шапка
  g.save(); g.translate(120, ground); g.rotate(0.12);
  shape(g, '#3a6fd8', (q) => { q.moveTo(-25, -138); q.quadraticCurveTo(-24, -166, 0, -166); q.quadraticCurveTo(24, -166, 25, -138); q.closePath(); }, 4);
  box(g, -27, -144, 54, 10, 5, '#ffffff', 4);
  circle(g, 0, -170, 8, '#ffffff', 4);
  g.restore();
  // лопата: черенок от рук к ковшу у снега
  line(g, 150, 158, 214, 214, OUTLINE, 11);
  line(g, 150, 158, 214, 214, WOOD, 6);
  shape(g, '#e8412c', (q) => poly(q, [[206, 196], [238, 186], [242, ground + 2], [212, ground + 2]]), 5);
  // снежинки
  for (const [sx, sy] of [[30, 40], [80, 90], [200, 30], [260, 70], [330, 40], [300, 110], [40, 150]]) {
    g.strokeStyle = '#7fc4f0'; g.lineWidth = 3; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(sx - Math.cos(a) * 7, sy - Math.sin(a) * 7); g.lineTo(sx + Math.cos(a) * 7, sy + Math.sin(a) * 7); g.stroke(); }
  }
}

// ── 4. Каток тяжёлый, как три слона ──
function factKatok(g) {
  // весы-платформа
  box(g, 10, 204, 340, 36, 10, '#5d93e0');
  box(g, 4, 196, 352, 14, 6, '#c9ccd2');
  circle(g, 180, 224, 13, '#ffffff', 4);
  line(g, 180, 224, 189, 216, '#e8412c', 4);
  elephant(g, 68, 198, 0.8); elephant(g, 176, 198, 0.8); elephant(g, 284, 198, 0.8);
}

// ── 5. Барабан крутится, как стиральная машина ──
function factBetonomeshalka(g) {
  const x = 104, y = 34, w = 152, h = 196;
  box(g, x, y, w, h, 16, '#f7f9fc');
  // панель
  g.strokeStyle = OUTLINE; g.lineWidth = 4;
  g.beginPath(); g.moveTo(x + 2, y + 40); g.lineTo(x + w - 2, y + 40); g.stroke();
  circle(g, x + 26, y + 20, 9, '#43b649', 3);
  circle(g, x + 52, y + 20, 9, '#ffc21a', 3);
  box(g, x + 82, y + 12, 52, 16, 6, '#9fdcff', 3);
  // дверца
  const cx = x + w / 2, cy = y + 120;
  circle(g, cx, cy, 54, '#c9ccd2', 5);
  circle(g, cx, cy, 42, '#7cc8f5', 4);
  // бельё внутри — по кругу
  g.save(); g.beginPath(); g.arc(cx, cy, 40, 0, TAU); g.clip();
  const cloth = ['#e8412c', '#ffc21a', '#43b649', '#ff7ab8'];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    g.save(); g.translate(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22); g.rotate(a + Math.PI / 2);
    shape(g, cloth[i], (q) => { q.moveTo(-14, -8); q.quadraticCurveTo(0, -16, 14, -8); q.quadraticCurveTo(10, 0, 14, 8); q.quadraticCurveTo(0, 14, -14, 8); q.quadraticCurveTo(-10, 0, -14, -8); }, 3);
    g.restore();
  }
  g.restore();
  // блик стекла
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.arc(cx, cy, 30, 1.1 * Math.PI, 1.4 * Math.PI); g.stroke();
  // ножки
  box(g, x + 10, y + h - 2, 22, 10, 4, '#5a5f6b', 3); box(g, x + w - 32, y + h - 2, 22, 10, 4, '#5a5f6b', 3);
  // стрелка-круг вокруг дверцы
  const R = 72, a0 = -0.35 * Math.PI, a1 = 1.25 * Math.PI;
  g.lineCap = 'round';
  g.strokeStyle = OUTLINE; g.lineWidth = 16; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
  g.strokeStyle = '#ff8a1c'; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
  const ex = cx + Math.cos(a1) * R, ey = cy + Math.sin(a1) * R;
  g.save(); g.translate(ex, ey); g.rotate(a1 + Math.PI / 2);
  shape(g, '#ff8a1c', (q) => poly(q, [[-6, -18], [22, 0], [-6, 18]]), 4);
  g.restore();
}

// ── 6. Ковш копает, как ладошка ──
function factEkskavator(g) {
  // куча песка внизу
  shape(g, SAND, (q) => { q.moveTo(10, 246); q.quadraticCurveTo(60, 170, 180, 176); q.quadraticCurveTo(300, 172, 350, 246); q.closePath(); });
  g.fillStyle = SAND_DARK;
  for (const [px, py] of [[70, 222], [120, 204], [250, 214], [300, 230], [190, 232]]) { g.beginPath(); g.arc(px, py, 4, 0, TAU); g.fill(); }
  // ладошка сверху: пальцы загребают в песок (вид сбоку, пальцы вниз и к нам)
  g.save(); g.translate(200, 40); g.rotate(-0.25);
  // рукав и запястье
  box(g, 40, -40, 70, 60, 14, SHIRT);
  // ладонь
  shape(g, SKIN, (q) => { q.moveTo(46, -10); q.quadraticCurveTo(-30, -20, -50, 30); q.lineTo(-58, 80); q.quadraticCurveTo(-40, 110, 20, 96); q.quadraticCurveTo(60, 80, 56, 20); q.closePath(); });
  // пальцы, согнутые как зубья ковша
  for (let i = 0; i < 4; i++) {
    const fx = -54 + i * 22, fy = 84 + (i === 0 ? 0 : 6) - i * 2;
    shape(g, SKIN, (q) => { q.moveTo(fx, fy - 20); q.quadraticCurveTo(fx - 4, fy + 30, fx + 12, fy + 34); q.quadraticCurveTo(fx + 22, fy + 30, fx + 18, fy - 20); q.closePath(); }, 4);
    circle(g, fx + 9, fy + 28, 3.5, '#ffb3b3');
  }
  // большой палец
  shape(g, SKIN, (q) => { q.moveTo(40, 40); q.quadraticCurveTo(78, 58, 66, 92); q.quadraticCurveTo(54, 96, 50, 80); q.quadraticCurveTo(44, 60, 30, 56); q.closePath(); }, 4);
  g.restore();
  // песок в горсти и сыпется
  shape(g, SAND, (q) => { q.moveTo(118, 166); q.quadraticCurveTo(160, 132, 206, 154); q.lineTo(196, 172); q.quadraticCurveTo(160, 178, 118, 166); q.closePath(); }, 4);
  g.fillStyle = SAND_DARK;
  for (const [px, py] of [[112, 180], [104, 194], [210, 180], [218, 196], [100, 210]]) { g.beginPath(); g.arc(px, py, 4, 0, TAU); g.fill(); }
}

// ── 7. В ковш поместится песочница песка ──
function factPogruzchik(g) {
  // песочница в перспективе: задний борт, песок, передний борт
  shape(g, WOOD_DARK, (q) => poly(q, [[60, 130], [300, 130], [300, 150], [60, 150]]));
  shape(g, SAND, (q) => poly(q, [[48, 148], [312, 148], [342, 206], [18, 206]]));
  g.fillStyle = SAND_DARK;
  for (const [px, py] of [[80, 170], [140, 190], [230, 168], [290, 192], [180, 160]]) { g.beginPath(); g.ellipse(px, py, 10, 4, 0, 0, TAU); g.fill(); }
  shape(g, WOOD_DARK, (q) => poly(q, [[48, 130], [60, 130], [26, 206], [14, 206]]));
  shape(g, WOOD_DARK, (q) => poly(q, [[300, 130], [312, 130], [346, 206], [334, 206]]));
  box(g, 6, 200, 348, 36, 6, WOOD);
  g.strokeStyle = WOOD_DARK; g.lineWidth = 3;
  g.beginPath(); g.moveTo(10, 218); g.lineTo(350, 218); g.stroke();
  // куличик-замок
  box(g, 120, 140, 50, 40, 4, SAND_DARK, 4);
  for (let i = 0; i < 3; i++) box(g, 120 + i * 18, 128, 14, 14, 2, SAND_DARK, 4);
  shape(g, '#e8412c', (q) => poly(q, [[146, 128], [146, 100], [166, 108], [146, 116]]), 3);
  line(g, 146, 128, 146, 100, OUTLINE, 3);
  // ведёрко
  shape(g, '#3a6fd8', (q) => poly(q, [[220, 150], [262, 150], [256, 190], [226, 190]]));
  g.strokeStyle = OUTLINE; g.lineWidth = 4; g.beginPath(); g.arc(241, 150, 20, Math.PI, 0); g.stroke();
  // совочек
  line(g, 290, 120, 284, 170, OUTLINE, 9); line(g, 290, 120, 284, 170, '#43b649', 5);
  shape(g, '#43b649', (q) => poly(q, [[274, 166], [294, 166], [292, 188], [276, 188]]), 4);
  // грибок-зонтик
  line(g, 70, 140, 70, 30, OUTLINE, 10); line(g, 70, 140, 70, 30, WOOD, 6);
  shape(g, '#e8412c', (q) => { q.moveTo(10, 50); q.quadraticCurveTo(70, -6, 130, 50); q.closePath(); });
  for (const [px, py] of [[46, 36], [82, 26], [104, 42]]) circle(g, px, py, 6, '#ffffff');
}

// ── 8. Стрела вытягивается, как подзорная труба ──
function factAvtokran(g) {
  // тренога
  const tx = 198, ty = 148;
  line(g, tx, ty + 10, tx - 40, 246, OUTLINE, 10); line(g, tx, ty + 10, tx - 40, 246, WOOD_DARK, 6);
  line(g, tx, ty + 10, tx + 46, 246, OUTLINE, 10); line(g, tx, ty + 10, tx + 46, 246, WOOD_DARK, 6);
  line(g, tx, ty + 10, tx + 2, 250, OUTLINE, 10); line(g, tx, ty + 10, tx + 2, 250, WOOD, 6);
  g.save(); g.translate(tx, ty); g.scale(0.85, 0.85); g.rotate(-0.28);
  // колена трубы: от толстого к тонкому (тонкое — к глазу, слева)
  const seg = [[-40, 120, 30, '#c0392b'], [-120, 86, 23, '#e8a23a'], [-182, 66, 17, '#c0392b']];
  for (const [sx, len, r, col] of seg.slice().reverse()) {
    box(g, sx, -r, len, 2 * r, 6, col);
    g.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(g, sx + 6, -r + 5, len - 12, r * 0.4, 3); g.fill();
  }
  // кольца
  for (const [rx, r] of [[-40, 30], [-120, 23], [74, 30]]) box(g, rx - 6, -r - 4, 12, 2 * r + 8, 4, '#ffc21a', 4);
  // большое стекло
  box(g, 80, -36, 22, 72, 8, '#c0392b');
  shape(g, GLASS, (q) => q.ellipse(102, 0, 9, 32, 0, 0, TAU), 4);
  // окуляр
  box(g, -196, -10, 16, 20, 4, '#3b4250', 4);
  g.restore();
  // стрелки «вытягивается»
  const arrow = (x1, y1, x2, y2) => {
    line(g, x1, y1, x2, y2, '#43b649', 6);
    const a = Math.atan2(y2 - y1, x2 - x1);
    g.save(); g.translate(x2, y2); g.rotate(a); shape(g, '#43b649', (q) => poly(q, [[0, -10], [14, 0], [0, 10]]), 3); g.restore();
  };
  arrow(110, 96, 40, 118);
  arrow(250, 70, 330, 46);
}

// ── 9. Нож грейдера длинный, как две кровати ──
function bed(g, x, y, w, blanket) {
  box(g, x, y - 90, 14, 104, 5, WOOD);          // изголовье
  box(g, x + w - 14, y - 60, 14, 74, 5, WOOD);  // изножье
  box(g, x + 8, y - 30, w - 16, 26, 6, WOOD_DARK);
  box(g, x + 12, y - 52, w - 24, 26, 8, '#ffffff');
  box(g, x + 16, y - 70, 40, 24, 10, '#ffffff');
  shape(g, blanket, (q) => { q.moveTo(x + 52, y - 58); q.lineTo(x + w - 16, y - 58); q.lineTo(x + w - 16, y - 20); q.quadraticCurveTo(x + 52, y - 14, x + 52, y - 58); q.closePath(); }, 4);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + 74 + k * 26, y - 40, 5, 0, TAU); g.fill(); }
}
function factGreider(g) {
  bed(g, 12, 160, 164, '#3a6fd8');
  bed(g, 184, 160, 164, '#ff7ab8');
  // нож грейдера той же длины
  shape(g, '#c9ccd2', (q) => { q.moveTo(12, 196); q.quadraticCurveTo(180, 182, 348, 196); q.lineTo(348, 226); q.quadraticCurveTo(180, 214, 12, 226); q.closePath(); });
  g.strokeStyle = '#3b4250'; g.lineWidth = 6; g.beginPath(); g.moveTo(14, 230); g.quadraticCurveTo(180, 218, 346, 230); g.stroke();
  box(g, 140, 176, 80, 18, 6, Y);
  for (const bx of [40, 110, 250, 320]) circle(g, bx, 206, 4, '#5a5f6b');
  // скобки длины
  for (const ex of [12, 348]) line(g, ex, 240, ex, 256, '#43b649', 5);
  line(g, 14, 248, 346, 248, '#43b649', 4);
}

// ── 10. Башенный кран выше десяти жирафов ──
function factBashennyiKran(g) {
  const ground = 252;
  // кран: башня-решётка, стрела, кабина, крюк
  const tx = 262, tw = 26, top = 30;
  box(g, tx, top, tw, ground - top, 3, Y, 4);
  g.strokeStyle = Y_DARK; g.lineWidth = 3;
  for (let yy = top + 6; yy < ground - 10; yy += 22) { g.beginPath(); g.moveTo(tx + 3, yy); g.lineTo(tx + tw - 3, yy + 22); g.moveTo(tx + tw - 3, yy); g.lineTo(tx + 3, yy + 22); g.stroke(); }
  box(g, tx - 18, ground - 14, tw + 36, 14, 3, '#b8b2a7', 4);
  box(g, 176, top - 6, 182, 12, 3, Y, 4);
  shape(g, Y, (q) => poly(q, [[tx + 2, top - 6], [tx + 13, top - 28], [tx + 24, top - 6]]), 4);
  line(g, tx + 13, top - 26, 350, top - 6, OUTLINE, 2); line(g, tx + 13, top - 26, 180, top - 6, OUTLINE, 2);
  box(g, 178, top + 6, 26, 22, 3, '#5a5f6b', 4);
  box(g, tx + 26, top + 6, 22, 20, 4, '#e8412c', 4);
  rectWin(g, tx + 31, top + 10, 12, 10);
  line(g, 334, top + 6, 334, 92, OUTLINE, 3);
  shape(g, '#5a5f6b', (q) => { q.moveTo(328, 92); q.lineTo(340, 92); q.lineTo(340, 100); q.quadraticCurveTo(340, 112, 330, 110); }, 3);
  // столбик из жирафов: каждый стоит на спине нижнего, головы торчат то вправо, то влево
  const n = 6, s = 0.66;
  let y = ground;
  for (let i = 0; i < n; i++) {
    const flip = i % 2 === 1;
    giraffe(g, 104 + (flip ? -16 : 16), y, s, flip);
    y -= 44 * s;
  }
}

function rectWin(g, x, y, w, h) {
  g.fillStyle = GLASS; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
}

const FACTS = {
  samosval: factSamosval, traktor: factTraktor, buldozer: factBuldozer, katok: factKatok,
  betonomeshalka: factBetonomeshalka, ekskavator: factEkskavator, pogruzchik: factPogruzchik,
  avtokran: factAvtokran, greider: factGreider, 'bashennyi-kran': factBashennyiKran,
};

export const art = {};
for (const id of Object.keys(FACTS)) {
  const fn = FACTS[id];
  art['fact/' + id] = {
    w: FW, h: FH,
    draw(g, w, h) {
      g.save(); g.scale(w / FW, h / FH);
      fn(g);
      g.restore();
    },
  };
}

export default art;
