// Сборка описания объекта стройки (contracts.md, раздел 8).
// Шаг задаётся коротко: [machine, action, repeats, layer]; фраза шага — 'step-<объект>-<n>' (n с 1).
export function makeObject(id, order, unlocks, steps) {
  return {
    id,
    order,
    namePhrase: 'object-' + id,
    nameAccPhrase: 'object-' + id + '-acc',
    unlocks,
    steps: steps.map(([machine, action, repeats, layer], i) => ({
      machine, action, repeats, phrase: 'step-' + id + '-' + (i + 1), layer,
    })),
  };
}
