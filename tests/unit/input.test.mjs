import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGB } from '../helpers/load-logic.mjs';
import { sequence } from '../helpers/game-helpers.mjs';

const GB = loadGB();
const A = GB.APP;

const key = (code, extra = {}) => ({ code, repeat: false, ctrlKey: false, altKey: false, metaKey: false, ...extra });
const mkInput = (b = A.DEFAULT_BINDINGS) => A.createInput(() => b);

test('K2: default bindings', () => {
  assert.deepEqual({ ...A.DEFAULT_BINDINGS }, {
    left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', rotate: 'ArrowUp', start: 'Enter', music: 'KeyM'
  });
  assert.deepEqual([...A.ACTIONS], ['left', 'right', 'down', 'rotate', 'start', 'music']);
});

test('K2: keys map to actions with held state and press edges', () => {
  const inp = mkInput();
  inp.keyDown(key('ArrowLeft'));
  let f = inp.frame();
  assert.equal(f.held.left, true);
  assert.equal(f.pressed.left, true);
  f = inp.frame();
  assert.equal(f.held.left, true);
  assert.equal(f.pressed.left, false);
  inp.keyUp(key('ArrowLeft'));
  f = inp.frame();
  assert.equal(f.held.left, false);
  for (const [code, action] of [['ArrowRight', 'right'], ['ArrowDown', 'down'], ['ArrowUp', 'rotate'], ['Enter', 'start'], ['KeyM', 'music']]) {
    inp.keyDown(key(code));
    assert.equal(inp.frame().pressed[action], true, code);
    inp.keyUp(key(code));
  }
});

test('E6: OS key-repeat events are ignored', () => {
  const inp = mkInput();
  inp.keyDown(key('ArrowUp'));
  inp.frame();
  assert.equal(inp.keyDown(key('ArrowUp', { repeat: true })), true, 'still prevents default');
  assert.equal(inp.frame().pressed.rotate, false);
});

test('I2: Ctrl, Alt and Meta combos are ignored and not blocked', () => {
  const inp = mkInput();
  for (const mod of ['ctrlKey', 'altKey', 'metaKey']) {
    assert.equal(inp.keyDown(key('ArrowLeft', { [mod]: true })), false);
    assert.equal(inp.frame().held.left, false, mod);
  }
  // Shift alone is a normal key.
  assert.equal(inp.keyDown(key('ArrowLeft', { shiftKey: true })), true);
  assert.equal(inp.frame().held.left, true);
});

test('K5/E5: blur clears held state', () => {
  const inp = mkInput();
  inp.keyDown(key('ArrowRight'));
  inp.clear();
  const f = inp.frame();
  assert.equal(f.held.right, false);
  assert.equal(f.pressed.right, false);
});

test('preventDefault for bound keys and all arrows, not for other keys', () => {
  const inp = mkInput({ ...A.DEFAULT_BINDINGS, rotate: 'Space' });
  assert.equal(inp.keyDown(key('ArrowUp')), true, 'unbound arrow still blocked (no scroll)');
  assert.equal(inp.keyDown(key('Space')), true);
  assert.equal(inp.keyDown(key('KeyQ')), false);
  assert.equal(inp.keyUp(key('KeyQ')), false);
});

test('a tap inside one frame counts as held for that frame', () => {
  const inp = mkInput();
  inp.keyDown(key('ArrowLeft'));
  inp.keyUp(key('ArrowLeft'));
  const f = inp.frame();
  assert.equal(f.held.left, true);
  assert.equal(inp.frame().held.left, false);
});

test('live binding table: a swapped table takes effect at once', () => {
  const b = { ...A.DEFAULT_BINDINGS };
  const inp = A.createInput(() => b);
  b.rotate = 'Space';
  inp.keyDown(key('Space'));
  assert.equal(inp.frame().pressed.rotate, true);
  inp.keyDown(key('ArrowUp'));
  assert.equal(inp.frame().pressed.rotate, false);
});

const frame = (pressed = {}, held = {}) => ({
  pressed: { left: false, right: false, down: false, rotate: false, start: false, music: false, ...pressed },
  held: { left: false, right: false, down: false, rotate: false, start: false, music: false, ...held }
});

test('I6: start toggles pause; a paused game does not advance', () => {
  const play = A.createPlay({ startLevel: 0, rng: sequence([2, 1, 1]) });
  play.step(frame());
  const f0 = play.game.frame;
  play.step(frame({ start: true }));
  assert.equal(play.paused, true);
  for (let i = 0; i < 100; i++) play.step(frame({}, { down: true }));
  assert.equal(play.game.frame, f0);
  // As in the ROM (bank_000.s $1bce), the unpause frame runs game logic.
  play.step(frame({ start: true }));
  assert.equal(play.paused, false);
  assert.equal(play.game.frame, f0 + 1);
});

test('E5: pause() from blur or hidden tab pauses the game', () => {
  const play = A.createPlay({ startLevel: 0, rng: sequence([2, 1, 1]) });
  play.pause();
  assert.equal(play.paused, true);
});

test('G7: play session starts at level 0 and passes the rotate edge only', () => {
  const play = A.createPlay({ startLevel: 0, rng: sequence([6, 1, 1, 1]) });
  assert.equal(play.game.level, 0);
  play.step(frame({}, { rotate: true }));
  assert.equal(play.game.rot, 0, 'held rotate without a press edge does nothing');
  play.step(frame({ rotate: true }, { rotate: true }));
  assert.equal(play.game.rot, 3);
});

test('Phase 4 stub: start restarts after game over', () => {
  const play = A.createPlay({ startLevel: 0, rng: sequence([3, 3, 3, 3]) });
  play.game.over = true;
  play.step(frame({ start: true }));
  assert.equal(play.game.over, false);
});
