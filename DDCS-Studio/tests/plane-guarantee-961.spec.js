import { test, expect } from '@playwright/test';

/**
 * t961 — the CLEARANCE-PLANE guarantee (user-reported corner safety bug: Plane made the safe-Z move DOWN). planeLiftNodes
 * emits a WORK-frame G90 G0 Z<planeZ>, safe ONLY when the plane reads the SAME WCS whose Z datum was set → offered IFF
 * (WCS==Active AND Z established first). Three layers off ONE source (planeGuaranteed / resolveClearMode):
 *   (1) EMIT BACKSTOP — a saved config / a data-op twin that says clearMode='plane' without the guarantee folds to Hop + an
 *       honest comment (NOT the descending plane); (2) the corner TWIN folds via postInstantiate (byte-parity with the form);
 *       (3) the UI greys the Plane option + auto-reverts (driven separately). This asserts the emit + twin layers.
 */
const MIDDLE_AUTO = { featureType: 'boss', twoAxis: true, inAxis: 'auto', transAxis: 'auto' };
const COMMENT = 'Clearance plane needs the Active WCS';
const hasPlaneMove = (t) => /G0 Z10\b/.test(t);   // the plane lift = G90 / G0 Z<planeZ=10> (absolute work-Z)

test('plane-guarantee: emit backstop folds plane->hop unless (Active WCS + Z-first); corner twin byte-parity', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ MIDDLE_AUTO }) => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { cornerDataDef, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(cornerDataDef());
    const twin = builderOf(CORNER_DATA_OPTYPE);
    const em = (fn, p) => emitMapped(fn(p)).text;
    return {
      // CORNER form
      c_valid: em(cornerStack, { clearMode: 'plane', wcs: 'active', probeZFirst: 1 }),
      c_noZ:   em(cornerStack, { clearMode: 'plane', wcs: 'active', probeZFirst: 0 }),
      c_G54:   em(cornerStack, { clearMode: 'plane', wcs: 'G54', probeZFirst: 1 }),
      // CORNER twin (postInstantiate backstop) + parity vs the form
      t_valid: em(twin, { clearMode: 'plane', wcs: 'active', probeZFirst: 1 }),
      t_noZ:   em(twin, { clearMode: 'plane', wcs: 'active', probeZFirst: 0 }),
      // MIDDLE form (AUTO params → the trans-axis traverse reads clearMode)
      m_valid: em(middleStack, { ...MIDDLE_AUTO, clearMode: 'plane', wcs: 'active', probeZ: true }),
      m_noZ:   em(middleStack, { ...MIDDLE_AUTO, clearMode: 'plane', wcs: 'active', probeZ: false }),
      m_G54:   em(middleStack, { ...MIDDLE_AUTO, clearMode: 'plane', wcs: 'G54', probeZ: true }),
    };
  }, { MIDDLE_AUTO });

  // CORNER form: valid → the plane emits (no backstop); non-active OR no-Z-first → Hop backstop + comment (NO plane move)
  expect(hasPlaneMove(r.c_valid), 'corner Active+Zfirst emits the plane').toBe(true);
  expect(r.c_valid.includes(COMMENT), 'corner valid: no backstop comment').toBe(false);
  expect(hasPlaneMove(r.c_noZ), 'corner no-Z-first: NO descending plane').toBe(false);
  expect(r.c_noZ.includes(COMMENT), 'corner no-Z-first: honest backstop comment').toBe(true);
  expect(hasPlaneMove(r.c_G54), 'corner G54: NO descending plane').toBe(false);
  expect(r.c_G54.includes(COMMENT), 'corner G54: honest backstop comment').toBe(true);

  // CORNER twin: same verdicts AND byte-parity with the form (the postInstantiate backstop matches the built-in)
  expect(hasPlaneMove(r.t_valid), 'twin Active+Zfirst emits the plane').toBe(true);
  expect(r.t_noZ.includes(COMMENT) && !hasPlaneMove(r.t_noZ), 'twin no-Z-first: Hop backstop + comment').toBe(true);
  expect(r.t_valid, 'twin byte-parity: valid case === the form').toBe(r.c_valid);
  expect(r.t_noZ, 'twin byte-parity: backstop case === the form').toBe(r.c_noZ);

  // MIDDLE form: valid → the plane emits; non-active OR no-Z-first → Hop backstop + comment
  expect(hasPlaneMove(r.m_valid), 'middle Active+probeZ emits the plane').toBe(true);
  expect(r.m_valid.includes(COMMENT), 'middle valid: no backstop comment').toBe(false);
  expect(hasPlaneMove(r.m_noZ), 'middle no-probeZ: NO descending plane').toBe(false);
  expect(r.m_noZ.includes(COMMENT), 'middle no-probeZ: honest backstop comment').toBe(true);
  expect(r.m_G54.includes(COMMENT) && !hasPlaneMove(r.m_G54), 'middle G54: Hop backstop + comment').toBe(true);
});
