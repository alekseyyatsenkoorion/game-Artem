// Зона «Карта и стройка»: главный экран, гараж, экран для взрослых, «Машины спят».
// Группа 0 (0.1, 0.2, 0.3, 0.4, 0.6, 0.11), логика гаража и временное правило этапа 2, 2.24, 2.33.
// Тесты не зависят от готовности зоны «Контент»: если машин в данных меньше 10, добавляются
// копии первой машины с другими id (своими фразами и картинками).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenes as worldScenes } from '../../src/world/index.js';
import { ENTRIES } from '../../src/world/home.js';
import { STAGE2_SCENES } from '../../src/world/garage.js';
import { Scene } from '../../src/core/scene.js';
import realData from '../../src/data/index.js';
import realArt from '../../src/art/index.js';
import { UI_ART } from '../../src/core/ui.js';
import { CROSS_ZONE, rectsOverlap, inRect } from '../../src/core/draw-utils.js';
import { makeWorld, fakeGraphics, captureErrors, tick } from '../core/helpers.js';

// ---------- тестовые данные: всегда 10 машин ----------

const FALLBACK_PHRASES = {
  'home-hint': '{name}, нажми на гараж!',
  'home-closed': 'Сюда поедем потом!',
  'garage-hint': '{name}, выбери машину!',
  'garage-actions': 'Что будем делать? Собрать, пазл или помыть?',
  'garage-new': 'Новая машина приехала! Давай её соберём!',
  'garage-locked': 'Эта машина ещё не приехала. Собери другие машины!',
  'puzzle-locked': 'Сначала собери маленький пазл!',
};

function buildFixture() {
  const sorted = realData.machines.slice().sort((a, b) => a.order - b.order);
  const base = sorted[0];
  const machines = sorted.slice(0, 10);
  const phrases = Object.assign({}, FALLBACK_PHRASES, realData.phrases);
  const art = Object.assign({}, realArt, UI_ART);
  for (let i = machines.length; i < 10; i++) {
    const id = 'test-m' + (i + 1);
    machines.push(Object.assign({}, base, {
      id, order: i + 1, namePhrase: 'machine-' + id, nameAccPhrase: 'machine-' + id + '-acc',
      facts: ['fact-' + id + '-1', 'fact-' + id + '-2'], factWithPicture: 'fact-' + id + '-1',
    }));
    phrases['machine-' + id] = 'Машина ' + (i + 1);
    phrases['machine-' + id + '-acc'] = 'машину ' + (i + 1);
    phrases['fact-' + id + '-1'] = 'Факт один про машину ' + (i + 1);
    phrases['fact-' + id + '-2'] = 'Факт два про машину ' + (i + 1);
    const prefix = 'machine/' + base.id + '/';
    for (const k of Object.keys(realArt)) if (k.startsWith(prefix)) art['machine/' + id + '/' + k.slice(prefix.length)] = realArt[k];
  }
  // Машины, чьих картинок зона «Контент» ещё не нарисовала, — простые прямоугольники нужного размера.
  const box = (w, h) => ({ w, h, draw: (g) => { g.fillStyle = '#e8a33a'; g.fillRect(0, 0, w, h); } });
  for (const m of realData.machines) {
    for (const pose of ['idle', 'work', 'dirty', 'silhouette']) {
      const k = 'machine/' + m.id + '/whole/' + pose;
      if (!art[k]) art[k] = box(m.size.w, m.size.h);
    }
    for (const p of m.parts) if (!art['machine/' + m.id + '/part/' + p.id]) art['machine/' + m.id + '/part/' + p.id] = box(p.w, p.h);
  }
  // Фон гаража рисует зона «Контент»; пока его нет — простая заливка, чтобы проверять свои заглушки.
  if (!art['bg/garage']) art['bg/garage'] = { w: 1024, h: 768, draw: (g) => { g.fillStyle = '#ccc'; g.fillRect(0, 0, 1024, 768); } };
  for (const id of ['bg/home', 'bg/locked']) if (!art[id]) art[id] = art['bg/garage'];
  const data = Object.assign({}, realData, { machines, phrases });
  return { data, art };
}
const FX = buildFixture();
const IDS = FX.data.machines.map((m) => m.id);
const say = (id) => FX.data.phrases[id].replace('{name}', FX.data.childName);

// Сцены мини-игр — подмены: запоминают параметры; сборка по команде теста отмечает машину собранной.
const opened = [];
function stub(id) {
  return class extends Scene {
    static id = id;
    enter(params) { this.params = params; opened.push({ id, params }); }
    complete() {
      if (id === 'assembly') this.ctx.progress.setAssembled(this.params.machine);
      this.ctx.scenes.finish({ done: true, machine: this.params.machine });
    }
  };
}
const STUBS = STAGE2_SCENES.map(stub);

async function world({ only } = {}) {
  const stubs = only ? STUBS.filter((S) => only.includes(S.id)) : STUBS;
  const w = makeWorld({ data: FX.data, art: FX.art, scenes: [...worldScenes, ...stubs] });
  await w.scenes.open('home');
  w.timer.start();
  return w;
}
const frames = (w, sec, dt = 0.05) => { for (let t = 0; t < sec; t += dt) { w.timer.tick(dt); w.scenes.update(dt); } };
const tap = (w, x, y) => { w.scenes.pointer({ type: 'down', x, y }); w.scenes.pointer({ type: 'up', x, y }); };
const center = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const tapRect = (w, r) => tap(w, ...center(r));

async function garage(w) {
  await w.scenes.open('garage');
  frames(w, 0.1);
  return w.scenes.currentScene();
}
const slot = (s, id) => s.slots.find((x) => x.machine === id);
async function bigMachine(w, s, id) {
  tapRect(w, slot(s, id).rect);
  frames(w, 0.7);
  assert.equal(s.selected, id);
}

function assertNoCross(g, label) {
  // первая картинка — фон на весь экран
  for (const c of g.calls.filter((c) => c.op === 'drawImage').slice(1)) {
    assert.ok(!rectsOverlap({ x: c.x, y: c.y, w: c.w, h: c.h }, CROSS_ZONE), label + ': картинка в зоне крестика ' + JSON.stringify(c));
  }
}

// ---------- группа 0 ----------

test('0.1 / 0.2 / 0.6 каждая сцена: 100 кадров без ошибок, без заглушек, ничего в зоне крестика', async () => {
  const err = captureErrors();
  try {
    for (const id of ['home', 'garage', 'garage-big', 'parent', 'locked']) {
      const w = await world();
      w.progress.unlockAll();
      for (const m of IDS.slice(0, 6)) w.progress.setAssembled(m);
      let s;
      if (id === 'garage' || id === 'garage-big') {
        s = await garage(w);
        if (id === 'garage-big') await bigMachine(w, s, IDS[0]);
      } else {
        if (id !== 'home') await w.scenes.open(id);
        s = w.scenes.currentScene();
      }
      for (let i = 0; i < 100; i++) {
        s.update(0.016);
        if (i === 50) frames(w, 6); // показать руку-подсказку
        const g = fakeGraphics();
        s.draw(g);
        for (const c of g.calls.filter((c) => c.op === 'fillText')) assert.ok(!(c.args[1] < 96 && c.args[2] < 96), 'текст в зоне крестика');
        assertNoCross(g, id);
      }
      assert.equal(w.assets.placeholderCount, 0, id);
    }
    assert.deepEqual(err.list, []);
  } finally { err.restore(); }
});

test('0.6 гараж: во время выезда машины и приезда новой ничего не рисуется в зоне крестика', async () => {
  const w = await world();
  const s = await garage(w);
  w.progress.setAssembled(IDS[0]);
  frames(w, 0.1);
  tapRect(w, slot(s, IDS[0]).rect);
  for (let i = 0; i < 20; i++) { frames(w, 0.05); const g = fakeGraphics(); s.draw(g); assertNoCross(g, 'выезд'); }
  tap(w, 900, 60);
  for (let i = 0; i < 10; i++) { frames(w, 0.05); const g = fakeGraphics(); s.draw(g); assertNoCross(g, 'возврат'); }
});

test('0.3 гараж и главный экран: выход из любого состояния, звуков после выхода нет', async () => {
  const w = await world();
  const s = await garage(w);
  w.progress.setAssembled(IDS[0]);
  frames(w, 0.1);
  tapRect(w, slot(s, IDS[0]).rect); // выезжает, гудит, говорит
  frames(w, 0.2);
  w.scenes.back();
  assert.equal(w.scenes.current(), 'home');
  assert.equal(w.audio.activeSounds(), 0);
  assert.equal(w.audio.isSpeaking(), false);
  // с главного — тык по гаражу, и сразу из гаража назад
  const h = w.scenes.currentScene();
  tapRect(w, h.entries.find((e) => e.id === 'garage').rect);
  frames(w, 1);
  await tick();
  assert.equal(w.scenes.current(), 'garage');
  w.scenes.back();
  assert.equal(w.scenes.current(), 'home');
  assert.equal(w.audio.activeSounds(), 0);
});

test('0.4 утечки: 50 входов и выходов в гараж — подписки на прогресс не копятся', async () => {
  const w = await world();
  w.progress.setAssembled(IDS[0]);
  const before = w.progress.listeners.size;
  for (let i = 0; i < 50; i++) {
    const s = await garage(w);
    tapRect(w, slot(s, IDS[0]).rect); // машина выезжает крупно
    frames(w, 0.1);
    assert.equal(w.scenes.current(), 'garage');
    w.scenes.back();
  }
  assert.equal(w.progress.listeners.size, before);
  assert.equal(w.scenes.depth(), 1);
  assert.equal(w.audio.activeSounds(), 0);
});

test('0.11 неизвестная машина в прогрессе и неизвестная сцена: журнал, без исключения', async () => {
  const err = captureErrors();
  try {
    const w = await world({ only: ['assembly'] }); // мини-игр B ещё нет
    const s = await garage(w);
    w.progress.setAssembled(IDS[0]);
    frames(w, 0.1);
    await bigMachine(w, s, IDS[0]);
    assert.deepEqual(s.icons.map((i) => i.scene), ['assembly']); // незарегистрированных значков нет
    // странные результаты не роняют гараж
    for (const r of [undefined, null, {}, { cancelled: true }, { done: true, machine: 'nets-takoi' }]) s.onResult(r);
    frames(w, 0.5);
    assert.equal(w.scenes.current(), 'garage');
    assert.equal(s.mode, 'row');
    // неизвестная машина в прогрессе — журнал, без исключения
    assert.equal(w.progress.isUnlocked('nets-takoi'), false);
    assert.ok(err.list.some((x) => x.includes('nets-takoi')));
  } finally { err.restore(); }
});

// ---------- главный экран ----------

test('главный экран: три входа, работает только гараж; ни один вход не залезает в зону крестика', async () => {
  const w = await world();
  const h = w.scenes.currentScene();
  assert.deepEqual(h.entries.map((e) => e.id), ['map', 'garage', 'tug']);
  assert.deepEqual(h.entries.map((e) => e.active), [false, true, false]);
  for (const e of h.entries) {
    assert.ok(e.rect.w >= 100 && e.rect.h >= 100, e.id);
    assert.ok(!rectsOverlap(e.rect, CROSS_ZONE), e.id);
    assert.ok(e.rect.x >= 0 && e.rect.y >= 0 && e.rect.x + e.rect.w <= 1024 && e.rect.y + e.rect.h <= 768, e.id);
  }
  assert.equal(ENTRIES.length, 3);
});

test('главный экран: закрытые входы не открывают сцен — фраза «потом» и гудок', async () => {
  const w = await world();
  const h = w.scenes.currentScene();
  for (const id of ['map', 'tug']) {
    tapRect(w, h.entries.find((e) => e.id === id).rect);
    frames(w, 1.5);
    await tick();
    assert.equal(w.scenes.current(), 'home', id);
  }
  assert.ok(w.voices.log.includes(say('home-closed')));
});

test('главный экран: тык по гаражу открывает гараж; простой — рука и голос «нажми на гараж»', async () => {
  const w = await world();
  frames(w, 10.2);
  await tick();
  assert.equal(w.voices.log[0], say('home-hint'));
  const h = w.scenes.currentScene();
  assert.ok(h.hint.showHand());
  tapRect(w, h.entries.find((e) => e.id === 'garage').rect);
  frames(w, 1);
  await tick();
  assert.equal(w.scenes.current(), 'garage');
  w.scenes.back();
  assert.equal(w.scenes.current(), 'home');
  assert.equal(h.state, 'idle');
});

// ---------- гараж ----------

test('гараж: 10 машин по порядку, два ряда по 5, зоны касания ≥ 100 и не перекрываются', async () => {
  const w = await world();
  const s = await garage(w);
  assert.deepEqual(s.slots.map((x) => x.machine), IDS);
  const ys = Array.from(new Set(s.slots.map((x) => x.rect.y)));
  assert.equal(ys.length, 2);
  for (const [i, a] of s.slots.entries()) {
    assert.ok(a.rect.w >= 100 && a.rect.h >= 100);
    assert.ok(!rectsOverlap(a.rect, CROSS_ZONE));
    assert.ok(a.rect.x >= 0 && a.rect.x + a.rect.w <= 1024 && a.rect.y + a.rect.h <= 768);
    for (const b of s.slots.slice(i + 1)) assert.ok(!rectsOverlap(a.rect, b.rect));
  }
});

test('гараж: три состояния машин — закрыта, детали, собрана', async () => {
  const w = await world();
  w.progress.unlock(IDS[1]);
  w.progress.setAssembled(IDS[0]);
  const s = await garage(w);
  assert.equal(slot(s, IDS[0]).state, 'ready');
  assert.equal(slot(s, IDS[1]).state, 'parts');
  for (const id of IDS.slice(2)) assert.equal(slot(s, id).state, 'locked');
  // что рисуется: силуэт у закрытой, силуэт-контур и детали у несобранной, целая у собранной
  assert.equal(s.waiting(), IDS[1]);
});

test('гараж: тык по закрытой — фраза «ещё не приехала», ничего не открывается', async () => {
  const w = await world();
  const s = await garage(w);
  tapRect(w, slot(s, IDS[5]).rect);
  frames(w, 0.5);
  await tick();
  assert.equal(w.scenes.current(), 'garage');
  assert.equal(s.selected, null);
  assert.ok(w.voices.log.includes(say('garage-locked')));
});

test('гараж: тык по несобранной — сразу сборка этой машины', async () => {
  const w = await world();
  const s = await garage(w);
  opened.length = 0;
  tapRect(w, slot(s, IDS[0]).rect);
  await tick();
  assert.equal(w.scenes.current(), 'assembly');
  assert.deepEqual(opened[0], { id: 'assembly', params: { machine: IDS[0] } });
});

test('3.2 гараж: тык по каждой собранной машине показывает её крупно, голос называет её и говорит факт', async () => {
  const w = await world();
  w.progress.unlockAll();
  for (const id of IDS) w.progress.setAssembled(id);
  const s = await garage(w);
  for (const m of FX.data.machines) {
    w.voices.log.length = 0;
    await bigMachine(w, s, m.id);
    const r = s.selectedRect();
    assert.ok(r.w >= 300, 'машина крупная');
    assert.equal(w.voices.log[0], FX.data.phrases[m.namePhrase]);
    // имя договорено — следом факт
    w.voices.finishCurrent();
    await tick(); await tick();
    assert.ok(m.facts.map((f) => FX.data.phrases[f]).includes(w.voices.log[1]), 'факт: ' + w.voices.log[1]);
    w.audio.clearVoice();
    w.voices.pending.length = 0; // снятые фразы подмена голоса не убирает сама
    // тык мимо машины и значков — назад к ряду
    tap(w, 960, 140);
    frames(w, 0.5);
    assert.equal(s.selected, null);
    assert.equal(s.mode, 'row');
  }
});

test('гараж: каждый значок открывает свою сцену с правильными параметрами; результат — снова крупная машина', async () => {
  const w = await world();
  const id = IDS[3];
  w.progress.unlockAll();
  for (const m of IDS) w.progress.setAssembled(m);
  w.progress.savePuzzle(id, 16, Array.from({ length: 16 }, (_, i) => i)); // пазл 16 собран — 25 открыт
  const s = await garage(w);
  await bigMachine(w, s, id);
  assert.equal(s.icons.length, 6);
  const expect = [
    ['assembly', { machine: id }], ['puzzle', { machine: id, size: 16 }], ['puzzle', { machine: id, size: 25 }],
    ['wash', { machine: id }], ['repair', { machine: id }], ['fuel', { machine: id }],
  ];
  for (let i = 0; i < expect.length; i++) {
    const ic = s.icons[i];
    assert.ok(ic.rect.w >= 100 && ic.rect.h >= 100);
    assert.ok(!rectsOverlap(ic.rect, CROSS_ZONE));
    opened.length = 0;
    tapRect(w, ic.rect);
    await tick();
    assert.equal(w.scenes.current(), expect[i][0]);
    assert.deepEqual(opened[0].params, expect[i][1]);
    w.scenes.currentScene().complete();
    assert.equal(w.scenes.current(), 'garage');
    assert.equal(s.mode, 'big');
    assert.equal(s.selected, id);
    // и после крестика тоже
    tapRect(w, s.icons[i].rect);
    await tick();
    w.scenes.back();
    assert.equal(s.mode, 'big');
  }
});

test('2.37 гараж: пазл 25 закрыт, пока не собран пазл 16 — тык говорит «сначала маленький»', async () => {
  const w = await world();
  const id = IDS[0];
  w.progress.setAssembled(id);
  const s = await garage(w);
  await bigMachine(w, s, id);
  const p25 = s.icons.find((i) => i.params.size === 25);
  assert.equal(p25.locked, true);
  assert.equal(s.icons.find((i) => i.params.size === 16).locked, false);
  w.audio.clearVoice(); w.voices.log.length = 0;
  tapRect(w, p25.rect);
  await tick();
  assert.equal(w.scenes.current(), 'garage');
  assert.equal(w.voices.log[0], say('puzzle-locked'));
  // собрал пазл 16 — 25 открылся
  tapRect(w, s.icons.find((i) => i.params.size === 16).rect);
  await tick();
  w.progress.savePuzzle(id, 16, Array.from({ length: 16 }, (_, i) => i));
  w.scenes.finish({ done: true, machine: id, size: 16 });
  assert.equal(s.icons.find((i) => i.params.size === 25).locked, false);
  tapRect(w, s.icons.find((i) => i.params.size === 25).rect);
  await tick();
  assert.equal(w.scenes.current(), 'puzzle');
});

test('гараж: значок не показывается, если сцена не зарегистрирована', async () => {
  const w = await world({ only: ['assembly', 'puzzle'] });
  w.progress.setAssembled(IDS[0]);
  const s = await garage(w);
  await bigMachine(w, s, IDS[0]);
  assert.deepEqual(s.icons.map((i) => i.icon), ['ui/icon-assembly', 'ui/icon-puzzle16', 'ui/icon-puzzle25']);
});

test('временное правило этапа 2: собрал машину — приезжает следующая по порядку', async () => {
  const w = await world();
  const s = await garage(w);
  for (let i = 0; i < IDS.length; i++) {
    const id = IDS[i];
    assert.equal(s.waiting(), id);
    tapRect(w, slot(s, id).rect);
    await tick();
    assert.equal(w.scenes.current(), 'assembly');
    w.voices.log.length = 0;
    w.scenes.currentScene().complete();
    assert.equal(w.scenes.current(), 'garage');
    assert.equal(slot(s, id).state, 'ready');
    if (i + 1 < IDS.length) {
      assert.equal(w.progress.isUnlocked(IDS[i + 1]), true);
      assert.equal(slot(s, IDS[i + 1]).state, 'parts');
      assert.ok(s.arrivals[IDS[i + 1]] !== undefined, 'новая машина приезжает');
      assert.equal(w.voices.log[0], say('garage-new'));
      if (i + 2 < IDS.length) assert.equal(w.progress.isUnlocked(IDS[i + 2]), false);
    }
    frames(w, 2);
  }
  assert.ok(IDS.every((id) => w.progress.isAssembled(id)));
});

test('временное правило: пересборка уже собранной машины не трогает открытую следующую; выход без сборки ничего не открывает', async () => {
  const w = await world();
  const s = await garage(w);
  tapRect(w, slot(s, IDS[0]).rect);
  await tick();
  w.scenes.back(); // крестик посреди сборки
  assert.equal(w.progress.isUnlocked(IDS[1]), false);
  assert.equal(s.mode, 'row');
  tapRect(w, slot(s, IDS[0]).rect);
  await tick();
  w.scenes.currentScene().complete();
  frames(w, 2);
  await bigMachine(w, s, IDS[0]);
  tapRect(w, s.icons[0].rect); // собрать заново
  await tick();
  w.voices.log.length = 0;
  w.scenes.currentScene().complete();
  assert.equal(w.progress.isUnlocked(IDS[2]), false);
  assert.ok(!w.voices.log.includes(say('garage-new')));
  assert.equal(s.mode, 'big');
});

test('временное правило: машина, собранная раньше, при входе в гараж открывает следующую', async () => {
  const w = await world();
  w.progress.setAssembled(IDS[0]);
  const s = await garage(w);
  assert.equal(w.progress.isUnlocked(IDS[1]), true);
  assert.equal(slot(s, IDS[1]).state, 'parts');
});

test('гараж: подсказки — подсветка и рука на машине, что ждёт сборки, голос через 10 с', async () => {
  const w = await world();
  w.progress.setAssembled(IDS[0]);
  const s = await garage(w);
  frames(w, 2); // следующая машина приезжает — подсказки ждут
  w.voices.log.length = 0;
  frames(w, 5.2);
  assert.ok(s.hint.showHand());
  const g = fakeGraphics();
  s.draw(g);
  const hand = g.calls.filter((c) => c.op === 'drawImage').pop();
  assert.ok(inRect(hand.x + 110 * 0.35, hand.y, slot(s, IDS[1]).rect), 'рука над машиной, что ждёт сборки');
  frames(w, 5);
  assert.equal(w.voices.log[0], say('garage-hint'));
});

test('гараж: таймер — блокировка в спокойной точке после результата', async () => {
  const w = await world();
  const s = await garage(w);
  w.timer.testRun();
  tapRect(w, slot(s, IDS[0]).rect);
  await tick();
  frames(w, 61);
  assert.equal(w.scenes.current(), 'assembly'); // задание доигрывается
  w.scenes.currentScene().complete();
  await tick();
  assert.equal(w.scenes.current(), 'locked');
});

// ---------- экран взрослых ----------

function press(w, label) {
  const s = w.scenes.currentScene();
  const b = s.buttons.find((x) => x.label === label || x.id === label);
  w.scenes.pointer({ type: 'down', x: b.x + 10, y: b.y + 10 });
  w.scenes.pointer({ type: 'up', x: b.x + 10, y: b.y + 10 });
}

test('2.24 «Открыть все машины» и «Сбросить прогресс» с 10 машинами; гараж под экраном взрослых обновляется', async () => {
  const w = await world();
  const s = await garage(w);
  w.progress.setAssembled(IDS[0]);
  frames(w, 0.1);
  await bigMachine(w, s, IDS[0]);
  await w.scenes.open('parent');
  press(w, 'unlock-all');
  assert.ok(IDS.every((id) => w.progress.isUnlocked(id)));
  press(w, 'reset');
  assert.equal(w.progress.isAssembled(IDS[0]), true); // первый тык — только вопрос
  press(w, 'reset');
  assert.ok(IDS.slice(1).every((id) => !w.progress.isUnlocked(id)));
  assert.ok(IDS.every((id) => !w.progress.isAssembled(id)));
  assert.equal(w.progress.isUnlocked(IDS[0]), true);
  press(w, 'close');
  assert.equal(w.scenes.current(), 'garage');
  frames(w, 0.1);
  assert.equal(s.selected, null); // крупная машина больше не собрана — назад к ряду
  assert.deepEqual(s.slots.map((x) => x.state), ['parts'].concat(IDS.slice(1).map(() => 'locked')));
  // открыть все — в гараже все машины открыты
  await w.scenes.open('parent');
  press(w, 'unlock-all');
  press(w, 'close');
  frames(w, 0.1);
  assert.ok(s.slots.every((x) => x.state === 'parts'));
});

test('экран взрослых: длительность таймера, версия из updater, проверка таймера', async () => {
  const w = await world();
  await w.scenes.open('parent');
  const g = fakeGraphics();
  w.scenes.currentScene().draw(g);
  assert.ok(g.calls.some((c) => c.op === 'fillText' && String(c.args[0]).includes('Версия игры: ' + w.ctx.updater.version())));
  press(w, 'min-15');
  assert.equal(w.timer.remaining(), 15 * 60);
  assert.equal(w.progress.setting('timerMinutes'), 15);
  press(w, 'min-0');
  assert.equal(w.timer.remaining(), Infinity);
  press(w, 'test');
  assert.equal(w.scenes.current(), 'home');
  assert.equal(w.timer.remaining(), 60);
  frames(w, 61);
  await tick();
  assert.equal(w.scenes.current(), 'locked');
});

test('2.33 таймер: задание доигрывается, блокировка на главном экране; снять — только экран взрослых', async () => {
  const w = await world();
  w.timer.testRun();
  await w.scenes.open('assembly', { machine: IDS[0] });
  frames(w, 61);
  assert.equal(w.scenes.current(), 'assembly');
  w.scenes.back();
  frames(w, 0.1);
  await tick();
  assert.equal(w.scenes.current(), 'locked');
  assert.equal(w.timer.isLocked(), true);
  tap(w, 40, 40); tap(w, 500, 500);
  frames(w, 1);
  assert.equal(w.scenes.current(), 'locked');
  await w.scenes.open('parent');
  assert.equal(w.timer.isLocked(), false);
  w.scenes.back();
  frames(w, 0.1);
  assert.equal(w.scenes.current(), 'home');
});
