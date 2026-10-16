import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGB } from '../helpers/load-logic.mjs';
import { sequence } from '../helpers/game-helpers.mjs';

const GB = loadGB();
const { APP: A, DATA: D } = GB;

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

test('A1/A2: note data is valid', () => {
  assert.equal(D.SONG.voices.length, 2, 'two pulse voices');
  for (const v of D.SONG.voices) {
    assert.ok(v.duty > 0 && v.duty < 1);
    assert.ok(v.gain > 0 && v.gain <= 0.5);
    for (const [pitch, beats] of v.notes) {
      assert.ok(pitch === 0 || (pitch >= 28 && pitch <= 96), `pitch ${pitch}`);
      assert.ok(beats > 0, 'positive duration');
      assert.equal(beats * 2, Math.round(beats * 2), 'eighth-note grid');
    }
  }
  assert.ok(D.SONG.bpm >= 100 && D.SONG.bpm <= 200);
});

test('A1: the loop closes (all voices have the same length in whole bars)', () => {
  const seq = A.createSequencer(D.SONG);
  const beats = seq.voices.map((v) => v.beats);
  assert.equal(new Set(beats).size, 1);
  assert.equal(beats[0] % 4, 0);
  assert.equal(seq.loopLength, (beats[0] * 60) / D.SONG.bpm);
});

test('A1: scheduler gives exact times across several loop wraps (no drift)', () => {
  const seq = A.createSequencer(D.SONG);
  const L = seq.loopLength;
  const first = seq.eventsBetween(0, L);
  // Walk 5 loops in uneven 0.1-0.3 s windows, as the platform tick does.
  const got = [];
  let t = 0;
  let step = 0;
  while (t < 5 * L) {
    const t1 = Math.min(5 * L, t + 0.1 + (step++ % 3) * 0.1);
    got.push(...seq.eventsBetween(t, t1));
    t = t1;
  }
  assert.equal(got.length, first.length * 5, 'no lost or doubled notes');
  for (let k = 0; k < 5; k++) {
    for (let i = 0; i < first.length; i++) {
      const e = got[k * first.length + i];
      assert.equal(e.time, k * L + first[i].time, 'exact time');
      assert.equal(e.midi, first[i].midi);
    }
  }
});

test('A2: the melody opens with the Korobeiniki phrase (E B C D C B A)', () => {
  const opening = D.SONG.voices[0].notes.slice(0, 7).map((n) => n[0]);
  assert.deepEqual(opening, [76, 71, 72, 74, 72, 71, 69]);
  assert.equal(Math.round(A.midiToHz(69)), 440);
});

test('A3: music lifecycle by screen', () => {
  const app = A.createApp({ rng: sequence([3]), store: memStore() });
  assert.equal(app.musicMode(), 'stop', 'title is silent');
  app.go('levelSelect');
  assert.equal(app.musicMode(), 'stop');
  app.go('play');
  assert.equal(app.musicMode(), 'play');
  app.step(frame(['start']));
  assert.equal(app.musicMode(), 'pause');
  app.step(frame(['start']));
  assert.equal(app.musicMode(), 'play');
  app.pause(); // blur or hidden tab (E5)
  assert.equal(app.musicMode(), 'pause');
  app.play.game.over = true;
  app.step(frame());
  assert.equal(app.screen, 'gameOver');
  assert.equal(app.musicMode(), 'stop', 'stops on game over');
  app.go('top10');
  assert.equal(app.musicMode(), 'stop');
});

test('A4: toggle works on every screen and persists', () => {
  const store = memStore();
  const app = A.createApp({ rng: sequence([3]), store });
  assert.equal(app.musicOn, true, 'default on');
  for (const screen of ['title', 'levelSelect', 'play', 'top10', 'keys']) {
    app.go(screen);
    const before = app.musicOn;
    app.step(frame(['music']));
    assert.equal(app.musicOn, !before, screen);
  }
  const again = A.createApp({ rng: sequence([3]), store });
  assert.equal(again.musicOn, app.musicOn);
});

test('A4: the music key binds on the Keys screen without toggling', () => {
  const app = A.createApp({ rng: sequence([3]), store: memStore() });
  app.go('keys');
  app.step(frame([], ['Enter']));
  app.step(frame(['music'], ['KeyM']));
  assert.equal(app.musicOn, true);
});

test('A4: a bad stored value falls back to on', () => {
  const store = memStore();
  store.save('music', 'yes');
  assert.equal(A.createApp({ rng: sequence([3]), store }).musicOn, true);
  store.save('music', false);
  assert.equal(A.createApp({ rng: sequence([3]), store }).musicOn, false);
});
