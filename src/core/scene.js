// Общий класс сцены (contracts.md, раздел 1).
// Сцена не трогает DOM, хранилище и сеть: всё нужное приходит через ctx.

export class Scene {
  static id = 'scene';

  // Список id картинок, которые ядро загрузит до входа.
  static assets(params) { return []; }

  constructor(ctx) {
    this.ctx = ctx;
  }

  enter(params) {}
  update(dt) {}
  draw(g) {}
  onPointer(e) {}
  onResult(result) {}
  pause() {}
  resume() {}
  canExit() { return true; }
  exit() {}
}
