import { test, expect } from '@playwright/test';
import { openGame } from './helpers.mjs';

test('D1: opens from file:// with no console output and zero requests', async ({ page }) => {
  const { logs, requests } = await openGame(page);
  await page.waitForTimeout(500);
  expect(logs).toEqual([]);
  expect(requests).toEqual([]);
  const size = await page.$eval('#screen', (c) => [c.width / 160, c.height / 144]);
  expect(size[0]).toBe(size[1]);
});

