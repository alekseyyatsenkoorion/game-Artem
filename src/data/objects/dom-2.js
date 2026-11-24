// 8. Двухэтажный дом — 13 шагов, открывает грейдер.
import { makeObject } from './make.js';

export default makeObject('dom-2', 8, 'greider', [
  ['buldozer', 'level', 1, 'ploshchadka'],
  ['ekskavator', 'dig', 4, 'kotlovan'],
  ['samosval', 'haul-away', 2, 'kotlovan-chisto'],
  ['pogruzchik', 'spread', 2, 'shcheben'], // привозит и разравнивает щебень
  [null, 'place', 1, 'opalubka'],
  [null, 'place', 1, 'armatura'], // железная сетка
  ['betonomeshalka', 'pour', 2, 'fundament'],
  [null, 'stack', 3, 'etazh-1'],
  ['avtokran', 'lift', 2, 'perekrytie'],
  [null, 'stack', 3, 'etazh-2'],
  ['avtokran', 'lift', 1, 'krysha'],
  [null, 'place', 1, 'okna-dveri'],
  [null, 'paint', 1, 'kraska-kryltso'], // покраска и крыльцо
]);
