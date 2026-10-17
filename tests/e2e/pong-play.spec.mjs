import { test, expect } from '@playwright/test';
import { openArcade, colorCensus, audioStub, hideTab, showTab } from './arcade-helpers.mjs';

const FILE = 'pong.html';

async function startMatch(page) {
  await page.waitForFunction(() => window.pongApp && window.pongApp.screen === 'title');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.pongApp.screen === 'play');
}

test.describe('layout and look', () => {
  for (const size of [{ width: 800, height: 600 }, { width: 1600, height: 900 }, { width: 900, height: 1200 }]) {
    test(`S3: canvas keeps 4:3 with black margins at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openArcade(page, FILE);
      await startMatch(page);
      const m = await page.evaluate(() => {
        const r = document.getElementById('screen').getBoundingClientRect();
        const st = document.getElementById('stage').getBoundingClientRect();
        return { w: r.width, h: r.height, sw: st.width, sh: st.height, bg: getComputedStyle(document.getElementById('stage')).backgroundColor };
      });
      expect(Math.abs(m.w / m.h - 4 / 3)).toBeLessThan(0.01);
      expect(m.w === Math.floor(m.sw) || m.h === Math.floor(m.sh)).toBe(true);
      expect(m.bg).toBe('rgb(0, 0, 0)');
    });
  }

  test('S2: every sampled canvas pixel is pure black or pure white', async ({ page }) => {
    await openArcade(page, FILE);
    await startMatch(page);
    await page.waitForTimeout(2200);
    const c = await colorCensus(page, 2);
    expect(c.other).toBe(0);
    expect(c.white).toBeGreaterThan(0);
  });
});

test.describe('input and audio', () => {
  test('S11/E4/E5/E6: Enter pauses with PAUSE; blur and hidden tab pause and suspend audio; held keys clear', async ({ page }) => {
    await openArcade(page, FILE, { initScript: audioStub });
    await startMatch(page);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => pongApp.paused);
    expect(await page.evaluate(() => pongApp.render().some((r) => r[4] === 0))).toBe(true);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !pongApp.paused);
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(100);
    await hideTab(page);
    expect(await page.evaluate(() => [pongApp.paused, window.__audio.state])).toEqual([true, 'suspended']);
    await showTab(page);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !pongApp.paused);
    const y0 = await page.evaluate(() => pongApp.match.paddles.left);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => [pongApp.match.paddles.left, window.__audio.state])).toEqual([y0, 'running']);
    await page.keyboard.up('ArrowDown');
  });

  test('S5/P7: audio starts after the first key; each event has its tone; mute silences; the state survives reload', async ({ page }) => {
    await openArcade(page, FILE, { initScript: audioStub });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__audio.created)).toBe(0);
    await startMatch(page);
    expect(await page.evaluate(() => window.__audio.created)).toBe(1);
    // Paddle hit: put the ball just right of the left paddle, moving left.
    const fire = async (setup) => {
      await page.evaluate(setup);
      await page.waitForTimeout(150);
      return page.evaluate(() => { const t = window.__audio.tones.slice(); window.__audio.tones.length = 0; return t; });
    };
    const near = (a, b, tol) => Math.abs(a - b) <= tol;
    let t = await fire(() => {
      const m = pongApp.match; m.serveTimer = 0; m.paddles.left = 100; m.paddles.right = 100;
      Object.assign(m.ball, { x: 54, y: 106, dir: -1, vy: 0 });
    });
    expect(t.length).toBe(1);
    expect(t[0].freq).toBe(491);
    expect(near(t[0].stop - t[0].start, 0.017, 0.002)).toBe(true);
    t = await fire(() => { const m = pongApp.match; Object.assign(m.ball, { x: 180, y: 1, dir: 1, vy: -3 }); });
    expect(t.length).toBe(1);
    expect(t[0].freq).toBe(246);
    expect(near(t[0].stop - t[0].start, 0.016, 0.002)).toBe(true);
    t = await fire(() => { const m = pongApp.match; m.paddles.right = 230; Object.assign(m.ball, { x: 370, y: 20, dir: 1, vy: 0 }); });
    expect(t.length).toBe(1);
    expect(t[0].freq).toBe(246);
    expect(near(t[0].stop - t[0].start, 0.24, 0.002)).toBe(true);
    await page.keyboard.press('KeyM');
    await expect(page.locator('#sound')).toContainText('SOUND: OFF');
    t = await fire(() => { const m = pongApp.match; m.serveTimer = 0; Object.assign(m.ball, { x: 180, y: 1, dir: 1, vy: -3 }); });
    expect(t.length).toBe(0);
    await page.reload();
    await expect(page.locator('#sound')).toContainText('SOUND: OFF');
  });

  test('S4/PK1: Up and Down move the paddle; an OS repeat event alone does not', async ({ page }) => {
    await openArcade(page, FILE);
    await startMatch(page);
    const y0 = await page.evaluate(() => pongApp.match.paddles.left);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', repeat: true })));
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => pongApp.match.paddles.left)).toBe(y0);
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.up('ArrowDown');
    const y1 = await page.evaluate(() => pongApp.match.paddles.left);
    expect(y1).toBeGreaterThan(y0);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(200);
    await page.keyboard.up('ArrowUp');
    expect(await page.evaluate(() => pongApp.match.paddles.left)).toBeLessThan(y1);
  });
});
