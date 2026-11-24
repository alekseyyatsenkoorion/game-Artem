// Закрытый список действий стройки (contracts.md, раздел 8). Новое действие — только через оркестратора.
import { LevelAction } from './level.js';
import { DigAction } from './dig.js';
import { HaulAwayAction } from './haul-away.js';
import { HaulInAction } from './haul-in.js';
import { SpreadAction } from './spread.js';
import { RollAction } from './roll.js';
import { PourAction } from './pour.js';
import { LiftAction } from './lift.js';
import { PlaceAction } from './place.js';
import { StackAction } from './stack.js';
import { PaintAction } from './paint.js';
import { LineAction } from './line.js';

export const ACTIONS = {
  level: LevelAction,
  dig: DigAction,
  'haul-away': HaulAwayAction,
  'haul-in': HaulInAction,
  spread: SpreadAction,
  roll: RollAction,
  pour: PourAction,
  lift: LiftAction,
  place: PlaceAction,
  stack: StackAction,
  paint: PaintAction,
  line: LineAction,
};

// Машина работает задом (кузов, барабан, прицеп сзади): для подвоза, вывоза и бетона она стоит
// к объекту задом, как на настоящей стройке. Решается по данным машины (workPart), без имён машин.
const BACK_ACTIONS = ['pour', 'haul-in', 'haul-away'];
export function facesBack(action, machine) {
  if (!machine || !BACK_ACTIONS.includes(action)) return false;
  const p = (machine.parts || []).find((q) => q.id === machine.workPart);
  return !!(p && machine.size && p.x + p.w / 2 < machine.size.w / 2);
}

export function makeAction(name, env) {
  const Cls = ACTIONS[name];
  return Cls ? new Cls(env) : null;
}
