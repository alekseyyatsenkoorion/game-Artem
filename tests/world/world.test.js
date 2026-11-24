// Зона «Карта и стройка»: главный экран, гараж, экран для взрослых, «Машины спят».
// Группа 0 (0.1, 0.2, 0.3, 0.4, 0.6, 0.11), 3.1 (три входа), гараж и режим выбора для каната, 2.24, 2.33.
// Машины открывает стройка: временное правило этапа 2 (собрал — открылась следующая) убрано.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenes as worldScenes } from '../../src/world/index.js';
import { ENTRIES } from '../../src/world/home.js';
import { GARAGE_SCENES, ICONS } from '../../src/world/garage.js';
import { CROSS_ZONE, rectsOverlap, inRect } from '../../src/core/draw-utils.js';
import { makeWorld, fakeGraphics, captureErrors, tick } from '../core/helpers.js';
import { buildFixture, stub, opened, perform } from './fixture.js';

const FX = buildFixture();
const IDS = FX.data.machines.map((m) => m.id);
const say = (id) => FX.data.phrases[id].replace('{name}', FX.data.childName);

const STUBS = GARAGE_SCENES.concat(['tug', 'fuel', 'repair']).map(stub);

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
    for (const id of ['home', 'garage', 'garage-big', 'garage-tug', 'map', 'parent', 'locked']) {
      const w = await world();
      w.progress.unlockAll();
      for (const m of IDS.slice(0, 6)) w.progress.setAssembled(m);
      let s;
      if (id === 'garage-tug') {
        await w.scenes.open('garage', { mode: 'tug' });
        s = w.scenes.currentScene();
      } else if (id === 'garage' || id === 'garage-big') {
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

test('главный экран: три входа, все работают; ни один вход не залезает в зону крестика', async () => {
  const w = await world();
  const h = w.scenes.currentScene();
  assert.deepEqual(h.entries.map((e) => e.id), ['map', 'garage', 'tug']);
  assert.deepEqual(h.entries.map((e) => e.active), [true, true, true]);
  for (const e of h.entries) {
    assert.ok(e.rect.w >= 100 && e.rect.h >= 100, e.id);
    assert.ok(!rectsOverlap(e.rect, CROSS_ZONE), e.id);
    assert.ok(e.rect.x >= 0 && e.rect.y >= 0 && e.rect.x + e.rect.w <= 1024 && e.rect.y + e.rect.h <= 768, e.id);
  }
  assert.equal(ENTRIES.length, 3);
});

test('3.1 главный экран: карта открывает карту, гараж — гараж, канат — выбор машины для каната', async () => {
  const w = await world();
  const h = w.scenes.currentScene();
  for (const [id, scene, params] of [['map', 'map', {}], ['garage', 'garage', {}], ['tug', 'garage', { mode: 'tug' }]]) {
    tapRect(w, h.entries.find((e) => e.id === id).rect);
    frames(w, 1);
    await tick();
    assert.equal(w.scenes.current(), scene, id);
    assert.equal(!!w.scenes.currentScene().tugMode, !!params.mode, id);
    w.scenes.back();
    assert.equal(w.scenes.current(), 'home');
    assert.equal(h.state, 'idle');
  }
});

test('главный экран: канат закрыт, пока сцены tug нет — фраза «потом» и гудок; появится — откроется сам', async () => {
  const w = await world({ only: ['assembly'] });
  const h = w.scenes.currentScene();
  assert.deepEqual(h.entries.map((e) => e.active), [true, true, false]);
  tapRect(w, h.entries.find((e) => e.id === 'tug').rect);
  frames(w, 1.5);
  await tick();
  assert.equal(w.scenes.current(), 'home');
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
    assert.ok(m.facts.map((f) => FX.data.phrases[f].replace('{name}', FX.data.childName)).includes(w.voices.log[1]), 'факт: ' + w.voices.log[1]);
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
  // три значка: собрать, пазл (16 и 25), помыть; мастерская и заправка — на карте
  assert.deepEqual(s.icons.map((i) => i.icon), ['ui/icon-assembly', 'ui/icon-puzzle16', 'ui/icon-puzzle25', 'ui/icon-wash']);
  assert.ok(!ICONS.some((i) => i.scene === 'repair' || i.scene === 'fuel'));
  const expect = [
    ['assembly', { machine: id }], ['puzzle', { machine: id, size: 16 }], ['puzzle', { machine: id, size: 25 }],
    ['wash', { machine: id }],
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

test('этап 3: сборка в гараже больше не открывает машины; уже открытые остаются', async () => {
  const w = await world();
  w.progress.unlock(IDS[1]);
  w.progress.setAssembled(IDS[2]); // старое сохранение: машина собрана, но не открыта следующая
  const s = await garage(w);
  assert.equal(w.progress.isUnlocked(IDS[3]), false);
  for (const id of [IDS[0], IDS[1]]) {
    assert.equal(s.waiting(), id);
    tapRect(w, slot(s, id).rect);
    await tick();
    assert.equal(w.scenes.current(), 'assembly');
    w.voices.log.length = 0;
    w.scenes.currentScene().complete();
    frames(w, 2);
    assert.equal(slot(s, id).state, 'ready');
    assert.ok(!w.voices.log.includes(say('garage-new')));
  }
  assert.deepEqual(IDS.filter((id) => w.progress.isUnlocked(id)), [IDS[0], IDS[1]]);
  // открыла стройка — машина в гараже в деталях
  w.progress.completeObject(FX.data.objects[3].id);
  frames(w, 0.1);
  assert.equal(slot(s, FX.data.objects[3].unlocks).state, 'parts');
});

// ---------- канат: выбор машины ----------

test('канат: гараж в режиме выбора — голос, тык по открытой машине открывает канат с ней', async () => {
  const w = await world();
  w.progress.unlock(IDS[1]);
  w.progress.setAssembled(IDS[0]);
  await w.scenes.open('garage', { mode: 'tug' });
  const s = w.scenes.currentScene();
  frames(w, 0.1);
  assert.equal(w.voices.log[0], say('tug-pick'));
  assert.deepEqual(s.target, { kind: 'tap', x: s.target.x, y: s.target.y });
  assert.ok(inRect(s.target.x, s.target.y, slot(s, IDS[0]).rect));
  // закрытая — не открывается
  tapRect(w, slot(s, IDS[5]).rect);
  await tick();
  assert.equal(w.scenes.current(), 'garage');
  // несобранная открытая тоже годится — сразу канат, без сборки
  opened.length = 0;
  tapRect(w, slot(s, IDS[1]).rect);
  await tick();
  assert.equal(w.scenes.current(), 'tug');
  assert.deepEqual(opened[0], { id: 'tug', params: { machine: IDS[1] } });
  // победа — снова выбор
  w.scenes.currentScene().complete({ won: true, level: 'easy' });
  frames(w, 3);
  await tick();
  assert.equal(w.scenes.current(), 'garage');
  assert.equal(s.mode, 'row');
  assert.ok(s.target);
});

test('канат: проигрыш — «Ой, машина в луже!», мойка этой машины, потом снова выбор', async () => {
  const w = await world();
  w.progress.setAssembled(IDS[0]);
  await w.scenes.open('garage', { mode: 'tug' });
  const s = w.scenes.currentScene();
  frames(w, 0.1);
  perform(w, s.target);
  await tick();
  assert.equal(w.scenes.current(), 'tug');
  opened.length = 0;
  w.voices.log.length = 0;
  w.scenes.currentScene().complete({ won: false, level: 'hard' });
  assert.equal(w.scenes.current(), 'garage');
  assert.equal(s.target, null);
  assert.equal(w.voices.log[0], say('tug-to-wash'));
  frames(w, 2.5);
  await tick();
  assert.equal(w.scenes.current(), 'wash');
  assert.deepEqual(opened[0], { id: 'wash', params: { machine: IDS[0] } });
  w.scenes.currentScene().complete();
  assert.equal(w.scenes.current(), 'garage');
  assert.equal(s.tugMode, true);
  assert.ok(s.target);
  // крестик в канате — ничего не моем
  perform(w, s.target);
  await tick();
  w.scenes.back();
  frames(w, 3);
  await tick();
  assert.equal(w.scenes.current(), 'garage');
});

test('гараж: подсказки — подсветка и рука на машине, что ждёт сборки, голос через 10 с', async () => {
  const w = await world();
  w.progress.setAssembled(IDS[0]);
  w.progress.unlock(IDS[1]);
  const s = await garage(w);
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

test('5.3 гараж: неподвижный ряд запечён в одну картинку — за кадр рисуется лишь несколько картинок', async () => {
  const w = await world();
  w.progress.unlockAll();
  for (const id of IDS) w.progress.setAssembled(id);
  const s = await garage(w);
  frames(w, 2);
  const g = fakeGraphics();
  s.draw(g);
  const imgs = g.calls.filter((c) => c.op === 'drawImage');
  assert.ok(imgs.length <= 2, 'картинок за кадр: ' + imgs.length);
  assert.ok(w.assets.cache.has('garage/layer'));
  const key = s.layerKey;
  s.draw(fakeGraphics());
  assert.equal(s.layerKey, key); // без изменений слой не перерисовывается
  w.progress.reset();
  frames(w, 0.1);
  s.draw(fakeGraphics());
  assert.notEqual(s.layerKey, key); // прогресс изменился — слой перерисован
  w.scenes.back();
  assert.equal(w.assets.cache.has('garage/layer'), false); // освобождён при выходе
});

test('экран для взрослых: кнопка «Музыка» выключает и включает музыку, настройка переживает сброс прогресса', async () => {
  const w = await world();
  await w.scenes.open('parent');
  assert.notEqual(w.progress.setting('music'), false); // по умолчанию музыка есть
  press(w, 'music');
  assert.equal(w.progress.setting('music'), false);
  press(w, 'reset'); press(w, 'reset');
  assert.equal(w.progress.setting('music'), false);
  press(w, 'music');
  assert.equal(w.progress.setting('music'), true);
  const s = w.scenes.currentScene();
  for (const b of s.buttons) assert.ok(b.y + b.h <= 768 && b.y >= 96, b.id + ' вне экрана');
});
