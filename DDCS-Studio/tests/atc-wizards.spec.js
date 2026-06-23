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

test('Tool Change wizard: method switching shows the right fields and dialect', async ({ page }) => {
  // Generic pick&place only emits the swap when the magazine has pockets — seed a small one.
  await page.addInitScript(() => localStorage.setItem('ddcs_studio_settings', JSON.stringify({
    atc: { magType: 'straight', magazine: [{ pocket: 1, tool: 1, x: 10, y: 0, z: -5 }, { pocket: 2, tool: 2, x: 30, y: 0, z: -5 }], tools: [{ num: 1, type: 'endmill', dia: 6, length: 40 }, { num: 2, type: 'ballnose', dia: 6, length: 45 }] },
  })));
  await openWizard(page, 'atc_change');
  const code = page.locator('#wiz_atc_change_code');

  // M6 (default, recommended): safe park then a bare M6 delegated to the controller.
  await expect(page.locator('#atc_change_m6_params')).toBeVisible();
  await expect(code).toContainText('M6');
  await expect(code).not.toContainText('M154');

  // Firmware: the O10102-accurate fixed-station PUSH (G53 stations + M19 orient).
  await page.locator('#atc_change_method').selectOption('firmware');
  await expect(page.locator('#atc_change_fw_params')).toBeVisible();
  await expect(page.locator('#atc_change_m6_params')).toBeHidden();
  await expect(code).toContainText('G53 Z#1306');
  await expect(code).toContainText('X#1320 Y#1321');
  await expect(code).toContainText('M19');

  // Generic (ASSUMED): T.nc-style pick & place with drawbar + sensor waits.
  await page.locator('#atc_change_method').selectOption('generic');
  await expect(page.locator('#atc_change_auto_params')).toBeVisible();
  await expect(code).toContainText('M154');
  await expect(code).toContainText('M302');
  await expect(code).toContainText('#1504');

  // Manual: park prompt, no drawbar codes.
  await page.locator('#atc_change_method').selectOption('manual');
  await expect(page.locator('#atc_change_manual_params')).toBeVisible();
  await expect(page.locator('#atc_change_auto_params')).toBeHidden();
  await expect(code).toContainText('Manual Tool Change');
  await expect(code).not.toContainText('M154');
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
