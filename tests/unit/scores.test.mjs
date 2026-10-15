import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGB } from '../helpers/load-logic.mjs';
import { sequence } from '../helpers/game-helpers.mjs';

const GB = loadGB();
const { APP: A, VIEW: V } = GB;

const list = (scores) => scores.map((s, i) => ({ name: 'P' + i, score: s }));

function fakeStorage({ throwOn = [] } = {}) {
  const data = new Map();
  return {
    data,
    getItem(k) { if (throwOn.includes('read')) throw new Error('read'); return data.has(k) ? data.get(k) : null; },
    setItem(k, v) {
      if (throwOn.includes('write')) throw new Error('write');
      if (throwOn.includes('quota') && !k.endsWith('probe')) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      data.set(k, String(v));
    },
    removeItem(k) { data.delete(k); }
  };
}

const ACTIONS = ['left', 'right', 'down', 'rotate', 'start', 'music'];
function frame(pressed = [], held = pressed, codes = []) {
  const p = {}, h = {};
  for (const a of ACTIONS) { p[a] = pressed.includes(a); h[a] = held.includes(a); }
  return { pressed: p, held: h, codes };
}

// ---------- E4: qualification ----------

test('E4: qualification matrix', () => {
  assert.equal(A.qualifies([], 0), false, 'score 0 never qualifies');
  assert.equal(A.qualifies([], 1), true, 'empty list');
  const nine = list([90, 80, 70, 60, 50, 40, 30, 20, 10]);
  assert.equal(A.qualifies(nine, 1), true, 'fewer than 10 entries');
  const ten = list([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
  assert.equal(A.qualifies(ten, 10), false, 'equal to the 10th');
  assert.equal(A.qualifies(ten, 11), true, 'above the 10th');
  assert.equal(A.qualifies(ten, 9), false, 'below the 10th');
});

test('E4: ties rank below older equal scores; insertion keeps 10', () => {
  const ten = list([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
  assert.equal(A.rankOf(ten, 90), 2);
  const r = A.insertScore(ten, { name: 'NEW', score: 90 });
  assert.equal(r.rank, 2);
  assert.equal(r.list.length, 10);
  assert.deepEqual(r.list.slice(1, 3).map((e) => e.name), ['P1', 'NEW']);
  assert.equal(r.list[9].score, 20, 'old 10th dropped');
  const top = A.insertScore(ten, { name: 'TOP', score: 999999 });
  assert.equal(top.rank, 0);
  const empty = A.insertScore([], { name: 'A', score: 5 });
  assert.deepEqual(empty, { list: [{ name: 'A', score: 5 }], rank: 0 });
});

// ---------- H1 / E1: validation ----------

test('H1/E1: loaded data is validated', () => {
  assert.deepEqual(A.validateScores('nope'), []);
  assert.deepEqual(A.validateScores({ a: 1 }), []);
  assert.deepEqual(A.validateScores([{ name: 'OK', score: 5 }, { name: 'BAD!', score: 5 }, { name: 'NEG', score: -1 },
    { name: 'FLT', score: 1.5 }, { name: 'BIG', score: 1000000 }, { name: 'TOOLONG', score: 3 }, { name: '', score: 3 },
    { name: 7, score: 3 }, null, { name: 'STR', score: '9' }]), [{ name: 'OK', score: 5 }]);
  const fifteen = Array.from({ length: 15 }, (_, i) => ({ name: 'N', score: 100 - i }));
  assert.equal(A.validateScores(fifteen).length, 10);
  assert.deepEqual(A.validateScores([{ name: 'LOW', score: 1 }, { name: 'HI', score: 9 }]).map((e) => e.name), ['HI', 'LOW']);
});

test('E1: corrupt JSON falls back to an empty list', () => {
  const fs = fakeStorage();
  fs.data.set('gbtetris.v1.scores', '{not json');
  const store = A.createStore(() => fs);
  assert.deepEqual(store.load('scores', A.validateScores, () => []), []);
  assert.equal(store.ok, true);
});

test('E1/E2: store saves under the gbtetris.v1. prefix and reloads', () => {
  const fs = fakeStorage();
  const store = A.createStore(() => fs);
  assert.equal(store.save('scores', [{ name: 'A', score: 1 }]), true);
  assert.deepEqual([...fs.data.keys()], ['gbtetris.v1.scores']);
  const again = A.createStore(() => fs);
  assert.deepEqual(again.load('scores', A.validateScores, () => []), [{ name: 'A', score: 1 }]);
});

test('E1: storage that throws on access, read, write or quota never throws', () => {
  const cases = [
    () => { throw new Error('SecurityError'); },
    () => fakeStorage({ throwOn: ['read'] }),
    () => fakeStorage({ throwOn: ['write'] }),
    () => fakeStorage({ throwOn: ['quota'] })
  ];
  for (const getBackend of cases) {
    const store = A.createStore(getBackend);
    assert.doesNotThrow(() => store.load('scores', A.validateScores, () => []));
    assert.doesNotThrow(() => store.save('scores', [{ name: 'A', score: 1 }]));
    assert.equal(store.ok, false);
  }
});

test('E1: without storage, a saved score is kept in memory', () => {
  const store = A.createStore(() => { throw new Error('blocked'); });
  store.save('scores', [{ name: 'MEM', score: 3 }]);
  assert.deepEqual(store.load('scores', A.validateScores, () => []), [{ name: 'MEM', score: 3 }]);
});

// ---------- H2: name entry ----------

test('H2: up and down cycle the ROM character set', () => {
  const ne = A.createNameEntry();
  assert.deepEqual(ne.chars, ['A', null, null, null, null, null]);
  ne.step(frame(['rotate']));
  assert.equal(ne.chars[0], 'B');
  ne.step(frame([], []));
  ne.step(frame(['down']));
  ne.step(frame([], []));
  ne.step(frame(['down']));
  assert.equal(ne.chars[0], ' ', 'A down -> blank');
  ne.step(frame([], []));
  ne.step(frame(['down']));
  assert.equal(ne.chars[0], '*', 'blank down -> multiply sign');
  assert.equal(A.NAME_CHARS, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ.-* ');
});

test('H2: holding up repeats after 23 frames, then every 9', () => {
  const ne = A.createNameEntry();
  ne.step(frame(['rotate']));
  const changes = [0];
  let last = ne.chars[0];
  for (let f = 1; f <= 40; f++) {
    ne.step(frame([], ['rotate']));
    if (ne.chars[0] !== last) { changes.push(f); last = ne.chars[0]; }
  }
  assert.deepEqual(changes, [0, 23, 32]);
});

test('H2: left and right move the cursor; start confirms up to 6 chars', () => {
  const ne = A.createNameEntry();
  ne.step(frame(['left']));
  assert.equal(ne.pos, 0);
  for (let i = 0; i < 8; i++) { ne.step(frame(['right'])); ne.step(frame([], [])); }
  assert.equal(ne.pos, 5);
  assert.deepEqual(ne.chars, ['A', 'A', 'A', 'A', 'A', 'A']);
  ne.step(frame(['left']));
  assert.equal(ne.pos, 4);
  assert.equal(ne.step(frame(['start'])), 'AAAAAA');
  const short = A.createNameEntry();
  short.step(frame(['rotate']));
  short.step(frame([], []));
  short.step(frame(['right']));
  assert.equal(short.step(frame(['start'])), 'BA', 'untouched places are dropped');
});

// ---------- F4 / F5 / H3: app flow ----------

function appWith(store) {
  return A.createApp({ rng: sequence([3]), store });
}

function finishGame(app, score) {
  app.go('levelSelect'); app.go('play');
  app.play.game.score = score;
  app.play.game.over = true;
  app.step(frame());
  for (let i = 0; i < A.GAME_OVER_FRAMES; i++) app.step(frame());
}

test('F4: qualifying game over goes to name entry, saves, then title', () => {
  const fs = fakeStorage();
  const app = appWith(A.createStore(() => fs));
  finishGame(app, 2359);
  assert.equal(app.screen, 'nameEntry');
  app.step(frame(['rotate'])); app.step(frame([], []));
  app.step(frame(['start']));
  assert.equal(app.screen, 'title');
  assert.deepEqual(app.scores, [{ name: 'B', score: 2359 }]);
  assert.deepEqual(JSON.parse(fs.data.get('gbtetris.v1.scores')), [{ name: 'B', score: 2359 }]);
  // A new app instance reloads it (H1).
  const again = appWith(A.createStore(() => fs));
  assert.deepEqual(again.scores, [{ name: 'B', score: 2359 }]);
});

test('F4/E4: a score of 0 skips name entry', () => {
  const app = appWith(A.createStore(() => fakeStorage()));
  finishGame(app, 0);
  assert.equal(app.screen, 'title');
});

test('F5/I5: H opens Top 10 from the title only; Esc or start exits', () => {
  const app = appWith(A.createStore(() => fakeStorage()));
  app.step(frame([], [], ['KeyH']));
  assert.equal(app.screen, 'top10');
  app.step(frame([], [], ['Escape']));
  assert.equal(app.screen, 'title');
  app.step(frame([], [], ['KeyH']));
  app.step(frame(['start']));
  assert.equal(app.screen, 'title');
  app.go('levelSelect');
  app.step(frame([], [], ['KeyH']));
  assert.equal(app.screen, 'levelSelect');
  app.go('play');
  app.step(frame([], [], ['KeyH']));
  assert.equal(app.screen, 'play');
});

test('H3/H4: level select shows the top 3; Top 10 shows dotted empty rows', () => {
  const scores = [{ name: 'AAA', score: 300 }, { name: 'BBB', score: 200 }, { name: 'CCC', score: 100 }, { name: 'DDD', score: 50 }];
  const a = V.createFramebuffer(); V.renderLevelSelect(a, 0, true, scores.slice(0, 3));
  const b = V.createFramebuffer(); V.renderLevelSelect(b, 0, true, []);
  assert.notEqual(V.hash(a), V.hash(b));
  const t = V.createFramebuffer(); V.renderTop10(t, []);
  const ref = V.createFramebuffer(); V.drawText(ref, '______', 5, 13);
  // Row 13 (10th entry) name cells match the dotted glyphs.
  for (let y = 104; y < 112; y++) for (let x = 40; x < 88; x++) assert.equal(t[y * 160 + x], ref[y * 160 + x]);
  assert.deepEqual({ top10: V.hash(t), filled: V.hash(a) }, GOLDEN);
});

// Regression guards only.
const GOLDEN = { top10: '86e8af52', filled: '179bbc90' };
