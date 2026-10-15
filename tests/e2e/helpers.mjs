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
