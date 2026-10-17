// Space Invaders screen flow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from '../helpers/load-arcade.mjs';

const { ARCADE, SI } = loadGame('space-invaders.html', 'SI');
const A = SI.APP, V = SI.VIEW;
const ACTIONS = ['left', 'right', 'fire', 'start', 'sound'];

function frame(pressed = []) {
  const p = {}, h = {};
  for (const a of ACTIONS) { p[a] = pressed.includes(a); h[a] = p[a]; }
  return { pressed: p, held: h };
}

function memStore(initial = {}) {
  const data = { ...initial };
  return ARCADE.createStore(() => ({
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; }
  }), 'spaceinvaders.v1.');
}

function promptLit(app) {
  const fb = V.createFramebuffer();
  app.render(fb);
  let n = 0;
  for (let y = 216; y < 224; y++) for (let x = 0; x < 224; x++) n += fb[y * 224 + x];
  return n;
}

test('IF1: the attract loop cycles title, score table and Top 10 on the timer', () => {
  const app = A.createApp({ store: memStore() });
  assert.equal(app.screen, 'attract');
  const pages = [];
  for (let k = 0; k < 4; k++) {
    pages.push(app.page);
    for (let f = 0; f < A.PAGE_FRAMES; f++) app.step(frame());
  }
  assert.deepEqual(pages, [0, 1, 2, 0]);
  assert.ok(A.PAGE_FRAMES >= 6 * 60 && A.PAGE_FRAMES <= 8 * 60);
});

test('IF2: Enter starts a game from any attract screen', () => {
  for (const page of [0, 1, 2]) {
    const app = A.createApp({ store: memStore() });
    for (let f = 0; f < A.PAGE_FRAMES * page; f++) app.step(frame());
    assert.equal(app.page, page);
    app.step(frame(['start']));
    assert.equal(app.screen, 'play');
    assert.ok(app.game);
  }
});

test('IF1: PRESS ENTER blinks on every attract screen', () => {
  for (const page of [0, 1, 2]) {
    const app = A.createApp({ store: memStore() });
    app.page = page;
    const seen = new Set();
    for (let f = 0; f < 2 * A.BLINK_FRAMES; f++) {
      app.frame = f;
      seen.add(promptLit(app) > 0);
    }
    assert.deepEqual([...seen].sort(), [false, true], `page ${page}`);
  }
});

test('I11: HI-SCORE comes from the first Top 10 entry', () => {
  const app = A.createApp({ store: memStore({ 'spaceinvaders.v1.scores': JSON.stringify([{ name: 'ABC', score: 1230 }]) }) });
  assert.equal(app.hiScore(), 1230);
  assert.equal(A.createApp({ store: memStore() }).hiScore(), 0);
});

test('IF3/S8: game over -> 3 s banner -> name entry when the score qualifies -> Top 10', () => {
  const app = A.createApp({ store: memStore() });
  app.step(frame(['start']));
  Object.assign(app.game, { ships: 0, playerAlive: 0, score: 120 });
  let f = 0;
  while (app.screen === 'play' && f++ < 600) app.step(frame());
  assert.equal(app.screen, 'gameOver');
  for (let k = 0; k < A.BANNER_FRAMES - 1; k++) app.step(frame());
  assert.equal(app.screen, 'gameOver', 'banner still up just before 3 s');
  app.step(frame());
  assert.equal(app.screen, 'nameEntry');
  app.step(frame(['right']));
  app.step(frame(['start']));
  app.step(frame(['left']));
  app.step(frame(['start']));
  app.step(frame(['start']));
  assert.equal(app.screen, 'attract');
  assert.equal(app.page, 2, 'the Top 10 shows next');
  assert.deepEqual(app.scores, [{ name: 'BZA', score: 120 }]);
});

test('E3/S8: score 0 and a positive score below a full Top 10 skip name entry', () => {
  const full = Array.from({ length: 10 }, (_, i) => ({ name: 'AAA', score: 1000 - i * 50 }));
  for (const [score, store] of [[0, memStore()], [300, memStore({ 'spaceinvaders.v1.scores': JSON.stringify(full) })]]) {
    const app = A.createApp({ store });
    const before = JSON.stringify(app.scores);
    app.step(frame(['start']));
    Object.assign(app.game, { ships: 0, playerAlive: 0, score });
    for (let k = 0; k < 600 + A.BANNER_FRAMES && app.screen !== 'attract'; k++) app.step(frame());
    assert.equal(app.screen, 'attract', `score ${score}`);
    assert.equal(JSON.stringify(app.scores), before);
  }
});

test('S11/E4: blur pauses the game-over banner; it resumes when the page is back', () => {
  const app = A.createApp({ store: memStore() });
  app.step(frame(['start']));
  Object.assign(app.game, { ships: 0, playerAlive: 0, score: 120 });
  let f = 0;
  while (app.screen === 'play' && f++ < 600) app.step(frame());
  assert.equal(app.screen, 'gameOver');
  app.pause();
  assert.equal(app.audioPaused(), true);
  for (let k = 0; k < A.BANNER_FRAMES * 2; k++) app.step(frame());
  assert.equal(app.screen, 'gameOver', 'the banner does not count down while paused');
  app.resume();
  assert.equal(app.audioPaused(), false);
  for (let k = 0; k < A.BANNER_FRAMES; k++) app.step(frame());
  assert.equal(app.screen, 'nameEntry');
});

test('S12: the footer keys follow the screen', () => {
  assert.equal(A.footerKeys('attract')[0][1], 'START');
  assert.equal(A.footerKeys('play')[0][1], 'MOVE');
  assert.deepEqual(A.footerKeys('gameOver'), [], 'the game-over banner takes no keys');
  assert.deepEqual(A.footerKeys('nameEntry').map((k) => k[1]), ['LETTER', 'NEXT']);
});
