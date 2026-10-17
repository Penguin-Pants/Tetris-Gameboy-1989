// Shared ARCADE suite: every test runs once per arcade file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCADE_FILES, loadGame } from '../helpers/load-arcade.mjs';

// localStorage-like fake. fail: { probe, get, set } make those calls throw.
function fakeBackend(fail = {}, initial = {}) {
  const data = { ...initial };
  const calls = [];
  let probed = false;
  return {
    data, calls,
    getItem(k) { calls.push(['get', k]); if (fail.get) throw new Error('get'); return k in data ? data[k] : null; },
    setItem(k, v) {
      calls.push(['set', k]);
      if (!probed) { probed = true; if (fail.probe) throw new Error('probe'); } else if (fail.set) throw new Error('set');
      data[k] = String(v);
    },
    removeItem(k) { delete data[k]; }
  };
}

const entry = (name, score) => ({ name, score });
const tenScores = () => Array.from({ length: 10 }, (_, i) => entry('AAA', 100 - i * 10));
const ev = (code, extra = {}) => ({ code, repeat: false, ctrlKey: false, altKey: false, metaKey: false, ...extra });

for (const { file, ns } of ARCADE_FILES) {
  const { ARCADE: A } = loadGame(file, ns);

  test(`${file}: ticker first call, normal advance, remainder and 5-step cap`, () => {
    // 50 fps gives an exact 20 ms step.
    const t = A.createTicker(50, 5);
    assert.equal(t.advance(1000), 0);
    assert.equal(t.advance(1045), 2, '45 ms gives 2 steps and keeps 5 ms');
    assert.equal(t.advance(1060), 1, 'the 5 ms remainder plus 15 ms gives 1 step');
    assert.equal(t.advance(6060), 5, 'a long gap is capped at 5 steps');
    assert.equal(t.advance(6075), 0, 'the backlog was dropped');
    t.reset();
    assert.equal(t.advance(99999), 0);
  });

  test(`${file}: S4/E6 input ignores repeat and modifiers, tracks edges, clear() empties held keys`, () => {
    const inp = A.createInput({ ArrowLeft: 'left', Enter: 'start', Space: 'fire' });
    assert.equal(inp.keyDown(ev('ArrowLeft')), true);
    let f = inp.frame();
    assert.equal(f.pressed.left, true);
    assert.equal(f.held.left, true);
    assert.equal(inp.keyDown(ev('ArrowLeft', { repeat: true })), true);
    f = inp.frame();
    assert.equal(f.pressed.left, false, 'repeat is not a new press');
    assert.equal(f.held.left, true);
    assert.equal(inp.keyDown(ev('Enter', { ctrlKey: true })), false);
    assert.equal(inp.keyDown(ev('Enter', { metaKey: true })), false);
    assert.equal(inp.keyDown(ev('Enter', { altKey: true })), false);
    f = inp.frame();
    assert.equal(f.pressed.start, false, 'modifier combos are ignored');
    assert.equal(inp.keyDown(ev('KeyQ')), false, 'unknown keys are not blocked');
    inp.keyDown(ev('Space'));
    inp.keyUp(ev('Space'));
    f = inp.frame();
    assert.equal(f.held.fire, true, 'a tap inside one frame still counts');
    inp.clear();
    f = inp.frame();
    assert.equal(f.held.left, false, 'clear() drops held keys');
  });

  test(`${file}: S10/E1 store falls back on every error path; save then load returns the value`, () => {
    for (const fail of [{ probe: true }, { get: true }, { set: true }]) {
      const b = fakeBackend(fail);
      const s = A.createStore(() => b, 'x.');
      assert.equal(s.load('scores', (v) => A.validateScores(v, 9999), () => []).length, 0);
      s.save('scores', [entry('ABC', 50)]);
      assert.equal(s.ok, false, JSON.stringify(fail));
      assert.deepEqual(s.load('scores', (v) => A.validateScores(v, 9999), () => []), [entry('ABC', 50)]);
    }
    const thrower = A.createStore(() => { throw new Error('no storage'); }, 'x.');
    assert.equal(thrower.ok, false);
    assert.equal(thrower.load('sound', A.validateSound, () => true), true);
    thrower.save('sound', false);
    assert.equal(thrower.load('sound', A.validateSound, () => true), false);
    // Corrupt JSON.
    const b = fakeBackend({}, { 'x.sound': '{not json' });
    const s = A.createStore(() => b, 'x.');
    assert.equal(s.load('sound', A.validateSound, () => true), true);
    assert.equal(s.ok, false);
    s.save('sound', false);
    assert.equal(s.load('sound', A.validateSound, () => true), false);
  });

  test(`${file}: S8/E3 qualification matrix and tie rank`, () => {
    assert.equal(A.qualifies([], 0), false);
    assert.equal(A.qualifies([], 1), true);
    const full = tenScores();
    assert.equal(A.qualifies(full, 10), false, 'tie with the 10th does not qualify');
    assert.equal(A.qualifies(full, 11), true);
    assert.equal(A.qualifies(full.slice(0, 9), 1), true);
    const list = [entry('AAA', 50), entry('BBB', 30)];
    assert.equal(A.rankOf(list, 50), 1, 'ties rank below older equal scores');
    const r = A.insertScore(full, entry('NEW', 95));
    assert.equal(r.rank, 1);
    assert.equal(r.list.length, 10);
    assert.equal(r.list[9].score, 20);
  });

  test(`${file}: S7/E7 name entry starts at A, wraps both ways, saves after slot 3`, () => {
    const ne = A.createNameEntry('prev', 'next');
    const step = (a) => ne.step({ pressed: { [a]: true } });
    assert.deepEqual(ne.letters, ['A', 'A', 'A']);
    assert.equal(step('prev'), null);
    assert.equal(ne.letters[0], 'Z', 'A wraps to Z');
    assert.equal(step('next'), null);
    assert.equal(step('next'), null);
    assert.equal(ne.letters[0], 'B');
    assert.equal(step('start'), null);
    assert.equal(ne.slot, 1);
    for (let i = 0; i < 25; i++) step('next');
    assert.equal(ne.letters[1], 'Z');
    step('next');
    assert.equal(ne.letters[1], 'A', 'Z wraps to A');
    assert.equal(step('start'), null);
    assert.equal(step('start'), 'BAA');
  });

  test(`${file}: validators reject bad names, non-integers and scores above the max`, () => {
    assert.deepEqual(A.validateScores([entry('ABC', 9999)], 9999), [entry('ABC', 9999)]);
    for (const bad of [
      [entry('AB', 10)], [entry('ABCD', 10)], [entry('abc', 10)], [entry('A1C', 10)],
      [entry('ABC', 1.5)], [entry('ABC', 0)], [entry('ABC', 12)], [entry('ABC', '5')],
      [entry('ABC', 5), entry('ABD', 6)], tenScores().concat([entry('ABC', 1)]), 'x', null, {}
    ]) {
      assert.equal(A.validateScores(bad, 11), null, JSON.stringify(bad));
    }
    assert.equal(A.validateSound(true), true);
    assert.equal(A.validateSound(false), false);
    assert.equal(A.validateSound('true'), null);
  });

  test(`${file}: S10 well-formed invalid data counts as a storage failure`, () => {
    const b = fakeBackend({}, { 'x.scores': JSON.stringify([entry('ABC', 5), entry('ZZZ', 'x')]), 'x.sound': '1' });
    const s = A.createStore(() => b, 'x.');
    assert.deepEqual(s.load('scores', (v) => A.validateScores(v, 11), () => []), []);
    assert.equal(s.ok, false);
    const b2 = fakeBackend({}, { 'x.sound': '"yes"' });
    const s2 = A.createStore(() => b2, 'x.');
    assert.equal(s2.load('sound', A.validateSound, () => true), true);
    assert.equal(s2.ok, false);
  });

  test(`${file}: after any failure the backend is never used again in the session`, () => {
    const cases = [
      { fail: { get: true }, initial: {} },
      { fail: { set: true }, initial: {} },
      { fail: {}, initial: { 'x.sound': '{bad' } }
    ];
    for (const c of cases) {
      const b = fakeBackend(c.fail, c.initial);
      const s = A.createStore(() => b, 'x.');
      s.load('sound', A.validateSound, () => true);
      s.save('sound', false);
      const n = b.calls.length;
      s.save('sound', true);
      s.load('sound', A.validateSound, () => true);
      s.load('scores', (v) => A.validateScores(v, 11), () => []);
      assert.equal(b.calls.length, n, JSON.stringify(c));
      assert.equal(s.ok, false);
    }
  });

  test(`${file}: E2 store keys use the prefix`, () => {
    const b = fakeBackend();
    const s = A.createStore(() => b, 'game.v1.');
    s.save('scores', []);
    assert.deepEqual(Object.keys(b.data), ['game.v1.scores']);
  });
}
