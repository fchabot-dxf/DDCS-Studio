// t986 — the surfacing data-op FORM: a Coordinates group (Z-mode | WCS); selecting Skim GREYS the WCS (data-op-gated,
// survives postGating). Drives the real data-op form.
import { test, expect } from '@playwright/test';

test('Coordinates group: Z-mode | WCS; Skim greys the WCS (data-op-gated)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings, null, { timeout: 15000 });
  await page.evaluate(() => window.openWiz('user_surfacing_data'));
  await page.waitForTimeout(400);

  const zmode = page.locator('[data-param="zMode"]');
  const wcs = page.locator('[data-param="wcs"]');
  await expect(zmode, 'the Z-mode field renders').toBeVisible();
  await expect(wcs, 'the WCS field renders').toBeVisible();

  // both sit in the COORDINATES section
  const secOf = (param) => page.evaluate((p) => { const el = document.querySelector(`[data-param="${p}"]`); const sec = el && el.closest('[data-section]'); return sec ? sec.dataset.section : null; }, param);
  expect((await secOf('zMode') || '').toUpperCase()).toContain('COORDINATE');
  expect((await secOf('wcs') || '').toUpperCase()).toContain('COORDINATE');

  // Normal (default): WCS enabled
  expect(await wcs.isDisabled(), 'Normal → WCS is selectable').toBe(false);

  // → Skim: the WCS greys (disabled + data-op-gated)
  await zmode.selectOption('skim');
  await page.waitForTimeout(400);
  expect(await wcs.isDisabled(), 'Skim → WCS greyed').toBe(true);
  expect(await page.evaluate(() => document.querySelector('[data-param="wcs"]').getAttribute('data-op-gated')), 'data-op-gated so it survives postGating').toBe('on');

  await page.locator('.wiz-modal, #wizardModal, #wiz_user, .wizard-modal, body').first().screenshot({ path: 'scratchpad/surfacing-skim-form.png' });

  // back to Normal → WCS re-enables
  await zmode.selectOption('normal');
  await page.waitForTimeout(400);
  expect(await wcs.isDisabled(), 'Normal again → WCS re-enabled').toBe(false);
});
