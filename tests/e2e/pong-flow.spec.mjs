import { test, expect } from '@playwright/test';
import { openArcade, blockStorage } from './arcade-helpers.mjs';

const FILE = 'pong.html';

async function onTitle(page) {
  await page.waitForFunction(() => window.pongApp && window.pongApp.screen === 'title');
}

// From the title: pick a level (number of Down presses from Normal is
// relative), start, then force the final point.
async function playTo(page, { left, right, level }) {
  await onTitle(page);
  if (level) await page.evaluate((l) => { pongApp.level = l; }, level);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => pongApp.screen === 'play');
  await page.evaluate(([l, r]) => {
    const m = pongApp.match;
    const leftWins = l > r;
    m.score = { left: leftWins ? l - 1 : l, right: leftWins ? r : r - 1 };
    m.serveTimer = 0;
    m.paddles = { left: 230, right: 230 };
    Object.assign(m.ball, leftWins ? { x: 370, y: 20, dir: 1, vy: 0 } : { x: 2, y: 20, dir: -1, vy: 0 });
    // Keep the CPU paddle away from the ball.
    pongApp.cpu = { move: () => 4 };
  }, [left, right]);
  await page.waitForFunction(() => pongApp.screen === 'final');
}

async function enterName(page, ups) {
  await page.waitForFunction(() => pongApp.screen === 'nameEntry', null, { timeout: 6000 });
  // One press per game frame: presses inside one frame count once.
  const tap = async (key) => { await page.keyboard.press(key); await page.waitForTimeout(40); };
  for (const n of ups) {
    for (let i = 0; i < n; i++) await tap('ArrowUp');
    await tap('Enter');
  }
  await onTitle(page);
}

const storedScores = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('pong.v1.scores')));

test.describe('flow', () => {
  test('PF3: the final screen holds 3 s, then name entry', async ({ page }) => {
    await openArcade(page, FILE);
    await playTo(page, { left: 11, right: 2 });
    const t0 = Date.now();
    await page.waitForTimeout(2700);
    expect(await page.evaluate(() => pongApp.screen)).toBe('final');
    await page.waitForFunction(() => pongApp.screen === 'nameEntry');
    const dt = Date.now() - t0;
    expect(dt).toBeGreaterThan(2800);
    expect(dt).toBeLessThan(3600);
  });

  test('S11: the final score stays paused while the page is visible but not focused', async ({ page }) => {
    await openArcade(page, FILE);
    await playTo(page, { left: 11, right: 2 });
    await page.evaluate(() => {
      window.__focus = true;
      document.hasFocus = () => window.__focus;
      window.__focus = false;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(3500);
    expect(await page.evaluate(() => [pongApp.screen, pongApp.paused])).toEqual(['final', true]);
    await page.evaluate(() => { window.__focus = true; window.dispatchEvent(new Event('focus')); });
    await page.waitForFunction(() => pongApp.screen === 'nameEntry', null, { timeout: 6000 });
  });

  test('PK2/S6/S9: a win goes to name entry; Up changes letters; the row shows on the title after reload', async ({ page }) => {
    await openArcade(page, FILE);
    await playTo(page, { left: 11, right: 4 });
    await enterName(page, [2, 0, 25]);
    expect(await storedScores(page)).toEqual([{ name: 'CAZ', score: 7 }]);
    await page.reload();
    await onTitle(page);
    expect(await page.evaluate(() => pongApp.scores)).toEqual([{ name: 'CAZ', score: 7 }]);
    expect(await page.evaluate(() => PONG.VIEW.top10Rows(pongApp.scores)[0])).toBe(' 1. CAZ  7');
  });

  test('PH2: a loss returns to the title with no name entry', async ({ page }) => {
    await openArcade(page, FILE);
    await playTo(page, { left: 3, right: 11 });
    await onTitle(page);
    expect(await storedScores(page)).toBe(null);
  });

  test('S8: with a full Top 10 (10th margin 5), a 3-point win does not reach name entry', async ({ page }) => {
    const full = Array.from({ length: 10 }, () => ({ name: 'AAA', score: 5 }));
    await openArcade(page, FILE, { initScript: (s) => localStorage.setItem('pong.v1.scores', s), initArg: JSON.stringify(full) });
    await playTo(page, { left: 11, right: 8 });
    await page.waitForFunction(() => pongApp.screen !== 'final', null, { timeout: 6000 });
    expect(await page.evaluate(() => pongApp.screen)).toBe('title');
    expect(await storedScores(page)).toEqual(full);
  });

  test('PH3/PH4: wins on Easy and Hard land in one list; rows show no difficulty', async ({ page }) => {
    await openArcade(page, FILE);
    await playTo(page, { left: 11, right: 9, level: 'easy' });
    await enterName(page, [0, 0, 0]);
    await playTo(page, { left: 11, right: 1, level: 'hard' });
    await enterName(page, [1, 1, 1]);
    expect(await storedScores(page)).toEqual([{ name: 'BBB', score: 10 }, { name: 'AAA', score: 2 }]);
    const rows = await page.evaluate(() => PONG.VIEW.top10Rows(pongApp.scores).join('|'));
    expect(rows).not.toMatch(/EASY|NORMAL|HARD/);
  });
});

test.describe('storage', () => {
  test('S10: blocked localStorage shows "Scores not saved" and the game still plays', async ({ page }) => {
    const { logs } = await openArcade(page, FILE, { initScript: blockStorage });
    await expect(page.locator('#notice')).toBeVisible();
    await expect(page.locator('#notice')).toHaveText('Scores not saved');
    await playTo(page, { left: 11, right: 0 });
    await enterName(page, [0, 0, 0]);
    expect(await page.evaluate(() => pongApp.scores)).toEqual([{ name: 'AAA', score: 11 }]);
    expect(logs).toEqual([]);
  });

  test('E2: a Pong save leaves the Tetris key untouched', async ({ page }) => {
    const tetris = JSON.stringify([{ name: 'TETRIS', score: 1234 }]);
    await openArcade(page, FILE, { initScript: (s) => { if (!localStorage.getItem('gbtetris.v1.scores')) localStorage.setItem('gbtetris.v1.scores', s); }, initArg: tetris });
    await playTo(page, { left: 11, right: 5 });
    await enterName(page, [0, 0, 0]);
    expect(await page.evaluate(() => localStorage.getItem('gbtetris.v1.scores'))).toBe(tetris);
    expect(await storedScores(page)).toEqual([{ name: 'AAA', score: 6 }]);
  });
});
