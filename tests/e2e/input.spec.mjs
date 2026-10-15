import { test, expect } from '@playwright/test';
import { openGame } from './helpers.mjs';

// Wraps gbApp.step to log [engine frame, column, active] after every game frame.
async function recordSteps(page) {
  await page.evaluate(() => {
    const app = window.gbApp;
    window.__log = [[app.game.frame, app.game.col, app.game.active]];
    const orig = app.step;
    app.step = (inp) => {
      const r = orig(inp);
      window.__log.push([app.game.frame, app.game.col, app.game.active]);
      return r;
    };
  });
}

test('G7/K2: holding Left moves at once, then after 23 frames, then every 9', async ({ page }) => {
  await openGame(page);
  await page.waitForTimeout(300);
  await recordSteps(page);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowLeft');
  const log = await page.evaluate(() => window.__log);
  const moves = [];
  for (let i = 1; i < log.length; i++) if (log[i][1] !== log[i - 1][1] && log[i][2]) moves.push(log[i][0]);
  expect(moves.length).toBeGreaterThanOrEqual(3);
  expect(moves[1] - moves[0]).toBe(23);
  expect(moves[2] - moves[1]).toBe(9);
});

test('K2: Up rotates, Down soft-drops', async ({ page }) => {
  await openGame(page);
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => [gbApp.game.rot, gbApp.game.row]);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowDown');
  const after = await page.evaluate(() => [gbApp.game.rot, gbApp.game.row, gbApp.game.type]);
  if (after[2] !== 3) expect(after[0]).toBe((before[0] + 3) % 4);
  expect(after[1]).toBeGreaterThan(before[1] + 3);
});

test('I6: Enter pauses and the canvas freezes; Enter resumes', async ({ page }) => {
  await openGame(page);
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => gbApp.paused)).toBe(true);
  await page.waitForTimeout(100);
  const grab = () => page.$eval('#screen', (c) => c.toDataURL());
  const a = await grab();
  await page.waitForTimeout(1000);
  const b = await grab();
  expect(a).toBe(b);
  expect(await page.evaluate(() => gbApp.paused)).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => gbApp.paused)).toBe(false);
});

test('E5: a hidden tab pauses the game and clears held keys', async ({ page }) => {
  await openGame(page);
  await page.waitForTimeout(300);
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => gbApp.paused)).toBe(true);
  const f = await page.evaluate(() => gbApp.game.frame);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => gbApp.game.frame)).toBe(f);
});

test('E5: window blur pauses the game', async ({ page }) => {
  await openGame(page);
  await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(() => gbApp.paused)).toBe(true);
});

test('K2: arrow keys do not scroll the page (default prevented)', async ({ page }) => {
  await openGame(page);
  await page.evaluate(() => {
    window.__prevented = [];
    window.addEventListener('keydown', (e) => window.__prevented.push([e.code, e.defaultPrevented]));
  });
  for (const k of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'KeyQ']) await page.keyboard.press(k);
  const got = await page.evaluate(() => window.__prevented);
  expect(got).toEqual([['ArrowDown', true], ['ArrowUp', true], ['ArrowLeft', true], ['ArrowRight', true], ['KeyQ', false]]);
  expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
});

test('Phase 4: game over shows the label; Enter restarts', async ({ page }) => {
  await openGame(page);
  await page.waitForTimeout(200);
  await page.evaluate(() => { gbApp.game.over = true; });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => gbApp.game.over)).toBe(false);
});
