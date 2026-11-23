// Группа 0 для всех сцен зоны «Мини-игры»: 0.1, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9 (в файлах сцен), 0.11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AssemblyScene } from '../../src/games/assembly.js';
import { PuzzleScene } from '../../src/games/puzzle.js';
import { WashScene } from '../../src/games/wash.js';
import { RepairScene } from '../../src/games/repair.js';
import { FuelScene } from '../../src/games/fuel.js';
import { scenes as registered } from '../../src/games/index.js';
import { captureErrors, makeWorld } from '../core/helpers.js';
import { openScene, settle, runToFinish, trackingGraphics, crossZoneViolations, offscreen, textCalls, Home, MACHINES, data, tick } from './helpers.js';

const done16 = (machine) => (w) => w.progress.savePuzzle(machine, 16, Array.from({ length: 16 }, (_, i) => i));
const hasWheels = (id) => { const m = data.machines.find((x) => x.id === id); return !!(m.wheels && m.wheels.length); };

// Все варианты сцен для машины.
function variants(machine) {
  const v = [
    ['assembly', AssemblyScene, { machine }],
    ['puzzle16', PuzzleScene, { machine, size: 16 }],
    ['puzzle25', PuzzleScene, { machine, size: 25 }, done16(machine)],
    ['puzzle25-locked', PuzzleScene, { machine, size: 25 }],
    ['wash', WashScene, { machine }],
    ['repair-rust', RepairScene, { machine, kind: 'rust' }],
    ['repair-paint', RepairScene, { machine, kind: 'paint' }],
    ['fuel', FuelScene, { machine }],
  ];
  if (hasWheels(machine)) v.push(['repair-wheel', RepairScene, { machine, kind: 'wheel' }]);
  return v;
}

// Начать действие пальцем (перетаскивание или протирание), не отпуская.
function startAction(name, s) {
  if (name === 'assembly') { const p = s.parts[0]; s.onPointer({ type: 'down', x: p.cx, y: p.cy }); s.onPointer({ type: 'move', x: 500, y: 300 }); return () => s.drag; }
  if (name.startsWith('puzzle') && s.pieces.length) { const p = s.pieces[0]; s.onPointer({ type: 'down', x: p.cx, y: p.cy }); s.onPointer({ type: 'move', x: 512, y: 380 }); return () => s.drag; }
  if (name === 'wash') { const c = s.cells[0]; s.onPointer({ type: 'down', x: c.x, y: c.y }); s.onPointer({ type: 'move', x: c.x + 30, y: c.y }); return () => s.finger; }
  if (name === 'repair-rust') { const c = s.spotCells[0]; s.onPointer({ type: 'down', x: c.x, y: c.y }); return () => s.finger; }
  if (name === 'repair-paint') { const c = s.spotCells[0]; s.onPointer({ type: 'down', x: s.cans[0].cx, y: s.cans[0].cy }); s.onPointer({ type: 'up', x: s.cans[0].cx, y: s.cans[0].cy }); s.onPointer({ type: 'down', x: c.x, y: c.y }); return () => s.finger; }
  if (name === 'fuel') { s.onPointer({ type: 'down', x: s.hose.x, y: s.hose.y }); s.onPointer({ type: 'move', x: s.tank.x, y: s.tank.y }); s.update(0.1); return () => s.hose.held; }
  if (name === 'repair-wheel') { s.onPointer({ type: 'down', x: s.pumpRect.x + 50, y: s.pumpRect.y + 50 }); return () => false; }
  return () => false;
}

function spyPlay(w) {
  const handles = [];
  const orig = w.audio.play.bind(w.audio);
  w.audio.play = (id, opts) => { const h = orig(id, opts); handles.push(h); return h; };
  return handles;
}

test('index.js регистрирует сборку, пазл, мойку, мастерскую, заправку', () => {
  assert.deepEqual(registered.map((S) => S.id), ['assembly', 'puzzle', 'wash', 'repair', 'fuel']);
});

for (const machine of MACHINES) {
  test('0.1 / 0.6 ' + machine + ': enter, 100 update и draw без ошибок; нет рисования в зоне крестика, за экраном, надписей', async () => {
    for (const [name, Cls, params, before] of variants(machine)) {
      const err = captureErrors();
      try {
        const { s } = await openScene(Cls, params, { before });
        for (let i = 0; i < 100; i++) {
          s.update(0.06); // 6 секунд: видна рука-подсказка
          const g = trackingGraphics();
          s.draw(g);
          assert.deepEqual(crossZoneViolations(g), [], name + ': рисует в зоне крестика');
          assert.deepEqual(offscreen(g), [], name + ': вылезает за экран');
          assert.equal(textCalls(g).length, 0, name + ': надпись');
        }
        startAction(name, s);
        for (let i = 0; i < 10; i++) { s.update(0.02); const g = trackingGraphics(); s.draw(g); assert.deepEqual(crossZoneViolations(g), [], name + ' в действии'); }
        assert.deepEqual(err.list, [], name);
      } finally { err.restore(); }
    }
  });
}

test('0.2 сцены объявляют все картинки (на машинах, которые зона «Контент» уже нарисовала)', async () => {
  const { default: art } = await import('../../src/art/index.js');
  const ready = data.machines.filter((m) => art['machine/' + m.id + '/whole/idle'] && art['machine/' + m.id + '/whole/dirty']).map((m) => m.id);
  assert.ok(ready.length >= 1);
  for (const machine of ready) {
    for (const [name, Cls, params, before] of variants(machine)) {
      const { w, s } = await openScene(Cls, params, { before, stub: false });
      for (let i = 0; i < 60; i++) { s.update(0.1); s.draw(trackingGraphics()); }
      startAction(name, s);
      s.update(0.02); s.draw(trackingGraphics());
      assert.equal(w.assets.placeholderCount, 0, machine + ' ' + name);
    }
  }
});

test('0.3 выход по крестику из любого состояния: звуки сцены остановлены', async () => {
  for (const machine of [MACHINES[0], MACHINES[MACHINES.length - 1]]) {
    for (const [name, Cls, params, before] of variants(machine)) {
      for (const state of ['start', 'action', 'finale']) {
        const { w, s, home } = await openScene(Cls, params, { before });
        const handles = spyPlay(w);
        if (state !== 'start') startAction(name, s);
        if (state === 'finale') forceFinish(name, s);
        s.update(0.02);
        s.exit(); // сама сцена гасит свои звуки (без помощи SceneManager)
        assert.ok(handles.every((h) => h.stopped), name + ' ' + state + ': звук не остановлен');
        // и через менеджер, как крестик
        const r = await openScene(Cls, params, { before });
        if (state !== 'start') startAction(name, r.s);
        r.w.scenes.back();
        assert.equal(r.w.scenes.current(), 'home');
        assert.equal(r.w.audio.activeSounds(), 0);
        assert.equal(r.w.audio.queueLength(), 0);
        assert.deepEqual(r.home.results, [{ cancelled: true }]);
        void home;
      }
    }
  }
});

// Довести сцену до финала напрямую.
function forceFinish(name, s) {
  if (name === 'assembly') { for (const p of s.parts.slice()) s.tryPlace(p, p.slot.cx, p.slot.cy); return; }
  if (name.startsWith('puzzle') && s.pieces.length) { for (const p of s.pieces.slice()) s.tryPlace(p, p.slot.cx, p.slot.cy); return; }
  if (name === 'wash') { s.stubborn = false; for (let i = 0; i < 3; i++) { s.grid.completeAll(); s._phaseDone(); } return; }
  if (name === 'repair-wheel') { for (let i = 0; i < 10; i++) s.pump(); return; }
  if (name.startsWith('repair')) { if (!s.color && s.cans.length) s.chooseColor(0); for (const c of s.spotCells) s.rub(c.x, c.y); return; }
  if (name === 'fuel') { s.hose.held = true; s.hose.x = s.tank.x; s.hose.y = s.tank.y; settle(s, 4); }
}

test('0.9 canExit false только в финале и не дольше 2 секунд; finish по контракту', async () => {
  const machine = MACHINES[0];
  for (const [name, Cls, params, before] of variants(machine)) {
    if (name === 'puzzle25-locked') continue;
    const { w, s, home } = await openScene(Cls, params, { before });
    assert.equal(s.canExit(), true);
    forceFinish(name, s);
    let blocked = 0;
    for (let i = 0; i < 200 && w.scenes.currentScene() === s; i++) { if (!s.canExit()) blocked += 0.02; s.update(0.02); }
    assert.ok(blocked <= 2, name + ': canExit false ' + blocked.toFixed(2) + ' с');
    await runToFinish(w, s);
    const r = home.results[0];
    assert.equal(r.done, true, name);
    assert.equal(r.machine, machine);
    if (Cls === PuzzleScene) assert.equal(r.size, params.size);
    if (Cls === WashScene) assert.ok(r.rounds === 1 || r.rounds === 2);
    if (Cls === RepairScene) assert.equal(r.kind, params.kind);
  }
});

test('0.4 50 входов и выходов подряд: звуки, очередь голоса, картинки и стек не растут', async () => {
  for (const [name, Cls, params, before] of variants(MACHINES[0])) {
    const { w } = await openScene(Cls, params, { before });
    w.scenes.back();
    const cache0 = w.assets.cache.size;
    for (let i = 0; i < 50; i++) {
      await w.scenes.open(Cls.id, params);
      const s = w.scenes.currentScene();
      startAction(name, s);
      for (let k = 0; k < 5; k++) { s.update(0.02); s.draw(trackingGraphics()); }
      w.scenes.back();
      assert.equal(w.audio.activeSounds(), 0);
    }
    assert.equal(w.scenes.depth(), 1, name);
    assert.equal(w.audio.queueLength(), 0);
    assert.ok(w.assets.cache.size <= cache0, name + ': картинки не выгружены');
  }
});

test('0.5 сцены не трогают хранилище, сеть, DOM, события браузера и таймеры', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'games');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const src = readFileSync(join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
    for (const bad of ['localStorage', 'sessionStorage', 'indexedDB', 'fetch(', 'XMLHttpRequest', 'document.', 'window.', 'addEventListener', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'new Image', 'Math.random', 'structuredClone', '??=', '.at(', 'findLast']) {
      assert.ok(!src.includes(bad), f + ': ' + bad);
    }
  }
});

test('0.7 cancel во время перетаскивания возвращает предмет на место', async () => {
  const machine = MACHINES[0];
  // пазл
  let r = await openScene(PuzzleScene, { machine, size: 16 });
  const p = r.s.pieces[0];
  r.s.onPointer({ type: 'down', x: p.cx, y: p.cy });
  r.s.onPointer({ type: 'move', x: p.slot.cx + 5, y: p.slot.cy });
  r.s.onPointer({ type: 'cancel', x: p.slot.cx + 5, y: p.slot.cy });
  settle(r.s);
  assert.equal(p.placed, false);
  assert.deepEqual([Math.round(p.cx), Math.round(p.cy), p.s], [Math.round(p.home.cx), Math.round(p.home.cy), p.home.s]);
  // заправка: шланг возвращается, шкала остаётся
  r = await openScene(FuelScene, { machine });
  const h = r.s.hose;
  r.s.onPointer({ type: 'down', x: h.x, y: h.y });
  r.s.onPointer({ type: 'move', x: r.s.tank.x, y: r.s.tank.y });
  settle(r.s, 1);
  const lvl = r.s.level;
  r.s.onPointer({ type: 'cancel', x: 0, y: 0 });
  settle(r.s, 1);
  assert.deepEqual([Math.round(h.x), Math.round(h.y)], [h.rest.x, h.rest.y]);
  assert.equal(r.s.level, lvl);
  assert.equal(r.w.audio.activeSounds(), 0);
  // мойка и мастерская: палец снят, звук остановлен
  for (const [name, Cls, params] of [['wash', WashScene, { machine }], ['repair-rust', RepairScene, { machine, kind: 'rust' }], ['repair-paint', RepairScene, { machine, kind: 'paint' }]]) {
    r = await openScene(Cls, params);
    startAction(name, r.s);
    assert.ok(r.s.finger);
    r.s.onPointer({ type: 'cancel', x: 0, y: 0 });
    assert.equal(r.s.finger, null);
    assert.equal(r.w.audio.activeSounds(), 0, name);
  }
});

test('0.8 pause останавливает сцену и её звуки, resume продолжает с того же места', async () => {
  for (const [name, Cls, params, before] of variants(MACHINES[0])) {
    if (name === 'puzzle25-locked') continue;
    const { w, s } = await openScene(Cls, params, { before });
    const handles = spyPlay(w);
    const active = startAction(name, s);
    s.update(0.05);
    s.pause();
    assert.ok(handles.every((x) => x.stopped), name + ': звук на паузе');
    assert.ok(!active(), name + ': перетаскивание снято');
    settle(s, 0.5);
    const snapshot = JSON.stringify({ state: s.state, phase: s.phase, round: s.round, level: s.level, taps: s.taps });
    s.resume();
    s.update(0.02);
    assert.equal(JSON.stringify({ state: s.state, phase: s.phase, round: s.round, level: s.level, taps: s.taps }), snapshot, name);
    // после паузы игра продолжается
    forceFinish(name, s);
    assert.equal(s.state, 'done', name);
  }
});

test('0.11 неизвестная машина или неполное описание: журнал и выход назад, без исключения', async () => {
  const m0 = data.machines[0];
  const cases = [
    [AssemblyScene, { machine: 'net-takoy' }, data],
    [PuzzleScene, { machine: 'net-takoy', size: 16 }, data],
    [WashScene, { machine: 'net-takoy' }, data],
    [RepairScene, { machine: 'net-takoy' }, data],
    [FuelScene, { machine: 'net-takoy' }, data],
    [WashScene, { machine: m0.id }, { ...data, machines: [{ ...m0, parts: [] }] }],
    [PuzzleScene, { machine: m0.id, size: 16 }, { ...data, machines: [{ ...m0, size: null }] }],
    [FuelScene, { machine: m0.id }, { ...data, machines: [{ ...m0, fuelPoint: undefined }] }],
    [RepairScene, { machine: m0.id, kind: 'rust' }, { ...data, machines: [{ ...m0, parts: [{ id: 'x' }] }] }],
  ];
  for (const [Cls, params, d] of cases) {
    const err = captureErrors();
    try {
      const w = makeWorld({ data: d, scenes: [Home, Cls] });
      await w.scenes.open('home');
      await w.scenes.open(Cls.id, params);
      const s = w.scenes.currentScene();
      s.draw(trackingGraphics());
      s.onPointer({ type: 'down', x: 500, y: 500 });
      w.scenes.update(0.02);
      assert.equal(w.scenes.current(), 'home', Cls.id);
      assert.ok(err.list.length >= 1, Cls.id + ': запись в журнал');
      assert.ok(!err.list.some((e) => e.includes('ошибка в')), Cls.id + ': исключение: ' + err.list.join('; '));
    } finally { err.restore(); }
  }
  await tick();
});
