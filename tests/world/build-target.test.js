// Стройка: цель действия — там, где появится новая часть (прямоугольник непрозрачных пикселей слоя шага).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BuildScene, OBJECT_ORIGIN } from '../../src/world/build.js';
import { HomeScene } from '../../src/world/home.js';
import { opaqueBox, screenBox, partOf, safePoint } from '../../src/world/build-actions/layer-box.js';
import { CROSS_ZONE, rectsOverlap } from '../../src/core/draw-utils.js';
import { captureErrors, tick } from '../core/helpers.js';
import { buildFixture, world, frames, perform, trackingGraphics, crossZoneViolations, offscreen } from './fixture.js';

const FX = buildFixture();

// Холст-подделка с пикселями: непрозрачный прямоугольник r (в пикселях холста), остальное прозрачно.
function pixelCanvas(w, h, r) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) data[(y * w + x) * 4 + 3] = 255;
  return { width: w, height: h, getContext: () => ({ getImageData: () => ({ data }) }) };
}

test('opaqueBox: прямоугольник непрозрачных пикселей (и на холсте ×2); без пикселей — null', () => {
  const r = { x: 60, y: 200, w: 300, h: 64 };
  const b = opaqueBox(pixelCanvas(600, 440, r), 600, 440);
  assert.ok(Math.abs(b.x - r.x) <= 2 && Math.abs(b.y - r.y) <= 2, JSON.stringify(b));
  assert.ok(Math.abs(b.w - r.w) <= 4 && Math.abs(b.h - r.h) <= 4, JSON.stringify(b));
  const b2 = opaqueBox(pixelCanvas(1200, 880, { x: 120, y: 400, w: 600, h: 128 }), 600, 440);
  assert.ok(Math.abs(b2.x - 60) <= 4 && Math.abs(b2.y - 200) <= 4 && Math.abs(b2.w - 300) <= 6 && Math.abs(b2.h - 64) <= 6, JSON.stringify(b2));
  assert.equal(opaqueBox(pixelCanvas(600, 440, { x: 0, y: 0, w: 0, h: 0 }), 600, 440), null, 'пустой слой');
  assert.equal(opaqueBox({ width: 600, height: 440, getContext: () => ({}) }, 600, 440), null, 'нет getImageData');
  assert.equal(opaqueBox({ width: 1, height: 1 }, 600, 440), null, 'не холст');
  assert.equal(opaqueBox(null, 600, 440), null);
  assert.equal(screenBox({ x: 10, y: 10, w: 4, h: 4, row: 12 }, OBJECT_ORIGIN), null, 'крошечный — общее место');
  assert.deepEqual(screenBox({ x: 10, y: 20, w: 100, h: 50, row: 40 }, { x: 400, y: 260 }), { x: 410, y: 280, w: 100, h: 50, row: 300 });
});

test('partOf и safePoint: части по ширине и рядами снизу; точка не у крестика', () => {
  const b = { x: 100, y: 100, w: 400, h: 90 };
  assert.deepEqual(partOf(b, 1, 4, 'x'), { x: 200, y: 100, w: 100, h: 90 });
  assert.deepEqual(partOf(b, 0, 3, 'y'), { x: 100, y: 160, w: 400, h: 30 });
  const p = safePoint({ x: 20, y: 20 });
  assert.ok(!rectsOverlap({ x: p.x - 10, y: p.y - 10, w: 20, h: 20 }, CROSS_ZONE));
});

// Объект из одного шага с действием action; слой шага — с непрозрачным прямоугольником rect (координаты слоя) или без пикселей.
async function openOne(action, rect, { repeats = 2, machine = null } = {}) {
  const fx = { data: Object.assign({}, FX.data), art: FX.art };
  const o = { id: 'fx-box', order: 99, namePhrase: 'object-fx-1', unlocks: null, steps: [{ machine, action, repeats, phrase: 'step-fx-1-1', layer: 'l1' }] };
  fx.data.objects = FX.data.objects.concat([o]);
  const w = world(fx, [HomeScene, BuildScene]);
  if (rect) {
    const img = pixelCanvas(600, 440, rect);
    const orig = w.assets.image.bind(w.assets);
    w.assets.image = (id) => (id === 'object/fx-box/layer/l1' ? img : orig(id));
  }
  await w.scenes.open('home');
  w.timer.start();
  await w.scenes.open('build', { object: 'fx-box' });
  const s = w.scenes.currentScene();
  for (let t = 0; t < 10 && !s.target; t += 0.05) frames(w, 0.05);
  return { w, s };
}

const inside = (p, r, pad = 2) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
const onScreen = (r) => ({ x: r.x + OBJECT_ORIGIN.x, y: r.y + OBJECT_ORIGIN.y, w: r.w, h: r.h });

// Высоко над землёй, как четвёртый этаж: старое общее место (y ≈ 440–574) сюда не попадает.
const HIGH = { x: 52, y: 80, w: 356, h: 64 };

for (const action of ['lift', 'place', 'stack']) {
  test('drag ' + action + ': место укладки — в прямоугольнике слоя шага, каждая часть — своя; рука и подсветка туда же', async () => {
    const err = captureErrors();
    try {
      const machine = action === 'lift' ? FX.data.machines[7].id : null;
      const { w, s } = await openOne(action, HIGH, { repeats: 4, machine });
      const R = onScreen(HIGH);
      const seen = [];
      for (let k = 0; k < 4; k++) {
        const tg = s.target;
        assert.equal(tg.kind, 'drag');
        assert.ok(inside(tg.to, R), action + ' повтор ' + k + ': ' + JSON.stringify(tg.to) + ' в ' + JSON.stringify(R));
        seen.push(tg.to);
        if (k === 0) {
          // подсветка нарисована вокруг цели; ничего у крестика и за экраном
          frames(w, 6.5);
          const g = trackingGraphics();
          s.draw(g);
          assert.deepEqual(crossZoneViolations(g), []);
          assert.deepEqual(offscreen(g), []);
          // промах рядом засчитывается
          const near = { kind: 'drag', x: tg.x, y: tg.y, to: { x: tg.to.x + 40, y: tg.to.y + 30 } };
          perform(w, near);
        } else perform(w, tg);
        for (let t = 0; t < 3 && !s.target && s.stepIndex === 0; t += 0.05) frames(w, 0.05);
      }
      const keys = new Set(seen.map((p) => p.x + ',' + p.y));
      assert.equal(keys.size, 4, 'у каждого повтора своё место');
      assert.deepEqual(err.list, []);
    } finally { err.restore(); }
  });
}

test('stack: низкая длинная часть (перила) делится на секции слева направо, высокая (стены) — рядами снизу вверх', async () => {
  const wall = { x: 150, y: 200, w: 300, h: 120 };
  const a = await openOne('stack', wall, { repeats: 3 });
  const t0 = a.s.target.to;
  perform(a.w, a.s.target);
  for (let t = 0; t < 3 && !a.s.target; t += 0.05) frames(a.w, 0.05);
  const t1 = a.s.target.to;
  assert.ok(t1.y < t0.y && Math.abs(t1.x - t0.x) <= 1, 'ряд выше прежнего');
  const rail = { x: 120, y: 220, w: 350, h: 50 };
  const b = await openOne('stack', rail, { repeats: 4 });
  const r0 = b.s.target.to;
  perform(b.w, b.s.target);
  for (let t = 0; t < 3 && !b.s.target; t += 0.05) frames(b.w, 0.05);
  const r1 = b.s.target.to;
  assert.ok(r1.x > r0.x && Math.abs(r1.y - r0.y) <= 1, 'секция правее прежней');
});

test('paint: змейка протирания — внутри прямоугольника слоя; line — по прямоугольнику', async () => {
  const R0 = { x: 60, y: 130, w: 480, h: 180 };
  for (const action of ['paint', 'line']) {
    const { w, s } = await openOne(action, R0, { repeats: 1 });
    const R = onScreen(R0);
    const tg = s.target;
    assert.equal(tg.kind, 'trace');
    for (const p of tg.path) assert.ok(inside(p, R), action + ': ' + JSON.stringify(p));
    const xs = tg.path.map((p) => p.x);
    assert.ok(Math.max(...xs) - Math.min(...xs) >= R.w * 0.7, action + ': дорожка проходит всю ширину');
    perform(w, tg);
    for (let t = 0; t < 3 && w.scenes.currentScene() === s && s.phase === 'work'; t += 0.05) frames(w, 0.05);
    assert.notEqual(s.phase, 'work', action + ': пройдено');
  }
});

test('level / spread / roll: машина едет по земле до правого края новой части', async () => {
  const R0 = { x: 40, y: 330, w: 300, h: 30 };
  const machines = { level: FX.data.machines[2].id, spread: FX.data.machines[6].id, roll: FX.data.machines[3].id };
  for (const action of ['level', 'spread', 'roll']) {
    const { w, s } = await openOne(action, R0, { repeats: 1, machine: machines[action] });
    const tg = s.target;
    const e = tg.path[tg.path.length - 1];
    assert.ok(Math.abs(e.x - (OBJECT_ORIGIN.x + R0.x + R0.w)) <= 2, action + ': конец дорожки ' + e.x);
    assert.ok(tg.path.every((p) => p.y === tg.path[0].y), action + ': по земле');
    perform(w, tg);
    for (let t = 0; t < 3 && s.phase === 'work'; t += 0.05) frames(w, 0.05);
    assert.notEqual(s.phase, 'work', action + ': пройдено');
  }
});

test('запасной путь: без пикселей слоя — прежнее общее место; пустой слой — тоже', async () => {
  const a = await openOne('place', null, { repeats: 2 });
  assert.deepEqual(a.s.target.to, { x: Math.round(480 + 0.5 * 440 / 2), y: 560 });
  const b = await openOne('place', { x: 0, y: 0, w: 0, h: 0 }, { repeats: 2 });
  assert.deepEqual(b.s.target.to, a.s.target.to);
  const c = await openOne('paint', null, { repeats: 1 });
  assert.deepEqual(c.s.target.path[0], { x: 480, y: 424 });
  await tick();
});
