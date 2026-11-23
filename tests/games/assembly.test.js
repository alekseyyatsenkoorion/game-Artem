// Сборка: 2.1–2.4, 0.1, 0.6, 0.7, 0.9, 2.9 (раскладка не на местах), 2.30 (подсказки).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from '../../src/core/scene.js';
import { AssemblyScene, SNAP_DISTANCE } from '../../src/games/assembly.js';
import data from '../../src/data/index.js';
import art from '../../src/art/index.js';
import { UI_ART } from '../../src/core/ui.js';
import { CROSS_ZONE, rectsOverlap } from '../../src/core/draw-utils.js';
import { makeWorld, fakeGraphics, captureErrors, tick } from '../core/helpers.js';

class Home extends Scene { static id = 'home'; enter() { this.results = []; } onResult(r) { this.results.push(r); } }

async function open() {
  const w = makeWorld({ data, art: Object.assign({}, art, UI_ART), scenes: [Home, AssemblyScene] });
  await w.scenes.open('home');
  const home = w.scenes.currentScene();
  await w.scenes.open('assembly', { machine: 'samosval' });
  return { w, home, s: w.scenes.currentScene() };
}

function drag(s, part, toX, toY) {
  s.onPointer({ type: 'down', x: part.cx, y: part.cy });
  s.onPointer({ type: 'move', x: (part.cx + toX) / 2, y: (part.cy + toY) / 2 });
  s.onPointer({ type: 'move', x: toX, y: toY });
  s.onPointer({ type: 'up', x: toX, y: toY });
}
function settle(s, sec = 0.5) { for (let t = 0; t < sec; t += 0.02) s.update(0.02); }

test('2.9 детали в начале лежат на верстаке, не на своих местах и не друг на друге', async () => {
  const { s } = await open();
  for (const p of s.parts) {
    assert.ok(Math.hypot(p.cx - p.slot.cx, p.cy - p.slot.cy) > SNAP_DISTANCE * 1.5, p.def.id);
    assert.ok(p.cy + p.def.h * p.s / 2 <= 768 && p.cx - p.def.w * p.s / 2 >= 0 && p.cx + p.def.w * p.s / 2 <= 1024, p.def.id + ' в экране');
  }
  const rects = s.parts.map((p) => ({ x: p.cx - p.def.w * p.s / 2, y: p.cy - p.def.h * p.s / 2, w: p.def.w * p.s, h: p.def.h * p.s }));
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) assert.ok(!rectsOverlap(rects[i], rects[j]));
});

test('2.1 деталь рядом со своим местом встаёт; голос называет её', async () => {
  const { w, s } = await open();
  const p = s.partById('kabina');
  drag(s, p, p.slot.cx + 40, p.slot.cy - 30);
  settle(s);
  assert.equal(p.placed, true);
  assert.equal(p.cx, p.slot.cx);
  await tick(); w.voices.finishCurrent(); await tick();
  assert.ok(w.voices.log.includes('Кабина!'));
});

test('2.2 деталь у чужого места не встаёт и возвращается на верстак', async () => {
  const { s } = await open();
  const cab = s.partById('kabina');
  const body = s.partById('kuzov');
  drag(s, cab, body.slot.cx, body.slot.cy);
  assert.equal(cab.placed, false);
  settle(s);
  assert.equal(Math.round(cab.cx), Math.round(cab.home.cx));
  assert.equal(Math.round(cab.cy), Math.round(cab.home.cy));
});

test('промах рядом с деталью засчитывается (зона касания не меньше 2 см)', async () => {
  const { s } = await open();
  const wheel = s.partById('koleso-perednee');
  s.onPointer({ type: 'down', x: wheel.cx, y: wheel.cy - wheel.def.h * wheel.s / 2 - 15 });
  assert.equal(s.drag && s.drag.part, wheel);
});

test('0.7 cancel во время перетаскивания возвращает деталь на место', async () => {
  const { s } = await open();
  const p = s.partById('rama');
  s.onPointer({ type: 'down', x: p.cx, y: p.cy });
  s.onPointer({ type: 'move', x: 500, y: 200 });
  s.onPointer({ type: 'cancel', x: 500, y: 200 });
  settle(s);
  assert.equal(p.placed, false);
  assert.equal(Math.round(p.cx), Math.round(p.home.cx));
  assert.equal(s.drag, null);
});

test('2.3 / 2.4 / 0.9 собрана только когда встали все; прогресс сохранён; finish по контракту', async () => {
  const { w, s, home } = await open();
  const parts = s.parts.slice();
  for (let i = 0; i < parts.length; i++) {
    assert.equal(s.isAssembled(), false);
    assert.equal(w.progress.isAssembled('samosval'), false);
    drag(s, parts[i], parts[i].slot.cx, parts[i].slot.cy);
    settle(s, 0.2);
  }
  assert.equal(s.isAssembled(), true);
  assert.equal(w.progress.isAssembled('samosval'), true); // сохранено в момент события
  assert.equal(s.canExit(), false); // финальная анимация
  // голос договаривает; без голоса сцена всё равно закончится
  for (let i = 0; i < 400 && w.scenes.current() === 'assembly'; i++) { s.update(0.02); if (i % 20 === 0) { w.voices.finishCurrent(); await tick(); } }
  assert.equal(w.scenes.current(), 'home');
  assert.deepEqual(home.results[0], { done: true, machine: 'samosval' });
  assert.equal(w.audio.activeSounds(), 0);
});

test('похвала звучит после сборки', async () => {
  const { w, s } = await open();
  for (const p of s.parts.slice()) { drag(s, p, p.slot.cx, p.slot.cy); settle(s, 0.2); }
  for (let i = 0; i < 6; i++) { await tick(); w.voices.finishCurrent(); await tick(); }
  const praises = data.praises.map((id) => data.phrases[id].replace('{name}', data.childName));
  assert.ok(w.voices.log.some((t) => praises.includes(t)));
});

test('0.1 / 0.6 enter, 100 update и draw без ошибок; в зоне крестика ничего не рисуется кроме фона', async () => {
  const err = captureErrors();
  try {
    const { s } = await open();
    for (let i = 0; i < 100; i++) {
      s.update(0.016);
      const g = fakeGraphics();
      s.draw(g);
      for (const c of g.calls.filter((c) => c.op === 'drawImage').slice(1)) {
        assert.ok(!rectsOverlap({ x: c.x, y: c.y, w: c.w, h: c.h }, CROSS_ZONE), 'рисует в зоне крестика');
      }
    }
    assert.equal(err.list.length, 0);
  } finally { err.restore(); }
});

test('0.2 сцена объявляет все картинки: ни одной заглушки', async () => {
  const { w, s } = await open();
  for (const p of s.parts.slice()) { drag(s, p, p.slot.cx, p.slot.cy); settle(s, 0.1); }
  for (let i = 0; i < 100; i++) { s.update(0.02); s.draw(fakeGraphics()); }
  assert.equal(w.assets.placeholderCount, 0);
});

test('2.30 подсказки: рука через 5 секунд простоя, голос через 10', async () => {
  const { w, s } = await open();
  await tick(); w.voices.finishCurrent(); await tick(); // задание при входе
  const before = w.voices.log.length;
  for (let t = 0; t < 4.9; t += 0.05) s.update(0.05);
  assert.equal(s.hint.showHand(), false);
  for (let t = 0; t < 0.3; t += 0.05) s.update(0.05);
  assert.equal(s.hint.showHand(), true);
  for (let t = 0; t < 4.5; t += 0.05) s.update(0.05);
  await tick();
  assert.equal(w.voices.log.length, before);
  for (let t = 0; t < 0.4; t += 0.05) s.update(0.05);
  await tick();
  assert.equal(w.voices.log[w.voices.log.length - 1], 'Артём, возьми деталь пальцем и перенеси её на место.');
  // касание сбрасывает простой
  s.onPointer({ type: 'down', x: 10, y: 400 });
  assert.equal(s.hint.showHand(), false);
});

test('описание без обязательного поля: журнал и выход через back()', async () => {
  const err = captureErrors();
  try {
    const bad = { ...data, machines: [{ id: 'samosval' }] };
    const w = makeWorld({ data: bad, scenes: [Home, AssemblyScene] });
    await w.scenes.open('home');
    await w.scenes.open('assembly', { machine: 'samosval' });
    w.scenes.update(0.02);
    assert.equal(w.scenes.current(), 'home');
    assert.ok(err.list.length >= 1);
  } finally { err.restore(); }
});
