// Фоновая музыка кодом (Web Audio): тихая детская петля — ксилофон и мягкий бас.
// Файлов нет, работает без сети. Управляет ею Audio (setMusic, глушение, пауза).

const BPM = 92;
export const MUSIC_STEP = 60 / BPM / 2; // восьмая, секунды
const LOOKAHEAD = 0.4; // на сколько секунд вперёд ставим ноты
const TICK_MS = 100;

const F = { G3: 196.0, A3: 220.0, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99 };
const B = { C2: 65.41, F2: 87.31, G2: 98.0, A2: 110.0 };

// 8 тактов по 8 восьмых. 0 — пауза. Пентатоника до мажор: ничего не режет слух.
export const MELODY = [
  'E5', 0, 'D5', 'C5', 'D5', 0, 'E5', 0,
  'G5', 0, 'E5', 0, 'D5', 0, 0, 0,
  'C5', 0, 'D5', 'E5', 'G4', 0, 'A4', 0,
  'C5', 0, 'D5', 0, 'C5', 0, 0, 0,
  'E5', 0, 'G5', 'E5', 'D5', 0, 'C5', 0,
  'A4', 0, 'C5', 0, 'D5', 0, 'E5', 0,
  'D5', 0, 'C5', 'A4', 'G4', 0, 'A4', 0,
  'C5', 0, 0, 0, 0, 0, 0, 0,
];
// Бас: корень аккорда такта, на первую и пятую восьмую.
export const BASS = ['C2', 'A2', 'F2', 'G2', 'C2', 'A2', 'F2', 'G2'];

export class Music {
  // ac — AudioContext; dest — узел, куда играть; timers — {set, clear} (подменяется в тестах).
  constructor(ac, dest, timers = { set: (f, ms) => setInterval(f, ms), clear: (id) => clearInterval(id) }) {
    this.ac = ac;
    this.dest = dest;
    this.timers = timers;
    this.timer = null;
    this.step = 0;
    this.next = 0;
    this.notes = 0; // сколько нот поставлено (для тестов)
  }

  playing() { return this.timer != null; }

  start() {
    if (this.timer != null) return;
    this.next = this.ac.currentTime + 0.15;
    this.timer = this.timers.set(() => this._tick(), TICK_MS);
    this._tick();
  }

  stop() {
    if (this.timer == null) return;
    this.timers.clear(this.timer);
    this.timer = null;
  }

  _tick() {
    const now = this.ac.currentTime;
    // после долгой паузы (вкладка спала) не догоняем пропущенное
    if (this.next < now) this.next = now + 0.05;
    let guard = 0;
    while (this.next < now + LOOKAHEAD && guard++ < 16) {
      this._schedule(this.step, this.next);
      this.next += MUSIC_STEP;
      this.step = (this.step + 1) % MELODY.length;
    }
  }

  _schedule(step, t) {
    try {
      const m = MELODY[step];
      if (m) this._xylo(F[m], t);
      const inBar = step % 8;
      if (inBar === 0 || inBar === 4) this._bass(B[BASS[Math.floor(step / 8)]], t);
    } catch (e) { /* звук не обязателен */ }
  }

  _xylo(f, t) {
    const ac = this.ac;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    g.connect(this.dest);
    const o1 = ac.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4;
    const g2 = ac.createGain(); g2.gain.value = 0.12;
    o1.connect(g); o2.connect(g2); g2.connect(g);
    o1.start(t); o2.start(t); o1.stop(t + 0.6); o2.stop(t + 0.6);
    this.notes++;
  }

  _bass(f, t) {
    const ac = this.ac;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    g.connect(this.dest);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f * 2;
    o.connect(g);
    o.start(t); o.stop(t + 0.55);
    this.notes++;
  }
}
