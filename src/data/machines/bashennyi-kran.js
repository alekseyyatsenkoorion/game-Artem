// Башенный кран — машина №10: решётчатая башня, длинная стрела, крюк и противовес.
export default {
  id: 'bashennyi-kran',
  order: 10,
  namePhrase: 'machine-bashennyi-kran',
  nameAccPhrase: 'machine-bashennyi-kran-acc',
  size: { w: 620, h: 390 },
  // x, y — левый верхний угол детали на собранной машине; z — порядок слоёв.
  parts: [
    { id: 'osnova', namePhrase: 'part-osnova', x: 90, y: 340, w: 180, h: 50, z: 1 },
    { id: 'bashnya', namePhrase: 'part-bashnya', x: 150, y: 230, w: 60, h: 110, z: 2 },
    { id: 'sekciya-bashni', namePhrase: 'part-sekciya-bashni', x: 150, y: 120, w: 60, h: 110, z: 2 },
    { id: 'verhushka', namePhrase: 'part-verhushka', x: 150, y: 0, w: 60, h: 120, z: 2 },
    { id: 'kabina', namePhrase: 'part-kabina', x: 210, y: 90, w: 70, h: 70, z: 3 },
    { id: 'strela', namePhrase: 'part-strela', x: 210, y: 50, w: 200, h: 40, z: 3 },
    { id: 'sekciya-strely', namePhrase: 'part-sekciya-strely', x: 410, y: 50, w: 210, h: 40, z: 3 },
    { id: 'kontrstrela', namePhrase: 'part-kontrstrela', x: 20, y: 50, w: 130, h: 40, z: 3 },
    { id: 'protivoves', namePhrase: 'part-protivoves', x: 20, y: 90, w: 80, h: 90, z: 2 },
    { id: 'kryuk', namePhrase: 'part-kryuk', x: 470, y: 90, w: 80, h: 160, z: 1 },
  ],
  workPart: 'kryuk',
  wheels: [],
  fuelPoint: { x: 180, y: 360 },
  tug: 'hard',
  // Факты проверены и утверждены Alex 24.11.2026.
  facts: ['fact-bashennyi-kran-1', 'fact-bashennyi-kran-2', 'fact-bashennyi-kran-3', 'fact-bashennyi-kran-4', 'fact-bashennyi-kran-5'],
  factWithPicture: 'fact-bashennyi-kran-1',
  puzzles: {
    16: { facing: 'left', scene: 'nature' },
    25: { facing: 'right', scene: 'stroika' },
    36: { facing: 'left', scene: 'postroika', object: 'dom-mnogo' }, // рядом с готовой постройкой
  },
  sounds: {
    engine: { base: 80 },
    horn: { notes: [523, 659] },
  },
};
