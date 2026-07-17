import { test, expect } from '@playwright/test';

/**
 * t933 B2b-2c-2 — the CORNER data-op's Plane tall-stock ASSISTS, the corner parallel of the middle wizard's t925
 * (via the reusable plane-suggest form-widget; the Plane EMIT is unchanged — Max/Hop/Plane stay byte-identical):
 *  • SUGGEST beside the Clearance Plane field fills the declared stock top + the safe-Z margin (advisory, only on click).
 *  • the FLOOR WARNS inline when planeZ sits BELOW the declared stock top — a HINT, NOT a clamp (the value is the user's;
 *    the pre-flight through-stock class B2b-3 is the runtime catch). Shared math with middle (engine/workpiece.js).
 */
test.use({ viewport: { width: 1400, height: 960 } });

test('corner data-op Plane: Suggest fills stock-top+margin; the floor WARNS (not clamps) below; screenshots', async ({ page }, testInfo) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.openWiz && window.ddcsGetSettings, null, { timeout: 15000 });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForTimeout(700);

  // drive the data-op form via [data-param] (the widget stamps it, exactly like the plain number fields)
  const setMode = async (m) => { await page.evaluate((mode) => { const el = document.querySelector('[data-param="clearMode"]'); el.value = mode; ['change', 'input'].forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true }))); }, m); await page.waitForTimeout(300); };
  const setPlane = async (v) => { await page.evaluate((val) => { const el = document.querySelector('[data-param="planeZ"]'); el.value = val; ['input', 'change'].forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true }))); }, v); await page.waitForTimeout(250); };
  const planeVal = () => page.evaluate(() => document.querySelector('[data-param="planeZ"]').value);
  const warnShown = () => page.evaluate(() => { const w = document.querySelector('.plane-floor-warn'); return !!w && !w.classList.contains('hidden') && w.offsetParent !== null; });
  const planeRowShown = () => page.evaluate(() => { const el = document.querySelector('[data-param="planeZ"]'); const row = el && (el.closest('[data-when]') || el.closest('.field') || el.parentElement); return row ? row.offsetParent !== null : false; });

  await setMode('plane');
  expect(await planeRowShown(), 'the Clearance Plane field shows in Plane mode').toBe(true);
  expect(await page.evaluate(() => !!document.querySelector('.plane-suggest-btn')), 'the Suggest button is present').toBe(true);

  // the expected stock-top+margin — an INDEPENDENT truth recomputed from getWorkpiece + settings (not via the shared helper)
  const expected = await page.evaluate(async () => {
    const { getWorkpiece } = await import('/engine/workpiece.js');
    const o = getWorkpiece().outer;
    const z = Number(o.z) || 0;
    const code = /^[ncp]{3}$/.test(String(o.datum)) ? String(o.datum) : 'nnp';
    const f = ({ n: 0, c: 0.5, p: 1 })[code[2]] ?? 1;
    const top = z * (1 - f);
    const margin = Math.abs(Number((window.ddcsGetSettings().machine || {}).safeZMargin)) || 5;
    return { top, sugg: Math.round((top + margin) * 10) / 10 };
  });

  // SUGGEST fills stock-top + margin
  await page.click('.plane-suggest-btn');
  await page.waitForTimeout(300);
  expect(Number(await planeVal()), `Suggest fills stock-top(${expected.top}) + safe margin`).toBeCloseTo(expected.sugg, 1);
  await page.screenshot({ path: testInfo.outputPath('corner-suggest-filled.png') });

  // t939 B2b-3 — the CORNER has NO floor warn (dropped): an OUTSIDE-corner clearance traverse stays OUTSIDE the stock
  // (traced), so "may cross into the part" was a FALSE ALARM. The Suggest stays (fixture clearance); the warn opts out.
  expect(await page.evaluate(() => !!document.querySelector('.plane-floor-warn')), 'the corner opts OUT of the floor warn (outside corner → no stock-crossing)').toBe(false);
  await setPlane(String(expected.top - 5));
  expect(await page.evaluate(() => !!document.querySelector('.plane-floor-warn')), 'still no warn element even below the stock top').toBe(false);

  // the field never clamps — a below-stock value is KEPT as typed (the user owns it)
  expect(await planeVal(), 'the below-stock value is NOT clamped (kept as typed — the user owns it)').toBe(String(expected.top - 5));
});
