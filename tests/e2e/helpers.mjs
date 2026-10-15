import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

export const FILE_URL = pathToFileURL(
  fileURLToPath(new URL('../../gameboy-tetris.html', import.meta.url))).href;

// Opens the game from file:// and records console output and network requests.
export async function openGame(page, { initScript } = {}) {
  const logs = [];
  const requests = [];
  page.on('console', (m) => {
    // Chrome warns when a test reads the canvas back many times. The game
    // never reads the canvas, so this one warning comes from the test probe.
    if (/willReadFrequently/.test(m.text())) return;
    logs.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  page.on('request', (r) => { if (r.url() !== FILE_URL) requests.push(r.url()); });
  if (initScript) await page.addInitScript(initScript);
  await page.goto(FILE_URL);
  return { logs, requests };
}

// From the title: Enter, optional Down presses on level select, Enter.
export async function startGame(page, { down = 0, right = 0 } = {}) {
  await page.waitForFunction(() => window.gbApp && window.gbApp.screen === 'title');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.gbApp.screen === 'levelSelect');
  for (let i = 0; i < down; i++) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < right; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.gbApp.screen === 'play');
}

// True when the visible canvas equals a framebuffer drawn in the page by
// draw(fb, GB). Samples the center of each logical pixel.
export async function canvasMatches(page, draw, arg) {
  return page.evaluate(([src, a]) => {
    const fn = new Function('fb', 'GB', 'arg', src);
    const fb = GB.VIEW.createFramebuffer();
    fn(fb, GB, a);
    const c = document.getElementById('screen');
    const k = c.width / 160;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const pal = GB.CONST.PALETTE.map((h) => parseInt(h.slice(1, 3), 16));
    for (let y = 0; y < 144; y++) for (let x = 0; x < 160; x++) {
      const i = ((y * k + (k >> 1)) * c.width + (x * k + (k >> 1))) * 4;
      if (d[i] !== pal[fb[y * 160 + x]]) return false;
    }
    return true;
  }, [draw, arg]);
}

// Stubs Math.random so every piece is an O (id 3).
export const ALWAYS_O = () => { Math.random = () => 0.5; };

// Soft-drops pieces until the game ends.
export async function playToGameOver(page) {
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(() => gbApp.screen !== 'play')) break;
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(250);
    await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(30);
  }
  await page.waitForFunction(() => gbApp.screen === 'gameOver');
}
