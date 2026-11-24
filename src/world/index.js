// Сцены зоны «Карта и стройка»: главный экран, гараж, экран для взрослых, «Машины спят».
import { HomeScene } from './home.js';
import { GarageScene } from './garage.js';
import { ParentScene } from './parent.js';
import { LockedScene } from './locked.js';

export const scenes = [HomeScene, GarageScene, ParentScene, LockedScene];
