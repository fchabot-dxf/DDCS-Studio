import { test, expect } from '@playwright/test';

/**
 * t961 — the CLEARANCE-PLANE UI GATE (the friendliness layer over the emit backstop): the Plane option is greyed unless
 * (WCS==Active AND Probe Z First), Max/Hop stay usable, and a SELECTED Plane auto-reverts to Hop the moment the guarantee
 * breaks. Driven on BOTH surfaces — middle (built-in form, imperative in middleView.update) + corner (data-op form, the
 * DECLARED optionGate binding read by the generic userOpView loop). One source: planeGuaranteed (the same predicate the emit
 * reads). A closed <select> can't visually show a disabled <option>, so this DRIVE (option.disabled + the revert) is the proof.
 */
test('plane-guarantee UI: Plane greyed unless (Active WCS + Probe Z First); auto-reverts; Max/Hop usable — middle + corner', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings, null, { timeout: 15000 });

  // ===== MIDDLE (built-in) =====
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
  await page.waitForSelector('#wiz_middle', { state: 'visible' });
  const mSet = async (id, prop, v) => { await page.evaluate(([i, p, val]) => { const el = document.getElementById(i); if (p === 'checked') el.checked = val; else el.value = val; ['change', 'input'].forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true }))); }, [id, prop, v]); await page.waitForTimeout(180); };
  const mOpt = (v) => page.evaluate((val) => document.querySelector(`#m_clear_mode option[value="${val}"]`).disabled, v);
  const mMode = () => page.evaluate(() => document.getElementById('m_clear_mode').value);

  await mSet('m_wcs', 'value', 'active'); await mSet('m_probe_z_first', 'checked', false);
  expect(await mOpt('plane'), 'middle: Plane greyed when Probe Z First OFF').toBe(true);
  expect(await mOpt('max'), 'middle: Max usable').toBe(false);
  expect(await mOpt('hop'), 'middle: Hop usable').toBe(false);
  await mSet('m_probe_z_first', 'checked', true);
  expect(await mOpt('plane'), 'middle: Plane enabled when Active + Probe Z First').toBe(false);
  await mSet('m_wcs', 'value', 'G54');
  expect(await mOpt('plane'), 'middle: Plane greyed on a specific WCS').toBe(true);
  await mSet('m_wcs', 'value', 'active'); await mSet('m_clear_mode', 'value', 'plane');
  expect(await mMode(), 'middle: Plane selectable when valid').toBe('plane');
  await mSet('m_probe_z_first', 'checked', false);
  expect(await mMode(), 'middle: selected Plane AUTO-REVERTS to Hop').toBe('hop');

  // ===== CORNER (data-op; the declared optionGate) =====
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForTimeout(600);
  const cSet = async (param, prop, v) => { await page.evaluate(([pm, p, val]) => { const el = document.querySelector(`[data-param="${pm}"]`); if (p === 'checked') el.checked = val; else el.value = val; ['change', 'input'].forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true }))); }, [param, prop, v]); await page.waitForTimeout(200); };
  const cOpt = (v) => page.evaluate((val) => document.querySelector(`[data-param="clearMode"] option[value="${val}"]`).disabled, v);
  const cMode = () => page.evaluate(() => document.querySelector('[data-param="clearMode"]').value);

  await cSet('wcs', 'value', 'active'); await cSet('probeZFirst', 'checked', false);
  expect(await cOpt('plane'), 'corner: Plane greyed when Probe Z First OFF').toBe(true);
  expect(await cOpt('max'), 'corner: Max usable').toBe(false);
  expect(await cOpt('hop'), 'corner: Hop usable').toBe(false);
  await cSet('probeZFirst', 'checked', true);
  expect(await cOpt('plane'), 'corner: Plane enabled when Active + Probe Z First').toBe(false);
  await cSet('wcs', 'value', 'G55');
  expect(await cOpt('plane'), 'corner: Plane greyed on a specific WCS').toBe(true);
  await cSet('wcs', 'value', 'active'); await cSet('clearMode', 'value', 'plane');
  expect(await cMode(), 'corner: Plane selectable when valid').toBe('plane');
  await cSet('probeZFirst', 'checked', false);
  expect(await cMode(), 'corner: selected Plane AUTO-REVERTS to Hop').toBe('hop');
});
