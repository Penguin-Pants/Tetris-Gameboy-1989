import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, seeded } from '../helpers/load-arcade.mjs';

const { PONG } = loadGame('pong.html', 'PONG');
const { CONST: C, RULES: R } = PONG;
const still = { left: 0, right: 0 };

// A live match with the ball placed and the serve done.
function liveMatch(ball, extra = {}) {
  const m = R.createMatch();
  m.serveTimer = 0;
  Object.assign(m.ball, ball);
  Object.assign(m, extra);
  return m;
}

function runUntil(m, pred, input = still, limit = 5000) {
  for (let f = 1; f <= limit; f++) {
    const ev = R.step(m, typeof input === 'function' ? input(m) : input);
    if (pred(ev, m)) return { f, ev };
  }
  throw new Error('limit');
}
const has = (t) => (ev) => ev.some((e) => e.type === t);

test('P3: each of the 8 paddle segments gives its vertical velocity; center segments give 0', () => {
  const want = [-3, -2, -1, 0, 0, 1, 2, 3];
  for (let seg = 0; seg < 8; seg++) {
    const py = 100;
    // Ball center line on the segment: ball.y + 2 = py + 2 * seg.
    const m = liveMatch({ x: C.LEFT_X + C.PADDLE_W + 1, y: py + 2 * seg - 2, dir: -1, vy: 0 });
    m.paddles.left = py;
    const ev = R.step(m, still);
    assert.ok(has('paddleHit')(ev), `segment ${seg} hit`);
    assert.equal(m.ball.vy, want[seg], `segment ${seg}`);
    assert.equal(m.ball.dir, 1, 'the hit sends the ball away');
  }
  assert.equal(new Set(want).size, 7, 'seven vertical velocities');
});

test('P4: speed 2 for hits 0-3, 3 for 4-11, 4 from 12; a miss resets it', () => {
  for (let h = 0; h <= 14; h++) assert.equal(R.speedFor(h), h < 4 ? 2 : h < 12 ? 3 : 4, `hits ${h}`);
  // Rally with both paddles tracking the ball, then count hits.
  const m = liveMatch({ x: 180, y: 120, dir: -1, vy: 0 });
  const track = (mm) => {
    const target = mm.ball.y - 6;
    return { left: target - mm.paddles.left, right: target - mm.paddles.right };
  };
  runUntil(m, () => m.hits >= 12, track, 20000);
  runUntil(m, has('paddleHit'), track, 20000);
  assert.equal(m.hits, 12, 'the counter stops at 12');
  for (let i = 0; i < 10; i++) {
    const x0 = m.ball.x;
    const ev = R.step(m, track(m));
    if (!has('paddleHit')(ev)) { assert.equal(Math.abs(m.ball.x - x0), 4, 'speed 4 at 12 hits'); break; }
  }
  // Miss: stop the left paddle far from the ball.
  m.paddles.left = m.ball.y > 120 ? C.PADDLE_MIN_Y : R.PADDLE_MAX_Y;
  runUntil(m, has('point'), (mm) => ({ left: 0, right: track(mm).right }), 5000);
  assert.equal(m.hits, 0);
});

test('P5: the paddle top never goes above PADDLE_MIN_Y; the bottom is reachable', () => {
  const m = R.createMatch();
  for (let i = 0; i < 200; i++) R.step(m, { left: -9, right: 9 });
  assert.equal(m.paddles.left, C.PADDLE_MIN_Y);
  assert.equal(m.paddles.right, C.H - C.PADDLE_H);
  assert.ok(C.PADDLE_MIN_Y > 0);
});

test('Wall bounce inverts vertical velocity; the ball never leaves y 0 to 245', () => {
  const m = liveMatch({ x: 180, y: 1, dir: 1, vy: -3 });
  const ev = R.step(m, still);
  assert.ok(has('wallHit')(ev));
  assert.equal(m.ball.vy, 3);
  assert.ok(m.ball.y >= 0);
  const m2 = liveMatch({ x: 180, y: C.H - C.BALL - 1, dir: 1, vy: 3 });
  assert.ok(has('wallHit')(R.step(m2, still)));
  assert.equal(m2.ball.vy, -3);
  assert.ok(m2.ball.y + C.BALL <= C.H);
});

test('P6: the serve goes toward the side that missed, after the delay, keeping y and vy', () => {
  for (const dir of [-1, 1]) {
    const m = liveMatch({ x: dir < 0 ? 10 : 360, y: 37, dir, vy: 2 });
    m.paddles.left = m.paddles.right = R.PADDLE_MAX_Y;
    const { ev } = runUntil(m, has('point'));
    const pt = ev.find((e) => e.type === 'point');
    assert.equal(pt.scorer, dir < 0 ? 'right' : 'left');
    const yAtMiss = m.ball.y, vyAtMiss = m.ball.vy;
    assert.equal(R.ballVisible(m), false);
    const { f } = runUntil(m, has('serve'));
    assert.equal(f, C.SERVE_FRAMES, 'serve waits the delay');
    assert.equal(m.ball.dir, dir, 'toward the side that missed');
    assert.equal(m.ball.x, C.SERVE_X);
    assert.equal(m.ball.y, yAtMiss, 'y kept');
    assert.equal(m.ball.vy, vyAtMiss, 'vy kept');
    assert.ok(yAtMiss !== (C.H - C.BALL) >> 1 && vyAtMiss !== 0);
  }
});

test('P2: the match ends when a side reaches 11, also at 11-10 (no win-by-two)', () => {
  const m = R.createMatch();
  m.score = { left: 10, right: 10 };
  m.serveTimer = 0;
  Object.assign(m.ball, { x: 6, y: 30, dir: -1, vy: 0 });
  m.paddles.left = R.PADDLE_MAX_Y;
  const { ev } = runUntil(m, has('matchOver'));
  assert.equal(m.over, true);
  assert.equal(m.winner, 'right');
  assert.deepEqual(m.score, { left: 10, right: 11 });
  assert.ok(ev.some((e) => e.type === 'point'));
  assert.deepEqual(R.step(m, still), []);
});

test('R6: the first serve goes toward the player with vy +1 after the delay', () => {
  const m = R.createMatch();
  const { f } = runUntil(m, has('serve'));
  assert.equal(f, C.SERVE_FRAMES);
  assert.equal(m.ball.dir, -1);
  assert.equal(m.ball.vy, 1);
});

test('Fuzz: 1,000 seeded random matches finish with valid state', () => {
  const rng = seeded(7);
  for (let g = 0; g < 1000; g++) {
    const m = R.createMatch();
    let frames = 0;
    while (!m.over && frames < 200000) {
      const mv = () => Math.floor(rng() * 9) - 4;
      R.step(m, { left: mv(), right: mv() });
      frames++;
      if (R.ballVisible(m)) {
        assert.ok(m.ball.y >= 0 && m.ball.y <= C.H - C.BALL, 'ball y in field');
        assert.ok(Math.abs(m.ball.vy) <= 3);
      }
      assert.ok(m.paddles.left >= C.PADDLE_MIN_Y && m.paddles.left <= R.PADDLE_MAX_Y);
      assert.ok(m.hits >= 0 && m.hits <= 12);
    }
    assert.equal(m.over, true, `match ${g} ends`);
    assert.equal(Math.max(m.score.left, m.score.right), 11);
  }
});
