// 0.5 по исходному коду: сцены не обращаются к хранилищу, сети и событиям браузера напрямую;
// localStorage — только Progress и ParentTimer; сеть — только Updater, game.js (загрузка файлов ядра) и sw.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const sceneFiles = ['src/games', 'src/world', 'src/data', 'src/art'].flatMap((d) => walk(join(ROOT, d))).filter((f) => f.endsWith('.js'));

const FORBIDDEN = [/localStorage/, /sessionStorage/, /indexedDB/, /\bfetch\s*\(/, /XMLHttpRequest/, /addEventListener/, /\bdocument\./, /\bwindow\./, /new\s+Image\s*\(/, /navigator\./, /setTimeout|setInterval/, /Math\.random/];

test('0.5 сцены, данные и рисование не трогают хранилище, сеть, DOM, таймеры и Math.random', () => {
  for (const f of sceneFiles) {
    const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    for (const re of FORBIDDEN) assert.ok(!re.test(src), f + ' содержит ' + re);
  }
});

test('localStorage — только в Progress, ParentTimer и сборке ядра', () => {
  const allowed = ['progress.js', 'parent-timer.js', 'game.js'];
  for (const f of walk(join(ROOT, 'src')).filter((x) => x.endsWith('.js'))) {
    if (allowed.some((a) => f.endsWith(a))) continue;
    assert.ok(!/localStorage/.test(readFileSync(f, 'utf8')), f);
  }
});

test('в игре нет внешних адресов (4.3) и сторонних библиотек', () => {
  for (const f of walk(join(ROOT, 'src')).concat([join(ROOT, 'index.html'), join(ROOT, 'sw.js')])) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/https?:\/\//.test(src), f + ' содержит внешний адрес');
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) assert.ok(m[1].startsWith('.'), f + ' импортирует ' + m[1]);
  }
});
