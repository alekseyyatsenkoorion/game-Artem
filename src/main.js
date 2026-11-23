// Точка входа: подключает ядро и списки сцен трёх зон. Пишется один раз на этапе 1.
import { Game } from './core/game.js';
import { scenes as gameScenes } from './games/index.js';
import { scenes as worldScenes } from './world/index.js';
import data from './data/index.js';
import art from './art/index.js';

const canvas = document.getElementById('game');
const game = new Game({ canvas, scenes: [...gameScenes, ...worldScenes], data, art });
// Для автоматических тестов (Playwright): доступ к модулям игры.
window.__stroika = game;
game.boot().catch((e) => console.error('[main]', e));
