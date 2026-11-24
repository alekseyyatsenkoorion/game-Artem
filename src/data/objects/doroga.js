// 5. Дорога — 11 шагов, открывает экскаватор.
import { makeObject } from './make.js';

export default makeObject('doroga', 5, 'ekskavator', [
  ['buldozer', 'level', 1, 'bez-travy'], // снимает траву
  ['ekskavator', 'dig', 4, 'lozhe'], // ложе дороги
  ['samosval', 'haul-away', 2, 'lozhe-chisto'],
  ['samosval', 'haul-in', 1, 'pesok-kucha'],
  ['greider', 'level', 1, 'pesok'],
  ['samosval', 'haul-in', 1, 'shcheben-kucha'],
  ['greider', 'level', 1, 'shcheben'],
  ['katok', 'roll', 1, 'osnovanie'],
  ['samosval', 'haul-in', 1, 'asfalt-kucha'],
  ['katok', 'roll', 1, 'asfalt'],
  [null, 'line', 1, 'razmetka'],
]);
