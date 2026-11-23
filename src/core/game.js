// Game — сборка ядра: холст, цикл кадров, модули, SceneContext, пауза, таймер, обновление.
import { SceneManager } from './scene-manager.js';
import { Progress } from './progress.js';
import { AssetLoader } from './assets.js';
import { Audio, createSpeechVoices, createFileVoices } from './audio.js';
import { ParentTimer } from './parent-timer.js';
import { Input } from './input.js';
import { Updater, applyWaiting, registerWorker } from './updater.js';
import { CoreUI, UI_ART } from './ui.js';
import { SCREEN, logError } from './draw-utils.js';

const MAX_DT = 0.05;
const MAX_PIXEL_RATIO = 1.5; // старые iPad: компромисс между чёткостью и 60 кадрами

// Предсказуемый генератор для тестов (?seed=N).
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export class Game {
  constructor({ win = window, doc = document, canvas, scenes = [], data, art = {} }) {
    this.win = win;
    this.doc = doc;
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false });
    this.data = data;
    const q = new URLSearchParams(win.location.search);
    this.random = q.has('seed') ? seeded(Number(q.get('seed'))) : Math.random;

    this.view = { scale: 1, ox: 0, oy: 0, cssW: 1024, cssH: 768, ratio: 1 };
    this._resize();

    this.progress = new Progress({
      storage: win.localStorage,
      machines: data.machines.map((m) => m.id),
      objects: (data.objects || []).map((o) => ({ id: o.id, unlocks: o.unlocks })),
    });

    this.assets = new AssetLoader({
      registry: Object.assign({}, art, UI_ART),
      createCanvas: (w, h) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; },
      loadImage: (url) => new Promise((res, rej) => { const i = new win.Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }),
      fetchJson,
      scale: Math.min(2, this.view.scale * this.view.ratio),
    });

    this.audio = new Audio({
      data,
      createContext: () => { const AC = win.AudioContext || win.webkitAudioContext; return AC ? new AC() : null; },
      voices: createSpeechVoices(win),
      files: null,
      random: this.random,
    });

    this.ui = new CoreUI({ assets: this.assets });

    this.scenes = new SceneManager({
      makeContext: () => this.ctx,
      assets: this.assets,
      audio: this.audio,
      ui: this.ui,
    });

    this.timer = new ParentTimer({
      storage: win.localStorage,
      defaultMinutes: () => this.progress.setting('timerMinutes'),
      say: (phrase, opts) => this.audio.say(phrase, {}, opts),
      onLock: () => {
        this.audio.setMuted(true);
        if (this.scenes.current() !== 'locked' && this.scenes.current() !== 'parent') this.scenes.open('locked');
      },
      onUnlock: () => { this.audio.setMuted(false); },
    });

    this.updater = new Updater({ sw: 'serviceWorker' in win.navigator ? win.navigator.serviceWorker : null });

    this.ctx = Object.freeze({
      scenes: this.scenes,
      progress: this.progress,
      assets: this.assets,
      audio: this.audio,
      timer: this.timer,
      data: this.data,
      random: this.random,
      screen: { width: SCREEN.width, height: SCREEN.height },
    });

    this.input = new Input({
      toLogical: (cx, cy) => ({ x: (cx - this.view.ox) / this.view.scale, y: (cy - this.view.oy) / this.view.scale }),
      send: (e) => this.scenes.pointer(e),
      onParentGesture: () => { if (this.scenes.current() !== 'parent') this.scenes.open('parent'); },
      onFirstTouch: () => this.audio.unlock(),
      viewport: () => ({ w: this.view.cssW, h: this.view.cssH }),
    });

    for (const S of scenes) this.scenes.register(S);

    this.last = 0;
    this.hidden = false;
    this.frames = []; // длительности последних кадров — для тестов скорости
    this._frame = this._frame.bind(this);
  }

  _resize() {
    const w = this.win.innerWidth, h = this.win.innerHeight;
    const ratio = Math.min(this.win.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const scale = Math.min(w / SCREEN.width, h / SCREEN.height);
    this.view = { scale, ox: (w - SCREEN.width * scale) / 2, oy: (h - SCREEN.height * scale) / 2, cssW: w, cssH: h, ratio };
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * ratio);
    this.canvas.height = Math.round(h * ratio);
  }

  async boot() {
    const nav = this.win.navigator;
    const sw = 'serviceWorker' in nav ? nav.serviceWorker : null;
    // Новая версия уже скачана в прошлый раз — включаем её до старта игры.
    if (await applyWaiting(sw, () => this.win.location.reload())) return;

    this.progress.load();
    this.input.attach(this.canvas, this.doc, this.win);
    this.win.addEventListener('resize', () => this._resize());
    this.win.addEventListener('orientationchange', () => setTimeout(() => this._resize(), 300));
    this.doc.addEventListener('visibilitychange', () => this._visibility());
    this.win.addEventListener('pagehide', () => this.timer.persist());

    await this.assets.preload(Object.keys(UI_ART));
    this.win.requestAnimationFrame(this._frame);
    await this.scenes.open('home');
    this.timer.start();

    // Офлайн и обновление: регистрация service worker и проверка новой версии в фоне.
    registerWorker(sw, 'sw.js').then(() => {
      setTimeout(() => { this.updater.check(); }, 4000);
    });
  }

  _visibility() {
    if (this.doc.hidden) {
      this.hidden = true;
      this.input.cancelAll();
      this.scenes.pause();
      this.timer.persist();
    } else {
      this.hidden = false;
      this.last = 0;
      this.scenes.resume();
    }
  }

  _portrait() { return this.view.cssH > this.view.cssW * 1.05; }

  _frame(now) {
    this.win.requestAnimationFrame(this._frame);
    const t = now / 1000;
    let dt = this.last ? t - this.last : 0;
    if (this.last) { this.frames.push(dt); if (this.frames.length > 240) this.frames.shift(); }
    this.last = t;
    if (dt > MAX_DT) dt = MAX_DT;
    if (dt < 0) dt = 0;
    if (this.hidden) return;
    try {
      this.ui.tick(dt);
      this.input.tick(dt);
      if (!this.scenes.paused && !this.scenes.loading) this.timer.tick(dt);
      this.scenes.update(dt);
      this._draw();
    } catch (e) {
      logError('Game', 'ошибка кадра', e);
    }
  }

  _draw() {
    const g = this.g;
    const v = this.view;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#1d2b3a';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this._portrait()) {
      g.setTransform(v.ratio, 0, 0, v.ratio, 0, 0);
      this.ui.drawRotate(g, v.cssW, v.cssH);
      return;
    }
    const k = v.scale * v.ratio;
    g.setTransform(k, 0, 0, k, v.ox * v.ratio, v.oy * v.ratio);
    g.save();
    g.beginPath(); g.rect(0, 0, SCREEN.width, SCREEN.height); g.clip();
    this.scenes.draw(g);
    this.ui.drawGestureProgress(g, this.input.gestureProgress());
    g.restore();
  }

  // Для автоматических тестов.
  fps() {
    if (!this.frames.length) return 0;
    const avg = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    return avg > 0 ? 1 / avg : 0;
  }
}
