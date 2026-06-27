import { test, expect } from '@playwright/test';

/**
 * Group form — canvas-role (2D) knob, part A: LOCK that a NUMBER-ROLE 2D knob (a `point` / `nrect` param exposed as a
 * group knob) edits + writes back through the increment-2 form. It already works — `groupCanvasBindings` keeps
 * blockIndex+key on every member and renders each as its own `data-param` number field, so the inc-2 writeback catches
 * them. This test pins it (and drives the REAL auto-chip path: pure stack → hover → ✎ chip → click → wrap → form).
 *
 * (Part B adds a form2d 2D-preview so these knobs are DRAG-editable; this test guards the numbers path B must preserve.)
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('A: a point knob in a grouped run\'s form edits + writes back BOTH axes + survives a reprojection', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.insertWiz);

  // a PURE hand-built stack: a move with x exposed as point-x and y as point-y → a 2D-point knob "pos" (px / py).
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { id: 'm1', type: 'move', params: { mode: 'rapid', x: 10, y: 20, z: -2 }, _expose: { X: { p: 'px', w: 'point-x' }, Y: { p: 'py', w: 'point-y' } } },
    { id: 's1', type: 'spindle', params: { rpm: 12000, on: true } },
  ]));
  await page.evaluate(() => window.showApp('editor'));
  await page.waitForTimeout(300);

  // REAL path: hover → the auto ✎ chip appears (pure stack) → click → wraps the run + opens the inc-2 form.
  await page.evaluate(() => {
    const ed = document.getElementById('editor');
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    ed.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + 40, clientY: rect.top + pad + lh / 2 - ed.scrollTop }));
    document.getElementById('op-edit-chip').click();
  });
  await page.waitForTimeout(500);

  // the point knob renders as TWO x/y number fields, seeded with the child's current values.
  const form = await page.evaluate(() => {
    const px = document.querySelector('#wiz_user_form [data-param="px"]');
    const py = document.querySelector('#wiz_user_form [data-param="py"]');
    return { hasPx: !!px, hasPy: !!py, pxVal: px ? px.value : null, pyVal: py ? py.value : null };
  });
  expect(form.hasPx && form.hasPy, 'the point knob renders as x/y number fields in the group form').toBe(true);
  expect(Number(form.pxVal), 'px seeded from the child (x = 10)').toBe(10);
  expect(Number(form.pyVal), 'py seeded from the child (y = 20)').toBe(20);

  // edit BOTH axes → insert → both write back to the group child.
  await page.evaluate(async () => {
    const px = document.querySelector('#wiz_user_form [data-param="px"]');
    const py = document.querySelector('#wiz_user_form [data-param="py"]');
    px.value = '33'; px.dispatchEvent(new Event('input', { bubbles: true }));
    py.value = '44'; py.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    await window.insertWiz();
  });
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const child = grp && (grp.children || [])[0];
    return { x: child ? child.params.x : null, y: child ? child.params.y : null, gcode: document.getElementById('editor')?.value || '' };
  });
  expect(Number(after.x), 'point.x wrote back to the group child').toBe(33);
  expect(Number(after.y), 'point.y wrote back to the group child').toBe(44);
  expect(after.gcode, 'the G-code reflects both axes').toContain('X33');
  expect(after.gcode).toContain('Y44');

  // SURVIVES A REPROJECTION (the exposure + both edited values persist).
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.showApp('editor'));
  await page.waitForTimeout(400);
  const reproj = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const child = grp && (grp.children || [])[0];
    return { x: child ? child.params.x : null, y: child ? child.params.y : null, hasExpose: !!(child && child._expose) };
  });
  expect(Number(reproj.x), 'point.x survives the reproject').toBe(33);
  expect(Number(reproj.y), 'point.y survives the reproject').toBe(44);
  expect(reproj.hasExpose, 'the 2D-point exposure survives the reproject').toBe(true);
});
