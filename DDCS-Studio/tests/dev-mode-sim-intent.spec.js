import { test, expect } from '@playwright/test';

/**
 * Authoring surface for DECLARED preview intent (def.sim). In Blocks dev mode the save panel has a "Preview rig"
 * group (rotary / machine / magazine checkboxes); ticking one DECLARES it into def.sim — the rotary-rig declaration
 * the no-inference rule requires (a custom op never guesses from motion). Locks: the checkbox → def.sim →
 * opSimContext, and that re-authoring restores the checkbox (round-trips via the def, like the panel dropdown).
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
  await page.click('.blk-dev-toggle');
  await expect(page.locator('.blk-dev-panel')).toBeVisible();

  // DECLARE rotary + name + save (one task — no knobs, so the "fixed wizard" confirm is auto-accepted)
  await page.evaluate(() => {
    document.querySelector('.blk-dev-sim-rotary').checked = true;
    document.querySelector('.blk-dev-opname').value = 'Rotary Custom';
    document.querySelector('.blk-dev-save').click();
  });
  await page.waitForTimeout(200);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const sim = await import('/viz/opSimContext.js');
    const op = U.listUserOps().find((o) => o.opType === 'user_rotary_custom');
    return { sim: op && op.sim, ctx: sim.opSimContext('user_rotary_custom') };
  });
  expect(r.sim, 'def.sim declared from the checkbox').toMatchObject({ showRotaryRig: true });
  expect(r.ctx.showRotaryRig, 'opSimContext reflects the declared rig').toBe(true);

  // re-author → the checkbox is restored from def.sim (round-trips via the def, like the panel dropdown)
  await page.evaluate(() => window.ddcsEditWizardDef('user_rotary_custom'));
  await expect(page.locator('.blk-dev-sim-rotary')).toBeChecked();

  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });
});
