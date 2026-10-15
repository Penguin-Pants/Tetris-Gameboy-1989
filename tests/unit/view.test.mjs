import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGB } from '../helpers/load-logic.mjs';
import { seeded, sequence, makeBot, fillRow, runUntil, has } from '../helpers/game-helpers.mjs';

const GB = loadGB();
const { VIEW: V, DATA: D, RULES: R, APP: A, CONST: C } = GB;

// Returns true when any pixel of tile cell (col, row) differs from shade bg.
function cellInked(fb, col, row, bg = 0) {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (fb[(row * 8 + y) * 160 + col * 8 + x] !== bg) return true;
  }
  return false;
}

test('blit writes the tile indexes and clips at the edges', () => {
  const fb = V.createFramebuffer();
  const tile = D.compile(['.+o#.+o#', '########', '........', '++++++++', 'oooooooo', '#.#.#.#.', '.#.#.#.#', '#......#']);
  V.blit(fb, tile, 8, 16);
  assert.deepEqual([...fb.slice(16 * 160 + 8, 16 * 160 + 16)], [0, 1, 2, 3, 0, 1, 2, 3]);
  assert.deepEqual([...fb.slice(17 * 160 + 8, 17 * 160 + 16)], [3, 3, 3, 3, 3, 3, 3, 3]);
  assert.equal(fb[16 * 160 + 7], 0);
  const fb2 = V.createFramebuffer();
  V.blit(fb2, tile, 156, 140); // partly off screen
  assert.equal(fb2[140 * 160 + 159], 3);
  assert.equal(fb2.length, 160 * 144);
});

test('tile compile rejects bad input', () => {
  assert.throws(() => D.compile(['........']));
  assert.throws(() => D.compile(new Array(8).fill('.......x')));
});

test('text renders glyphs at fixed tile positions', () => {
  const fb = V.createFramebuffer();
  V.drawText(fb, 'A1', 3, 4);
  assert.ok(cellInked(fb, 3, 4));
  assert.ok(cellInked(fb, 4, 4));
  assert.ok(!cellInked(fb, 5, 4));
  assert.ok(!cellInked(fb, 2, 4));
  // Ink is darkest on lightest.
  const shades = new Set(fb.slice(32 * 160 + 24, 32 * 160 + 40));
  assert.deepEqual([...shades].sort(), [0, 3]);
});

test('numbers are right-aligned with no leading zeros', () => {
  const cases = [[0, [18]], [45, [17, 18]], [2359, [15, 16, 17, 18]], [999999, [13, 14, 15, 16, 17, 18]]];
  for (const [n, cols] of cases) {
    const fb = V.createFramebuffer();
    V.drawNumberRight(fb, n, 18, 3);
    const inked = [];
    for (let c = 0; c < 20; c++) if (cellInked(fb, c, 3)) inked.push(c);
    assert.deepEqual(inked, cols, `number ${n}`);
  }
});

test('font covers A-Z, 0-9 and the symbols later phases need', () => {
  const need = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-:*!_ ©▶↑↓←→';
  for (const ch of need) assert.ok(D.FONT[ch], `glyph ${ch}`);
});

test('every tile the engine can store has block art', () => {
  for (let t = 0; t < 7; t++) for (let r = 0; r < 4; r++) {
    for (const [, , tile] of R.cells(t, r)) assert.ok(D.BLOCKS[tile], `tile ${tile.toString(16)}`);
  }
  assert.ok(D.BLOCKS[R.TILE_FLASH]);
});

test('L3: play layout positions match the ROM layout structure (within 1 tile)', () => {
  const L = D.LAYOUT_PLAY;
  assert.equal(L.length, 18);
  for (const row of L) assert.equal(row.length, 20);
  for (let r = 0; r < 18; r++) {
    assert.match(L[r][1], /[abc]/, 'left wall at col 1');
    assert.match(L[r][12], /[abc]/, 'right wall at col 12');
    assert.equal(L[r].slice(2, 12), '          ', 'field cols 2..11');
  }
  // Text rows from layout_aTypeInGame.bin: SCORE row 1, LEVEL row 6, LINES row 9.
  assert.deepEqual(D.TEXT_PLAY.map((t) => [t[0], t[1], t[2]]),
    [['SCORE', 14, 1], ['LEVEL', 14, 6], ['LINES', 14, 9]]);
  // Next box: rows 12..17, cols 14..19.
  assert.equal(L[12].slice(14), '[----]');
  assert.equal(L[17].slice(14), '{____}');
  // Next piece cells land inside the box interior (cols 15..18, rows 13..16).
  for (let t = 0; t < 7; t++) for (const [r, c] of R.cells(t, 0)) {
    const col = (D.NEXT_X + c * 8) / 8, row = (D.NEXT_Y + r * 8) / 8;
    assert.ok(col >= 15 && col <= 18 && row >= 13 && row <= 16, `piece ${t}`);
  }
});

test('L2: rendered play screen uses only the 4 shade indexes', () => {
  const g = R.createGame({ startLevel: 5, rng: seeded(3) });
  const fb = V.createFramebuffer();
  V.renderPlay(fb, g);
  for (const v of fb) assert.ok(v >= 0 && v <= 3);
});

function midGame() {
  const g = R.createGame({ startLevel: 5, rng: seeded(3) });
  const bot = makeBot(R);
  for (let f = 0; f < 2500; f++) R.step(g, bot(f, g));
  return g;
}

function flashGame() {
  const g = R.createGame({ startLevel: 0, rng: sequence([2, 1, 1, 1]) });
  fillRow(R, g, 17, [0]);
  g.type = 2; g.rot = 1; g.row = 14; g.col = -1; g.active = true; g.gravCounter = 0;
  runUntil(R, g, has('lock'));
  R.step(g, {}); R.step(g, {}); // first flash phase
  return g;
}

test('Golden framebuffers: empty board, mid-game, flash frame', () => {
  const states = {
    empty: R.createGame({ startLevel: 0, rng: sequence([0, 2, 1, 5]) }),
    mid: midGame(),
    flash: flashGame()
  };
  assert.equal(states.flash.vram[17 * 10 + 5], R.TILE_FLASH);
  const got = {};
  for (const [k, g] of Object.entries(states)) {
    const fb = V.createFramebuffer();
    V.renderPlay(fb, g);
    got[k] = V.hash(fb);
  }
  assert.deepEqual(got, GOLDEN);
});

// Regression guards only. Update after an intended art change.
const GOLDEN = { empty: '5dcf7696', mid: 'f9a2fa13', flash: '0b5813ce' };

test('G5: ticker runs the fixed rate with a fake clock', () => {
  const t = A.createTicker(59.73, 5);
  let steps = 0;
  t.advance(0);
  for (let i = 1; i <= 600; i++) steps += t.advance(i * (1000 / 60)); // 10 s of 60 Hz frames
  assert.ok(Math.abs(steps - 597) <= 1, `steps ${steps}`);
  // 144 Hz display: same game rate.
  const t2 = A.createTicker(59.73, 5);
  let s2 = 0;
  t2.advance(0);
  for (let i = 1; i <= 1440; i++) s2 += t2.advance(i * (1000 / 144));
  assert.ok(Math.abs(s2 - 597) <= 1, `steps ${s2}`);
});

test('G5: ticker caps catch-up at 5 steps and drops the backlog', () => {
  const t = A.createTicker(59.73, 5);
  t.advance(0);
  assert.equal(t.advance(10000), 5);
  assert.equal(t.advance(10000 + 1000 / 59.73 + 0.01), 1);
  t.reset();
  assert.equal(t.advance(50000), 0);
});
