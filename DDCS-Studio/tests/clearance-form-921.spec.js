import { test, expect } from '@playwright/test';

/**
 * t921 B2b-2b — the MIDDLE FORM: the Safe-Z field is RETIRED and replaced by the CLEARANCE dropdown
 * (Max safe height / Hop up / Clearance plane) with per-mode WHEN-GATED fields (HOP HEIGHT for Hop, CLEARANCE
 * PLANE for Plane). Closes the "Safe-Z drives nothing" complaint: the dropdown DRIVES the emit — driven on a
 * two-axis boss (where the trans-axis traverse, which clearMode governs, fires). Screenshots each mode VIEWED.
 * (Coverage note: clearMode currently governs the TRANS-axis traverse; the in-axis cross-over / reposition are a
 * flagged emit follow-up — see WORK-LOG. This test drives the config where the dropdown is live.)
 */
test.use({ viewport: { width: 1400, height: 960 } });

test('the CLEARANCE dropdown replaces Safe-Z, when-gates its field per mode, and DRIVES the emit; screenshots each mode', async ({ page }, testInfo) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, null, { timeout: 15000 });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
  await page.waitForSelector('#wiz_middle', { state: 'visible', timeout: 10000 });
  // two-axis boss AUTO so the trans-axis traverse (which clearMode governs) is present
  await page.evaluate(() => {
    const set = (id, v, ev) => { const el = document.getElementById(id); if (el) { el.value = v; (ev || ['change', 'input']).forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true }))); } };
    const chk = (id) => { const el = document.getElementById(id); if (el && el.type === 'checkbox' && !el.checked) el.click(); };
    set('m_type', 'boss'); chk('m_both'); set('m_inaxis', 'auto'); set('m_transaxis', 'auto');
  });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => { const c = document.getElementById('wiz_middle_code'); return c && c.textContent.includes('G31'); }, null, { timeout: 8000 });

  const setMode = async (m) => { await page.evaluate((mode) => { const el = document.getElementById('m_clear_mode'); el.value = mode; ['change', 'input'].forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true }))); }, m); await page.waitForTimeout(300); };
  const setVal = async (id, v) => { await page.evaluate(([i, val]) => { const el = document.getElementById(i); el.value = val; ['input', 'change'].forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true }))); }, [id, v]); await page.waitForTimeout(300); };
  const code = () => page.evaluate(() => document.getElementById('wiz_middle_code').textContent);
  const shown = (id) => page.evaluate((i) => { const e = document.getElementById(i); return !!e && !e.classList.contains('hidden'); }, id);

  // the old Safe-Z field is GONE; the dropdown + the frame toggle it grew from are gone
  expect(await page.evaluate(() => !!document.getElementById('m_safe_z')), 'the old Safe-Z field is retired').toBe(false);
  expect(await page.evaluate(() => !!document.getElementById('m_safe_z_frame')), 'the rel|mach frame toggle is retired too').toBe(false);
  expect(await page.evaluate(() => !!document.getElementById('m_clear_mode')), 'the CLEARANCE dropdown is present').toBe(true);

  // MAX (default): neither when-gated field shows; the emit has no hop/plane
  await setMode('max');
  expect(await shown('m_hop_block'), 'Max: HOP field hidden').toBe(false);
  expect(await shown('m_plane_block'), 'Max: PLANE field hidden').toBe(false);
  const maxCode = await code();
  expect(maxCode, 'Max: no hop cap').not.toMatch(/#43=\[#95/);
  expect(maxCode, 'Max: no clearance-hop comment').not.toMatch(/Clearance hop/);
  await page.screenshot({ path: testInfo.outputPath('mode-max.png') });

  // HOP: the HOP HEIGHT field appears; the emit gains the capped hop
  await setMode('hop');
  expect(await shown('m_hop_block'), 'Hop: HOP HEIGHT field shows').toBe(true);
  expect(await shown('m_plane_block'), 'Hop: PLANE field hidden').toBe(false);
  const hopCode = await code();
  expect(hopCode, 'Hop emit differs from Max').not.toBe(maxCode);
  expect(hopCode, 'Hop emits the capped hop (#43 cap or the note)').toMatch(/#43=\[#95\+15\]|Clearance hop/);
  await page.screenshot({ path: testInfo.outputPath('mode-hop.png') });

  // the HOP HEIGHT field DRIVES the emit value
  await setVal('m_hop_dist', '22');
  expect(await code(), 'changing HOP HEIGHT moves the emit (22 appears in the cap)').toMatch(/#43=\[#95\+22\]|Clearance hop 22/);

  // PLANE: the CLEARANCE PLANE field appears; the emit gains the absolute work-Z plane
  await setMode('plane');
  await setVal('m_plane_z', '13');
  expect(await shown('m_plane_block'), 'Plane: CLEARANCE PLANE field shows').toBe(true);
  expect(await shown('m_hop_block'), 'Plane: HOP field hidden').toBe(false);
  const planeCode = await code();
  expect(planeCode, 'Plane emit differs from Hop').not.toBe(hopCode);
  expect(planeCode, 'Plane emits the absolute work-Z lift (G0 Z13)').toMatch(/G0 Z13\b/);
  expect(planeCode, 'Plane is NOT the hop cap').not.toMatch(/#43=\[#95/);
  await page.screenshot({ path: testInfo.outputPath('mode-plane.png') });
});

// t923 B2b-2b-cov — the coverage gap CLOSED: a SINGLE-axis boss (the default) now drives the emit across all 3 modes,
// because the in-axis cross-over (traverseOverR) follows the clearance mode too (it was inert before). Screenshot + per-post fold.
test('coverage fix: a SINGLE-axis boss drives the emit 3/3 across modes (the in-axis cross-over follows the mode); per-post; screenshot', async ({ page }, testInfo) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings, null, { timeout: 15000 });
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('middle'));
  await page.waitForSelector('#wiz_middle', { state: 'visible', timeout: 10000 });
  // SINGLE-axis boss, in-axis AUTO (m_both UNCHECKED → the trans-axis traverse is absent; only the in-axis cross-over runs)
  await page.evaluate(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; ['change', 'input'].forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true }))); } };
    const uncheck = (id) => { const el = document.getElementById(id); if (el && el.type === 'checkbox' && el.checked) el.click(); };
    set('m_type', 'boss'); uncheck('m_both'); set('m_inaxis', 'auto');
  });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => { const c = document.getElementById('wiz_middle_code'); return c && c.textContent.includes('G31'); }, null, { timeout: 8000 });
  const setMode = async (m) => { await page.evaluate((mode) => { const el = document.getElementById('m_clear_mode'); el.value = mode; ['change', 'input'].forEach((e) => el.dispatchEvent(new Event(e, { bubbles: true }))); }, m); await page.waitForTimeout(300); };
  const code = () => page.evaluate(() => document.getElementById('wiz_middle_code').textContent);

  await setMode('max'); const mx = await code();
  await page.screenshot({ path: testInfo.outputPath('single-max.png') });
  await setMode('hop'); const hp = await code();
  await setMode('plane'); const pl = await code();
  // the gap is CLOSED — all three modes now move the emit on a single-axis boss (was 1/3 identical before)
  expect(mx, 'single-axis: Max differs from Hop').not.toBe(hp);
  expect(hp, 'single-axis: Hop differs from Plane').not.toBe(pl);
  expect(mx, 'single-axis: Max differs from Plane').not.toBe(pl);
  expect(hp, 'single-axis Hop: the in-axis cross-over now emits the capped hop').toMatch(/#43=\[#95\+15\]/);
  expect(mx, 'single-axis Max: the cross-over clears to the machine margin (no relative Z#18)').not.toMatch(/G0 Z#18\b/);

  // per-post FOLD of the in-axis cross-over (direct emit) — Expert #520/#42, V4.1 #190, none throws
  const pp = await page.evaluate(async () => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { getDialect } = await import('/wizards/dialects/index.js');
    const P = { featureType: 'boss', inAxis: 'auto', clearMode: 'max' };
    const em = (id) => { try { return emitMapped(middleStack(P), { dialect: getDialect(id) }).text; } catch (e) { return 'THREW:' + e; } };
    return { expert: em('ddcs-expert-m350'), v41: em('ddcs-v41'), dm500: em('ddcs-v3-dm500') };
  });
  expect(pp.expert, 'Expert cross-over: #520 margin guard + the #19 cross').toMatch(/#42=#520[\s\S]*?G0 X#19/);
  expect(pp.v41, 'V4.1 cross-over: the #190 baked margin').toMatch(/#190=/);
  expect(pp.dm500, 'DM500 cross-over does not throw (work-frame degrade)').not.toMatch(/^THREW/);
});
