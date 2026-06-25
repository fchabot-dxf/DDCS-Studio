import { test, expect } from '@playwright/test';

/**
 * GUI param block — xy/rect canvas GROUPING with DECLARED roles (audit #6-B). A param pill's canvas role is folded
 * into its widget value (xy-x / xy-y / rect-x/-y/-w/-h), so `extractParamBlocks` reads the role from the explicit
 * declaration — NEVER from pool position. Same-widget pills form a canvas; a repeated role starts a new one; an
 * incomplete canvas degrades to plain number knobs. Locks: the grouping, ORDER-INDEPENDENCE (the #6-B fix), the
 * form renders one canvas, and the pills draw in their sockets.
 */

test('xy/rect grouping: declared roles → group/role bindings (incomplete degrades)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const pill = (name, widget, value) => ({ type: 'param', params: { name, widget, value } });
    // a complete xy-pad + a lone xy-x (incomplete → degrades) + a complete rect
    const tmpl = [
      { type: 'move', params: { x: pill('cx', 'xy-x', 50), y: pill('cy', 'xy-y', 30), z: pill('cz', 'xy-x', 10), feed: pill('rx', 'rect-x', 0) } },
      { type: 'move', params: { x: pill('ry', 'rect-y', 0), y: pill('rw', 'rect-w', 80), z: pill('rh', 'rect-h', 60) } },
    ];
    return U.extractParamBlocks(tmpl);
  });

  const by = (p) => r.find((b) => b.param === p);
  // xy-pad pair → one group, declared roles x/y, only the first carries the widget
  expect(by('cx')).toMatchObject({ role: 'x', widget: 'xy-pad', type: 'number' });
  expect(by('cy')).toMatchObject({ role: 'y' });
  expect(by('cx').group).toBe(by('cy').group);
  expect(by('cy').widget).toBeUndefined();
  // the lone xy-x (no matching y) → incomplete canvas → degrades to a plain number knob
  expect(by('cz').group).toBeUndefined();
  expect(by('cz').role).toBeUndefined();
  expect(by('cz').widget).toBeUndefined();
  // rect four → one group, declared roles x/y/w/h
  expect(by('rx')).toMatchObject({ role: 'x', widget: 'rect' });
  expect(by('rh')).toMatchObject({ role: 'h' });
  const rg = by('rx').group;
  expect(rg && [by('ry'), by('rw'), by('rh')].every((b) => b.group === rg)).toBe(true);
  expect(rg).not.toBe(by('cx').group);
});

test('xy/rect grouping: roles are ORDER-INDEPENDENT (the #6-B fix)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const pill = (name, widget) => ({ type: 'param', params: { name, widget, value: 0 } });
    // declare Y *before* X — with positional inference this would flip the roles; with declared roles it must not
    const tmpl = [{ type: 'move', params: { y: pill('cy', 'xy-y'), x: pill('cx', 'xy-x') } }];
    const b = U.extractParamBlocks(tmpl);
    return { cx: b.find((x) => x.param === 'cx'), cy: b.find((x) => x.param === 'cy') };
  });
  // cx is X and cy is Y regardless of the pills' order in the stack
  expect(r.cx.role).toBe('x');
  expect(r.cy.role).toBe('y');
  expect(r.cx.group).toBe(r.cy.group);
});

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
