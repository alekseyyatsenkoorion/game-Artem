// Трактор — машина №2: большое заднее колесо, маленькое переднее, прицеп для досок.
export default {
  id: 'traktor',
  order: 2,
  namePhrase: 'machine-traktor',
  nameAccPhrase: 'machine-traktor-acc',
  size: { w: 600, h: 340 },
  // x, y — левый верхний угол детали на собранной машине; z — порядок слоёв.
  parts: [
    { id: 'pricep', namePhrase: 'part-pricep', x: 0, y: 120, w: 250, h: 220, z: 1 },
    { id: 'koleso-zadnee', namePhrase: 'part-koleso-zadnee', x: 270, y: 170, w: 170, h: 170, z: 3 },
    { id: 'kabina', namePhrase: 'part-kabina', x: 270, y: 0, w: 170, h: 170, z: 2 },
    { id: 'motor', namePhrase: 'part-motor', x: 440, y: 40, w: 160, h: 190, z: 2 },
    { id: 'koleso-perednee', namePhrase: 'part-koleso-perednee', x: 465, y: 230, w: 110, h: 110, z: 3 },
  ],
  workPart: 'pricep',
  wheels: ['koleso-zadnee', 'koleso-perednee'],
  fuelPoint: { x: 455, y: 205 },
  tug: 'easy',
  // Черновик: проверенные факты готовятся на этапе 3 и показываются Alex до озвучки.
  facts: ['fact-traktor-1', 'fact-traktor-2', 'fact-traktor-3', 'fact-traktor-4'],
  factWithPicture: 'fact-traktor-2',
  puzzles: {
    16: { facing: 'left', scene: 'nature' },
    25: { facing: 'right', scene: 'stroika' },
  },
  sounds: {
    engine: { base: 44 },
    horn: { notes: [330, 392] },
  },
};
