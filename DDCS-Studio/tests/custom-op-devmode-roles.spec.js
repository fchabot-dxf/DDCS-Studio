import { test, expect } from '@playwright/test';

/**
 * The OTHER author surface for "2D point (numbers)": dev-mode inline expose. An author opens an op in Blocks, turns
 * on dev mode, ticks two numeric fields as point-x / point-y, names them, and saves as a Form+2D wizard. This drives
 * that real gesture (collectAuthoring → buildBindings) and asserts it yields a complete, valid `point` group — then
 * opens the saved op as a wizard and confirms the live form2d preview derives a draggable handle. (The param-pill
 * author path is covered by custom-op-form2d-drag.spec; this is the dev-mode-expose twin — north star: wizards as
 * data, both authoring paths reach the same valid binding.)
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('dev-mode expose point-x/point-y → a complete point group → a draggable form2d preview handle', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar);
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });

  // seed a real op into Blocks, then enter dev (author) mode
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0);
  await page.waitForTimeout(400);
  await page.click('.blk-dev-toggle');
  await page.waitForTimeout(200);

  // tick the first two augmented numeric fields as point-x / point-y (the inline "▸ expose … as …" rows)
  const picked = await page.evaluate(async () => {
    const ws = window.__blkws;
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { fieldKind, fieldsOf, FN } = await import('/blocks/blockly/bridge.js');
    const found = [];
    for (const b of ws.getAllBlocks()) {
      const def = BLOCKS[b.type]; if (!def) continue;
      for (const f of fieldsOf(def)) {
        if (fieldKind(def, f) !== 'value') continue;
        if (b.getField && b.getField('EXPOSE_' + FN(f))) found.push({ b, f, VK: FN(f) });
      }
    }
    if (found.length < 2) return { n: found.length };
    ['point-x', 'point-y'].forEach((w, i) => {
      const g = found[i];
      g.b.setFieldValue('TRUE', 'EXPOSE_' + g.VK);
      g.b.setFieldValue(i === 0 ? 'px' : 'py', 'PNAME_' + g.VK);
      g.b.setFieldValue(w, 'WIDGET_' + g.VK);
    });
    return { n: found.length };
  });
  expect(picked.n, 'the seeded op has >=2 exposable numeric fields').toBeGreaterThanOrEqual(2);

  // save — the Save dialog must DEFAULT the panel to Form+2D because the op has a 2D-point group (discoverability
  // fix: drag-to-edit isn't hidden behind the form3d default). The author can still override; here we just accept it.
  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Pt Op');
  await expect(page.locator('.blk-dev-savedlg .blk-dev-paneltype'), 'a number-role op defaults to Form+2D').toHaveValue('form2d');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForTimeout(150);

  // the saved def: a complete, valid point group declared from the dev-mode expose
  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const op = U.listUserOps().find((o) => o.label === 'Pt Op');
    if (!op) return { found: false };
    const grouped = (op.bindings || []).filter((b) => b.group);
    const byRole = {}; for (const b of grouped) byRole[b.role] = b;
    return { found: true, panel: op.panel, groupedCount: grouped.length,
      roleX: !!byRole.x, roleY: !!byRole.y, m0widget: grouped[0] && grouped[0].widget, errs: U.validateUserOp(op) };
  });
  expect(r.found).toBe(true);
  expect(r.panel).toBe('form2d');
  expect(r.errs, 'the authored op validates clean').toEqual([]);
  expect(r.groupedCount, 'x + y formed one group').toBe(2);
  expect(r.roleX && r.roleY, 'both roles declared from the expose dropdown').toBe(true);
  expect(r.m0widget, 'a number-role point, not a canvas widget').toBe('point');

  // open the saved op as a wizard → the LIVE form2d preview must derive a draggable handle over writable fields
  const live = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const op = U.listUserOps().find((o) => o.label === 'Pt Op');
    window.showApp && window.showApp('studio');
    window.ddcsStudio.wizardManager.open(op.opType);
    await new Promise((res) => setTimeout(res, 400));
    const PT = await import('/wizards/ops/panelTypes.js');
    const params = {}; for (const b of op.bindings) params[b.param] = b.default;
    const spec = PT.layoutSpecFromOp(op, params);
    const dataParams = [...document.querySelectorAll('#wiz_user_form [data-param]')].map((n) => n.dataset.param).sort();
    return { handles: spec.handles.length, items: spec.items.length, dataParams };
  });
  expect(live.dataParams, 'both number fields rendered + writable in the live form').toEqual(['px', 'py']);
  expect(live.items, 'the point is drawn on the live preview').toBe(1);
  expect(live.handles, 'a draggable handle in the live form2d preview').toBe(1);

  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });
});
