// Тесты 0.14, 2.32–2.36 (contracts.md, раздел 6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ParentTimer, TIMER_KEY } from '../../src/core/parent-timer.js';
import { memoryStorage, captureErrors } from './helpers.js';

function make(storage = memoryStorage(), minutes = 30) {
  const events = [], said = [];
  let locks = 0;
  const t = new ParentTimer({ storage, defaultMinutes: () => minutes, say: (p) => said.push(p), onLock: () => locks++ });
  for (const e of ['start', 'warning', 'expired', 'locked', 'unlocked']) t.on(e, () => events.push(e));
  return { t, events, said, locks: () => locks, storage };
}
const run = (t, seconds, step = 0.05) => { for (let s = 0; s < seconds; s += step) t.tick(step); };

test('0.14 / 2.32 события по порядку; предупреждение за 2 минуты', () => {
  const { t, events, said } = make();
  t.start();
  run(t, 30 * 60 - 121);
  assert.deepEqual(events, ['start']);
  run(t, 2);
  assert.deepEqual(events, ['start', 'warning']);
  assert.deepEqual(said, ['timer-warning']);
  run(t, 121);
  assert.deepEqual(events, ['start', 'warning', 'expired']);
  assert.equal(t.isLocked(), false);
  assert.equal(t.checkpoint(), true);
  assert.deepEqual(events, ['start', 'warning', 'expired', 'locked']);
  t.unlock();
  assert.deepEqual(events.slice(-2), ['unlocked', 'start']);
  assert.equal(t.isLocked(), false);
  assert.equal(t.remaining(), 30 * 60);
});

test('2.33 до истечения checkpoint не блокирует; после — блокирует в безопасной точке', () => {
  const { t, locks } = make();
  t.start();
  assert.equal(t.checkpoint(), false);
  run(t, 30 * 60 + 1);
  assert.equal(locks(), 0);
  assert.equal(t.checkpoint(), true);
  assert.equal(locks(), 1);
});

test('после истечения блокирует сам не позже чем через 3 минуты', () => {
  const { t, locks } = make();
  t.start();
  run(t, 30 * 60 + 1);
  run(t, 170);
  assert.equal(locks(), 0);
  run(t, 15);
  assert.equal(locks(), 1);
  assert.equal(t.isLocked(), true);
});

test('проверочный режим: 1 минута, предупреждение за 20 секунд', () => {
  const { t, events } = make();
  t.start();
  t.testRun();
  assert.equal(t.remaining(), 60);
  run(t, 39);
  assert.ok(!events.includes('warning'));
  run(t, 2);
  assert.ok(events.includes('warning'));
  run(t, 20);
  assert.ok(events.includes('expired'));
  assert.equal(t.checkpoint(), true);
});

test('2.35 настройки 15 / 30 / 45 / выключен применяются', () => {
  const { t } = make();
  t.start();
  for (const n of [15, 30, 45]) { t.setMinutes(n); assert.equal(t.remaining(), n * 60); }
  t.setMinutes(0);
  assert.equal(t.remaining(), Infinity);
  run(t, 3600);
  assert.equal(t.checkpoint(), false);
  const err = captureErrors();
  try { t.setMinutes(7); assert.equal(t.minutes(), 0); } finally { err.restore(); }
});

test('2.36 время идёт только пока игра открыта (тикает ядро), состояние переживает перезапуск', () => {
  const st = memoryStorage();
  const a = make(st);
  a.t.start();
  run(a.t, 600);
  a.t.persist();
  const b = make(st);
  b.t.start();
  assert.ok(Math.abs(b.t.remaining() - 20 * 60) <= 1);
});

test('блокировка переживает перезапуск: закрыть и открыть — не способ обойти таймер', () => {
  const st = memoryStorage();
  const a = make(st);
  a.t.start(); run(a.t, 30 * 60 + 1); a.t.checkpoint();
  const b = make(st);
  b.t.start();
  assert.equal(b.t.isLocked(), true);
  assert.equal(b.locks(), 1);
});

test('состояние не читается — старт с 30 минут без блокировки', () => {
  const err = captureErrors();
  try {
    const { t } = make(memoryStorage({ [TIMER_KEY]: '{битое' }));
    t.start();
    assert.equal(t.isLocked(), false);
    assert.equal(t.remaining(), 30 * 60);
  } finally { err.restore(); }
});
