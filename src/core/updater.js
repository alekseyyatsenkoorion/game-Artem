// Updater — обновление (contracts.md, раздел 9).
// Новая версия скачивается service worker'ом в фоне целиком и включается при следующем запуске
// (applyWaiting в начале загрузки, до старта игры).
import { VERSION } from './version.js';
import { logError } from './draw-utils.js';

const WAIT_INSTALL_MS = 120000;

function waitInstalled(worker, ms) {
  return new Promise((resolve) => {
    if (!worker) { resolve(false); return; }
    if (worker.state === 'installed' || worker.state === 'activated') { resolve(true); return; }
    const t = setTimeout(() => resolve(false), ms);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' || worker.state === 'activated') { clearTimeout(t); resolve(true); }
      if (worker.state === 'redundant') { clearTimeout(t); resolve(false); }
    });
  });
}

export class Updater {
  // sw — navigator.serviceWorker или null.
  constructor({ sw = null, version = VERSION } = {}) {
    this.sw = sw;
    this.v = version;
  }

  version() { return this.v; }

  async check() {
    if (!this.sw) return false;
    try {
      const reg = await this.sw.getRegistration();
      if (!reg) return false;
      if (reg.waiting) return true;
      await reg.update();
      if (reg.installing) return await waitInstalled(reg.installing, WAIT_INSTALL_MS);
      return !!reg.waiting;
    } catch (e) {
      // нет сети или скачивание оборвалось — работает текущая версия
      logError('Updater', 'проверка обновления не удалась', e && e.message ? e.message : e);
      return false;
    }
  }
}

// При запуске: если уже скачана новая версия — включаем её до старта игры.
// Возвращает true, если страница будет перезагружена.
export async function applyWaiting(sw, reload) {
  if (!sw) return false;
  try {
    const reg = await sw.getRegistration();
    if (!reg || !reg.waiting || !sw.controller) return false;
    const changed = new Promise((resolve) => {
      sw.addEventListener('controllerchange', () => resolve(true));
      setTimeout(() => resolve(false), 3000);
    });
    reg.waiting.postMessage('skip-waiting');
    if (await changed) { reload(); return true; }
  } catch (e) {
    logError('Updater', 'не удалось включить новую версию', e);
  }
  return false;
}

export async function registerWorker(sw, url) {
  if (!sw) return null;
  try {
    return await sw.register(url, { scope: './' });
  } catch (e) {
    logError('Updater', 'service worker не зарегистрирован', e);
    return null;
  }
}
