// Все машины: id → { art, drawWhole, drawWork, drawDirty, drawSilhouette, size }.
import { machine as samosval } from './samosval.js';
import { machine as traktor } from './traktor.js';
import { machine as buldozer } from './buldozer.js';
import { machine as katok } from './katok.js';
import { machine as betonomeshalka } from './betonomeshalka.js';
import { machine as ekskavator } from './ekskavator.js';
import { machine as pogruzchik } from './pogruzchik.js';
import { machine as avtokran } from './avtokran.js';
import { machine as greider } from './greider.js';
import { machine as bashennyiKran } from './bashennyi-kran.js';

export const machines = {
  samosval, traktor, buldozer, katok, betonomeshalka, ekskavator, pogruzchik, avtokran, greider,
  'bashennyi-kran': bashennyiKran,
};
