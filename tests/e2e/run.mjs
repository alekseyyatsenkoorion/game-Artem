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
async function check(id, name, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ id, name, ok: true, note: note || '' });
    console.log('ok   ' + id + ' ' + name + (note ? ' — ' + note : '') + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' с)');
  } catch (e) {
    results.push({ id, name, ok: false, note: e.message });
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
    await dragTouch(cdp, p.x, p.y, p.sx, p.sy);
    await sleep(250);
    if (shotsPrefix && i === 1) await shot(page, shotsPrefix + '-2-v-protsesse');
    i++;
  }
}

// ---------------- Группа 3 ----------------
{
  const { page, cdp, context } = await newPage();
  await ready(page);

  await check('3.1', 'Главный экран открывается; тык по машине ведёт на сборку (на этапе 1 вход один)', async () => {
    await shot(page, '01-glavnyi-ekran');
    await sleep(5600);
    await shot(page, '02-glavnyi-ekran-podskazka-ruka');
    await tap(cdp, 600, 450);
    await page.waitForFunction(() => window.__stroika.scenes.current() === 'assembly', null, { timeout: 4000 });
    await sleep(400);
    await shot(page, '03-sborka-nachalo');
  });

  await check('3.15', 'Подсказка видна: рука через 5 секунд простоя на сборке', async () => {
    await sleep(5600);
    const hand = await page.evaluate(() => window.__stroika.scenes.currentScene().hint.showHand());
    assert(hand, 'руки нет');
    await shot(page, '04-sborka-podskazka-ruka');
  });

  await check('3.3', 'Сборка самосвала касаниями до конца: заводится, уезжает, сохраняется', async () => {
    await assembleAll(page, cdp, '05-sborka');
    const placed = await page.evaluate(() => window.__stroika.scenes.currentScene().isAssembled());
    assert(placed, 'не все детали встали');
    await sleep(300);
    await shot(page, '06-sborka-sobrano');
    await sleep(1100);
    await shot(page, '07-sborka-uezzhaet');
    await page.waitForFunction(() => window.__stroika.scenes.current() === 'home', null, { timeout: 9000 });
    assert(await page.evaluate(() => window.__stroika.progress.isAssembled('samosval')), 'не сохранено');
    await sleep(1600);
    await shot(page, '08-glavnyi-posle-sborki');
  });

  await check('3.9', 'Крестик выводит из сборки; прогресс на месте', async () => {
    await tap(cdp, 600, 450);
    await page.waitForFunction(() => window.__stroika.scenes.current() === 'assembly', null, { timeout: 4000 });
    const p = (await parts(page))[0];
    await dragTouch(cdp, p.x, p.y, p.sx, p.sy);
    await tap(cdp, 48, 48);
    await sleep(200);
    assert((await scene(page)) === 'home', 'остался в ' + (await scene(page)));
    assert(await page.evaluate(() => window.__stroika.progress.isAssembled('samosval')), 'прогресс потерян');
  });

  await check('3.14', 'Второй палец во время перетаскивания не сбивает первый', async () => {
    await tap(cdp, 600, 450);
    await page.waitForFunction(() => window.__stroika.scenes.current() === 'assembly', null, { timeout: 4000 });
    await sleep(300);
    const p = (await parts(page)).find((x) => x.id === 'kabina');
    await touch(cdp, 'touchStart', [{ x: p.x, y: p.y, id: 1 }]);
    for (let i = 1; i <= 6; i++) { await touch(cdp, 'touchMove', [{ x: p.x + (p.sx - p.x) * i / 12, y: p.y + (p.sy - p.y) * i / 12, id: 1 }]); await sleep(16); }
    const mid = { x: p.x + (p.sx - p.x) / 2, y: p.y + (p.sy - p.y) / 2 };
    await touch(cdp, 'touchStart', [{ ...mid, id: 1 }, { x: 900, y: 650, id: 2 }]);
    await touch(cdp, 'touchMove', [{ ...mid, id: 1 }, { x: 700, y: 600, id: 2 }]);
    await touch(cdp, 'touchEnd', [{ ...mid, id: 1 }]); // второй палец убран
    for (let i = 7; i <= 12; i++) { await touch(cdp, 'touchMove', [{ x: p.x + (p.sx - p.x) * i / 12, y: p.y + (p.sy - p.y) * i / 12, id: 1 }]); await sleep(16); }
    await touch(cdp, 'touchEnd', []);
    await sleep(300);
    const after = (await parts(page)).find((x) => x.id === 'kabina');
    assert(after.placed, 'кабина не встала');
  });

  await check('3.13', 'Хаотичные касания (200 тыков и протяжек) в сборке и на главном экране', async () => {
    let seed = 11;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (const where of ['assembly', 'home']) {
      if (where === 'home') { await tap(cdp, 48, 48); await sleep(200); }
      for (let i = 0; i < 200; i++) {
        const x = 100 + rnd() * 900, y = 100 + rnd() * 660; // мимо крестика, чтобы остаться в сцене
        if (rnd() < 0.5) { await touch(cdp, 'touchStart', [{ x, y }]); await touch(cdp, 'touchEnd', []); }
        else await dragTouch(cdp, x, y, 100 + rnd() * 900, 100 + rnd() * 660, 3);
        if ((await scene(page)) === 'assembly' && where === 'home') { await tap(cdp, 48, 48); await sleep(100); }
      }
      const t = await page.evaluate(() => window.__stroika.frames.length);
      assert(t > 10, 'кадры не идут');
    }
    await sleep(1500);
    if ((await scene(page)) !== 'home') { await tap(cdp, 48, 48); await sleep(300); }
  });

  await check('3.10', 'Таймер: блокировка «Машины спят» и снятие только жестом взрослого', async () => {
    await parentGesture(cdp);
    assert((await scene(page)) === 'parent', 'жест не открыл экран взрослых: ' + (await scene(page)));
    await shot(page, '09-ekran-dlya-vzroslyh');
    // проверка таймера
    const b = await page.evaluate(() => window.__stroika.scenes.currentScene().buttons.find((x) => x.id === 'test'));
    await tap(cdp, b.x + 50, b.y + 30);
    await sleep(200);
    assert((await scene(page)) === 'home', 'после проверки не вернулся в игру');
    const rem = await page.evaluate(() => window.__stroika.timer.remaining());
    assert(rem >= 58 && rem <= 60, 'остаток ' + rem);
    await page.evaluate(() => { window.__stroika.timer.s.remaining = 1.5; }); // ускоряем минуту
    await page.waitForFunction(() => window.__stroika.scenes.current() === 'locked', null, { timeout: 5000 });
    await sleep(500);
    await shot(page, '10-mashiny-spyat');
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

  await check('3.12', 'Снимки: картинка в экране, нет пустых и чёрных экранов', async () => {
    const stats = await page.evaluate(() => {
      const c = document.getElementById('game');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let dark = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 97) { n++; if (d[i] + d[i + 1] + d[i + 2] < 60) dark++; }
      return dark / n;
    });
    assert(stats < 0.2, 'тёмных пикселей ' + (stats * 100).toFixed(0) + '%');
    return 'остальное — по снимкам глазами (3.15)';
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
    for (const id of ['home', 'assembly', 'parent', 'locked']) {
      await page.evaluate((id) => { const s = window.__stroika.scenes; s.backToRoot(); if (id !== 'home') s.open(id, { machine: 'samosval' }); }, id);
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

  await check('5.4 / 0.4', 'Память и таймеры не растут при 50 переходах между сценами', async () => {
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await sleep(200); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
    const cycle = async (n) => {
      for (let i = 0; i < n; i++) {
        await page.evaluate(async () => { await window.__stroika.scenes.open('assembly', { machine: 'samosval' }); });
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
    await tap(cdp, 600, 450);
    await page.waitForFunction(() => window.__lat);
    const lat = await page.evaluate(() => window.__lat);
    assert(lat.state === 'starting', 'машина не отреагировала');
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
