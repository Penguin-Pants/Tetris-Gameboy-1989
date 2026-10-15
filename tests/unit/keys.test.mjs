import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGB } from '../helpers/load-logic.mjs';
import { sequence } from '../helpers/game-helpers.mjs';

const GB = loadGB();
const { APP: A, VIEW: V } = GB;
const D = A.DEFAULT_BINDINGS;

const ACTIONS = ['left', 'right', 'down', 'rotate', 'start', 'music'];
function frame(pressed = [], codes = []) {
  const p = {}, h = {};
  for (const a of ACTIONS) { p[a] = pressed.includes(a); h[a] = p[a]; }
  return { pressed: p, held: h, codes };
}

function memStore() {
  const data = new Map();
  return A.createStore(() => ({
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  }));
}

test('E3: binding validation matrix', () => {
  assert.deepEqual({ ...A.checkBinding(D, 'rotate', 'Space') }, { ok: true, reason: '' });
  assert.deepEqual({ ...A.checkBinding(D, 'rotate', 'ArrowUp') }, { ok: true, reason: '' }, 'same key, same action');
  assert.equal(A.checkBinding(D, 'rotate', 'ArrowLeft').reason, 'KEY IN USE');
  for (const r of ['KeyH', 'KeyK', 'Escape']) assert.equal(A.checkBinding(D, 'left', r).reason, 'RESERVED KEY');
  assert.equal(A.checkBinding(D, 'left', '').ok, false);
  assert.equal(A.checkBinding(D, 'left', 'ShiftLeft').ok, true, 'Shift alone is bindable (I2)');
});

test('K4/E3: load validation falls back to defaults', () => {
  const ok = { ...D, rotate: 'Space' };
  assert.deepEqual(A.validateBindings(ok), ok);
  const missing = { ...D }; delete missing.music;
  assert.deepEqual(A.validateBindings(missing), { ...D });
  assert.deepEqual(A.validateBindings({ ...D, music: 'ArrowUp' }), { ...D }, 'duplicate');
  assert.deepEqual(A.validateBindings({ ...D, music: 'KeyK' }), { ...D }, 'reserved');
  assert.deepEqual(A.validateBindings({ ...D, music: 5 }), { ...D }, 'wrong type');
  assert.deepEqual(A.validateBindings(null), { ...D });
  assert.deepEqual(A.validateBindings('x'), { ...D });
});

test('K1: key label table', () => {
  const table = {
    ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN',
    KeyX: 'X', KeyM: 'M', Digit7: '7', Enter: 'ENTER', Space: 'SPACE',
    ShiftLeft: 'SHIFTLEF', NumpadEnter: 'NUMPADEN', Semicolon: 'SEMICOLO'
  };
  for (const [code, label] of Object.entries(table)) assert.equal(A.keyLabel(code), label, code);
  for (const code of Object.keys(table)) {
    for (const ch of A.keyLabel(code)) assert.ok(GB.DATA.FONT[ch], `glyph ${ch}`);
  }
});

test('F6/K1: K opens Keys from the title only; Esc returns', () => {
  const app = A.createApp({ rng: sequence([3]), store: memStore() });
  app.step(frame([], ['KeyK']));
  assert.equal(app.screen, 'keys');
  app.step(frame([], ['Escape']));
  assert.equal(app.screen, 'title');
  app.go('levelSelect');
  app.step(frame([], ['KeyK']));
  assert.equal(app.screen, 'levelSelect');
});

test('K1/K4: every action remaps and persists', () => {
  const store = memStore();
  const app = A.createApp({ rng: sequence([3]), store });
  app.go('keys');
  const newKeys = ['KeyA', 'KeyD', 'KeyS', 'Space', 'KeyP', 'KeyN'];
  for (let i = 0; i < 6; i++) {
    app.step(frame([], ['Enter']));
    assert.equal(app.keys.capturing, true);
    app.step(frame([], [newKeys[i]]));
    assert.equal(app.keys.capturing, false);
    app.step(frame([], ['ArrowDown']));
  }
  const want = { left: 'KeyA', right: 'KeyD', down: 'KeyS', rotate: 'Space', start: 'KeyP', music: 'KeyN' };
  assert.deepEqual(app.bindings, want);
  const again = A.createApp({ rng: sequence([3]), store });
  assert.deepEqual(again.bindings, want);
});

test('E3: duplicate and reserved keys are rejected; the old binding stays', () => {
  const app = A.createApp({ rng: sequence([3]), store: memStore() });
  app.go('keys');
  app.step(frame([], ['Enter', 'ArrowRight'])); // left -> ArrowRight (in use)
  assert.equal(app.keys.message, 'KEY IN USE');
  assert.equal(app.bindings.left, 'ArrowLeft');
  app.step(frame([], ['Enter', 'KeyH']));
  assert.equal(app.keys.message, 'RESERVED KEY');
  assert.equal(app.bindings.left, 'ArrowLeft');
  app.step(frame([], ['Enter', 'Escape'])); // Esc cancels capture, stays on screen
  assert.equal(app.screen, 'keys');
  assert.equal(app.bindings.left, 'ArrowLeft');
});

test('E3: RESET restores defaults; navigation never depends on bindings', () => {
  const app = A.createApp({ rng: sequence([3]), store: memStore() });
  app.bindings = { left: 'ArrowDown', right: 'ArrowUp', down: 'Enter', rotate: 'KeyQ', start: 'KeyW', music: 'KeyE' };
  app.go('keys');
  // Fixed arrows still navigate: ArrowUp from row 0 wraps to RESET.
  app.step(frame([], ['ArrowUp']));
  assert.equal(A.KEY_ROWS[app.keys.row], 'reset');
  app.step(frame([], ['Enter']));
  assert.deepEqual(app.bindings, { ...D });
});

test('K3: menus follow the new bindings', () => {
  const app = A.createApp({ rng: sequence([3]), store: memStore() });
  app.bindings = { ...D, start: 'KeyP', right: 'KeyD' };
  const inp = A.createInput(() => app.bindings);
  const key = (code) => ({ code, repeat: false, ctrlKey: false, altKey: false, metaKey: false });
  inp.keyDown(key('Enter')); app.step(inp.frame()); inp.keyUp(key('Enter'));
  assert.equal(app.screen, 'title', 'old start key does nothing');
  inp.keyDown(key('KeyP')); app.step(inp.frame()); inp.keyUp(key('KeyP'));
  assert.equal(app.screen, 'levelSelect');
  inp.keyDown(key('KeyD')); app.step(inp.frame());
  assert.equal(app.level, 1);
});

test('Golden framebuffer: Keys screen', () => {
  const ks = A.createKeysScreen(() => D, () => {});
  const fb = V.createFramebuffer();
  V.renderKeys(fb, ks, D);
  assert.equal(V.hash(fb), GOLDEN);
});

// Regression guard only.
const GOLDEN = 'da7e849b';
