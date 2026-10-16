import { test, expect } from '@playwright/test';
import { openGame } from './helpers.mjs';

const PALETTE = ['255,237,121', '180,164,70', '132,121,71', '78,78,78'];

// Reads every pixel of the visible canvas and returns the distinct colors.
async function canvasColors(page) {
  return page.$eval('#screen', (c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const set = new Set();
    for (let i = 0; i < d.length; i += 4) set.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return [...set];
  });
}

for (const [w, h] of [[1920, 1080], [1024, 700], [360, 640]]) {
  test(`L1/L2: canvas holds only the 4 palette colors at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openGame(page);
    await page.waitForTimeout(400);
    const colors = await canvasColors(page);
    expect(colors.length).toBeLessThanOrEqual(4);
    for (const c of colors) expect(PALETTE).toContain(c);
    const size = await page.$eval('#screen', (c) => [c.width % 160, c.height % 144, c.width / 160]);
    expect(size.slice(0, 2)).toEqual([0, 0]);
    expect(Number.isInteger(size[2])).toBe(true);
  });
}
