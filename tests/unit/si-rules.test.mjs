// Space Invaders rules engine: fleet, player, player shot, shields, waves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from '../helpers/load-arcade.mjs';

const { SI } = loadGame('space-invaders.html', 'SI');
const R = SI.RULES, C = SI.CONST;
const IDLE = Object.freeze({});

function run(g, n, input = IDLE) {
  const ev = [];
  for (let i = 0; i < n; i++) ev.push(...R.step(g, typeof input === 'function' ? input(i, g) : input));
  return ev;
}

function runUntil(g, pred, input = IDLE, limit = 20000) {
  for (let f = 1; f <= limit; f++) {
    const ev = R.step(g, typeof input === 'function' ? input(f, g) : input);
    if (pred(g, ev)) return f;
  }
  throw new Error('runUntil: limit reached');
}

// A game in play with the player cannon active.
function playing() {
  const g = R.createGame();
  runUntil(g, (s) => s.phase === 'play' && s.obj[0].timer === 0);
  run(g, 2);
  return g;
}

// Puts a moving player shot on the alien cell and flags the collision, as
// MovePlyShot does, then runs one frame so the main loop scores it.
function hitAlien(g, idx) {
  const p = R.alienCoords(g, idx);
  Object.assign(g.shot, { status: 2, yr: p.yr, xr: p.xr + 4 });
  g.alienExploding = 1;
  return run(g, 1);
}

function shieldPixels(g) {
  let n = 0;
  for (let y = 192; y < 208; y++) for (let x = 0; x < 224; x++) n += R.pixel(g, x, y);
  return n;
}

test('I1/I2: 55 aliens in 5 x 11 at the rack 1 start; points by row', () => {
  const g = R.createGame();
  assert.equal(g.aliens.length, 55);
  assert.equal(g.aliens.reduce((a, b) => a + b, 0), 55);
  assert.equal(R.alienCoords(g, 0).yr, 0x78);
  assert.equal(R.alienCoords(g, 54).yr, 0x78 + 64);
  assert.equal(R.alienCoords(g, 10).xr, 0x38 + 160);
  const want = [10, 10, 20, 20, 30];
  for (let row = 0; row < 5; row++) {
    const s = playing();
    const before = s.score;
    hitAlien(s, row * 11 + 5);
    assert.equal(s.score - before, want[row], `row ${row}`);
    assert.equal(s.aliens[row * 11 + 5], 0);
  }
});

test('I4: one fleet step takes one frame per live alien (55, 30, 1)', () => {
  for (const live of [55, 30, 1]) {
    const g = playing();
    for (let i = live; i < 55; i++) g.aliens[i] = 0;
    run(g, 120);
    const moves = [];
    let last = g.refXr;
    for (let f = 0; f < 400 && moves.length < 4; f++) {
      run(g, 1);
      if (g.refXr !== last) { moves.push(g.frame); last = g.refXr; }
    }
    assert.equal(moves[2] - moves[1], live, `${live} aliens`);
    assert.equal(moves[3] - moves[2], live, `${live} aliens`);
  }
});

test('I4: drop 8 at each edge; dX is +2, -2 and +3 right with one alien left', () => {
  const g = playing();
  assert.equal(g.refDX, 2);
  const y0 = g.refYr;
  runUntil(g, (s) => s.rackDirection === 1);
  assert.equal(g.refDX, -2);
  runUntil(g, (s) => s.refYr !== y0);
  assert.equal(g.refYr, y0 - 8);
  runUntil(g, (s) => s.rackDirection === 0);
  assert.equal(g.refDX, 2, 'more than one alien moves right at 2');
  for (let i = 1; i < 55; i++) g.aliens[i] = 0;
  runUntil(g, (s) => s.rackDirection === 1);
  runUntil(g, (s) => s.rackDirection === 0);
  assert.equal(g.refDX, 3, 'one alien moves right at 3');
});

test('I4/I12: march tempo comes from the 1A11 and 1A21 tables', () => {
  const pairs = [[55, 52], [50, 52], [49, 46], [36, 39], [28, 34], [22, 28], [17, 24], [13, 21],
    [10, 19], [8, 16], [7, 14], [6, 13], [5, 12], [4, 11], [3, 9], [2, 7], [1, 5]];
  for (const [n, d] of pairs) assert.equal(R.fleetDelay(n), d, `${n} aliens`);
  const g = playing();
  const at = [];
  for (let f = 0; f < 400; f++) if (R.step(g, IDLE).some((e) => e.type === 'march')) at.push(g.frame);
  assert.ok(at.length >= 4);
  assert.equal(at[3] - at[2], 52);
  const tones = [];
  for (let f = 0; f < 300; f++) for (const e of R.step(g, IDLE)) if (e.type === 'march') tones.push(e.tone);
  assert.deepEqual(tones.slice(0, 4).map((t) => (t - tones[0] + 4) % 4), [0, 1, 2, 3], '4 tones in turn');
});

test('I5/IK2: shot moves 4 px per run; one at a time; holding fire does not re-fire', () => {
  const g = playing();
  const FIRE = { fire: true };
  run(g, 1, FIRE);
  runUntil(g, (s) => s.shot.status === 2, FIRE);
  const ys = [];
  for (let f = 0; f < 6; f++) { run(g, 1, FIRE); ys.push(g.shot.yr); }
  for (let i = 1; i < ys.length; i++) assert.equal(ys[i] - ys[i - 1], 4);
  // Holding fire through the whole flight and after it gives one shot only.
  const ev = run(g, 300, FIRE);
  assert.equal(g.shot.status, 0);
  assert.equal(ev.filter((e) => e.type === 'shot').length, 0, 'no second shot while held');
  // Release then press fires again.
  run(g, 2, IDLE);
  const ev2 = run(g, 3, FIRE);
  assert.equal(ev2.filter((e) => e.type === 'shot').length, 1);
  // A press while a shot is live does nothing.
  run(g, 2, IDLE);
  const st = g.shot.yr;
  run(g, 1, FIRE);
  assert.equal(g.shot.status, 2);
  assert.ok(g.shot.yr > st);
});

test('I9 (O2): wave start Yr for racks 1 to 10 follows ROM table 1DA3', () => {
  const g = playing();
  const seen = [g.refYr];
  for (let rack = 2; rack <= 10; rack++) {
    g.aliens.fill(0);
    runUntil(g, (s, ev) => ev.some((e) => e.type === 'waveClear'));
    seen.push(g.store.yr);
    assert.equal(g.refYr, g.store.yr);
    assert.equal(g.aliens.reduce((a, b) => a + b, 0), 55);
  }
  assert.deepEqual(seen, [0x78, 0x60, 0x50, 0x48, 0x48, 0x48, 0x40, 0x40, 0x40, 0x60]);
});

test('I3: 3 lives; one extra life at 1,500, once', () => {
  const g = playing();
  assert.equal(g.livesDigit, 3);
  assert.equal(g.ships, 2, 'one ship is the cannon');
  g.score = 1490;
  const ev = hitAlien(g, 0);
  assert.equal(g.score, 1500);
  assert.equal(g.ships, 3);
  assert.equal(g.livesDigit, 4);
  assert.equal(ev.filter((e) => e.type === 'extraLife').length, 1);
  run(g, 40);
  hitAlien(g, 1);
  run(g, 40);
  assert.equal(g.ships, 3, 'no second extra life');
});

test('I10: losing the last life ends the game', () => {
  const g = playing();
  g.ships = 0;
  g.playerAlive = 0;
  const f = runUntil(g, (s, ev) => ev.some((e) => e.type === 'gameOver'));
  assert.ok(f >= 60 && f < 70, `blow-up takes 12 x 5 ticks, took ${f}`);
  assert.equal(g.phase, 'over');
  assert.equal(g.livesDigit, 0);
});

test('I10: a life is lost on a hit while ships remain', () => {
  const g = playing();
  const before = g.ships;
  g.playerAlive = 0;
  runUntil(g, (s, ev) => ev.some((e) => e.type === 'lifeLost'));
  assert.equal(g.ships, before - 1);
  assert.equal(g.phase, 'play');
});

test('I10: an alien that reaches Yr below 0x28 ends the game', () => {
  const g = playing();
  g.refYr = 0x20;
  runUntil(g, (s) => s.phase === 'invaded', IDLE, 200);
  runUntil(g, (s, ev) => ev.some((e) => e.type === 'gameOver'), IDLE, 500);
  assert.equal(g.phase, 'over');
});

test('I8: a player shot erodes a shield', () => {
  const g = playing();
  runUntil(g, (s) => s.playerXr === 0x42, { right: true });
  const before = shieldPixels(g);
  run(g, 2, IDLE);
  run(g, 2, { fire: true });
  runUntil(g, (s) => s.shot.status === 0, IDLE, 200);
  const after = shieldPixels(g);
  assert.ok(after < before, `shield pixels ${before} -> ${after}`);
});

test('I8: aliens erase shield pixels when they reach the shield rows', () => {
  const g = playing();
  const before = shieldPixels(g);
  g.refYr = 0x30;   // row 0 on the lower shield half
  run(g, 60);
  const after = shieldPixels(g);
  assert.ok(after < before - 50, `shield pixels ${before} -> ${after}`);
});

test('Coordinates: bottom line at screen y 239, cannon at y 216 to 223', () => {
  const g = playing();
  for (let x = 0; x < 224; x++) assert.equal(R.pixel(g, x, 239), 1);
  let lit = 0;
  for (let y = 216; y < 224; y++) for (let x = 0x30 - 0x20; x < 0x30 - 0x20 + 16; x++) lit += R.pixel(g, x, y);
  assert.ok(lit > 40, 'cannon pixels are lit');
  for (let x = 0x10; x < 0x20; x++) assert.equal(R.pixel(g, x, 215), 0, 'nothing above the cannon');
});

test('I11: the score caps at 9,999', () => {
  const g = playing();
  g.score = 9995;
  hitAlien(g, 0);
  assert.equal(g.score, 9999);
});

test('CodeBug1 fix: a hit outside the rack never kills an alien', () => {
  const g = playing();
  for (let i = 0; i < 55; i++) g.aliens[i] = i === 44 ? 1 : 0;   // only row 4, column 0
  // A shot far right of the rack in row 3 must not map to alien 44.
  Object.assign(g.shot, { status: 2, yr: (g.refYr + 48) & 0xFF, xr: (g.refXr + 11 * 16 + 4) & 0xFF });
  g.alienExploding = 1;
  run(g, 1);
  assert.equal(g.aliens[44], 1);
  assert.equal(g.shot.status, 3);
});

test('IK1: the cannon moves 1 px per frame and stops at Xr 0x30 and 0xD9', () => {
  const g = playing();
  const x0 = g.playerXr;
  run(g, 10, { right: true });
  assert.equal(g.playerXr - x0, 10);
  run(g, 300, { right: true });
  assert.equal(g.playerXr, 0xD9);
  run(g, 400, { left: true });
  assert.equal(g.playerXr, 0x30);
});
