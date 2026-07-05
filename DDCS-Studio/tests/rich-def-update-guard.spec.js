import { test, expect } from '@playwright/test';

/**
 * RICH-DEF UPDATE GUARD (t283) — a def MAINTAINED AS DATA (it carries `bindingSpecs`, e.g. corner) must NOT be
 * overwritten by the dev-mode visual Update: buildBindings flattens the rich bindings to plain ones and
 * userOpFromStack drops bindingSpecs, so an Update would silently STRIP the derive mechanism + the campaign's
 * per-binding metadata. The guard BLOCKS Update (disabled button + a why message); "Save as new" (a copy) stays the
 * non-destructive path; a PLAIN user op (no bindingSpecs) is unaffected. See devMode.isMaintainedAsData.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function freshApp(page) {
  page.on('dialog', (d) => d.accept());   // accept the Save success alert / any prompt
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar && window.ddcsEditWizardDef);
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); });
}

test('a maintained-as-data def (corner) BLOCKS Update; Save-as-new works + leaves the original byte-unchanged', async ({ page }) => {
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
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, { timeout: 8000 });
  await expect(page.locator('.blk-dev-savebtn')).toBeVisible();

  // open the Save dialog → Update is BLOCKED (disabled) + the note explains WHY; Save-as-new stays available
  await page.evaluate(() => window.ddcsSaveAsWizard());
  await expect(page.locator('.blk-dev-savedlg')).toBeVisible();
  await expect(page.locator('.blk-dev-savedlg .blk-dev-update')).toBeDisabled();
  await expect(page.locator('.blk-dev-savedlg .blk-dev-editnote')).toContainText('maintained as data');
  await expect(page.locator('.blk-dev-savedlg .blk-dev-save')).toHaveText('Save as new');

  // Save-as-new → a SEPARATE copy is created; the original corner def is byte-UNCHANGED (bindingSpecs intact)
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
    };
  });
  expect(after.count, 'a copy was added, original kept').toBe(2);
  expect(after.origJson, 'the original corner def is BYTE-UNCHANGED (nothing stripped)').toBe(beforeJson.json);
  expect(after.origHasSpecs, 'bindingSpecs still intact on the original').toBe(true);
  expect(after.copyLabel, 'the copy saved under the new name').toBe('Corner Copy');
  // the copy is a flattened plain op (expected — that's WHY Update is blocked on the rich original)
  expect(after.copyHasSpecs, 'the copy is a plain op (no derive mechanism) — the very reason Update is blocked').toBe(false);

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
