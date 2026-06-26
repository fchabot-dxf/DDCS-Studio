import { test, expect } from '@playwright/test';

/**
 * VERIFY THE REAL SYMPTOM (north star #7): a REAL authored 2D-point custom op, opened in the actual wizard PANEL
 * (#wiz_user, the form2d two-pane the operator sees), is drag-to-edit on the big preview — not just at the
 * function-seam altitude. Authors via the real extraction (point-x/point-y pills → extractParamBlocks), registers
 * it, opens it with window.openWiz, then DRAGS the preview handle with a real pointer gesture and asserts the form
 * number fields + the emitted G-code update. This is the gap the consumer seam was inert against.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('a real authored 2D-point op: the form2d preview handle drags and writes the form (real panel, real drag)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);

  // AUTHOR + register a form2d op whose move-atom X/Y are "2D point" number params (the real authoring extraction).
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    const template = [{ type: 'move', params: {
      x: { type: 'param', params: { name: 'px', value: 30, widget: 'point-x' } },
      y: { type: 'param', params: { name: 'py', value: 40, widget: 'point-y' } },
      z: -2, mode: 'rapid',
    } }];
    const bindings = U.extractParamBlocks(template, new Set(), true);
    U.createUserOp(U.userOpFromStack('pointdrag', 'Point Drag', template, bindings, 'form2d'));
  });

  await page.evaluate(() => window.openWiz('user_pointdrag'));

  // the PRODUCER fix in the real panel: two writable number fields rendered from the point group
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });
  const fieldParams = await page.$$eval('#wiz_user_form [data-param]', (ns) => ns.map((n) => n.dataset.param).sort());
  expect(fieldParams, 'the form rendered both point params as writable number fields').toEqual(['px', 'py']);

  // the CONSUMER seam reaching the real panel: a draggable handle on the 2D preview
  const handle = page.locator('#userVizContainer .fc-handle-move').first();
  await handle.waitFor({ state: 'visible' });

  const before = await page.evaluate(() => ({
    px: document.querySelector('#wiz_user_form [data-param="px"]').value,
    py: document.querySelector('#wiz_user_form [data-param="py"]').value,
    code: (document.getElementById('wiz_user_code') || {}).textContent || '',
  }));

  // REAL drag: press on the handle and move it (the FeatureCanvas maps screen→world; the exact target value doesn't
  // matter — we assert the point MOVED and the code re-emitted, which only happens if the whole loop is wired).
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(() =>
    document.querySelector('#wiz_user_form [data-param="px"]').value
  )).not.toBe(before.px);

  const after = await page.evaluate(() => ({
    px: document.querySelector('#wiz_user_form [data-param="px"]').value,
    py: document.querySelector('#wiz_user_form [data-param="py"]').value,
    code: (document.getElementById('wiz_user_code') || {}).textContent || '',
  }));
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  // the drag wrote at least one of the bound fields AND the op re-emitted (update() ran through the real listener)
  const moved = after.px !== before.px || after.py !== before.py;
  expect(moved, 'dragging the preview wrote the point param fields').toBe(true);
  expect(after.code, 'the emitted G-code re-rendered after the drag').not.toBe(before.code);
});
