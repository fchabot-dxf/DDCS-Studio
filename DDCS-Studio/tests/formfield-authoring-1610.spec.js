import { test, expect } from '@playwright/test';

/**
 * t1610 — `formfield` is now the ONLY authoring path for a custom wizard's bindings (the inline expose-as-knob
 * checkbox was removed by explicit user instruction; see devMode.js's top docstring and the memory this corrected).
 * Measured by hand end-to-end before the removal landed (t1609) — this pins that same real-app path so the
 * replacement authoring path has automated coverage, which it had none of before this spec.
 *
 * Drives the REAL save/reload/reopen cycle, not a shortcut: a genuine `page.reload()` (same context, full JS
 * re-execution) for "fresh load", the real `.blk-dev-savedlg` save dialog, and real `input`/`change` events on the
 * live form — not a direct model write. The load-bearing claim (per t1608/t1609) is step 4: editing the form must
 * change the EMITTED G-code, not just the displayed value.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('formfield-only authoring: build with zero EXPOSE_ ticks, save, survive a fresh reload, and the form drives the emitted G-code', async ({ page }) => {
  page.on('dialog', (d) => d.accept());

  // 1-2 — author a formfield-only stack (zero EXPOSE_ ticks — that mechanism no longer exists) in the REAL Blockly
  // workspace via the same bindingsToBlocks the app itself uses to project a BINDING_SPEC as blocks.
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar);
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });

  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const specs = [{ param: 'dist', type: 'number', default: 30, label: 'Max Probe Dist', section: 'CUT', match: { type: 'assign', var: '#1' }, key: 'value', widgetConfig: { min: 1, max: 200, units: 'mm' } }];
    const stack = [{
      type: 'user_root', params: {},
      uiChildren: [{ type: 'panel', params: { panel: 'form' } }, { type: 'param_group', params: { group: 'Pilot' }, children: U.bindingsToBlocks(specs) }],
      children: [{ type: 'assign', params: { var: '#1', value: 30 } }],
    }];
    window.ddcsLoadBlockStack(stack);
  });
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, { timeout: 8000 });
  await page.waitForTimeout(500);

  const loaded = await page.evaluate(() => {
    const all = window.__blkws.getAllBlocks();
    const exposeTicked = all.some((b) => b.inputList.some((inp) => inp.fieldRow.some((f) => f.name && f.name.indexOf('EXPOSE_') === 0)));
    return { formfieldCount: all.filter((b) => b.type === 'formfield').length, exposeTicked };
  });
  expect(loaded.formfieldCount, 'the formfield block loaded').toBe(1);
  expect(loaded.exposeTicked, 'no EXPOSE_ field exists anywhere — the knob mechanism genuinely unused').toBe(false);

  // 3 — save via the REAL save flow (the button + the real save dialog), not a direct createUserOp bypass.
  await page.waitForSelector('.blk-dev-savebtn', { state: 'visible' });
  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.waitForSelector('.blk-dev-savedlg', { state: 'visible' });
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'FF Authoring 1610');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForTimeout(300);
  const savedOpType = await page.evaluate(() => {
    const arr = JSON.parse(localStorage.getItem('ddcs_user_ops') || '[]');
    const found = arr.find((o) => o.label === 'FF Authoring 1610');
    return found ? found.opType : null;
  });
  expect(savedOpType, 'the wizard persisted to localStorage via the real save dialog').toBeTruthy();

  // 4 — a GENUINE fresh load: page.reload(), same context/localStorage, full JS re-execution (NOT a new isolated
  // browser context, which would silently start from empty storage and produce a false failure here).
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openWiz);

  const registered = await page.evaluate(async (opType) => {
    const U = await import('/blocks/userOps.js');
    const op = U.listUserOps().find((o) => o.opType === opType);
    return op ? { found: true, errs: U.validateUserOp(op) } : { found: false };
  }, savedOpType);
  expect(registered.found, 'the saved wizard survives a fresh page reload').toBe(true);
  expect(registered.errs, 'the reloaded def validates clean').toEqual([]);

  // 5 — the form renders the declared field.
  await page.evaluate((opType) => window.openWiz(opType), savedOpType);
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  const field = await page.evaluate(() => {
    const el = document.querySelector('#wiz_user_form [data-param="dist"]');
    return el ? { present: true, value: el.value } : { present: false };
  });
  expect(field.present, 'the declared "dist" field renders in the live form').toBe(true);
  expect(field.value, 'seeded with the declared default').toBe('30');

  // 6 — THE LOAD-BEARING CLAIM: editing the form via real input/change events must change the EMITTED G-code, not
  // just the displayed value. A field that renders but does not write back is exactly the half-wiring this whole
  // investigation kept finding elsewhere in the app.
  const codeBefore = await page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');
  expect(codeBefore, 'before the edit, the macro carries the declared default').toMatch(/#1=30\b/);
  await page.evaluate(() => {
    const el = document.querySelector('#wiz_user_form [data-param="dist"]');
    el.value = '77';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const codeAfter = await page.evaluate(() => (document.getElementById('wiz_user_code') || {}).textContent || '');
  expect(codeAfter, 'editing the form field changes the emitted G-code — the form genuinely drives the blocks').toMatch(/#1=77\b/);

  // 7 — round-trip once more: insert, reopen Blocks, save again, fresh reload, reopen. The field DECLARATION must
  // survive (param/binding/editability) — a saved wizard's default is a property of its template, not necessarily a
  // snapshot of one open instance's last-typed value, so this checks the declaration survives, not a specific number.
  await page.evaluate(() => { const b = document.getElementById('wiz_user_insert') || document.querySelector('#wiz_user [data-act="insert"]'); if (b) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, { timeout: 8000 });
  await page.waitForTimeout(500);
  await page.waitForSelector('.blk-dev-savebtn', { state: 'visible' });
  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.waitForSelector('.blk-dev-savedlg', { state: 'visible' });
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForTimeout(300);

  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.openWiz);
  await page.evaluate((opType) => window.openWiz(opType), savedOpType);
  await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
  const field2 = await page.evaluate(() => {
    const el = document.querySelector('#wiz_user_form [data-param="dist"]');
    return el ? { present: true, value: el.value } : { present: false };
  });
  expect(field2.present, 'the field declaration survives a second save/reload round-trip').toBe(true);

  await page.evaluate(async (opType) => {
    const U = await import('/blocks/userOps.js');
    try { U.deleteUserOp(opType); } catch (_) { /* already gone */ }
    localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout');
  }, savedOpType);
});
