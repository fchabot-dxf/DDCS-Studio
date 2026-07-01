import { test, expect } from '@playwright/test';

/**
 * CORNER-PORT inc B3 LAYOUT+DRAG — verify-real-symptom: a REAL "Corner (data)" opened in the real #wiz_user form2d panel
 * renders its FeatureCanvas layout with a draggable REPOSITION point handle (cross1_x/cross1_y = a generic x/y point role),
 * and a REAL pointer drag writes a LITERAL into those sockets → the EMITTED reposition #23/#24 flips from the signed-travelDist
 * EXPRESSION (#15/#16) to a numeric literal. This is the "expression-holding socket, overridable by a bound literal" payoff of
 * the LOCKED MODEL. The drag is relative to the default geometry (INTERIM — the datum-relative form lands with the stock-datum
 * follow-up; no datum #var is needed to write a plain literal offset). Mirrors custom-op-form2d-drag.spec.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('Corner (data): dragging the reposition handle writes a literal into the emitted reposition (#23/#24)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);

  // register the REAL shipped def (panel form2d + grouped cross1_x/y point roles after B3)
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });

  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });

  // the point role needs BOTH cross params rendered as writable fields
  const hasFields = await page.$$eval('#wiz_user_form [data-param]', (ns) => {
    const s = new Set(ns.map((n) => n.dataset.param));
    return s.has('cross1_x') && s.has('cross1_y');
  });
  expect(hasFields, 'cross1_x + cross1_y render as writable form fields (the point role)').toBe(true);

  // PRE-DRAG (negative control): the unset reposition socket emits the signed-travelDist EXPRESSION (#15/#16), not a literal.
  const before = await page.evaluate(() => ({
    cx: document.querySelector('#wiz_user_form [data-param="cross1_x"]').value,
    code: (document.getElementById('wiz_user_code') || {}).textContent || '',
  }));
  expect(before.code, 'the default reposition socket holds the #15/#16 expression').toMatch(/#23\s*=\s*#1[56]\b/);

  // the reposition point drag handle on the 2D preview
  const handle = page.locator('#userVizContainer .fc-handle-move').first();
  await handle.waitFor({ state: 'visible' });
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 110, box.y + box.height / 2 + 70, { steps: 8 });
  await page.mouse.up();

  // the writeback loop is wired: the field changed
  await expect.poll(async () => page.evaluate(() =>
    document.querySelector('#wiz_user_form [data-param="cross1_x"]').value
  )).not.toBe(before.cx);

  const after = await page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  // THE LOAD-BEARING ASSERTIONS (verify-real-symptom): the EMITTED reposition took a numeric literal; the expression is GONE.
  expect(after, 'the reposition re-emitted after the drag').not.toBe(before.code);
  expect(/#23\s*=\s*-?\d+(\.\d+)?\b/.test(after), 'reposition #23 is now a numeric literal').toBe(true);
  expect(after, 'the #15/#16 expression default is gone from the reposition socket').not.toMatch(/#23\s*=\s*#1[56]\b/);
});
