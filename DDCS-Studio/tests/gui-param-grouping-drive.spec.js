import { test, expect } from '@playwright/test';

/**
 * GUI param block — xy/rect canvas GROUPING, the real-DOM half. The pure extractParamBlocks role/grouping logic
 * split out to tests/node/gui-param-grouping.test.mjs (tier migration); this file keeps the two tests that need a
 * real page: the form actually rendering one shared canvas + committing through user interaction, and the Class-B
 * render guard (a real Blockly workspace).
 */

test('xy/rect grouping: two xy-pad param pills render as ONE canvas and commit numbers', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsInsertUserOp && window.ddcsGetBlockProgram);

  await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    const pill = (name, widget, value) => ({ type: 'param', params: { name, widget, value } });
    const template = [{ type: 'move', params: { x: pill('cx', 'xy-x', 50), y: pill('cy', 'xy-y', 30), z: -5 } }];
    const bindings = U.extractParamBlocks(template);   // the real save path groups the pills by declared role
    U.createUserOp(U.userOpFromStack('xygroup_test', 'XY Group Test', template, bindings));
    window.ddcsInsertUserOp('user_xygroup_test');
  });

  const form = page.locator('.uop-form');
  await expect(form).toBeVisible();
  await expect(form.locator('svg')).toHaveCount(1);                   // ONE canvas for both params
  await expect(form.locator('.fc-handle-move')).toHaveCount(1);
  await expect(form.locator('input[type="number"]')).toHaveCount(0);  // not two separate number rows

  await form.locator('.uop-insert').click();
  await expect(form).toHaveCount(0);

  const op = await page.evaluate(() => (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op' && b.opType === 'user_xygroup_test'));
  expect(op).toBeTruthy();
  expect(typeof op.params.cx).toBe('number');
  expect(typeof op.params.cy).toBe('number');

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test.describe('Class-B render guard', () => {
  test.use({ viewport: { width: 1400, height: 1000 } });

  test('xy/rect grouping: role-encoded xy-pad param pills draw in their sockets', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);

    await page.evaluate(() => {
      const pill = (name, widget) => ({ type: 'param', params: { name, widget, value: 0 } });
      window.ddcsLoadBlockStack([{ type: 'move', params: { x: pill('cx', 'xy-x'), y: pill('cy', 'xy-y'), z: -5 } }]);
    });
    await page.waitForTimeout(300);

    const render = await page.evaluate(() => {
      const ps = window.__blkws.getAllBlocks().filter((b) => b.type === 'param');
      return { count: ps.length, allDrawn: ps.length > 0 && ps.every((p) => p.getHeightWidth().height > 0), widgets: ps.map((p) => p.getFieldValue('WIDGET')).sort() };
    });
    expect(render.count).toBe(2);
    expect(render.allDrawn, 'both param pills actually rendered (height > 0)').toBe(true);
    expect(render.widgets).toEqual(['xy-x', 'xy-y']);
  });
});
