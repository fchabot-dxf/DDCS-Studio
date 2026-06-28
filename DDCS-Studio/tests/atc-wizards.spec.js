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

test('Tool Change wizard: bold UNVERIFIED banner only for generic/disk auto change', async ({ page }) => {
  await openWizard(page, 'atc_change');
  const banner = page.locator('#atc_change_unverified');

  // M6 (default) — verified path, no warning banner.
  await expect(banner).toBeHidden();

  // Generic / Disk — ASSUMED drawbar model, bold UNVERIFIED banner shows.
  await page.locator('#atc_change_method').selectOption('generic');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('UNVERIFIED');
  await expect(banner.locator('b').first()).toBeVisible();   // the warning is bolded

  await page.locator('#atc_change_method').selectOption('disk');
  await expect(banner).toBeVisible();

  // Firmware + Manual — fine, no warning.
  await page.locator('#atc_change_method').selectOption('firmware');
  await expect(banner).toBeHidden();
  await page.locator('#atc_change_method').selectOption('manual');
  await expect(banner).toBeHidden();
});

test('ATC table wizard: flags magazine pockets that reference a deleted library tool (A7)', async ({ page }) => {
  // Library has only T1; the magazine references T5 (deleted) in pocket 2 → orphan.
  await page.addInitScript(() => localStorage.setItem('ddcs_studio_settings', JSON.stringify({
    atc: {
      magType: 'straight',
      tools: [{ num: 1, type: 'endmill', dia: 6, length: 40 }],
      magazine: [{ pocket: 1, tool: 1, x: 0, y: 0, z: 0 }, { pocket: 2, tool: 5, x: 10, y: 0, z: 0 }],
    },
  })));
  await openWizard(page, 'atc_table');
  const host = page.locator('#atc_table_magazine');

  // Orphan banner appears and names the count.
  const banner = host.locator('[data-mag-orphan]');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('1 pocket');
  await expect(banner).toContainText('no longer in the library');
  // The flagged row carries the orphan note.
  await expect(host).toContainText('tool #5 not in library');

  // The edit modal (renderMagazineTable) also surfaces the orphan + keeps it visible in the picker.
  await host.locator('[data-edit-mag]').click();
  const modal = page.locator('.mag-edit-host');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('not in library');
  await expect(modal.locator('option', { hasText: 'T5 — not in library' })).toHaveCount(1);
});

test('ATC table wizard: no orphan banner when every pocket tool exists (A7)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ddcs_studio_settings', JSON.stringify({
    atc: {
      magType: 'straight',
      tools: [{ num: 1, type: 'endmill', dia: 6, length: 40 }, { num: 2, type: 'ballnose', dia: 6, length: 45 }],
      magazine: [{ pocket: 1, tool: 1, x: 0, y: 0, z: 0 }, { pocket: 2, tool: 2, x: 10, y: 0, z: 0 }],
    },
  })));
  await openWizard(page, 'atc_table');
  await expect(page.locator('#atc_table_magazine [data-mag-orphan]')).toHaveCount(0);
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
