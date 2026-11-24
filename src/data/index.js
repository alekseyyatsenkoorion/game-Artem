// Данные контента (contracts.md, раздел 8): 10 машин и 10 объектов стройки.
import samosval from './machines/samosval.js';
import traktor from './machines/traktor.js';
import buldozer from './machines/buldozer.js';
import katok from './machines/katok.js';
import betonomeshalka from './machines/betonomeshalka.js';
import ekskavator from './machines/ekskavator.js';
import pogruzchik from './machines/pogruzchik.js';
import avtokran from './machines/avtokran.js';
import greider from './machines/greider.js';
import bashennyiKran from './machines/bashennyi-kran.js';
import { objects } from './objects/index.js';
import { phrases } from './phrases.js';
import { praises, praiseTexts } from './praises.js';
import { factTexts } from './facts.js';

// Имя ребёнка хранится только здесь.
export const childName = 'Артём';

export const data = {
  childName,
  machines: [samosval, traktor, buldozer, katok, betonomeshalka, ekskavator, pogruzchik, avtokran, greider, bashennyiKran],
  objects,
  phrases: Object.assign({}, phrases, praiseTexts, factTexts),
  praises,
};

export default data;
