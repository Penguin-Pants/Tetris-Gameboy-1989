import { test, expect } from '@playwright/test';
import { openArcade } from './arcade-helpers.mjs';

for (const file of ['pong.html', 'space-invaders.html']) {
  test(`S1: ${file} loads from file:// with a clean console and zero requests`, async ({ page }) => {
    const { logs, requests } = await openArcade(page, file);
    await page.waitForTimeout(300);
    expect(logs).toEqual([]);
    expect(requests).toEqual([]);
    await expect(page.locator('#footer')).toContainText('SOUND: ON');
  });

  for (const size of [{ width: 800, height: 600 }, { width: 1920, height: 1080 }]) {
    test(`S3: ${file} has no scrollbars at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openArcade(page, file);
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
        cw: document.documentElement.clientWidth, ch: document.documentElement.clientHeight
      }));
      expect(m.sw).toBeLessThanOrEqual(m.cw);
      expect(m.sh).toBeLessThanOrEqual(m.ch);
    });
  }
}
