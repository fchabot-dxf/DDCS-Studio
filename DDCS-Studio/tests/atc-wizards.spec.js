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

  // Firmware: INC-B — the DEFAULT is a T# M6 CALL to the installed T.nc (the O10102 inline dance is the callMacro=false fallback).
  await page.locator('#atc_change_method').selectOption('firmware');
  await expect(page.locator('#atc_change_fw_params')).toBeVisible();
  await expect(page.locator('#atc_change_m6_params')).toBeHidden();
  await expect(code).toContainText('call the installed T.nc macro');
  await expect(code).toContainText('M6');
  await expect(code).not.toContainText('G53 Z#1306');   // NOT the inline O10102 dance by default

  // Generic (ASSUMED): INC-B — the DEFAULT is a T# M6 call (delegates to the installed T.nc); the inline drawbar dance is the fallback.
  await page.locator('#atc_change_method').selectOption('generic');
  await expect(page.locator('#atc_change_auto_params')).toBeVisible();
  await expect(code).toContainText('M6');
  await expect(code).not.toContainText('M154');         // NOT the inline drawbar codes by default

  // Manual: park prompt, no drawbar codes.
  await page.locator('#atc_change_method').selectOption('manual');
  await expect(page.locator('#atc_change_manual_params')).toBeVisible();
  await expect(page.locator('#atc_change_auto_params')).toBeHidden();
  await expect(code).toContainText('Manual Tool Change');
  await expect(code).not.toContainText('M154');
});

test('Tool Change wizard: the callMacro toggle switches the preview between the T# M6 call and the inline dance (INC-C1)', async ({ page }) => {
  await openWizard(page, 'atc_change');
  const code = page.locator('#wiz_atc_change_code');
  const toggle = page.locator('#atc_change_callmacro');
  const row = page.locator('#atc_change_automatic_params');

  // m6 (default method) is NOT automatic → the callMacro toggle is hidden.
  await expect(row).toBeHidden();

  // Firmware — automatic → the toggle shows, CHECKED by default → the preview is the T# M6 call (not the inline dance).
  await page.locator('#atc_change_method').selectOption('firmware');
  await expect(row).toBeVisible();
  await expect(toggle).toBeChecked();
  await expect(code).toContainText('call the installed T.nc macro');
  await expect(code).not.toContainText('G53 Z#1306');

  // Uncheck → the preview RE-RENDERS to the inline O10102 push dance (the real gesture, real symptom).
  await toggle.uncheck();
  await expect(code).toContainText('G53 Z#1306');
  await expect(code).toContainText('M19');
  await expect(code).not.toContainText('call the installed T.nc macro');

  // Re-check → back to the T# M6 call.
  await toggle.check();
  await expect(code).toContainText('call the installed T.nc macro');
  await expect(code).not.toContainText('G53 Z#1306');

  // Generic + disk are also automatic (toggle shows); manual is not (hidden).
  await page.locator('#atc_change_method').selectOption('generic');
  await expect(row).toBeVisible();
  await page.locator('#atc_change_method').selectOption('disk');
  await expect(row).toBeVisible();
  await page.locator('#atc_change_method').selectOption('manual');
  await expect(row).toBeHidden();
});

test('Tool Change wizard: the install-dependency banner shows in T# M6 mode, hides for inline / m6 / manual (INC-C2)', async ({ page }) => {
  await openWizard(page, 'atc_change');
  const banner = page.locator('#atc_change_macrodep');
  const toggle = page.locator('#atc_change_callmacro');

  // m6 (default) is not automatic → no install-dependency banner.
  await expect(banner).toBeHidden();

  // Firmware with callMacro checked (default = the T# M6 call) → the banner SHOWS (install your T.nc or it does nothing).
  await page.locator('#atc_change_method').selectOption('firmware');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('installed T.nc macro');
  await expect(banner).toContainText('NOTHING');

  // Uncheck → inline dance → the install-dependency banner HIDES (the codes are inlined; no installed T.nc needed).
  await toggle.uncheck();
  await expect(banner).toBeHidden();

  // Re-check → back to the T# M6 call → the banner shows again.
  await toggle.check();
  await expect(banner).toBeVisible();

  // Generic + disk (automatic, callMacro on) → shows; manual → hidden.
  await page.locator('#atc_change_method').selectOption('generic');
  await expect(banner).toBeVisible();
  await page.locator('#atc_change_method').selectOption('disk');
  await expect(banner).toBeVisible();
  await page.locator('#atc_change_method').selectOption('manual');
  await expect(banner).toBeHidden();
});

test('Tool Change wizard: bold UNVERIFIED banner only when INLINING generic/disk assumed codes (INC-C3)', async ({ page }) => {
  await openWizard(page, 'atc_change');
  const banner = page.locator('#atc_change_unverified');
  const toggle = page.locator('#atc_change_callmacro');

  // M6 (default) — verified path, no warning banner.
  await expect(banner).toBeHidden();

  // Generic in the DEFAULT T# M6 mode (callMacro checked) — the op just CALLS the installed T.nc, so the ASSUMED
  // drawbar codes are NOT emitted → the red UNVERIFIED banner must be HIDDEN (INC-C3; the amber install banner covers this).
  await page.locator('#atc_change_method').selectOption('generic');
  await expect(toggle).toBeChecked();
  await expect(banner).toBeHidden();

  // Uncheck → INLINE the change → the assumed codes ARE now emitted → the red UNVERIFIED banner SHOWS.
  await toggle.uncheck();
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('SEQUENCE unverified');   // INC-B2 reword: the MOTION is unverified; the codes are now user-sourced
  await expect(banner).toContainText('codes come from your Settings');
  await expect(banner.locator('b').first()).toBeVisible();   // the warning is bolded

  // Re-check → back to the T# M6 call → hidden again.
  await toggle.check();
  await expect(banner).toBeHidden();

  // Disk inline — same as generic: red shows only when inlining.
  await page.locator('#atc_change_method').selectOption('disk');
  await expect(banner).toBeHidden();               // callMacro re-checked above → T# M6 mode
  await toggle.uncheck();
  await expect(banner).toBeVisible();

  // Firmware — never carries the assumed-drawbar codes, so no red banner in EITHER mode.
  await page.locator('#atc_change_method').selectOption('firmware');
  await expect(banner).toBeHidden();               // inline firmware = M19 orient, not the drawbar model
  await toggle.check();
  await expect(banner).toBeHidden();

  // Manual — fine, no warning.
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
