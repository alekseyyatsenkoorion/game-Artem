// Progress — единственный модуль, который знает формат сохранения (contracts.md, раздел 3).
import { logError } from './draw-utils.js';

export const SAVE_KEY = 'stroika.save';
export const BROKEN_KEY = 'stroika.save.broken';
export const FORMAT = 1;

const PUZZLE_STATES = ['none', 'started', 'done'];
export const PUZZLE_SIZES = [16, 25, 36];
// Какой пазл той же машины нужно собрать, чтобы открылся этот (25 после 16, 36 после 25).
export const PUZZLE_NEEDS = { 25: 16, 36: 25 };
const TUG_LEVELS = ['easy', 'medium', 'hard'];

// Переносы со старых форматов: MIGRATIONS[n] превращает формат n в n + 1.
// Формата 0 в выпущенных версиях не было; запись оставлена как образец и для теста переноса.
export const MIGRATIONS = {
  0: (old) => {
    const s = { format: 1, machines: {}, puzzleInProgress: {}, objects: {}, map: { stop: 0 },
      tug: { nextLevel: 'easy', wins: 0, losses: 0 }, wash: { lastWasStubborn: false },
      settings: { timerMinutes: 30 } };
    for (const id of old.unlocked || []) s.machines[id] = { unlocked: true, assembled: false, puzzle16: 'none', puzzle25: 'none', puzzle36: 'none' };
    for (const id of old.assembled || []) {
      s.machines[id] = s.machines[id] || { unlocked: true, assembled: false, puzzle16: 'none', puzzle25: 'none', puzzle36: 'none' };
      s.machines[id].assembled = true;
    }
    if (typeof old.timerMinutes === 'number') s.settings.timerMinutes = old.timerMinutes;
    return s;
  },
};

function emptyMachine() {
  return { unlocked: false, assembled: false, puzzle16: 'none', puzzle25: 'none', puzzle36: 'none' };
}

export class Progress {
  // storage — объект с getItem/setItem (localStorage или подмена в тестах).
  // machines — список id машин по порядку; objects — [{id, unlocks}].
  constructor({ storage, machines, objects = [] }) {
    this.storage = storage;
    this.machineIds = machines.slice();
    this.objectDefs = objects.slice();
    this.listeners = new Set();
    this.writeFailed = false;
    this.state = this._fresh();
  }

  _fresh(settings) {
    const s = {
      format: FORMAT,
      machines: {},
      puzzleInProgress: {},
      objects: {},
      map: { stop: 0 },
      tug: { nextLevel: 'easy', wins: 0, losses: 0 },
      wash: { lastWasStubborn: false },
      settings: settings ? { ...settings } : { timerMinutes: 30 },
    };
    if (this.machineIds.length) {
      s.machines[this.machineIds[0]] = { ...emptyMachine(), unlocked: true };
    }
    return s;
  }

  load() {
    let raw = null;
    try {
      raw = this.storage.getItem(SAVE_KEY);
    } catch (e) {
      logError('Progress', 'хранилище недоступно', e);
      this.state = this._fresh();
      return;
    }
    if (raw == null) { this.state = this._fresh(); this._write(); return; }
    try {
      let s = JSON.parse(raw);
      if (!s || typeof s !== 'object' || typeof s.format !== 'number') throw new Error('нет поля format');
      while (s.format < FORMAT) {
        const m = MIGRATIONS[s.format];
        if (!m) throw new Error('нет переноса с формата ' + s.format);
        s = m(s);
      }
      if (s.format !== FORMAT) throw new Error('формат из будущего: ' + s.format);
      this.state = this._validate(s);
      this._write();
    } catch (e) {
      logError('Progress', 'сохранение повреждено, начинаем новую игру', e);
      try { this.storage.setItem(BROKEN_KEY, String(raw)); } catch (e2) { /* ничего */ }
      this.state = this._fresh();
      this._write();
    }
  }

  // Проверка формата: всё лишнее и неверное отбрасывается, обязательное дополняется.
  _validate(s) {
    const out = this._fresh(s.settings && typeof s.settings === 'object' ? s.settings : undefined);
    if (typeof out.settings.timerMinutes !== 'number') out.settings.timerMinutes = 30;
    if (s.machines && typeof s.machines === 'object') {
      for (const id of Object.keys(s.machines)) {
        const m = s.machines[id];
        if (!m || typeof m !== 'object') throw new Error('машина ' + id + ' не объект');
        out.machines[id] = {
          unlocked: !!m.unlocked,
          assembled: !!m.assembled,
          puzzle16: PUZZLE_STATES.includes(m.puzzle16) ? m.puzzle16 : 'none',
          puzzle25: PUZZLE_STATES.includes(m.puzzle25) ? m.puzzle25 : 'none',
          puzzle36: PUZZLE_STATES.includes(m.puzzle36) ? m.puzzle36 : 'none', // с версии 1.6; в старых сохранениях нет
        };
      }
    } else throw new Error('нет machines');
    if (this.machineIds.length) {
      const first = this.machineIds[0];
      out.machines[first] = out.machines[first] || emptyMachine();
      out.machines[first].unlocked = true;
    }
    if (s.puzzleInProgress && typeof s.puzzleInProgress === 'object') {
      for (const k of Object.keys(s.puzzleInProgress)) {
        const v = s.puzzleInProgress[k];
        if (Array.isArray(v)) out.puzzleInProgress[k] = v.filter((n) => Number.isInteger(n));
      }
    }
    if (s.objects && typeof s.objects === 'object') {
      for (const id of Object.keys(s.objects)) {
        const o = s.objects[id] || {};
        out.objects[id] = { step: o.step | 0, repeat: o.repeat | 0, done: !!o.done };
      }
    }
    if (s.map && Number.isInteger(s.map.stop)) out.map.stop = s.map.stop;
    if (s.tug && typeof s.tug === 'object') {
      out.tug = {
        nextLevel: TUG_LEVELS.includes(s.tug.nextLevel) ? s.tug.nextLevel : 'easy',
        wins: s.tug.wins | 0,
        losses: s.tug.losses | 0,
      };
    }
    if (s.wash && typeof s.wash === 'object') out.wash.lastWasStubborn = !!s.wash.lastWasStubborn;
    return out;
  }

  _write() {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.state));
      this.writeFailed = false;
    } catch (e) {
      if (!this.writeFailed) logError('Progress', 'запись не удалась, прогресс живёт в памяти', e);
      this.writeFailed = true;
    }
  }

  _changed(what) {
    this._write();
    for (const fn of Array.from(this.listeners)) {
      try { fn(what); } catch (e) { logError('Progress', 'ошибка подписчика', e); }
    }
  }

  _machine(id, forWrite) {
    if (!this.machineIds.includes(id)) {
      logError('Progress', 'неизвестная машина', id);
      return null;
    }
    if (!this.state.machines[id]) {
      if (!forWrite) return emptyMachine();
      this.state.machines[id] = emptyMachine();
    }
    return this.state.machines[id];
  }

  _objectKnown(id) {
    if (this.objectDefs.some((o) => o.id === id)) return true;
    logError('Progress', 'неизвестный объект', id);
    return false;
  }

  isUnlocked(machine) { const m = this._machine(machine); return !!(m && m.unlocked); }
  unlock(machine) {
    const m = this._machine(machine, true);
    if (!m || m.unlocked) return;
    m.unlocked = true;
    this._changed({ type: 'unlock', machine });
  }

  isAssembled(machine) { const m = this._machine(machine); return !!(m && m.assembled); }
  setAssembled(machine) {
    const m = this._machine(machine, true);
    if (!m) return;
    m.assembled = true;
    this._changed({ type: 'assembled', machine });
  }

  puzzleState(machine, size) {
    const m = this._machine(machine);
    if (!m || !PUZZLE_SIZES.includes(size)) return 'none';
    return m['puzzle' + size];
  }
  puzzlePieces(machine, size) {
    if (!this._machine(machine)) return [];
    const list = this.state.puzzleInProgress[machine + '-' + size];
    return list ? list.slice() : [];
  }
  savePuzzle(machine, size, pieces) {
    const m = this._machine(machine, true);
    if (!m || !PUZZLE_SIZES.includes(size) || !Array.isArray(pieces)) return;
    const uniq = Array.from(new Set(pieces.filter((n) => Number.isInteger(n) && n >= 0 && n < size)));
    const key = machine + '-' + size;
    if (uniq.length >= size) {
      m['puzzle' + size] = 'done';
      delete this.state.puzzleInProgress[key];
    } else {
      if (m['puzzle' + size] !== 'done') m['puzzle' + size] = 'started';
      this.state.puzzleInProgress[key] = uniq;
    }
    this._changed({ type: 'puzzle', machine, size });
  }

  objectState(object) {
    if (!this._objectKnown(object)) return { step: 0, repeat: 0, done: false };
    const o = this.state.objects[object];
    return o ? { ...o } : { step: 0, repeat: 0, done: false };
  }
  advanceObject(object, step, repeat) {
    if (!this._objectKnown(object)) return;
    const o = this.state.objects[object] || { step: 0, repeat: 0, done: false };
    o.step = step | 0; o.repeat = repeat | 0;
    this.state.objects[object] = o;
    this._changed({ type: 'object', object });
  }
  completeObject(object) {
    if (!this._objectKnown(object)) return null;
    const def = this.objectDefs.find((d) => d.id === object);
    const o = this.state.objects[object] || { step: 0, repeat: 0, done: false };
    o.done = true;
    this.state.objects[object] = o;
    const unlocks = def.unlocks || null;
    if (unlocks && this.machineIds.includes(unlocks)) {
      const m = this._machine(unlocks, true);
      m.unlocked = true;
    }
    this._changed({ type: 'object-done', object, unlocks });
    return unlocks;
  }

  mapStop() { return this.state.map.stop; }
  setMapStop(n) {
    if (!Number.isInteger(n) || n < 0) { logError('Progress', 'неверная остановка', n); return; }
    this.state.map.stop = n;
    this._changed({ type: 'map' });
  }

  tug() { return { ...this.state.tug }; }
  saveTug(state) {
    if (!state || typeof state !== 'object') return;
    this.state.tug = {
      nextLevel: TUG_LEVELS.includes(state.nextLevel) ? state.nextLevel : this.state.tug.nextLevel,
      wins: state.wins | 0,
      losses: state.losses | 0,
    };
    this._changed({ type: 'tug' });
  }

  // Мойка: была ли упрямая грязь в прошлый раз (чтобы не выпадала два раза подряд).
  wash() { return { ...this.state.wash }; }
  saveWash(state) {
    if (!state || typeof state !== 'object') return;
    this.state.wash = { lastWasStubborn: !!state.lastWasStubborn };
    this._changed({ type: 'wash' });
  }

  setting(name) { return this.state.settings[name]; }
  setSetting(name, value) {
    this.state.settings[name] = value;
    this._changed({ type: 'setting', name });
  }

  unlockAll() {
    for (const id of this.machineIds) {
      const m = this._machine(id, true);
      m.unlocked = true;
    }
    this._changed({ type: 'unlock-all' });
  }

  reset() {
    this.state = this._fresh(this.state.settings);
    this._changed({ type: 'reset' });
  }

  on(event, fn) {
    if (event !== 'change' || typeof fn !== 'function') return () => {};
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
