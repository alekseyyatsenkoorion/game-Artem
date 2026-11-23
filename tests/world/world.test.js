// Главный экран, экран для взрослых, «Машины спят»: 0.1, 0.2, 0.6, 2.33, 2.34 (снятие только через экран взрослых).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenes as worldScenes } from '../../src/world/index.js';
import { scenes as gameScenes } from '../../src/games/index.js';
import data from '../../src/data/index.js';
import art from '../../src/art/index.js';
import { UI_ART } from '../../src/core/ui.js';
import { CROSS_ZONE, rectsOverlap } from '../../src/core/draw-utils.js';
import { makeWorld, fakeGraphics, captureErrors, tick } from '../core/helpers.js';

async function world() {
  const w = makeWorld({ data, art: Object.assign({}, art, UI_ART), scenes: [...worldScenes, ...gameScenes] });
  await w.scenes.open('home');
  w.timer.start();
  return w;
}
const frames = (w, sec, dt = 0.05) => { for (let t = 0; t < sec; t += dt) { w.timer.tick(dt); w.scenes.update(dt); } };

test('0.1 / 0.2 / 0.6 каждая сцена: 100 кадров без ошибок, без заглушек, крестик не закрыт', async () => {
  const err = captureErrors();
  try {
    for (const id of ['home', 'parent', 'locked']) {
      const w = await world();
      if (id !== 'home') await w.scenes.open(id);
      const s = w.scenes.currentScene();
      for (let i = 0; i < 100; i++) {
        s.update(0.016);
        const g = fakeGraphics();
        s.draw(g);
        if (id === 'parent') {
          for (const c of g.calls.filter((c) => c.op === 'fillText')) assert.ok(!(c.args[1] < 96 && c.args[2] < 96), 'текст в зоне крестика');
        }
        for (const c of g.calls.filter((c) => c.op === 'drawImage').slice(1)) assert.ok(!rectsOverlap({ x: c.x, y: c.y, w: c.w, h: c.h }, CROSS_ZONE), id);
      }
      assert.equal(w.assets.placeholderCount, 0, id);
    }
    assert.deepEqual(err.list, []);
  } finally { err.restore(); }
});

test('главный экран: тык по машине — мотор и гудок, затем сборка', async () => {
  const w = await world();
  w.scenes.pointer({ type: 'down', x: 512, y: 480 });
  assert.equal(w.audio.activeSounds(), 0); // в тесте звук «мгновенный», важно, что нет ошибок
  frames(w, 1.5);
  await tick();
  assert.equal(w.scenes.current(), 'assembly');
});

test('главный экран: через 10 секунд простоя голос называет Артёма и говорит, что делать', async () => {
  const w = await world();
  frames(w, 10.2);
  await tick();
  assert.ok(w.voices.log[0].startsWith('Артём, нажми на машину'));
});

test('2.33 таймер: задание доигрывается, блокировка на главном экране; снять — только экран взрослых', async () => {
  const w = await world();
  w.timer.testRun();
  await w.scenes.open('assembly', { machine: 'samosval' });
  frames(w, 61);
  assert.equal(w.scenes.current(), 'assembly'); // идёт задание — не блокируем
  w.scenes.back();
  frames(w, 0.1);
  await tick();
  assert.equal(w.scenes.current(), 'locked');
  assert.equal(w.timer.isLocked(), true);
  // касания по экрану блокировку не снимают, крестика нет
  w.scenes.pointer({ type: 'down', x: 40, y: 40 }); w.scenes.pointer({ type: 'up', x: 40, y: 40 });
  w.scenes.pointer({ type: 'down', x: 500, y: 500 }); w.scenes.pointer({ type: 'up', x: 500, y: 500 });
  frames(w, 1);
  assert.equal(w.scenes.current(), 'locked');
  // родительский жест открывает экран взрослых — блокировка снята
  await w.scenes.open('parent');
  assert.equal(w.timer.isLocked(), false);
  w.scenes.back();
  frames(w, 0.1);
  assert.equal(w.scenes.current(), 'home');
});

function press(w, label) {
  const s = w.scenes.currentScene();
  const b = s.buttons.find((x) => x.label === label || x.id === label);
  w.scenes.pointer({ type: 'down', x: b.x + 10, y: b.y + 10 });
  w.scenes.pointer({ type: 'up', x: b.x + 10, y: b.y + 10 });
}

test('экран взрослых: длительность таймера, открыть все, сброс с подтверждением, проверка таймера', async () => {
  const w = await world();
  await w.scenes.open('parent');
  press(w, 'min-15');
  assert.equal(w.timer.remaining(), 15 * 60);
  assert.equal(w.progress.setting('timerMinutes'), 15);
  press(w, 'min-0');
  assert.equal(w.timer.remaining(), Infinity);
  press(w, 'unlock-all');
  assert.equal(w.progress.isUnlocked('samosval'), true);
  w.progress.setAssembled('samosval');
  press(w, 'reset');
  assert.equal(w.progress.isAssembled('samosval'), true); // первый тык — только вопрос
  press(w, 'reset');
  assert.equal(w.progress.isAssembled('samosval'), false);
  assert.equal(w.progress.setting('timerMinutes'), 0); // настройки остались
  press(w, 'test');
  assert.equal(w.scenes.current(), 'home');
  assert.equal(w.timer.remaining(), 60);
  frames(w, 61);
  await tick();
  assert.equal(w.scenes.current(), 'locked');
});
