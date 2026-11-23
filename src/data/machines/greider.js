// Грейдер — машина №9: длинная рама, нож под ней, кабина сзади.
export default {
  id: 'greider',
  order: 9,
  namePhrase: 'machine-greider',
  nameAccPhrase: 'machine-greider-acc',
  size: { w: 620, h: 330 },
  // x, y — левый верхний угол детали на собранной машине; z — порядок слоёв.
  parts: [
    { id: 'koleso-zadnee', namePhrase: 'part-koleso-zadnee', x: 20, y: 220, w: 220, h: 110, z: 2 },
    { id: 'koleso-perednee', namePhrase: 'part-koleso-perednee', x: 500, y: 220, w: 110, h: 110, z: 2 },
    { id: 'motor', namePhrase: 'part-motor', x: 10, y: 120, w: 130, h: 100, z: 2 },
    { id: 'kabina', namePhrase: 'part-kabina', x: 140, y: 50, w: 130, h: 170, z: 2 },
    { id: 'mayachok', namePhrase: 'part-mayachok', x: 170, y: 0, w: 70, h: 50, z: 1 },
    { id: 'truba', namePhrase: 'part-truba', x: 40, y: 50, w: 50, h: 70, z: 1 },
    { id: 'rama', namePhrase: 'part-rama', x: 270, y: 90, w: 340, h: 130, z: 1 },
    { id: 'fara', namePhrase: 'part-fara', x: 560, y: 40, w: 60, h: 50, z: 1 },
    { id: 'nozh', namePhrase: 'part-nozh', x: 290, y: 220, w: 200, h: 90, z: 3 },
  ],
  workPart: 'nozh',
  wheels: ['koleso-zadnee', 'koleso-perednee'],
  fuelPoint: { x: 120, y: 200 },
  tug: 'hard',
  // Черновик: проверенные факты готовятся на этапе 3 и показываются Alex до озвучки.
  facts: ['fact-greider-1', 'fact-greider-2', 'fact-greider-3', 'fact-greider-4'],
  factWithPicture: 'fact-greider-1',
  puzzles: {
    16: { facing: 'left', scene: 'nature' },
    25: { facing: 'right', scene: 'stroika' },
  },
  sounds: {
    engine: { base: 72 },
    horn: { notes: [415, 554] },
  },
};
