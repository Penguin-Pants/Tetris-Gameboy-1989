import { test, expect } from '@playwright/test';
import { openArcade, blockStorage } from './arcade-helpers.mjs';

const FILE = 'space-invaders.html';

// Starts a game and ends it with the given score: no ships left, cannon hit.
async function playToGameOver(page, score) {
  await page.waitForFunction(() => window.siApp && siApp.screen === 'attract');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => siApp.screen === 'play' && siApp.game);
  await page.evaluate(() => { siApp.game.isrDelay = 2; });
  await page.waitForFunction(() => siApp.game.phase === 'play');
  await page.evaluate((s) => {
    const g = siApp.game;
    g.obj[0].timer = 0;
    g.ships = 0;
    g.score = s;
    g.playerAlive = 0;
  }, score);
  await page.waitForFunction(() => siApp.screen === 'gameOver');
}

// One key press per game frame: two presses inside one frame count once.
async function tap(page, key) {
  await page.keyboard.press(key);
  await page.waitForTimeout(60);
}

function seed() {
  return (list) => {
    localStorage.setItem('spaceinvaders.v1.scores', JSON.stringify(list));
  };
}

test('IF3/IK3/S6/S9/I11: banner 3 s, name entry with Left and Right, saved, shown after reload', async ({ page }) => {
  await openArcade(page, FILE);
  await playToGameOver(page, 1230);
  const t0 = Date.now();
  await page.waitForFunction(() => siApp.screen === 'nameEntry', null, { timeout: 6000 });
  const banner = Date.now() - t0;
  expect(banner).toBeGreaterThan(2700);
  expect(banner).toBeLessThan(3800);
  await tap(page, 'ArrowRight');                // B
  await tap(page, 'ArrowRight');                // C
  await tap(page, 'Enter');
  await tap(page, 'ArrowLeft');                 // Z
  await tap(page, 'Enter');
  await tap(page, 'Enter');
  await page.waitForFunction(() => siApp.screen === 'attract' && siApp.page === 2);
  expect(await page.evaluate(() => siApp.scores)).toEqual([{ name: 'CZA', score: 1230 }]);
  await page.reload();
  await page.waitForFunction(() => window.siApp);
  expect(await page.evaluate(() => siApp.scores)).toEqual([{ name: 'CZA', score: 1230 }]);
  expect(await page.evaluate(() => siApp.hiScore())).toBe(1230);
  // HUD HI-SCORE digits match "1230" drawn by the font.
  const same = await page.evaluate(() => {
    const fb = new Uint8Array(224 * 256), ref = new Uint8Array(224 * 256);
    siApp.render(fb);
    SI.VIEW.text(ref, '1230', 88, 24);
    for (let y = 24; y < 32; y++) for (let x = 88; x < 120; x++) if (fb[y * 224 + x] !== ref[y * 224 + x]) return false;
    return true;
  });
  expect(same).toBe(true);
});

test('E3: a score of 0 skips name entry', async ({ page }) => {
  await openArcade(page, FILE);
  await playToGameOver(page, 0);
  await page.waitForFunction(() => siApp.screen === 'attract', null, { timeout: 6000 });
  expect(await page.evaluate(() => siApp.scores)).toEqual([]);
});

test('S8: with a full Top 10 whose 10th is 500, a score of 300 skips name entry', async ({ page }) => {
  const full = Array.from({ length: 10 }, (_, i) => ({ name: 'AAA', score: 950 - i * 50 }));
  await openArcade(page, FILE, { initScript: seed(), initArg: full });
  await playToGameOver(page, 300);
  await page.waitForFunction(() => siApp.screen === 'attract', null, { timeout: 6000 });
  expect(await page.evaluate(() => siApp.scores)).toEqual(full);
});

test('S10: blocked storage shows the notice and the game still plays', async ({ page }) => {
  const { logs } = await openArcade(page, FILE, { initScript: blockStorage });
  await expect(page.locator('#notice')).toBeVisible();
  await expect(page.locator('#notice')).toHaveText('Scores not saved');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => siApp.screen === 'play' && siApp.game.frame > 30);
  expect(logs).toEqual([]);
});

test('E2: Pong and Tetris keys are untouched by a Space Invaders save', async ({ page }) => {
  await openArcade(page, FILE, {
    initScript: () => {
      if (!localStorage.getItem('pong.v1.scores')) {
        localStorage.setItem('pong.v1.scores', '[{"name":"PNG","score":7}]');
        localStorage.setItem('gbtetris.v1.scores', '[{"name":"TETRIS","score":100}]');
      }
    }
  });
  await playToGameOver(page, 50);
  await page.waitForFunction(() => siApp.screen === 'nameEntry', null, { timeout: 6000 });
  for (let i = 0; i < 3; i++) await tap(page, 'Enter');
  await page.waitForFunction(() => siApp.screen === 'attract');
  const keys = await page.evaluate(() => ({
    pong: localStorage.getItem('pong.v1.scores'),
    tetris: localStorage.getItem('gbtetris.v1.scores'),
    si: localStorage.getItem('spaceinvaders.v1.scores')
  }));
  expect(keys.pong).toBe('[{"name":"PNG","score":7}]');
  expect(keys.tetris).toBe('[{"name":"TETRIS","score":100}]');
  expect(JSON.parse(keys.si)).toEqual([{ name: 'AAA', score: 50 }]);
});
