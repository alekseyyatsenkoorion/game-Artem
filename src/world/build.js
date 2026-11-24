// Стройка (spec.md, раздел 4 «Стройка»; contracts.md, разделы 2, 3, 8).
// Параметры {object}. Объект строится по шагам строго по порядку; у шага есть повторы.
// Слои пройденных шагов лежат стопкой в OBJECT_ORIGIN (все слои 600 × 440, земля внутри слоя на y = 340).
// Машина шага подъезжает слева, подсвечивается, голос даёт задание; действие ребёнка — модуль из build-actions/.
// Прогресс пишется после каждого повтора; после последнего шага — completeObject (открывает машину).
// Уже построенный объект можно построить ещё раз: без записи прогресса.
// Машина на объекте: если среди уже показанных слоёв есть слой с id, равным id машины шага (башенный кран,
// поставленный на объект), машина не подъезжает и не рисуется слева — действие идёт без неё (груз — на тросе сверху).
// Публичное поле target — текущее ожидаемое действие (для e2e): {kind, x, y, to?, path?, seconds?} или null.
import { Scene } from '../core/scene.js';
import { IdleHint, drawHand } from '../core/ui.js';
import { logError, clamp, easeInOut, easeOut } from '../core/draw-utils.js';
import { makeAction, ACTIONS, facesBack } from './build-actions/index.js';
import { GROUND, SITE } from './build-actions/common.js';
import { opaqueBox, screenBox } from './build-actions/layer-box.js';
import contentData from '../data/index.js';

export const OBJECT_ORIGIN = { x: 400, y: GROUND - 340 };
export const LAYER = { w: 600, h: 440 };
const MACHINE_BOX = { w: 320, h: 210 };

const INTRO_TIME = 0.6;
const ARRIVE_TIME = 1.2;
const LEAVE_TIME = 0.9;
const STEP_DONE_TIME = 1.0;
const FINALE_MIN = 3.5;
const FINALE_MAX = 9;

function layerId(object, layer) { return 'object/' + object + '/layer/' + layer; }

// Где стоит машина шага без дела: слева от объекта, колёсами на земле.
export function machineHome(m) {
  const k = Math.min(MACHINE_BOX.w / m.size.w, MACHINE_BOX.h / m.size.h);
  const w = Math.round(m.size.w * k), h = Math.round(m.size.h * k);
  return { x: OBJECT_ORIGIN.x - 8 - w, y: GROUND + 6 - h, w, h };
}

function findObject(list, id) { return (list || []).find((o) => o && o.id === id) || null; }

export class BuildScene extends Scene {
  static id = 'build';

  static assets(params) {
    const ids = ['bg/build', 'ui/hand'];
    const def = findObject(contentData.objects, params && params.object);
    if (def && Array.isArray(def.steps)) {
      for (const s of def.steps) {
        if (s.layer) ids.push(layerId(def.id, s.layer));
        if (s.machine) ids.push('machine/' + s.machine + '/whole/idle', 'machine/' + s.machine + '/whole/work');
      }
      if (def.unlocks) ids.push('machine/' + def.unlocks + '/whole/idle');
    }
    return ids;
  }

  enter(params) {
    const { ctx } = this;
    const id = params && params.object;
    const def = findObject(ctx.data.objects, id);
    this.t = 0;
    this.phase = 'broken';
    this.action = null;
    this.hint = new IdleHint();
    this.sparkles = [];
    this.confetti = [];
    this.boxes = new Map(); // id слоя → где он на экране (или null)
    if (!def || !Array.isArray(def.steps) || !def.steps.length || def.steps.some((s) => !s || !ACTIONS[s.action])) {
      logError('build', 'нет описания объекта или в нём ошибка', id);
      ctx.scenes.back();
      return;
    }
    this.def = def;
    this.objectId = def.id;
    this.steps = def.steps;
    const st = ctx.progress.objectState(def.id);
    this.replay = !!st.done;
    if (this.replay) {
      this.stepIndex = 0;
      this.repeat = 0;
    } else {
      this.stepIndex = clamp(st.step | 0, 0, this.steps.length);
      this.repeat = this.stepIndex < this.steps.length ? clamp(st.repeat | 0, 0, this._repeats(this.stepIndex) - 1) : 0;
    }
    this.machineOn = null; // машина, что сейчас стоит на площадке
    this.mirrorOn = false; // стоит задом к объекту
    this.phaseT = 0;
    if (this.stepIndex >= this.steps.length) { this._finishObject(); return; }
    if (this.stepIndex === 0 && this.repeat === 0) ctx.audio.say('build-start', { object: this._objectAcc() });
    this.phase = 'intro';
  }

  exit() {
    if (this.action) this.action.stop();
    this.action = null;
  }

  pause() { if (this.action) this.action.cancel(); }

  // ---------- данные ----------

  _repeats(i) { return Math.max(1, (this.steps[i] && this.steps[i].repeats) | 0 || 1); }
  _phrase(id) { return (id && this.ctx.data.phrases && this.ctx.data.phrases[id]) || ''; }
  _objectAcc() {
    const d = this.def;
    return this._phrase(d.nameAccPhrase || 'object-' + d.id + '-acc') || this._phrase(d.namePhrase);
  }
  _machineDef(id) {
    if (!id) return null;
    const m = (this.ctx.data.machines || []).find((x) => x.id === id);
    if (!m) logError('build', 'неизвестная машина шага', id);
    return m || null;
  }

  get step() { return this.steps ? this.steps[this.stepIndex] : null; }

  // Машина шага i уже стоит на объекте: её нарисовал слой пройденного шага (id слоя = id машины).
  onSite(i) {
    const s = this.steps && this.steps[i];
    if (!s || !s.machine) return false;
    for (let j = 0; j < i; j++) if (this.steps[j] && this.steps[j].layer === s.machine) return true;
    return false;
  }

  // Машина, которая подъезжает и рисуется у объекта на шаге i (null — без машины или она на объекте).
  _stepMachine(i) {
    const s = this.steps[i];
    return s && !this.onSite(i) ? this._machineDef(s.machine) : null;
  }

  // Где на экране появится слой шага i: прямоугольник его непрозрачных пикселей (один раз на слой) или null.
  layerBox(i) {
    const s = this.steps && this.steps[i];
    if (!s || !s.layer) return null;
    const id = layerId(this.objectId, s.layer);
    if (!this.boxes.has(id)) {
      let b = null;
      try { b = screenBox(opaqueBox(this.ctx.assets.image(id), LAYER.w, LAYER.h), OBJECT_ORIGIN); } catch (e) { b = null; }
      this.boxes.set(id, b);
    }
    return this.boxes.get(id);
  }

  // Что сейчас ждём от ребёнка (для e2e и руки-подсказки).
  get target() {
    if (this.phase !== 'work' || !this.action) return null;
    return this.action.target();
  }

  // ---------- ход стройки ----------

  _beginStep() {
    const step = this.step;
    const m = this._stepMachine(this.stepIndex);
    const same = m && this.machineOn && this.machineOn.id === m.id && this.mirrorOn === facesBack(step.action, m);
    if (this.machineOn && !same) {
      this.phase = 'leave';
    } else if (m && !same) {
      this.phase = 'arrive';
      this.ctx.audio.play('engine/' + m.id);
    } else {
      this._startWork();
      return;
    }
    this.phaseT = 0;
  }

  _startWork() {
    const step = this.step;
    const m = this._stepMachine(this.stepIndex);
    const onSite = this.onSite(this.stepIndex);
    const mirror = facesBack(step.action, m);
    this.machineOn = m;
    this.mirrorOn = mirror;
    const env = {
      ctx: this.ctx,
      step,
      machine: m,
      mirror,
      onSite,
      box: this.layerBox(this.stepIndex), // куда ляжет новая часть (null — общее место)
      homeRect: () => machineHome(m),
      drawMachine: (g, r, pose) => this._drawMachine(g, m, r, pose, mirror),
      time: () => this.t,
    };
    this.action = makeAction(step.action, env);
    this.action.start(this.repeat);
    this.phase = 'work';
    this.phaseT = 0;
    this.hint.reset();
    this.voiceHints = 0;
    if (step.machine && (m || onSite)) this.ctx.audio.play('horn/' + step.machine);
    if (step.phrase) this.ctx.audio.say(step.phrase);
  }

  _repeatDone() {
    const p = this.ctx.progress;
    const n = this._repeats(this.stepIndex);
    const r = this.repeat + 1;
    if (r < n) {
      if (!this.replay) p.advanceObject(this.objectId, this.stepIndex, r);
      this.repeat = r;
      this.action.start(r);
      this.hint.reset();
      return;
    }
    if (!this.replay) p.advanceObject(this.objectId, this.stepIndex + 1, 0);
    this.action.stop();
    this.stepIndex++;
    this.repeat = 0;
    this.phase = 'step-done';
    this.phaseT = 0;
    this._sparkle();
    if (this.stepIndex < this.steps.length) this.ctx.audio.praise();
    // безопасная точка для родительского таймера: шаг закончен
    this.ctx.timer.checkpoint();
  }

  _afterStep() {
    if (this.stepIndex >= this.steps.length) { this._finishObject(); return; }
    this._beginStep();
  }

  _finishObject() {
    const { ctx } = this;
    this.action = null;
    const unlocked = this.replay ? null : ctx.progress.completeObject(this.objectId);
    this.unlocked = unlocked;
    ctx.audio.clearVoice();
    ctx.audio.praise();
    let last = ctx.audio.say('build-done', { object: this._objectAcc() });
    this.voiceDone = false;
    if (unlocked) {
      const md = (ctx.data.machines || []).find((x) => x.id === unlocked);
      last = ctx.audio.say('build-unlock', { machine: md ? this._phrase(md.namePhrase) : '' });
      ctx.audio.play('horn/' + unlocked);
    }
    ctx.audio.play('fx/win');
    if (last && typeof last.then === 'function') last.then(() => { this.voiceDone = true; }, () => { this.voiceDone = true; });
    else this.voiceDone = true;
    this.phase = 'finale';
    this.phaseT = 0;
    this._sparkle();
  }

  _sparkle() {
    for (let i = 0; i < 26; i++) {
      const a = this.ctx.random() * Math.PI * 2;
      const sp = 150 + this.ctx.random() * 250;
      this.sparkles.push({ x: SITE.x, y: SITE.y - 80, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, t: 0, life: 0.9 + this.ctx.random() * 0.4, c: i % 3 });
    }
  }

  // ---------- события ----------

  onPointer(e) {
    if (e.type === 'down') this.hint.reset();
    if (this.phase === 'work' && this.action) this.action.onPointer(e);
  }

  update(dt) {
    if (this.phase === 'broken') return;
    this.t += dt;
    this.phaseT += dt;
    for (const s of this.sparkles) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 500 * dt; }
    this.sparkles = this.sparkles.filter((s) => s.t < s.life);
    if (this.phase === 'intro') {
      if (this.phaseT >= INTRO_TIME) this._beginStep();
    } else if (this.phase === 'leave') {
      if (this.phaseT >= LEAVE_TIME) {
        this.machineOn = null;
        const m = this._stepMachine(this.stepIndex);
        if (m) { this.phase = 'arrive'; this.phaseT = 0; this.ctx.audio.play('engine/' + m.id); } else this._startWork();
      }
    } else if (this.phase === 'arrive') {
      if (this.phaseT >= ARRIVE_TIME) this._startWork();
    } else if (this.phase === 'work') {
      this.action.update(dt);
      if (this.action.done) { this._repeatDone(); return; }
      if (this.hint.update(dt)) {
        const k = this.action.kind;
        const extra = k === 'drag' ? 'build-hint-drag' : k === 'trace' ? 'build-hint-trace' : k === 'hold' ? 'build-hint-hold' : 'build-hint';
        this.ctx.audio.say(this.voiceHints % 2 === 0 ? (this.step.phrase || extra) : extra, {}, { priority: 'high' });
        this.voiceHints++;
      }
    } else if (this.phase === 'step-done') {
      if (this.phaseT >= STEP_DONE_TIME) this._afterStep();
    } else if (this.phase === 'finale') {
      if (this.ctx.random() < 0.5) this._confetti();
      for (const c of this.confetti) { c.t += dt; c.y += c.vy * dt; c.x += Math.sin(c.t * 4 + c.p) * 30 * dt; }
      this.confetti = this.confetti.filter((c) => c.y < 780);
      if ((this.phaseT >= FINALE_MIN && this.voiceDone) || this.phaseT >= FINALE_MAX) {
        this.phase = 'finished';
        this.ctx.scenes.finish({ done: true, object: this.objectId });
      }
    }
  }

  _confetti() {
    const r = this.ctx.random;
    this.confetti.push({ x: 120 + r() * 880, y: 100, vy: 120 + r() * 120, t: 0, p: r() * 6, c: Math.floor(r() * 4) });
  }

  // ---------- рисование ----------

  _drawMachine(g, m, r, pose, mirror) {
    if (!m) return;
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.beginPath(); g.ellipse(r.x + r.w / 2, GROUND + 4, r.w / 2, 10, 0, 0, Math.PI * 2); g.fill();
    const img = this.ctx.assets.image('machine/' + m.id + '/whole/' + (pose === 'work' ? 'work' : 'idle'));
    if (mirror) {
      g.save();
      g.translate(Math.round(r.x + r.w), Math.round(r.y));
      g.scale(-1, 1);
      g.drawImage(img, 0, 0, r.w, r.h);
      g.restore();
    } else {
      g.drawImage(img, Math.round(r.x), Math.round(r.y), r.w, r.h);
    }
  }

  // Сколько слоёв видно: целиком — пройденные шаги; текущий — частично, по сделанным повторам.
  _drawLayers(g) {
    if (!this.steps) return;
    const a = this.ctx.assets;
    const o = OBJECT_ORIGIN;
    const full = this.phase === 'finale' || this.phase === 'finished' ? this.steps.length : this.stepIndex;
    for (let i = 0; i < full && i < this.steps.length; i++) {
      const s = this.steps[i];
      if (!s.layer) continue;
      let alpha = 1;
      if (this.phase === 'step-done' && i === this.stepIndex - 1) alpha = 0.6 + 0.4 * easeOut(this.phaseT / 0.4);
      g.globalAlpha = alpha;
      g.drawImage(a.image(layerId(this.objectId, s.layer)), o.x, o.y, LAYER.w, LAYER.h);
    }
    g.globalAlpha = 1;
    if (this.phase === 'work' && this.action && this.step && this.step.layer) {
      const n = this._repeats(this.stepIndex);
      const k = clamp((this.repeat + this.action.fraction()) / n, 0, 1);
      if (k > 0) {
        g.globalAlpha = 0.85 * k;
        g.drawImage(a.image(layerId(this.objectId, this.step.layer)), o.x, o.y, LAYER.w, LAYER.h);
        g.globalAlpha = 1;
      }
    }
  }

  draw(g) {
    const a = this.ctx.assets;
    g.drawImage(a.image('bg/build'), 0, 0, 1024, 768);
    if (this.phase === 'broken') return;
    this._drawLayers(g);
    if (this.phase === 'arrive' || this.phase === 'leave' || this.phase === 'intro' || this.phase === 'step-done') {
      // машина подъезжает слева или уезжает влево
      let m = this.machineOn;
      let mirror = this.mirrorOn;
      if (this.phase === 'arrive') { m = this._stepMachine(this.stepIndex); mirror = facesBack(this.step.action, m); }
      if (m) {
        const r = machineHome(m);
        let dx = 0;
        const far = -(r.x + r.w + 30);
        if (this.phase === 'arrive') dx = far * (1 - easeOut(this.phaseT / ARRIVE_TIME));
        if (this.phase === 'leave') dx = far * easeInOut(this.phaseT / LEAVE_TIME);
        this._drawMachine(g, m, { x: r.x + dx, y: r.y, w: r.w, h: r.h }, 'idle', mirror);
      }
    } else if (this.phase === 'work' && this.action) {
      this.action.draw(g);
    } else if ((this.phase === 'finale' || this.phase === 'finished') && this.unlocked) {
      // новая машина приезжает посмотреть на постройку
      const md = (this.ctx.data.machines || []).find((x) => x.id === this.unlocked);
      if (md) {
        const r = machineHome(md);
        const dx = -(r.x + r.w + 30) * (1 - easeOut(Math.min(1, this.phaseT / 1.5)));
        this._drawMachine(g, md, { x: r.x + dx, y: r.y, w: r.w, h: r.h }, 'idle');
      }
    }
    this._drawSparkles(g);
    if (this.phase === 'finale' || this.phase === 'finished') this._drawConfetti(g);
    const tg = this.target;
    if (tg && this.hint.showHand()) {
      let x2 = tg.x, y2 = tg.y;
      if (tg.kind === 'drag') { x2 = tg.to.x; y2 = tg.to.y; }
      if (tg.kind === 'trace') { const e = tg.path[tg.path.length - 1]; x2 = e.x; y2 = e.y; }
      drawHand(g, a, tg.x, tg.y, x2, y2, this.hint.handPhase());
    }
  }

  _drawSparkles(g) {
    const colors = ['#fff3a0', '#ffd34d', '#ffffff'];
    for (const s of this.sparkles) {
      g.globalAlpha = clamp(1 - s.t / s.life, 0, 1);
      g.fillStyle = colors[s.c];
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2, rr = i % 2 ? 4 : 11;
        g.lineTo(s.x + Math.cos(ang) * rr, s.y + Math.sin(ang) * rr);
      }
      g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
  }

  _drawConfetti(g) {
    const colors = ['#e8574a', '#ffd34d', '#3b7dd8', '#2fa84f'];
    for (const c of this.confetti) {
      g.fillStyle = colors[c.c];
      g.fillRect(c.x - 7, c.y - 4, 14, 8);
    }
  }
}
