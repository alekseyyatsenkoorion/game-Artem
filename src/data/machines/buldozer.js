// Бульдозер — машина №3: гусеницы, отвал спереди, труба и фара.
export default {
  id: 'buldozer',
  order: 3,
  namePhrase: 'machine-buldozer',
  nameAccPhrase: 'machine-buldozer-acc',
  size: { w: 600, h: 330 },
  // x, y — левый верхний угол детали на собранной машине; z — порядок слоёв.
  parts: [
    { id: 'gusenica', namePhrase: 'part-gusenica', x: 50, y: 240, w: 400, h: 90, z: 2 },
    { id: 'rama', namePhrase: 'part-rama', x: 40, y: 150, w: 420, h: 90, z: 1 },
    { id: 'kabina', namePhrase: 'part-kabina', x: 70, y: 10, w: 180, h: 140, z: 2 },
    { id: 'truba', namePhrase: 'part-truba', x: 340, y: 30, w: 50, h: 120, z: 0 },
    { id: 'fara', namePhrase: 'part-fara', x: 255, y: 92, w: 70, h: 56, z: 2 },
    { id: 'otval', namePhrase: 'part-otval', x: 470, y: 110, w: 130, h: 220, z: 3 },
  ],
  workPart: 'otval',
  wheels: [], // гусеницы не накачивают: ремонт «колесо» этой машине не выпадает
  fuelPoint: { x: 110, y: 200 },
  tug: 'easy',
  // Черновик: проверенные факты готовятся на этапе 3 и показываются Alex до озвучки.
  facts: ['fact-buldozer-1', 'fact-buldozer-2', 'fact-buldozer-3', 'fact-buldozer-4'],
  factWithPicture: 'fact-buldozer-1',
  puzzles: {
    16: { facing: 'left', scene: 'nature' },
    25: { facing: 'right', scene: 'stroika' },
  },
  sounds: {
    engine: { base: 38 },
    horn: { notes: [262, 330] },
  },
};
