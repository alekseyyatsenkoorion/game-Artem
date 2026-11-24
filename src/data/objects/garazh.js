// 4. Гараж — 10 шагов, открывает бетономешалку.
import { makeObject } from './make.js';

export default makeObject('garazh', 4, 'betonomeshalka', [
  ['buldozer', 'level', 1, 'ploshchadka'],
  ['ekskavator', 'dig', 3, 'kotlovan'],
  ['samosval', 'haul-away', 2, 'kotlovan-chisto'],
  ['samosval', 'haul-in', 1, 'shcheben-kucha'],
  ['buldozer', 'spread', 1, 'shcheben'],
  [null, 'place', 4, 'opalubka'],
  ['betonomeshalka', 'pour', 1, 'pol'],
  ['avtokran', 'lift', 3, 'steny'],
  ['avtokran', 'lift', 1, 'krysha'],
  [null, 'paint', 1, 'vorota-kraska'], // ворота и покраска
]);
