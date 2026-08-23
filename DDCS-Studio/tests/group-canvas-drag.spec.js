import { test, expect } from '@playwright/test';

/**
 * Group form — canvas-role (2D) knob, part B: a 2D group knob is DRAG-editable on a form2d 2D-PREVIEW.
 *
 * deriveGroupDef now returns panel:'form2d' when the group has a complete 2D knob (a point/rect/circle `group`
 * binding), so the group form opens two-pane with the shared custom-op 2D preview (renderLayout2D + layoutSpecFromOp
 * drag handles). Dragging the handle drives the bound x/y FORM FIELDS (the spatial-gui "drag the preview" path); on
 * insert those values write back to the group child. This drives the REAL panel + a REAL pointer drag.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('B: a 2D group knob is drag-editable on the form2d preview → drag writes the fields → insert writes the child → survives reproject', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack && window.ddcsGetBlockProgram && window.insertWiz);

  // a PURE hand-built stack with a 2D-point knob (move x→point-x, y→point-y).
  await page.evaluate(() => window.ddcsLoadBlockStack([
    { id: 'm1', type: 'move', params: { mode: 'rapid', x: 10, y: 20, z: -2 }, _expose: { X: { p: 'px', w: 'point-x' }, Y: { p: 'py', w: 'point-y' } } },
    { id: 's1', type: 'spindle', params: { rpm: 12000, on: true } },
  ]));
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(300);

  // REAL path: right-click → "Group" → the new group's own PERSISTENT chip → click → opens the group form
  // (now form2d because it has a 2D knob).
  await page.evaluate(() => {
    const ed = document.getElementById('editor');
    const cs = getComputedStyle(ed); const lh = parseFloat(cs.lineHeight) || 22; const pad = parseFloat(cs.paddingTop) || 0;
    const rect = ed.getBoundingClientRect();
    ed.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left + 40, clientY: rect.top + pad + lh / 2 - ed.scrollTop }));
    const menu = document.querySelector('.op-ctx-menu');
    const btn = menu && !menu.hidden ? Array.from(menu.querySelectorAll('button')).find((b) => /Group/.test(b.textContent)) : null;
    if (btn) btn.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const chip = grp && document.querySelector(`.op-chip[data-op-id="${grp.id}"]`);
    if (chip) chip.click();
  });
  await page.waitForTimeout(500);

  // the group form opened as form2d: both x/y fields rendered AND a draggable handle on the 2D preview.
  const fieldParams = await page.$$eval('#wiz_user_form [data-param]', (ns) => ns.map((n) => n.dataset.param).sort());
  expect(fieldParams, 'the point knob rendered both x/y fields').toEqual(['px', 'py']);
  const handle = page.locator('#userVizContainer .fc-handle-move').first();
  await handle.waitFor({ state: 'visible' });   // form2d preview is present with a drag handle (the B win)

  const before = await page.evaluate(() => ({
    px: document.querySelector('#wiz_user_form [data-param="px"]').value,
    py: document.querySelector('#wiz_user_form [data-param="py"]').value,
    code: (document.getElementById('wiz_user_code') || {}).textContent || '',
  }));

  // REAL drag: press the handle and move it (FeatureCanvas maps screen→world; assert it MOVED + re-emitted).
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 110, box.y + box.height / 2 + 70, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate(() => document.querySelector('#wiz_user_form [data-param="px"]').value)).not.toBe(before.px);

  const after = await page.evaluate(() => ({
    px: document.querySelector('#wiz_user_form [data-param="px"]').value,
    py: document.querySelector('#wiz_user_form [data-param="py"]').value,
    code: (document.getElementById('wiz_user_code') || {}).textContent || '',
  }));
  const moved = after.px !== before.px || after.py !== before.py;
  expect(moved, 'dragging the preview handle wrote the point fields').toBe(true);
  expect(after.code, 'the group preview re-emitted after the drag (the form↔preview loop is wired)').not.toBe(before.code);

  // INSERT → the dragged values write back to the group child (drag → fields → child).
  await page.evaluate(async () => { await window.insertWiz(); });
  await page.waitForTimeout(300);
  const child = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const c = grp && (grp.children || [])[0];
    return { x: c ? c.params.x : null, y: c ? c.params.y : null };
  });
  expect(Number(child.x), 'the dragged X wrote back to the group child').toBe(Number(after.px));
  expect(Number(child.y), 'the dragged Y wrote back to the group child').toBe(Number(after.py));

  // SURVIVES A REPROJECTION.
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.showApp('studio'));
  await page.waitForTimeout(400);
  const reproj = await page.evaluate(() => {
    const prog = window.ddcsGetBlockProgram() || [];
    const grp = prog.find((b) => b && b.type === 'op' && b.opType === 'group');
    const c = grp && (grp.children || [])[0];
    return { x: c ? c.params.x : null, y: c ? c.params.y : null, groups: prog.filter((b) => b && b.type === 'op' && b.opType === 'group').length };
  });
  expect(reproj.groups, 'one group survives the reproject').toBe(1);
  expect(Number(reproj.x), 'the dragged X survives the reproject').toBe(Number(after.px));
  expect(Number(reproj.y), 'the dragged Y survives the reproject').toBe(Number(after.py));
});
