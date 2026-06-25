import { test, expect } from '@playwright/test';

/**
 * The queued "Blocks tab rotary preview context" fix. The Blocks tab is a GENERIC preview (it renders whatever
 * program is active), so unlike the per-op wizard views it used to miss the 4th-axis rotary rig entirely. Now it
 * applies the declared opSimContext union: the rig shows when ANY op in the program is rotary — driven by the op
 * TYPE, not the stock shape (a rectangular part on a rotary axis is valid). Reproduces the real symptom on the
 * actual Blocks 3D preview (viz._showRotaryFixture), not just the pure-function contract.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const rigShown = () => document.getElementById('blk-preview-panel').__panel.viz._showRotaryFixture;

test('Blocks preview shows the 4th-axis rig for a rotary op, hides it for a mill program', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp && window.ddcsLoadBlockStack);

  // Author a rotary op, then view it in the Blocks tab → the generic preview must frame the rotary rig.
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('rotary_clock'));
  await page.waitForSelector('#wiz_rotary_clock', { state: 'visible' });
  await page.evaluate(() => window.ddcsStudio.wizardManager.update());
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0);

  // Force the Blocks preview into 3D so the lazy viz instantiates (and applies the stored rotary-fixture hint).
  await page.evaluate(() => document.getElementById('blk-preview-panel').__panel.setView('3d'));
  await page.waitForFunction(() => { const p = document.getElementById('blk-preview-panel').__panel; return !!(p && p.viz); }, { timeout: 8000 });

  expect(await page.evaluate(rigShown), 'rotary op → Blocks preview shows the 4th-axis rig').toBe(true);

  // Swap the program to a pure mill op → the union has no rotary op, so the rig must disappear.
  await page.evaluate(() => window.ddcsLoadBlockStack([{ type: 'op', opType: 'pocket', id: 'opMill', children: [] }]));
  await page.waitForTimeout(300);   // onChange → renderViews → setRotaryFixture(false)
  expect(await page.evaluate(rigShown), 'mill program → Blocks preview hides the rig').toBe(false);
});
