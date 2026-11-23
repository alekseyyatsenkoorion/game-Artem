// AssetLoader — готовые картинки (contracts.md, раздел 4).
// Картинки рисуются один раз и дальше используются как готовые холсты.
import { logError } from './draw-utils.js';

export class AssetLoader {
  // registry — объект «id → {w, h, draw(g)}» от зоны «Контент» и ядра.
  // createCanvas(w, h) — создаёт холст; loadImage(url) — Promise с картинкой;
  // fetchJson(url) — Promise с JSON (для assets/gpt/manifest.json); scale — пикселей на логический пиксель.
  constructor({ registry = {}, createCanvas, loadImage, fetchJson, scale = 1, gptBase = 'assets/gpt/' }) {
    this.registry = Object.assign({}, registry);
    this.createCanvas = createCanvas;
    this.loadImage = loadImage;
    this.fetchJson = fetchJson;
    this.scale = scale;
    this.gptBase = gptBase;
    this.cache = new Map(); // id → {img, w, h}
    this.placeholders = new Map();
    this.loggedIds = new Set();
    this.gptManifest = null;
    this.gptManifestPromise = null;
    this.placeholderCount = 0; // для теста 0.2
  }

  register(entries) {
    Object.assign(this.registry, entries);
  }

  has(id) { return !!this.registry[id] || this.cache.has(id); }

  _logOnce(id, msg, e) {
    if (this.loggedIds.has(id)) return;
    this.loggedIds.add(id);
    logError('AssetLoader', msg, id, e || '');
  }

  _loadGptManifest() {
    if (this.gptManifestPromise) return this.gptManifestPromise;
    if (!this.fetchJson) { this.gptManifest = {}; this.gptManifestPromise = Promise.resolve({}); return this.gptManifestPromise; }
    this.gptManifestPromise = this.fetchJson(this.gptBase + 'manifest.json')
      .then((m) => { this.gptManifest = (m && typeof m === 'object') ? m : {}; return this.gptManifest; })
      .catch(() => { this.gptManifest = {}; return this.gptManifest; });
    return this.gptManifestPromise;
  }

  _render(id) {
    const def = this.registry[id];
    if (!def) return null;
    try {
      const c = this.createCanvas(Math.max(1, Math.ceil(def.w * this.scale)), Math.max(1, Math.ceil(def.h * this.scale)));
      const g = c.getContext('2d');
      g.scale(this.scale, this.scale);
      def.draw(g, def.w, def.h);
      const entry = { img: c, w: def.w, h: def.h };
      this.cache.set(id, entry);
      return entry;
    } catch (e) {
      this._logOnce(id, 'сбой рисования', e);
      return null;
    }
  }

  async _preloadOne(id) {
    if (this.cache.has(id)) return;
    const replaceable = id.startsWith('puzzle/') || id.startsWith('bg/');
    if (replaceable && this.loadImage) {
      const manifest = await this._loadGptManifest();
      const file = manifest[id];
      if (file) {
        try {
          const img = await this.loadImage(this.gptBase + file);
          const def = this.registry[id];
          const w = def ? def.w : img.width;
          const h = def ? def.h : img.height;
          this.cache.set(id, { img, w, h, fromFile: true });
          return;
        } catch (e) {
          this._logOnce(id, 'картинка из assets/gpt не открылась, рисуем кодом', e);
        }
      }
    }
    if (this.registry[id]) this._render(id);
    else this._logOnce(id, 'неизвестная картинка');
  }

  preload(ids) {
    const list = Array.from(new Set((ids || []).filter((x) => typeof x === 'string')));
    return Promise.all(list.map((id) => this._preloadOne(id).catch((e) => this._logOnce(id, 'сбой загрузки', e)))).then(() => undefined);
  }

  _placeholder(id) {
    this.placeholderCount++;
    this._logOnce(id, 'заглушка вместо картинки');
    if (this.placeholders.has(id)) return this.placeholders.get(id);
    let img;
    try {
      img = this.createCanvas(64, 64);
      const g = img.getContext('2d');
      g.fillStyle = '#ff00cc';
      g.fillRect(0, 0, 64, 64);
    } catch (e) {
      img = { width: 1, height: 1 };
    }
    const entry = { img, w: 64, h: 64 };
    this.placeholders.set(id, entry);
    return entry;
  }

  _entry(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    if (this.registry[id]) {
      const e = this._render(id);
      if (e) return e;
    }
    return this._placeholder(id);
  }

  image(id) {
    try { return this._entry(id).img; } catch (e) { return this._placeholder(id).img; }
  }

  size(id) {
    if (this.cache.has(id)) { const e = this.cache.get(id); return { w: e.w, h: e.h }; }
    const def = this.registry[id];
    if (def) return { w: def.w, h: def.h };
    return { w: 64, h: 64 };
  }

  release(ids) {
    for (const id of ids || []) {
      const e = this.cache.get(id);
      if (e && e.img && e.img.width !== undefined && !e.fromFile) {
        // освобождаем память холста (важно для старых iPad)
        try { e.img.width = 0; e.img.height = 0; } catch (err) { /* ничего */ }
      }
      this.cache.delete(id);
    }
  }

  cachedCount() { return this.cache.size; }
}
