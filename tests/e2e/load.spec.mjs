import { test, expect } from '@playwright/test';
import { openGame } from './helpers.mjs';

test('D1: opens from file:// with no console output and zero requests', async ({ page }) => {
  const { logs, requests } = await openGame(page);
  await page.waitForTimeout(500);
  expect(logs).toEqual([]);
  expect(requests).toEqual([]);
  const size = await page.$eval('#screen', (c) => [c.width, c.height]);
  expect(size).toEqual([160, 144]);
});

test('L2: blank screen is the lightest shade', async ({ page }) => {
  await openGame(page);
  const px = await page.$eval('#screen', (c) => Array.from(c.getContext('2d').getImageData(80, 72, 1, 1).data));
  expect(px).toEqual([0xff, 0xed, 0x79, 255]);
});
