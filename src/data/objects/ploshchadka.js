// 6. Детская площадка — 11 шагов, открывает погрузчик.
import { makeObject } from './make.js';

export default makeObject('ploshchadka', 6, 'pogruzchik', [
  ['buldozer', 'level', 1, 'ploshchadka'],
  ['ekskavator', 'dig', 4, 'yamki'], // ямки под опоры
  ['betonomeshalka', 'pour', 4, 'opory'],
  ['avtokran', 'lift', 1, 'gorka'],
  ['avtokran', 'lift', 1, 'kacheli'],
  ['traktor', 'haul-in', 4, 'pesochnitsa'], // доски, собирается песочница
  ['samosval', 'haul-in', 1, 'pesok'],
  ['pogruzchik', 'spread', 2, 'pokrytie'], // мягкое покрытие
  [null, 'place', 2, 'skameiki'],
  [null, 'place', 3, 'derevya'],
  [null, 'paint', 1, 'kraska'],
]);
