// 9. Паркинг — 14 шагов, открывает башенный кран.
import { makeObject } from './make.js';

export default makeObject('parking', 9, 'bashennyi-kran', [
  ['buldozer', 'level', 1, 'ploshchadka'],
  ['ekskavator', 'dig', 5, 'kotlovan'],
  ['samosval', 'haul-away', 3, 'kotlovan-chisto'],
  ['samosval', 'haul-in', 2, 'shcheben'],
  ['katok', 'roll', 1, 'osnovanie'],
  [null, 'place', 1, 'opalubka-armatura'],
  ['betonomeshalka', 'pour', 2, 'plita'],
  ['avtokran', 'lift', 4, 'kolonny'],
  ['avtokran', 'lift', 3, 'plity-2'], // плиты второго этажа
  ['betonomeshalka', 'pour', 1, 'pandus'], // наклонный въезд
  ['avtokran', 'lift', 3, 'krysha'],
  ['katok', 'roll', 1, 'asfalt-vezd'],
  [null, 'line', 1, 'razmetka'], // разметка мест
  [null, 'place', 1, 'shlagbaum-fonari'],
]);
