// Input — касания (contracts.md, раздел 7).
// Сцене передаётся только первый палец в логических координатах.
// Ядро распознаёт родительский жест: два пальца в двух верхних углах 3 секунды.

export const PARENT_HOLD = 3;           // секунды
export const CORNER = 140;              // размер угловой зоны жеста, логические пиксели
const PALM_SIZE = 70;                   // касание шире — это ладонь, CSS-пиксели
const EDGE = 40;                        // «положенная на край» рука, CSS-пиксели
const STILL = 14;                       // сдвиг меньше — палец стоит на месте

export class Input {
  // toLogical(clientX, clientY) → {x, y}; send(e) — касание для SceneManager;
  // onParentGesture() — открыть экран для взрослых; onFirstTouch() — включить звук.
  constructor({ toLogical, send, onParentGesture = () => {}, onFirstTouch = () => {}, viewport = () => ({ w: 1024, h: 768 }) }) {
    this.toLogical = toLogical;
    this.send = send;
    this.onParentGesture = onParentGesture;
    this.onFirstTouch = onFirstTouch;
    this.viewport = viewport;
    this.pointers = new Map(); // id → {x, y, sx, sy, cx, cy, edge}
    this.primary = null;
    this.gestureTime = 0;
    this.gestureFired = false;
    this.disposers = [];
  }

  // Подключение к настоящему холсту и документу.
  attach(canvas, doc, win) {
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this.disposers.push(() => target.removeEventListener(type, fn, opts));
    };
    const pe = (type) => (ev) => {
      ev.preventDefault();
      if (type === 'down') { try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ничего */ } }
      this.handle(type, ev.pointerId, ev.clientX, ev.clientY, Math.max(ev.width || 0, ev.height || 0));
    };
    on(canvas, 'pointerdown', pe('down'));
    on(canvas, 'pointermove', pe('move'));
    on(canvas, 'pointerup', pe('up'));
    on(canvas, 'pointercancel', pe('cancel'));
    // iOS: звук включается только в обработчике касания
    on(doc, 'touchend', () => this.onFirstTouch(), { passive: true });
    on(doc, 'touchstart', () => this.onFirstTouch(), { passive: true });
    // запрет увеличения, прокрутки, выделения и меню
    const stop = (ev) => { ev.preventDefault(); };
    on(doc, 'touchmove', stop, { passive: false });
    on(doc, 'gesturestart', stop, { passive: false });
    on(doc, 'gesturechange', stop, { passive: false });
    on(doc, 'gestureend', stop, { passive: false });
    on(doc, 'contextmenu', stop);
    on(doc, 'selectstart', stop);
    on(doc, 'dblclick', stop, { passive: false });
    on(win, 'blur', () => this.cancelAll());
  }

  detach() { for (const d of this.disposers.splice(0)) d(); }

  _isEdge(cx, cy) {
    const v = this.viewport();
    return cx < EDGE || cx > v.w - EDGE || cy > v.h - EDGE;
  }

  handle(type, id, cx, cy, size = 0) {
    if (type === 'down') this.onFirstTouch();
    const p = this.toLogical(cx, cy);
    if (type === 'down') {
      if (size > PALM_SIZE) return; // ладонь — не слушаем совсем
      const rec = { x: p.x, y: p.y, sx: p.x, sy: p.y, cx, cy, scx: cx, scy: cy, edge: this._isEdge(cx, cy) };
      this.pointers.set(id, rec);
      if (this.primary === null) {
        this.primary = id;
        this.send({ type: 'down', x: p.x, y: p.y });
      } else {
        // Первым лёг край ладони и стоит на месте — слушаем новый палец.
        const old = this.pointers.get(this.primary);
        if (old && old.edge && Math.hypot(old.cx - old.scx, old.cy - old.scy) < STILL) {
          this.send({ type: 'cancel', x: old.x, y: old.y });
          this.primary = id;
          this.send({ type: 'down', x: p.x, y: p.y });
        }
      }
      this._checkGesture();
      return;
    }
    const rec = this.pointers.get(id);
    if (!rec) return;
    rec.x = p.x; rec.y = p.y; rec.cx = cx; rec.cy = cy;
    if (type === 'move') {
      if (id === this.primary && !this.gestureActive()) this.send({ type: 'move', x: p.x, y: p.y });
      this._checkGesture();
      return;
    }
    // up / cancel
    this.pointers.delete(id);
    if (id === this.primary) {
      this.primary = null;
      this.send({ type: this.gestureFired ? 'cancel' : type, x: p.x, y: p.y });
    }
    this._checkGesture();
    if (this.pointers.size === 0) this.gestureFired = false;
  }

  cancelAll() {
    if (this.primary !== null) {
      const rec = this.pointers.get(this.primary);
      this.send({ type: 'cancel', x: rec ? rec.x : 0, y: rec ? rec.y : 0 });
    }
    this.pointers.clear();
    this.primary = null;
    this.gestureTime = 0;
  }

  // Два пальца: один в левом верхнем углу, другой в правом верхнем.
  gestureActive() {
    let left = false, right = false;
    for (const r of this.pointers.values()) {
      if (r.y < CORNER && r.x < CORNER) left = true;
      if (r.y < CORNER && r.x > 1024 - CORNER) right = true;
    }
    return left && right;
  }

  _checkGesture() {
    const active = this.gestureActive();
    if (active && this.primary !== null && !this.gestureFired) {
      // жест сцене не передаётся: снимаем начатое касание
      const rec = this.pointers.get(this.primary);
      this.send({ type: 'cancel', x: rec ? rec.x : 0, y: rec ? rec.y : 0 });
      this.primary = null;
    }
    if (!active) this.gestureTime = 0;
  }

  // Вызывает ядро каждый кадр (в том числе на паузе таймера), чтобы отсчитать удержание.
  tick(dt) {
    if (this.gestureActive() && !this.gestureFired) {
      this.gestureTime += dt;
      if (this.gestureTime >= PARENT_HOLD) {
        this.gestureFired = true;
        this.gestureTime = 0;
        this.onParentGesture();
      }
    } else if (!this.gestureActive()) {
      this.gestureTime = 0;
    }
  }

  gestureProgress() { return Math.min(1, this.gestureTime / PARENT_HOLD); }
}
