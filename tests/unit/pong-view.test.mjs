import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from '../helpers/load-arcade.mjs';

const { PONG } = loadGame('pong.html', 'PONG');
const { CONST: C, RULES: R, VIEW: V } = PONG;

const inWindow = (rects, x0, x1) => rects.filter((r) => r[1] >= 16 && r[1] < 48 && r[0] >= x0 && r[0] < x1);

test('P1: paddles, ball and the dashed net (4 lines on, 4 off) are in place', () => {
  const m = R.createMatch();
  m.paddles = { left: 40, right: 200 };
  m.serveTimer = 0;
  Object.assign(m.ball, { x: 100, y: 60 });
  const rects = V.renderMatch(m, {});
  assert.ok(rects.some((r) => r.join() === [C.LEFT_X, 40, 4, 16].join()), 'left paddle');
  assert.ok(rects.some((r) => r.join() === [C.RIGHT_X, 200, 4, 16].join()), 'right paddle');
  assert.ok(rects.some((r) => r.join() === [100, 60, 4, 4].join()), 'ball');
  const net = rects.filter((r) => r[0] === C.NET_X && r[2] === 1);
  assert.equal(net.length, Math.ceil(C.H / 8));
  net.forEach((r, i) => { assert.equal(r[1], i * 8); assert.ok(r[3] <= 4); });
});

test('P1: the ball is hidden during the serve delay', () => {
  const m = R.createMatch();
  const rects = V.renderMatch(m, {});
  assert.ok(!rects.some((r) => r[2] === 4 && r[3] === 4));
});

test('P1: score digits 0, 7 and 11 with the leading zero blank', () => {
  const m = R.createMatch();
  const segs = (n, x0) => { m.score.left = n; return inWindow(V.renderMatch(m, {}), x0, x0 + 64); };
  assert.equal(segs(0, 48).length, 6, '0 has six segments');
  assert.equal(segs(7, 48).length, 3, '7 has three segments and no tens digit');
  const eleven = segs(11, 48);
  assert.equal(eleven.length, 4, '11 is two ones');
  assert.ok(eleven.some((r) => r[0] < 80) && eleven.some((r) => r[0] >= 80), 'tens and units cells');
  m.score.right = 3;
  assert.equal(inWindow(V.renderMatch(m, {}), 240, 304).length, 5);
});

test('E5: the PAUSE label clears a black box over the field', () => {
  const m = R.createMatch();
  const rects = V.renderMatch(m, { label: 'PAUSE' });
  assert.ok(rects.some((r) => r[4] === 0), 'black box');
  assert.ok(rects.length > V.renderMatch(m, {}).length + 20, 'label pixels');
});
