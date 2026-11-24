// 10. Многоквартирный дом — 18 шагов, финал (машину не открывает).
import { makeObject } from './make.js';

export default makeObject('dom-mnogo', 10, null, [
  ['buldozer', 'level', 1, 'ploshchadka'],
  ['ekskavator', 'dig', 5, 'kotlovan'],
  ['samosval', 'haul-away', 3, 'kotlovan-chisto'],
  ['avtokran', 'lift', 3, 'bashennyi-kran'], // автокран собирает башенный кран
  ['samosval', 'haul-in', 2, 'pesok-shcheben'],
  ['katok', 'roll', 1, 'osnovanie'],
  [null, 'place', 1, 'opalubka'],
  [null, 'place', 1, 'armatura'],
  ['betonomeshalka', 'pour', 3, 'fundament'],
  ['bashennyi-kran', 'lift', 4, 'etazh-1'],
  ['bashennyi-kran', 'lift', 2, 'perekrytie'],
  ['bashennyi-kran', 'lift', 4, 'etazh-2'],
  ['bashennyi-kran', 'lift', 4, 'etazh-3'],
  ['bashennyi-kran', 'lift', 4, 'etazh-4'],
  ['bashennyi-kran', 'lift', 1, 'krysha'],
  [null, 'place', 1, 'okna-balkony'],
  ['greider', 'level', 1, 'doroga-dvor'], // грейдер и каток делают дорогу во дворе
  [null, 'place', 1, 'derevya-fonari'], // деревья, фонари; салют — в сцене
]);
