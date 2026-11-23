// Тесты 0.3, 0.4, 0.8, 0.10, 0.11 и правила SceneManager (contracts.md, раздел 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from '../../src/core/scene.js';
import data from '../../src/data/index.js';
import { makeWorld, captureErrors, fakeGraphics } from './helpers.js';

class Home extends Scene {
  static id = 'home';
  enter() { this.results = []; this.paused = 0; this.resumed = 0; }
  onResult(r) { this.results.push(r); }
  pause() { this.paused++; } resume() { this.resumed++; }
}
class Noisy extends Scene {
  static id = 'assembly';
  enter(p) { this.p = p; this.n = 0; this.snd = this.ctx.audio.play('engine/samosval', { loop: true }); this.ctx.audio.say('part-rama'); }
  update() { this.n++; }
  exit() { this.snd.stop(); }
}
class Broken extends Scene {
  static id = 'build';
  update() { throw new Error('бах'); }
}
class Slow extends Scene {
  static id = 'tug';
  enter() { this.ok = false; }
  canExit() { return this.ok; }
}

const world = () => makeWorld({ data, scenes: [Home, Noisy, Broken, Slow] });

test('открытие поверх, finish отдаёт результат предыдущей, back — {cancelled: true}', async () => {
  const w = world();
  await w.scenes.open('home');
  const home = w.scenes.currentScene();
  await w.scenes.open('assembly', { machine: 'samosval' });
  assert.equal(w.scenes.current(), 'assembly');
  assert.equal(home.paused, 1);
  w.scenes.finish({ done: true, machine: 'samosval' });
  assert.equal(w.scenes.current(), 'home');
  assert.deepEqual(home.results[0], { done: true, machine: 'samosval' });
  await w.scenes.open('assembly', { machine: 'samosval' });
  w.scenes.back();
  assert.deepEqual(home.results[1], { cancelled: true });
});

test('0.3 выход по крестику: ни один звук сцены не звучит, очередь голоса снята', async () => {
  const w = world();
  await w.scenes.open('home');
  await w.scenes.open('assembly', { machine: 'samosval' });
  assert.equal(w.audio.activeSounds(), 1);
  // тык в крестик: down и up в квадрате 96×96
  w.scenes.pointer({ type: 'down', x: 40, y: 40 });
  w.scenes.pointer({ type: 'up', x: 40, y: 40 });
  assert.equal(w.scenes.current(), 'home');
  assert.equal(w.audio.activeSounds(), 0);
  assert.equal(w.audio.isSpeaking(), false);
  assert.equal(w.audio.queueLength(), 0);
});

test('крестик сцене не передаётся; на главном экране крестика нет', async () => {
  const w = world();
  await w.scenes.open('home');
  assert.equal(w.scenes.hasCross(), false);
  await w.scenes.open('assembly', { machine: 'samosval' });
  assert.equal(w.scenes.hasCross(), true);
  let got = 0;
  w.scenes.currentScene().onPointer = () => got++;
  w.scenes.pointer({ type: 'down', x: 30, y: 30 });
  w.scenes.pointer({ type: 'move', x: 300, y: 300 });
  w.scenes.pointer({ type: 'up', x: 300, y: 300 });
  assert.equal(got, 0);
  assert.equal(w.scenes.current(), 'assembly'); // ушёл с крестика — выхода нет
});

test('canExit=false откладывает выход до момента, когда сцена сможет выйти', async () => {
  const w = world();
  await w.scenes.open('home');
  await w.scenes.open('tug', { machine: 'samosval' });
  w.scenes.requestBack();
  w.scenes.update(0.02);
  assert.equal(w.scenes.current(), 'tug');
  w.scenes.currentScene().ok = true;
  w.scenes.update(0.02);
  assert.equal(w.scenes.current(), 'home');
});

test('0.4 утечки: 50 входов и выходов — звуки, голос и картинки не копятся', async () => {
  const w = world();
  await w.scenes.open('home');
  for (let i = 0; i < 50; i++) {
    await w.scenes.open('assembly', { machine: 'samosval' });
    w.scenes.update(0.016);
    w.scenes.back();
  }
  assert.equal(w.audio.activeSounds(), 0);
  assert.equal(w.audio.queueLength(), 0);
  assert.equal(w.scenes.depth(), 1);
  assert.ok(w.assets.cachedCount() <= 1);
});

test('0.8 пауза: update не вызывается, звуки глохнут; resume продолжает', async () => {
  const w = world();
  await w.scenes.open('home');
  await w.scenes.open('assembly', { machine: 'samosval' });
  const s = w.scenes.currentScene();
  w.scenes.update(0.01);
  w.scenes.pause();
  assert.equal(w.audio.activeSounds(), 0);
  w.scenes.update(0.01); w.scenes.update(0.01);
  assert.equal(s.n, 1);
  w.scenes.resume();
  w.scenes.update(0.01);
  assert.equal(s.n, 2);
});

test('0.10 ошибка внутри сцены не роняет игру: игрок на предыдущей сцене', async () => {
  const err = captureErrors();
  try {
    const w = world();
    await w.scenes.open('home');
    await w.scenes.open('build', { object: 'pesochnitsa' });
    w.scenes.update(0.01);
    assert.equal(w.scenes.current(), 'home');
    assert.ok(err.list.some((l) => l.includes('бах')));
  } finally { err.restore(); }
});

test('0.11 неизвестная сцена — журнал и главный экран; нет параметра — остаёмся на месте', async () => {
  const err = captureErrors();
  try {
    const w = world();
    await w.scenes.open('home');
    await w.scenes.open('assembly', { machine: 'samosval' });
    const ok = await w.scenes.open('assembly', {});
    assert.equal(ok, false);
    assert.equal(w.scenes.depth(), 2);
    await w.scenes.open('kosmos');
    assert.equal(w.scenes.current(), 'home');
    assert.equal(err.list.length, 2);
  } finally { err.restore(); }
});

test('ошибка в draw ловится, сцена закрывается', async () => {
  const err = captureErrors();
  try {
    const w = world();
    await w.scenes.open('home');
    await w.scenes.open('assembly', { machine: 'samosval' });
    w.scenes.currentScene().draw = () => { throw new Error('рисование'); };
    w.scenes.draw(fakeGraphics());
    assert.equal(w.scenes.current(), 'home');
  } finally { err.restore(); }
});
