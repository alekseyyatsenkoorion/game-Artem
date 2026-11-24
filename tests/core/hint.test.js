// Подсказки только после 30 с без действий (просьба Alex 24.11): рука и голос, дальше раз в 30 с.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdleHint } from '../../src/core/ui.js';

test('подсказки: ничего до 30 с простоя, потом рука и голос, повтор раз в 30 с; касание сбрасывает', () => {
  const h = new IdleHint();
  let voices = 0;
  for (let t = 0; t < 29.9; t += 0.1) if (h.update(0.1)) voices++;
  assert.equal(h.showHand(), false);
  assert.equal(voices, 0);
  for (let t = 0; t < 0.3; t += 0.1) if (h.update(0.1)) voices++;
  assert.equal(h.showHand(), true);
  assert.equal(voices, 1);
  for (let t = 0; t < 30; t += 0.1) if (h.update(0.1)) voices++;
  assert.equal(voices, 2);
  h.reset();
  assert.equal(h.showHand(), false);
  for (let t = 0; t < 20; t += 0.1) h.update(0.1);
  assert.equal(h.showHand(), false);
});
