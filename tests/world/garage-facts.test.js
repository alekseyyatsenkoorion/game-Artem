// Гараж: факты по кругу (первый — factWithPicture) и карточка с картинкой к этому факту.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenes as worldScenes } from '../../src/world/index.js';
import { GARAGE_SCENES, GarageScene, factOrder, nextFact, resetFacts } from '../../src/world/garage.js';
import { CROSS_ZONE, rectsOverlap } from '../../src/core/draw-utils.js';
import { makeWorld, fakeGraphics, tick } from '../core/helpers.js';
import { buildFixture, stub, frames, tap } from './fixture.js';

const FX = buildFixture();
const IDS = FX.data.machines.map((m) => m.id);
const text = (id) => FX.data.phrases[id];

async function bigWorld() {
  resetFacts();
  const w = makeWorld({ data: FX.data, art: FX.art, scenes: [...worldScenes, ...GARAGE_SCENES.map(stub)] });
  await w.scenes.open('home');
  w.timer.start();
  w.progress.unlockAll();
  for (const id of IDS) w.progress.setAssembled(id);
  await w.scenes.open('garage');
  frames(w, 0.1);
  return { w, s: w.scenes.currentScene() };
}
function select(w, s, id) {
  const r = s.slots.find((x) => x.machine === id).rect;
  tap(w, r.x + r.w / 2, r.y + r.h / 2);
  frames(w, 0.7);
  assert.equal(s.selected, id);
  assert.equal(s.mode, 'big');
}
async function finishPhrase(w) {
  w.voices.finishCurrent();
  await tick(); await tick();
}
function leave(w, s) {
  tap(w, 960, 140);
  frames(w, 0.5);
  assert.equal(s.mode, 'row');
  w.audio.clearVoice();
  w.voices.pending.length = 0;
}

test('факты: порядок по кругу, начиная с factWithPicture', () => {
  resetFacts();
  const m = { id: 'fx-m', facts: ['f1', 'f2', 'f3', 'f4'], factWithPicture: 'f3' };
  assert.deepEqual(factOrder(m), ['f3', 'f4', 'f1', 'f2']);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(() => nextFact(m)), ['f3', 'f4', 'f1', 'f2', 'f3', 'f4']);
  // без factWithPicture — с первого
  assert.deepEqual(factOrder({ id: 'y', facts: ['a', 'b'] }), ['a', 'b']);
  assert.equal(nextFact({ id: 'z', facts: [] }), null);
  // у настоящих машин первый факт — с картинкой, и картинка fact/<id> в ресурсах гаража
  const assets = GarageScene.assets();
  for (const mm of FX.data.machines) {
    assert.equal(factOrder(mm)[0], mm.factWithPicture, mm.id);
    assert.ok(assets.includes('fact/' + mm.id), mm.id);
  }
});

test('гараж: голос говорит факты машины по кругу, первым — факт с картинкой', async () => {
  const { w, s } = await bigWorld();
  const m = FX.data.machines[0];
  const order = factOrder(m);
  for (let i = 0; i < order.length + 1; i++) {
    w.voices.log.length = 0;
    select(w, s, m.id);
    assert.equal(w.voices.log[0], text(m.namePhrase));
    await finishPhrase(w);
    assert.equal(w.voices.log[1], text(order[i % order.length]), 'факт №' + i);
    leave(w, s);
  }
});

test('гараж: карточка с картинкой видна только с фактом factWithPicture, держится ~2 с после фразы', async () => {
  const { w, s } = await bigWorld();
  const m = FX.data.machines[1];
  select(w, s, m.id);
  // пока звучит имя — карточки ещё нет
  assert.equal(s.factCard(), null);
  await finishPhrase(w); // имя договорено — начался факт с картинкой
  frames(w, 0.6);
  const c = s.factCard();
  assert.ok(c, 'карточка видна');
  assert.equal(c.img, 'fact/' + m.id);
  assert.equal(c.alpha, 1);
  // не перекрывает машину, значки и зону крестика; внутри экрана
  const mr = s.selectedRect();
  assert.ok(!rectsOverlap(c.rect, mr), 'машина');
  for (const ic of s.icons) assert.ok(!rectsOverlap(c.rect, ic.rect), 'значок');
  assert.ok(!rectsOverlap(c.rect, CROSS_ZONE));
  assert.ok(c.rect.x + c.rect.w <= 1024 && c.rect.y + c.rect.h <= 768);
  // картинка рисуется
  const g = fakeGraphics();
  s.draw(g);
  assert.ok(g.calls.some((x) => x.op === 'drawImage' && x.w > 300 && x.x >= c.rect.x));
  frames(w, 3);
  assert.ok(s.factCard(), 'держится, пока звучит фраза');
  await finishPhrase(w); // факт договорён
  frames(w, 1.5);
  assert.ok(s.factCard(), 'ещё ~2 с после фразы');
  frames(w, 1.2);
  assert.equal(s.factCard(), null, 'потом исчезает');
  leave(w, s);
  // второй раз — другой факт, без картинки
  select(w, s, m.id);
  await finishPhrase(w);
  assert.notEqual(w.voices.log[w.voices.log.length - 1], text(m.factWithPicture));
  for (let i = 0; i < 10; i++) { frames(w, 0.3); assert.equal(s.factCard(), null); }
});

test('гараж: карточка сразу прячется при выходе из крупного режима и при открытии значка', async () => {
  const { w, s } = await bigWorld();
  const m = FX.data.machines[2];
  select(w, s, m.id);
  await finishPhrase(w);
  frames(w, 0.6);
  assert.ok(s.factCard());
  tap(w, 960, 140);
  assert.equal(s.factCard(), null);
  frames(w, 0.5);
  assert.equal(s.mode, 'row');
  await finishPhrase(w);
  frames(w, 0.5);
  assert.equal(s.factCard(), null);

  // значок: открылась другая сцена — карточки нет и после возвращения
  resetFacts();
  w.audio.clearVoice();
  w.voices.pending.length = 0;
  select(w, s, m.id);
  await finishPhrase(w);
  frames(w, 0.6);
  assert.ok(s.factCard());
  const ic = s.icons.find((x) => x.scene === 'wash');
  tap(w, ic.rect.x + ic.rect.w / 2, ic.rect.y + ic.rect.h / 2);
  assert.equal(s.factCard(), null);
  await tick();
  w.scenes.currentScene().complete();
  await tick();
  frames(w, 0.5);
  assert.equal(s.mode, 'big');
  assert.equal(s.factCard(), null);
});
