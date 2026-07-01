import { test, expect } from '@playwright/test';

/**
 * Canvas-widget Stage 3 — the 'length' declarable gesture (turn 9). Mirrors the ncircle increment: a custom op tags
 * three number params with the "2D length" roles (anchor x, anchor y, len); layoutSpecFromOp maps the {x,y,len} group
 * to a point handle + a LENGTH handle (a 1D extent along Y from the anchor, reusing the Stage-2 'length' gesture).
 * Dragging the length handle writes the bound len field and re-emits — drag-to-edit with NO per-op code.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('a length param is declarable (nlen roles decode + complete group) and drags on the form2d preview', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);

  // the three role-encoded values decode to the nlength widget + its roles
  const decoded = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    return ['nlen-x', 'nlen-y', 'nlen-l'].map((w) => U.decodeCanvasWidget(w));
  });
  expect(decoded, 'each nlen value decodes to the nlength widget + role').toEqual([
    { widget: 'nlength', role: 'x' }, { widget: 'nlength', role: 'y' }, { widget: 'nlength', role: 'len' },
  ]);

  // AUTHOR a form2d op whose centre x/y + an extent (depth) are "2D length" number params.
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    const template = [{ type: 'bore', params: {
      x: { type: 'param', params: { name: 'lx', value: 40, widget: 'nlen-x' } },
      y: { type: 'param', params: { name: 'ly', value: 30, widget: 'nlen-y' } },
      depth: { type: 'param', params: { name: 'll', value: 10, widget: 'nlen-l' } },
      holeDia: 6, toolDia: 6, pitch: 0.5, ramp: 'step', feed: 120, clearance: 5,
    } }];
    const bindings = U.extractParamBlocks(template, new Set(), true);
    U.createUserOp(U.userOpFromStack('lengthdrag', 'Length Drag', template, bindings, 'form2d'));
  });
  await page.evaluate(() => window.openWiz('user_lengthdrag'));

  // the form rendered the three length params as writable number fields
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });
  const fieldParams = await page.$$eval('#wiz_user_form [data-param]', (ns) => ns.map((n) => n.dataset.param).sort());
  expect(fieldParams, 'the form rendered the length params as writable number fields').toEqual(['ll', 'lx', 'ly']);

  // the LENGTH handle is a size handle (a circle, like the ncircle ring) — distinct from the point move-square.
  const handle = page.locator('#userVizContainer2D circle.fc-handle').first();
  await handle.waitFor({ state: 'visible' });

  const before = await page.evaluate(() => ({
    ll: document.querySelector('#wiz_user_form [data-param="ll"]').value,
    code: (document.getElementById('wiz_user_code') || {}).textContent || '',
  }));

  // REAL drag along the length axis (Y); the exact value depends on the screen→world map, so assert it MOVED + re-emitted.
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(() => document.querySelector('#wiz_user_form [data-param="ll"]').value)).not.toBe(before.ll);

  const after = await page.evaluate(() => ({
    ll: document.querySelector('#wiz_user_form [data-param="ll"]').value,
    code: (document.getElementById('wiz_user_code') || {}).textContent || '',
  }));
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(Number(after.ll), 'dragging the length handle wrote the len field').not.toBe(Number(before.ll));
  expect(after.code, 'the op G-code re-rendered after the length drag').not.toBe(before.code);
});
