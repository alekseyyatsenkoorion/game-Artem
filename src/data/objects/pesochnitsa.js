// 1. Песочница — 5 шагов, открывает трактор.
import { makeObject } from './make.js';

export default makeObject('pesochnitsa', 1, 'traktor', [
  ['buldozer', 'level', 1, 'ploshchadka'], // бульдозер ровняет площадку
  ['ekskavator', 'dig', 2, 'yama'], // экскаватор копает неглубокую яму
  ['traktor', 'haul-in', 4, 'bortiki'], // трактор привозит доски, собираются бортики
  ['samosval', 'haul-in', 2, 'pesok-kucha'], // самосвал высыпает песок
  ['buldozer', 'spread', 1, 'pesok'], // бульдозер разравнивает песок
]);
