// Audio — звуки и голос (contracts.md, раздел 5).
// Звуки техники создаются кодом (Web Audio), голос — файл фразы из assets/audio/,
// если он есть, иначе встроенный русский голос устройства.
import { logError } from './draw-utils.js';
import { Music } from './music.js';

// Громкость фоновой музыки: тихо, ниже звуков машин. Под голосом — ещё тише.
export const MUSIC_LEVEL = 0.07;
const MUSIC_DUCK = 0.35;

const FX_IDS = ['fx/snap', 'fx/water', 'fx/foam', 'fx/pump', 'fx/dig', 'fx/pour', 'fx/win', 'fx/splash'];

export class Audio {
  // data — данные контента (машины, фразы, похвалы, имя ребёнка).
  // createContext() — AudioContext или null.
  // voices — {speak(text) → {done: Promise, cancel()}, info() → строка} (встроенный голос) или null.
  // files — {has(phrase), play(phrase) → {done, cancel}} (записанные фразы) или null.
  constructor({ data, createContext = () => null, voices = null, files = null, random = Math.random }) {
    this.data = data;
    this.createContext = createContext;
    this.voices = voices;
    this.files = files;
    this.random = random;
    this.ac = null;
    this.master = null; // общий уровень (глушение)
    this.sfx = null;    // уровень звуков (приглушается под голос)
    this.unlocked = false;
    this.muted = false;
    this.handles = new Set();
    this.queue = [];      // ожидающие фразы {phrase, text, resolve}
    this.current = null;  // {phrase, text, resolve, cancel}
    this.lastPraise = null;
    this.factIndex = {};
    this.spoken = [];     // журнал сказанного (для тестов и родительского экрана)
    this.musicBus = null; // уровень музыки
    this.music = null;    // Music, пока играет
    this.musicOn = true;  // настройка взрослого
    this.musicPaused = false; // игра свёрнута
    this.musicTimers = undefined; // подмена таймеров в тестах
  }

  // ---------- музыка ----------

  // Включить или выключить фоновую музыку (настройка на экране для взрослых).
  setMusic(on) {
    this.musicOn = !!on;
    this._updateMusic();
  }

  // Игра свёрнута — музыка молчит; развернули — играет дальше.
  pauseMusic(flag) {
    this.musicPaused = !!flag;
    this._updateMusic();
  }

  musicPlaying() { return !!(this.music && this.music.playing()); }

  _updateMusic() {
    const want = this.musicOn && !this.muted && !this.musicPaused && !!this.ac && !!this.musicBus;
    try {
      if (want && !this.music) {
        this.music = new Music(this.ac, this.musicBus, this.musicTimers);
        this.music.start();
      } else if (!want && this.music) {
        this.music.stop();
        this.music = null;
      }
    } catch (e) {
      logError('Audio', 'сбой музыки', e);
      this.music = null;
    }
  }

  // ---------- включение ----------

  // Вызывается ядром на каждом касании (touchstart, touchend, pointerdown). iOS считает «жестом»
  // не каждое из них, поэтому включение повторяется, пока звук и голос действительно не заработают.
  unlock() {
    if (!this.ac) {
      try {
        this.ac = this.createContext();
        if (this.ac) {
          this.master = this.ac.createGain();
          this.master.gain.value = this.muted ? 0 : 1;
          this.master.connect(this.ac.destination);
          this.sfx = this.ac.createGain();
          this.sfx.gain.value = 1;
          this.sfx.connect(this.master);
          this.musicBus = this.ac.createGain();
          this.musicBus.gain.value = MUSIC_LEVEL;
          this.musicBus.connect(this.master);
        }
      } catch (e) {
        logError('Audio', 'Web Audio недоступен', e);
        this.ac = null;
      }
    }
    const running = this.ac && this.ac.state === 'running';
    try {
      if (this.ac && !running) {
        if (this.ac.resume) { const p = this.ac.resume(); if (p && p.catch) p.catch(() => {}); }
        // iOS включает звук только если в жесте прозвучал хоть какой-то звук
        const b = this.ac.createBuffer(1, 1, 22050);
        const s = this.ac.createBufferSource();
        s.buffer = b; s.connect(this.ac.destination); s.start(0);
      }
    } catch (e) { /* ничего */ }
    if (this.onGesture) { try { this.onGesture(); } catch (e) { /* ничего */ } }
    // Голос: первая фраза должна прозвучать внутри настоящего жеста — «грунтуем» на нескольких первых касаниях.
    // Пока голос ни разу не начал говорить (voices.ok()), грунтуем на каждом касании, но не больше 30 раз.
    this.primes = (this.primes || 0) + 1;
    const voiceOk = this.voices && this.voices.ok ? this.voices.ok() : this.primes > 4;
    if (!voiceOk && this.primes <= 30 && this.voices && this.voices.prime) {
      try { this.voices.prime(); } catch (e) { /* ничего */ }
    }
    if (!this.unlocked) {
      this.unlocked = true;
      this._next();
    }
    if (!this.music) this._updateMusic();
  }

  // Состояние звука для экрана взрослых.
  soundState() {
    if (!this.ac) return 'нет';
    return this.ac.state || 'неизвестно';
  }

  // ---------- звуки ----------

  _machineSounds(machine) {
    const m = (this.data.machines || []).find((x) => x.id === machine);
    return m ? (m.sounds || {}) : null;
  }

  _known(id) {
    if (FX_IDS.includes(id)) return true;
    const m = /^(horn|engine)\/(.+)$/.exec(id);
    return !!(m && this._machineSounds(m[2]));
  }

  play(id, opts = {}) {
    const handle = { id, stopped: false, stop: () => {} };
    if (!this._known(id)) {
      logError('Audio', 'неизвестный звук', id);
      handle.stopped = true;
      return handle;
    }
    this.handles.add(handle);
    let stopFn = () => {};
    let endTimer = null;
    if (this.ac && this.unlocked && !this.muted) {
      try {
        const out = this.ac.createGain();
        out.gain.value = opts.volume == null ? 1 : opts.volume;
        out.connect(this.sfx);
        const r = synth(this.ac, out, id, opts, this._machineSounds(id.split('/').slice(1).join('/')) || {});
        stopFn = () => { try { r.stop(); } catch (e) { /* ничего */ } try { out.disconnect(); } catch (e) { /* ничего */ } };
        if (!opts.loop && r.duration) {
          endTimer = setTimeout(() => { this.handles.delete(handle); handle.stopped = true; try { out.disconnect(); } catch (e) { /* ничего */ } }, (r.duration + 0.2) * 1000);
        }
      } catch (e) {
        logError('Audio', 'сбой звука', id, e);
      }
    } else if (!opts.loop) {
      // звука не слышно (ещё не включён) — считаем, что он сразу закончился
      this.handles.delete(handle);
      handle.stopped = true;
    }
    handle.stop = () => {
      if (handle.stopped) return;
      handle.stopped = true;
      if (endTimer) clearTimeout(endTimer);
      this.handles.delete(handle);
      stopFn();
    };
    return handle;
  }

  stopAll() {
    for (const h of Array.from(this.handles)) h.stop();
    this.handles.clear();
  }

  activeSounds() { return this.handles.size; }

  // ---------- голос ----------

  _text(phrase, vars) {
    const phrases = this.data.phrases || {};
    const t = phrases[phrase];
    if (typeof t !== 'string' || !t) return null;
    const all = Object.assign({ name: this.data.childName || '' }, vars || {});
    return t.replace(/\{(\w+)\}/g, (m, k) => (all[k] != null ? String(all[k]) : ''));
  }

  say(phrase, vars, opts = {}) {
    const text = this._text(phrase, vars);
    if (text == null) {
      logError('Audio', 'неизвестная фраза', phrase);
      return Promise.resolve();
    }
    if (this.muted) return Promise.resolve();
    if (!this.voices && !(this.files && this.files.has(phrase))) return Promise.resolve();
    return new Promise((resolve) => {
      const item = { phrase, text, resolve };
      if (opts.priority === 'high') {
        this._cancelCurrent();
        this.queue.unshift(item);
      } else {
        this.queue.push(item);
        while (this.queue.length > 2) {
          const old = this.queue.shift();
          old.resolve();
        }
      }
      this._next();
    });
  }

  _cancelCurrent() {
    const c = this.current;
    if (!c) return;
    this.current = null;
    try { c.cancel(); } catch (e) { /* ничего */ }
    c.resolve();
    this._duck(false);
  }

  _next() {
    if (this.current || !this.unlocked || this.muted) return;
    const item = this.queue.shift();
    if (!item) return;
    let playback = null;
    try {
      if (this.files && this.files.has(item.phrase)) playback = this.files.play(item.phrase);
      else if (this.voices) playback = this.voices.speak(item.text);
    } catch (e) {
      logError('Audio', 'сбой голоса', e);
    }
    if (!playback) { item.resolve(); this._next(); return; }
    const cur = { phrase: item.phrase, text: item.text, resolve: item.resolve, cancel: playback.cancel || (() => {}) };
    this.current = cur;
    this.spoken.push(item.text);
    if (this.spoken.length > 50) this.spoken.shift();
    this._duck(true);
    Promise.resolve(playback.done).catch(() => {}).then(() => {
      if (this.current !== cur) return;
      this.current = null;
      this._duck(false);
      cur.resolve();
      this._next();
    });
  }

  _duck(on) {
    if (!this.sfx || !this.ac) return;
    try { this.sfx.gain.setTargetAtTime(on ? 0.5 : 1, this.ac.currentTime, 0.05); } catch (e) { /* ничего */ }
    if (this.musicBus) {
      try { this.musicBus.gain.setTargetAtTime(MUSIC_LEVEL * (on ? MUSIC_DUCK : 1), this.ac.currentTime, 0.15); } catch (e) { /* ничего */ }
    }
  }

  isSpeaking() { return !!this.current; }
  queueLength() { return this.queue.length; }

  praise() {
    const list = this.data.praises || [];
    if (!list.length) return Promise.resolve();
    let i = Math.floor(this.random() * list.length);
    if (list.length > 1 && list[i] === this.lastPraise) i = (i + 1 + Math.floor(this.random() * (list.length - 1))) % list.length;
    this.lastPraise = list[i];
    return this.say(list[i]);
  }

  fact(machine) {
    const m = (this.data.machines || []).find((x) => x.id === machine);
    if (!m || !m.facts || !m.facts.length) {
      logError('Audio', 'нет фактов для машины', machine);
      return Promise.resolve();
    }
    const i = this.factIndex[machine] || 0;
    this.factIndex[machine] = (i + 1) % m.facts.length;
    return this.say(m.facts[i]);
  }

  clearVoice() {
    const waiting = this.queue;
    this.queue = [];
    for (const it of waiting) it.resolve();
    this._cancelCurrent();
  }

  setMuted(flag) {
    this.muted = !!flag;
    if (this.muted) { this.clearVoice(); this.stopAll(); }
    if (this.master && this.ac) {
      try { this.master.gain.setValueAtTime(this.muted ? 0 : 1, this.ac.currentTime); } catch (e) { this.master.gain.value = this.muted ? 0 : 1; }
    }
    this._updateMusic();
  }

  voiceInfo() {
    const snd = ' · звук: ' + this.soundState();
    if (!this.voices) return 'нет' + snd;
    try { return this.voices.info() + snd; } catch (e) { return 'неизвестно' + snd; }
  }
}

// ---------- синтез звуков ----------

function noiseBuffer(ac, seconds) {
  const len = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const b = ac.createBuffer(1, len, ac.sampleRate);
  const d = b.getChannelData(0);
  let x = 12345;
  for (let i = 0; i < len; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; d[i] = (x / 0x7fffffff) * 2 - 1; }
  return b;
}

function envGain(ac, dest, t0, attack, hold, release, peak = 1) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  g.connect(dest);
  return g;
}

function tone(ac, dest, type, freq, t0, dur, peak = 0.3) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  const g = envGain(ac, dest, t0, 0.01, Math.max(0, dur - 0.06), 0.05, peak);
  o.connect(g);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
  return o;
}

export function synth(ac, dest, id, opts, sounds) {
  const t = ac.currentTime + 0.01;
  const nodes = [];
  const stopAll = () => { for (const n of nodes) { try { n.stop(); } catch (e) { /* ничего */ } } };
  const kind = id.split('/')[0];

  if (kind === 'engine') {
    // Мотор: пила с «пыхтением» и фильтром. Без loop — заводится и затихает (около 2,5 с).
    const base = (sounds.engine && sounds.engine.base) || 50;
    const o = ac.createOscillator(); o.type = 'sawtooth';
    const o2 = ac.createOscillator(); o2.type = 'square';
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 3;
    const trem = ac.createGain(); trem.gain.value = 0.5;
    const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 11;
    const lfoAmt = ac.createGain(); lfoAmt.gain.value = 0.45;
    lfo.connect(lfoAmt); lfoAmt.connect(trem.gain);
    const sub = ac.createGain(); sub.gain.value = 0.35;
    o.connect(lp); o2.connect(sub); sub.connect(lp); lp.connect(trem);
    const out = ac.createGain();
    trem.connect(out); out.connect(dest);
    const f = o.frequency, f2 = o2.frequency, lf = lfo.frequency;
    f.setValueAtTime(base * 0.5, t); f2.setValueAtTime(base * 0.25, t); lf.setValueAtTime(6, t);
    f.linearRampToValueAtTime(base * 1.6, t + 0.6); f2.linearRampToValueAtTime(base * 0.8, t + 0.6); lf.linearRampToValueAtTime(18, t + 0.6);
    f.linearRampToValueAtTime(base, t + 1.1); f2.linearRampToValueAtTime(base * 0.5, t + 1.1); lf.linearRampToValueAtTime(12, t + 1.1);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.6, t + 0.15);
    let duration = null;
    if (!opts.loop) {
      duration = 2.5;
      out.gain.setValueAtTime(0.6, t + 1.8);
      out.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    }
    for (const n of [o, o2, lfo]) { n.start(t); if (duration) n.stop(t + duration + 0.05); nodes.push(n); }
    return { stop: stopAll, duration };
  }

  if (kind === 'horn') {
    // Гудок: два коротких «би-бип» двумя тонами.
    const notes = (sounds.horn && sounds.horn.notes) || [392, 494];
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.connect(dest);
    for (let k = 0; k < 2; k++) {
      const t0 = t + k * 0.32;
      for (const fr of notes) nodes.push(tone(ac, lp, 'square', fr, t0, 0.24, 0.16));
    }
    return { stop: stopAll, duration: 0.7 };
  }

  if (id === 'fx/snap') {
    const o = ac.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.09);
    const g = envGain(ac, dest, t, 0.005, 0.03, 0.08, 0.5);
    o.connect(g); o.start(t); o.stop(t + 0.15); nodes.push(o);
    const n = ac.createBufferSource(); n.buffer = noiseBuffer(ac, 0.05);
    const ng = envGain(ac, dest, t, 0.002, 0.01, 0.03, 0.25);
    n.connect(ng); n.start(t); nodes.push(n);
    return { stop: stopAll, duration: 0.2 };
  }

  if (id === 'fx/win') {
    [523, 659, 784, 1047].forEach((fr, i) => nodes.push(tone(ac, dest, 'triangle', fr, t + i * 0.12, i === 3 ? 0.4 : 0.14, 0.3)));
    return { stop: stopAll, duration: 0.9 };
  }

  if (id === 'fx/pump') {
    const o = ac.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t); o.frequency.linearRampToValueAtTime(260, t + 0.25);
    const g = envGain(ac, dest, t, 0.02, 0.15, 0.1, 0.2);
    o.connect(g); o.start(t); o.stop(t + 0.35); nodes.push(o);
    return { stop: stopAll, duration: 0.4 };
  }

  // Шумовые: вода, пена, копание, заливка, плюх.
  const shapes = {
    'fx/water': { f: 1400, dur: 0.9, peak: 0.25 },
    'fx/foam': { f: 3000, dur: 0.6, peak: 0.15 },
    'fx/dig': { f: 400, dur: 0.4, peak: 0.4 },
    'fx/pour': { f: 700, dur: 1.2, peak: 0.25 },
    'fx/splash': { f: 900, dur: 0.6, peak: 0.45 },
  };
  const sh = shapes[id] || { f: 1000, dur: 0.3, peak: 0.2 };
  const n = ac.createBufferSource(); n.buffer = noiseBuffer(ac, sh.dur + 0.1);
  if (opts.loop) n.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = sh.f; bp.Q.value = 0.8;
  const g = opts.loop ? (() => { const x = ac.createGain(); x.gain.value = sh.peak; x.connect(dest); return x; })()
    : envGain(ac, dest, t, 0.03, sh.dur - 0.15, 0.12, sh.peak);
  n.connect(bp); bp.connect(g); n.start(t); nodes.push(n);
  return { stop: stopAll, duration: opts.loop ? null : sh.dur };
}

// ---------- встроенный голос устройства ----------

export function createSpeechVoices(win) {
  const ss = win.speechSynthesis;
  const Utt = win.SpeechSynthesisUtterance;
  if (!ss || !Utt) return null;
  let voice = null;
  let started = false; // хоть одна фраза реально зазвучала — голос включён
  const pick = () => {
    try {
      const all = ss.getVoices() || [];
      const ru = all.filter((v) => /^ru/i.test(v.lang));
      voice = ru.find((v) => v.localService) || ru[0] || null;
    } catch (e) { voice = null; }
  };
  pick();
  try { ss.addEventListener ? ss.addEventListener('voiceschanged', pick) : (ss.onvoiceschanged = pick); } catch (e) { /* ничего */ }
  return {
    ok() { return started; },
    prime() {
      // первая фраза должна прозвучать внутри касания — иначе iOS не включит голос
      try {
        if (ss.paused && ss.resume) ss.resume();
        const u = new Utt(' '); u.volume = 0; u.lang = 'ru-RU';
        if (voice) u.voice = voice;
        ss.speak(u);
      } catch (e) { /* ничего */ }
    },
    speak(text) {
      if (!voice) pick();
      let cancelled = false;
      let finish;
      const done = new Promise((res) => { finish = res; });
      const u = new Utt(text);
      u.lang = 'ru-RU';
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.pitch = 1.1;
      u.onstart = () => { started = true; };
      u.onend = () => { started = true; finish(); };
      u.onerror = () => finish();
      // страховка: на iOS onend иногда не приходит
      const guard = setTimeout(() => finish(), 2500 + text.length * 110);
      done.then(() => clearTimeout(guard));
      try { ss.speak(u); } catch (e) { finish(); }
      return {
        done,
        cancel() { if (cancelled) return; cancelled = true; try { ss.cancel(); } catch (e) { /* ничего */ } finish(); },
      };
    },
    info() {
      if (!voice) pick();
      if (!voice) {
        let n = 0; try { n = (ss.getVoices() || []).length; } catch (e) { /* ничего */ }
        return 'русский голос не найден (голосов всего: ' + n + ')' + (started ? ', говорит' : ', молчит');
      }
      return voice.name + ' (' + voice.lang + (voice.localService ? ', на устройстве' : ', из сети') + ')' + (started ? ', говорит' : ', молчит');
    },
  };
}

// ---------- записанные фразы (assets/audio/manifest.json: «id фразы → файл») ----------

export function createFileVoices(win, manifest, base = 'assets/audio/') {
  const map = manifest && typeof manifest === 'object' ? manifest : {};
  return {
    has(phrase) { return typeof map[phrase] === 'string'; },
    play(phrase) {
      const el = new win.Audio(base + map[phrase]);
      let finish;
      const done = new Promise((res) => { finish = res; });
      el.onended = () => finish();
      el.onerror = () => finish();
      const p = el.play();
      if (p && p.catch) p.catch(() => finish());
      return { done, cancel() { try { el.pause(); } catch (e) { /* ничего */ } finish(); } };
    },
  };
}
