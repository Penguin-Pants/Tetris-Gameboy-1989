import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, seeded } from '../helpers/load-arcade.mjs';

const { PONG } = loadGame('pong.html', 'PONG');
const { APP: A, RULES: R } = PONG;

const ACTIONS = ['up', 'down', 'start', 'sound'];
function frame(pressed = []) {
  const p = {}, h = {};
  for (const a of ACTIONS) { p[a] = pressed.includes(a); h[a] = p[a]; }
  return { pressed: p, held: h };
}
const idle = frame();

test('PK1: Up and Down move the right paddle; the CPU moves the left', () => {
  const app = A.createApp({ rng: seeded(1), store: null });
  app.step(frame(['start']));
  app.cpu = { move: () => 0 };
  const { left, right } = app.match.paddles;
  for (let i = 0; i < 5; i++) app.step(frame(['down']));
  assert.equal(app.match.paddles.right, right + 5 * A.PLAYER_SPEED);
  assert.equal(app.match.paddles.left, left);
  app.cpu = { move: () => -2 };
  app.step(idle);
  assert.equal(app.match.paddles.left, left - 2);
});

// Ends the current match with the given final score.
// The player is on the right, the CPU on the left.
function endMatch(app, player, cpu) {
  const m = app.match;
  const playerWins = player > cpu;
  m.score = { left: playerWins ? cpu : cpu - 1, right: playerWins ? player - 1 : player };
  m.serveTimer = 0;
  Object.assign(m.ball, playerWins ? { x: 2, y: 20, dir: -1, vy: 0 } : { x: 370, y: 20, dir: 1, vy: 0 });
  m.paddles = { left: R.PADDLE_MAX_Y, right: R.PADDLE_MAX_Y };
  for (let i = 0; i < 10 && !m.over; i++) app.step(idle);
  assert.equal(m.over, true);
}

function skipFinal(app) {
  for (let i = 0; i < A.FINAL_FRAMES + 1 && app.screen === 'final'; i++) app.step(idle);
}

test('PH1/PH2: the score is the winning margin; a loss gives no entry', () => {
  const m = R.createMatch();
  m.over = true;
  m.winner = 'right'; m.score = { left: 0, right: 11 };
  assert.equal(A.marginOf(m), 11);
  m.score = { left: 10, right: 11 };
  assert.equal(A.marginOf(m), 1);
  m.winner = 'left'; m.score = { left: 11, right: 3 };
  assert.equal(A.marginOf(m), 0, 'a CPU win gives no score');

  const app = A.createApp({ rng: seeded(1), store: null });
  app.step(frame(['start']));
  endMatch(app, 4, 11);
  skipFinal(app);
  assert.equal(app.screen, 'title', 'a loss never reaches name entry');
  assert.deepEqual(app.scores, []);
});

test('PF1: difficulty selector moves with Up and Down, no wrap, Normal by default', () => {
  const app = A.createApp({ rng: seeded(1), store: null });
  assert.equal(app.level, 'normal');
  app.step(frame(['down']));
  assert.equal(app.level, 'hard');
  app.step(frame(['down']));
  assert.equal(app.level, 'hard', 'no wrap at the end');
  app.step(frame(['up'])); app.step(frame(['up'])); app.step(frame(['up']));
  assert.equal(app.level, 'easy', 'no wrap at the start');
  app.step(frame(['start']));
  assert.equal(app.screen, 'play');
  assert.deepEqual(app.cpu.move.length, 1);
});

test('PF2/PF3/S7: a qualifying win goes final, then name entry; Up and Down change letters', () => {
  const app = A.createApp({ rng: seeded(2), store: null });
  app.step(frame(['start']));
  endMatch(app, 11, 6);
  assert.equal(app.screen, 'final');
  for (let i = 0; i < A.FINAL_FRAMES - 1; i++) app.step(idle);
  assert.equal(app.screen, 'final', 'final screen holds 3 s');
  app.step(idle);
  assert.equal(app.screen, 'nameEntry');
  app.step(frame(['up']));            // A -> B
  app.step(frame(['start']));
  app.step(frame(['down']));          // A -> Z
  app.step(frame(['start']));
  app.step(frame(['start']));
  assert.equal(app.screen, 'title');
  assert.deepEqual(app.scores, [{ name: 'BZA', score: 5 }]);
});

test('Footer keys follow the screen', () => {
  const app = A.createApp({ rng: seeded(1), store: null });
  assert.equal(app.footerKeys()[0][1], 'LEVEL');
  app.step(frame(['start']));
  assert.equal(app.footerKeys()[0][1], 'MOVE');
  endMatch(app, 11, 2);
  assert.equal(app.screen, 'final');
  assert.deepEqual(app.footerKeys(), [], 'the final score takes no keys');
});

test('S11/E4: blur pauses the final-score hold; it resumes when the page is back', () => {
  const app = A.createApp({ rng: seeded(3), store: null });
  app.step(frame(['start']));
  endMatch(app, 11, 3);
  app.pause();
  assert.equal(app.audioPaused(), true);
  for (let i = 0; i < A.FINAL_FRAMES * 2; i++) app.step(idle);
  assert.equal(app.screen, 'final', 'the hold does not count down while paused');
  app.resume();
  assert.equal(app.audioPaused(), false);
  skipFinal(app);
  assert.equal(app.screen, 'nameEntry');
});
