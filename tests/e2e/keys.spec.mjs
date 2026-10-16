import { test, expect } from '@playwright/test';
import { openGame } from './helpers.mjs';

async function toKeys(page) {
  await page.waitForFunction(() => window.gbApp && gbApp.screen === 'title');
  await page.keyboard.press('KeyK');
  await page.waitForFunction(() => gbApp.screen === 'keys');
}

// One key per frame or more, as a person types.
async function type(page, keys) {
  for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(50); }
}

test('K1/K4: rebind rotate to Space, reload, Space rotates and Up does not', async ({ page }) => {
  const { logs } = await openGame(page);
  await toKeys(page);
  await type(page, ['ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter', 'Space']);
  await expect.poll(() => page.evaluate(() => gbApp.bindings.rotate)).toBe('Space');
  await page.reload();
  await page.waitForFunction(() => window.gbApp && gbApp.screen === 'title');
  expect(await page.evaluate(() => gbApp.bindings.rotate)).toBe('Space');
  await type(page, ['Enter']);
  await page.waitForFunction(() => gbApp.screen === 'levelSelect');
  await type(page, ['Enter']);
  await page.waitForFunction(() => gbApp.screen === 'play');
  // Use a T piece so rotation is visible.
  await page.evaluate(() => { const g = gbApp.play.game; g.type = 6; g.rot = 0; g.row = 3; });
  await type(page, ['ArrowUp']);
  expect(await page.evaluate(() => gbApp.play.game.rot)).toBe(0);
  await type(page, ['Space']);
  expect(await page.evaluate(() => gbApp.play.game.rot)).toBe(3);
  expect(logs).toEqual([]);
});

test('E3: duplicate rejected, RESET restores defaults', async ({ page }) => {
  await openGame(page);
  await toKeys(page);
  await type(page, ['Enter', 'ArrowRight']);
  expect(await page.evaluate(() => [gbApp.bindings.left, gbApp.keys.message])).toEqual(['ArrowLeft', 'KEY IN USE']);
  await type(page, ['Enter', 'KeyA']);
  expect(await page.evaluate(() => gbApp.bindings.left)).toBe('KeyA');
  await type(page, ['ArrowUp', 'Enter']); // RESET row (wraps)
  expect(await page.evaluate(() => gbApp.bindings)).toEqual({
    left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', rotate: 'ArrowUp', start: 'Enter', music: 'KeyM'
  });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gbtetris.v1.bindings')).left)).toBe('ArrowLeft');
  await type(page, ['Escape']);
  await page.waitForFunction(() => gbApp.screen === 'title');
});

test('F6: K does nothing outside the title', async ({ page }) => {
  await openGame(page);
  await page.waitForFunction(() => window.gbApp && gbApp.screen === 'title');
  await type(page, ['Enter']);
  await page.waitForFunction(() => gbApp.screen === 'levelSelect');
  await type(page, ['KeyK']);
  expect(await page.evaluate(() => gbApp.screen)).toBe('levelSelect');
});

test('K3: menus follow the new bindings', async ({ page }) => {
  await openGame(page);
  await toKeys(page);
  // right -> KeyD, start -> KeyP
  await type(page, ['ArrowDown', 'Enter', 'KeyD', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter', 'KeyP', 'Escape']);
  await page.waitForFunction(() => gbApp.screen === 'title');
  await type(page, ['Enter']);
  expect(await page.evaluate(() => gbApp.screen)).toBe('title');
  await type(page, ['KeyP']);
  await page.waitForFunction(() => gbApp.screen === 'levelSelect');
  await type(page, ['KeyD', 'KeyD']);
  expect(await page.evaluate(() => gbApp.level)).toBe(2);
  await type(page, ['KeyP']);
  await page.waitForFunction(() => gbApp.screen === 'play');
  expect(await page.evaluate(() => gbApp.play.game.level)).toBe(2);
});
