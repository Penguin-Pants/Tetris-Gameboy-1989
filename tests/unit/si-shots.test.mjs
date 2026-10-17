// Space Invaders alien shots and saucer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from '../helpers/load-arcade.mjs';

const { SI } = loadGame('space-invaders.html', 'SI');
const R = SI.RULES, C = SI.CONST;
const IDLE = Object.freeze({});
const KINDS = ['rol', 'plu', 'squ'];

function run(g, n, input = IDLE) {
  const ev = [];
  for (let i = 0; i < n; i++) ev.push(...R.step(g, input));
  return ev;
}

function runUntil(g, pred, input = IDLE, limit = 20000) {
  for (let f = 1; f <= limit; f++) {
    const ev = R.step(g, input);
    if (pred(g, ev)) return f;
  }
  throw new Error('runUntil: limit reached');
}

function playing() {
  const g = R.createGame();
  runUntil(g, (s) => s.phase === 'play' && s.obj[0].timer === 0);
  run(g, 2);
  return g;
}

// Runs a long game that never ends: ships refill and the rack does not drop.
// each(g) runs after every frame.
function longRun(g, frames, each) {
  for (let i = 0; i < frames; i++) {
    g.ships = 2;
    g.refDY = 0;
    R.step(g, IDLE);
    each(g);
  }
}

// Column a new shot came from. The rack may have moved 2 or 3 pixels in
// the same frame, so round to the nearest column.
function shotColumn(s, shot) {
  let d = (shot.xr - 7 - s.refXr) & 0xFF;
  if (d >= 240) d -= 256;
  return Math.round(d / 16) + 1;
}

// Records alien shot spawns: { kind, col, playerCol, frame }.
function spawns(g, frames) {
  const out = [], was = {};
  longRun(g, frames, (s) => {
    for (const k of KINDS) {
      const active = (s[k].status & 0x80) !== 0;
      if (active && !was[k]) {
        out.push({
          kind: k, frame: s.frame,
          col: shotColumn(s, s[k]),
          playerCol: Math.min(11, R.findColumn(s, (s.playerXr + 8) & 0xFF))
        });
      }
      was[k] = active;
    }
  });
  return out;
}

function shieldPixels(g) {
  let n = 0;
  for (let y = 192; y < 208; y++) for (let x = 0; x < 224; x++) n += R.pixel(g, x, y);
  return n;
}

test('I6: plunger and squiggly columns follow the ROM tables and wrap', () => {
  const sp = spawns(playing(), 40000);
  const plu = sp.filter((s) => s.kind === 'plu').map((s) => s.col).slice(0, 20);
  const squ = sp.filter((s) => s.kind === 'squ').map((s) => s.col).slice(0, 18);
  const T = C.COL_TABLE;
  assert.deepEqual(plu, T.slice(0, 16).concat(T.slice(0, 4)));
  assert.deepEqual(squ, T.slice(6, 21).concat(T.slice(6, 9)));
});

test('I6: the rolling shot fires from the column over the player', () => {
  const g = playing();
  let n = 0;
  const was = {};
  for (let i = 0; i < 20000 && n < 12; i++) {
    g.ships = 2;
    g.refDY = 0;
    const input = (i >> 7) & 1 ? { right: true } : { left: true };
    const pc = Math.min(11, R.findColumn(g, (g.playerXr + 8) & 0xFF));
    R.step(g, input);
    const active = (g.rol.status & 0x80) !== 0;
    if (active && !was.rol) {
      const col = shotColumn(g, g.rol);
      assert.ok(Math.abs(col - pc) <= 1, `rolling col ${col}, player col ${pc}`);
      n++;
    }
    was.rol = active;
  }
  assert.ok(n >= 12);
});

test('I6: reload rate at each bracket edge', () => {
  const want = [[0, 0x30], [299, 0x30], [300, 0x10], [1099, 0x10], [1100, 0x0B], [2099, 0x0B],
    [2100, 0x08], [3099, 0x08], [3100, 0x07], [9999, 0x07]];
  for (const [score, rate] of want) assert.equal(R.reloadRate(score), rate, `score ${score}`);
});

test('I6: alien shots move 4 px every 3 frames (80 px/s), 5 px below 9 aliens', () => {
  const g = playing();
  const steps = { rol: {}, plu: {}, squ: {} }, gaps = {}, last = {}, lastF = {};
  longRun(g, 6000, (s) => {
    for (const k of KINDS) {
      const sh = s[k];
      if ((sh.status & 0x81) === 0x80) {
        if (last[k] !== undefined && sh.yr !== last[k]) {
          const d = (last[k] - sh.yr) & 0xFF;
          steps[k][d] = (steps[k][d] || 0) + 1;
          if (lastF[k] !== undefined) gaps[s.frame - lastF[k]] = (gaps[s.frame - lastF[k]] || 0) + 1;
          lastF[k] = s.frame;
        }
        last[k] = sh.yr;
      } else { last[k] = undefined; lastF[k] = undefined; }
    }
  });
  for (const k of KINDS) assert.deepEqual(Object.keys(steps[k]), ['4'], `${k} steps`);
  assert.deepEqual(Object.keys(gaps), ['3'], 'one move every 3 frames');
  assert.equal(4 * 60 / 3, 80);
  // Below 9 aliens the shots speed up to 5.
  const h = playing();
  for (let i = 8; i < 55; i++) h.aliens[i] = 0;
  run(h, 3);
  assert.equal(h.alienShotDelta, -5);
});

test('I6: the shotSync cycle fires all three shot types', () => {
  const sp = spawns(playing(), 6000);
  const first = new Set(sp.slice(0, 12).map((s) => s.kind));
  assert.deepEqual([...first].sort(), ['plu', 'rol', 'squ']);
});

test('I8: an alien shot that hits a shield clears shield pixels and ends', () => {
  const g = playing();
  const before = shieldPixels(g);
  // A live plunger shot just above shield 2, falling.
  Object.assign(g.plu, { status: 0x80, steps: 1, xr: C.SHIELD_XR[1] + 10, yr: 0x44 });
  g.skipPlunger = 0;
  runUntil(g, (s) => (s.plu.status & 1) !== 0, IDLE, 200);
  runUntil(g, (s) => s.plu.status === 0, IDLE, 200);
  const after = shieldPixels(g);
  assert.ok(after < before, `shield pixels ${before} -> ${after}`);
});

test('I6/I10: a hit on the player starts the explosion and removes a life', () => {
  const g = playing();
  const ships = g.ships;
  Object.assign(g.rol, { status: 0x80, steps: 1, cfir: 0xFFFF, xr: g.playerXr + 6, yr: 0x2A });
  runUntil(g, (s) => s.playerAlive !== 0xFF, IDLE, 50);
  runUntil(g, (s, ev) => ev.some((e) => e.type === 'lifeLost'), IDLE, 200);
  assert.equal(g.ships, ships - 1);
});

test('Player: after a non-final hit the explosion, respawn and fire delay run in sequence', () => {
  const g = playing();
  g.enableAlienFire = 1;
  g.playerAlive = 0;
  const boom = runUntil(g, (s) => s.playerAlive === 0xFF, IDLE, 200);
  assert.ok(boom >= 60 && boom <= 62, `explosion 12 x 5 ticks, took ${boom}`);
  assert.equal(g.enableAlienFire, 0, 'alien fire is off after a hit');
  const back = runUntil(g, (s) => s.obj[0].timer === 0, IDLE, 300);
  assert.ok(back >= 127 && back <= 129, `respawn timer 0x80, took ${back}`);
  const fire = runUntil(g, (s) => s.enableAlienFire === 1, IDLE, 200);
  assert.ok(fire >= 47 && fire <= 50, `alien fire after 0x30 player runs, took ${fire}`);
  assert.equal(g.phase, 'play');
  const x = g.playerXr;
  run(g, 5, { right: true });
  assert.equal(g.playerXr, x + 5, 'play continues');
});

test('I7: saucer timer tests 0 before it counts: first flag on eligible call 1,537', () => {
  const g = playing();
  for (let i = 0; i < 3000; i++) { g.refDY = 0; g.ships = 2; R.step(g, IDLE); }   // rack held at 0x78
  assert.equal(g.tillSaucer, C.SAUCER_TIME);
  assert.equal(g.saucerStart, 0);
  g.refYr = 0x70;
  let calls = 0;
  for (; calls < 1536; calls++) { g.refDY = 0; g.ships = 2; R.step(g, IDLE); assert.equal(g.saucerStart, 0); }
  g.refDY = 0;
  R.step(g, IDLE);
  assert.equal(g.saucerStart, 1, 'flag on call 1,537');
  g.saucerStart = 0;
  for (calls = 0; calls < 1535; calls++) { g.refDY = 0; g.ships = 2; R.step(g, IDLE); assert.equal(g.saucerStart, 0); }
  R.step(g, IDLE);
  assert.equal(g.saucerStart, 1, 'then every 1,536 calls');
});

test('I7: the saucer appears only with 8 or more aliens and no squiggly shot', () => {
  const g = playing();
  for (let i = 7; i < 55; i++) g.aliens[i] = 0;
  g.saucerStart = 1;
  run(g, 120);
  assert.equal(g.saucerActive, 0, '7 aliens: no saucer');
  const h = playing();
  for (let i = 8; i < 55; i++) h.aliens[i] = 0;
  h.saucerStart = 1;
  h.enableAlienFire = 0;
  runUntil(h, (s) => s.saucerActive === 1, IDLE, 120);
  assert.equal(h.squ.steps, 0);
});

test('I7: the saucer side follows the shot count parity', () => {
  const g = playing();
  for (const [count, xr, dx] of [[0, 0x29, 2], [1, 0xE0, -2], [2, 0x29, 2]]) {
    g.shotCount = count;
    g.shot.status = 4;                            // removed shot: EndOfBlowup next run
    runUntil(g, (s) => s.shot.status === 0, IDLE, 10);
    assert.equal(g.saucerXr, xr, `count ${count}`);
    assert.equal(g.saucerDX, dx);
  }
});

// Removes N-1 shots, then hits the saucer with shot N.
function saucerScoreForShot(n) {
  const g = playing();
  for (let k = 1; k < n; k++) {
    g.shot.status = 4;
    runUntil(g, (s) => s.shot.status === 0, IDLE, 10);
  }
  Object.assign(g, { saucerStart: 1, saucerActive: 1, saucerXr: 0x80, saucerDX: 2 });
  g.enableAlienFire = 0;
  Object.assign(g.shot, { status: 2, xr: 0x8C, yr: 0xC4 });
  let pts = null;
  runUntil(g, (s, ev) => {
    const e = ev.find((x) => x.type === 'saucerScore');
    if (e) pts = e.points;
    return pts !== null;
  }, IDLE, 300);
  return pts;
}

test('I7: a saucer hit with shot N scores entry N mod 15 (hitting shot counted)', () => {
  assert.equal(saucerScoreForShot(1), 50);
  assert.equal(saucerScoreForShot(8), 300);
  assert.equal(saucerScoreForShot(15), 100);
  assert.equal(saucerScoreForShot(23), 300);
  assert.deepEqual(C.SAUCER_SCORES, [100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100]);
});

test('Replay: 3 scripted games give fixed scores and screen hashes', () => {
  const hash = (v) => { let h = 2166136261; for (const b of v) h = Math.imul(h ^ b, 16777619) >>> 0; return h; };
  const scripts = [
    (f) => ({ fire: (f >> 2) & 1, right: (f >> 6) & 1, left: !((f >> 6) & 1) }),
    (f) => ({ fire: (f % 40) < 20, left: (f >> 7) & 1, right: !((f >> 7) & 1) }),
    (f) => ({ fire: (f % 9) < 3 })
  ];
  const results = scripts.map((sc) => {
    const g = R.createGame();
    for (let f = 0; f < 6000 && g.phase !== 'over'; f++) R.step(g, sc(f));
    return [g.score, hash(g.vram), g.frame];
  });
  const again = scripts.map((sc) => {
    const g = R.createGame();
    for (let f = 0; f < 6000 && g.phase !== 'over'; f++) R.step(g, sc(f));
    return [g.score, hash(g.vram), g.frame];
  });
  assert.deepEqual(again, results, 'deterministic');
  // Golden [score, screen hash, frame] values from the reviewed engine.
  // Change them only for an intended rules change.
  const GOLDEN = [[300, 2572643301, 3363], [530, 93572649, 5157], [270, 636582142, 2676]];
  assert.deepEqual(results, GOLDEN, 'fixed scores and screen hashes');
  for (const [score] of results) assert.ok(score > 0, 'the scripts score points');
});
