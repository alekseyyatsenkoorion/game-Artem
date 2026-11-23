// Группа 1 для того, что сделано на этапе 1 (самосвал, фразы, похвалы).
// Проверки «машин ровно 10» и «объектов ровно 10» (1.1, 1.6–1.10) включаются на этапах 2–3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import data from '../../src/data/index.js';
import art from '../../src/art/index.js';
import { rectsOverlap } from '../../src/core/draw-utils.js';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

test('1.1 имена машин уникальны, латиницей через дефис, порядок по order', () => {
  const ids = data.machines.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of data.machines) assert.match(m.id, ID);
  data.machines.forEach((m, i) => assert.equal(m.order, i + 1));
  assert.equal(data.machines[0].id, 'samosval');
});

test('1.2 у машины от 5 до 10 деталей; число деталей не убывает по списку', () => {
  let prev = 0;
  for (const m of data.machines) {
    assert.ok(m.parts.length >= 5 && m.parts.length <= 10, m.id);
    assert.ok(m.parts.length >= prev);
    prev = m.parts.length;
  }
  assert.equal(data.machines[0].parts.length, 5); // самосвал — 5 деталей (spec.md, раздел 3)
});

test('1.3 у машины есть рабочая часть, мотор, гудок, 4–5 фактов; поля контракта на месте', () => {
  for (const m of data.machines) {
    for (const k of ['id', 'order', 'namePhrase', 'size', 'parts', 'workPart', 'wheels', 'fuelPoint', 'tug', 'facts', 'puzzles']) assert.ok(m[k] !== undefined, m.id + ' нет ' + k);
    assert.ok(m.parts.some((p) => p.id === m.workPart));
    for (const wId of m.wheels) assert.ok(m.parts.some((p) => p.id === wId));
    assert.ok(m.sounds && m.sounds.engine && m.sounds.horn);
    assert.ok(m.facts.length >= 4 && m.facts.length <= 5);
    assert.ok(['easy', 'medium', 'hard'].includes(m.tug));
  }
});

test('1.4 у машины есть факт-сравнение с картинкой', () => {
  for (const m of data.machines) assert.ok(m.facts.includes(m.factWithPicture), m.id);
});

test('1.5 у каждой детали место на контуре; места не накладываются', () => {
  for (const m of data.machines) {
    for (const p of m.parts) {
      assert.match(p.id, ID);
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= m.size.w && p.y + p.h <= m.size.h, m.id + '/' + p.id);
    }
    for (let i = 0; i < m.parts.length; i++) for (let j = i + 1; j < m.parts.length; j++) {
      assert.ok(!rectsOverlap(m.parts[i], m.parts[j]), m.parts[i].id + ' и ' + m.parts[j].id);
    }
  }
});

test('1.11 похвал 12, все разные, имя подставляется', () => {
  assert.equal(data.praises.length, 12);
  const texts = data.praises.map((id) => data.phrases[id]);
  assert.equal(new Set(texts).size, 12);
  assert.ok(texts.filter((t) => t.includes('{name}')).length >= 6);
});

test('1.12 у каждой фразы есть текст; все ссылки на фразы существуют', () => {
  for (const [id, t] of Object.entries(data.phrases)) assert.ok(typeof t === 'string' && t.trim(), id);
  for (const m of data.machines) {
    const refs = [m.namePhrase, m.nameAccPhrase, ...m.facts, ...m.parts.map((p) => p.namePhrase)];
    for (const r of refs) assert.ok(data.phrases[r], m.id + ': нет фразы ' + r);
  }
  for (const r of ['assembly-task', 'assembly-hint', 'home-hint', 'home-ready', 'timer-warning']) assert.ok(data.phrases[r], r);
});

test('1.13 все картинки, на которые ссылаются данные, нарисованы', () => {
  for (const m of data.machines) {
    for (const p of m.parts) assert.ok(art['machine/' + m.id + '/part/' + p.id], p.id);
    for (const pose of ['idle', 'work', 'dirty', 'silhouette']) assert.ok(art['machine/' + m.id + '/whole/' + pose], pose);
    for (const p of m.parts) {
      const a = art['machine/' + m.id + '/part/' + p.id];
      assert.equal(a.w, p.w); assert.equal(a.h, p.h);
    }
  }
  const manifest = JSON.parse(readFileSync(join(ROOT, 'assets/gpt/manifest.json'), 'utf8'));
  const files = readdirSync(join(ROOT, 'assets/gpt'));
  for (const f of Object.values(manifest)) assert.ok(files.includes(f), f);
});

test('1.14 два разных описания пазла: 16 — влево на природе, 25 — вправо на стройке', () => {
  for (const m of data.machines) {
    assert.deepEqual(m.puzzles[16], { facing: 'left', scene: 'nature' });
    assert.deepEqual(m.puzzles[25], { facing: 'right', scene: 'stroika' });
  }
});

test('имя ребёнка хранится в одном месте', () => {
  assert.equal(data.childName, 'Артём');
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  const withName = walk(join(ROOT, 'src')).filter((f) => f.endsWith('.js') && readFileSync(f, 'utf8').includes('Артём'));
  assert.deepEqual(withName.map((f) => f.slice(ROOT.length + 1)), ['src/data/index.js']);
});
