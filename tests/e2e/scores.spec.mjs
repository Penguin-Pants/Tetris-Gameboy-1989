import { test, expect } from '@playwright/test';
import { openGame, startGame, canvasMatches, ALWAYS_O, playToGameOver } from './helpers.mjs';

test('H1..H4/F4/F5: play to game over, enter a name, reload, see the score', async ({ page }) => {
  const { logs, requests } = await openGame(page, { initScript: ALWAYS_O });
  await startGame(page);
  await playToGameOver(page);
  const score = await page.evaluate(() => gbApp.play.game.score);
  expect(score).toBeGreaterThan(0);
  await page.waitForTimeout(1100);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => gbApp.screen === 'nameEntry');
  // One key per game frame or more, as a person types.
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowRight', 'Enter']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(60);
  }
  await page.waitForFunction(() => gbApp.screen === 'title');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gbtetris.v1.scores')));
  expect(stored).toEqual([{ name: 'CA', score }]);

  await page.reload();
  await page.waitForFunction(() => window.gbApp && gbApp.screen === 'title');
  expect(await page.evaluate(() => gbApp.scores)).toEqual([{ name: 'CA', score }]);
  await page.keyboard.press('KeyH');
  await page.waitForFunction(() => gbApp.screen === 'top10');
  await page.waitForTimeout(100);
  expect(await canvasMatches(page, 'GB.VIEW.renderTop10(fb, arg);', [{ name: 'CA', score }])).toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => gbApp.screen === 'title');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => gbApp.screen === 'levelSelect');
  await page.waitForTimeout(50);
  const blink = await page.evaluate(() => gbApp.blinkOn);
  const ok = await canvasMatches(page, 'GB.VIEW.renderLevelSelect(fb, 0, arg.b, arg.s);', { b: blink, s: [{ name: 'CA', score }] })
    || await canvasMatches(page, 'GB.VIEW.renderLevelSelect(fb, 0, arg.b, arg.s);', { b: !blink, s: [{ name: 'CA', score }] });
  expect(ok).toBe(true);
  expect(logs).toEqual([]);
  expect(requests).toEqual([]);
});

test('F5: H works on the title only', async ({ page }) => {
  await openGame(page);
  await page.waitForFunction(() => window.gbApp && gbApp.screen === 'title');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => gbApp.screen === 'levelSelect');
  await page.keyboard.press('KeyH');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => gbApp.screen)).toBe('levelSelect');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => gbApp.screen === 'play');
  await page.keyboard.press('KeyH');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => gbApp.screen)).toBe('play');
});

test('E1: with storage blocked the game runs and the notice shows', async ({ page }) => {
  const { logs } = await openGame(page, {
    initScript: () => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    }
  });
  await startGame(page);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => gbApp.play.game.frame)).toBeGreaterThan(5);
  await expect(page.locator('#notice')).toBeVisible();
  await expect(page.locator('#notice')).toHaveText('Scores not saved');
  expect(logs).toEqual([]);
});

test('E1: with storage working the notice is hidden', async ({ page }) => {
  await openGame(page);
  await page.waitForTimeout(200);
  await expect(page.locator('#notice')).toBeHidden();
});
