import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

export const FILE_URL = pathToFileURL(
  fileURLToPath(new URL('../../gameboy-tetris.html', import.meta.url))).href;

// Opens the game from file:// and records console output and network requests.
export async function openGame(page, { initScript } = {}) {
  const logs = [];
  const requests = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
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
