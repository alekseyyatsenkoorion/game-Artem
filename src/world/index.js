// Сцены зоны «Карта и стройка»: главный экран, гараж, карта-дорожка, стройка, экран для взрослых, «Машины спят».
import { HomeScene } from './home.js';
import { GarageScene } from './garage.js';
import { MapScene } from './map.js';
import { BuildScene } from './build.js';
import { ParentScene } from './parent.js';
import { LockedScene } from './locked.js';

export const scenes = [HomeScene, GarageScene, MapScene, BuildScene, ParentScene, LockedScene];
