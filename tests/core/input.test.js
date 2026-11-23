// Тесты касаний: первый палец, второй палец (3.14), ладонь, родительский жест (2.34), cancel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../../src/core/input.js';

function make() {
  const sent = [];
  let parent = 0;
  const inp = new Input({ toLogical: (x, y) => ({ x, y }), send: (e) => sent.push(e), onParentGesture: () => parent++, viewport: () => ({ w: 1024, h: 768 }) });
  return { inp, sent, parent: () => parent };
}

test('сцене передаётся только первый палец; второй палец не сбивает перетаскивание (3.14)', () => {
  const { inp, sent } = make();
  inp.handle('down', 1, 500, 400);
  inp.handle('move', 1, 520, 410);
  inp.handle('down', 2, 600, 300);
  inp.handle('move', 2, 650, 300);
  inp.handle('up', 2, 650, 300);
  inp.handle('move', 1, 540, 420);
  inp.handle('up', 1, 540, 420);
  assert.deepEqual(sent.map((e) => e.type), ['down', 'move', 'move', 'up']);
  assert.deepEqual(sent.map((e) => e.x), [500, 520, 540, 540]);
});

test('ладонь (широкое касание) не слушается', () => {
  const { inp, sent } = make();
  inp.handle('down', 1, 30, 400, 120);
  inp.handle('down', 2, 500, 400, 20);
  assert.deepEqual(sent, [{ type: 'down', x: 500, y: 400 }]);
});

test('рука лежит на краю экрана неподвижно — слушается палец', () => {
  const { inp, sent } = make();
  inp.handle('down', 1, 10, 500);
  inp.handle('down', 2, 500, 400);
  inp.handle('move', 2, 520, 400);
  assert.deepEqual(sent.map((e) => e.type), ['down', 'cancel', 'down', 'move']);
});

test('cancel от системы доходит до сцены', () => {
  const { inp, sent } = make();
  inp.handle('down', 1, 500, 400);
  inp.handle('cancel', 1, 500, 400);
  assert.equal(sent[1].type, 'cancel');
  inp.handle('down', 3, 500, 400);
  inp.cancelAll();
  assert.equal(sent[sent.length - 1].type, 'cancel');
});

test('2.34 родительский жест: два пальца в верхних углах 3 секунды; сцене не передаётся', () => {
  const { inp, sent, parent } = make();
  inp.handle('down', 1, 40, 40);
  inp.handle('down', 2, 990, 40);
  for (let i = 0; i < 50; i++) inp.tick(0.05); // 2,5 с
  assert.equal(parent(), 0);
  for (let i = 0; i < 12; i++) inp.tick(0.05);
  assert.equal(parent(), 1);
  for (let i = 0; i < 100; i++) inp.tick(0.05);
  assert.equal(parent(), 1); // один раз за удержание
  inp.handle('up', 1, 40, 40); inp.handle('up', 2, 990, 40);
  assert.deepEqual(sent.map((e) => e.type), ['down', 'cancel']);
});

test('жест прерван раньше 3 секунд — ничего не открывается; один палец в углу — не жест', () => {
  const { inp, parent } = make();
  inp.handle('down', 1, 40, 40);
  inp.handle('down', 2, 990, 40);
  for (let i = 0; i < 40; i++) inp.tick(0.05);
  inp.handle('up', 2, 990, 40);
  for (let i = 0; i < 100; i++) inp.tick(0.05);
  assert.equal(parent(), 0);
  inp.handle('down', 3, 500, 40);
  for (let i = 0; i < 100; i++) inp.tick(0.05);
  assert.equal(parent(), 0);
});
