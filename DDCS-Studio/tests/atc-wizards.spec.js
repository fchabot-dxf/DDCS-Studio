import { test, expect } from '@playwright/test';

// ATC wizard panels: mode switching shows the right fields and generates the
// right dialect. (Generated-code correctness is covered in depth by
// verification/atc-gen-test.mjs — engine round trip + DDCS linter.)

const BASE = process.env.STUDIO_URL || 'http://localhost:3211';

async function openWizard(page, type) {
  await page.goto(BASE);
  // index.html installs a bare fallback openWiz before the module loads — wait for
  // the module-only marker (updateWiz) so open() actually generates the preview.
  await page.waitForFunction(() => typeof window.updateWiz === 'function');
  await page.evaluate((t) => window.openWiz(t), type);
}

test('Tool Change wizard: manual ↔ auto modes generate the right dialect', async ({ page }) => {
  // Auto pick&place only emits the swap when the magazine has pockets — seed a small one.
  await page.addInitScript(() => localStorage.setItem('ddcs_studio_settings', JSON.stringify({
    atc: { magType: 'straight', magazine: [{ pocket: 1, tool: 1, x: 10, y: 0, z: -5 }, { pocket: 2, tool: 2, x: 30, y: 0, z: -5 }], tools: [{ num: 1, type: 'endmill', dia: 6, length: 40 }, { num: 2, type: 'ballnose', dia: 6, length: 45 }] },
  })));
  await openWizard(page, 'atc_change');

  // Manual (default): park prompt, no drawbar codes
  await expect(page.locator('#wiz_atc_change_code')).toContainText('Manual Tool Change');
  await expect(page.locator('#wiz_atc_change_code')).not.toContainText('M154');
  await expect(page.locator('#atc_change_manual_params')).toBeVisible();

  // Auto: T.nc-style pick & place with drawbar + sensor waits (literal pocket coords from the magazine)
  await page.locator('#atc_change_mode').selectOption('auto');
  await expect(page.locator('#atc_change_auto_params')).toBeVisible();
  await expect(page.locator('#atc_change_manual_params')).toBeHidden();
  const code = page.locator('#wiz_atc_change_code');
  await expect(code).toContainText('M154');
  await expect(code).toContainText('M302');
  await expect(code).toContainText('#1504');
});

test('ATC Test wizard: drawbar and pocket modes', async ({ page }) => {
  await openWizard(page, 'atc_test');

  // Drawbar (default)
  await expect(page.locator('#wiz_atc_test_code')).toContainText('Drawbar Cycle Test');
  await expect(page.locator('#atc_test_drawbar_params')).toBeVisible();

  // Pockets
  await page.locator('#atc_test_mode').selectOption('pockets');
  await expect(page.locator('#atc_test_pocket_params')).toBeVisible();
  await expect(page.locator('#atc_test_drawbar_params')).toBeHidden();
  await expect(page.locator('#wiz_atc_test_code')).toContainText('Pocket Dry-Run');

  // Insert puts the code in the editor
  await page.evaluate(() => window.insertWiz());
  await expect(page.locator('#editor')).toHaveValue(/Pocket Dry-Run/);
});
