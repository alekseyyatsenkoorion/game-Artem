// Фоновая музыка кодом: включается после первого касания, молчит при глушении, паузе и выключенной настройке,
// под голосом тише, не держит таймеров после остановки.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Audio, MUSIC_LEVEL } from '../../src/core/audio.js';
import { Music, MELODY, BASS, MUSIC_STEP } from '../../src/core/music.js';
import data from '../../src/data/index.js';
import { fakeVoices, tick, seededRandom } from './helpers.js';

function param(v = 0) {
  return { value: v, setValueAtTime(x) { this.value = x; }, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime(x) { this.value = x; } };
}
function node(extra = {}) { return Object.assign({ connect() {}, disconnect() {} }, extra); }
function fakeAc() {
  const ac = {
    currentTime: 0, state: 'running', destination: node(), oscillators: 0,
    createGain() { return node({ gain: param(1) }); },
    createOscillator() { ac.oscillators++; return node({ type: 'sine', frequency: param(440), start() {}, stop() {} }); },
    createBuffer() { return {}; },
    createBufferSource() { return node({ start() {} }); },
    resume() { return Promise.resolve(); },
  };
  return ac;
}
function fakeTimers() {
  const t = { live: new Map(), n: 0, set(f) { const id = ++t.n; t.live.set(id, f); return id; }, clear(id) { t.live.delete(id); }, fire() { for (const f of Array.from(t.live.values())) f(); } };
  return t;
}
function make() {
  const ac = fakeAc();
  const timers = fakeTimers();
  const a = new Audio({ data, voices: fakeVoices(), random: seededRandom(1), createContext: () => ac });
  a.musicTimers = timers;
  return { a, ac, timers };
}

test('музыка: мелодия и бас согласованы, петля из 8 тактов', () => {
  assert.equal(MELODY.length, 64);
  assert.equal(BASS.length, MELODY.length / 8);
  assert.ok(MUSIC_STEP > 0.2 && MUSIC_STEP < 0.5);
});

test('музыка: включается только после первого касания (требование iOS)', () => {
  const { a, timers } = make();
  a.setMusic(true);
  assert.equal(a.musicPlaying(), false);
  a.unlock();
  assert.equal(a.musicPlaying(), true);
  assert.equal(timers.live.size, 1);
});

test('музыка: ставит ноты вперёд по времени и идёт по кругу', () => {
  const ac = fakeAc();
  const timers = fakeTimers();
  const m = new Music(ac, node(), timers);
  m.start();
  const first = m.notes;
  assert.ok(first > 0);
  for (let i = 0; i < 200; i++) { ac.currentTime += 0.1; timers.fire(); }
  assert.ok(m.step >= 0 && m.step < MELODY.length);
  assert.ok(m.notes > first + 40, 'нот: ' + m.notes);
  m.stop();
  assert.equal(timers.live.size, 0);
});

test('музыка: после долгой паузы не догоняет пропущенные ноты разом', () => {
  const ac = fakeAc();
  const timers = fakeTimers();
  const m = new Music(ac, node(), timers);
  m.start();
  const before = m.notes;
  ac.currentTime += 600;
  timers.fire();
  assert.ok(m.notes - before <= 6, 'за один тик поставлено ' + (m.notes - before));
});

test('музыка: выключатель взрослого, глушение таймером и сворачивание игры', () => {
  const { a, timers } = make();
  a.unlock();
  a.setMusic(false);
  assert.equal(a.musicPlaying(), false);
  assert.equal(timers.live.size, 0, 'таймер музыки остался');
  a.setMusic(true);
  assert.equal(a.musicPlaying(), true);
  a.setMuted(true);
  assert.equal(a.musicPlaying(), false);
  a.setMuted(false);
  assert.equal(a.musicPlaying(), true);
  a.pauseMusic(true);
  assert.equal(a.musicPlaying(), false);
  a.pauseMusic(false);
  assert.equal(a.musicPlaying(), true);
});

test('музыка: под голосом тише, после фразы громкость возвращается', async () => {
  const { a } = make();
  a.unlock();
  const voices = a.voices;
  assert.equal(a.musicBus.gain.value, MUSIC_LEVEL);
  a.say('part-rama');
  await tick();
  assert.ok(a.musicBus.gain.value < MUSIC_LEVEL);
  voices.finishCurrent(); await tick();
  assert.equal(a.musicBus.gain.value, MUSIC_LEVEL);
});

test('музыка: stopAll сцены музыку не останавливает', () => {
  const { a } = make();
  a.unlock();
  a.stopAll();
  assert.equal(a.musicPlaying(), true);
});
