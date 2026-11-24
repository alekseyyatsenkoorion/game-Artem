// Погрузчик — машина №7: большой ковш спереди на двух рычагах.
export default {
  id: 'pogruzchik',
  order: 7,
  namePhrase: 'machine-pogruzchik',
  nameAccPhrase: 'machine-pogruzchik-acc',
  size: { w: 620, h: 370 },
  // x, y — левый верхний угол детали на собранной машине; z — порядок слоёв.
  parts: [
    { id: 'koleso-zadnee', namePhrase: 'part-koleso-zadnee', x: 40, y: 230, w: 140, h: 140, z: 3 },
    { id: 'koleso-perednee', namePhrase: 'part-koleso-perednee', x: 330, y: 230, w: 140, h: 140, z: 3 },
    { id: 'rama', namePhrase: 'part-rama', x: 20, y: 170, w: 460, h: 60, z: 2 },
    { id: 'lestnica', namePhrase: 'part-lestnica', x: 190, y: 230, w: 70, h: 120, z: 1 },
    { id: 'kabina', namePhrase: 'part-kabina', x: 200, y: 10, w: 170, h: 160, z: 2 },
    { id: 'motor', namePhrase: 'part-motor', x: 20, y: 70, w: 180, h: 100, z: 2 },
    { id: 'strela', namePhrase: 'part-strela', x: 370, y: 80, w: 120, h: 90, z: 3 },
    { id: 'kovsh', namePhrase: 'part-kovsh', x: 490, y: 170, w: 130, h: 160, z: 4 },
  ],
  workPart: 'kovsh',
  wheels: ['koleso-zadnee', 'koleso-perednee'],
  fuelPoint: { x: 60, y: 200 },
  tug: 'medium',
  // Факты проверены и утверждены Alex 24.11.2026.
  facts: ['fact-pogruzchik-1', 'fact-pogruzchik-2', 'fact-pogruzchik-3', 'fact-pogruzchik-4'],
  factWithPicture: 'fact-pogruzchik-1',
  puzzles: {
    16: { facing: 'left', scene: 'nature' },
    25: { facing: 'right', scene: 'stroika' },
  },
  sounds: {
    engine: { base: 62 },
    horn: { notes: [440, 523] },
  },
};
