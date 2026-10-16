import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGB } from '../helpers/load-logic.mjs';

const GB = loadGB();
const C = GB.CONST;

test('loader returns the GB namespace with CONST', () => {
  assert.equal(typeof GB, 'object');
  assert.equal(typeof C, 'object');
});

test('G5: gravity table equals the 21 requirement values', () => {
  assert.deepEqual([...C.GRAVITY],
    [53, 49, 45, 41, 37, 33, 28, 22, 17, 11, 10, 9, 8, 7, 6, 6, 5, 5, 4, 4, 3]);
  assert.equal(C.FPS, 59.73);
});

test('L2: palette has four distinct shades ordered light to dark', () => {
  assert.equal(C.PALETTE.length, 4);
  assert.equal(new Set(C.PALETTE).size, 4);
  const luma = C.PALETTE.map((h) => {
    const n = parseInt(h.slice(1), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  });
  for (let i = 1; i < 4; i++) assert.ok(luma[i] < luma[i - 1], `shade ${i} darker`);
});

test('G7, G6: repeat and soft-drop timing', () => {
  assert.equal(C.DAS_DELAY, 23);
  assert.equal(C.DAS_REPEAT, 9);
  assert.equal(C.SOFT_DROP_INTERVAL, 3);
});

test('G3, G4: score multipliers and caps', () => {
  assert.deepEqual([...C.LINE_SCORES], [40, 100, 300, 1200]);
  assert.equal(C.MAX_LEVEL, 20);
  assert.equal(C.MAX_START_LEVEL, 9);
  assert.equal(C.MAX_SCORE, 999999);
});

test('C2/E2: storage keys are namespaced', () => {
  assert.equal(C.STORAGE_PREFIX, 'gbtetris.v1.');
});
