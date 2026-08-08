import { test, expect } from '@playwright/test';

/**
 * RICH-DEF UPDATE GUARD (t283) — a def MAINTAINED AS DATA (it carries `bindingSpecs`, e.g. corner) must NOT be
 * overwritten by the dev-mode visual Update: buildBindings flattens the rich bindings to plain ones and
 * userOpFromStack drops bindingSpecs, so an Update would silently STRIP the derive mechanism + the campaign's
 * per-binding metadata. The guard BLOCKS Update (disabled button + a why message); a PLAIN user op (no bindingSpecs)
 * is unaffected. See devMode.isMaintainedAsData.
 *
 * t1593 — "Save as new stays the non-destructive path" USED to end that sentence, and for a GUARDED def it is no
 * longer true: such a copy cannot survive the Blocks canvas, so it is refused rather than saved as a wizard that
 * emits a different program. Update is still blocked, and the escape is still to edit the wizard at its source.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function freshApp(page) {
  page.on('dialog', (d) => d.accept());   // accept the Save success alert / any prompt
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar && window.ddcsEditWizardDef);
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); });
}

test('a maintained-as-data def (corner) BLOCKS Update; the copy is REFUSED + leaves the original byte-unchanged', async ({ page }) => {
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

  // ── t1593 — WHAT SAVE-AS-NEW DOES FOR CORNER CHANGED, AND THIS SPEC ASSERTED THE OLD ANSWER ────────────────────
  // It read: "a copy was added" (count 2) and "the copy is a plain op (no derive mechanism) — the very reason Update
  // is blocked". Both described the EMPTY SHELL. Measured across the registry: 32 twins, 549 declared bindings, zero
  // recovered by a fork — the copy had no bindings at all, so of course it had no specs, and this line read that
  // absence as a design intent. What it actually pinned was the defect.
  //
  // A fork now INHERITS its source's declarations (userOps.forkInheritance), and a guarded wizard like corner is
  // REFUSED outright: the Blocks canvas cannot render a guard's children, so the copy would keep one structural arm
  // and emit a different program. The refusal rides the save path's existing alert. See fork-parity-1593.spec.js,
  // which pins both halves — the 18 guard-free twins fork byte-identically, the 14 guarded ones refuse and say why.
  //
  // The claims this test OWNS are untouched and still asserted above: Update is disabled for a maintained-as-data
  // def, the note says why, and the original def is byte-unchanged by the attempt.
  const refusal = [];
  page.on('dialog', (d) => refusal.push(d.message()));
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Corner Copy');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForTimeout(800);

  const after = await page.evaluate(async () => {
    const { listUserOps } = await import('/blocks/userOps.js');
    const ops = listUserOps();
    const orig = ops.find((x) => x.opType === 'user_corner_data');
    return {
      count: ops.length,
      origJson: JSON.stringify(orig),
      origHasSpecs: !!(orig && Array.isArray(orig.bindingSpecs) && orig.bindingSpecs.length),
      copies: ops.filter((x) => x.opType !== 'user_corner_data').map((x) => x.opType),
    };
  });
  expect(after.copies, 'a guarded wizard produces NO copy — a fork of it would emit a different program').toEqual([]);
  expect(after.count, 'the library still holds only the original').toBe(1);
  expect(after.origJson, 'the original corner def is BYTE-UNCHANGED (nothing stripped)').toBe(beforeJson.json);
  expect(after.origHasSpecs, 'bindingSpecs still intact on the original').toBe(true);
  expect(refusal.join(' '), 'the refusal names the reason rather than failing silently').toMatch(/structural fork arms/);

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
