import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGB } from '../helpers/load-logic.mjs';
import {
  seeded, sequence, NONE, runUntil, has, fillRow, clearLines, boardHash, makeBot
} from '../helpers/game-helpers.mjs';

const GB = loadGB();
const R = GB.RULES;
const C = GB.CONST;

const newGame = (startLevel = 0, rng = seeded(1)) => R.createGame({ startLevel, rng });
const shape = (type, rot) => R.cells(type, rot).map(([r, c]) => `${r}${c}`).sort().join(' ');

// ---------- G1: field, preview, no hold, no hard drop ----------

test('G1: field is 10x18 plus one hidden row; one preview; API has no hold or hard drop', () => {
  const g = newGame();
  assert.equal(g.vram.length, 180);
  assert.equal(g.board.length, 190);
  assert.equal(typeof g.preview, 'number');
  assert.deepEqual(Object.keys(R).filter((k) => /hold|hard/i.test(k)), []);
  // Unknown input keys (for example a hard-drop flag) change nothing.
  const a = newGame(0, seeded(5)); const b = newGame(0, seeded(5));
  for (let f = 0; f < 300; f++) { R.step(a, {}); R.step(b, { hardDrop: true, hold: true }); }
  assert.deepEqual(a.board, b.board);
  assert.equal(a.row, b.row);
});

test('G1: piece spawns at the ROM spawn origin in rotation 0', () => {
  const g = newGame();
  assert.equal(g.row, R.SPAWN_ROW);
  assert.equal(g.col, R.SPAWN_COL);
  assert.equal(g.rot, 0);
  assert.ok(g.active);
  // L spawn cells: field row 1 cols 3..5 and row 2 col 3.
  const L = R.cells(0, 0).map(([r, c]) => [R.SPAWN_ROW + r, R.SPAWN_COL + c]);
  assert.deepEqual(L, [[1, 3], [1, 4], [1, 5], [2, 3]]);
});

// ---------- G2: rotation ----------

test('G2: all 28 rotation states match the disassembly table', () => {
  const expected = [
    ['20 21 22 30', '11 21 31 32', '12 20 21 22', '10 11 21 31'],
    ['20 21 22 32', '11 12 21 31', '10 20 21 22', '11 21 30 31'],
    ['20 21 22 23', '01 11 21 31', '20 21 22 23', '01 11 21 31'],
    ['21 22 31 32', '21 22 31 32', '21 22 31 32', '21 22 31 32'],
    ['20 21 31 32', '11 20 21 30', '20 21 31 32', '11 20 21 30'],
    ['21 22 30 31', '10 20 21 31', '21 22 30 31', '10 20 21 31'],
    ['20 21 22 31', '11 21 22 31', '11 20 21 22', '11 20 21 31']
  ];
  for (let t = 0; t < 7; t++) for (let r = 0; r < 4; r++) {
    assert.equal(shape(t, r), expected[t][r], `piece ${t} rot ${r}`);
    assert.equal(R.cells(t, r).length, 4);
  }
});

test('G2: rotate is clockwise only (state index minus 1) and cycles 4 states', () => {
  const g = newGame(0, sequence([6, 1, 1, 1, 1, 1, 1, 1, 1])); // T current
  assert.equal(g.type, 6);
  // T pointing down rotated clockwise points left (state 3).
  const seen = [];
  for (let i = 0; i < 4; i++) {
    R.step(g, { rotate: true });
    seen.push(g.rot);
  }
  assert.deepEqual(seen, [3, 2, 1, 0]);
  assert.equal(shape(6, 3), '11 20 21 31');
});

test('G2: blocked rotation is refused with no wall kick', () => {
  const g = newGame(0, sequence([2, 1, 1, 1, 1]));
  assert.equal(g.type, 2); // I horizontal
  // Move to the right wall: horizontal I fills grid cols 0..3.
  g.col = 6; g.row = 5;
  R.step(g, { rotate: true }); // vertical fits at col 7
  assert.equal(g.rot, 3);
  g.col = 8; // vertical I in field col 9
  R.step(g, { rotate: true }); // horizontal needs cols 8..11: blocked
  assert.equal(g.rot, 3);
  assert.equal(g.col, 8);
  assert.equal(g.row, 5);
});

test('G2: rotation blocked by the stack is refused', () => {
  const g = newGame(0, sequence([2, 1, 1, 1]));
  g.row = 5;
  // Vertical I occupies field col 4, rows 5..8. Block row 7, col 4 with stack.
  g.board[R.idx(7, 4)] = 0x83;
  R.step(g, { rotate: true });
  assert.equal(g.rot, 0);
});

// ---------- G3: levels ----------

test('G3: start 0 first level-up at 10 lines', () => {
  const g = newGame(0);
  g.lines = 8;
  clearLines(R, g, 1);
  assert.equal(g.level, 0);
  const ev = clearLines(R, g, 1);
  assert.equal(g.lines, 10);
  assert.equal(g.level, 1);
  assert.ok(ev.some((e) => e.type === 'levelUp' && e.level === 1));
});

test('G3: start 9 first level-up at 100 lines, then every 10', () => {
  const g = newGame(9);
  g.lines = 96;
  clearLines(R, g, 3);
  assert.equal(g.level, 9);
  clearLines(R, g, 1);
  assert.equal(g.lines, 100);
  assert.equal(g.level, 10);
  g.lines = 108;
  clearLines(R, g, 2);
  assert.equal(g.level, 11);
});

test('G3: start N first level-up at N*10+10 lines', () => {
  for (let n = 0; n <= 9; n++) {
    const g = newGame(n);
    g.lines = n * 10 + 9 - 1;
    clearLines(R, g, 1);
    assert.equal(g.level, n, `start ${n} below threshold`);
    clearLines(R, g, 1);
    assert.equal(g.level, n + 1, `start ${n} at threshold`);
  }
});

test('G3: level never exceeds 20', () => {
  const g = newGame(9);
  g.level = 20; g.gravReload = C.GRAVITY[20] - 1;
  g.lines = 296;
  clearLines(R, g, 4);
  assert.equal(g.level, 20);
});

test('G3: start level outside 0..9 is rejected', () => {
  assert.throws(() => newGame(10), RangeError);
  assert.throws(() => newGame(-1), RangeError);
});

// ---------- G4: score ----------

test('G4: all four clear sizes at several levels', () => {
  for (const level of [0, 1, 5, 9, 15, 20]) {
    for (let n = 1; n <= 4; n++) {
      const g = newGame(Math.min(level, 9));
      g.level = level; g.gravReload = C.GRAVITY[level] - 1;
      g.lines = level * 10; // no level-up this clear
      clearLines(R, g, n);
      assert.equal(g.score, C.LINE_SCORES[n - 1] * (level + 1), `level ${level} n ${n}`);
    }
  }
});

test('G4: level-up crossing pays at the pre-clear level (start 9, 96 lines, tetris = 12,000)', () => {
  const g = newGame(9);
  g.lines = 96;
  clearLines(R, g, 4);
  assert.equal(g.score, 12000);
  assert.equal(g.level, 10);
  assert.equal(g.lines, 100);
});

test('G4: score caps at 999,999', () => {
  const g = newGame(9);
  g.score = 999000;
  g.lines = 90;
  clearLines(R, g, 4);
  assert.equal(g.score, 999999);
});

test('G4: lines cap at 9999', () => {
  const g = newGame(0);
  g.level = 20; g.lines = 9998;
  clearLines(R, g, 4);
  assert.equal(g.lines, 9999);
});

test('G4: shown score and lines update during the row copy, not at lock', () => {
  const g = newGame(0);
  for (let r = 0; r < 18; r++) fillRow(R, g, r, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  fillRow(R, g, 17, [0]);
  g.type = 2; g.rot = 1; g.row = 0; g.col = -1; g.active = true;
  runUntil(R, g, has('clear'));
  assert.equal(g.lines, 1);
  assert.equal(g.shownLines, 0);
  runUntil(R, g, has('spawn'));
  assert.equal(g.shownLines, 1);
  assert.equal(g.shownScore, 40);
});

// ---------- G5: gravity ----------

test('G5: frames per row at every level 0..20', () => {
  for (let level = 0; level <= 20; level++) {
    const g = newGame(0, sequence([2, 1, 1, 1]));
    g.level = level; g.gravReload = C.GRAVITY[level] - 1; g.gravCounter = g.gravReload;
    const moves = [];
    for (let f = 1; moves.length < 4 && f < 1000; f++) {
      const before = g.row;
      R.step(g, NONE);
      if (g.row !== before) moves.push(f);
    }
    for (let i = 1; i < moves.length; i++) {
      assert.equal(moves[i] - moves[i - 1], C.GRAVITY[level], `level ${level}`);
    }
    assert.equal(moves[0], C.GRAVITY[level], `level ${level} first drop`);
  }
});

// ---------- G6: soft drop ----------

test('G6: soft drop moves one row every 3 frames', () => {
  const g = newGame(0, sequence([2, 1, 1, 1]));
  const moves = [];
  for (let f = 1; f <= 20; f++) {
    const before = g.row;
    R.step(g, { down: true });
    if (g.row !== before) moves.push(f);
  }
  assert.deepEqual(moves, [1, 4, 7, 10, 13, 16, 19]);
});

test('G4/G6: soft-drop points equal rows dropped (held steps minus 1), level ignored', () => {
  for (const level of [0, 9]) {
    const g = newGame(level, sequence([3, 1, 1, 1])); // O piece
    // O cells at grid rows 2..3: lands with bottom on row 17, top-left grid at row 14.
    runUntil(R, g, has('lock'), { down: true });
    // Moved from row -1 to row 14: 15 rows, 16 held steps.
    assert.equal(g.score, 15, `level ${level}`);
  }
});

test('G6: releasing down resets the soft-drop count', () => {
  const g = newGame(0, sequence([3, 1, 1, 1]));
  for (let f = 0; f < 15; f++) R.step(g, { down: true }); // 5 rows
  R.step(g, NONE);
  assert.equal(g.row, 4);
  runUntil(R, g, has('lock'), { down: true });
  // Only the 10 rows after the release count (row 4 to row 14).
  assert.equal(g.score, 10);
});

test('G6: holding down through a lock needs a new press for the next piece', () => {
  const g = newGame(0, sequence([3, 3, 3, 3, 1, 1, 1]));
  runUntil(R, g, has('spawn'), { down: true });
  const row = g.row;
  for (let f = 0; f < 10; f++) R.step(g, { down: true });
  assert.equal(g.row, row, 'held down does not soft drop the new piece');
  R.step(g, NONE);
  R.step(g, { down: true });
  assert.equal(g.row, row + 1, 'a fresh press drops');
});

test('G6: holding left or right with down disables soft drop', () => {
  const g = newGame(0, sequence([3, 1, 1, 1]));
  for (let f = 0; f < 12; f++) R.step(g, { down: true, left: true });
  assert.equal(g.row, R.SPAWN_ROW);
});

// ---------- G7: horizontal repeat ----------

test('G7: held right moves at once, after 23 frames, then every 9', () => {
  const g = newGame(0, sequence([3, 1, 1, 1]));
  g.gravCounter = 10000;
  const moves = [];
  for (let f = 0; f < 60; f++) {
    const before = g.col;
    R.step(g, { right: true });
    if (g.col !== before) moves.push(f);
  }
  assert.deepEqual(moves.slice(0, 4), [0, 23, 32, 41]);
});

test('G7: held left repeats with the same 23/9 pattern', () => {
  const g = newGame(0, sequence([3, 1, 1, 1]));
  g.col = 7; g.gravCounter = 10000;
  const moves = [];
  for (let f = 0; f < 50; f++) {
    const before = g.col;
    R.step(g, { left: true });
    if (g.col !== before) moves.push(f);
  }
  assert.deepEqual(moves, [0, 23, 32, 41]);
});

test('G7: a wall block retries every frame', () => {
  const g = newGame(0, sequence([3, 1, 1, 1]));
  g.col = 7; // O at cols 8..9: at the right wall
  g.gravCounter = 10000;
  R.step(g, { right: true });
  assert.equal(g.col, 7);
  assert.equal(g.sticky, 1);
  R.step(g, { right: true });
  assert.equal(g.sticky, 1);
});

test('G7: the repeat counter carries across a new piece', () => {
  const g = newGame(0, sequence([3, 3, 3, 3, 3, 3]));
  // Drop the first O to the floor with right held from the start.
  const moves = [];
  let spawnFrame = -1;
  for (let f = 0; f < 3000 && moves.length < 30; f++) {
    const before = g.col;
    const typeBefore = g.active;
    const ev = R.step(g, { right: true });
    if (ev.some((e) => e.type === 'spawn')) spawnFrame = f;
    if (typeBefore && g.active && g.col !== before) moves.push(f);
    if (spawnFrame >= 0 && f > spawnFrame + 40) break;
  }
  // After the spawn the counter was not reset to the 23-frame delay: the next
  // move comes when the carried counter reaches zero (at most 9 frames, or a
  // retry right away when the previous piece was blocked at the wall).
  const after = moves.filter((f) => f > spawnFrame);
  assert.ok(after.length > 0);
  assert.ok(after[0] - spawnFrame <= 9, `first move ${after[0] - spawnFrame} frames after spawn`);
});

test('G7: releasing the key resets the delay', () => {
  const g = newGame(0, sequence([3, 1, 1, 1]));
  g.gravCounter = 10000;
  for (let f = 0; f < 30; f++) R.step(g, { right: true });
  R.step(g, NONE);
  assert.equal(g.sticky, C.DAS_DELAY);
});

// ---------- G8: randomizer ----------

function draw(g) { R.loadNext(g); return g.hidden; }

test('G8: injected sequences give the hand-computed queue', () => {
  // Start: current, preview, hidden all L(0). Three loads at createGame.
  // Load 1: current L(0). Roll 0 -> (0|0|0)=0 equals current: reroll.
  //         Roll 2 -> (8|0|0)=8 kept. Hidden J? no: candidate I(2).
  // We feed: [0, 2, ...]
  const g = R.createGame({ startLevel: 0, rng: sequence([0, 2, 1, 5]) });
  // Load 1: current=L, preview=L(old hidden), hidden=2 (after reroll of 0).
  // Load 2: current=L, roll 1 -> (4|0|0)&fc=4 != 0 keep: hidden=1, preview=2.
  // Load 3: current=2 (I), roll 5 -> (20|4|8)=28 != 8 keep: hidden=5, preview=1.
  assert.equal(g.type, 2);
  assert.equal(g.preview, 1);
  assert.equal(g.hidden, 5);
});

test('G8: rolls 1 and 2 reroll when the OR equals current; roll 3 is kept', () => {
  const g = newGame();
  g.preview = 6; g.hidden = 4; // next current = T(6)=24, preview = Z(4)=16
  // 24|16 = 24; candidate T(24) -> 24 == 24 reroll; candidate O(12) -> 28 != 24 keep.
  g.rng = sequence([6, 3]);
  draw(g);
  assert.equal(g.type, 6); assert.equal(g.preview, 4); assert.equal(g.hidden, 3);
  // Three matching rolls: the third is kept.
  g.preview = 6; g.hidden = 4;
  g.rng = sequence([6, 6, 6]);
  draw(g);
  assert.equal(g.hidden, 6);
  // OR quirk: current T(24), preview L(0), candidate I(8): 24|8 = 24 -> reroll.
  g.preview = 6; g.hidden = 0;
  g.rng = sequence([2, 1]);
  draw(g);
  assert.equal(g.hidden, 1);
});

test('G8: 1,000,000 draws match the target shares within 0.5 points', () => {
  const g = newGame(0, seeded(12345));
  const counts = new Array(7).fill(0);
  const N = 1000000;
  for (let i = 0; i < N; i++) counts[draw(g)]++;
  const pct = counts.map((c) => (100 * c) / N);
  const target = [10.7, 13.7, 13.7, 16.1, 13.7, 16.1, 16.1];
  for (let t = 0; t < 7; t++) {
    assert.ok(Math.abs(pct[t] - target[t]) <= 0.5, `piece ${t}: ${pct[t].toFixed(2)}% vs ${target[t]}%`);
  }
});

// ---------- G9: top-out ----------

test('G9: first spawn-position lock continues, second ends the game', () => {
  const g = newGame(0, sequence([3, 3, 3, 3, 3, 3]));
  // Fill rows 3..17 so an O at spawn (rows 1..2) locks without moving.
  for (let r = 3; r < 18; r++) fillRow(R, g, r, [0]);
  const all = [];
  runUntil(R, g, (ev) => { all.push(...ev); return ev.some((e) => e.type === 'spawn'); });
  assert.equal(g.over, false);
  assert.equal(g.stuck, 1);
  runUntil(R, g, (ev) => { all.push(...ev); return ev.some((e) => e.type === 'gameOver'); });
  assert.equal(g.over, true);
  assert.deepEqual(R.step(g, { down: true }), [], 'no events after game over');
});

test('G9: a lock away from the spawn position does not count', () => {
  const g = newGame(0, sequence([3, 3, 3, 3, 3, 3]));
  for (let r = 3; r < 18; r++) fillRow(R, g, r, [0]);
  R.step(g, { left: true });
  assert.equal(g.col, R.SPAWN_COL - 1);
  runUntil(R, g, has('spawn'));
  assert.equal(g.stuck, 0, 'moved piece locked away from spawn');
  // The next piece overlaps the stack at spawn and locks there: first strike only.
  runUntil(R, g, has('spawn'));
  assert.equal(g.stuck, 1);
  assert.equal(g.over, false);
});

// ---------- Line clear timing (G10) ----------

test('G10: no clear: next piece loads 2 frames after lock', () => {
  const g = newGame(0, sequence([3, 1, 1, 1]));
  const lockAt = runUntil(R, g, has('lock'), { down: true });
  const spawnAt = runUntil(R, g, has('spawn'));
  assert.equal(spawnAt, 2, `lock at ${lockAt}`);
});

test('G10: clear: 7 flash phases 10 frames apart, 13-frame wait, 18-frame row copy', () => {
  const g = newGame(0);
  for (let r = 0; r < 18; r++) fillRow(R, g, r, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  fillRow(R, g, 17, [0]);
  g.type = 2; g.rot = 1; g.row = 14; g.col = -1; g.active = true;
  g.gravCounter = 0;
  assert.equal(runUntil(R, g, has('lock'), NONE, 10), 1);
  const trace = [];
  let f = 0;
  for (; f < 200; f++) {
    const ev = R.step(g, NONE);
    trace.push(g.vram[17 * 10 + 0]);
    if (ev.some((e) => e.type === 'spawn')) break;
  }
  // Frame index (after lock) where row 17 col 5 changes value.
  const changes = [];
  for (let i = 1; i < trace.length; i++) if (trace[i] !== trace[i - 1]) changes.push([i, trace[i]]);
  const T = R.TILE_FLASH;
  // Phase 0 at lock+2 (index 1), then every 10 frames; phase 6 blanks the row.
  // Index i is frame lock + 1 + i. Phase 0 at lock + 2, then every 10 frames;
  // phase 6 blanks the row. 14 frames later row 17 is copied first and shows
  // the I cell that fell from row 16.
  assert.deepEqual(changes, [[1, T], [11, 0x89], [21, T], [31, 0x89], [41, T], [51, 0x89],
    [61, 0], [61 + 14, 0x88]]);
  // Next piece after 18 row copies.
  assert.equal(f, 61 + 14 + 17);
});

test('G10: rows 0 and 1 are never cleared (ROM checks from row 2)', () => {
  const g = newGame(0, sequence([3, 1, 1, 1]));
  fillRow(R, g, 1, []);
  fillRow(R, g, 17, [4, 5]);
  fillRow(R, g, 16, [4, 5]);
  g.col = 3; g.row = 13; g.type = 3; g.rot = 0;
  const ev = [];
  runUntil(R, g, (e) => { ev.push(...e); return e.some((x) => x.type === 'spawn'); });
  const clear = ev.find((e) => e.type === 'clear');
  assert.deepEqual(clear.rows, [16, 17]);
});

// ---------- Fuzz and replay ----------

function randomInput(rand) {
  const x = rand();
  return {
    left: x < 0.2, right: x > 0.8, down: rand() < 0.3, rotate: rand() < 0.1
  };
}

function invariants(g) {
  const valid = new Set([0, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x88, 0x89, 0x8a, 0x8b, 0x8f]);
  for (const v of g.board) assert.ok(valid.has(v), `bad tile ${v}`);
  for (const v of g.vram) assert.ok(valid.has(v) || v === R.TILE_FLASH, `bad vram ${v}`);
  assert.ok(g.score >= 0 && g.score <= C.MAX_SCORE);
  assert.ok(g.level >= 0 && g.level <= C.MAX_LEVEL);
  assert.ok(g.rot >= 0 && g.rot < 4 && g.type >= 0 && g.type < 7);
  assert.ok(g.preview >= 0 && g.preview < 7 && g.hidden >= 0 && g.hidden < 7);
  if (g.active && !g.over) {
    for (const c of R.activeCells(g)) {
      assert.ok(c.col >= 0 && c.col < 10 && c.row < 18 && c.row >= -1, 'piece in bounds');
    }
    // Only a freshly spawned piece can overlap the stack (the ROM has no spawn check).
    if (R.collides(g.board, g.type, g.rot, g.row, g.col)) {
      assert.equal(g.row, R.SPAWN_ROW, 'overlap only at spawn row');
    }
  }
}

test('Fuzz: random inputs never create invalid state', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rand = seeded(seed * 7919);
    const g = R.createGame({ startLevel: seed % 10, rng: seeded(seed) });
    for (let f = 0; f < 20000 && !g.over; f++) {
      R.step(g, randomInput(rand));
      invariants(g);
    }
  }
});

function replay(seed, startLevel, frames) {
  const bot = makeBot(R);
  const g = R.createGame({ startLevel, rng: seeded(seed) });
  for (let f = 0; f < frames && !g.over; f++) R.step(g, bot(f, g));
  return { score: g.score, lines: g.lines, level: g.level, frame: g.frame, hash: boardHash(g) };
}

test('Fuzz: bot games clear lines and keep valid state', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const bot = makeBot(R);
    const g = R.createGame({ startLevel: seed, rng: seeded(seed) });
    for (let f = 0; f < 30000 && !g.over; f++) { R.step(g, bot(f, g)); invariants(g); }
    assert.ok(g.lines > 0, `seed ${seed} cleared lines`);
  }
});

test('Replay: 3 scripted traces give fixed results', () => {
  const got = [replay(1, 0, 30000), replay(2, 5, 30000), replay(3, 9, 30000)];
  // Determinism: the same trace twice gives the same result.
  assert.deepEqual(got, [replay(1, 0, 30000), replay(2, 5, 30000), replay(3, 9, 30000)]);
  assert.deepEqual(got, REPLAY_GOLDEN);
});

// Golden values from the first verified run. A change here means the rules changed.
const REPLAY_GOLDEN = [
  { score: 36800, lines: 127, level: 12, frame: 30000, hash: '6b6f377d' },
  { score: 49120, lines: 129, level: 12, frame: 30000, hash: '1dc9cadc' },
  { score: 103040, lines: 148, level: 14, frame: 30000, hash: '9e354e55' }
];
