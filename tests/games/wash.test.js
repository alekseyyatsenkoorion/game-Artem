// Мойка: 2.15, 2.39–2.42 — по всем машинам из данных.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WashScene, PHASES, decideStubborn, pickSpots, CLEAN_ENOUGH } from '../../src/games/wash.js';
import { cellsForRects } from '../../src/games/common.js';
import { memoryStorage, seededRandom } from '../core/helpers.js';
import { openScene, runToFinish, MACHINES, data, tick } from './helpers.js';

// Случайность: первое число — для решения об упрямой грязи, дальше — обычная.
function firstThen(first, seed = 3) { const r = seededRandom(seed); let used = false; return () => { if (!used) { used = true; return first; } return r(); }; }
const say = (id) => data.phrases[id].replace('{name}', data.childName);

// Протереть все клетки текущего шага (широкими проходами пальца).
function rubAll(s) {
  const grid = s.grid;
  const cells = grid.cells.slice();
  s.onPointer({ type: 'down', x: cells[0].x, y: cells[0].y });
  for (const c of cells) { if (s.grid !== grid) break; s.onPointer({ type: 'move', x: c.x, y: c.y }); }
  s.onPointer({ type: 'up', x: 0, y: 0 });
}

for (const machine of MACHINES) {
  test('2.15 ' + machine + ': вода → пена → вода; шаг завершается ровно при 90% площади', async () => {
    const { w, s, home } = await openScene(WashScene, { machine }, { random: firstThen(0.99) });
    assert.equal(s.stubborn, false);
    assert.equal(s.round, 1);
    const seen = [];
    for (const phase of PHASES) {
      assert.equal(s.phase, phase);
      seen.push(phase);
      // точная проверка порога: протираем по одной клетке
      const grid = s.grid;
      grid.brush = 0.5;
      const total = grid.cells.length;
      for (let i = 0; i < total; i++) {
        const before = grid.fraction();
        s.rub(grid.cells[i].x, grid.cells[i].y);
        grid.lift();
        if (before + 1 / total < CLEAN_ENOUGH - 1e-9) assert.equal(s.phase, phase, 'рано: ' + (before + 1 / total));
        if (s.phase !== phase) { assert.ok(grid.fraction() >= CLEAN_ENOUGH); break; }
      }
      assert.notEqual(s.phase, phase);
    }
    assert.deepEqual(seen, ['water', 'foam', 'rinse']);
    assert.equal(s.phase, 'done');
    assert.ok(s.isClean());
    await tick();
    assert.ok(w.voices.log.includes(say('wash-water')));
    await runToFinish(w, s);
    assert.deepEqual(home.results[0], { done: true, machine, rounds: 1 });
    assert.equal(w.audio.activeSounds(), 0);
  });

  test('2.40 / 2.41 ' + machine + ': упрямая грязь — 2–3 пятна, второй круг только по ним, потом чисто', async () => {
    const { w, s, home } = await openScene(WashScene, { machine }, { random: firstThen(0.01) });
    assert.equal(s.stubborn, true);
    for (let i = 0; i < 3; i++) rubAll(s);
    assert.equal(s.round, 2);
    assert.equal(s.phase, 'water');
    assert.ok(s.spots.length >= 2 && s.spots.length <= 3, 'пятен ' + s.spots.length);
    const spotCells = s.cells.filter((c) => c.spot);
    assert.ok(spotCells.length >= 4);
    assert.equal(s.grid.cells.length, spotCells.length);
    assert.equal(s.dirtyCells().length, spotCells.length);
    for (const sp of s.spots) {
      assert.ok(sp.x >= s.bounds.x && sp.x <= s.bounds.x + s.bounds.w && sp.y >= s.bounds.y && sp.y <= s.bounds.y + s.bounds.h);
    }
    for (let i = 0; i < 6; i++) { w.voices.finishCurrent(); await tick(); }
    assert.ok(w.voices.log.includes(say('wash-stubborn')));
    for (const phase of PHASES) { assert.equal(s.phase, phase); rubAll(s); }
    assert.equal(s.phase, 'done');
    assert.equal(s.round, 2);
    assert.ok(s.isClean());
    await runToFinish(w, s);
    assert.deepEqual(home.results[0], { done: true, machine, rounds: 2 });
  });
}

test('2.39 / 2.42 упрямая грязь: 25–40% из 300 моек, не два раза подряд, не привязана к машине', async () => {
  const storage = memoryStorage();
  const random = seededRandom(11);
  let stubborn = 0, prev = false;
  const byMachine = {};
  for (let i = 0; i < 300; i++) {
    const machine = MACHINES[i % MACHINES.length];
    const { w, s } = await openScene(WashScene, { machine }, { storage, random });
    assert.ok(!(prev && s.stubborn), 'два раза подряд');
    if (s.stubborn) stubborn++;
    byMachine[machine] = byMachine[machine] || new Set();
    byMachine[machine].add(s.stubborn);
    prev = s.stubborn;
    w.scenes.back();
  }
  const share = stubborn / 300;
  assert.ok(share >= 0.25 && share <= 0.4, 'доля ' + share);
  for (const m of MACHINES) assert.equal(byMachine[m].size, 2, m + ': бывает и так, и так');
  // чистая функция: после упрямой — всегда обычная; решение не принимает машину
  assert.equal(decideStubborn(() => 0, true), false);
  assert.equal(decideStubborn(() => 0, false), true);
  assert.equal(decideStubborn.length, 2);
});

test('2.40 пятна: всегда 2–3, на машине, у любой машины', () => {
  for (const m of data.machines) {
    const cells = cellsForRects(m.parts, 0, 0, 24);
    for (let seed = 1; seed < 60; seed++) {
      const spots = pickSpots(cells, seededRandom(seed));
      assert.ok(spots.length >= 2 && spots.length <= 3, m.id + ' seed ' + seed + ': ' + spots.length);
    }
  }
});

test('мойка: грязь исчезает там, где прошёл палец, и только там', async () => {
  const { s } = await openScene(WashScene, { machine: MACHINES[0] }, { random: firstThen(0.99) });
  const c = s.cells[Math.floor(s.cells.length / 2)];
  s.onPointer({ type: 'down', x: c.x, y: c.y });
  s.onPointer({ type: 'up', x: c.x, y: c.y });
  assert.equal(c.level, 1);
  const far = s.cells.filter((q) => Math.hypot(q.x - c.x, q.y - c.y) > 60);
  assert.ok(far.length && far.every((q) => q.level === 0));
  // быстрая протяжка не оставляет пропусков между точками касания
  const a = s.cells[0], b = s.cells[s.cells.length - 1];
  s.onPointer({ type: 'down', x: a.x, y: a.y });
  s.onPointer({ type: 'move', x: b.x, y: b.y });
  s.onPointer({ type: 'up', x: b.x, y: b.y });
  const mid = s.cells.find((q) => Math.abs((q.x - a.x) * (b.y - a.y) - (q.y - a.y) * (b.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y) < 5);
  if (mid) assert.equal(mid.level, 1);
});

test('мойка: подсказка — рука через 5 с, голос wash-hint через 10 с', async () => {
  const { w, s } = await openScene(WashScene, { machine: MACHINES[0] }, { random: firstThen(0.99) });
  await tick(); w.voices.finishCurrent(); await tick();
  const n = w.voices.log.length;
  for (let t = 0; t < 5.1; t += 0.05) s.update(0.05);
  assert.equal(s.hint.showHand(), true);
  for (let t = 0; t < 5; t += 0.05) s.update(0.05);
  await tick();
  assert.equal(w.voices.log[n], say('wash-hint'));
});
