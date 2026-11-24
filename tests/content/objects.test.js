// Группа 1 (этап 3): объекты стройки, шаги, фразы, слои (tests.md 1.6–1.10, 1.12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../../src/data/index.js';
import art from '../../src/art/index.js';
import { fakeGraphics } from '../core/helpers.js';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const OBJECTS = ['pesochnitsa', 'zabor', 'domik', 'garazh', 'doroga', 'ploshchadka', 'most', 'dom-2', 'parking', 'dom-mnogo'];
const STEPS = [5, 7, 9, 10, 11, 11, 12, 13, 14, 18];
const UNLOCKS = ['traktor', 'buldozer', 'katok', 'betonomeshalka', 'ekskavator', 'pogruzchik', 'avtokran', 'greider', 'bashennyi-kran', null];
const ACTIONS = ['level', 'dig', 'haul-away', 'haul-in', 'spread', 'roll', 'pour', 'lift', 'place', 'stack', 'paint', 'line'];
const NO_MACHINE = ['place', 'stack', 'paint', 'line'];
const machineIds = data.machines.map((m) => m.id);

test('1.6 объектов ровно 10, шагов 5, 7, 9, 10, 11, 11, 12, 13, 14, 18 — всего 110', () => {
  assert.deepEqual(data.objects.map((o) => o.id), OBJECTS);
  data.objects.forEach((o, i) => assert.equal(o.order, i + 1));
  assert.deepEqual(data.objects.map((o) => o.steps.length), STEPS);
  assert.equal(data.objects.reduce((n, o) => n + o.steps.length, 0), 110);
  for (const o of data.objects) {
    assert.match(o.id, ID);
    for (const k of ['id', 'order', 'namePhrase', 'unlocks', 'steps']) assert.ok(o[k] !== undefined, o.id + ' нет ' + k);
    for (const s of o.steps) for (const k of ['machine', 'action', 'repeats', 'phrase', 'layer']) assert.ok(k in s, o.id + ': нет ' + k);
  }
});

test('1.7 каждый шаг ссылается на существующую машину (или null) и существующее действие', () => {
  for (const o of data.objects) for (const s of o.steps) {
    assert.ok(ACTIONS.includes(s.action), o.id + ': ' + s.action);
    if (s.machine === null) assert.ok(NO_MACHINE.includes(s.action), o.id + ': ' + s.action + ' без машины');
    else assert.ok(machineIds.includes(s.machine), o.id + ': ' + s.machine);
  }
});

test('1.7 действие подходит машине', () => {
  const allowed = {
    level: ['buldozer', 'greider'], dig: ['ekskavator'], 'haul-away': ['samosval'],
    'haul-in': ['samosval', 'traktor', 'pogruzchik'], spread: ['buldozer', 'greider', 'pogruzchik'],
    roll: ['katok'], pour: ['betonomeshalka'], lift: ['avtokran', 'bashennyi-kran'],
  };
  for (const o of data.objects) for (const s of o.steps) {
    if (s.machine) assert.ok((allowed[s.action] || []).includes(s.machine), o.id + ': ' + s.machine + ' ' + s.action);
  }
});

test('1.8 у каждого шага число повторов от 1 до 5', () => {
  for (const o of data.objects) for (const s of o.steps) {
    assert.ok(Number.isInteger(s.repeats) && s.repeats >= 1 && s.repeats <= 5, o.id + ' ' + s.layer);
  }
});

test('1.9 объекты открывают машины по таблице; каждая машина, кроме самосвала, открывается ровно один раз', () => {
  assert.deepEqual(data.objects.map((o) => o.unlocks), UNLOCKS);
  for (const m of machineIds) {
    const n = data.objects.filter((o) => o.unlocks === m).length;
    assert.equal(n, m === 'samosval' ? 0 : 1, m);
  }
});

test('1.10 каждая машина участвует хотя бы в одном шаге стройки', () => {
  const used = new Set();
  for (const o of data.objects) for (const s of o.steps) if (s.machine) used.add(s.machine);
  for (const m of machineIds) assert.ok(used.has(m), m);
});

test('1.12 фразы объектов и шагов есть и не пустые; без цифр повторов', () => {
  for (const o of data.objects) {
    assert.equal(o.namePhrase, 'object-' + o.id);
    assert.equal(o.nameAccPhrase, 'object-' + o.id + '-acc');
    for (const r of [o.namePhrase, o.nameAccPhrase]) assert.ok(typeof data.phrases[r] === 'string' && data.phrases[r].trim(), r);
    o.steps.forEach((s, i) => {
      assert.equal(s.phrase, 'step-' + o.id + '-' + (i + 1));
      const t = data.phrases[s.phrase];
      assert.ok(typeof t === 'string' && t.trim(), s.phrase);
      assert.ok(!/\d/.test(t), s.phrase + ': цифры в тексте');
    });
  }
  assert.equal(data.phrases['object-pesochnitsa-acc'], 'песочницу');
});

test('слои: id уникальны внутри объекта, зарегистрированы 600×440 и рисуются без исключений', () => {
  for (const o of data.objects) {
    const layers = o.steps.map((s) => s.layer);
    assert.equal(new Set(layers).size, layers.length, o.id + ': повтор слоя');
    for (const l of layers) {
      assert.match(l, ID);
      const id = 'object/' + o.id + '/layer/' + l;
      const a = art[id];
      assert.ok(a, 'нет картинки ' + id);
      assert.equal(a.w, 600, id); assert.equal(a.h, 440, id);
      const g = fakeGraphics();
      assert.doesNotThrow(() => a.draw(g, a.w, a.h), id);
      assert.ok(g.calls.length > 3, id + ' почти ничего не рисует');
    }
  }
});

test('лишних слоёв нет: каждая картинка object/… относится к шагу', () => {
  const expected = new Set();
  for (const o of data.objects) for (const s of o.steps) expected.add('object/' + o.id + '/layer/' + s.layer);
  for (const id of Object.keys(art)) if (id.startsWith('object/')) assert.ok(expected.has(id), id);
});

test('фоны этапа 3: bg/build, bg/map, bg/tug — 1024×768, рисуются без исключений', () => {
  for (const id of ['bg/build', 'bg/map', 'bg/tug']) {
    const a = art[id];
    assert.ok(a, id);
    assert.equal(a.w, 1024); assert.equal(a.h, 768);
    const g = fakeGraphics();
    assert.doesNotThrow(() => a.draw(g, a.w, a.h), id);
    assert.ok(g.calls.length > 10, id);
  }
});
