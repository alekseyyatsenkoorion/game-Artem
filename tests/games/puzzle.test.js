// Пазл: 2.5–2.9, 2.37 — по всем машинам из данных.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PuzzleScene, BOARD } from '../../src/games/puzzle.js';
import { cutPuzzle, pieceContains, pieceAt, pieceMargin } from '../../src/games/puzzle-cut.js';
import { CROSS_ZONE, rectsOverlap } from '../../src/core/draw-utils.js';
import { memoryStorage, captureErrors } from '../core/helpers.js';
import { openScene, settle, runToFinish, MACHINES, data, tick } from './helpers.js';

function drag(s, p, x, y) {
  s.onPointer({ type: 'down', x: p.cx, y: p.cy });
  s.onPointer({ type: 'move', x: (p.cx + x) / 2, y: (p.cy + y) / 2 });
  s.onPointer({ type: 'move', x, y });
  s.onPointer({ type: 'up', x, y });
}

// Открыть пазл 25: сначала отметить 16 собранным.
function done16(machine) { return (w) => w.progress.savePuzzle(machine, 16, Array.from({ length: 16 }, (_, i) => i)); }

test('2.5 пазл 16 режется на 16 кусков, 25 — на 25; куски покрывают картинку целиком и без наложений', () => {
  for (const [n, cols] of [[16, 4], [25, 5]]) {
    const cut = cutPuzzle(cols, cols, BOARD.w, BOARD.h);
    assert.equal(cut.pieces.length, n);
    // каждая точка картинки принадлежит ровно одному куску
    for (let v = 0.5; v < BOARD.h; v += 3) {
      for (let u = 0.5; u < BOARD.w; u += 3) {
        let owners = 0;
        for (const p of cut.pieces) if (pieceContains(cut, p, u, v)) owners++;
        assert.equal(owners, 1, 'точка ' + u + ',' + v);
      }
    }
    // края: снаружи ровные, внутри у соседей выступ против впадины; есть и выступы, и впадины
    let tabs = 0, blanks = 0;
    for (const p of cut.pieces) {
      if (p.col === 0) assert.equal(p.edges.left, 0);
      if (p.row === 0) assert.equal(p.edges.top, 0);
      if (p.col === cols - 1) assert.equal(p.edges.right, 0);
      if (p.row === cols - 1) assert.equal(p.edges.bottom, 0);
      if (p.col < cols - 1) { const q = cut.pieces[p.index + 1]; assert.equal(p.edges.right, -q.edges.left); assert.notEqual(p.edges.right, 0); }
      if (p.row < cols - 1) { const q = cut.pieces[p.index + cols]; assert.equal(p.edges.bottom, -q.edges.top); assert.notEqual(p.edges.bottom, 0); }
      for (const e of Object.values(p.edges)) { if (e > 0) tabs++; if (e < 0) blanks++; }
    }
    assert.ok(tabs > n / 2 && blanks > n / 2, 'фигурные края');
    // нарезка детерминирована
    assert.deepEqual(cutPuzzle(cols, cols, BOARD.w, BOARD.h).pieces.map((p) => p.edges), cut.pieces.map((p) => p.edges));
    // выступ виден: точка за краем клетки принадлежит куску с выступом
    const p = cut.pieces.find((x) => x.edges.right > 0);
    assert.equal(pieceAt(cut, p.x + p.w + cut.d, p.y + p.h / 2), p.index);
  }
});

for (const machine of MACHINES) {
  for (const size of [16, 25]) {
    const before = size === 25 ? done16(machine) : null;

    test('2.9 ' + machine + ' ' + size + ': куски в начале не на своих местах, на экране, не друг на друге', async () => {
      const { s } = await openScene(PuzzleScene, { machine, size }, { before });
      assert.equal(s.pieces.length, size);
      const rects = [];
      const m = pieceMargin(s.cut);
      for (const p of s.pieces) {
        assert.equal(p.placed, false);
        assert.ok(Math.hypot(p.cx - p.slot.cx, p.cy - p.slot.cy) > s.snap * 1.5);
        const r = { x: p.cx - (p.cp.w / 2 + m) * p.s, y: p.cy - (p.cp.h / 2 + m) * p.s, w: (p.cp.w + 2 * m) * p.s, h: (p.cp.h + 2 * m) * p.s };
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1024 && r.y + r.h <= 768, 'в экране');
        assert.ok(!rectsOverlap(r, s.board), 'не на поле');
        assert.ok(!rectsOverlap(r, CROSS_ZONE), 'не в зоне крестика');
        assert.ok(p.s >= 0.75, 'кусок крупный: ' + p.s.toFixed(2));
        rects.push(r);
      }
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) assert.ok(!rectsOverlap(rects[i], rects[j]), 'наложение');
    });

    test('2.6 / 2.7 / 0.9 ' + machine + ' ' + size + ': кусок встаёт только на своё место; собран только целиком; finish', async () => {
      const { w, s, home } = await openScene(PuzzleScene, { machine, size }, { before });
      const a = s.pieceByIndex(0), b = s.pieceByIndex(size - 1);
      drag(s, a, b.slot.cx, b.slot.cy);
      assert.equal(a.placed, false);
      settle(s);
      assert.equal(Math.round(a.cx), Math.round(a.home.cx));
      // промах рядом со своим местом — прилипает
      const order = s.pieces.slice();
      for (let i = 0; i < order.length; i++) {
        assert.equal(s.isComplete(), false);
        assert.notEqual(w.progress.puzzleState(machine, size), 'done');
        const p = order[i];
        drag(s, p, p.slot.cx + 20, p.slot.cy - 15);
        assert.equal(p.placed, true, 'кусок ' + p.index);
        settle(s, 0.2);
        assert.equal(p.cx, p.slot.cx);
        if (i < order.length - 1) assert.deepEqual(w.progress.puzzlePieces(machine, size).length, i + 1);
      }
      assert.equal(s.isComplete(), true);
      assert.equal(w.progress.puzzleState(machine, size), 'done');
      assert.equal(s.canExit(), false);
      await runToFinish(w, s);
      assert.equal(w.scenes.current(), 'home');
      assert.deepEqual(home.results[0], { done: true, machine, size });
    });
  }
}

test('2.8 недособранный пазл после выхода восстанавливается в том же виде', async () => {
  for (const machine of MACHINES) {
    const storage = memoryStorage();
    const { w, s } = await openScene(PuzzleScene, { machine, size: 16 }, { storage });
    const chosen = [s.pieceByIndex(3), s.pieceByIndex(7), s.pieceByIndex(12)];
    for (const p of chosen) drag(s, p, p.slot.cx, p.slot.cy);
    assert.equal(w.progress.puzzleState(machine, 16), 'started');
    w.scenes.back();
    // новый запуск игры с тем же хранилищем
    const again = await openScene(PuzzleScene, { machine, size: 16 }, { storage });
    const s2 = again.s;
    assert.deepEqual(s2.placedIndices(), [3, 7, 12]);
    for (const i of [3, 7, 12]) { const p = s2.pieceByIndex(i); assert.equal(p.cx, p.slot.cx); assert.equal(p.cy, p.slot.cy); }
    assert.equal(s2.pieces.filter((p) => !p.placed).length, 13);
  }
});

test('2.37 пазл 25 закрыт, пока не собран пазл 16: голос и выход назад', async () => {
  const machine = MACHINES[0];
  const { w, s, home } = await openScene(PuzzleScene, { machine, size: 25 });
  assert.equal(s.state, 'locked');
  assert.equal(s.pieces.length, 0);
  await tick();
  assert.ok(w.voices.log.includes(data.phrases['puzzle-locked'].replace('{name}', data.childName)));
  w.voices.finishCurrent(); await tick();
  for (let i = 0; i < 300 && w.scenes.current() === 'puzzle'; i++) s.update(0.02);
  assert.equal(w.scenes.current(), 'home');
  assert.deepEqual(home.results[0], { cancelled: true });
  // без голоса тоже закрывается
  const r2 = await openScene(PuzzleScene, { machine, size: 25 });
  for (let i = 0; i < 300 && r2.w.scenes.current() === 'puzzle'; i++) r2.s.update(0.02);
  assert.equal(r2.w.scenes.current(), 'home');
  // после пазла 16 — открыт
  const r3 = await openScene(PuzzleScene, { machine, size: 25 }, { before: done16(machine) });
  assert.equal(r3.s.state, 'play');
  assert.equal(r3.s.pieces.length, 25);
});

test('2.38 картинка любого размера рисуется в рамку поля, обрезка по центру', async () => {
  const machine = MACHINES[0];
  const { s, w } = await openScene(PuzzleScene, { machine, size: 16 });
  const calls = [];
  const img = { width: 2000, height: 1000 };
  w.assets.image = () => img;
  s.hasPic = true;
  s._drawPicture({ drawImage: (...a) => calls.push(a) }, 0, 0, BOARD.w, BOARD.h, BOARD.x, BOARD.y, 1);
  const [, sx, sy, sw, sh, dx, dy, dw, dh] = calls[0];
  assert.ok(Math.abs(sy) < 1e-6 && Math.abs(sh - 1000) < 1e-6);
  assert.ok(Math.abs(sw / sh - 4 / 3) < 1e-9);
  assert.ok(Math.abs(sx - (2000 - sw) / 2) < 1e-9);
  assert.deepEqual([dx, dy, dw, dh], [BOARD.x, BOARD.y, BOARD.w, BOARD.h]);
});

test('пазл: неизвестный размер — журнал и выход назад', async () => {
  const err = captureErrors();
  try {
    const { w } = await openScene(PuzzleScene, { machine: MACHINES[0], size: 36 });
    w.scenes.update(0.02);
    assert.equal(w.scenes.current(), 'home');
    assert.ok(err.list.length >= 1);
  } finally { err.restore(); }
});

test('пазл: подсказка — рука через 5 с к месту куска, голос через 10 с', async () => {
  const { w, s } = await openScene(PuzzleScene, { machine: MACHINES[0], size: 16 });
  await tick(); w.voices.finishCurrent(); await tick();
  const n = w.voices.log.length;
  settle(s, 5.1, 0.05);
  assert.equal(s.hint.showHand(), true);
  assert.equal(s.nextHintPiece().index, 0);
  settle(s, 5, 0.05);
  await tick();
  assert.equal(w.voices.log.length, n + 1);
  assert.equal(w.voices.log[n], data.phrases['puzzle-hint'].replace('{name}', data.childName));
});
