// Тесты 0.12, 2.19, 2.21–2.24 и ошибки Progress (contracts.md, раздел 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Progress, SAVE_KEY, BROKEN_KEY } from '../../src/core/progress.js';
import { memoryStorage, brokenStorage, captureErrors } from './helpers.js';

const MACHINES = ['samosval', 'traktor', 'buldozer'];
const OBJECTS = [{ id: 'pesochnitsa', unlocks: 'traktor' }, { id: 'zabor', unlocks: 'buldozer' }];
const make = (storage = memoryStorage()) => { const p = new Progress({ storage, machines: MACHINES, objects: OBJECTS }); p.load(); return p; };

test('2.19 новая игра: открыт только самосвал, формат по контракту', () => {
  const st = memoryStorage();
  const p = make(st);
  assert.equal(p.isUnlocked('samosval'), true);
  assert.equal(p.isUnlocked('traktor'), false);
  const saved = JSON.parse(st.getItem(SAVE_KEY));
  assert.deepEqual(Object.keys(saved).sort(), ['format', 'machines', 'map', 'objects', 'puzzleInProgress', 'settings', 'tug', 'wash'].sort());
  assert.equal(saved.format, 1);
  assert.deepEqual(saved.machines.samosval, { unlocked: true, assembled: false, puzzle16: 'none', puzzle25: 'none' });
  assert.deepEqual(saved.settings, { timerMinutes: 30 });
  assert.deepEqual(saved.tug, { nextLevel: 'easy', wins: 0, losses: 0 });
});

test('0.12 каждый метод пишет и читает то, что записано', () => {
  const st = memoryStorage();
  const p = make(st);
  p.unlock('traktor'); assert.equal(p.isUnlocked('traktor'), true);
  p.setAssembled('samosval'); assert.equal(p.isAssembled('samosval'), true);
  p.savePuzzle('samosval', 16, [0, 3, 5]);
  assert.equal(p.puzzleState('samosval', 16), 'started');
  assert.deepEqual(p.puzzlePieces('samosval', 16), [0, 3, 5]);
  p.savePuzzle('samosval', 16, Array.from({ length: 16 }, (_, i) => i));
  assert.equal(p.puzzleState('samosval', 16), 'done');
  p.advanceObject('pesochnitsa', 2, 1);
  assert.deepEqual(p.objectState('pesochnitsa'), { step: 2, repeat: 1, done: false });
  assert.equal(p.completeObject('pesochnitsa'), 'traktor');
  assert.equal(p.objectState('pesochnitsa').done, true);
  p.setMapStop(4); assert.equal(p.mapStop(), 4);
  p.saveTug({ nextLevel: 'medium', wins: 2, losses: 1 }); assert.deepEqual(p.tug(), { nextLevel: 'medium', wins: 2, losses: 1 });
  p.setSetting('timerMinutes', 45); assert.equal(p.setting('timerMinutes'), 45);
  // каждый изменяющий метод сразу пишет в хранилище
  const saved = JSON.parse(st.getItem(SAVE_KEY));
  assert.equal(saved.machines.samosval.assembled, true);
  assert.equal(saved.machines.samosval.puzzle16, 'done');
  assert.equal(saved.map.stop, 4);
  assert.equal(saved.settings.timerMinutes, 45);
});

test('2.21 прогресс переживает перезапуск', () => {
  const st = memoryStorage();
  const a = make(st);
  a.setAssembled('samosval'); a.unlock('buldozer'); a.savePuzzle('samosval', 25, [1, 2]);
  const b = make(st);
  assert.equal(b.isAssembled('samosval'), true);
  assert.equal(b.isUnlocked('buldozer'), true);
  assert.deepEqual(b.puzzlePieces('samosval', 25), [1, 2]);
});

test('2.22 сохранение старого формата переносится без потерь', () => {
  const st = memoryStorage({ [SAVE_KEY]: JSON.stringify({ format: 0, unlocked: ['samosval', 'traktor'], assembled: ['samosval'], timerMinutes: 15 }) });
  const p = make(st);
  assert.equal(p.isUnlocked('traktor'), true);
  assert.equal(p.isAssembled('samosval'), true);
  assert.equal(p.setting('timerMinutes'), 15);
  assert.equal(JSON.parse(st.getItem(SAVE_KEY)).format, 1);
});

test('2.23 повреждённое сохранение: копия в .broken, новая игра, без исключения', () => {
  const err = captureErrors();
  try {
    for (const bad of ['{не json', JSON.stringify({ hello: 1 }), JSON.stringify({ format: 99, machines: {} }), JSON.stringify({ format: 1, machines: 5 })]) {
      const st = memoryStorage({ [SAVE_KEY]: bad });
      const p = make(st);
      assert.equal(p.isUnlocked('samosval'), true);
      assert.equal(p.isAssembled('samosval'), false);
      assert.equal(st.getItem(BROKEN_KEY), bad);
    }
    assert.ok(err.list.length >= 4);
  } finally { err.restore(); }
});

test('2.24 «открыть все машины» и «сбросить прогресс» (настройки остаются)', () => {
  const p = make();
  p.setSetting('timerMinutes', 15);
  p.unlockAll();
  for (const id of MACHINES) assert.equal(p.isUnlocked(id), true);
  p.setAssembled('traktor');
  p.reset();
  assert.equal(p.isUnlocked('traktor'), false);
  assert.equal(p.isAssembled('traktor'), false);
  assert.equal(p.isUnlocked('samosval'), true);
  assert.equal(p.setting('timerMinutes'), 15);
});

test('запись не удалась — прогресс живёт в памяти, игра не падает, одна запись в журнал', () => {
  const err = captureErrors();
  try {
    const p = new Progress({ storage: brokenStorage(), machines: MACHINES });
    p.load();
    p.setAssembled('samosval'); p.unlock('traktor');
    assert.equal(p.isAssembled('samosval'), true);
    assert.equal(p.isUnlocked('traktor'), true);
    assert.equal(err.list.filter((l) => l.includes('запись не удалась')).length, 1);
  } finally { err.restore(); }
});

test('0.11 неизвестная машина или объект: журнал и пустое состояние', () => {
  const err = captureErrors();
  try {
    const p = make();
    assert.equal(p.isUnlocked('raketa'), false);
    p.unlock('raketa');
    assert.equal(p.isUnlocked('raketa'), false);
    assert.deepEqual(p.objectState('luna'), { step: 0, repeat: 0, done: false });
    assert.equal(p.completeObject('luna'), null);
    assert.ok(err.list.length >= 3);
  } finally { err.restore(); }
});

test('подписка on(change) и отписка', () => {
  const p = make();
  let n = 0;
  const off = p.on('change', () => n++);
  p.unlock('traktor');
  off();
  p.unlock('buldozer');
  assert.equal(n, 1);
});
