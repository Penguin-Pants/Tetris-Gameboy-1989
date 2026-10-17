// Extracts the pure logic block from an arcade game file and runs it in
// node:vm. Uses the same LOGIC markers as the Tetris loader.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { extractLogic } from './load-logic.mjs';

export const ARCADE_FILES = [
  { file: 'pong.html', ns: 'PONG' },
  { file: 'space-invaders.html', ns: 'SI' }
];

export function gamePath(fileName) {
  return fileURLToPath(new URL(`../../${fileName}`, import.meta.url));
}

// Returns { ARCADE, <ns> } from a fresh copy of the file's logic block.
export function loadGame(fileName, ns) {
  const code = extractLogic(readFileSync(gamePath(fileName), 'utf8'));
  const factory = vm.runInThisContext(
    `(function () {\n${code}\nreturn { ARCADE: ARCADE, ${ns}: ${ns} };\n})`,
    { filename: `${fileName}#logic` });
  return factory();
}

// Seedable PRNG (mulberry32). Tests only; the games inject Math.random.
export function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
