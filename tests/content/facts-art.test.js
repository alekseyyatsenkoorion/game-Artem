// Картинки к фактам-сравнениям (spec.md §3): у каждой машины есть fact/<id> 360×260.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../../src/data/index.js';
import art from '../../src/art/index.js';
import { fakeGraphics } from '../core/helpers.js';

test('у каждой машины есть картинка факта fact/<id> 360×260, рисуется без исключений', () => {
  assert.equal(data.machines.length, 10);
  for (const m of data.machines) {
    const id = 'fact/' + m.id;
    const a = art[id];
    assert.ok(a, 'нет картинки ' + id);
    assert.equal(a.w, 360, id); assert.equal(a.h, 260, id);
    const g = fakeGraphics();
    assert.doesNotThrow(() => a.draw(g, a.w, a.h), id);
    assert.ok(g.calls.length > 20, id + ' почти ничего не рисует');
  }
});

test('лишних картинок fact/… нет', () => {
  const ids = new Set(data.machines.map((m) => 'fact/' + m.id));
  for (const id of Object.keys(art)) if (id.startsWith('fact/')) assert.ok(ids.has(id), id);
});
