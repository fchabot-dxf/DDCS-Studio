import { test, expect } from '@playwright/test';

/**
 * "We don't need to be in dev mode to save a wizard." Saving registers the current op's STACK as a bar button —
 * a basic action (the ⌄ quick menu calls window.ddcsSaveAsWizard). With no exposed knobs it's a parameterless
 * wizard; dev mode is only for ADDING knobs. Here: open an op as blocks (no dev mode), save → it's in the bar.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('save as custom wizard works without dev mode', async ({ page }) => {
  page.on('dialog', (d) => d.accept());   // only the success alert now (name comes from the Save dialog, not a prompt)
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar);
  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });

  // open an op → show it as blocks (NOT dev mode), then wait for the global save hook
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0 && window.ddcsSaveAsWizard);

  // the ⌄ quick-menu action → opens the Save dialog (no dev mode needed); name it + save
  await page.evaluate(() => window.ddcsSaveAsWizard());
  await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Quick Wizard');
  await page.click('.blk-dev-savedlg .blk-dev-save');
  await page.waitForTimeout(150);

  const r = await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const WL = await import('/blocks/wizardLibrary.js');
    const ops = U.listUserOps();
    const custom = ((WL.getLibrary().groups.find((g) => g.id === 'custom') || {}).items || []).map((i) => i.label);
    return { count: ops.length, label: ops[0] && ops[0].label, knobs: ops[0] ? ops[0].bindings.length : -1, inBar: custom };
  });
  expect(r.count, 'one wizard registered').toBe(1);
  expect(r.label).toBe('Quick Wizard');
  expect(r.knobs, 'no dev mode → a parameterless wizard (add knobs later)').toBe(0);
  expect(r.inBar, 'it is a button in the bar Custom group').toContain('Quick Wizard');

  await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });
});
