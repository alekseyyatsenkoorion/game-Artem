// Бетономешалка — машина №5: полосатый барабан крутится и мешает бетон.
export default {
  id: 'betonomeshalka',
  order: 5,
  namePhrase: 'machine-betonomeshalka',
  nameAccPhrase: 'machine-betonomeshalka-acc',
  size: { w: 610, h: 350 },
  // x, y — левый верхний угол детали на собранной машине; z — порядок слоёв.
  parts: [
    { id: 'rama', namePhrase: 'part-rama', x: 20, y: 214, w: 560, h: 36, z: 1 },
    { id: 'koleso-zadnee', namePhrase: 'part-koleso-zadnee', x: 50, y: 250, w: 210, h: 100, z: 2 },
    { id: 'koleso-perednee', namePhrase: 'part-koleso-perednee', x: 440, y: 250, w: 100, h: 100, z: 2 },
    { id: 'kabina', namePhrase: 'part-kabina', x: 420, y: 40, w: 180, h: 174, z: 3 },
    { id: 'baraban', namePhrase: 'part-baraban', x: 50, y: 30, w: 320, h: 184, z: 3 },
    { id: 'lotok', namePhrase: 'part-lotok', x: 0, y: 110, w: 50, h: 104, z: 2 },
    { id: 'bak-vody', namePhrase: 'part-bak-vody', x: 370, y: 90, w: 50, h: 124, z: 2 },
  ],
  workPart: 'baraban',
  wheels: ['koleso-zadnee', 'koleso-perednee'],
  fuelPoint: { x: 395, y: 232 },
  tug: 'medium',
  // Факты проверены и утверждены Alex 24.11.2026.
  facts: ['fact-betonomeshalka-1', 'fact-betonomeshalka-2', 'fact-betonomeshalka-3', 'fact-betonomeshalka-4', 'fact-betonomeshalka-5'],
  factWithPicture: 'fact-betonomeshalka-1',
  puzzles: {
    16: { facing: 'left', scene: 'nature' },
    25: { facing: 'right', scene: 'stroika' },
  },
  sounds: {
    engine: { base: 56 },
    horn: { notes: [349, 440] },
  },
};
