// Список картинок зоны «Контент»: «id → {w, h, draw}». Ядро рисует каждую один раз.
import { art as samosval } from './machines/samosval.js';
import { art as backgrounds } from './backgrounds.js';

export const art = Object.assign({}, samosval, backgrounds);

export default art;
