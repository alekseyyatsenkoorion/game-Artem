// Экран для взрослых (spec.md, раздел 5 «Родительский таймер»). Единственное место с надписями.
// Открывается жестом: два пальца в верхних углах 3 секунды.
import { Scene } from '../core/scene.js';
import { roundRect } from '../core/draw-utils.js';
import { VERSION } from '../core/version.js';

const FONT = '-apple-system, "Helvetica Neue", Arial, sans-serif';
const CONFIRM_TIME = 4;
const TOAST_TIME = 2.5;

function fmt(sec) {
  if (!isFinite(sec)) return '';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

export class ParentScene extends Scene {
  static id = 'parent';

  enter() {
    // Открыть экран может только взрослый — значит, блокировку можно снять.
    if (this.ctx.timer.isLocked()) this.ctx.timer.unlock();
    this.pressed = null;
    this.confirmReset = 0;
    this.toast = '';
    this.toastT = 0;
    const y1 = 210, y2 = 330, y3 = 440, y4 = 550;
    this.buttons = [
      { id: 'min-15', x: 120, y: y1, w: 180, h: 80, label: '15 минут' },
      { id: 'min-30', x: 320, y: y1, w: 180, h: 80, label: '30 минут' },
      { id: 'min-45', x: 520, y: y1, w: 180, h: 80, label: '45 минут' },
      { id: 'min-0', x: 720, y: y1, w: 184, h: 80, label: 'Выключен' },
      { id: 'test', x: 120, y: y2, w: 784, h: 80, label: 'Проверка таймера: машины уснут через 1 минуту' },
      { id: 'unlock-all', x: 120, y: y3, w: 384, h: 80, label: 'Открыть все машины' },
      { id: 'reset', x: 520, y: y3, w: 384, h: 80, label: 'Сбросить прогресс' },
      { id: 'close', x: 120, y: y4, w: 784, h: 80, label: 'Вернуться в игру' },
    ];
  }

  _button(x, y) {
    return this.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  }

  _say(text) { this.toast = text; this.toastT = TOAST_TIME; }

  press(id) {
    const { timer, progress, scenes } = this.ctx;
    if (id.startsWith('min-')) {
      const n = Number(id.slice(4));
      timer.setMinutes(n);
      progress.setSetting('timerMinutes', n);
      this._say(n ? 'Таймер: ' + n + ' минут, отсчёт начат заново' : 'Таймер выключен');
    } else if (id === 'test') {
      timer.testRun();
      scenes.back(); // сразу в игру: через минуту машины уснут
    } else if (id === 'unlock-all') {
      progress.unlockAll();
      this._say('Все машины открыты');
    } else if (id === 'reset') {
      if (this.confirmReset > 0) {
        progress.reset();
        this.confirmReset = 0;
        this._say('Прогресс сброшен, настройки сохранены');
      } else {
        this.confirmReset = CONFIRM_TIME;
      }
    } else if (id === 'close') {
      scenes.back();
    }
  }

  onPointer(e) {
    if (e.type === 'down') this.pressed = this._button(e.x, e.y);
    else if (e.type === 'up') {
      const b = this._button(e.x, e.y);
      const was = this.pressed;
      this.pressed = null;
      if (b && was && b.id === was.id) this.press(b.id);
    } else if (e.type === 'cancel') this.pressed = null;
  }

  update(dt) {
    if (this.confirmReset > 0) this.confirmReset = Math.max(0, this.confirmReset - dt);
    if (this.toastT > 0) this.toastT = Math.max(0, this.toastT - dt);
  }

  draw(g) {
    const { timer, audio } = this.ctx;
    g.fillStyle = '#f2f4f7';
    g.fillRect(0, 0, 1024, 768);
    g.textBaseline = 'middle';
    g.fillStyle = '#1d2733';
    g.font = 'bold 40px ' + FONT;
    g.textAlign = 'left';
    g.fillText('Для взрослых', 120, 60);

    g.font = '26px ' + FONT;
    g.fillStyle = '#44505e';
    let status;
    if (timer.isTestRun()) status = 'Идёт проверка таймера: осталось ' + fmt(timer.remaining());
    else if (timer.minutes() === 0) status = 'Таймер выключен';
    else status = 'Таймер игры. Осталось ' + fmt(timer.remaining());
    g.fillText(status, 120, 160);

    const current = 'min-' + timer.minutes();
    for (const b of this.buttons) {
      const selected = b.id === current && !timer.isTestRun();
      const isReset = b.id === 'reset' && this.confirmReset > 0;
      g.fillStyle = isReset ? '#d93a2b' : selected ? '#2f7de1' : (this.pressed && this.pressed.id === b.id) ? '#c9d3df' : '#ffffff';
      roundRect(g, b.x, b.y, b.w, b.h, 16); g.fill();
      g.strokeStyle = selected ? '#2f7de1' : '#c3ccd8'; g.lineWidth = 3; g.stroke();
      g.fillStyle = selected || isReset ? '#ffffff' : '#1d2733';
      g.font = (b.w < 200 ? '28px ' : '28px ') + FONT;
      g.textAlign = 'center';
      g.fillText(isReset ? 'Нажмите ещё раз, чтобы стереть' : b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    }

    g.textAlign = 'left';
    g.font = '22px ' + FONT;
    g.fillStyle = '#5d6977';
    g.fillText('Версия игры: ' + VERSION, 120, 676);
    g.fillText('Голос: ' + audio.voiceInfo(), 120, 710);
    g.fillText('Открыть этот экран: два пальца в верхних углах, 3 секунды.', 120, 744);

    if (this.toastT > 0) {
      g.globalAlpha = Math.min(1, this.toastT * 2);
      g.fillStyle = '#1d2733';
      roundRect(g, 262, 640, 500, 64, 32); g.fill();
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.font = '24px ' + FONT;
      g.fillText(this.toast, 512, 673);
      g.globalAlpha = 1;
    }
  }
}
