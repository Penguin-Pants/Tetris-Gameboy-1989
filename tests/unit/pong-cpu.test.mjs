// PD1/PD2: headless CPU difficulty simulation. The reference bots and the
// match runner live here only; pong.html ships the controller and the CPU.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, seeded } from '../helpers/load-arcade.mjs';

const { PONG } = loadGame('pong.html', 'PONG');
const { RULES: R, APP: A } = PONG;

// Fixed reference opponent (plan decision 13): same speed as the player.
const REF = { reaction: 8, speed: 4, error: 4 };
// New player: slower to react, slower and less accurate.
const NOVICE = { reaction: 14, speed: 3, error: 7 };
const MATCHES = 300;

// Plays one match as in the game: the CPU on the left, the opponent bot
// on the right (own random stream).
function play(cpu, botParams, botRng) {
  const m = R.createMatch();
  const bot = A.createTracker(botParams, botRng);
  for (let f = 0; !m.over && f < 400000; f++) {
    R.step(m, { left: cpu.move(A.playerView(m, 'left')), right: bot.move(A.playerView(m, 'right')) });
  }
  assert.equal(m.over, true, 'match finished');
  return m.winner;
}

function cpuWinRate(level, opponent, seedBase) {
  let wins = 0;
  for (let i = 0; i < MATCHES; i++) {
    // Independent streams: the CPU level never changes the opponent's draws.
    const cpu = A.createCpu(level, seeded(seedBase + i));
    if (play(cpu, opponent, seeded(seedBase + 100000 + i)) === 'left') wins++;
  }
  return wins / MATCHES;
}

test('PD2: CPU win rate against REF rises Easy < Normal < Hard, inside the target bands', () => {
  const easy = cpuWinRate('easy', REF, 1000);
  const normal = cpuWinRate('normal', REF, 1000);
  const hard = cpuWinRate('hard', REF, 1000);
  assert.ok(easy <= 0.35, `easy ${easy}`);
  assert.ok(normal >= 0.40 && normal <= 0.65, `normal ${normal}`);
  assert.ok(hard >= 0.70 && hard <= 0.90, `hard ${hard} (beatable means at most 90%)`);
  assert.ok(easy < normal && normal < hard);
});

test('PD2: a new player beats Easy in at least half the matches', () => {
  const easy = cpuWinRate('easy', NOVICE, 5000);
  assert.ok(1 - easy >= 0.5, `novice wins ${1 - easy}`);
});

test('PD1: difficulty changes only CPU moves; rules are the same', () => {
  // RULES takes no level, so the rules are the same by construction.
  assert.equal(R.createMatch.length, 0);
  // Same seed, same opponent: only the CPU (left) paddle path differs by level.
  const paths = A.LEVELS.map((level) => {
    const rng = seeded(42);
    const m = R.createMatch();
    const cpu = A.createCpu(level, rng);
    const bot = A.createTracker(REF, seeded(7));
    const ys = [];
    for (let f = 0; f < 1500; f++) {
      R.step(m, { left: cpu.move(A.playerView(m, 'left')), right: bot.move(A.playerView(m, 'right')) });
      ys.push(m.paddles.left);
    }
    return ys.join(',');
  });
  assert.equal(new Set(paths).size, 3);
});

test('Same seeds give the same results on two runs', () => {
  assert.equal(cpuWinRate('normal', REF, 1000), cpuWinRate('normal', REF, 1000));
});
