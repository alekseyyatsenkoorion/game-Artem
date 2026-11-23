// Общие подмены для тестов: хранилище, голос, холст, контекст сцены.
import { Progress } from '../../src/core/progress.js';
import { Audio } from '../../src/core/audio.js';
import { AssetLoader } from '../../src/core/assets.js';
import { ParentTimer } from '../../src/core/parent-timer.js';
import { SceneManager } from '../../src/core/scene-manager.js';

export function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
    map: m,
  };
}

export function brokenStorage() {
  return { getItem: () => { throw new Error('нет доступа'); }, setItem: () => { throw new Error('места нет'); } };
}

// Голос, который «говорит», пока тест не завершит фразу вручную.
export function fakeVoices() {
  const log = [];
  const pending = [];
  return {
    log, pending,
    speak(text) {
      let finish; const done = new Promise((r) => { finish = r; });
      const item = { text, finish, cancelled: false };
      pending.push(item); log.push(text);
      return { done, cancel() { item.cancelled = true; finish(); } };
    },
    finishCurrent() { const it = pending.shift(); if (it) it.finish(); },
    info() { return 'тестовый голос'; },
  };
}

// Холст-пустышка: принимает любые вызовы, запоминает drawImage и fillRect.
export function fakeGraphics() {
  const calls = [];
  const target = {
    calls,
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (t) => ({ width: String(t).length * 10 }),
  };
  const transform = { a: 1, e: 0, f: 0 };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'drawImage') return (img, x, y, w, h) => calls.push({ op: 'drawImage', x, y, w, h });
      return (...args) => { calls.push({ op: String(k), args }); };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

export function fakeCanvas(w, h) {
  return { width: w, height: h, getContext: () => fakeGraphics() };
}

export function seededRandom(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function makeWorld({ data, art = {}, scenes = [], storage = memoryStorage(), voices = fakeVoices(), random = seededRandom(7) } = {}) {
  const errors = [];
  const progress = new Progress({ storage, machines: data.machines.map((m) => m.id), objects: data.objects || [] });
  progress.load();
  const audio = new Audio({ data, voices, random });
  audio.unlock();
  const assets = new AssetLoader({ registry: art, createCanvas: fakeCanvas, scale: 1 });
  let ctx;
  const scenesMgr = new SceneManager({ makeContext: () => ctx, assets, audio, ui: { drawLoading() {}, drawCross() {} } });
  const timer = new ParentTimer({
    storage, defaultMinutes: () => progress.setting('timerMinutes'),
    say: (p, o) => audio.say(p, {}, o),
    onLock: () => { audio.setMuted(true); if (scenesMgr.current() !== 'locked') scenesMgr.open('locked'); },
    onUnlock: () => audio.setMuted(false),
  });
  const updater = { version: () => '0.0', check: () => Promise.resolve(false) };
  ctx = { scenes: scenesMgr, progress, assets, audio, timer, data, updater, random, screen: { width: 1024, height: 768 } };
  for (const S of scenes) scenesMgr.register(S);
  return { ctx, progress, audio, assets, scenes: scenesMgr, timer, storage, voices, errors };
}

// Ловим console.error, чтобы проверить «запись в журнал» и отсутствие ошибок.
export function captureErrors() {
  const list = [];
  const orig = console.error;
  console.error = (...a) => { list.push(a.map(String).join(' ')); };
  return { list, restore: () => { console.error = orig; } };
}

export const tick = () => new Promise((r) => setTimeout(r, 0));
