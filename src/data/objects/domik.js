// 3. Маленький домик — 9 шагов, открывает каток.
import { makeObject } from './make.js';

export default makeObject('domik', 3, 'katok', [
  ['buldozer', 'level', 1, 'ploshchadka'],
  ['ekskavator', 'dig', 3, 'kotlovan'],
  ['samosval', 'haul-away', 1, 'kotlovan-chisto'],
  [null, 'place', 4, 'opalubka'], // рамка из досок под бетон
  ['betonomeshalka', 'pour', 1, 'fundament'],
  ['traktor', 'haul-in', 1, 'kirpichi'],
  [null, 'stack', 3, 'steny'], // 3 ряда
  ['avtokran', 'lift', 1, 'krysha'],
  [null, 'paint', 1, 'okna-kraska'], // окна, дверь, покраска
]);
