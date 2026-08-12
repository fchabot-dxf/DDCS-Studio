import { test, expect } from '@playwright/test';

/**
 * Live block→form (custom-op round-trip, step 1). Editing a custom wizard in the Blocks tab renders its FORM as a
 * pure VIEW of the blocks — derived live (deriveAuthoredDef), no save needed. Editing a block's value re-derives the
 * form, so you "see the form change." (Built-ins are unaffected — they generate, not view.) Writeback is step 2.
 */

// t1718 named this spec's load-sensitivity; t1724 retired the PER-SPEC retries declared here in favor of a
// config-level policy (playwright.config.js's `retries`) — a fixed list goes stale every run as the starved
// population shifts (measured at t1719: this turn's own survivors weren't the previous run's).

test.use({ viewport: { width: 1400, height: 1000 } });

test('editing a custom op shows its form derived from the blocks; editing a block updates the form', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef && window.ddcsRefreshWizardBar);

  // a custom op with one exposed number knob "depth" = -5
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    const template = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } }];
    const bindings = U.extractParamBlocks(template);
    U.createUserOp(U.userOpFromStack('liveform', 'Live Form', template, bindings));
    window.ddcsRefreshWizardBar();
  });

  // re-author it → Blocks tab; the live form pane appears with a control for the knob (no save)
  await page.evaluate(() => window.ddcsEditWizardDef('user_liveform'));
  await page.waitForSelector('#blk-formpane:not([hidden]) #blk-form [data-param="depth"]', { timeout: 8000 });

  const before = await page.evaluate(() => {
    const f = document.querySelector('#blk-form [data-param="depth"]');
    return { val: f && Number(f.value), hasLabel: /depth/i.test(document.getElementById('blk-form').textContent) };
  });
  expect(before.hasLabel, 'the form shows the exposed knob label').toBe(true);
  expect(before.val, 'the form reflects the block value, derived without saving').toBe(-5);

  // EDIT the block value -5 → -8 → reproject → the form re-derives and reflects it ("see the form change")
  await page.evaluate(async () => {
    const ws = window.__blkws;
    const { FN } = await import('/blocks/blockly/bridge.js');
    const pb = ws.getAllBlocks().find((b) => b.type === 'param');
    const tgt = pb.getInput(FN('value')).connection.targetBlock();
    tgt.setFieldValue('-8', 'NUM');
  });
  await expect.poll(async () => page.evaluate(() => {
    const f = document.querySelector('#blk-form [data-param="depth"]');
    return f ? Number(f.value) : null;
  })).toBe(-8);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('form→block writeback: editing the live form writes the value back to the block + G-code (no echo clobber)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef && window.ddcsRefreshWizardBar);

  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    const template = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } }];
    const bindings = U.extractParamBlocks(template);
    U.createUserOp(U.userOpFromStack('wbtest', 'WB Test', template, bindings));
    window.ddcsRefreshWizardBar();
  });
  await page.evaluate(() => window.ddcsEditWizardDef('user_wbtest'));
  await page.waitForSelector('#blk-formpane:not([hidden]) #blk-form [data-param="depth"]', { timeout: 8000 });

  // sanity: the projected G-code starts at Z-5
  // t1587 — read the projection from the MODEL: 0bd8b38c deleted the `#blk-gcode` pane from the Blocks shell.
  // The writeback claim (form edit → block → emit) is untouched; only the readout channel moved.
  await expect.poll(() => page.evaluate(() => window.ddcsGetBlockGcode())).toContain('Z-5');

  // EDIT THE FORM: depth -5 → -8 → it writes back to the block, so the projected G-code reflects Z-8
  await page.locator('#blk-form [data-param="depth"]').fill('-8');
  await expect.poll(() => page.evaluate(() => window.ddcsGetBlockGcode())).toContain('Z-8');

  // the form field still shows -8 (the smart sync didn't clobber the field that was edited)
  expect(await page.locator('#blk-form [data-param="depth"]').inputValue()).toBe('-8');

  // the bound param pill in the model carries -8
  const pillVal = await page.evaluate(() => {
    const op = (window.ddcsGetBlockProgram() || []).find((b) => b.type === 'op');
    const z = op && op.children.find((c) => c.type === 'move')?.params?.z;
    return (z && typeof z === 'object' && z.params) ? z.params.value : z;
  });
  expect(Number(pillVal), 'the bound pill value is updated by the form edit').toBe(-8);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('editing-context chrome: re-authoring shows the glow class + named chip; saving clears it', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef && window.ddcsRefreshWizardBar);

  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    const template = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } }];
    U.createUserOp(U.userOpFromStack('chrome', 'Chrome Op', template, U.extractParamBlocks(template)));
    window.ddcsRefreshWizardBar();
  });
  // the Blocks app must be UP before the re-author call: editWizardDef's internal wait for it is capped, and under
  // load the cap could expire → the load silently skipped → the 8s formpane wait timed out as a phantom "chrome" red
  // ⚠ t1518 — THE PRODUCT SIDE OF THAT IS FIXED: an expired cap now REFUSES out loud (alert + no editing chrome), so
  // a future expiry surfaces as a named failure instead of a phantom red. This pre-warm STAYS — it is defence in
  // depth, not the thing holding the spec up — and the load is asserted below rather than assumed.
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.ddcsLoadBlockStack && window.__blkws);
  await page.evaluate(() => window.ddcsEditWizardDef('user_chrome'));
  await page.waitForSelector('#blk-formpane:not([hidden])', { timeout: 8000 });
  // t1518 — and the load REALLY happened: the pre-warm's whole purpose, asserted instead of trusted
  expect(await page.evaluate(() => !!(window.__blkws && window.__blkws.getAllBlocks(false).length)),
    'the re-authored stack actually loaded — a capped-wait expiry would refuse loudly now, never skip').toBe(true);

  // DETERMINISTIC: the formpane unhides on the projection while the chrome (glow class + chip) is applied by
  // devMode's own refresh — a sample squeezed between the two read half-applied chrome under load. Wait for the
  // condition the asserts read (same shape as the save-clear wait below); if it never applies, this times out.
  await page.waitForFunction(() => {
    const app = document.getElementById('blocks-app'), chip = document.querySelector('.blk-edit-chip');
    return app && app.classList.contains('editing-wizard') && chip && !chip.hidden && /Chrome Op/.test(chip.textContent || '');
  }, { timeout: 8000 });
  const editing = await page.evaluate(() => ({
    hasClass: document.getElementById('blocks-app').classList.contains('editing-wizard'),
    chipShown: !document.querySelector('.blk-edit-chip').hidden,
    chipText: document.querySelector('.blk-edit-chip').textContent,
  }));
  expect(editing.hasClass, 'the breathing edge-glow context is on').toBe(true);
  expect(editing.chipShown, 'the editing chip is shown').toBe(true);
  expect(editing.chipText, 'the chip names the wizard').toContain('Chrome Op');

  // save → exits the editing context (glow + chip clear). The workspace must actually HOLD the re-authored op first:
  // the formpane shows on the editing flag alone, while the save reads the LIVE workspace (collectAuthoring) — saving
  // before the blocks land alerts "No op to save" and the dialog never opens (the load-time face of the same race).
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length >= 2);
  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Chrome Op');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  // DETERMINISTIC: wait for the editing context to actually CLEAR (save → refreshEditingChrome is async; an arbitrary
  // sleep flaked under full-gate load). If it never clears, this times out → the real bug surfaces.
  await page.waitForFunction(() => {
    const app = document.getElementById('blocks-app'), chip = document.querySelector('.blk-edit-chip');
    return app && !app.classList.contains('editing-wizard') && chip && chip.hidden;
  }, { timeout: 8000 });
  const after = await page.evaluate(() => ({
    hasClass: document.getElementById('blocks-app').classList.contains('editing-wizard'),
    chipShown: !document.querySelector('.blk-edit-chip').hidden,
  }));
  expect(after.hasClass, 'glow clears after save').toBe(false);
  expect(after.chipShown, 'chip clears after save').toBe(false);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

async function reauthor(page, opType, label) {
  await page.evaluate(async ({ opType, label }) => {
    const U = await import('/blocks/userOps.js');
    localStorage.removeItem('ddcs_user_ops');
    const template = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } }];
    U.createUserOp(U.userOpFromStack(opType, label, template, U.extractParamBlocks(template)));
    window.ddcsRefreshWizardBar();
  }, { opType, label });
  await page.evaluate((t) => window.ddcsEditWizardDef(t), 'user_' + opType);
  await page.waitForSelector('#blk-formpane:not([hidden])', { timeout: 8000 });
}
const listOps = (page) => page.evaluate(async () => (await import('/blocks/userOps.js')).listUserOps().map((o) => ({ opType: o.opType, label: o.label })));

test('non-destructive save: re-author + "Save as new" creates a copy, leaving the original intact', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef && window.ddcsRefreshWizardBar);
  // the Blocks app must be UP before re-authoring (editWizardDef's internal wait is capped — see the chrome test)
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.ddcsLoadBlockStack && window.__blkws);
  await reauthor(page, 'orig', 'Original');
  // …and the workspace must HOLD the re-authored op before saving: the save reads the LIVE workspace
  // (collectAuthoring) — saved too early it alerts "No op to save" and the dialog never opens
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks(false).length >= 2);

  await page.evaluate(() => window.ddcsSaveAsWizard());
  // the dialog offers BOTH actions when editing: an explicit "Update", and the accent "Save as new"
  await expect(page.locator('.blk-dev-savedlg .blk-dev-update')).toBeVisible();
  await expect(page.locator('.blk-dev-savedlg .blk-dev-save')).toHaveText('Save as new');

  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Original Copy');
  await page.click('.blk-dev-savedlg .blk-dev-save');   // "Save as new" → a separate wizard
  // DETERMINISTIC: wait for the save's RESULT — the ops list the asserts below read — not a sleep sized to the
  // commit's async tail (250ms lost to full-gate load). If the copy never lands, this times out honestly.
  await expect.poll(async () => (await listOps(page)).length, { timeout: 8000 }).toBe(2);

  const ops = await listOps(page);
  expect(ops.some((o) => o.opType === 'user_orig' && o.label === 'Original'), 'original untouched').toBe(true);
  expect(ops.some((o) => o.label === 'Original Copy' && o.opType !== 'user_orig'), 'a new copy was created').toBe(true);
  expect(ops.length, 'two wizards now (original + copy)').toBe(2);

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('non-destructive save: "Update" overwrites the re-authored wizard in place (no duplicate)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsEditWizardDef && window.ddcsRefreshWizardBar);
  await reauthor(page, 'orig', 'Original');

  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Original v2');
  await page.click('.blk-dev-savedlg .blk-dev-update');   // explicit overwrite
  await page.waitForTimeout(250);

  const ops = await listOps(page);
  expect(ops.length, 'still one wizard — updated in place').toBe(1);
  expect(ops[0].opType, 'same identity').toBe('user_orig');
  expect(ops[0].label, 'new label').toBe('Original v2');

  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

// t1587/t1589/t1734 — the column no longer has faces to wear; Wizard View and 3D are ALWAYS-PRESENT tabs (GAMEPLAN
// STEP 3), and `show` now decides only the Wizard View tab's CONTENT. The GUARANTEE this test was written for is
// untouched and is what it still asserts: just building a program must not conjure a wizard form — NO param
// controls appear, and the tab is truly EMPTY (no leftover placeholder message either — the t1734 honesty property:
// a plain op gets nothing, never a synthesized substitute). It now also pins that both tabs stay present regardless,
// and that the 3D tab is unaffected by the Wizard View tab having nothing to show.
test('no wizard form is conjured when NOT editing a custom op (normal Blocks use)', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.showApp && window.ddcsLoadBlockStack);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws);
  await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'move', params: { x: 0, y: 0, z: -5, mode: 'feed' } }]));
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const host = document.getElementById('blk-form');
    return {
      controls: host.querySelectorAll('[data-param]').length,
      formText: host.textContent.trim(),
      tabs: [...document.querySelectorAll('.blk-tab')].map((b) => b.textContent.trim()),
    };
  });
  expect(r.controls, 'no param controls when just building a program (not editing a wizard)').toBe(0);
  expect(r.formText, 'the Wizard View tab is truly empty — no leftover placeholder message either').toBe('');
  expect(r.tabs, 'both tabs stay present regardless (never hidden/removed for lack of a wizard)').toEqual(['Wizard View', '3D']);

  // the 3D tab is unaffected by the Wizard View tab having nothing to show
  await page.click('.blk-tab[data-tab="3d"]');
  await page.waitForTimeout(300);
  const pv = await page.evaluate(() => ({
    pvVisible: getComputedStyle(document.querySelector('.pv')).display !== 'none',
    panelMounted: !!document.getElementById('blk-preview-panel').__panel,
  }));
  expect(pv.pvVisible, '3D tab shows its pane').toBe(true);
  expect(pv.panelMounted, 'and the shared preview panel is mounted there').toBe(true);
});
