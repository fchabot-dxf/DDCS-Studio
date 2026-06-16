import { test, expect } from '@playwright/test';

// Settings → Composing tab: toggles for the authoring assists. Turning "Block suggestions" off hides the
// Blocks suggestion strip live.
test.use({ viewport: { width: 1280, height: 900 } });

test('Composing settings tab toggles the block suggestions', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetSettings && window.openSettings);
  await page.evaluate(() => window.openSettings());
  await page.waitForFunction(() => document.getElementById('set_cp_suggestions'));

  const exist = await page.evaluate(() => ['set_cp_suggestions', 'set_cp_autocomplete', 'set_cp_ghost'].every((id) => !!document.getElementById(id)));
  expect(exist, 'all three composing toggles present').toBeTruthy();

  // turn suggestions OFF → persisted
  await page.evaluate(() => { const c = document.getElementById('set_cp_suggestions'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => window.ddcsGetSettings().compose.suggestions), 'toggle persisted').toBe(false);

  // open Blocks → the suggestion strip is empty/hidden
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkWs && document.querySelector('#blocks-app .blk-suggest'));
  await page.waitForTimeout(300);
  const stripShown = await page.evaluate(() => {
    const s = document.querySelector('#blocks-app .blk-suggest');
    return !!s && getComputedStyle(s).display !== 'none' && s.children.length > 0;
  });
  expect(stripShown, 'suggestions off → strip hidden').toBeFalsy();
});
