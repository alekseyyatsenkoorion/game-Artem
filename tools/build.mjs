// Сборка версии перед выкладкой: список файлов для работы без сети, номер версии,
// список картинок из ChatGPT. Запуск: node tools/build.mjs 1.1
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'tests', 'tools', 'test-results', '.github']);
const EXCLUDE_FILES = new Set(['sw.js', 'package.json', 'package-lock.json', '.gitignore', '.nojekyll']);

// Имена файлов из «prompt GPT.md» → id картинок загрузчика.
const BG_NAMES = { stroika: 'build', garazh: 'garage', moika: 'wash', masterskaya: 'repair', karta: 'map' };

export function gptManifest(dir) {
  const out = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).sort()) {
    let m = /^puzzle-\d+-([a-z-]+)-(16|25)\.(png|jpe?g|webp)$/i.exec(f);
    if (m) { out['puzzle/' + m[1] + '/' + m[2]] = f; continue; }
    m = /^bg-([a-z-]+)\.(png|jpe?g|webp)$/i.exec(f);
    if (m && BG_NAMES[m[1]]) out['bg/' + BG_NAMES[m[1]]] = f;
  }
  return out;
}

export function listFiles(root = ROOT) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) { if (!EXCLUDE_DIRS.has(name)) walk(p); continue; }
      if (EXCLUDE_FILES.has(name) || name.endsWith('.md') || name.startsWith('.')) continue;
      files.push(relative(root, p).split(sep).join('/'));
    }
  };
  walk(root);
  return files;
}

export function sizes(root, files) {
  let total = 0, withoutGpt = 0;
  for (const f of files) {
    const s = statSync(join(root, f)).size;
    total += s;
    if (!f.startsWith('assets/gpt/') && !f.startsWith('assets/audio/')) withoutGpt += s;
  }
  return { total, withoutGpt };
}

function build(version) {
  const gptDir = join(ROOT, 'assets', 'gpt');
  writeFileSync(join(gptDir, 'manifest.json'), JSON.stringify(gptManifest(gptDir), null, 2) + '\n');
  const files = listFiles();
  const swPath = join(ROOT, 'sw.js');
  const sw = readFileSync(swPath, 'utf8');
  const block = '// BUILD:START\nconst VERSION = ' + JSON.stringify(version) + ';\nconst FILES = ' +
    JSON.stringify(files, null, 2) + ';\n// BUILD:END';
  writeFileSync(swPath, sw.replace(/\/\/ BUILD:START[\s\S]*?\/\/ BUILD:END/, block));
  const vPath = join(ROOT, 'src', 'core', 'version.js');
  writeFileSync(vPath, '// Номер версии. Пишется автоматически скриптом tools/build.mjs при выкладке.\nexport const VERSION = ' + JSON.stringify(version) + ';\n');
  const s = sizes(ROOT, files);
  console.log('Версия ' + version + ', файлов: ' + files.length + ', вес: ' + (s.total / 1048576).toFixed(2) + ' МБ (без картинок ChatGPT: ' + (s.withoutGpt / 1048576).toFixed(2) + ' МБ)');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const version = process.argv[2];
  if (!version || !/^\d+\.\d+$/.test(version)) { console.error('Укажите версию: node tools/build.mjs 1.0'); process.exit(1); }
  build(version);
}
