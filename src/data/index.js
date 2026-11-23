// Данные контента (contracts.md, раздел 8). На этапе 1 — только самосвал.
import samosval from './machines/samosval.js';
import { phrases } from './phrases.js';
import { praises, praiseTexts } from './praises.js';
import { factTexts } from './facts.js';

// Имя ребёнка хранится только здесь.
export const childName = 'Артём';

export const data = {
  childName,
  machines: [samosval],
  objects: [],
  phrases: Object.assign({}, phrases, praiseTexts, factTexts),
  praises,
};

export default data;
