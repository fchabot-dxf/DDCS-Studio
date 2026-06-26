import { test, expect } from '@playwright/test';

/**
 * GUI blocks (B) — the re-author round-trip. ddcsEditWizardDef loads a saved wizard's TEMPLATE (with its param
 * pills) back into Blocks + dev mode, so the GUI blocks reappear and you can tweak them. Saving UPDATES that
 * wizard in place (same opType, no duplicate), and the param pill is still in the template afterwards.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('gui blocks (B): re-author a saved wizard — template round-trips, update in place', async ({ page }) => {
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('x') : d.accept()));
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar && window.ddcsEditWizardDef);
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); });

  // a saved wizard WITH a param pill (a knob)
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const template = [{ type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', widget: 'slider', value: -5 } } } }];
    const bindings = U.extractParamBlocks(template);
    U.createUserOp(U.userOpFromStack('reauth', 'Reauth', template, bindings));
    if (window.ddcsRefreshWizardBar) window.ddcsRefreshWizardBar();
  });

  // RE-AUTHOR it → loads the template into Blocks + dev mode (waits for the Blocks app internally)
  await page.evaluate(() => window.ddcsEditWizardDef('user_reauth'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().some((b) => b.type === 'param'), { timeout: 8000 });
  await expect(page.locator('.blk-dev-savebtn')).toBeVisible();   // dev mode is on, ready to tweak

  // the param pill round-tripped into the workspace; opening the Save dialog seeds the name from the wizard's def
  await page.evaluate(() => window.ddcsSaveAsWizard());
  expect(await page.evaluate(() => document.querySelector('.blk-dev-savedlg .blk-dev-opname').value)).toBe('Reauth');

  // rename + UPDATE in place (the explicit overwrite button; same opType, not a duplicate), pill still in the template
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Reauth v2');
  await page.click('.blk-dev-savedlg .blk-dev-update');
  await page.waitForTimeout(200);

  const r = await page.evaluate(async () => {
    const ops = (await import('/blocks/userOps.js')).listUserOps();
    const d = ops[0];
    return { count: ops.length, opType: d && d.opType, label: d && d.label, hasPill: !!(d && d.template[0].params.z && d.template[0].params.z.type === 'param') };
  });
  expect(r.count, 'updated in place, not duplicated').toBe(1);
  expect(r.opType, 'same identity').toBe('user_reauth');
  expect(r.label, 'new label').toBe('Reauth v2');
  expect(r.hasPill, 'param pill still in the template (round-trips again)').toBe(true);

  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); });
});
