// Экскаватор — машина №6: гусеницы, стрела, рукоять и ковш с зубьями.
export default {
  id: 'ekskavator',
  order: 6,
  namePhrase: 'machine-ekskavator',
  nameAccPhrase: 'machine-ekskavator-acc',
  size: { w: 620, h: 380 },
  // x, y — левый верхний угол детали на собранной машине; z — порядок слоёв.
  parts: [
    { id: 'gusenica', namePhrase: 'part-gusenica', x: 30, y: 290, w: 400, h: 90, z: 1 },
    { id: 'korpus', namePhrase: 'part-korpus', x: 20, y: 210, w: 340, h: 80, z: 2 },
    { id: 'kabina', namePhrase: 'part-kabina', x: 220, y: 60, w: 140, h: 150, z: 3 },
    { id: 'protivoves', namePhrase: 'part-protivoves', x: 20, y: 100, w: 200, h: 110, z: 3 },
    { id: 'strela', namePhrase: 'part-strela', x: 360, y: 20, w: 160, h: 190, z: 4 },
    { id: 'rukoyat', namePhrase: 'part-rukoyat', x: 520, y: 20, w: 80, h: 200, z: 4 },
    { id: 'kovsh', namePhrase: 'part-kovsh', x: 480, y: 220, w: 140, h: 150, z: 5 },
  ],
  workPart: 'kovsh',
  wheels: [], // гусеницы не накачивают: ремонт «колесо» этой машине не выпадает
  fuelPoint: { x: 90, y: 250 },
  tug: 'medium',
  // Факты проверены и утверждены Alex 24.11.2026.
  facts: ['fact-ekskavator-1', 'fact-ekskavator-2', 'fact-ekskavator-3', 'fact-ekskavator-4', 'fact-ekskavator-5'],
  factWithPicture: 'fact-ekskavator-1',
  puzzles: {
    16: { facing: 'left', scene: 'nature' },
    25: { facing: 'right', scene: 'stroika' },
    36: { facing: 'left', scene: 'postroika', object: 'garazh' }, // рядом с готовой постройкой
  },
  sounds: {
    engine: { base: 40 },
    horn: { notes: [220, 277] },
  },
};
