// 2. Забор — 7 шагов, открывает бульдозер.
import { makeObject } from './make.js';

export default makeObject('zabor', 2, 'buldozer', [
  ['buldozer', 'level', 1, 'polosa'], // ровняет полосу под забор
  ['ekskavator', 'dig', 4, 'yamki'], // ямки под столбы
  ['traktor', 'haul-in', 1, 'material'], // привозит столбы и доски
  [null, 'place', 4, 'stolby'], // столбы ставятся в ямки
  ['betonomeshalka', 'pour', 4, 'beton'], // заливает столбы бетоном
  [null, 'place', 5, 'doski'], // доски прибиваются к столбам (в spec.md 6, но контракт — повторы 1–5)
  [null, 'paint', 1, 'kraska'], // забор красится
]);
