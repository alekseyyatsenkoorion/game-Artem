// 7. Мост — 12 шагов, открывает автокран. Речка — часть первого слоя.
import { makeObject } from './make.js';

export default makeObject('most', 7, 'avtokran', [
  ['buldozer', 'level', 1, 'berega'], // подъезды на двух берегах
  ['ekskavator', 'dig', 4, 'yamy'], // ямы под опоры
  ['samosval', 'haul-away', 2, 'yamy-chisto'],
  [null, 'place', 1, 'opalubka'], // опалубка опор
  ['betonomeshalka', 'pour', 2, 'opory'],
  ['avtokran', 'lift', 3, 'balki'],
  ['avtokran', 'lift', 4, 'plity'],
  ['betonomeshalka', 'pour', 1, 'polotno'],
  ['samosval', 'haul-in', 1, 'asfalt-kucha'],
  ['katok', 'roll', 1, 'asfalt'],
  [null, 'stack', 4, 'perila'], // 4 секции перил
  [null, 'line', 1, 'razmetka-fonari'], // разметка и фонари
]);
