import { test, expect } from '@playwright/test';

/**
 * RICH-DEF UPDATE GUARD (t283) — a def MAINTAINED AS DATA (it carries `bindingSpecs`, e.g. corner) must NOT be
 * overwritten by the dev-mode visual Update: buildBindings flattens the rich bindings to plain ones and
 * userOpFromStack drops bindingSpecs, so an Update would silently STRIP the derive mechanism + the campaign's
 * per-binding metadata. The guard BLOCKS Update (disabled button + a why message); a PLAIN user op (no bindingSpecs)
 * is unaffected. See devMode.isMaintainedAsData.
 *
 * ⚠ THIS TEST'S POST-SAVE HALF HAS NOW SAID THREE DIFFERENT THINGS, AND EACH WAS THE TRUTH AT THE TIME.
 *   originally  "the copy is a plain op (no derive mechanism) — the very reason Update is blocked"
 *               — which described the EMPTY SHELL every fork was, and read that absence as design intent.
 *   t1593       the fork learned to inherit its source's declarations, but a GUARDED def still could not survive the
 *               Blocks canvas, so its copy was REFUSED rather than saved as a wizard emitting a different program.
 *   t1595       the canvas learned to render a guard, the refusal went silent, and Save-as-new works for corner —
 *               with the derive mechanism CARRIED, which is the exact opposite of the original claim.
 *
 * What the test has owned throughout, and still asserts: Update is disabled for a maintained-as-data def, the note
 * says why, and the original def is byte-unchanged by the attempt. Only the fate of the COPY moved.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function freshApp(page) {
  page.on('dialog', (d) => d.accept());   // accept the Save success alert / any prompt
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar && window.ddcsEditWizardDef);
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); });
}

test('a maintained-as-data def (corner) BLOCKS Update; Save-as-new copies it WITH its derive mechanism, original byte-unchanged', async ({ page }) => {
  await freshApp(page);

  // register corner-as-data (bindingSpecs def) into the user library
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    U.createUserOp(CD.cornerDataDef());
    if (window.ddcsRefreshWizardBar) window.ddcsRefreshWizardBar();
  });
  // sanity: the registered def genuinely carries bindingSpecs (the guard's trigger)
  const beforeJson = await page.evaluate(async () => {
    const { listUserOps } = await import('/blocks/userOps.js');
    const d = listUserOps().find((x) => x.opType === 'user_corner_data');
    return { hasSpecs: Array.isArray(d.bindingSpecs) && d.bindingSpecs.length > 0, json: JSON.stringify(d) };
  });
  expect(beforeJson.hasSpecs, 'corner is maintained-as-data (bindingSpecs present)').toBe(true);

  // re-author it → loads its template into Blocks + dev mode
  await page.evaluate(() => window.ddcsEditWizardDef('user_corner_data'));
  // t1595 — the `{timeout: 8000}` here was passed as the page-function's ARGUMENT, not as options, so the real cap
  // was the config's 5s actionTimeout the whole time. Harmless while corner rendered 111 blocks; it started failing
  // the moment the canvas began rendering all 1852 of them.
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, null, { timeout: 60000 });
  await expect(page.locator('.blk-dev-savebtn')).toBeVisible();

  // open the Save dialog → Update is BLOCKED (disabled) + the note explains WHY; Save-as-new stays available
  await page.evaluate(() => window.ddcsSaveAsWizard());
  await expect(page.locator('.blk-dev-savedlg')).toBeVisible();
  await expect(page.locator('.blk-dev-savedlg .blk-dev-update')).toBeDisabled();
  await expect(page.locator('.blk-dev-savedlg .blk-dev-editnote')).toContainText('maintained as data');
  await expect(page.locator('.blk-dev-savedlg .blk-dev-save')).toHaveText('Save as new');

  // ── Save-as-new: a real copy, CARRYING the derive mechanism (see the header for the three answers this had) ─────
  // The original line here asserted `copyHasSpecs === false` and called that "the very reason Update is blocked".
  // It is now the opposite, and the opposite is the point: a copy that keeps its bindingSpecs is a wizard that emits
  // the same program, which is what makes forking a built-in an editing path rather than a way to lose one.
  const alerts = [];
  page.on('dialog', (d) => alerts.push(d.message()));
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Corner Copy');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForFunction(() => !document.querySelector('.blk-dev-savedlg'));   // dialog closed → save committed

  const after = await page.evaluate(async () => {
    const { listUserOps } = await import('/blocks/userOps.js');
    const ops = listUserOps();
    const orig = ops.find((x) => x.opType === 'user_corner_data');
    const copy = ops.find((x) => x.opType !== 'user_corner_data');
    return {
      count: ops.length,
      origJson: JSON.stringify(orig),
      origHasSpecs: !!(orig && Array.isArray(orig.bindingSpecs) && orig.bindingSpecs.length),
      copyLabel: copy && copy.label,
      copyHasSpecs: !!(copy && Array.isArray(copy.bindingSpecs) && copy.bindingSpecs.length),
      copyBindings: copy ? (copy.bindings || []).length : -1,
      copyForkedFrom: copy && copy.forkedFrom,
    };
  });
  expect(after.count, 'a copy was added, original kept').toBe(2);
  expect(after.origJson, 'the original corner def is BYTE-UNCHANGED (nothing stripped)').toBe(beforeJson.json);
  expect(after.origHasSpecs, 'bindingSpecs still intact on the original').toBe(true);
  expect(after.copyLabel, 'the copy saved under the new name').toBe('Corner Copy');
  expect(after.copyHasSpecs, 'THE INVERSION: the copy KEEPS the derive mechanism (t1593 forkInheritance)').toBe(true);
  expect(after.copyBindings, 'and its form fields — corner declares 23').toBe(23);
  expect(after.copyForkedFrom, 'and it records the wizard it came from').toBe('user_corner_data');
  expect(alerts.join(' '), 'no refusal — the guarded fork saves cleanly now that the canvas renders arms').not.toMatch(/structural fork arms/);

  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); });
});

test('a PLAIN user op (no bindingSpecs) is UNAFFECTED — its Update button stays enabled', async ({ page }) => {
  await freshApp(page);

  // a plain wizard with a param pill — NO bindingSpecs
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const template = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', widget: 'slider', value: -5 } } } }];
    const bindings = U.extractParamBlocks(template);
    U.createUserOp(U.userOpFromStack('plainop', 'Plain Op', template, bindings));
    if (window.ddcsRefreshWizardBar) window.ddcsRefreshWizardBar();
  });

  await page.evaluate(() => window.ddcsEditWizardDef('user_plainop'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().some((b) => b.type === 'param'), { timeout: 8000 });

  await page.evaluate(() => window.ddcsSaveAsWizard());
  await expect(page.locator('.blk-dev-savedlg')).toBeVisible();
  // guard scoped to bindingSpecs defs only → a plain op keeps a working Update
  await expect(page.locator('.blk-dev-savedlg .blk-dev-update')).toBeEnabled();
  await expect(page.locator('.blk-dev-savedlg .blk-dev-editnote')).not.toContainText('maintained as data');

  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); });
});
