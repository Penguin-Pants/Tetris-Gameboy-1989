import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGB } from '../helpers/load-logic.mjs';
import { sequence } from '../helpers/game-helpers.mjs';

const GB = loadGB();
const { APP: A, VIEW: V, CONST: C } = GB;

const ACTIONS = ['left', 'right', 'down', 'rotate', 'start', 'music'];
function frame(pressed = []) {
  const p = {}, h = {};
  for (const a of ACTIONS) { p[a] = pressed.includes(a); h[a] = p[a]; }
  return { pressed: p, held: h };
}
const idle = frame();

test('F2/K3: level-select navigation over all cells', () => {
  const exp = {
    right: [1, 2, 3, 4, 5, 6, 7, 8, 9, 9],
    left: [0, 0, 1, 2, 3, 4, 5, 6, 7, 8],
    rotate: [0, 1, 2, 3, 4, 0, 1, 2, 3, 4],
    down: [5, 6, 7, 8, 9, 5, 6, 7, 8, 9]
  };
  for (const [dir, want] of Object.entries(exp)) {
    for (let lv = 0; lv < 10; lv++) {
      assert.equal(A.levelSelectMove(lv, frame([dir]).pressed), want[lv], `${dir} from ${lv}`);
    }
  }
  for (let lv = 0; lv < 10; lv++) assert.equal(A.levelSelectMove(lv, idle.pressed), lv);
});

test('F1..F4: transition table', () => {
  const app = A.createApp({ rng: sequence([3, 3, 3, 3]) });
  assert.equal(app.screen, 'title');
  for (const a of ['left', 'right', 'down', 'rotate', 'music']) {
    app.step(frame([a]));
    assert.equal(app.screen, 'title', `title ignores ${a}`);
  }
  app.step(frame(['start']));
  assert.equal(app.screen, 'levelSelect');
  app.step(frame(['down']));
  assert.equal(app.level, 5);
  app.step(frame(['start']));
  assert.equal(app.screen, 'play');
  assert.equal(app.play.game.level, 5);
  // Pause and resume stay on play.
  app.step(frame(['start']));
  assert.equal(app.play.paused, true);
  app.step(frame(['start']));
  assert.equal(app.play.paused, false);
  // Game over goes to the banner.
  app.play.game.over = true;
  app.step(idle);
  assert.equal(app.screen, 'gameOver');
  // Start is ignored for the first second.
  for (let i = 0; i < A.GAME_OVER_SKIP - 2; i++) app.step(frame(['start']));
  assert.equal(app.screen, 'gameOver');
  app.step(idle); app.step(frame(['start']));
  assert.equal(app.screen, 'title');
});

test('I4: game over banner times out to the title after 3 seconds', () => {
  const app = A.createApp({ rng: sequence([3]) });
  app.go('levelSelect'); app.go('play');
  app.play.game.over = true;
  app.step(idle);
  assert.equal(app.screen, 'gameOver');
  for (let i = 0; i < A.GAME_OVER_FRAMES - 1; i++) app.step(idle);
  assert.equal(app.screen, 'gameOver');
  app.step(idle);
  assert.equal(app.screen, 'title');
  assert.equal(A.GAME_OVER_FRAMES, 179);
  assert.equal(A.GAME_OVER_SKIP, 60);
});

test('I7: level select has no back action', () => {
  const app = A.createApp({ rng: sequence([3]) });
  app.go('levelSelect');
  for (const a of ['left', 'right', 'down', 'rotate', 'music']) app.step(frame([a]));
  assert.equal(app.screen, 'levelSelect');
});

test('F3/G5: starting at level N uses level N gravity', () => {
  for (const n of [0, 5, 9]) {
    const app = A.createApp({ rng: sequence([3]) });
    app.go('levelSelect');
    app.level = n;
    app.step(frame(['start']));
    assert.equal(app.play.game.level, n);
    assert.equal(app.play.game.gravReload, C.GRAVITY[n] - 1);
  }
});

test('blur pauses only during play', () => {
  const app = A.createApp({ rng: sequence([3]) });
  app.pause();
  assert.equal(app.screen, 'title');
  app.go('levelSelect'); app.go('play');
  app.pause();
  assert.equal(app.play.paused, true);
});

test('level select flashes the chosen digit every 16 frames', () => {
  const app = A.createApp({ rng: sequence([3]) });
  app.go('levelSelect');
  const seen = [];
  for (let i = 0; i < 48; i++) { seen.push(app.blinkOn); app.step(idle); }
  assert.deepEqual([seen[0], seen[15], seen[16], seen[31], seen[32]], [true, true, false, false, true]);
});

function cellInked(fb, col, row) {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (fb[(row * 8 + y) * 160 + col * 8 + x] !== 0) return true;
  return false;
}

test('F1/C1: title shows 1PLAYER and the notice, and no 2 PLAYER text', () => {
  const fb = V.createFramebuffer();
  V.renderTitle(fb);
  for (let c = 2; c <= 8; c++) assert.ok(cellInked(fb, c, 14), `1PLAYER col ${c}`);
  for (let c = 10; c <= 19; c++) assert.ok(!cellInked(fb, c, 14), `2 PLAYER slot col ${c} empty`);
  for (let c = 3; c <= 16; c++) if (c !== 8) assert.ok(cellInked(fb, c, 16), `notice col ${c}`);
});

test('Golden framebuffers: title and level select', () => {
  const t = V.createFramebuffer(); V.renderTitle(t);
  const l = V.createFramebuffer(); V.renderLevelSelect(l, 0, true, []);
  const l5 = V.createFramebuffer(); V.renderLevelSelect(l5, 5, false, []);
  assert.deepEqual({ title: V.hash(t), select: V.hash(l), select5: V.hash(l5) }, GOLDEN);
});

// Regression guards only. Update after an intended art change.
const GOLDEN = { title: '0b1a602b', select: 'cf3f4da3', select5: 'd3aa4197' };
