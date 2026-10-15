// Shared test helpers for the rules engine. Test-only code.

// Seedable PRNG (mulberry32). Tests only; the game injects Math.random.
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

// rng that returns piece ids from a list (0..6), then repeats the last one.
export function sequence(ids) {
  let i = 0;
  return () => (ids[Math.min(i++, ids.length - 1)] + 0.5) / 7;
}

export const NONE = Object.freeze({});

// Runs frames until pred(events, g) is true. Returns the frame count used.
export function runUntil(R, g, pred, input = NONE, limit = 5000) {
  for (let f = 1; f <= limit; f++) {
    const ev = R.step(g, typeof input === 'function' ? input(f, g) : input);
    if (pred(ev, g)) return f;
  }
  throw new Error('runUntil: limit reached');
}

export const has = (type) => (ev) => ev.some((e) => e.type === type);

// Fills field row r (0..17) fully except the listed columns.
export function fillRow(R, g, r, holes = []) {
  for (let c = 0; c < 10; c++) {
    const v = holes.includes(c) ? 0 : 0x83;
    g.board[R.idx(r, c)] = v;
    g.vram[r * 10 + c] = v;
  }
}

// Puts a vertical I piece (rotation 1) above column col, falling.
export function placeVerticalI(R, g, col) {
  g.type = 2;
  g.rot = 1;
  g.row = 0;
  g.col = col - 1;
  g.active = true;
}

// Clears n bottom rows with a vertical I in column 0. Returns events seen
// until the next piece spawns.
export function clearLines(R, g, n) {
  for (let r = 0; r < 18; r++) fillRow(R, g, r, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (let k = 0; k < n; k++) fillRow(R, g, 17 - k, [0]);
  placeVerticalI(R, g, 0);
  const all = [];
  runUntil(R, g, (ev) => { all.push(...ev); return ev.some((e) => e.type === 'spawn'); });
  return all;
}

export function boardHash(g) {
  let h = 2166136261;
  for (const v of g.board) { h ^= v; h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16);
}

// Simple placement bot for replay tests. It picks a rotation and column with a
// height/holes heuristic, then plays it with real inputs: rotate taps, side
// taps, then held down. Deterministic for a given game.
export function makeBot(R) {
  let plan = null;
  let tick = 0;
  function evaluate(g, rot, col) {
    let row = g.row;
    if (R.collides(g.board, g.type, rot, row, col)) return null;
    while (!R.collides(g.board, g.type, rot, row + 1, col)) row++;
    const b = g.board.slice();
    for (const [r, c, t] of R.cells(g.type, rot)) b[R.idx(row + r, col + c)] = t;
    let lines = 0, holes = 0, agg = 0, bump = 0, prev = -1;
    for (let r = 2; r < 18; r++) {
      let full = true;
      for (let c = 0; c < 10; c++) if (!b[R.idx(r, c)]) full = false;
      if (full) lines++;
    }
    for (let c = 0; c < 10; c++) {
      let height = 0;
      let seen = false;
      for (let r = 0; r < 18; r++) {
        if (b[R.idx(r, c)]) { if (!seen) height = 18 - r; seen = true; } else if (seen) holes++;
      }
      agg += height;
      if (prev >= 0) bump += Math.abs(height - prev);
      prev = height;
    }
    return 0.76 * lines - 0.51 * agg - 0.36 * holes - 0.18 * bump;
  }
  return function input(f, g) {
    if (!g.active) { plan = null; return {}; }
    if (!plan) {
      let best = null;
      for (let k = 0; k < 4; k++) {
        const rot = (4 - k) & 3; // k clockwise taps from rotation 0
        for (let col = -2; col < 10; col++) {
          const s = evaluate(g, rot, col);
          if (s !== null && (!best || s > best.s)) best = { s, rot, col, taps: k };
        }
      }
      plan = best || { rot: g.rot, col: g.col, taps: 0 };
      tick = 0;
    }
    tick++;
    if (tick % 2 === 0) return {};
    if (g.rot !== plan.rot) return { rotate: true };
    if (g.col < plan.col) return { right: true };
    if (g.col > plan.col) return { left: true };
    return { down: true };
  };
}
