// Space Invaders renderer: HUD and play screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from '../helpers/load-arcade.mjs';

const { SI } = loadGame('space-invaders.html', 'SI');
const V = SI.VIEW, R = SI.RULES;

// The 8 x 8 cells of a 4-digit field at (x, y), as a string per cell.
function cells(fb, x, y, n = 4) {
  const out = [];
  for (let k = 0; k < n; k++) {
    let s = '';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) s += fb[(y + r) * 224 + x + 8 * k + c];
    out.push(s);
  }
  return out;
}

function textCells(str) {
  const fb = V.createFramebuffer();
  V.text(fb, str, 0, 0);
  return cells(fb, 0, 0, str.length);
}

test('I11: HUD SCORE shows 4 digits at 0 and 9,999', () => {
  for (const score of [0, 9999, 42]) {
    const fb = V.createFramebuffer();
    V.hud(fb, { score, hi: 0 });
    assert.deepEqual(cells(fb, 24, 24), textCells(('0000' + score).slice(-4)), `score ${score}`);
  }
});

test('I11: HI-SCORE shows 0000 with an empty list and the given first entry otherwise', () => {
  let fb = V.createFramebuffer();
  V.hud(fb, { score: 0, hi: 0 });
  assert.deepEqual(cells(fb, 88, 24), textCells('0000'));
  fb = V.createFramebuffer();
  V.hud(fb, { score: 0, hi: 1230 });
  assert.deepEqual(cells(fb, 88, 24), textCells('1230'));
});

test('I11: lives digit and one spare cannon per ship in the stash', () => {
  const g = R.createGame();
  const fb = V.createFramebuffer();
  V.renderPlay(fb, g, { hi: 0 });
  assert.deepEqual(cells(fb, 8, 240, 1), textCells('3'));
  const lit = (x0) => { let n = 0; for (let y = 240; y < 248; y++) for (let x = x0; x < x0 + 16; x++) n += fb[y * 224 + x]; return n; };
  assert.ok(lit(24) > 40 && lit(40) > 40, 'two spare cannons');
  assert.equal(lit(56), 0);
});

test('Play screen copies screen memory pixel for pixel and shows PAUSE when asked', () => {
  const g = R.createGame();
  for (let i = 0; i < 400; i++) R.step(g, {});
  const fb = V.createFramebuffer();
  V.renderPlay(fb, g, { hi: 0 });
  for (let y = 40; y < 239; y += 3) for (let x = 0; x < 224; x += 3) assert.equal(fb[y * 224 + x], R.pixel(g, x, y));
  V.renderPlay(fb, g, { hi: 0, label: 'PAUSE' });
  let n = 0;
  for (let y = 128; y < 136; y++) for (let x = 80; x < 144; x++) n += fb[y * 224 + x];
  assert.ok(n > 20);
});
