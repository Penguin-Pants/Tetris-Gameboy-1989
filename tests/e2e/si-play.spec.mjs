import { test, expect } from '@playwright/test';
import { openArcade, colorCensus, audioStub, hideTab, showTab } from './arcade-helpers.mjs';

const FILE = 'space-invaders.html';

// Enter starts a game; the prompt and the cannon delay are cut short so the
// test does not wait 5 seconds.
async function startPlaying(page) {
  await page.waitForFunction(() => window.siApp);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => siApp.screen === 'play' && siApp.game);
  await page.evaluate(() => { siApp.game.isrDelay = 2; });
  await page.waitForFunction(() => siApp.game.phase === 'play');
  await page.evaluate(() => { siApp.game.obj[0].timer = 0; });
  await page.waitForFunction(() => siApp.game.playerOK === 1 && siApp.game.obj[0].timer === 0);
}

for (const size of [{ width: 800, height: 600 }, { width: 1600, height: 900 }, { width: 900, height: 1200 }]) {
  test(`S3: portrait 224x256 aspect, black margins, no scrollbars at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openArcade(page, FILE);
    const m = await page.evaluate(() => {
      const r = document.getElementById('screen').getBoundingClientRect();
      const de = document.documentElement;
      return {
        w: r.width, h: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom,
        sw: de.scrollWidth, sh: de.scrollHeight, cw: de.clientWidth, ch: de.clientHeight,
        bg: getComputedStyle(document.getElementById('stage')).backgroundColor
      };
    });
    expect(Math.abs(m.h / m.w - 256 / 224)).toBeLessThan(0.01);
    expect(m.left).toBeGreaterThanOrEqual(0);
    expect(m.top).toBeGreaterThanOrEqual(0);
    expect(m.right).toBeLessThanOrEqual(size.width);
    expect(m.sw).toBeLessThanOrEqual(m.cw);
    expect(m.sh).toBeLessThanOrEqual(m.ch);
    expect(m.bg).toBe('rgb(0, 0, 0)');
  });
}

test('S2: every sampled canvas pixel is pure black or pure white', async ({ page }) => {
  await openArcade(page, FILE);
  await startPlaying(page);
  await page.waitForTimeout(500);
  const c = await colorCensus(page, 2);
  expect(c.other).toBe(0);
  expect(c.white).toBeGreaterThan(100);
});

test('E5: Enter pauses with a PAUSE label and resumes', async ({ page }) => {
  await openArcade(page, FILE, { initScript: audioStub });
  await startPlaying(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => siApp.paused === true);
  const f0 = await page.evaluate(() => siApp.game.frame);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => siApp.game.frame)).toBe(f0);
  expect(await page.evaluate(() => window.__audio.state)).toBe('suspended');
  // The label area has white text pixels in the middle band.
  const lit = await page.evaluate(() => {
    const fb = new Uint8Array(224 * 256);
    siApp.render(fb);
    let n = 0;
    for (let y = 128; y < 136; y++) for (let x = 80; x < 144; x++) n += fb[y * 224 + x];
    return n;
  });
  expect(lit).toBeGreaterThan(20);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => siApp.paused === false);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => siApp.game.frame)).toBeGreaterThan(f0);
  expect(await page.evaluate(() => window.__audio.state)).toBe('running');
});

test('S11/E4/E6: blur and a hidden tab pause the game and sound; held keys clear', async ({ page }) => {
  await openArcade(page, FILE, { initScript: audioStub });
  await startPlaying(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);
  await hideTab(page);
  await page.waitForFunction(() => siApp.paused === true);
  expect(await page.evaluate(() => window.__audio.state)).toBe('suspended');
  await showTab(page);
  const x0 = await page.evaluate(() => siApp.game.playerXr);
  await page.keyboard.press('Enter');                       // resume while Right is still down
  await page.waitForFunction(() => siApp.paused === false);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => siApp.game.playerXr)).toBe(x0);
  await page.keyboard.up('ArrowRight');
});

test('S5/I12: audio starts on the first key; the 6 effects play; none while muted; state is saved', async ({ page }) => {
  await openArcade(page, FILE, { initScript: audioStub });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__audio.created)).toBe(0);
  await startPlaying(page);
  expect(await page.evaluate(() => window.__audio.created)).toBe(1);
  // Fleet march: low tones.
  await page.waitForFunction(() => window.__audio.tones.some((t) => [98, 87, 78, 69].includes(t.freq)), null, { timeout: 5000 });
  // Player shot: a noise burst.
  let n = await page.evaluate(() => window.__audio.noises.length);
  await page.keyboard.press('Space');
  await page.waitForFunction((k) => window.__audio.noises.length > k, n);
  // Invader hit: a shot placed on alien 0.
  await page.evaluate(() => {
    const g = siApp.game;
    Object.assign(g.shot, { status: 2, yr: g.refYr, xr: g.refXr + 4 });
    g.alienExploding = 1;
  });
  await page.waitForFunction(() => window.__audio.tones.some((t) => t.freq === 320));
  // UFO: a saucer on screen loops its sound.
  await page.evaluate(() => { Object.assign(siApp.game, { saucerStart: 1, saucerActive: 1, saucerXr: 0x60 }); });
  await page.waitForFunction(() => window.__audio.loops.some((l) => l.freq === 450));
  // UFO hit.
  await page.evaluate(() => { siApp.game.saucerHit = 1; });
  await page.waitForFunction(() => window.__audio.tones.some((t) => t.freq === 1200));
  // Player explosion: a long noise.
  n = await page.evaluate(() => window.__audio.noises.length);
  await page.evaluate(() => { siApp.game.playerAlive = 0; });
  await page.waitForFunction((k) => window.__audio.noises.length > k, n);
  // Muted: no new sound starts.
  await page.keyboard.press('KeyM');
  await expect(page.locator('#sound')).toHaveText('SOUND: OFF');
  const before = await page.evaluate(() => window.__audio.tones.length + window.__audio.noises.length);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__audio.tones.length + window.__audio.noises.length)).toBe(before);
  await page.reload();
  await expect(page.locator('#sound')).toHaveText('SOUND: OFF');
});

test('IK1/IK2: arrows move the cannon; holding Space fires once', async ({ page }) => {
  await openArcade(page, FILE);
  await startPlaying(page);
  const x0 = await page.evaluate(() => siApp.game.playerXr);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  const x1 = await page.evaluate(() => siApp.game.playerXr);
  expect(x1).toBeGreaterThan(x0 + 10);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowLeft');
  expect(await page.evaluate(() => siApp.game.playerXr)).toBeLessThan(x1);
  // Hold fire for 3 seconds: one shot is removed, no second shot starts.
  const c0 = await page.evaluate(() => siApp.game.shotCount);
  await page.keyboard.down('Space');
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => siApp.game.shotCount)).toBe(c0 + 1);
  expect(await page.evaluate(() => siApp.game.shot.status)).toBe(0);
  await page.keyboard.up('Space');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => siApp.game.shot.status !== 0);
});
