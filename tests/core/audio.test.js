// Тесты 0.13, 2.29, 2.31 и ошибки Audio (contracts.md, раздел 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Audio } from '../../src/core/audio.js';
import data from '../../src/data/index.js';
import { fakeVoices, captureErrors, tick, seededRandom } from './helpers.js';

function make(opts = {}) {
  const voices = fakeVoices();
  const a = new Audio({ data, voices, random: seededRandom(3), ...opts });
  return { a, voices };
}

test('0.13 / 2.31 одна фраза за раз: новая не накладывается на звучащую', async () => {
  const { a, voices } = make();
  a.unlock();
  a.say('part-rama'); a.say('part-kabina');
  await tick();
  assert.equal(voices.log.length, 1);
  assert.equal(voices.log[0], 'Рама!');
  voices.finishCurrent(); await tick();
  assert.deepEqual(voices.log, ['Рама!', 'Кабина!']);
});

test('0.13 очередь не длиннее 2: третья вытесняет самую старую ожидающую', async () => {
  const { a, voices } = make();
  a.unlock();
  a.say('part-rama');
  const p1 = a.say('part-kabina');
  a.say('part-kuzov');
  a.say('part-koleso-zadnee');
  assert.equal(a.queueLength(), 2);
  await p1; // вытесненная фраза завершается, а не висит
  for (let i = 0; i < 3; i++) { voices.finishCurrent(); await tick(); }
  assert.deepEqual(voices.log, ['Рама!', 'Кузов!', 'Задние колёса!']);
});

test('0.13 high обрывает текущую и звучит сразу', async () => {
  const { a, voices } = make();
  a.unlock();
  a.say('part-rama');
  await tick();
  a.say('timer-warning', {}, { priority: 'high' });
  await tick();
  assert.equal(voices.pending[0].cancelled, true);
  assert.equal(voices.log[1], 'Машины скоро поедут спать.');
});

test('0.13 clearVoice снимает очередь (выход из сцены)', async () => {
  const { a, voices } = make();
  a.unlock();
  const ps = [a.say('part-rama'), a.say('part-kabina'), a.say('part-kuzov')];
  a.clearVoice();
  await Promise.all(ps); // все обещания завершились
  assert.equal(a.queueLength(), 0);
  assert.equal(a.isSpeaking(), false);
  assert.equal(voices.log.length, 1);
});

test('подстановка имени: «Артём» берётся из одного места данных', async () => {
  const { a, voices } = make();
  a.unlock();
  a.say('assembly-task', { machine: 'самосвал' });
  await tick();
  assert.equal(voices.log[0], 'Артём, собери самосвал! Перетащи детали на место.');
});

test('фраза до первого касания ждёт в очереди', async () => {
  const { a, voices } = make();
  a.say('part-rama');
  await tick();
  assert.equal(voices.log.length, 0);
  a.unlock(); await tick();
  assert.deepEqual(voices.log, ['Рама!']);
});

test('2.29 похвала не повторяется два раза подряд', async () => {
  const { a, voices } = make();
  a.unlock();
  let prev = null;
  for (let i = 0; i < 300; i++) {
    a.praise(); await tick();
    const last = voices.log[voices.log.length - 1];
    assert.notEqual(last, prev);
    prev = last;
    voices.finishCurrent(); await tick();
  }
});

test('0.11 неизвестная фраза или звук: журнал, Promise завершается сразу', async () => {
  const err = captureErrors();
  try {
    const { a } = make();
    a.unlock();
    await a.say('net-takoi-frazy');
    const h = a.play('fx/nichego');
    h.stop();
    assert.equal(err.list.length, 2);
  } finally { err.restore(); }
});

test('голоса нет совсем — say завершается сразу', async () => {
  const a = new Audio({ data, voices: null });
  a.unlock();
  await a.say('part-rama');
  await a.praise();
});

test('звуки: stopAll глушит всё, setMuted глушит и голос', async () => {
  const { a, voices } = make();
  a.unlock();
  const h = a.play('engine/samosval', { loop: true });
  assert.equal(a.activeSounds(), 1);
  a.stopAll();
  assert.equal(a.activeSounds(), 0);
  assert.equal(h.stopped, true);
  a.setMuted(true);
  await a.say('part-rama');
  assert.equal(voices.log.length, 0);
});

test('факты идут по кругу', async () => {
  const { a, voices } = make();
  a.unlock();
  const n = data.machines[0].facts.length;
  for (let i = 0; i < n + 1; i++) { a.fact('samosval'); await tick(); voices.finishCurrent(); await tick(); }
  assert.equal(voices.log[0], voices.log[n]);
});
