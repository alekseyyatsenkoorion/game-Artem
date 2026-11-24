// Мастерская и заправка: 2.16, 2.17, 2.18 — по всем машинам из данных.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RepairScene, KINDS, PUMP_TAPS, CLEAN_ENOUGH, chooseKind } from '../../src/games/repair.js';
import { FuelScene, FILL_TIME } from '../../src/games/fuel.js';
import { seededRandom } from '../core/helpers.js';
import { openScene, settle, runToFinish, MACHINES, data, tick } from './helpers.js';
import { HINT } from '../../src/core/ui.js';
// Логику подсказок проверяем на коротких сроках; сами сроки (30 с) — в tests/core/hint.test.js.
Object.assign(HINT, { hand: 5, voice: 10, every: 15 });

const say = (id) => data.phrases[id].replace('{name}', data.childName);
const withWheels = data.machines.filter((m) => Array.isArray(m.wheels) && m.wheels.length).map((m) => m.id);
const tap = (s, x, y) => { s.onPointer({ type: 'down', x, y }); s.onPointer({ type: 'up', x, y }); };

for (const machine of withWheels) {
  test('2.16 ' + machine + ': колесо накачивается за ' + PUMP_TAPS + ' тыков и не перекачивается', async () => {
    const { w, s, home } = await openScene(RepairScene, { machine, kind: 'wheel' });
    assert.equal(s.kind, 'wheel');
    const m = data.machines.find((x) => x.id === machine);
    assert.ok(m.wheels.includes(s.flatPart.id));
    const r = s.pumpRect;
    assert.ok(r.w >= 100 && r.h >= 100, 'насос крупный');
    tap(s, 300, 100); // мимо насоса
    assert.equal(s.taps, 0);
    for (let i = 1; i <= PUMP_TAPS; i++) {
      assert.equal(s.state, 'play');
      tap(s, r.x - 20, r.y + r.h / 2); // промах рядом засчитывается
      assert.equal(s.taps, i);
      assert.ok(s.inflation() <= 1);
    }
    assert.equal(s.state, 'done');
    for (let i = 0; i < 5; i++) { tap(s, r.x + r.w / 2, r.y + r.h / 2); assert.equal(s.pump(), false); }
    assert.equal(s.taps, PUMP_TAPS);
    assert.equal(s.inflation(), 1);
    await runToFinish(w, s);
    assert.deepEqual(home.results[0], { done: true, machine, kind: 'wheel' });
    assert.ok(w.voices.log.includes(say('repair-done')));
  });
}

function rubCellByCell(s) {
  const grid = s.grid;
  grid.brush = 0.5;
  const total = grid.cells.length;
  for (let i = 0; i < total; i++) {
    const before = grid.fraction();
    s.onPointer({ type: 'down', x: grid.cells[i].x, y: grid.cells[i].y });
    s.onPointer({ type: 'up', x: grid.cells[i].x, y: grid.cells[i].y });
    if (before + 1 / total < CLEAN_ENOUGH - 1e-9) assert.equal(s.state, 'play', 'рано');
    if (s.state !== 'play') { assert.ok(before + 1 / total >= CLEAN_ENOUGH - 1e-9); return; }
  }
}

for (const machine of MACHINES) {
  for (const kind of ['rust', 'paint']) {
    test('2.17 ' + machine + ' ' + kind + ': завершается при обработке ≥ 90% пятна', async () => {
      const { w, s, home } = await openScene(RepairScene, { machine, kind });
      assert.equal(s.kind, kind);
      assert.ok(s.spotCells.length >= 8);
      const b = s.bounds;
      assert.ok(s.spot.cx > b.x && s.spot.cx < b.x + b.w && s.spot.cy > b.y && s.spot.cy < b.y + b.h, 'пятно на машине');
      if (kind === 'paint') {
        // без краски не красится
        const c = s.spotCells[0];
        s.onPointer({ type: 'down', x: c.x, y: c.y }); s.onPointer({ type: 'up', x: c.x, y: c.y });
        assert.equal(s.grid.fraction(), 0);
        assert.ok(s.cans.length >= 3 && s.cans.length <= 4);
        tap(s, s.cans[2].cx + 30, s.cans[2].cy); // тык по банке
        assert.equal(s.color, s.cans[2].color);
      }
      rubCellByCell(s);
      assert.equal(s.state, 'done');
      if (kind === 'paint') assert.ok(s.spotCells.every((c) => c.color === s.cans[2].color));
      await runToFinish(w, s);
      assert.deepEqual(home.results[0], { done: true, machine, kind });
      assert.equal(w.audio.activeSounds(), 0);
    });
  }

  test('2.18 ' + machine + ': заправка — шкала растёт у бака, не сбрасывается, полная — finish', async () => {
    const { w, s, home } = await openScene(FuelScene, { machine });
    assert.ok(FILL_TIME >= 3 && FILL_TIME <= 4);
    const m = data.machines.find((x) => x.id === machine);
    assert.equal(s.tank.x, s.bounds.x + m.fuelPoint.x);
    const h = s.hose;
    // держать шланг вдали от бака — не заправляет
    s.onPointer({ type: 'down', x: h.x, y: h.y });
    s.onPointer({ type: 'move', x: 500, y: 150 });
    settle(s, 1);
    assert.equal(s.level, 0);
    // к баку, 2 секунды
    s.onPointer({ type: 'move', x: s.tank.x + 30, y: s.tank.y - 20 });
    settle(s, 2);
    const lvl = s.level;
    assert.ok(lvl > 0.4 && lvl < 0.8, 'шкала ' + lvl);
    s.onPointer({ type: 'up', x: s.tank.x, y: s.tank.y });
    settle(s, 1);
    assert.equal(s.level, lvl, 'не сбрасывается');
    assert.equal(s.filling, false);
    assert.deepEqual([Math.round(h.x), Math.round(h.y)], [h.rest.x, h.rest.y], 'шланг вернулся');
    assert.equal(w.audio.activeSounds(), 0);
    // ещё раз — до полной
    s.onPointer({ type: 'down', x: h.x + 20, y: h.y + 10 });
    s.onPointer({ type: 'move', x: s.tank.x, y: s.tank.y });
    settle(s, FILL_TIME);
    assert.equal(s.level, 1);
    assert.equal(s.state, 'done');
    await runToFinish(w, s);
    assert.deepEqual(home.results[0], { done: true, machine });
    assert.ok(w.voices.log.includes(say('fuel-done')));
  });
}

test('мастерская: колесо у машины без колёс — ржавчина или покраска без ошибки, finish с фактическим kind', async () => {
  const { captureErrors } = await import('../core/helpers.js');
  const m0 = data.machines[0];
  const noWheelData = { ...data, machines: data.machines.map((m) => (m.id === m0.id ? { ...m, wheels: [] } : m)) };
  const ids = data.machines.filter((m) => !(m.wheels && m.wheels.length)).map((m) => m.id);
  const cases = ids.map((id) => [id, data]).concat([[m0.id, noWheelData]]);
  for (const [machine, d] of cases) {
    for (let seed = 1; seed <= 4; seed++) {
      const err = captureErrors();
      try {
        const { w, s, home } = await openScene(RepairScene, { machine, kind: 'wheel' }, { data: d, seed });
        assert.ok(s.kind === 'rust' || s.kind === 'paint', machine + ': ' + s.kind);
        assert.equal(w.scenes.current(), 'repair');
        if (s.kind === 'paint') s.chooseColor(0);
        for (const c of s.spotCells) s.rub(c.x, c.y);
        await runToFinish(w, s);
        assert.deepEqual(home.results[0], { done: true, machine, kind: s.kind });
        assert.deepEqual(err.list, []);
      } finally { err.restore(); }
    }
  }
});

test('мастерская: без kind — случайный из трёх; у машины без колёс колесо не выпадает', async () => {
  const seen = new Set();
  const r = seededRandom(5);
  for (let i = 0; i < 60; i++) seen.add(chooseKind(undefined, r, data.machines[0]));
  assert.deepEqual(Array.from(seen).sort(), KINDS.slice().sort());
  const noWheels = { id: 'x', wheels: [] };
  for (let i = 0; i < 60; i++) assert.notEqual(chooseKind(undefined, r, noWheels), 'wheel');
  const { s } = await openScene(RepairScene, { machine: MACHINES[0] });
  assert.ok(KINDS.includes(s.kind));
});

test('мастерская и заправка: подсказки — рука через 5 с, голос через 10 с', async () => {
  for (const [Cls, params, phrase] of [
    [RepairScene, { machine: withWheels[0], kind: 'wheel' }, 'repair-hint-wheel'],
    [RepairScene, { machine: MACHINES[0], kind: 'rust' }, 'repair-hint-rub'],
    [RepairScene, { machine: MACHINES[0], kind: 'paint' }, 'repair-paint'],
    [FuelScene, { machine: MACHINES[0] }, 'fuel-hint'],
  ]) {
    const { w, s } = await openScene(Cls, params);
    await tick(); w.voices.finishCurrent(); await tick();
    const n = w.voices.log.length;
    for (let t = 0; t < 5.1; t += 0.05) s.update(0.05);
    assert.equal(s.hint.showHand(), true);
    for (let t = 0; t < 5; t += 0.05) s.update(0.05);
    await tick();
    assert.equal(w.voices.log[n], say(phrase), Cls.id + ' ' + (params.kind || ''));
  }
});
