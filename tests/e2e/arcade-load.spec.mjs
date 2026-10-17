import { test, expect } from '@playwright/test';
import { openArcade, audioStub } from './arcade-helpers.mjs';

for (const file of ['pong.html', 'space-invaders.html']) {
  test(`S1: ${file} loads from file:// with a clean console and zero requests`, async ({ page }) => {
    const { logs, requests } = await openArcade(page, file);
    await page.waitForTimeout(300);
    expect(logs).toEqual([]);
    expect(requests).toEqual([]);
    await expect(page.locator('#sound')).toHaveText('M SOUND: ON');
    const text = await page.locator('#footer').innerText();
    expect(text.match(/SOUND/g).length).toBe(1);
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

// Space Invaders gets its audio in Phase 8; it joins this test then.
for (const file of ['pong.html']) {
  test(`S5: ${file} resumes an audio context that starts suspended`, async ({ page }) => {
    await openArcade(page, file, { initScript: audioStub, initArg: 'suspended' });
    await page.keyboard.press('KeyM');
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => [window.__audio.created, window.__audio.state])).toEqual([1, 'running']);
  });
}
