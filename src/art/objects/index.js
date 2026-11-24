// Слои всех объектов стройки: 'object/<объект>/layer/<слой>' → {w: 600, h: 440, draw}.
import { art as pesochnitsa } from './pesochnitsa.js';
import { art as zabor } from './zabor.js';
import { art as domik } from './domik.js';
import { art as garazh } from './garazh.js';
import { art as doroga } from './doroga.js';
import { art as ploshchadka } from './ploshchadka.js';
import { art as most } from './most.js';
import { art as dom2 } from './dom-2.js';
import { art as parking } from './parking.js';
import { art as domMnogo } from './dom-mnogo.js';

export const art = Object.assign({}, pesochnitsa, zabor, domik, garazh, doroga, ploshchadka, most, dom2, parking, domMnogo);
export default art;
