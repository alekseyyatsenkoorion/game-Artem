// Рисует иконки игры (самосвал на голубом фоне) через браузер без окна: node tools/make-icons.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const srv = await serve(8131);
const browser = await pw.chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8131/index.html?icons');
for (const size of [180, 192, 512]) {
  const url = await page.evaluate(async (size) => {
    const { art } = await import('/src/art/index.js');
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, size);
    gr.addColorStop(0, '#6cc4ff'); gr.addColorStop(1, '#d7f1ff');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    g.fillStyle = '#d9b77c'; g.fillRect(0, size * 0.74, size, size * 0.26);
    const a = art['machine/samosval/whole/idle'];
    const k = size * 0.86 / a.w;
    g.save(); g.translate(size * 0.07, size * 0.8 - a.h * k); g.scale(k, k); a.draw(g, a.w, a.h); g.restore();
    return c.toDataURL('image/png');
  }, size);
  writeFileSync(join(ROOT, 'icon-' + size + '.png'), Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
srv.close();
console.log('иконки готовы');
