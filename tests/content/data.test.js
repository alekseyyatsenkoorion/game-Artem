// Группа 1: данные машин, фраз, похвал, картинки (этап 2).
// Объекты стройки (1.6–1.10) и темп каната (1.15) — этап 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import data from '../../src/data/index.js';
import art from '../../src/art/index.js';
import { rectsOverlap } from '../../src/core/draw-utils.js';
import { fakeGraphics } from '../core/helpers.js';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const MACHINE_IDS = ['samosval', 'traktor', 'buldozer', 'katok', 'betonomeshalka', 'ekskavator', 'pogruzchik', 'avtokran', 'greider', 'bashennyi-kran'];
const PART_COUNTS = [5, 5, 6, 6, 7, 7, 8, 8, 9, 10];

test('1.1 машин ровно 10, имена уникальны, латиницей через дефис, порядок по order', () => {
  const ids = data.machines.map((m) => m.id);
  assert.deepEqual(ids, MACHINE_IDS);
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
  assert.deepEqual(data.machines.map((m) => m.parts.length), PART_COUNTS); // spec.md, раздел 3
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

// Фразы, о которых договорились зоны B, C, D (записка этапа 2).
const BRIEF_PHRASES = [
  'home-hint', 'home-closed', 'garage-hint', 'garage-actions', 'garage-new', 'garage-locked',
  'assembly-task', 'assembly-hint', 'assembly-done',
  'puzzle-task', 'puzzle-hint', 'puzzle-done', 'puzzle-locked',
  'wash-water', 'wash-foam', 'wash-rinse', 'wash-stubborn', 'wash-hint', 'wash-done',
  'repair-wheel', 'repair-rust', 'repair-paint', 'repair-hint-wheel', 'repair-hint-rub', 'repair-done',
  'fuel-task', 'fuel-hint', 'fuel-done', 'timer-warning',
];

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
  for (const r of BRIEF_PHRASES) assert.ok(data.phrases[r], r);
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

test('размеры: машина не больше 620×390, детали внутри, центры деталей не ближе 60 px', () => {
  for (const m of data.machines) {
    assert.ok(m.size.w <= 620 && m.size.h <= 390, m.id + ' слишком большая');
    for (let i = 0; i < m.parts.length; i++) for (let j = i + 1; j < m.parts.length; j++) {
      const a = m.parts[i], b = m.parts[j];
      const d = Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2);
      assert.ok(d >= 60, m.id + ': ' + a.id + ' и ' + b.id + ' ближе 60 px (' + d.toFixed(1) + ')');
    }
    assert.ok(m.fuelPoint.x >= 0 && m.fuelPoint.x <= m.size.w && m.fuelPoint.y >= 0 && m.fuelPoint.y <= m.size.h, m.id + ' fuelPoint');
  }
});

test('первые три машины лёгкие, последние три — сильные', () => {
  assert.deepEqual(data.machines.slice(0, 3).map((m) => m.tug), ['easy', 'easy', 'easy']);
  assert.deepEqual(data.machines.slice(-3).map((m) => m.tug), ['hard', 'hard', 'hard']);
});

test('у каждой машины свой мотор и свой гудок; частота мотора 35–90 Гц', () => {
  const engines = data.machines.map((m) => m.sounds.engine.base);
  const horns = data.machines.map((m) => m.sounds.horn.notes.join(','));
  assert.equal(new Set(engines).size, 10);
  assert.equal(new Set(horns).size, 10);
  for (const e of engines) assert.ok(e >= 35 && e <= 90, String(e));
  for (const m of data.machines) assert.ok(m.sounds.horn.notes.length >= 2, m.id);
});

test('фразы: имя машины в винительном падеже, деталь — по одной фразе на id', () => {
  for (const m of data.machines) {
    assert.equal(m.namePhrase, 'machine-' + m.id);
    assert.equal(m.nameAccPhrase, 'machine-' + m.id + '-acc');
    for (const p of m.parts) assert.equal(p.namePhrase, 'part-' + p.id);
  }
  assert.equal(data.phrases['machine-betonomeshalka-acc'], 'бетономешалку');
});

// Все id картинок, которые обещаны соседям (записка этапа 2).
function expectedArt() {
  const list = [];
  for (const m of data.machines) {
    for (const p of m.parts) list.push(['machine/' + m.id + '/part/' + p.id, p.w, p.h]);
    for (const pose of ['idle', 'work', 'dirty', 'silhouette']) list.push(['machine/' + m.id + '/whole/' + pose, m.size.w, m.size.h]);
    list.push(['puzzle/' + m.id + '/16', 640, 480], ['puzzle/' + m.id + '/25', 640, 480]);
  }
  for (const b of ['home', 'assembly', 'garage', 'puzzle', 'wash', 'repair', 'fuel']) list.push(['bg/' + b, 1024, 768]);
  return list;
}

test('каждая картинка из списка зарегистрирована нужного размера и рисуется без исключений', () => {
  for (const [id, w, h] of expectedArt()) {
    const a = art[id];
    assert.ok(a, 'нет картинки ' + id);
    assert.equal(a.w, w, id); assert.equal(a.h, h, id);
    const g = fakeGraphics();
    assert.doesNotThrow(() => a.draw(g, a.w, a.h), id);
    assert.ok(g.calls.length > 10, id + ' почти ничего не рисует');
  }
});

test('все зарегистрированные картинки рисуются без исключений', () => {
  for (const [id, a] of Object.entries(art)) {
    assert.ok(a.w > 0 && a.h > 0 && typeof a.draw === 'function', id);
    assert.doesNotThrow(() => a.draw(fakeGraphics(), a.w, a.h), id);
  }
});

test('20 картинок пазлов — 20 разных рисунков', () => {
  const sigs = new Set();
  for (const m of data.machines) for (const size of [16, 25]) {
    const g = fakeGraphics();
    art['puzzle/' + m.id + '/' + size].draw(g, 640, 480);
    sigs.add(JSON.stringify(g.calls.slice(0, 600)));
  }
  assert.equal(sigs.size, 20);
});
