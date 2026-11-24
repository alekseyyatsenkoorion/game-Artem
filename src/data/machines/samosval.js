// Самосвал — машина №1 (spec.md, раздел 3). Заготовка этапа 1; на этапе 2 переходит зоне «Контент».
export default {
  id: 'samosval',
  order: 1,
  namePhrase: 'machine-samosval',
  nameAccPhrase: 'machine-samosval-acc', // «собери самосвал»
  size: { w: 560, h: 330 },
  // x, y — левый верхний угол детали на собранной машине; z — порядок слоёв.
  parts: [
    { id: 'rama', namePhrase: 'part-rama', x: 20, y: 190, w: 520, h: 38, z: 1 },
    { id: 'koleso-zadnee', namePhrase: 'part-koleso-zadnee', x: 50, y: 228, w: 210, h: 102, z: 2 },
    { id: 'koleso-perednee', namePhrase: 'part-koleso-perednee', x: 395, y: 228, w: 100, h: 102, z: 2 },
    { id: 'kuzov', namePhrase: 'part-kuzov', x: 10, y: 40, w: 330, h: 150, z: 3 },
    { id: 'kabina', namePhrase: 'part-kabina', x: 350, y: 20, w: 190, h: 170, z: 3 },
  ],
  workPart: 'kuzov',
  wheels: ['koleso-zadnee', 'koleso-perednee'],
  fuelPoint: { x: 330, y: 205 },
  tug: 'easy',
  // Факты проверены и утверждены Alex 24.11.2026.
  facts: ['fact-samosval-1', 'fact-samosval-2', 'fact-samosval-3', 'fact-samosval-4'],
  factWithPicture: 'fact-samosval-1',
  puzzles: {
    16: { facing: 'left', scene: 'nature' },
    25: { facing: 'right', scene: 'stroika' },
    36: { facing: 'left', scene: 'postroika', object: 'pesochnitsa' }, // рядом с готовой постройкой
  },
  // Звуки создаются кодом: частота мотора и ноты гудка.
  sounds: {
    engine: { base: 52 },
    horn: { notes: [392, 494] },
  },
};
