import { test, expect } from '@playwright/test';

/**
 * Region-pick control — runtime (v1, numeric). The "make your own datum": a binding with widget:'region-pick' +
 * a widgetConfig spec {viewBox, backdrop?, regions:[{shape,…,value,label}]} renders an SVG of clickable regions
 * (rect / poly / freeform) over an optional backdrop; clicking a region commits its NUMBER. Shares its core
 * (regionPickSvg.js) with the future Blockly field, like the datum. Locks: it renders the regions, and a click
 * commits the picked region's numeric value.
 */
test.use({ viewport: { width: 1000, height: 900 } });

const TEMPLATE = [{ type: 'move', params: { x: 0, y: 0, z: -5, feed: 100 } }];
const SPEC = {
  viewBox: '0 0 200 120',
  regions: [
    { shape: 'rect', x: 10, y: 10, w: 80, h: 100, value: 100, label: 'Slow' },
    { shape: 'rect', x: 110, y: 10, w: 80, h: 45, value: 500, label: 'Med' },
    { shape: 'poly', points: '110,65 190,65 190,110 150,110', value: 1500, label: 'Fast' },
  ],
};

test('region-pick: renders clickable regions over the spec; a click commits the region number', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsInsertUserOp && window.ddcsGetBlockProgram);

  await page.evaluate(async ({ TEMPLATE, SPEC }) => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    U.createUserOp(U.userOpFromStack('rp_test', 'Region Pick Test', TEMPLATE,
      [{ param: 'feed', blockIndex: 0, key: 'feed', type: 'number', widget: 'region-pick', widgetConfig: SPEC, default: 100 }]));
    window.ddcsInsertUserOp('user_rp_test');
  }, { TEMPLATE, SPEC });

  const form = page.locator('.uop-form');
  await expect(form).toBeVisible();
  // one SVG, three clickable region shapes (2 rect + 1 poly), no plain number row for feed
  await expect(form.locator('svg')).toHaveCount(1);
  await expect(form.locator('svg [data-ri]')).toHaveCount(3);
  await expect(form.locator('input[type="number"]')).toHaveCount(0);

  // pick the "Fast" poly region → commits 1500 (a number)
  await form.locator('svg polygon[data-ri]').click();
  await form.locator('.uop-insert').click();
  await expect(form).toHaveCount(0);

  const op = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op' && b.opType === 'user_rp_test'));
  expect(op).toBeTruthy();
  expect(op.params.feed).toBe(1500);
  expect(typeof op.params.feed).toBe('number');

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
