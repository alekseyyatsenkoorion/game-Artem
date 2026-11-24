// Автокран — машина №8: телескопическая стрела с крюком, опоры. В покое стрела лежит на машине; верх холста — место для поднятой стрелы в позе work.
export default {
  id: 'avtokran',
  order: 8,
  namePhrase: 'machine-avtokran',
  nameAccPhrase: 'machine-avtokran-acc',
  size: { w: 620, h: 390 },
  // x, y — левый верхний угол детали на собранной машине; z — порядок слоёв.
  parts: [
    { id: 'strela', namePhrase: 'part-strela', x: 150, y: 130, w: 460, h: 50, z: 4 },
    { id: 'kabina-krana', namePhrase: 'part-kabina-krana', x: 30, y: 120, w: 120, h: 150, z: 3 },
    { id: 'kabina', namePhrase: 'part-kabina', x: 480, y: 180, w: 130, h: 90, z: 3 },
    { id: 'kryuk', namePhrase: 'part-kryuk', x: 370, y: 180, w: 90, h: 90, z: 3 },
    { id: 'rama', namePhrase: 'part-rama', x: 10, y: 270, w: 600, h: 36, z: 2 },
    { id: 'opory', namePhrase: 'part-opory', x: 260, y: 306, w: 120, h: 84, z: 1 },
    { id: 'koleso-zadnee', namePhrase: 'part-koleso-zadnee', x: 30, y: 306, w: 220, h: 84, z: 2 },
    { id: 'koleso-perednee', namePhrase: 'part-koleso-perednee', x: 390, y: 306, w: 210, h: 84, z: 2 },
  ],
  workPart: 'strela',
  wheels: ['koleso-zadnee', 'koleso-perednee'],
  fuelPoint: { x: 300, y: 288 },
  tug: 'hard',
  // Факты проверены и утверждены Alex 24.11.2026.
  facts: ['fact-avtokran-1', 'fact-avtokran-2', 'fact-avtokran-3', 'fact-avtokran-4'],
  factWithPicture: 'fact-avtokran-1',
  puzzles: {
    16: { facing: 'left', scene: 'nature' },
    25: { facing: 'right', scene: 'stroika' },
  },
  sounds: {
    engine: { base: 66 },
    horn: { notes: [370, 466] },
  },
};
