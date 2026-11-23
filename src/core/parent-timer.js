// ParentTimer — родительский таймер (contracts.md, раздел 6).
// Время считается кадрами игры (tick), поэтому идёт только пока игра открыта и не на паузе.
import { logError } from './draw-utils.js';

export const TIMER_KEY = 'stroika.timer';
const ALLOWED = [0, 15, 30, 45];
const WARN_NORMAL = 120;
const WARN_TEST = 20;
const TEST_SECONDS = 60;
const HARD_LOCK_AFTER = 180; // после «expired» блокируем сами не позже чем через 3 минуты
const SAVE_EVERY = 5;

export class ParentTimer {
  // storage — localStorage или подмена; defaultMinutes() — настройка из Progress;
  // say(phrase, opts) — голос; onLock() / onUnlock() — открыть сцену «Машины спят», заглушить звук и обратно.
  constructor({ storage, defaultMinutes = () => 30, say = () => {}, onLock = () => {}, onUnlock = () => {} }) {
    this.storage = storage;
    this.defaultMinutes = defaultMinutes;
    this.sayFn = say;
    this.onLock = onLock;
    this.onUnlock = onUnlock;
    this.listeners = {};
    this.s = this._fresh(30);
    this.sinceSave = 0;
    this.started = false;
  }

  _fresh(minutes) {
    return { minutes, remaining: minutes * 60, warned: false, expired: false, sinceExpired: 0, locked: false, test: false };
  }

  _emit(event) {
    const list = this.listeners[event];
    if (!list) return;
    for (const fn of Array.from(list)) {
      try { fn(event); } catch (e) { logError('ParentTimer', 'ошибка подписчика', e); }
    }
  }

  on(event, fn) {
    if (typeof fn !== 'function') return () => {};
    (this.listeners[event] = this.listeners[event] || new Set()).add(fn);
    return () => this.listeners[event] && this.listeners[event].delete(fn);
  }

  _save() {
    this.sinceSave = 0;
    try { this.storage.setItem(TIMER_KEY, JSON.stringify(this.s)); } catch (e) { /* таймер живёт в памяти */ }
  }

  _load() {
    let def = 30;
    try { const d = this.defaultMinutes(); if (ALLOWED.includes(d)) def = d; } catch (e) { /* ничего */ }
    try {
      const raw = this.storage.getItem(TIMER_KEY);
      if (!raw) return this._fresh(def);
      const s = JSON.parse(raw);
      if (!s || !ALLOWED.includes(s.minutes) || typeof s.remaining !== 'number' || !isFinite(s.remaining)) throw new Error('неверное состояние');
      return {
        minutes: s.minutes,
        remaining: Math.max(0, s.remaining),
        warned: !!s.warned,
        expired: !!s.expired,
        sinceExpired: Number(s.sinceExpired) || 0,
        locked: !!s.locked,
        test: !!s.test,
      };
    } catch (e) {
      logError('ParentTimer', 'состояние не читается, начинаем заново', e);
      return this._fresh(def);
    }
  }

  start() {
    this.s = this._load();
    this.started = true;
    this._save();
    this._emit('start');
    if (this.s.locked) this._lock(true);
  }

  _active() { return this.s.test || this.s.minutes > 0; }

  // Вызывает ядро каждый кадр, кроме паузы.
  tick(dt) {
    if (!this.started || this.s.locked || !this._active()) return;
    this.s.remaining = Math.max(0, this.s.remaining - dt);
    const warnAt = this.s.test ? WARN_TEST : WARN_NORMAL;
    if (!this.s.warned && this.s.remaining <= warnAt && this.s.remaining > 0) {
      this.s.warned = true;
      this._save();
      this._emit('warning');
      try { this.sayFn('timer-warning', { priority: 'high' }); } catch (e) { /* ничего */ }
    }
    if (!this.s.expired && this.s.remaining <= 0) {
      this.s.expired = true;
      this.s.sinceExpired = 0;
      this._save();
      this._emit('expired');
    } else if (this.s.expired) {
      this.s.sinceExpired += dt;
      if (this.s.sinceExpired >= HARD_LOCK_AFTER) { this._lock(); return; }
    }
    this.sinceSave += dt;
    if (this.sinceSave >= SAVE_EVERY) this._save();
  }

  persist() { this._save(); }

  remaining() {
    if (!this._active()) return Infinity;
    return Math.max(0, Math.ceil(this.s.remaining));
  }

  minutes() { return this.s.minutes; }
  isTestRun() { return this.s.test; }

  setMinutes(n) {
    if (!ALLOWED.includes(n)) { logError('ParentTimer', 'недопустимая длительность', n); return; }
    const wasLocked = this.s.locked;
    this.s = this._fresh(n);
    this._save();
    if (wasLocked) { this._emit('unlocked'); try { this.onUnlock(); } catch (e) { /* ничего */ } }
    this._emit('start');
  }

  testRun() {
    const wasLocked = this.s.locked;
    this.s = this._fresh(this.s.minutes);
    this.s.test = true;
    this.s.remaining = TEST_SECONDS;
    this._save();
    if (wasLocked) { this._emit('unlocked'); try { this.onUnlock(); } catch (e) { /* ничего */ } }
    this._emit('start');
  }

  checkpoint() {
    if (this.s.locked) return true;
    if (this.s.expired) { this._lock(); return true; }
    return false;
  }

  _lock(restore) {
    if (this.s.locked && !restore) return;
    this.s.locked = true;
    this._save();
    try { this.onLock(); } catch (e) { logError('ParentTimer', 'сбой блокировки', e); }
    this._emit('locked');
  }

  unlock() {
    const was = this.s.locked;
    this.s = this._fresh(this.s.minutes);
    this._save();
    if (was) {
      try { this.onUnlock(); } catch (e) { /* ничего */ }
      this._emit('unlocked');
    }
    this._emit('start');
  }

  isLocked() { return this.s.locked; }
}
