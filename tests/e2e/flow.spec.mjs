import { test, expect } from '@playwright/test';
import { openGame, startGame } from './helpers.mjs';

test('F1..F4: title, level 5, play shows LEVEL 5, game over returns to the title', async ({ page }) => {
  const { logs, requests } = await openGame(page);
  await startGame(page, { down: 1 });
  const g = await page.evaluate(() => [gbApp.play.game.level, gbApp.play.game.gravReload]);
  expect(g).toEqual([5, 32]);
  // LEVEL value cell (col 17, row 7) shows the digit 5: compare with a reference render.
  const same = await page.evaluate(() => {
    const fb = GB.VIEW.createFramebuffer();
    GB.VIEW.drawText(fb, '5', 17, 7);
    const c = document.getElementById('screen');
    const k = c.width / 160;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const pal = GB.CONST.PALETTE.map((h) => parseInt(h.slice(1, 3), 16));
    for (let y = 56; y < 64; y++) for (let x = 136; x < 144; x++) {
      const i = ((y * k + (k >> 1)) * c.width + (x * k + (k >> 1))) * 4;
      if (d[i] !== pal[fb[y * 160 + x]]) return false;
    }
    return true;
  });
  expect(same).toBe(true);
  // Force a top-out, then wait out the banner.
  await page.evaluate(() => { gbApp.play.game.over = true; });
  await page.waitForFunction(() => gbApp.screen === 'gameOver');
  await page.waitForTimeout(1100);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => gbApp.screen === 'title');
  expect(logs).toEqual([]);
  expect(requests).toEqual([]);
});

test('F2: level select moves with the bound keys', async ({ page }) => {
  await openGame(page);
  await page.waitForFunction(() => window.gbApp && gbApp.screen === 'title');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => gbApp.screen === 'levelSelect');
  for (const [k, want] of [['ArrowRight', 1], ['ArrowDown', 6], ['ArrowUp', 1], ['ArrowLeft', 0], ['ArrowLeft', 0]]) {
    await page.keyboard.press(k);
    await expect.poll(() => page.evaluate(() => gbApp.level)).toBe(want);
  }
});
