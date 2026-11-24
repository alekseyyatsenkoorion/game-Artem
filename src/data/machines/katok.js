// Каток — машина №4: огромный валец спереди, колёса сзади.
export default {
  id: 'katok',
  order: 4,
  namePhrase: 'machine-katok',
  nameAccPhrase: 'machine-katok-acc',
  size: { w: 600, h: 340 },
  // x, y — левый верхний угол детали на собранной машине; z — порядок слоёв.
  parts: [
    { id: 'koleso-zadnee', namePhrase: 'part-koleso-zadnee', x: 40, y: 200, w: 140, h: 140, z: 2 },
    { id: 'rama', namePhrase: 'part-rama', x: 20, y: 140, w: 230, h: 60, z: 1 },
    { id: 'kabina', namePhrase: 'part-kabina', x: 40, y: 0, w: 200, h: 140, z: 2 },
    { id: 'motor', namePhrase: 'part-motor', x: 250, y: 100, w: 160, h: 100, z: 1 },
    { id: 'truba', namePhrase: 'part-truba', x: 300, y: 20, w: 50, h: 80, z: 0 },
    { id: 'valec', namePhrase: 'part-valec', x: 410, y: 150, w: 190, h: 190, z: 3 },
  ],
  workPart: 'valec',
  wheels: ['koleso-zadnee'],
  fuelPoint: { x: 240, y: 175 },
  tug: 'medium',
  // Факты проверены и утверждены Alex 24.11.2026.
  facts: ['fact-katok-1', 'fact-katok-2', 'fact-katok-3', 'fact-katok-4'],
  factWithPicture: 'fact-katok-1',
  puzzles: {
    16: { facing: 'left', scene: 'nature' },
    25: { facing: 'right', scene: 'stroika' },
  },
  sounds: {
    engine: { base: 48 },
    horn: { notes: [294, 370] },
  },
};
