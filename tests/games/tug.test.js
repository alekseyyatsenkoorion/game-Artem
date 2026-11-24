// Перетягивание каната: модель (1.15, 2.25–2.28, 2.43–2.46, 3.8) и сцена (группа 0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TugModel, Puller, humanPuller, computerPuller, simulate, nextLevel,
  LEVELS, LEVEL_ORDER, TAP_STEP, TugScene,
} from '../../src/games/tug.js';
import { captureErrors, makeWorld, memoryStorage } from '../core/helpers.js';
import { openScene, settle, runToFinish, trackingGraphics, crossZoneViolations, offscreen, textCalls, Home, MACHINES, data, tick } from './helpers.js';

// Ровный темп: тыки в phase, phase + 1/tempo, ... до limit секунд.
function steady(tempo, phase = 0, limit = 120) {
  const out = [];
  for (let t = phase; t < limit; t += 1 / tempo) out.push(t);
  return out;
}

// ---------- модель ----------

test('1.15 три уровня, нужный темп растёт от лёгкого к сильному', () => {
  assert.deepEqual(LEVEL_ORDER, ['easy', 'medium', 'hard']);
  assert.deepEqual(Object.keys(LEVELS).sort(), ['easy', 'hard', 'medium']);
  assert.ok(LEVELS.easy.tempo < LEVELS.medium.tempo && LEVELS.medium.tempo < LEVELS.hard.tempo);
  assert.ok(LEVELS.easy.rivalSpeed < LEVELS.medium.rivalSpeed && LEVELS.medium.rivalSpeed < LEVELS.hard.rivalSpeed);
});

test('2.25 тык тянет канат к игроку; без тыков канат уходит к сопернику', () => {
  for (const level of LEVEL_ORDER) {
    const m = new TugModel({ level });
    m.tap();
    assert.ok(m.p > 0, level);
    const p1 = m.p;
    m.update(0.5);
    assert.ok(m.p < p1, level);
  }
});

test('2.26 раунд всегда заканчивается победой или поражением (разные записи тыков)', () => {
  let seed = 3;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const level of LEVEL_ORDER) {
    // равновесие: темп ровно такой, что тяга игрока равна тяге соперника
    const balance = LEVELS[level].rivalSpeed / TAP_STEP;
    const tries = [[], steady(balance), steady(balance, 0.3), steady(LEVELS[level].tempo * 0.8)];
    for (let i = 0; i < 30; i++) {
      const taps = []; let t = 0;
      while (t < 120) { t += rnd() * 1.2; taps.push(t); }
      tries.push(taps);
    }
    for (const taps of tries) {
      const r = simulate(level, taps);
      assert.ok(r.result === 'won' || r.result === 'lost', level);
      assert.ok(r.time <= 45.01, level + ': ' + r.time);
    }
  }
});

test('2.27 / 3.8 ровный темп не ниже нужного побеждает всегда: 100 раундов на уровень', () => {
  for (const level of LEVEL_ORDER) {
    const tempo = LEVELS[level].tempo;
    let wins = 0;
    for (let i = 0; i < 100; i++) {
      const k = 1 + (i % 10) * 0.05;          // от нужного темпа до +45%
      const phase = (i / 100) / (tempo * k);  // разная фаза первого тыка
      const r = simulate(level, steady(tempo * k, phase));
      if (r.result === 'won') wins++;
    }
    assert.equal(wins, 100, level);
  }
});

test('2.43 / 3.8 полная остановка тыков приводит к проигрышу на любом уровне', () => {
  for (const level of LEVEL_ORDER) {
    assert.equal(simulate(level, []).result, 'lost', level);
    // тыкал, потом остановился
    assert.equal(simulate(level, steady(LEVELS[level].tempo, 0, 3)).result, 'lost', level);
  }
});

test('2.44 одинаковая запись тыков даёт одинаковый результат', () => {
  const taps = [0.2, 0.5, 0.6, 1.3, 1.4, 2.2, 2.25, 2.9, 3.6, 4.1, 4.2, 5, 5.1, 5.2];
  for (const level of LEVEL_ORDER) {
    const a = simulate(level, taps), b = simulate(level, taps);
    assert.deepEqual(a, b, level);
  }
});

test('2.45 от середины до лужи без тыков не меньше 3 секунд', () => {
  for (const level of LEVEL_ORDER) {
    const r = simulate(level, [], { dt: 0.01 });
    assert.equal(r.result, 'lost');
    assert.ok(r.time >= 3, level + ': ' + r.time);
  }
});

test('2.28 вторая сторона может быть человеком: те же правила', () => {
  const m = new TugModel({ level: 'hard', rival: humanPuller() });
  assert.ok(m.rival instanceof Puller);
  m.update(2);
  assert.equal(m.p, 0, 'никто не тыкает — канат стоит');
  m.tap('rival');
  assert.ok(m.p < 0);
  m.tap('player');
  assert.ok(Math.abs(m.p) < 1e-9, 'тыки сторон одинаковы по силе');
  for (let i = 0; i < 20 && !m.over; i++) m.tap('rival');
  assert.equal(m.result, 'lost');
  // и наоборот: тыкает только игрок
  const m2 = new TugModel({ rival: humanPuller() });
  for (let i = 0; i < 20 && !m2.over; i++) m2.tap('player');
  assert.equal(m2.result, 'won');
  // два человека, никто не тыкает — раунд всё равно кончается
  const m3 = new TugModel({ rival: humanPuller() });
  m3.tap('player');
  for (let i = 0; i < 6000 && !m3.over; i++) m3.update(0.02);
  assert.ok(m3.over);
  assert.equal(computerPuller('medium').speed, LEVELS.medium.rivalSpeed);
});

test('после конца раунда тыки ничего не меняют', () => {
  const m = new TugModel({ level: 'easy' });
  for (let i = 0; i < 30; i++) m.tap();
  assert.equal(m.result, 'won');
  assert.equal(m.tap(), false);
  m.update(1);
  assert.equal(m.p, 1);
});

test('nextLevel: по кругу', () => {
  assert.equal(nextLevel('easy'), 'medium');
  assert.equal(nextLevel('medium'), 'hard');
  assert.equal(nextLevel('hard'), 'easy');
});

// ---------- сцена ----------

const PLAYER = 'samosval';

function spyPlay(w) {
  const ids = [];
  const handles = [];
  const orig = w.audio.play.bind(w.audio);
  w.audio.play = (id, opts) => { ids.push(id); const h = orig(id, opts); handles.push(h); return h; };
  return { ids, handles };
}

// Тыкать по своей машине в темпе tempo, пока раунд идёт.
function tapUntilEnd(s, tempo, maxSec = 40) {
  const dt = 0.02;
  let acc = 0;
  for (let t = 0; t < maxSec && (s.state === 'intro' || s.state === 'play'); t += dt) {
    acc += dt;
    if (acc >= 1 / tempo) { acc -= 1 / tempo; const p = s.target; s.onPointer({ type: 'down', x: p.x, y: p.y }); s.onPointer({ type: 'up', x: p.x, y: p.y }); }
    s.update(dt);
  }
}

test('сцена: соперник по уровню из прогресса, сильный крупнее, target — центр своей машины', async () => {
  const sizes = {};
  for (const level of LEVEL_ORDER) {
    const { s } = await openScene(TugScene, { machine: PLAYER }, { before: (w) => w.progress.saveTug({ nextLevel: level, wins: 0, losses: 0 }) });
    assert.equal(s.level, level);
    assert.notEqual(s.rivalMachine.id, PLAYER);
    assert.equal(s.rivalMachine.tug, level);
    sizes[level] = s.rivalBounds().w * s.rivalBounds().h / (s.rivalMachine.size.w * s.rivalMachine.size.h);
    const b = s.playerBounds();
    assert.equal(s.target.kind, 'tap');
    assert.ok(Math.abs(s.target.x - (b.x + b.w / 2)) <= 1 && Math.abs(s.target.y - (b.y + b.h / 2)) <= 1);
  }
  assert.ok(sizes.easy < sizes.medium && sizes.medium < sizes.hard);
  // выбор детерминированный
  const a = await openScene(TugScene, { machine: 'traktor' });
  const b = await openScene(TugScene, { machine: 'traktor' });
  assert.equal(a.s.rivalMachine.id, b.s.rivalMachine.id);
  assert.notEqual(a.s.rivalMachine.id, 'traktor');
});

test('0.1 / 0.6 сцена для каждой машины: 100 update и draw без ошибок, без крестика, без надписей, в пределах экрана', async () => {
  for (const machine of MACHINES) {
    for (const mode of ['idle', 'win', 'lose']) {
      const err = captureErrors();
      try {
        const { s } = await openScene(TugScene, { machine });
        let acc = 0;
        for (let i = 0; i < 400; i++) {
          if (mode === 'win') { acc += 0.05; if (acc >= 0.2 && s.target) { acc = 0; s.onPointer({ type: 'down', x: s.target.x, y: s.target.y }); } }
          s.update(0.05);
          if (i % 4 && i < 380) continue;
          const g = trackingGraphics();
          s.draw(g);
          assert.deepEqual(crossZoneViolations(g), [], machine + ' ' + mode + ': рисует в зоне крестика');
          assert.deepEqual(offscreen(g), [], machine + ' ' + mode + ': вылезает за экран');
          assert.equal(textCalls(g).length, 0);
        }
        assert.deepEqual(err.list, [], machine + ' ' + mode);
      } finally { err.restore(); }
    }
  }
});

test('0.2 картинки сцены: настоящие машины, без заглушек', async () => {
  const { default: art } = await import('../../src/art/index.js');
  for (const level of LEVEL_ORDER) {
    const { w, s } = await openScene(TugScene, { machine: PLAYER }, { stub: false, before: (x) => x.progress.saveTug({ nextLevel: level, wins: 0, losses: 0 }) });
    tapUntilEnd(s, 0); // без тыков: проигрыш, грязная машина в луже
    for (let i = 0; i < 60; i++) { s.update(0.05); s.draw(trackingGraphics()); }
    // фон bg/tug без картинки не запрашивается: сцена рисует простое поле с лужей
    assert.equal(w.assets.placeholderCount, 0, level + (art['bg/tug'] ? '' : ' (bg/tug ещё нет)'));
  }
});

test('сцена: тыки в нужном темпе → победа; finish {done, won: true, level}; прогресс по кругу', async () => {
  for (const level of LEVEL_ORDER) {
    const { w, s, home, storage } = await openScene(TugScene, { machine: PLAYER }, { before: (x) => x.progress.saveTug({ nextLevel: level, wins: 2, losses: 1 }) });
    const spy = spyPlay(w);
    tapUntilEnd(s, LEVELS[level].tempo + 0.5);
    assert.equal(s.state, 'won', level);
    assert.equal(s.target, null);
    assert.ok(spy.ids.includes('fx/win'));
    assert.deepEqual(w.progress.tug(), { nextLevel: nextLevel(level), wins: 3, losses: 1 });
    assert.ok(w.voices.log.some((t) => t === data.phrases['tug-won'].replace('{name}', data.childName || '')), 'голос победы');
    await runToFinish(w, s);
    assert.deepEqual(home.results, [{ done: true, won: true, level }]);
    void storage;
  }
});

test('сцена: без тыков → поражение, машина в луже, голос называет соперника', async () => {
  const { w, s, home } = await openScene(TugScene, { machine: PLAYER });
  const spy = spyPlay(w);
  // голос договаривает фразы, канат уползает сам
  for (let i = 0; i < 1500 && s.state !== 'lost'; i++) { s.update(0.02); if (i % 25 === 0) { w.voices.finishCurrent(); await tick(); } }
  assert.equal(s.state, 'lost');
  assert.equal(s.end.loser, 'player');
  settle(s, 2);
  assert.ok(spy.ids.includes('fx/splash'));
  const name = data.phrases[s.rivalMachine.namePhrase];
  assert.ok(name);
  assert.ok(w.voices.log.some((t) => t.includes(name) && t.includes('перетянул')), 'tug-lost с именем: ' + w.voices.log.join(' | '));
  assert.ok(w.voices.log.some((t) => t === data.phrases['tug-pull'].replace('{name}', data.childName || '')), 'голос подгоняет');
  assert.equal(w.progress.tug().losses, 1);
  await runToFinish(w, s);
  assert.deepEqual(home.results, [{ done: true, won: false, level: 'easy' }]);
});

test('2.46 соперники идут по кругу: лёгкий, средний, сильный, лёгкий (через saveTug)', async () => {
  const storage = memoryStorage();
  const w = makeWorld({ data, scenes: [Home, TugScene], storage });
  await w.scenes.open('home');
  const home = w.scenes.currentScene();
  const seen = [];
  for (let i = 0; i < 4; i++) {
    await w.scenes.open('tug', { machine: PLAYER });
    const s = w.scenes.currentScene();
    seen.push(s.level);
    tapUntilEnd(s, i % 2 ? 0 : 6);
    await runToFinish(w, s);
  }
  assert.deepEqual(seen, ['easy', 'medium', 'hard', 'easy']);
  assert.deepEqual(home.results.map((r) => r.level), seen);
  assert.deepEqual(home.results.map((r) => r.won), [true, false, true, false]);
  assert.deepEqual(w.progress.tug(), { nextLevel: 'medium', wins: 2, losses: 2 });
});

test('тык рядом с машиной засчитывается, далеко — нет', async () => {
  const { s } = await openScene(TugScene, { machine: PLAYER });
  const b = s.playerBounds();
  s.onPointer({ type: 'down', x: b.x + b.w + 40, y: b.y - 40 });
  assert.equal(s.taps, 1);
  s.onPointer({ type: 'down', x: 1000, y: 200 });
  assert.equal(s.taps, 1);
});

test('подсказки: рука-подсказка через 5 с без тыков', async () => {
  const { w, s } = await openScene(TugScene, { machine: PLAYER }, { before: (x) => x.progress.saveTug({ nextLevel: 'easy', wins: 0, losses: 0 }) });
  // пока говорит вступление, канат стоит
  settle(s, 1);
  assert.equal(s.model.p, 0);
  w.voices.finishCurrent(); await tick();
  settle(s, 5.2);
  assert.equal(s.state, 'play');
  assert.ok(s.hint.showHand());
  // голос-подсказка через 10 с в канате не успевает: без тыков раунд кончается раньше (≤ 9,1 с),
  // а подгоняет голос tug-pull (проверка в тесте поражения)
});

test('0.3 выход из любого состояния: звуки остановлены, результат {cancelled}', async () => {
  for (const state of ['intro', 'play', 'finale-won', 'finale-lost']) {
    const { w, s, home } = await openScene(TugScene, { machine: PLAYER });
    const spy = spyPlay(w);
    if (state === 'play') { s.onPointer({ type: 'down', x: s.target.x, y: s.target.y }); s.update(0.1); }
    if (state === 'finale-won') { tapUntilEnd(s, 8); s.update(0.1); }
    if (state === 'finale-lost') { tapUntilEnd(s, 0); settle(s, 1.3); }
    s.exit();
    assert.ok(spy.handles.every((h) => h.stopped), state);
    const r = await openScene(TugScene, { machine: PLAYER });
    if (state !== 'intro') { r.s.onPointer({ type: 'down', x: r.s.target.x, y: r.s.target.y }); r.s.update(0.1); }
    r.w.scenes.back();
    assert.equal(r.w.scenes.current(), 'home');
    assert.equal(r.w.audio.activeSounds(), 0);
    assert.equal(r.w.audio.queueLength(), 0);
    assert.deepEqual(r.home.results, [{ cancelled: true }]);
    void home;
  }
});

test('0.4 50 входов и выходов: звуки, картинки, стек не растут', async () => {
  const { w } = await openScene(TugScene, { machine: PLAYER });
  w.scenes.back();
  const cache0 = w.assets.cache.size;
  for (let i = 0; i < 50; i++) {
    await w.scenes.open('tug', { machine: PLAYER });
    const s = w.scenes.currentScene();
    s.onPointer({ type: 'down', x: s.target.x, y: s.target.y });
    for (let k = 0; k < 5; k++) { s.update(0.02); s.draw(trackingGraphics()); }
    w.scenes.back();
    assert.equal(w.audio.activeSounds(), 0);
  }
  assert.equal(w.scenes.depth(), 1);
  assert.equal(w.audio.queueLength(), 0);
  assert.ok(w.assets.cache.size <= cache0, 'картинки не выгружены');
});

test('0.8 pause глушит мотор и останавливает канат, resume продолжает с того же места', async () => {
  const { w, s } = await openScene(TugScene, { machine: PLAYER });
  const spy = spyPlay(w);
  s.onPointer({ type: 'down', x: s.target.x, y: s.target.y });
  s.update(0.3);
  assert.ok(spy.ids.includes('engine/' + PLAYER));
  s.pause();
  assert.ok(spy.handles.every((h) => h.stopped));
  assert.equal(w.audio.activeSounds(), 0);
  const snap = JSON.stringify({ state: s.state, p: s.model.p, t: s.model.t, taps: s.taps });
  s.resume();
  assert.equal(JSON.stringify({ state: s.state, p: s.model.p, t: s.model.t, taps: s.taps }), snap);
  assert.ok(w.audio.activeSounds() >= 0);
  tapUntilEnd(s, 8);
  assert.equal(s.state, 'won');
});

test('0.9 canExit false только в финале и не дольше 2 секунд; checkpoint таймера перед finish', async () => {
  for (const tempo of [8, 0]) {
    const { w, s, home } = await openScene(TugScene, { machine: PLAYER });
    let checks = 0;
    const orig = w.timer.checkpoint.bind(w.timer);
    w.timer.checkpoint = () => { checks++; assert.equal(home.results.length, 0); return orig(); };
    assert.equal(s.canExit(), true);
    tapUntilEnd(s, tempo);
    let blocked = 0;
    for (let i = 0; i < 400 && w.scenes.currentScene() === s; i++) { if (!s.canExit()) blocked += 0.02; s.update(0.02); }
    assert.ok(blocked > 0 && blocked <= 2, 'canExit false ' + blocked.toFixed(2) + ' с');
    await runToFinish(w, s);
    assert.equal(checks, 1);
    assert.equal(home.results.length, 1);
    assert.equal(home.results[0].won, tempo > 0);
  }
});

test('0.11 неизвестная машина: журнал и выход назад, без исключения', async () => {
  const err = captureErrors();
  try {
    const w = makeWorld({ data, scenes: [Home, TugScene] });
    await w.scenes.open('home');
    await w.scenes.open('tug', { machine: 'net-takoy' });
    const s = w.scenes.currentScene();
    s.draw(trackingGraphics());
    s.onPointer({ type: 'down', x: 300, y: 500 });
    w.scenes.update(0.02);
    assert.equal(w.scenes.current(), 'home');
    assert.ok(err.list.length >= 1);
    assert.ok(!err.list.some((e) => e.includes('ошибка в')), err.list.join('; '));
  } finally { err.restore(); }
  // единственная машина в данных — соперника нет
  const err2 = captureErrors();
  try {
    const w = makeWorld({ data: { ...data, machines: [data.machines[0]] }, scenes: [Home, TugScene] });
    await w.scenes.open('home');
    await w.scenes.open('tug', { machine: data.machines[0].id });
    w.scenes.update(0.02);
    assert.equal(w.scenes.current(), 'home');
  } finally { err2.restore(); }
});
