// Сборка любой машины: 2.1–2.3, 2.9 по всем машинам из данных; раскладка для машины до 620×390 и 10 деталей.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssemblyScene, SNAP_DISTANCE, layoutTray } from '../../src/games/assembly.js';
import { rectsOverlap, CROSS_ZONE } from '../../src/core/draw-utils.js';
import { seededRandom } from '../core/helpers.js';
import { openScene, settle, runToFinish, MACHINES, data } from './helpers.js';

function drag(s, part, toX, toY) {
  s.onPointer({ type: 'down', x: part.cx, y: part.cy });
  s.onPointer({ type: 'move', x: toX, y: toY });
  s.onPointer({ type: 'up', x: toX, y: toY });
}

function checkLayout(parts, home, slotOf, label) {
  const rects = [];
  for (const p of parts) {
    const h = home[p.id];
    assert.ok(h, label + ' ' + p.id);
    const r = { x: h.cx - p.w * h.s / 2, y: h.cy - p.h * h.s / 2, w: p.w * h.s, h: p.h * h.s };
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1024 && r.y + r.h <= 768, label + ' ' + p.id + ' в экране');
    assert.ok(!rectsOverlap(r, CROSS_ZONE));
    const sl = slotOf(p);
    assert.ok(Math.hypot(h.cx - sl.cx, h.cy - sl.cy) > SNAP_DISTANCE * 1.5, label + ' ' + p.id + ' не у своего места');
    rects.push(r);
  }
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) assert.ok(!rectsOverlap(rects[i], rects[j]), label + ': наложение');
}

for (const machine of MACHINES) {
  test('2.9 / 2.1 / 2.2 / 2.3 ' + machine + ': раскладка, детали встают только на свои места, сборка до конца', async () => {
    const m = data.machines.find((x) => x.id === machine);
    for (let seed = 1; seed <= 5; seed++) {
      const { s } = await openScene(AssemblyScene, { machine }, { seed });
      const home = {}; for (const p of s.parts) home[p.def.id] = p.home;
      checkLayout(m.parts, home, (d) => s.partById(d.id).slot, machine + ' seed ' + seed);
    }
    const { w, s, home } = await openScene(AssemblyScene, { machine });
    assert.equal(s.parts.length, m.parts.length);
    // машина помещается над верстаком
    assert.ok(s.oy + m.size.h <= 512 && s.ox >= 0 && s.ox + m.size.w <= 1024);
    const parts = s.parts.slice();
    // чужое место (у деталей, чьи места дальше порога)
    const a = parts[0];
    const other = parts.find((q) => q !== a && Math.hypot(q.slot.cx - a.slot.cx, q.slot.cy - a.slot.cy) > SNAP_DISTANCE + 10);
    if (other) { drag(s, a, other.slot.cx, other.slot.cy); assert.equal(a.placed, false); settle(s); assert.equal(Math.round(a.cx), Math.round(a.home.cx)); }
    for (const p of parts) {
      assert.equal(s.isAssembled(), false);
      drag(s, p, p.slot.cx + 30, p.slot.cy + 20);
      assert.equal(p.placed, true, p.def.id);
      settle(s, 0.2);
    }
    assert.equal(s.isAssembled(), true);
    assert.equal(w.progress.isAssembled(machine), true);
    await runToFinish(w, s);
    assert.deepEqual(home.results[0], { done: true, machine });
  });
}

test('раскладка верстака: машина 620×390 из 10 деталей разных размеров', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const r = seededRandom(seed);
    const parts = [];
    for (let i = 0; i < 10; i++) {
      const w = 40 + Math.floor(r() * 560), h = 30 + Math.floor(r() * 300);
      parts.push({ id: 'p' + i, x: Math.floor(r() * (620 - w)), y: Math.floor(r() * (390 - h)), w, h });
    }
    const ox = (1024 - 620) / 2, oy = 108;
    const slotOf = (p) => ({ cx: ox + p.x + p.w / 2, cy: oy + p.y + p.h / 2 });
    const home = layoutTray(parts, seededRandom(seed + 100), slotOf);
    // не у своего места — только если деталь вообще может лежать на верстаке далеко от места; проверяем остальное
    const rects = parts.map((p) => { const h = home[p.id]; return { x: h.cx - p.w * h.s / 2, y: h.cy - p.h * h.s / 2, w: p.w * h.s, h: p.h * h.s }; });
    for (const q of rects) assert.ok(q.x >= 0 && q.y >= 512 - 1 && q.x + q.w <= 1024 && q.y + q.h <= 768);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) assert.ok(!rectsOverlap(rects[i], rects[j]), 'seed ' + seed);
  }
});
