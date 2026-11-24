// place — перетащить предмет на подсвеченное место (без машины): столбы, доски, опалубка, окна, деревья.
import { DragAction } from './common.js';

export class PlaceAction extends DragAction {
  source() {
    const r = this.homeRect();
    if (r) return { x: Math.round(r.x + r.w / 2), y: Math.round(r.y - 50) };
    return { x: 220, y: 548 };
  }
}
