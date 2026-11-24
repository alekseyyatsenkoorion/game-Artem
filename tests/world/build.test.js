// Стройка: группа 0 для сцены build, логика 2.10–2.14, 2.21, и прохождение всех шагов всех объектов (основа 3.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BuildScene, OBJECT_ORIGIN, machineHome } from '../../src/world/build.js';
import { ACTIONS } from '../../src/world/build-actions/index.js';
import { HomeScene } from '../../src/world/home.js';
import { CROSS_ZONE, rectsOverlap } from '../../src/core/draw-utils.js';
import { captureErrors, memoryStorage, tick } from '../core/helpers.js';
import {
  buildFixture, world, frames, perform, trackingGraphics, crossZoneViolations, offscreen, textCalls, ACTION_LIST, realData,
} from './fixture.js';

const FX = buildFixture();
const REAL = buildFixture({ objects: 'real' });

async function openBuild(object, { fx = FX, storage, before } = {}) {
  const w = world(fx, [HomeScene, BuildScene], { storage });
  if (before) before(w);
  await w.scenes.open('home');
  w.timer.start();
  const home = w.scenes.currentScene();
  const results = [];
  home.onResult = (r) => results.push(r);
  await w.scenes.open('build', { object });
  return { w, s: w.scenes.currentScene(), results };
}

// Ждать, пока сцена ждёт действия (или закончилась).
function waitTarget(w, s, maxSec = 15) {
  for (let t = 0; t < maxSec; t += 0.05) {
    if (w.scenes.currentScene() !== s || s.target) return s.target;
    frames(w, 0.05);
  }
  return s.target;
}

// Пройти объект до конца, выполняя target. Голос «договаривает» фразы.
async function runBuild(w, s, { onAction } = {}) {
  let n = 0;
  for (let guard = 0; guard < 20000 && w.scenes.currentScene() === s; guard++) {
    const tg = s.target;
    if (tg) { if (onAction) onAction(tg, s); perform(w, tg); n++; } else frames(w, 0.05);
    if (guard % 20 === 0) { w.voices.finishCurrent(); await tick(); }
  }
  return n;
}

const fxObj = (i) => FX.data.objects[i];
// Объект и шаг тестовых данных с данным действием.
function withAction(fx, action) {
  for (const o of fx.data.objects) {
    const i = o.steps.findIndex((s) => s.action === action);
    if (i >= 0) return { o, i };
  }
  return null;
}
// Открыть стройку сразу на нужном шаге.
async function openAtStep(fx, o, i, repeat = 0) {
  const r = await openBuild(o.id, { fx, before: (w) => w.progress.advanceObject(o.id, i, repeat) });
  waitTarget(r.w, r.s);
  return r;
}

test('сцена стройки зарегистрирована, действий ровно 12 из закрытого списка', () => {
  assert.equal(BuildScene.id, 'build');
  assert.deepEqual(Object.keys(ACTIONS).sort(), ACTION_LIST.slice().sort());
});

test('геометрия: земля слоя совпадает с землёй фона, машина стоит слева от объекта', () => {
  assert.equal(OBJECT_ORIGIN.y + 340, 600);
  assert.ok(OBJECT_ORIGIN.x >= 380 && OBJECT_ORIGIN.x + 600 <= 1024);
  for (const m of FX.data.machines) {
    const r = machineHome(m);
    assert.ok(r.x >= 40 && r.x + r.w <= OBJECT_ORIGIN.x, m.id);
    assert.ok(r.w >= 100 && r.h >= 100, m.id + ': зона касания ≥ 100');
    assert.ok(!rectsOverlap(r, CROSS_ZONE), m.id);
  }
});

for (const action of ACTION_LIST) {
  test('0.1 / 0.2 / 0.6 стройка, действие ' + action + ': 100 кадров без ошибок, без заглушек, надписей и зоны крестика; цель на экране', async () => {
    const err = captureErrors();
    try {
      const { o, i } = withAction(FX, action);
      const { w, s } = await openAtStep(FX, o, i);
      assert.equal(s.step.action, action);
      const tg = s.target;
      assert.ok(tg, 'ждём действия');
      assert.ok(['tap', 'hold', 'drag', 'trace'].includes(tg.kind));
      const pts = [tg].concat(tg.to ? [tg.to] : [], tg.path || []);
      for (const p of pts) {
        assert.ok(p.x >= 96 && p.x <= 1000 && p.y >= 120 && p.y <= 740, action + ': точка цели на экране ' + JSON.stringify(p));
      }
      if (tg.path) assert.ok(tg.path.length >= 2);
      for (let k = 0; k < 100; k++) {
        frames(w, 0.07); // к концу видна рука-подсказка
        const g = trackingGraphics();
        s.draw(g);
        assert.deepEqual(crossZoneViolations(g), [], action + ': зона крестика');
        assert.deepEqual(offscreen(g), [], action + ': за экраном');
        assert.equal(textCalls(g).length, 0);
      }
      assert.ok(s.hint.showHand());
      assert.equal(w.assets.placeholderCount, 0);
      assert.deepEqual(err.list, []);
    } finally { err.restore(); }
  });
}

test('0.7 cancel во время перетаскивания возвращает предмет на место; во время ведения — дорожка не сбрасывается', async () => {
  for (const action of ['lift', 'place', 'stack']) {
    const { o, i } = withAction(FX, action);
    const { w, s } = await openAtStep(FX, o, i);
    const tg = s.target;
    w.scenes.pointer({ type: 'down', x: tg.x, y: tg.y });
    w.scenes.pointer({ type: 'move', x: tg.x + 200, y: tg.y + 30 });
    assert.equal(s.target, null, 'предмет в руке — ждём');
    w.scenes.pointer({ type: 'cancel', x: tg.x + 200, y: tg.y + 30 });
    frames(w, 0.6);
    assert.deepEqual(s.target, tg, action + ': предмет вернулся');
    // мимо места — тоже возвращается
    w.scenes.pointer({ type: 'down', x: tg.x, y: tg.y });
    w.scenes.pointer({ type: 'move', x: 520, y: 200 });
    w.scenes.pointer({ type: 'up', x: 520, y: 200 });
    frames(w, 0.6);
    assert.deepEqual(s.target, tg, action + ': мимо — вернулся');
    assert.equal(s.repeat, 0);
    // рядом с местом (промах 60 px) — засчитывается
    w.scenes.pointer({ type: 'down', x: tg.x + 20, y: tg.y + 10 });
    w.scenes.pointer({ type: 'move', x: tg.to.x + 60, y: tg.to.y - 30 });
    w.scenes.pointer({ type: 'up', x: tg.to.x + 60, y: tg.to.y - 30 });
    frames(w, 1.2);
    assert.ok(s.repeat === 1 || s.stepIndex === i + 1, action + ': промах рядом засчитан');
  }
  const { o, i } = withAction(FX, 'level');
  const { w, s } = await openAtStep(FX, o, i);
  const tg = s.target;
  w.scenes.pointer({ type: 'down', x: tg.path[0].x, y: tg.path[0].y });
  for (const p of tg.path.slice(1, 5)) w.scenes.pointer({ type: 'move', x: p.x, y: p.y + 40 }); // чуть ниже дорожки
  w.scenes.pointer({ type: 'cancel', x: 0, y: 0 });
  const left = s.target.path.length;
  assert.ok(left < tg.path.length, 'продвинулись');
  frames(w, 0.5);
  assert.equal(s.target.path.length, left);
});

test('держать: шкала заполняется за ~1,5 с удержания; отпустил — не сбрасывается; звук бетона глохнет', async () => {
  const { o, i } = withAction(FX, 'pour');
  const { w, s } = await openAtStep(FX, o, i);
  const tg = s.target;
  assert.equal(tg.kind, 'hold');
  assert.ok(tg.seconds >= 1.4 && tg.seconds <= 1.6);
  const handles = [];
  const orig = w.audio.play.bind(w.audio);
  w.audio.play = (id, opts) => { const h = orig(id, opts); if (id === 'fx/pour') handles.push(h); return h; };
  w.scenes.pointer({ type: 'down', x: tg.x, y: tg.y });
  frames(w, 0.7);
  assert.equal(handles.length, 1);
  assert.equal(handles[0].stopped, false);
  w.scenes.pointer({ type: 'up', x: tg.x, y: tg.y });
  assert.equal(handles[0].stopped, true);
  const left = s.target.seconds;
  assert.ok(left > 0.6 && left < 0.95, 'осталось ' + left);
  frames(w, 2);
  assert.equal(s.target.seconds, left);
  // выход посреди удержания — звуков нет
  w.scenes.pointer({ type: 'down', x: tg.x, y: tg.y });
  frames(w, 0.2);
  w.scenes.back();
  assert.equal(w.audio.activeSounds(), 0);
});

test('2.10 / 2.11 шаги строго по порядку, шаг — после нужного числа повторов; прогресс после каждого повтора', async () => {
  for (const o of FX.data.objects.slice(0, 4)) {
    const { w, s } = await openBuild(o.id);
    const log = [];
    const orig = w.progress.advanceObject.bind(w.progress);
    w.progress.advanceObject = (id, st, r) => { log.push([st, r]); orig(id, st, r); };
    let seen = -1;
    await runBuild(w, s, {
      onAction: () => {
        assert.ok(s.stepIndex >= seen && s.stepIndex <= seen + 1, 'шаг не пропущен');
        seen = s.stepIndex;
        assert.equal(s.ctx.progress.objectState(o.id).step, s.stepIndex);
        assert.equal(s.ctx.progress.objectState(o.id).repeat, s.repeat);
      },
    });
    const expect = [];
    o.steps.forEach((st, k) => {
      for (let r = 1; r < st.repeats; r++) expect.push([k, r]);
      expect.push([k + 1, 0]);
    });
    assert.deepEqual(log, expect, o.id);
  }
});

test('2.11 на шаге с повторами: до последнего повтора шаг не меняется', async () => {
  const o = FX.data.objects.find((x) => x.steps.some((st) => st.repeats >= 4));
  const i = o.steps.findIndex((st) => st.repeats >= 4);
  const { w, s } = await openAtStep(FX, o, i);
  const n = o.steps[i].repeats;
  for (let r = 0; r < n; r++) {
    assert.equal(s.stepIndex, i);
    assert.equal(s.repeat, r);
    perform(w, waitTarget(w, s));
    frames(w, 0.1);
    for (let k = 0; k < 100 && !s.target && s.stepIndex === i; k++) frames(w, 0.05);
  }
  assert.equal(s.stepIndex, i + 1);
});

test('2.12 после каждого шага на объекте появляется новая часть (слой), текущий виден частично', async () => {
  const o = fxObj(1);
  const { w, s } = await openBuild(o.id);
  const ids = [];
  const orig = w.assets.image.bind(w.assets);
  w.assets.image = (id) => { ids.push(id); return orig(id); };
  const layersDrawn = () => {
    ids.length = 0;
    const g = trackingGraphics();
    s.draw(g);
    return ids.filter((x) => x.startsWith('object/' + o.id + '/layer/'));
  };
  let prevStep = 0;
  await runBuild(w, s, {
    onAction: () => {
      if (s.stepIndex !== prevStep) {
        prevStep = s.stepIndex;
      }
      const drawn = layersDrawn();
      const full = o.steps.slice(0, s.stepIndex).map((st) => 'object/' + o.id + '/layer/' + st.layer);
      assert.deepEqual(drawn.slice(0, full.length), full);
      if (s.repeat > 0) assert.equal(drawn.length, full.length + 1, 'частичный слой текущего шага');
    },
  });
  assert.equal(prevStep, o.steps.length - 1);
});

test('2.13 / 2.21 выход посреди стройки и возврат (и перезапуск игры) — тот же шаг и повтор', async () => {
  const o = FX.data.objects.find((x) => x.steps.length >= 4 && x.steps[2].repeats >= 2);
  const storage = memoryStorage();
  let { w, s } = await openBuild(o.id, { storage });
  // два шага и один повтор третьего
  let acts = 0;
  const need = o.steps[0].repeats + o.steps[1].repeats + 1;
  while (acts < need) {
    const tg = waitTarget(w, s);
    perform(w, tg);
    acts++;
  }
  frames(w, 3);
  assert.equal(s.stepIndex, 2);
  assert.equal(s.repeat, 1);
  w.scenes.back();
  assert.equal(w.audio.activeSounds(), 0);
  await w.scenes.open('build', { object: o.id });
  s = w.scenes.currentScene();
  assert.equal(s.stepIndex, 2);
  assert.equal(s.repeat, 1);
  // новый запуск игры из того же хранилища
  ({ w, s } = await openBuild(o.id, { storage }));
  assert.equal(s.stepIndex, 2);
  assert.equal(s.repeat, 1);
  assert.deepEqual(w.progress.objectState(o.id), { step: 2, repeat: 1, done: false });
  // голос: задание шага, а не «Строим…» заново
  frames(w, 2);
  assert.ok(w.voices.log.includes(FX.data.phrases[o.steps[2].phrase]));
  assert.ok(!w.voices.log.some((t) => t.startsWith('Строим')));
});

test('2.14 после последнего шага объект построен, машина открыта; похвала, «Построили…», «новая машина»; finish {done, object}', async () => {
  const o = fxObj(0);
  const { w, s, results } = await openBuild(o.id);
  assert.equal(w.progress.isUnlocked(o.unlocks), false);
  assert.ok(w.voices.log[0].includes(FX.data.phrases['object-' + o.id + '-acc']), 'Строим …: ' + w.voices.log[0]);
  const checkpoints = [];
  const cp = w.timer.checkpoint.bind(w.timer);
  w.timer.checkpoint = () => { checkpoints.push(s.stepIndex); return cp(); };
  w.voices.log.length = 0;
  await runBuild(w, s);
  assert.equal(w.scenes.current(), 'home');
  assert.deepEqual(results, [{ done: true, object: o.id }]);
  assert.equal(w.progress.objectState(o.id).done, true);
  assert.equal(w.progress.isUnlocked(o.unlocks), true);
  assert.equal(checkpoints.length, o.steps.length, 'таймер: проверка после каждого шага');
  const ph = (id, vars) => FX.data.phrases[id].replace('{name}', FX.data.childName).replace(/\{(\w+)\}/g, (m, k) => vars[k]);
  assert.ok(w.voices.log.includes(ph('build-done', { object: FX.data.phrases['object-' + o.id + '-acc'] })));
  const md = FX.data.machines.find((m) => m.id === o.unlocks);
  assert.ok(w.voices.log.includes(ph('build-unlock', { machine: FX.data.phrases[md.namePhrase] })));
  const praiseTexts = FX.data.praises.map((p) => FX.data.phrases[p].replace('{name}', FX.data.childName));
  assert.ok(w.voices.log.some((t) => praiseTexts.includes(t)), 'похвала');
});

test('уже построенный объект строится заново с начала, прогресс не пишется', async () => {
  const o = fxObj(2);
  const { w, s, results } = await openBuild(o.id, { before: (w) => { w.progress.advanceObject(o.id, o.steps.length, 0); w.progress.completeObject(o.id); } });
  assert.equal(s.replay, true);
  assert.equal(s.stepIndex, 0);
  let writes = 0;
  w.progress.on('change', () => { writes++; });
  await runBuild(w, s);
  assert.equal(writes, 0);
  assert.deepEqual(results, [{ done: true, object: o.id }]);
});

test('подсказки: подсветка и рука через 5 с показывают движение, голос через 10 с повторяет задание', async () => {
  for (const action of ['dig', 'pour', 'lift', 'level']) {
    const { o, i } = withAction(FX, action);
    const { w, s } = await openAtStep(FX, o, i);
    w.audio.clearVoice(); w.voices.pending.length = 0; w.voices.log.length = 0;
    frames(w, 4.8);
    assert.equal(s.hint.showHand(), false);
    frames(w, 0.4);
    assert.ok(s.hint.showHand());
    const g = trackingGraphics();
    s.draw(g);
    assert.ok(g.drawn.some((d) => d.op === 'drawImage' && Math.round(d.w) === 110 && Math.round(d.h) === 130), action + ': рука');
    frames(w, 5);
    assert.equal(w.voices.log[0], FX.data.phrases[o.steps[i].phrase], action + ': голос');
  }
});

test('звуки: копание fx/dig, бетон fx/pour, мотор и гудок машины шага', async () => {
  const played = [];
  const { o, i } = withAction(FX, 'dig');
  const { w, s } = await openBuild(o.id, { before: (w) => {
    w.progress.advanceObject(o.id, i, 0);
    const orig = w.audio.play.bind(w.audio);
    w.audio.play = (id, opts) => { played.push(id); return orig(id, opts); };
  } });
  perform(w, waitTarget(w, s));
  const m = o.steps[i].machine;
  assert.ok(played.includes('fx/dig'));
  assert.ok(played.includes('horn/' + m));
  assert.ok(played.includes('engine/' + m));
});

test('0.4 утечки: 50 входов и выходов посреди действия — звуков, подписок и стека не прибавляется', async () => {
  const { o, i } = withAction(FX, 'pour');
  const { w } = await openAtStep(FX, o, i);
  w.scenes.back();
  const listeners = w.progress.listeners.size;
  for (let k = 0; k < 50; k++) {
    await w.scenes.open('build', { object: o.id });
    const s = w.scenes.currentScene();
    const tg = waitTarget(w, s);
    w.scenes.pointer({ type: 'down', x: tg.x, y: tg.y });
    frames(w, 0.1);
    w.scenes.back();
    assert.equal(w.audio.activeSounds(), 0);
  }
  assert.equal(w.progress.listeners.size, listeners);
  assert.equal(w.scenes.depth(), 1);
});

test('0.8 пауза: удержание отпускается, звук глохнет; после resume — продолжение', async () => {
  const { o, i } = withAction(FX, 'pour');
  const { w, s } = await openAtStep(FX, o, i);
  const tg = s.target;
  w.scenes.pointer({ type: 'down', x: tg.x, y: tg.y });
  frames(w, 0.5);
  w.scenes.pause();
  assert.equal(w.audio.activeSounds(), 0);
  w.scenes.resume();
  frames(w, 2);
  assert.ok(s.target && s.target.seconds < 1.2 && s.target.seconds > 0.6, 'шкала не сбросилась и не идёт без пальца');
});

test('0.11 неизвестный объект или объект с ошибкой: журнал, сцена закрывается, игра идёт', async () => {
  const err = captureErrors();
  try {
    const { w } = await openBuild('nets-takogo');
    assert.equal(w.scenes.current(), 'home');
    assert.ok(err.list.some((x) => x.includes('nets-takogo')));
  } finally { err.restore(); }
});

test('3.13 хаотичные касания не ломают стройку', async () => {
  const err = captureErrors();
  try {
    const o = fxObj(4);
    const { w, s } = await openBuild(o.id);
    const r = (n) => Math.floor(w.ctx.random() * n);
    for (let k = 0; k < 400; k++) {
      const x = r(1024), y = 100 + r(668);
      w.scenes.pointer({ type: 'down', x, y });
      if (k % 3 === 0) w.scenes.pointer({ type: 'move', x: r(1024), y: 100 + r(668) });
      w.scenes.pointer({ type: k % 7 === 0 ? 'cancel' : 'up', x, y });
      frames(w, 0.05);
      s.draw(trackingGraphics());
    }
    assert.deepEqual(err.list, []);
    assert.equal(w.scenes.current(), 'build');
  } finally { err.restore(); }
});

test('3.5 (логика) тестовые объекты: все шаги всех 10 объектов проходятся через target; машины открываются', async () => {
  const storage = memoryStorage();
  for (const o of FX.data.objects) {
    const { w, s, results } = await openBuild(o.id, { storage });
    const n = await runBuild(w, s);
    assert.equal(n, o.steps.reduce((a, st) => a + st.repeats, 0), o.id + ': число действий = сумма повторов');
    assert.deepEqual(results, [{ done: true, object: o.id }]);
    if (o.unlocks) assert.equal(w.progress.isUnlocked(o.unlocks), true);
  }
});

test('3.5 (логика) настоящие объекты зоны «Контент»: все шаги проходятся, машины открываются по таблице', { skip: !(realData.objects && realData.objects.length) }, async () => {
  const err = captureErrors();
  try {
    const storage = memoryStorage();
    let steps = 0;
    for (const o of REAL.data.objects) {
      const { w, s, results } = await openBuild(o.id, { fx: REAL, storage });
      await runBuild(w, s);
      steps += o.steps.length;
      assert.deepEqual(results, [{ done: true, object: o.id }], o.id);
      assert.equal(w.progress.objectState(o.id).done, true);
      if (o.unlocks) assert.equal(w.progress.isUnlocked(o.unlocks), true, o.id + ' открывает ' + o.unlocks);
    }
    assert.equal(steps, 110);
    assert.deepEqual(err.list, []);
  } finally { err.restore(); }
});

test('машина на объекте: если показан слой с id машины шага, она не подъезжает и не рисуется слева; груз на тросе сверху', async () => {
  // своя копия тестовых данных: шаг 1 ставит на объект слой «кран» (id слоя = id машины lift), шаг 2 — lift этой машиной
  const crane = FX.data.machines[7].id;
  const fx = { data: Object.assign({}, FX.data), art: Object.assign({}, FX.art) };
  const o = {
    id: 'fx-tower', order: 99, namePhrase: 'object-fx-1', unlocks: null,
    steps: [
      { machine: null, action: 'place', repeats: 1, phrase: 'step-fx-1-1', layer: crane },
      { machine: crane, action: 'lift', repeats: 2, phrase: 'step-fx-1-2', layer: 'l2' },
      { machine: FX.data.machines[0].id, action: 'haul-in', repeats: 1, phrase: 'step-fx-1-3', layer: 'l3' },
    ],
  };
  fx.data.objects = FX.data.objects.concat([o]);
  for (const st of o.steps) fx.art['object/fx-tower/layer/' + st.layer] = FX.art['object/fx-1/layer/l1'];
  const { w, s, results } = await openAtStep(fx, o, 1);
  assert.equal(s.stepIndex, 1);
  assert.equal(s.onSite(1), true);
  assert.equal(s.onSite(2), false);
  assert.equal(s.phase, 'work', 'не подъезжал');
  assert.equal(s.machineOn, null);
  const craneImgs = Object.keys(fx.art).filter((k) => k.startsWith('machine/' + crane + '/'));
  const imgs = craneImgs.map((k) => w.assets.image(k));
  const g = trackingGraphics();
  s.draw(g);
  assert.ok(!g.drawn.some((d) => d.op === 'drawImage' && imgs.includes(d.img)), 'кран слева не рисуется');
  // трос сверху: штрих от верхнего края экрана до груза
  const tg = s.target;
  assert.equal(tg.kind, 'drag');
  assert.ok(g.drawn.some((d) => d.op === 'stroke' && d.y <= 0 && d.y + d.h >= tg.y - 60 && Math.abs(d.x - tg.x) < 4), 'трос сверху');
  assert.deepEqual(crossZoneViolations(g), []);
  // цель рабочая: оба повтора через target, дальше — следующий шаг, его машина подъезжает
  await runBuild(w, s);
  assert.deepEqual(results, [{ done: true, object: 'fx-tower' }]);
  // без слоя-крана тот же шаг идёт с машиной слева
  const fx2 = { data: Object.assign({}, fx.data), art: fx.art };
  const o2 = Object.assign({}, o, { steps: [Object.assign({}, o.steps[0], { layer: 'l1' })].concat(o.steps.slice(1)) });
  fx2.data.objects = FX.data.objects.concat([o2]);
  fx2.art['object/fx-tower/layer/l1'] = FX.art['object/fx-1/layer/l1'];
  const r2 = await openAtStep(fx2, o2, 1);
  assert.equal(r2.s.onSite(1), false);
  assert.equal(r2.s.machineOn && r2.s.machineOn.id, crane);
});
