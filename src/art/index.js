// Список картинок зоны «Контент»: «id → {w, h, draw}». Ядро рисует каждую один раз.
import { machines } from './machines/index.js';
import { art as puzzles } from './puzzles/index.js';
import { art as backgrounds } from './backgrounds.js';
import { art as objects } from './objects/index.js';

const machineArt = {};
for (const id of Object.keys(machines)) Object.assign(machineArt, machines[id].art);

export const art = Object.assign({}, machineArt, puzzles, backgrounds, objects);

export default art;
