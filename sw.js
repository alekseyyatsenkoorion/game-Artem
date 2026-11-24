// Service worker: при первом открытии сохраняет на планшете все файлы игры; дальше игра работает без сети.
// Новая версия скачивается в фоне целиком и включается при следующем запуске.
// Блок между метками заполняет tools/build.mjs при выкладке — руками не правится.
// BUILD:START
const VERSION = "1.4";
const FILES = [
  "assets/gpt/manifest.json",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "index.html",
  "manifest.webmanifest",
  "src/art/animals.js",
  "src/art/backgrounds.js",
  "src/art/index.js",
  "src/art/machines/avtokran.js",
  "src/art/machines/bashennyi-kran.js",
  "src/art/machines/betonomeshalka.js",
  "src/art/machines/buldozer.js",
  "src/art/machines/ekskavator.js",
  "src/art/machines/greider.js",
  "src/art/machines/index.js",
  "src/art/machines/katok.js",
  "src/art/machines/pogruzchik.js",
  "src/art/machines/samosval.js",
  "src/art/machines/traktor.js",
  "src/art/objects/common.js",
  "src/art/objects/dom-2.js",
  "src/art/objects/dom-mnogo.js",
  "src/art/objects/domik.js",
  "src/art/objects/doroga.js",
  "src/art/objects/garazh.js",
  "src/art/objects/index.js",
  "src/art/objects/most.js",
  "src/art/objects/parking.js",
  "src/art/objects/pesochnitsa.js",
  "src/art/objects/ploshchadka.js",
  "src/art/objects/zabor.js",
  "src/art/parts-common.js",
  "src/art/puzzles/index.js",
  "src/art/puzzles/scenery.js",
  "src/core/assets.js",
  "src/core/audio.js",
  "src/core/draw-utils.js",
  "src/core/game.js",
  "src/core/input.js",
  "src/core/parent-timer.js",
  "src/core/progress.js",
  "src/core/scene-manager.js",
  "src/core/scene.js",
  "src/core/ui.js",
  "src/core/updater.js",
  "src/core/version.js",
  "src/data/facts.js",
  "src/data/index.js",
  "src/data/machines/avtokran.js",
  "src/data/machines/bashennyi-kran.js",
  "src/data/machines/betonomeshalka.js",
  "src/data/machines/buldozer.js",
  "src/data/machines/ekskavator.js",
  "src/data/machines/greider.js",
  "src/data/machines/katok.js",
  "src/data/machines/pogruzchik.js",
  "src/data/machines/samosval.js",
  "src/data/machines/traktor.js",
  "src/data/objects/dom-2.js",
  "src/data/objects/dom-mnogo.js",
  "src/data/objects/domik.js",
  "src/data/objects/doroga.js",
  "src/data/objects/garazh.js",
  "src/data/objects/index.js",
  "src/data/objects/make.js",
  "src/data/objects/most.js",
  "src/data/objects/parking.js",
  "src/data/objects/pesochnitsa.js",
  "src/data/objects/ploshchadka.js",
  "src/data/objects/zabor.js",
  "src/data/phrases.js",
  "src/data/praises.js",
  "src/games/assembly.js",
  "src/games/common.js",
  "src/games/fuel.js",
  "src/games/index.js",
  "src/games/puzzle-cut.js",
  "src/games/puzzle.js",
  "src/games/repair.js",
  "src/games/tug.js",
  "src/games/wash.js",
  "src/main.js",
  "src/world/build-actions/common.js",
  "src/world/build-actions/dig.js",
  "src/world/build-actions/haul-away.js",
  "src/world/build-actions/haul-in.js",
  "src/world/build-actions/index.js",
  "src/world/build-actions/layer-box.js",
  "src/world/build-actions/level.js",
  "src/world/build-actions/lift.js",
  "src/world/build-actions/line.js",
  "src/world/build-actions/paint.js",
  "src/world/build-actions/place.js",
  "src/world/build-actions/pour.js",
  "src/world/build-actions/roll.js",
  "src/world/build-actions/spread.js",
  "src/world/build-actions/stack.js",
  "src/world/build.js",
  "src/world/garage.js",
  "src/world/home.js",
  "src/world/index.js",
  "src/world/locked.js",
  "src/world/map.js",
  "src/world/parent.js"
];
// BUILD:END

const CACHE = 'stroika-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['./'].concat(FILES).map((f) => new Request(f, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('stroika-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        if (hit) return hit;
        if (req.mode === 'navigate') {
          return cache.match('./index.html').then((page) => page || fetch(req));
        }
        return fetch(req);
      })
    )
  );
});
