import { test, expect } from '@playwright/test';

/**
 * STAGE 6 — Blocks-tab DEV (authoring) mode: the wizard-maker keystone. Open an op in Blocks, flip the floating
 * Dev toggle (atoms grow inline "expose as param" rows), tick a numeric value + name it, name the op, Save as
 * custom op — and assert a valid user op (template + the right binding) lands in the library + the bar's Custom group.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('dev mode: expose a value → Save as custom op → it registers in the library + bar', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar);   // t1307 — the declared boot signal FIRST (t1279): the globals below exist before the deferred wiring reaches the controls this spec clicks
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });

  // open an op → show it as blocks
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.__blkws && window.__blkws.getAllBlocks().length > 0);
  await page.waitForTimeout(400);

  // authoring is always on — the "Save wizard…" button is present and atoms already grew their "expose" rows
  await expect(page.locator('.blk-dev-savebtn')).toBeVisible();
  await page.waitForTimeout(150);

  // tick the first augmented numeric value's EXPOSE + name it 'myparam'
  const picked = await page.evaluate(async () => {
    const ws = window.__blkws;
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const { fieldKind, fieldsOf, FN } = await import('/blocks/blockly/bridge.js');
    for (const b of ws.getAllBlocks()) {
      const def = BLOCKS[b.type]; if (!def) continue;
      for (const f of fieldsOf(def)) {
        if (fieldKind(def, f) !== 'value') continue;
        const ef = 'EXPOSE_' + FN(f);
        if (b.getField(ef)) {
          b.setFieldValue('TRUE', ef);
          b.setFieldValue('myparam', 'PNAME_' + FN(f));
          return { type: b.type, key: f, value: b.getInput(FN(f)).connection.targetBlock().getFieldValue('NUM') };
        }
      }
    }
    return null;
  });
  expect(picked, 'found an augmented numeric value to expose').toBeTruthy();

  // Regression guard for the stale-model bug: edit the exposed value to a sentinel, then INITIATE save in the same
  // synchronous task (Blockly v13 batches change events, so the model hasn't reprojected yet). saveAsCustomOp reads
  // + freezes the bindings from the LIVE workspace synchronously here — the dialog only collects the name afterward —
  // so the saved default equals the live value, which only holds if it reads the workspace, not the (stale) model.
  const SENTINEL = 777.5;
  await page.evaluate(({ key, sentinel }) => {
    const ws = window.__blkws, VK = key.toUpperCase();
    let target = null;
    for (const b of ws.getAllBlocks()) { if (b.getField && b.getField('EXPOSE_' + VK) && b.getFieldValue('EXPOSE_' + VK) === 'TRUE') { target = b; break; } }
    target.getInput(VK).connection.targetBlock().setFieldValue(String(sentinel), 'NUM');   // model now stale
    window.ddcsSaveAsWizard();                                                              // same task → freezes the live workspace, opens the Save dialog
  }, { key: picked.key, sentinel: SENTINEL });
  // the Save dialog collects the name; the bindings were already frozen above
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'My Test Op');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForTimeout(150);

  // assert: a valid user op exists with the binding, and it surfaces in the library Custom group + the bar
  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const WL = await import('/blocks/wizardLibrary.js');
    const op = U.listUserOps().find((o) => o.opType === 'user_my_test_op');
    const lib = WL.getLibrary();
    const custom = ((lib.groups.find((g) => g.id === 'custom') || {}).items || []).map((i) => i.id);
    const barCustom = Array.from(document.querySelectorAll('.dock-header .header-center .toolbar-dropdown'))
      .find((dd) => (dd.querySelector('.btn-tx')?.textContent || '').trim() === 'Custom');
    const barItems = barCustom ? Array.from(barCustom.querySelectorAll('.toolbar-dropdown-content > button')).map((b) => b.getAttribute('onclick') || '') : [];
    return {
      found: !!op,
      label: op && op.label,
      bindings: op && op.bindings,
      errs: op && U.validateUserOp(op),
      inCustomGroup: custom.includes('user_my_test_op'),
      inBar: barItems.some((o) => o.includes("ddcsInsertUserOp('user_my_test_op')")),
    };
  });

  expect(r.found, 'user op was created').toBe(true);
  expect(r.label).toBe('My Test Op');
  expect(r.errs, 'the authored op validates').toEqual([]);
  expect(r.bindings).toHaveLength(1);
  expect(r.bindings[0].param).toBe('myparam');
  expect(r.bindings[0].key).toBe(picked.key);
  expect(r.bindings[0].type).toBe('number');
  expect(r.bindings[0].default, 'binding default = the LIVE-edited value, not the stale model').toBe(SENTINEL);
  expect(r.inCustomGroup, 'appears in the library Custom group').toBe(true);
  expect(r.inBar, 'appears in the wizard bar Custom dropdown').toBe(true);

  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });
});
