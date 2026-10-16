import { test, expect } from '@playwright/test';
import { openGame, startGame } from './helpers.mjs';

// Fake AudioContext that records what the game does.
const FAKE_AUDIO = () => {
  const rec = { contexts: 0, oscillators: 0, suspends: 0, resumes: 0, gain: [] };
  window.__audio = rec;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} });
  class FakeContext {
    constructor() {
      rec.contexts++;
      this.state = 'running';
      this.destination = {};
      this.t0 = performance.now();
      this.paused = 0;
      this.pausedAt = null;
    }
    get currentTime() {
      const now = this.pausedAt ?? performance.now();
      return (now - this.t0 - this.paused) / 1000;
    }
    createGain() {
      const g = { gain: param(), connect() {} };
      const store = g.gain;
      Object.defineProperty(g.gain, 'value', {
        get() { return store._v ?? 1; },
        set(v) { store._v = v; rec.gain.push(v); }
      });
      return g;
    }
    createOscillator() {
      rec.oscillators++;
      return { frequency: param(), setPeriodicWave() {}, connect() {}, start() {}, stop() {}, onended: null };
    }
    createPeriodicWave() { return {}; }
    suspend() { rec.suspends++; this.state = 'suspended'; this.pausedAt = performance.now(); return Promise.resolve(); }
    resume() {
      rec.resumes++;
      if (this.pausedAt !== null) { this.paused += performance.now() - this.pausedAt; this.pausedAt = null; }
      this.state = 'running';
      return Promise.resolve();
    }
  }
  window.AudioContext = FakeContext;
};

const audio = (page) => page.evaluate(() => ({ ...window.__audio }));

test('A5/A3: no audio before the first key, none on the title, notes during play', async ({ page }) => {
  const { logs } = await openGame(page, { initScript: FAKE_AUDIO });
  await page.waitForTimeout(400);
  expect((await audio(page)).contexts).toBe(0);
  await page.keyboard.press('ArrowLeft'); // first key, on the title
  await page.waitForTimeout(300);
  let a = await audio(page);
  expect(a.contexts).toBe(1);
  expect(a.oscillators).toBe(0);
  await startGame(page);
  await page.waitForTimeout(600);
  a = await audio(page);
  expect(a.oscillators).toBeGreaterThan(0);
  expect(logs).toEqual([]);
});

test('A3/E5: pause suspends; game over stops', async ({ page }) => {
  await openGame(page, { initScript: FAKE_AUDIO });
  await startGame(page);
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await audio(page)).suspends).toBe(1);
  const n = (await audio(page)).oscillators;
  await page.waitForTimeout(500);
  expect((await audio(page)).oscillators).toBe(n);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await audio(page)).oscillators).toBeGreaterThan(n);
  await page.evaluate(() => { gbApp.play.game.over = true; });
  await page.waitForFunction(() => gbApp.screen === 'gameOver');
  await page.waitForTimeout(200);
  const m = (await audio(page)).oscillators;
  await page.waitForTimeout(600);
  expect((await audio(page)).oscillators).toBe(m);
});

test('A4: no notes while toggled off; the state persists after reload', async ({ page }) => {
  await openGame(page, { initScript: FAKE_AUDIO });
  await page.waitForFunction(() => window.gbApp && gbApp.screen === 'title');
  await page.keyboard.press('KeyM'); // off, on the title
  await expect.poll(() => page.evaluate(() => gbApp.musicOn)).toBe(false);
  await startGame(page);
  await page.waitForTimeout(800);
  expect((await audio(page)).oscillators).toBe(0);
  await page.keyboard.press('KeyM'); // on, during play
  await expect.poll(async () => (await audio(page)).oscillators).toBeGreaterThan(0);
  await page.keyboard.press('KeyM'); // off again
  await expect.poll(() => page.evaluate(() => gbApp.musicOn)).toBe(false);
  await page.reload();
  await page.waitForFunction(() => window.gbApp && gbApp.screen === 'title');
  expect(await page.evaluate(() => gbApp.musicOn)).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('gbtetris.v1.music'))).toBe('false');
});

test('A4/E1: without WebAudio the game runs and the toggle still works', async ({ page }) => {
  const { logs } = await openGame(page, { initScript: () => { delete window.AudioContext; delete window.webkitAudioContext; } });
  await startGame(page);
  await page.keyboard.press('KeyM');
  await expect.poll(() => page.evaluate(() => gbApp.musicOn)).toBe(false);
  expect(await page.evaluate(() => gbApp.play.game.frame)).toBeGreaterThan(0);
  expect(logs).toEqual([]);
});

test('A1: real WebAudio plays without errors', async ({ page }) => {
  const { logs } = await openGame(page);
  await startGame(page);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  expect(logs).toEqual([]);
});
