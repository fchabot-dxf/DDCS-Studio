import { test, expect } from '@playwright/test';

/**
 * Authoring surface for DECLARED preview intent (def.sim). The Blocks Save dialog has a "Preview rig" group
 * (rotary / machine / magazine checkboxes); ticking one DECLARES it into def.sim — the rotary-rig declaration the
 * no-inference rule requires (a custom op never guesses from motion). Locks: the checkbox → def.sim → opSimContext,
 * and that re-authoring prefills the checkbox in the Save dialog (round-trips via the def, like the panel dropdown).
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('dev mode: tick "4th-axis rotary" → def.sim declared → opSimContext shows the rig; re-author restores it', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar && window.ddcsEditWizardDef);
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });

  // open an op → blocks → dev mode
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0);
  await page.waitForTimeout(400);
  await expect(page.locator('.blk-dev-savebtn')).toBeVisible();   // authoring is always on (no toggle)

  // open the Save dialog → DECLARE rotary + name + save (no knobs → a fixed parameterless wizard)
  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.check('.blk-dev-savedlg .blk-dev-sim-rotary');
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Rotary Custom');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForTimeout(200);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const sim = await import('/viz/opSimContext.js');
    const op = U.listUserOps().find((o) => o.opType === 'user_rotary_custom');
    return { sim: op && op.sim, ctx: sim.opSimContext('user_rotary_custom') };
  });
  expect(r.sim, 'def.sim declared from the checkbox').toMatchObject({ showRotaryRig: true });
  expect(r.ctx.showRotaryRig, 'opSimContext reflects the declared rig').toBe(true);

  // re-author → opening the Save dialog prefills the checkbox from def.sim (round-trips via the def)
  await page.evaluate(() => { window.ddcsEditWizardDef('user_rotary_custom'); });   // fire; re-authoring over the non-empty program raises the S4-1 destructive-load guard
  await page.click('.app-dialog button:has-text("Open (replace)")');               // accept the guard (this test intends to replace the program with the re-authored op)
  await page.waitForTimeout(300);   // let the template load + dev mode engage
  await page.evaluate(() => window.ddcsSaveAsWizard());
  await expect(page.locator('.blk-dev-savedlg .blk-dev-sim-rotary')).toBeChecked();

  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });
});
