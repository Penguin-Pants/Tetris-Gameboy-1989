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

// Ends the current match with the given final score.
function endMatch(app, left, right) {
  const m = app.match;
  const leftWins = left > right;
  m.score = { left: leftWins ? left - 1 : left, right: leftWins ? right : right - 1 };
  m.serveTimer = 0;
  Object.assign(m.ball, leftWins ? { x: 370, y: 20, dir: 1, vy: 0 } : { x: 2, y: 20, dir: -1, vy: 0 });
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
  m.winner = 'left'; m.score = { left: 11, right: 0 };
  assert.equal(A.marginOf(m), 11);
  m.score = { left: 11, right: 10 };
  assert.equal(A.marginOf(m), 1);
  m.winner = 'right'; m.score = { left: 3, right: 11 };
  assert.equal(A.marginOf(m), 0);

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
