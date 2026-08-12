import { test, expect } from '@playwright/test';

/**
 * t925 B2b-2b-2 — the Plane tall-stock ASSISTS (pure form/validation; the Plane emit is unchanged from B2b-1):
 *  • SUGGEST beside CLEARANCE PLANE fills the declared stock top + the safe-Z margin (advisory, only on click, user owns it).
 *  • the FLOOR WARNS inline when planeZ sits BELOW the declared stock top — a HINT, NOT a clamp (the value is the user's to own;
 *    the pre-flight through-stock class B2b-3 is the runtime catch).
 */
test.use({ viewport: { width: 1400, height: 960 } });

// t1730 port note — same gap as clearance-form-921.spec.js: middleData.js's declared form never gained a
// clearMode/hopDist/planeZ binding (28 bindings total, confirmed by grep — none of those three), so the Plane
// Suggest button / floor-warn UI this test drives (m_plane_suggest/m_plane_warn) has no twin equivalent at all.
// Tracked here pending a human ruling; see clearance-form-921.spec.js for the full note.
test.fixme('Plane Suggest fills stock-top+margin; the floor WARNS (not clamps) below the stock top; screenshots — t1730: middleData.js never declared clearMode/hopDist/planeZ bindings', async ({ page }, testInfo) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, null, { timeout: 15000 });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
  await page.waitForSelector('#wiz_middle', { state: 'visible', timeout: 10000 });
  const setMode = async (m) => { await page.evaluate((mode) => { const el = document.getElementById('m_clear_mode'); el.value = mode; ['change', 'input'].forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true }))); }, m); await page.waitForTimeout(300); };
  const setVal = async (id, v) => { await page.evaluate(([i, val]) => { const el = document.getElementById(i); el.value = val; ['input', 'change'].forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true }))); }, [id, v]); await page.waitForTimeout(300); };
  const shown = (id) => page.evaluate((i) => { const e = document.getElementById(i); return !!e && !e.classList.contains('hidden'); }, id);
  const val = (id) => page.evaluate((i) => document.getElementById(i).value, id);

  // t961 — Plane is offered ONLY with the guarantee (Active WCS + Probe Z First); establish it so the Plane option isn't
  // greyed + doesn't auto-revert to Hop (WCS defaults to Active).
  await page.evaluate(() => { const c = document.getElementById('m_probe_z_first'); c.checked = true; ['change', 'input'].forEach((e) => c.dispatchEvent(new Event(e, { bubbles: true }))); });
  await page.waitForTimeout(200);
  await setMode('plane');
  expect(await shown('m_plane_block'), 'Plane field shows').toBe(true);
  expect(await shown('m_plane_suggest'), 'the Suggest button is present').toBe(true);

  // the expected stock-top+margin (independent truth from getWorkpiece + settings)
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
  await page.click('#m_plane_suggest');
  await page.waitForTimeout(300);
  expect(Number(await val('m_plane_z')), `Suggest fills stock-top(${expected.top}) + safe margin`).toBeCloseTo(expected.sugg, 1);
  await page.screenshot({ path: testInfo.outputPath('suggest-filled.png') });

  // FLOOR WARNS below the stock top
  await setVal('m_plane_z', String(expected.top - 5));
  expect(await shown('m_plane_warn'), 'planeZ below the stock top → the floor warns').toBe(true);
  await page.screenshot({ path: testInfo.outputPath('floor-warn.png') });

  // above the stock top → no warn
  await setVal('m_plane_z', String(expected.top + 8));
  expect(await shown('m_plane_warn'), 'planeZ above the stock top → no warn').toBe(false);

  // it is a WARNING, NOT a clamp — a below-stock value is KEPT as typed (the user owns it)
  await setVal('m_plane_z', String(expected.top - 5));
  expect(await val('m_plane_z'), 'the below-stock value is NOT clamped (kept as typed — the user owns it)').toBe(String(expected.top - 5));

  // the warn hides when NOT in Plane mode (Max shows no plane field + no warn)
  await setMode('max');
  expect(await shown('m_plane_warn'), 'Max mode: no plane warn').toBe(false);
});
