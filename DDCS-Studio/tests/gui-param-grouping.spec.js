import { test, expect } from '@playwright/test';

/**
 * GUI param block — xy/rect GROUPING. Param pills with widget xy-pad/rect are pooled and grouped BY ORDER
 * (xy-pad pairs → roles x,y; rect fours → x,y,w,h), exactly like the dev-mode inline-expose path, so two/four
 * param blocks collapse into ONE canvas picker in the form. Locks: extractParamBlocks emits group/role bindings,
 * an odd leftover degrades to a number knob, the form renders one canvas, and the pills draw in their sockets.
 */

test('xy/rect grouping: extractParamBlocks pools pills into group/role bindings (leftover degrades)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const pill = (name, widget, value) => ({ type: 'param', params: { name, widget, value } });
    // two xy-pad pills (→ one pad) + an odd third xy-pad (→ leftover number); four rect pills (→ one rect)
    const tmpl = [
      { type: 'move', params: { x: pill('cx', 'xy-pad', 50), y: pill('cy', 'xy-pad', 30), z: pill('cz', 'xy-pad', 10), feed: pill('rx', 'rect', 0) } },
      { type: 'move', params: { x: pill('ry', 'rect', 0), y: pill('rw', 'rect', 80), z: pill('rh', 'rect', 60) } },
    ];
    return U.extractParamBlocks(tmpl);
  });

  const by = (p) => r.find((b) => b.param === p);
  // xy-pad pair → one group, roles x/y, only the first member carries the widget
  expect(by('cx')).toMatchObject({ role: 'x', widget: 'xy-pad', type: 'number' });
  expect(by('cy')).toMatchObject({ role: 'y' });
  expect(by('cx').group).toBe(by('cy').group);
  expect(by('cy').widget).toBeUndefined();
  // the odd third xy-pad → a plain number knob (no group, no widget)
  expect(by('cz').group).toBeUndefined();
  expect(by('cz').widget).toBeUndefined();
  // rect four → one group, roles x/y/w/h, first carries the widget
  expect(by('rx')).toMatchObject({ role: 'x', widget: 'rect' });
  expect(by('rh')).toMatchObject({ role: 'h' });
  const rg = by('rx').group;
  expect(rg && [by('ry'), by('rw'), by('rh')].every((b) => b.group === rg)).toBe(true);
  expect(rg).not.toBe(by('cx').group);   // distinct groups
});

test('xy/rect grouping: two xy-pad param pills render as ONE canvas and commit numbers', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsInsertUserOp && window.ddcsGetBlockProgram);

  await page.evaluate(async () => {
    localStorage.removeItem('ddcs_user_ops');
    const U = await import('/blocks/userOps.js');
    const pill = (name, value) => ({ type: 'param', params: { name, widget: 'xy-pad', value } });
    const template = [{ type: 'move', params: { x: pill('cx', 50), y: pill('cy', 30), z: -5 } }];
    const bindings = U.extractParamBlocks(template);   // the real save path groups the pills
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

  test('xy/rect grouping: xy-pad param pills draw in their sockets', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio && window.showApp);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws && window.ddcsLoadBlockStack);

    await page.evaluate(() => {
      const pill = (name) => ({ type: 'param', params: { name, widget: 'xy-pad', value: 0 } });
      window.ddcsLoadBlockStack([{ type: 'move', params: { x: pill('cx'), y: pill('cy'), z: -5 } }]);
    });
    await page.waitForTimeout(300);

    const render = await page.evaluate(() => {
      const ps = window.__blkws.getAllBlocks().filter((b) => b.type === 'param');
      return { count: ps.length, allDrawn: ps.length > 0 && ps.every((p) => p.getHeightWidth().height > 0), widgets: ps.map((p) => p.getFieldValue('WIDGET')) };
    });
    expect(render.count).toBe(2);
    expect(render.allDrawn, 'both param pills actually rendered (height > 0)').toBe(true);
    expect(render.widgets).toEqual(['xy-pad', 'xy-pad']);
  });
});
