// SceneManager — переключение сцен (contracts.md, раздел 2).
// Одновременно работает одна сцена; сцены ниже по стеку на паузе.
import { logError, CROSS_ZONE, inRect } from './draw-utils.js';

const REQUIRED = {
  assembly: ['machine'],
  puzzle: ['machine', 'size'],
  wash: ['machine'],
  repair: ['machine'],
  fuel: ['machine'],
  tug: ['machine'],
  build: ['object'],
};

// Сцены без крестика: главный экран (выходить некуда) и «Машины спят» (выход только жестом взрослого).
const NO_CROSS = new Set(['home', 'locked']);

export class SceneManager {
  // makeContext() — SceneContext; assets — AssetLoader; audio — Audio; ui — рисование крестика и экрана ожидания.
  constructor({ makeContext, assets, audio, ui = null }) {
    this.makeContext = makeContext;
    this.assets = assets;
    this.audio = audio;
    this.ui = ui;
    this.classes = new Map();
    this.stack = []; // {Cls, scene, params, assets}
    this.loading = false;
    this.chain = Promise.resolve();
    this.crossDown = false;
    this.pendingBack = false;
    this.paused = false;
    this.enterCount = 0; // для тестов утечек
  }

  register(SceneClass) {
    if (!SceneClass || typeof SceneClass.id !== 'string') { logError('SceneManager', 'класс без id'); return; }
    this.classes.set(SceneClass.id, SceneClass);
  }

  has(id) { return this.classes.has(id); }

  current() {
    const top = this.stack[this.stack.length - 1];
    return top ? top.Cls.id : null;
  }

  currentScene() {
    const top = this.stack[this.stack.length - 1];
    return top ? top.scene : null;
  }

  depth() { return this.stack.length; }

  hasCross() {
    return this.stack.length > 1 && !NO_CROSS.has(this.current());
  }

  _enqueue(fn) {
    const p = this.chain.then(fn, fn);
    this.chain = p.catch(() => {});
    return p;
  }

  _checkParams(id, params) {
    const need = REQUIRED[id] || [];
    for (const k of need) {
      if (!params || params[k] === undefined || params[k] === null) {
        logError('SceneManager', 'сцене ' + id + ' не хватает параметра ' + k);
        return false;
      }
    }
    return true;
  }

  _resolveId(id) {
    if (this.classes.has(id)) return id;
    logError('SceneManager', 'неизвестная сцена', id);
    return this.classes.has('home') ? 'home' : null;
  }

  async _start(id, params) {
    const Cls = this.classes.get(id);
    let ids = [];
    try { ids = Cls.assets(params || {}) || []; } catch (e) { logError('SceneManager', 'assets() сцены ' + id, e); }
    this.loading = true;
    try { await this.assets.preload(ids); } catch (e) { logError('SceneManager', 'загрузка ассетов', e); }
    this.loading = false;
    const scene = new Cls(this.makeContext());
    const entry = { Cls, scene, params: params || {}, assets: ids };
    this.stack.push(entry);
    this.enterCount++;
    try {
      scene.enter(entry.params);
    } catch (e) {
      this._crash(entry, 'enter', e);
      return false;
    }
    return true;
  }

  _exitEntry(entry) {
    try { entry.scene.exit(); } catch (e) { logError('SceneManager', 'exit() сцены ' + entry.Cls.id, e); }
    try { this.audio.stopAll(); this.audio.clearVoice(); } catch (e) { /* ничего */ }
    // Выгружаем картинки, которые не нужны оставшимся сценам.
    const still = new Set();
    for (const e of this.stack) if (e !== entry) for (const id of e.assets) still.add(id);
    const free = entry.assets.filter((id) => !still.has(id));
    try { this.assets.release(free); } catch (e) { /* ничего */ }
  }

  // Сцена упала: пишем в журнал, убираем её, возвращаемся на предыдущую или на главный экран.
  _crash(entry, where, err) {
    logError('SceneManager', 'ошибка в ' + where + ' сцены ' + entry.Cls.id, err);
    const i = this.stack.indexOf(entry);
    if (i >= 0) this.stack.splice(i, 1);
    this._exitEntry(entry);
    const prev = this.stack[this.stack.length - 1];
    if (prev) {
      this._safe(prev, 'resume', () => prev.scene.resume());
      this._safe(prev, 'onResult', () => prev.scene.onResult({ cancelled: true }));
    } else if (entry.Cls.id !== 'home' && this.classes.has('home')) {
      this._enqueue(() => this._start('home', {}));
    }
  }

  _safe(entry, where, fn) {
    try { fn(); return true; } catch (e) { this._crash(entry, where, e); return false; }
  }

  open(id, params = {}) {
    return this._enqueue(async () => {
      const rid = this._resolveId(id);
      if (!rid) return false;
      if (rid === id && !this._checkParams(rid, params)) return false;
      const top = this.stack[this.stack.length - 1];
      if (top) {
        try { this.audio.stopAll(); this.audio.clearVoice(); } catch (e) { /* ничего */ }
        this._safe(top, 'pause', () => top.scene.pause());
      }
      return this._start(rid, rid === id ? params : {});
    });
  }

  replace(id, params = {}) {
    return this._enqueue(async () => {
      const rid = this._resolveId(id);
      if (!rid) return false;
      if (rid === id && !this._checkParams(rid, params)) return false;
      const top = this.stack.pop();
      if (top) this._exitEntry(top);
      return this._start(rid, rid === id ? params : {});
    });
  }

  _close(result) {
    if (this.stack.length < 2) return; // главную сцену закрыть нельзя
    const top = this.stack.pop();
    this._exitEntry(top);
    this.crossDown = false;
    this.pendingBack = false;
    const prev = this.stack[this.stack.length - 1];
    if (this._safe(prev, 'resume', () => prev.scene.resume())) {
      this._safe(prev, 'onResult', () => prev.scene.onResult(result));
    }
  }

  finish(result) { this._close(result === undefined ? {} : result); }

  back() { this._close({ cancelled: true }); }

  // Закрыть все сцены выше главной (после сброса прогресса и т. п.).
  backToRoot() {
    while (this.stack.length > 1) this._close({ cancelled: true });
  }

  // ---------- кадр ----------

  update(dt) {
    if (this.paused || this.loading) return;
    const top = this.stack[this.stack.length - 1];
    if (!top) return;
    if (this.pendingBack) {
      let ok = true;
      try { ok = top.scene.canExit(); } catch (e) { ok = true; }
      if (ok) { this.pendingBack = false; this.back(); return; }
    }
    this._safe(top, 'update', () => top.scene.update(dt));
  }

  draw(g) {
    const top = this.stack[this.stack.length - 1];
    if (this.loading || !top) {
      if (this.ui) this.ui.drawLoading(g);
      return;
    }
    g.save();
    const ok = this._safe(top, 'draw', () => top.scene.draw(g));
    g.restore();
    if (ok && this.hasCross() && this.ui) this.ui.drawCross(g, this.crossDown);
  }

  // Касание первого пальца в логических координатах (от Input).
  pointer(e) {
    if (this.loading) return;
    const top = this.stack[this.stack.length - 1];
    if (!top) return;
    if (this.hasCross()) {
      if (e.type === 'down' && inRect(e.x, e.y, CROSS_ZONE)) { this.crossDown = true; return; }
      if (this.crossDown) {
        if (e.type === 'up') {
          this.crossDown = false;
          if (inRect(e.x, e.y, CROSS_ZONE, 20)) this.requestBack();
        } else if (e.type === 'cancel') this.crossDown = false;
        return; // касание, начатое на крестике, сцене не передаётся
      }
    }
    this._safe(top, 'onPointer', () => top.scene.onPointer(e));
  }

  // Крестик: если сцена сейчас не может выйти (финальная анимация), выходим, как только сможет.
  requestBack() {
    const top = this.stack[this.stack.length - 1];
    if (!top || this.stack.length < 2) return;
    let ok = true;
    try { ok = top.scene.canExit(); } catch (e) { ok = true; }
    if (ok) this.back(); else this.pendingBack = true;
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    try { this.audio.stopAll(); this.audio.clearVoice(); } catch (e) { /* ничего */ }
    const top = this.stack[this.stack.length - 1];
    if (top) this._safe(top, 'pause', () => top.scene.pause());
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    const top = this.stack[this.stack.length - 1];
    if (top) this._safe(top, 'resume', () => top.scene.resume());
  }
}
