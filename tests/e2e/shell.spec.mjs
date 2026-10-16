import { test, expect } from '@playwright/test';
import { openGame, startGame, ALWAYS_O, playToGameOver } from './helpers.mjs';

const PALETTE = ['255,237,121', '180,164,70', '132,121,71', '78,78,78'];
const SIZES = [[1920, 1080], [1366, 768], [800, 600], [360, 640]];

async function measure(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const r = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, b: b.bottom, r: b.right }; };
    const c = document.getElementById('screen');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const colors = new Set();
    for (let i = 0; i < d.length; i += 4) colors.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return {
      scroll: [de.scrollWidth, de.clientWidth, de.scrollHeight, de.clientHeight],
      device: r('device'), legend: r('legend'), notice: r('notice'),
      vw: window.innerWidth, vh: window.innerHeight, colors: [...colors]
    };
  });
}

for (const [w, h] of SIZES) {
  test(`L5/L1/E7: fits ${w}x${h} with no scrollbars, four colors, legend in view`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openGame(page, {
      initScript: () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); }
    });
    await page.waitForTimeout(300);
    const m = await measure(page);
    expect(m.scroll[0]).toBeLessThanOrEqual(m.scroll[1]);
    expect(m.scroll[2]).toBeLessThanOrEqual(m.scroll[3]);
    expect(Math.abs(m.device.w / m.device.h - 90 / 148)).toBeLessThan((90 / 148) * 0.01);
    expect(m.device.x).toBeGreaterThanOrEqual(0);
    expect(m.device.r).toBeLessThanOrEqual(m.vw);
    expect(m.device.b).toBeLessThanOrEqual(m.legend.y + 0.5);
    expect(m.legend.y).toBeGreaterThanOrEqual(0);
    expect(m.legend.b).toBeLessThanOrEqual(m.vh + 0.5);
    expect(m.notice.w).toBeGreaterThan(0);
    expect(m.notice.b).toBeLessThanOrEqual(m.vh + 0.5);
    expect(m.notice.r).toBeLessThanOrEqual(m.vw + 0.5);
    expect(m.colors.length).toBeLessThanOrEqual(4);
    for (const c of m.colors) expect(PALETTE).toContain(c);
  });
}

test('L4/K5: shell is decorative; canvas is labeled', async ({ page }) => {
  await openGame(page);
  expect(await page.$eval('#device', (d) => getComputedStyle(d).pointerEvents)).toBe('none');
  expect(await page.getAttribute('#screen', 'aria-label')).toBeTruthy();
  for (const t of ['A', 'B', 'START', 'SELECT']) await expect(page.locator('#device')).toContainText(t);
});

test('E7: legend shows H, K, bindings and music; updates after remap and toggle', async ({ page }) => {
  await openGame(page);
  await page.waitForFunction(() => window.gbApp && gbApp.screen === 'title');
  const legend = page.locator('#legend-items');
  await expect(legend).toContainText('H Top 10');
  await expect(legend).toContainText('K Keys');
  await expect(legend).toContainText('UP Rotate');
  await expect(legend).toContainText('M Music ON');
  await page.keyboard.press('KeyM');
  await expect(legend).toContainText('M Music OFF');
  await page.keyboard.press('KeyK');
  await page.waitForFunction(() => gbApp.screen === 'keys');
  for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter', 'Space']) { await page.keyboard.press(k); await page.waitForTimeout(50); }
  await expect(legend).toContainText('SPACE Rotate');
});

test('D1/C2: full flow on Chromium with zero requests and a clean console', async ({ page }) => {
  const { logs, requests } = await openGame(page, { initScript: ALWAYS_O });
  await startGame(page, { down: 1 });
  expect(await page.evaluate(() => gbApp.play.game.level)).toBe(5);
  await playToGameOver(page);
  await page.waitForTimeout(1100);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => gbApp.screen === 'nameEntry');
  for (const k of ['ArrowDown', 'ArrowRight', 'Enter']) { await page.keyboard.press(k); await page.waitForTimeout(60); }
  await page.waitForFunction(() => gbApp.screen === 'title');
  expect((await page.evaluate(() => gbApp.scores))[0].name).toBe(' A');
  await page.keyboard.press('KeyH');
  await page.waitForFunction(() => gbApp.screen === 'top10');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => gbApp.screen === 'title');
  await page.keyboard.press('KeyK');
  await page.waitForFunction(() => gbApp.screen === 'keys');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => gbApp.screen === 'title');
  expect(requests).toEqual([]);
  expect(logs).toEqual([]);
});
