// Тесты AssetLoader: картинки рисуются один раз, заглушка без исключений, подмена из assets/gpt (2.38).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssetLoader } from '../../src/core/assets.js';
import { fakeCanvas, captureErrors } from './helpers.js';

test('картинка рисуется один раз и отдаётся сразу', async () => {
  let draws = 0;
  const a = new AssetLoader({ registry: { 'ui/x': { w: 10, h: 20, draw: () => draws++ } }, createCanvas: fakeCanvas, scale: 2 });
  await a.preload(['ui/x']);
  a.image('ui/x'); a.image('ui/x');
  assert.equal(draws, 1);
  assert.deepEqual(a.size('ui/x'), { w: 10, h: 20 });
  assert.equal(a.image('ui/x').width, 20);
});

test('0.11 неизвестный id или сбой рисования — заглушка, одна запись в журнал на id', async () => {
  const err = captureErrors();
  try {
    const a = new AssetLoader({ registry: { bad: { w: 5, h: 5, draw: () => { throw new Error('x'); } } }, createCanvas: fakeCanvas });
    await a.preload(['nope', 'bad']);
    assert.ok(a.image('nope'));
    assert.ok(a.image('nope'));
    assert.ok(a.image('bad'));
    assert.equal(err.list.length, 2);
    assert.ok(a.placeholderCount > 0);
  } finally { err.restore(); }
});

test('2.38 картинка из assets/gpt заменяет нарисованную; без неё — рисует код', async () => {
  const reg = { 'puzzle/samosval/16': { w: 800, h: 600, draw: () => {} }, 'bg/garage': { w: 1024, h: 768, draw: () => {} } };
  const file = { width: 1600, height: 1200, fromFile: true };
  const loaded = [];
  const a = new AssetLoader({
    registry: reg, createCanvas: fakeCanvas,
    fetchJson: async () => ({ 'puzzle/samosval/16': 'puzzle-01-samosval-16.png' }),
    loadImage: async (url) => { loaded.push(url); return file; },
  });
  await a.preload(['puzzle/samosval/16', 'bg/garage']);
  assert.equal(a.image('puzzle/samosval/16'), file);
  assert.deepEqual(a.size('puzzle/samosval/16'), { w: 800, h: 600 });
  assert.deepEqual(loaded, ['assets/gpt/puzzle-01-samosval-16.png']);
  assert.notEqual(a.image('bg/garage'), file);
});

test('файл из assets/gpt не открылся — берётся нарисованная кодом', async () => {
  const err = captureErrors();
  try {
    const a = new AssetLoader({
      registry: { 'bg/map': { w: 4, h: 4, draw: () => {} } }, createCanvas: fakeCanvas,
      fetchJson: async () => ({ 'bg/map': 'bg-karta.png' }),
      loadImage: async () => { throw new Error('404'); },
    });
    await a.preload(['bg/map']);
    assert.equal(a.image('bg/map').width, 4);
    assert.equal(a.placeholderCount, 0);
  } finally { err.restore(); }
});

test('release выгружает картинки', async () => {
  const a = new AssetLoader({ registry: { x: { w: 1, h: 1, draw() {} } }, createCanvas: fakeCanvas });
  await a.preload(['x']);
  assert.equal(a.cachedCount(), 1);
  a.release(['x']);
  assert.equal(a.cachedCount(), 0);
});
