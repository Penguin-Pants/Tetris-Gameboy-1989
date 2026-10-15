// Extracts the pure logic block from gameboy-tetris.html and runs it in node:vm.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const HTML_PATH = fileURLToPath(new URL('../../gameboy-tetris.html', import.meta.url));

const BEGIN = '/* ==BEGIN LOGIC== */';
const END = '/* ==END LOGIC== */';

export function extractLogic(html) {
  const start = html.indexOf(BEGIN);
  const end = html.indexOf(END);
  if (start < 0 || end < 0 || end < start) throw new Error('Logic markers not found');
  return html.slice(start + BEGIN.length, end);
}

// Returns a fresh GB namespace. The block runs inside a function wrapper in
// this realm, so arrays and errors compare normally in assertions.
export function loadGB() {
  const code = extractLogic(readFileSync(HTML_PATH, 'utf8'));
  const factory = vm.runInThisContext(`(function () {\n${code}\nreturn GB;\n})`,
    { filename: 'gameboy-tetris.html#logic' });
  return factory();
}
