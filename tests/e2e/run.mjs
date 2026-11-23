// Сквозные прогоны в браузере без окна (Playwright): группы 3, 4, 5 из tests.md — для того, что есть на этапе.
// Запуск: node tests/e2e/run.mjs   Снимки экрана: test-results/shots/
import { createRequire } from 'node:module';
import { mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from '../../tools/serve.mjs';
import { listFiles, sizes } from '../../tools/build.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const SHOTS = join(ROOT, 'test-results', 'shots');
mkdirSync(SHOTS, { recursive: true });

const results = [];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; // отладка: ONLY=3.6,3.14
async function check(id, name, fn) {
  if (ONLY && !ONLY.includes(id)) return;
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ id, name, ok: true, note: note || '' });
    console.log('ok   ' + id + ' ' + name + (note ? ' — ' + note : '') + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' с)');
  } catch (e) {
    results.push({ id, name, ok: false, note: e.message });
    if (process.env.ONLY) console.log(e.stack);
    console.log('FAIL ' + id + ' ' + name + ' — ' + e.message);
  }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await pw.chromium.launch();
const consoleErrors = [];
const externalRequests = [];
const PORT = 8141;
const BASE = 'http://127.0.0.1:' + PORT + '/';
const server = await serve(PORT, ROOT);

async function newPage(ctxOpts = {}) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2, hasTouch: true, ...ctxOpts });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:')) externalRequests.push(r.url()); });
  const cdp = await context.newCDPSession(page);
  return { context, page, cdp };
}

async function ready(page, base = BASE, query = '?seed=5') {
  await page.goto(base + query);
  await page.waitForFunction(() => window.__stroika && window.__stroika.scenes.current() === 'home' && !window.__stroika.scenes.loading);
  await sleep(300);
}

const scene = (page) => page.evaluate(() => window.__stroika.scenes.current());

// Касание пальцем через CDP (настоящие touch-события → pointer-события в странице).
async function touch(cdp, type, points) {
  await cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 5, radiusY: 5 })),
  });
}
async function tap(cdp, x, y) {
  await touch(cdp, 'touchStart', [{ x, y }]);
  await sleep(40);
  await touch(cdp, 'touchEnd', []);
  await sleep(40);
}
async function dragTouch(cdp, x1, y1, x2, y2, steps = 12) {
  await touch(cdp, 'touchStart', [{ x: x1, y: y1 }]);
  for (let i = 1; i <= steps; i++) {
    await touch(cdp, 'touchMove', [{ x: x1 + (x2 - x1) * i / steps, y: y1 + (y2 - y1) * i / steps }]);
    await sleep(16);
  }
  await touch(cdp, 'touchEnd', []);
  await sleep(60);
}
async function parentGesture(cdp, hold = 3300) {
  await touch(cdp, 'touchStart', [{ x: 40, y: 40, id: 1 }]);
  await touch(cdp, 'touchStart', [{ x: 40, y: 40, id: 1 }, { x: 984, y: 40, id: 2 }]);
  await sleep(hold);
  await touch(cdp, 'touchEnd', []);
  await sleep(100);
}
async function parts(page) {
  return page.evaluate(() => window.__stroika.scenes.currentScene().parts.map((p) => ({ id: p.def.id, x: p.cx, y: p.cy, sx: p.slot.cx, sy: p.slot.cy, placed: p.placed })));
}
async function shot(page, name) { await page.screenshot({ path: join(SHOTS, name + '.png') }); }

// В логических координатах = CSS-пикселях при окне 1024×768.
async function assembleAll(page, cdp, shotsPrefix) {
  const list = await parts(page);
  let i = 0;
  for (const p of list) {
    await dragTouch(cdp, p.x, p.y, p.sx, p.sy, 8);
    await sleep(200);
    if (shotsPrefix && i === 1) await shot(page, shotsPrefix);
    i++;
  }
}
const cur = (page, expr) => page.evaluate('(() => { const s = window.__stroika.scenes.currentScene(); return ' + expr + '; })()');
const waitScene = (page, id, timeout = 10000) => page.waitForFunction((id) => window.__stroika.scenes.current() === id && !window.__stroika.scenes.loading, id, { timeout });
const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// Протереть пальцем прямоугольник змейкой (мойка, ржавчина, покраска).
async function rub(cdp, r, step = 26) {
  const pts = [];
  let dir = 1;
  for (let y = r.y + step / 2; y <= r.y + r.h; y += step) {
    const xs = dir > 0 ? [r.x, r.x + r.w] : [r.x + r.w, r.x];
    pts.push({ x: xs[0], y }, { x: xs[1], y });
    dir = -dir;
  }
  await touch(cdp, 'touchStart', [pts[0]]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 18));
    for (let k = 1; k <= n; k++) { await touch(cdp, 'touchMove', [{ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n }]); await sleep(8); }
  }
  await touch(cdp, 'touchEnd', []);
  await sleep(60);
}
const clip = (r) => { const x = Math.max(100, r.x), y = Math.max(100, r.y); return { x, y, w: Math.min(1010, r.x + r.w) - x, h: Math.min(760, r.y + r.h) - y }; };

async function playPuzzle(page, cdp) {
  const list = await cur(page, 's.pieces.filter((p) => !p.placed).map((p) => ({ i: p.index, x: p.cx, y: p.cy, sx: p.slot.cx, sy: p.slot.cy }))');
  for (const p of list) { await dragTouch(cdp, p.x, p.y, p.sx, p.sy, 5); await sleep(30); }
  return cur(page, 's.isComplete()');
}

async function playWash(page, cdp) {
  let last = 0;
  for (let guard = 0; guard < 30; guard++) {
    const st = await cur(page, '({ phase: s.phase, round: s.round, b: s.bounds, spots: s.spots })');
    if (st.phase === 'done') return st.round;
    if (!st.b) return last; // мойка уже закончилась и вернула в гараж
    last = st.round;
    const area = st.round === 2 && st.spots && st.spots.length
      ? st.spots.map((p) => ({ x: p.x - p.r - 30, y: p.y - p.r - 30, w: 2 * p.r + 60, h: 2 * p.r + 60 }))
      : [{ x: st.b.x - 10, y: st.b.y - 10, w: st.b.w + 20, h: st.b.h + 20 }];
    for (const r of area) await rub(cdp, clip(r));
    await sleep(150);
  }
  throw new Error('мойка не закончилась');
}

async function playRepair(page, cdp) {
  const st = await cur(page, '({ kind: s.kind, pump: s.pumpRect, spot: s.spot, cans: s.cans })');
  if (st.kind === 'wheel') {
    const c = center(st.pump);
    for (let i = 0; i < 12 && (await cur(page, 's.state')) === 'play'; i++) { await tap(cdp, c.x, c.y); await sleep(120); }
  } else {
    if (st.kind === 'paint') { await tap(cdp, st.cans[0].cx, st.cans[0].cy); await sleep(100); }
    const r = { x: st.spot.cx - st.spot.r - 20, y: st.spot.cy - st.spot.r - 20, w: 2 * st.spot.r + 40, h: 2 * st.spot.r + 40 };
    for (let i = 0; i < 4 && (await cur(page, 's.state')) === 'play'; i++) await rub(cdp, clip(r), 20);
  }
  return st.kind;
}

async function playFuel(page, cdp) {
  const st = await cur(page, '({ h: s.hose, t: s.tank })');
  await touch(cdp, 'touchStart', [{ x: st.h.x, y: st.h.y }]);
  for (let k = 1; k <= 12; k++) { await touch(cdp, 'touchMove', [{ x: st.h.x + (st.t.x - st.h.x) * k / 12, y: st.h.y + (st.t.y - st.h.y) * k / 12 }]); await sleep(16); }
  // держим у бака; на полпути отпускаем — шкала не сбрасывается (2.18)
  await sleep(1500);
  await touch(cdp, 'touchEnd', []);
  await sleep(500);
  const mid = await cur(page, 's.level');
  if (!(mid > 0.2)) throw new Error('шкала сбросилась: ' + mid);
  const h2 = await cur(page, '({ x: s.hose.x, y: s.hose.y })');
  await touch(cdp, 'touchStart', [h2]);
  for (let k = 1; k <= 12; k++) { await touch(cdp, 'touchMove', [{ x: h2.x + (st.t.x - h2.x) * k / 12, y: h2.y + (st.t.y - h2.y) * k / 12 }]); await sleep(16); }
  await sleep(3500);
  const full = await cur(page, 's.level === undefined ? 1 : s.level'); // undefined — сцена уже закончилась и вернула в гараж
  await touch(cdp, 'touchEnd', []);
  return full;
}

// Открыть мини-игру из гаража и пройти её; ждём возврата в гараж.
async function runFromGarage(page, cdp, id, params, play, shotName) {
  await page.evaluate(({ id, params }) => window.__stroika.scenes.open(id, params), { id, params });
  await waitScene(page, id);
  await sleep(250);
  if (shotName) await shot(page, shotName);
  const out = await play(page, cdp);
  await waitScene(page, 'garage', 15000);
  return out;
}

// Все машины открыты и собраны, на экране гараж (если предыдущие проверки пропущены).
async function inGarage(page) {
  await page.evaluate(() => { const g = window.__stroika; g.progress.unlockAll(); for (const m of g.data.machines) g.progress.setAssembled(m.id); });
  if ((await scene(page)) !== 'garage') {
    await page.evaluate(() => { window.__stroika.scenes.backToRoot(); return window.__stroika.scenes.open('garage'); });
    await waitScene(page, 'garage');
  }
}

const MACHINES_E2E = await (async () => {
  const { pathToFileURL } = await import('node:url');
  const d = (await import(pathToFileURL(join(ROOT, 'src', 'data', 'index.js')).href)).default;
  return d.machines.map((m) => m.id);
})();

// ---------------- Группа 3 ----------------
{
  const { page, cdp, context } = await newPage();
  await ready(page);

  await check('3.1', 'Главный экран: три входа; гараж открывается, карта и канат пока закрыты (этап 3)', async () => {
    await shot(page, '01-glavnyi-ekran');
    const entries = await cur(page, 's.entries.map((e) => ({ id: e.id, rect: e.rect, active: e.active }))');
    assert(entries.length === 3, 'входов ' + entries.length);
    for (const e of entries.filter((x) => !x.active)) {
      const c = center(e.rect); await tap(cdp, c.x, c.y); await sleep(900);
      assert((await scene(page)) === 'home', 'закрытый вход ' + e.id + ' открыл ' + (await scene(page)));
    }
    await sleep(5600);
    await shot(page, '02-glavnyi-ekran-podskazka-ruka');
    const g = center(entries.find((e) => e.id === 'garage').rect);
    await tap(cdp, g.x, g.y);
    await waitScene(page, 'garage', 5000);
    await sleep(500);
    await shot(page, '03-garazh-novaya-igra');
  });

  await check('3.3', 'Сборка: все 10 машин собираются касаниями из гаража; после каждой открывается следующая (временное правило этапа 2)', async () => {
    for (let n = 0; n < MACHINES_E2E.length; n++) {
      const id = MACHINES_E2E[n];
      const slot = await cur(page, 's.slots.find((x) => x.machine === ' + JSON.stringify(id) + ')');
      assert(slot && slot.state === 'parts', id + ': ждали «детали», а ' + (slot && slot.state));
      const c = center(slot.rect);
      await tap(cdp, c.x, c.y);
      await waitScene(page, 'assembly', 6000);
      await sleep(300);
      await assembleAll(page, cdp, 'sborka-' + String(n + 1).padStart(2, '0') + '-' + id);
      assert(await cur(page, 's.isAssembled()'), id + ': не все детали встали');
      await waitScene(page, 'garage', 12000);
      assert(await page.evaluate((id) => window.__stroika.progress.isAssembled(id), id), id + ' не сохранена');
      const next = MACHINES_E2E[n + 1];
      if (next) assert(await page.evaluate((id) => window.__stroika.progress.isUnlocked(id), next), next + ' не открылась');
      await sleep(1800);
    }
    await shot(page, '04-garazh-vse-sobrany');
    return MACHINES_E2E.length + ' машин';
  });

  await check('3.2', 'Гараж: тык по каждой из 10 машин показывает её крупно со значками', async () => {
    for (let n = 0; n < MACHINES_E2E.length; n++) {
      const id = MACHINES_E2E[n];
      await page.waitForFunction(() => window.__stroika.scenes.currentScene().mode === 'row', null, { timeout: 5000 });
      const slot = await cur(page, 's.slots.find((x) => x.machine === ' + JSON.stringify(id) + ')');
      const c = center(slot.rect);
      await tap(cdp, c.x, c.y);
      await page.waitForFunction(() => window.__stroika.scenes.currentScene().mode === 'big', null, { timeout: 5000 });
      assert((await cur(page, 's.selected')) === id, 'крупно не та машина');
      const icons = await cur(page, 's.icons.map((i) => i.scene + (i.params && i.params.size ? i.params.size : ""))');
      for (const need of ['assembly', 'puzzle16', 'puzzle25', 'wash', 'repair', 'fuel']) assert(icons.includes(need), id + ': нет значка ' + need);
      if (n === 0 || n === 9) await shot(page, '05-garazh-krupno-' + id);
      // тык мимо машины и значков — назад к ряду
      await tap(cdp, 980, 140);
      await sleep(200);
    }
  });

  await check('3.4', 'Пазлы: все 20 пазлов собираются касаниями; 25 закрыт, пока не собран 16; сохраняются', async () => {
    await inGarage(page);
    // 2.37 в браузере: пазл 25 у несобранного 16 закрыт
    await page.evaluate(() => window.__stroika.scenes.open('puzzle', { machine: 'traktor', size: 25 }));
    await waitScene(page, 'puzzle');
    await sleep(300);
    assert((await cur(page, 's.state')) === 'locked', 'пазл 25 открыт без 16');
    await waitScene(page, 'garage', 8000);
    let n = 0;
    for (const id of MACHINES_E2E) {
      for (const size of [16, 25]) {
        const ok = await runFromGarage(page, cdp, 'puzzle', { machine: id, size }, async (p, c) => {
          // полпазла, выход крестиком, возврат — продолжение с того же места (2.8)
          if (n === 0) {
            const list = await cur(p, 's.pieces.slice(0, 5).map((q) => ({ x: q.cx, y: q.cy, sx: q.slot.cx, sy: q.slot.cy }))');
            for (const q of list) await dragTouch(c, q.x, q.y, q.sx, q.sy, 5);
            const placed = await cur(p, 's.placedIndices().length');
            await tap(c, 48, 48);
            await waitScene(p, 'garage');
            await p.evaluate(() => window.__stroika.scenes.open('puzzle', { machine: 'samosval', size: 16 }));
            await waitScene(p, 'puzzle');
            await sleep(200);
            const again = await cur(p, 's.placedIndices().length');
            if (again !== placed) throw new Error('2.8: было ' + placed + ', стало ' + again);
          }
          const done = await playPuzzle(p, c);
          await shot(p, 'pazl-' + id + '-' + size);
          return done;
        });
        assert(ok, id + ' ' + size + ' не собран');
        assert((await page.evaluate(({ id, size }) => window.__stroika.progress.puzzleState(id, size), { id, size })) === 'done', id + ' ' + size + ' не сохранён');
        n++;
      }
    }
    return n + ' пазлов';
  });

  await check('3.6', 'Мойка (один и два круга), мастерская (3 вида ремонта), заправка — для каждой машины', async () => {
    const notes = [];
    await inGarage(page);
    for (const id of MACHINES_E2E) {
      // один круг: прошлая мойка была с упрямой грязью — значит, сейчас её не будет
      await page.evaluate(() => window.__stroika.progress.saveWash({ lastWasStubborn: true }));
      const r1 = await runFromGarage(page, cdp, 'wash', { machine: id }, playWash, id === 'samosval' ? '06-moika-nachalo' : null);
      assert(r1 === 1, id + ': ждали 1 круг, было ' + r1);
      // два круга: повторяем вход, пока не выпадет упрямая грязь
      let r2 = 0;
      for (let tries = 0; tries < 12 && r2 !== 2; tries++) {
        await page.evaluate(() => window.__stroika.progress.saveWash({ lastWasStubborn: false }));
        await page.evaluate((id) => window.__stroika.scenes.open('wash', { machine: id }), id);
        await waitScene(page, 'wash');
        await sleep(150);
        if (!(await cur(page, 's.stubborn'))) { await tap(cdp, 48, 48); await waitScene(page, 'garage'); continue; }
        r2 = await playWash(page, cdp);
        if (id === 'samosval') await shot(page, '07-moika-gotovo');
        await waitScene(page, 'garage', 15000);
      }
      assert(r2 === 2, id + ': два круга не получились');
      const kinds = [];
      for (const kind of ['wheel', 'rust', 'paint']) {
        const got = await runFromGarage(page, cdp, 'repair', { machine: id, kind }, playRepair, id === 'samosval' ? '08-remont-' + kind : null);
        kinds.push(got);
      }
      assert(kinds.includes('rust') && kinds.includes('paint'), id + ': ремонты ' + kinds.join(','));
      const level = await runFromGarage(page, cdp, 'fuel', { machine: id }, playFuel, id === 'samosval' ? '09-zapravka' : null);
      assert(level >= 0.99, id + ': шкала ' + level);
      notes.push(id + ':' + kinds.join('/'));
    }
    return notes.join(' ');
  });

  await check('3.9', 'Крестик выводит из каждой сцены этапа 2, прогресс на месте', async () => {
    for (const [id, params] of [['assembly', { machine: 'katok' }], ['puzzle', { machine: 'katok', size: 16 }], ['wash', { machine: 'katok' }], ['repair', { machine: 'katok' }], ['fuel', { machine: 'katok' }]]) {
      await page.evaluate(({ id, params }) => window.__stroika.scenes.open(id, params), { id, params });
      await waitScene(page, id);
      await sleep(200);
      await tap(cdp, 48, 48);
      await sleep(250);
      assert((await scene(page)) === 'garage', 'из ' + id + ' попал в ' + (await scene(page)));
    }
    await tap(cdp, 48, 48);
    await sleep(250);
    assert((await scene(page)) === 'home', 'из гаража попал в ' + (await scene(page)));
    assert(await page.evaluate(() => window.__stroika.progress.isAssembled('bashennyi-kran')), 'прогресс потерян');
  });

  await check('3.14', 'Второй палец во время перетаскивания не сбивает первый', async () => {
    await inGarage(page);
    await page.evaluate(() => window.__stroika.scenes.open('assembly', { machine: 'samosval' }));
    await waitScene(page, 'assembly');
    await sleep(300);
    const p = (await parts(page)).find((x) => x.id === 'kabina');
    await touch(cdp, 'touchStart', [{ x: p.x, y: p.y, id: 1 }]);
    for (let i = 1; i <= 6; i++) { await touch(cdp, 'touchMove', [{ x: p.x + (p.sx - p.x) * i / 12, y: p.y + (p.sy - p.y) * i / 12, id: 1 }]); await sleep(16); }
    const mid = { x: p.x + (p.sx - p.x) / 2, y: p.y + (p.sy - p.y) / 2 };
    await touch(cdp, 'touchStart', [{ ...mid, id: 1 }, { x: 900, y: 650, id: 2 }]);
    await touch(cdp, 'touchMove', [{ ...mid, id: 1 }, { x: 700, y: 600, id: 2 }]);
    await touch(cdp, 'touchEnd', [{ x: 700, y: 600, id: 2 }]); // убран второй палец (в CDP touchEnd перечисляет отпущенные точки)
    for (let i = 7; i <= 12; i++) { await touch(cdp, 'touchMove', [{ x: p.x + (p.sx - p.x) * i / 12, y: p.y + (p.sy - p.y) * i / 12, id: 1 }]); await sleep(16); }
    await touch(cdp, 'touchEnd', []);
    await sleep(300);
    const after = (await parts(page)).find((x) => x.id === 'kabina');
    if (!after.placed && process.env.ONLY) console.log(JSON.stringify({ before: p, after, all: await parts(page) }));
    assert(after.placed, 'кабина не встала');
    await tap(cdp, 48, 48);
    await sleep(250);
  });

  await check('3.13', 'Хаотичные касания (200 тыков и протяжек) в каждой сцене этапа 2', async () => {
    let seed = 11;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const list = [['home'], ['garage'], ['assembly', { machine: 'ekskavator' }], ['puzzle', { machine: 'avtokran', size: 25 }], ['wash', { machine: 'pogruzchik' }], ['repair', { machine: 'greider' }], ['fuel', { machine: 'betonomeshalka' }]];
    for (const [id, params] of list) {
      await page.evaluate(() => window.__stroika.scenes.backToRoot());
      await sleep(100);
      if (id !== 'home') { await page.evaluate(({ id, params }) => window.__stroika.scenes.open(id, params || {}), { id, params }); await waitScene(page, id); }
      for (let i = 0; i < 200; i++) {
        const x = 100 + rnd() * 900, y = 100 + rnd() * 660; // мимо крестика, чтобы остаться в сцене
        if (rnd() < 0.5) { await touch(cdp, 'touchStart', [{ x, y }]); await touch(cdp, 'touchEnd', []); }
        else await dragTouch(cdp, x, y, 100 + rnd() * 900, 100 + rnd() * 660, 3);
        // сцена закончилась или увела в другую — возвращаемся в исходную
        const now = await scene(page);
        if (now !== id && !(await page.evaluate(() => window.__stroika.scenes.loading))) {
          await page.evaluate(() => window.__stroika.scenes.backToRoot());
          if (id !== 'home') { await page.evaluate(({ id, params }) => window.__stroika.scenes.open(id, params || {}), { id, params }); await waitScene(page, id); }
        }
      }
      const t = await page.evaluate(() => window.__stroika.frames.length);
      assert(t > 10, 'кадры не идут');
    }
    await page.evaluate(() => window.__stroika.scenes.backToRoot());
    await sleep(500);
  });

  await check('3.10', 'Таймер: блокировка «Машины спят» и снятие только жестом взрослого', async () => {
    await parentGesture(cdp);
    assert((await scene(page)) === 'parent', 'жест не открыл экран взрослых: ' + (await scene(page)));
    await shot(page, '10-ekran-dlya-vzroslyh');
    const b = await page.evaluate(() => window.__stroika.scenes.currentScene().buttons.find((x) => x.id === 'test'));
    await tap(cdp, b.x + 50, b.y + 30);
    await sleep(200);
    assert((await scene(page)) === 'home', 'после проверки не вернулся в игру');
    const rem = await page.evaluate(() => window.__stroika.timer.remaining());
    assert(rem >= 58 && rem <= 60, 'остаток ' + rem);
    await page.evaluate(() => { window.__stroika.timer.s.remaining = 1.5; }); // ускоряем минуту
    await page.waitForFunction(() => window.__stroika.scenes.current() === 'locked', null, { timeout: 5000 });
    await sleep(500);
    await shot(page, '11-mashiny-spyat');
    await tap(cdp, 48, 48); await tap(cdp, 512, 500);
    await sleep(300);
    assert((await scene(page)) === 'locked', 'блокировка снялась касанием');
    await page.reload();
    await page.waitForFunction(() => window.__stroika && window.__stroika.scenes.current() === 'locked', null, { timeout: 5000 });
    await parentGesture(cdp);
    assert((await scene(page)) === 'parent', 'жест не сработал на блокировке');
    await tap(cdp, 48, 48);
    await sleep(300);
    assert((await scene(page)) === 'home', 'после экрана взрослых не вернулся домой: ' + (await scene(page)));
    assert(!(await page.evaluate(() => window.__stroika.timer.isLocked())), 'всё ещё заблокировано');
  });

  await check('3.12', 'Снимки: картинка в экране, нет пустых и чёрных экранов (по каждой сцене)', async () => {
    const out = [];
    for (const [id, params] of [['home'], ['garage'], ['assembly', { machine: 'bashennyi-kran' }], ['puzzle', { machine: 'greider', size: 25 }], ['wash', { machine: 'katok' }], ['repair', { machine: 'traktor', kind: 'wheel' }], ['fuel', { machine: 'avtokran' }]]) {
      await page.evaluate(() => window.__stroika.scenes.backToRoot());
      if (id !== 'home') { await page.evaluate(({ id, params }) => window.__stroika.scenes.open(id, params || {}), { id, params }); await waitScene(page, id); }
      await sleep(400);
      const dark = await page.evaluate(() => {
        const c = document.getElementById('game');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let k = 0, n = 0;
        for (let i = 0; i < d.length; i += 4 * 97) { n++; if (d[i] + d[i + 1] + d[i + 2] < 60) k++; }
        return k / n;
      });
      assert(dark < 0.2, id + ': тёмных пикселей ' + (dark * 100).toFixed(0) + '%');
      out.push(id);
    }
    await page.evaluate(() => window.__stroika.scenes.backToRoot());
    return out.join(', ') + '; остальное — по снимкам глазами (3.15)';
  });

  await context.close();
}

// ---------------- Группа 4 ----------------
{
  const { page, context } = await newPage();
  await check('4.1', 'После первого открытия все файлы игры сохранены на устройстве', async () => {
    await ready(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const c = await caches.open(keys.find((k) => k.startsWith('stroika-')));
      return (await c.keys()).map((r) => new URL(r.url).pathname.slice(1));
    });
    const need = listFiles(ROOT);
    const missing = need.filter((f) => !cached.includes(f));
    assert(!missing.length, 'не сохранены: ' + missing.join(', '));
    return need.length + ' файлов';
  });

  await check('4.9', 'Прогресс после перезагрузки на месте; то же без сети', async () => {
    await page.evaluate(() => window.__stroika.progress.setAssembled('samosval'));
    await page.reload();
    await page.waitForFunction(() => window.__stroika && window.__stroika.scenes.current() === 'home');
    assert(await page.evaluate(() => window.__stroika.progress.isAssembled('samosval')), 'потерян после перезагрузки');
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.__stroika && window.__stroika.scenes.current() === 'home');
    assert(await page.evaluate(() => window.__stroika.progress.isAssembled('samosval')), 'потерян без сети');
  });

  await check('4.2', 'Без сети игра запускается и проходится сборка', async () => {
    await page.reload();
    await page.waitForFunction(() => window.__stroika && window.__stroika.scenes.current() === 'home');
    await page.evaluate(() => window.__stroika.scenes.open('assembly', { machine: 'samosval' }));
    await page.waitForFunction(() => window.__stroika.scenes.current() === 'assembly');
    const cdp = await context.newCDPSession(page);
    await assembleAll(page, cdp);
    await page.waitForFunction(() => window.__stroika.scenes.current() === 'home', null, { timeout: 9000 });
    await shot(page, '11-bez-seti-glavnyi');
    await context.setOffline(false);
  });
  await context.close();
}

await check('4.4–4.8', 'Обновление: скачивается в фоне, игру не прерывает, включается при следующем запуске, прогресс на месте; обрыв сети — работает старая', async () => {
  // копия проекта, где можно выпустить «новую версию»
  const dir = join(tmpdir(), 'stroika-update-' + Date.now());
  cpSync(ROOT, dir, { recursive: true, filter: (s) => !s.includes('node_modules') && !s.includes('test-results') && !s.includes('.git') });
  const port = PORT + 1;
  const srv = await serve(port, dir);
  const base = 'http://127.0.0.1:' + port + '/';
  const { page, context } = await newPage();
  try {
    await ready(page, base);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
    const v1 = await page.evaluate(() => window.__stroika.updater.version());
    await page.evaluate(() => { window.__stroika.progress.setAssembled('samosval'); window.__marker = 'та же страница'; });
    // 4.7: обрыв сети — проверка обновления не ломает игру
    await context.setOffline(true);
    const off = await page.evaluate(() => window.__stroika.updater.check());
    assert(off === false, 'без сети check вернул ' + off);
    await context.setOffline(false);
    // выпускаем версию 9.9
    execFileSync(process.execPath, [join(dir, 'tools', 'build.mjs'), '9.9']);
    await page.evaluate(() => window.__stroika.scenes.open('assembly', { machine: 'samosval' }));
    const got = await page.evaluate(() => window.__stroika.updater.check());
    assert(got === true, 'новая версия не скачана');
    // 4.5: игра не прервана
    assert((await page.evaluate(() => window.__marker)) === 'та же страница', 'страница перезагрузилась');
    assert((await scene(page)) === 'assembly', 'сцена прервана');
    assert((await page.evaluate(() => window.__stroika.updater.version())) === v1, 'версия сменилась посреди игры');
    // следующий запуск
    await page.goto(base + '?seed=5');
    await page.waitForFunction(() => window.__stroika && window.__stroika.scenes.current() === 'home', null, { timeout: 10000 });
    const v2 = await page.evaluate(() => window.__stroika.updater.version());
    assert(v2 === '9.9', 'после перезапуска версия ' + v2);
    assert(await page.evaluate(() => window.__stroika.progress.isAssembled('samosval')), '4.6 прогресс потерян');
    // 4.8: номер версии на экране взрослых
    await page.evaluate(() => window.__stroika.scenes.open('parent'));
    await sleep(300);
    await shot(page, '12-ekran-vzroslyh-versiya-9.9');
    return 'было ' + v1 + ', стало ' + v2;
  } finally {
    await context.close();
    srv.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------- Группа 5 ----------------
await check('5.1', 'Вес игры', async () => {
  const s = sizes(ROOT, listFiles(ROOT));
  assert(s.withoutGpt <= 15 * 1048576, 'больше 15 МБ');
  assert(s.total <= 60 * 1048576, 'больше 60 МБ');
  return (s.total / 1024).toFixed(0) + ' КБ';
});

{
  const { page, cdp, context } = await newPage();
  await check('5.2', 'Запуск до главного экрана при замедленном в 4 раза процессоре — не дольше 5 секунд', async () => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const t0 = Date.now();
    await page.goto(BASE + '?seed=1');
    await page.waitForFunction(() => window.__stroika && window.__stroika.scenes.current() === 'home' && !window.__stroika.scenes.loading, null, { timeout: 15000 });
    const t = (Date.now() - t0) / 1000;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    assert(t <= 5, t.toFixed(2) + ' с');
    return t.toFixed(2) + ' с';
  });

  async function fps(seconds = 3) {
    await page.evaluate(() => { window.__stroika.frames.length = 0; });
    await sleep(seconds * 1000);
    return page.evaluate(() => window.__stroika.fps());
  }
  await check('5.3', 'Кадры в секунду в каждой сцене: обычная скорость и процессор ×4', async () => {
    const out = [];
    await page.evaluate(() => { window.__stroika.progress.unlockAll(); window.__stroika.progress.savePuzzle('bashennyi-kran', 16, Array.from({ length: 16 }, (_, i) => i)); });
    for (const id of ['home', 'garage', 'assembly', 'puzzle', 'wash', 'repair', 'fuel', 'parent', 'locked']) {
      await page.evaluate((id) => { const s = window.__stroika.scenes; s.backToRoot(); if (id !== 'home') s.open(id, { machine: 'bashennyi-kran', size: 25 }); }, id);
      await sleep(500);
      const normal = await fps(2);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const slow = await fps(3);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      out.push(id + ' ' + normal.toFixed(0) + '/' + slow.toFixed(0));
      assert(normal >= 55, id + ': ' + normal.toFixed(1) + ' кадров');
      assert(slow >= 30, id + ' при ×4: ' + slow.toFixed(1) + ' кадров');
    }
    await page.evaluate(() => window.__stroika.scenes.backToRoot());
    return out.join(', ');
  });

  await check('5.4 / 0.4', 'Память и таймеры не растут при 50 переходах между сценами (сборка, пазл, мойка, мастерская, заправка, гараж)', async () => {
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await sleep(200); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
    const cycle = async (n) => {
      const ids = ['assembly', 'puzzle', 'wash', 'repair', 'fuel', 'garage'];
      for (let i = 0; i < n; i++) {
        await page.evaluate(async (id) => { await window.__stroika.scenes.open(id, { machine: 'samosval', size: 16 }); }, ids[i % ids.length]);
        await sleep(30);
        await page.evaluate(() => window.__stroika.scenes.back());
      }
    };
    await cycle(5);
    const before = await heap();
    await cycle(50);
    const after = await heap();
    const sounds = await page.evaluate(() => window.__stroika.audio.activeSounds());
    assert(sounds === 0, 'висят звуки: ' + sounds);
    const grow = (after - before) / 1048576;
    assert(grow < 2, 'память выросла на ' + grow.toFixed(2) + ' МБ');
    return 'рост ' + (grow * 1024).toFixed(0) + ' КБ';
  });

  await check('5.5', 'Отклик на касание не дольше 0,1 секунды', async () => {
    await page.evaluate(() => window.__stroika.scenes.backToRoot());
    await sleep(1500);
    await page.evaluate(() => {
      window.__lat = null;
      const c = document.getElementById('game');
      c.addEventListener('pointerdown', () => {
        const t0 = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const s = window.__stroika.scenes.currentScene();
          window.__lat = { ms: performance.now() - t0, state: s.state };
        }));
      }, { capture: true, once: true });
    });
    await tap(cdp, 512, 400);
    await page.waitForFunction(() => window.__lat);
    const lat = await page.evaluate(() => window.__lat);
    assert(lat.state === 'going', 'гараж не отреагировал: ' + lat.state);
    assert(lat.ms <= 100, lat.ms.toFixed(0) + ' мс');
    return lat.ms.toFixed(0) + ' мс до второго кадра';
  });
  await context.close();
}

await check('3.11 / 4.3', 'За весь прогон нет ошибок в журнале браузера и обращений к внешним адресам', async () => {
  // Ошибки «нет сети» от Updater в режиме офлайн — ожидаемые записи журнала, не сбой.
  const real = consoleErrors.filter((e) => !e.includes('[Updater]') && !e.includes('ERR_INTERNET_DISCONNECTED'));
  assert(!real.length, real.slice(0, 5).join(' | '));
  assert(!externalRequests.length, externalRequests.slice(0, 5).join(', '));
});

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log('\nИтого: ' + (results.length - failed.length) + ' из ' + results.length + ' зелёные');
process.exit(failed.length ? 1 : 0);
