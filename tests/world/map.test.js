// Карта-дорожка: порядок остановок, 2.19, 2.20, 2.21, открытие машин после участка, финал, группа 0; прохождение 3.7 (логика).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MapScene, mapStops, SERVICES } from '../../src/world/map.js';
import { BuildScene } from '../../src/world/build.js';
import { HomeScene } from '../../src/world/home.js';
import { captureErrors, memoryStorage, tick } from '../core/helpers.js';
import {
  buildFixture, world, frames, tap, perform, stub, opened, trackingGraphics, crossZoneViolations, textCalls, realData,
} from './fixture.js';
import { HINT } from '../../src/core/ui.js';
// Логику подсказок проверяем на коротких сроках; сами сроки (30 с) — в tests/core/hint.test.js.
Object.assign(HINT, { hand: 5, voice: 10, every: 15 });

const FX = buildFixture();
const REAL = buildFixture({ objects: 'real' });
const STUBS = ['fuel', 'wash', 'repair', 'assembly', 'build'].map(stub);
const say = (fx, id) => fx.data.phrases[id].replace('{name}', fx.data.childName);

async function openMap({ fx = FX, storage, scenes, before } = {}) {
  const w = world(fx, [HomeScene, MapScene].concat(scenes || STUBS), { storage });
  if (before) before(w);
  await w.scenes.open('home');
  w.timer.start();
  await w.scenes.open('map');
  const s = w.scenes.currentScene();
  frames(w, 0.1);
  return { w, s };
}

// Довести карту до покоя (машина доехала) — target появится.
function settle(w, s, max = 6) {
  for (let t = 0; t < max && !s.target && s.phase !== 'finale'; t += 0.05) frames(w, 0.05);
  return s.target;
}

test('остановки: 10 участков × 3 = 30; сервис по кругу, стройка, сборка открытой машины; в конце — финал', () => {
  const stops = mapStops(FX.data.objects);
  assert.equal(stops.length, 30);
  FX.data.objects.forEach((o, i) => {
    assert.equal(stops[i * 3].kind, SERVICES[i % 3]);
    assert.deepEqual([stops[i * 3 + 1].kind, stops[i * 3 + 1].object], ['build', o.id]);
    if (i < 9) assert.deepEqual([stops[i * 3 + 2].kind, stops[i * 3 + 2].machine], ['assembly', o.unlocks]);
  });
  assert.equal(stops[29].kind, 'finale');
  assert.deepEqual(stops.slice(0, 3).map((x) => x.kind), ['fuel', 'build', 'assembly']);
  assert.deepEqual(stops.slice(3, 6).map((x) => x.kind), ['wash', 'build', 'assembly']);
  assert.deepEqual(stops.slice(6, 9).map((x) => x.kind), ['repair', 'build', 'assembly']);
  stops.forEach((x, i) => assert.equal(x.index, i));
  if (realData.objects && realData.objects.length) {
    const real = mapStops(realData.objects);
    assert.equal(real.length, 30);
    assert.deepEqual(real.filter((x) => x.kind === 'assembly').map((x) => x.machine),
      ['traktor', 'buldozer', 'katok', 'betonomeshalka', 'ekskavator', 'pogruzchik', 'avtokran', 'greider', 'bashennyi-kran']);
  }
});

test('2.19 новая игра: открыт первый участок, машина — первая (самосвал), тык по текущей открывает заправку с ней', async () => {
  const { w, s } = await openMap();
  assert.equal(w.progress.mapStop(), 0);
  assert.equal(s.car().id, FX.data.machines[0].id);
  assert.equal(s.stopState(0), 'current');
  for (let i = 1; i < 30; i++) assert.equal(s.stopState(i), 'locked');
  const tg = s.target;
  assert.equal(tg.kind, 'tap');
  assert.ok(tg.x > 96 && tg.x < 1000 && tg.y > 120 && tg.y < 740);
  opened.length = 0;
  perform(w, tg);
  await tick();
  assert.equal(w.scenes.current(), 'fuel');
  assert.deepEqual(opened[0].params, { machine: FX.data.machines[0].id });
});

test('2.20 будущие остановки закрыты («ещё не доехали»); сделал — машина сама едет к следующей; отмена — остаёмся', async () => {
  const { w, s } = await openMap();
  // тык по следующей (закрытой) остановке
  const r = s.stopRect(1);
  w.voices.log.length = 0;
  tap(w, r.x + r.w / 2, r.y + r.h / 2);
  await tick();
  assert.equal(w.scenes.current(), 'map');
  assert.equal(w.voices.log[0], say(FX, 'map-locked'));
  // отмена — остаёмся
  perform(w, s.target);
  await tick();
  w.scenes.back();
  assert.equal(w.progress.mapStop(), 0);
  assert.ok(s.target);
  // сделал — едем дальше, голос «Поехали дальше»
  perform(w, s.target);
  await tick();
  w.voices.log.length = 0;
  w.scenes.currentScene().complete();
  assert.equal(w.progress.mapStop(), 1);
  assert.equal(s.phase, 'drive');
  assert.equal(s.target, null);
  assert.equal(w.voices.log[0], say(FX, 'map-next'));
  settle(w, s);
  assert.equal(s.phase, 'idle');
  opened.length = 0;
  perform(w, s.target);
  await tick();
  assert.equal(w.scenes.current(), 'build');
  assert.deepEqual(opened[0].params, { object: FX.data.objects[0].id });
});

test('2.20 пройденную остановку можно переиграть: открывается её сцена, текущая не меняется', async () => {
  const { w, s } = await openMap({ before: (w) => w.progress.setMapStop(4) });
  assert.equal(s.stopState(1), 'passed');
  // пролистать назад к стройке первого участка
  for (let k = 0; k < 2; k++) {
    w.scenes.pointer({ type: 'down', x: 150, y: 300 });
    w.scenes.pointer({ type: 'move', x: 600, y: 300 });
    w.scenes.pointer({ type: 'move', x: 1000, y: 300 });
    w.scenes.pointer({ type: 'up', x: 1000, y: 300 });
  }
  assert.equal(w.scenes.current(), 'map', 'листание — не тык');
  const tg = s.target; // после листания target, если есть, указывает на текущую остановку там, где она сейчас
  if (tg) { const c = s.stopRect(4); assert.ok(Math.abs(tg.x - (c.x + c.w / 2)) < 2); }
  const r = s.stopRect(1);
  assert.ok(r.x + r.w / 2 > 96 && r.x + r.w / 2 < 1024, 'стройка видна');
  opened.length = 0;
  tap(w, r.x + r.w / 2, r.y + r.h / 2);
  await tick();
  assert.equal(w.scenes.current(), 'build');
  assert.deepEqual(opened[0].params, { object: FX.data.objects[0].id });
  w.scenes.currentScene().complete();
  assert.equal(w.progress.mapStop(), 4);
  assert.equal(s.phase, 'idle');
  // камера возвращается к машине
  frames(w, 5);
  assert.ok(s.target);
});

test('открытие машины: после стройки участка — сборка новой машины («приехала в деталях»); на карте едет самая новая собранная', async () => {
  const { w, s } = await openMap({ before: (w) => w.progress.setMapStop(1) });
  perform(w, s.target);
  await tick();
  assert.equal(w.scenes.current(), 'build');
  const o = FX.data.objects[0];
  w.progress.completeObject(o.id); // как настоящая стройка
  w.voices.log.length = 0;
  w.scenes.currentScene().complete({ object: o.id });
  assert.equal(w.progress.mapStop(), 2);
  assert.equal(w.voices.log[0], say(FX, 'map-new-machine'));
  settle(w, s);
  opened.length = 0;
  perform(w, s.target);
  await tick();
  assert.deepEqual(opened[0], { id: 'assembly', params: { machine: o.unlocks } });
  assert.equal(s.car().id, FX.data.machines[0].id, 'пока новая не собрана — едет прежняя');
  w.scenes.currentScene().complete();
  assert.equal(s.car().id, o.unlocks);
  settle(w, s);
  opened.length = 0;
  perform(w, s.target);
  await tick();
  assert.deepEqual(opened[0], { id: 'wash', params: { machine: o.unlocks } });
});

test('стройку достроили, но вышли крестиком во время салюта — остановка всё равно пройдена', async () => {
  const { w, s } = await openMap({ before: (w) => w.progress.setMapStop(1) });
  perform(w, s.target);
  await tick();
  w.progress.completeObject(FX.data.objects[0].id);
  w.scenes.back();
  assert.equal(w.progress.mapStop(), 2);
});

test('2.21 карта переживает перезапуск игры: та же остановка, та же машина', async () => {
  const storage = memoryStorage();
  let { w, s } = await openMap({ storage });
  for (let i = 0; i < 3; i++) {
    perform(w, settle(w, s));
    await tick();
    if (w.scenes.current() === 'build') w.progress.completeObject(FX.data.objects[0].id);
    w.scenes.currentScene().complete();
  }
  assert.equal(w.progress.mapStop(), 3);
  const car = s.car().id;
  ({ w, s } = await openMap({ storage }));
  assert.equal(w.progress.mapStop(), 3);
  assert.equal(s.car().id, car);
  assert.equal(s.stopState(3), 'current');
});

test('финал: салют и парад всех открытых машин, «Весь город построен»; потом все остановки пройдены', async () => {
  const { w, s } = await openMap({ before: (w) => { w.progress.unlockAll(); w.progress.setMapStop(29); } });
  const tg = settle(w, s);
  w.voices.log.length = 0;
  perform(w, tg);
  assert.equal(s.phase, 'finale');
  assert.equal(s.target, null);
  assert.equal(w.voices.log[0], say(FX, 'map-finale'));
  assert.equal(s.parade.length, 10);
  for (let i = 0; i < 40; i++) {
    frames(w, 0.1);
    const g = trackingGraphics();
    s.draw(g);
    assert.deepEqual(crossZoneViolations(g), []);
  }
  frames(w, 20);
  assert.equal(s.phase, 'idle');
  assert.equal(w.progress.mapStop(), 30);
  assert.equal(s.target, null);
  for (let i = 0; i < 30; i++) assert.equal(s.stopState(i), 'passed');
  // финал можно посмотреть ещё раз
  const r = s.stopRect(29);
  tap(w, r.x + r.w / 2, r.y + r.h / 2);
  assert.equal(s.phase, 'finale');
});

test('0.1 / 0.2 / 0.6 карта: 100 кадров в начале, середине и конце — без ошибок, заглушек, надписей, зоны крестика', async () => {
  const err = captureErrors();
  try {
    for (const stop of [0, 14, 29, 30]) {
      const { w, s } = await openMap({ before: (w) => w.progress.setMapStop(stop) });
      for (let i = 0; i < 100; i++) {
        frames(w, 0.07);
        const g = trackingGraphics();
        s.draw(g);
        assert.deepEqual(crossZoneViolations(g), [], 'остановка ' + stop);
        assert.equal(textCalls(g).length, 0);
      }
      if (stop < 30) assert.ok(s.hint.showHand());
      assert.equal(w.assets.placeholderCount, 0);
    }
    assert.deepEqual(err.list, []);
  } finally { err.restore(); }
});

test('подсказки карты: рука на текущей остановке через 5 с, голос через 10 с', async () => {
  const { w, s } = await openMap();
  w.voices.log.length = 0;
  frames(w, 5.2);
  const g = trackingGraphics();
  s.draw(g);
  const hand = g.drawn.find((d) => d.op === 'drawImage' && Math.round(d.w) === 110);
  assert.ok(hand && Math.abs(hand.x + 38 - s.target.x) < 5);
  frames(w, 5);
  assert.equal(w.voices.log[0], say(FX, 'map-hint'));
});

test('0.4 утечки: 50 входов и выходов на карту', async () => {
  const { w } = await openMap();
  w.scenes.back();
  const before = w.progress.listeners.size;
  for (let i = 0; i < 50; i++) {
    await w.scenes.open('map');
    frames(w, 0.1);
    perform(w, w.scenes.currentScene().target);
    await tick();
    w.scenes.back(); // из заправки
    w.scenes.back(); // с карты
  }
  assert.equal(w.progress.listeners.size, before);
  assert.equal(w.scenes.depth(), 1);
  assert.equal(w.audio.activeSounds(), 0);
});

test('3.7 (логика) весь путь по карте с настоящей стройкой: 30 остановок, машины открываются по таблице, финал', async () => {
  const fx = realData.objects && realData.objects.length ? REAL : FX;
  const err = captureErrors();
  try {
    const scenes = [BuildScene].concat(['fuel', 'wash', 'repair', 'assembly'].map(stub));
    const { w, s } = await openMap({ fx, scenes });
    const unlockedAfter = [];
    let guard = 0;
    while (w.progress.mapStop() < 30 && guard++ < 100000) {
      const cur = w.scenes.currentScene();
      if (cur === s) {
        const tg = settle(w, s);
        if (s.phase === 'finale') { frames(w, 0.5); continue; }
        if (tg) { perform(w, tg); await tick(); }
        continue;
      }
      if (cur.complete) { cur.complete(); continue; }
      // стройка: выполняем, что она ждёт
      const tg = cur.target;
      if (tg) perform(w, tg); else frames(w, 0.05);
      if (guard % 20 === 0) { w.voices.finishCurrent(); await tick(); }
      if (w.scenes.currentScene() === s) unlockedAfter.push(fx.data.machines.filter((m) => w.progress.isUnlocked(m.id)).length);
    }
    assert.equal(w.progress.mapStop(), 30);
    assert.ok(fx.data.objects.every((o) => w.progress.objectState(o.id).done));
    assert.deepEqual(unlockedAfter, [2, 3, 4, 5, 6, 7, 8, 9, 10, 10]);
    assert.ok(fx.data.machines.slice(1).every((m) => w.progress.isAssembled(m.id)), 'все открытые стройкой машины собраны на карте');
    assert.deepEqual(err.list, []);
  } finally { err.restore(); }
});
