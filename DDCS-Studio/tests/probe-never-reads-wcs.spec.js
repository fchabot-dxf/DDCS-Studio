import { test, expect } from '@playwright/test';

/**
 * t1203 (d) — THE PRINCIPLE: **PROBES NEVER READ THE WCS. They probe FOR it.**
 *
 * A probe op PRODUCES the work coordinate system, so a DECLARED WCS table describes a DIFFERENT (previously measured,
 * possibly stale) setup — not the one being previewed. Its machine-frame G53 excursions must therefore render via the
 * honest safe-Z margin approximation (g53ApproxForViz) EVEN WHEN a WCS table is declared. Before this, the declared
 * table won and a probe's safe-Z/hop/park lift landed at machine−WCS, from which the next wall probe fired at the
 * wrong height.
 *
 * DECLARED, NEVER INFERRED: the class is a flag on the sim-intent seam (opSimContext.probesForWcs), the same seam that
 * already declares rotary/machine/magazine/toolMachine/seatStart. It is deliberately NOT derived from probe ATOMS —
 * atc_length / atc_check push raw probe atoms but are machine-frame TOOL-SETTER ops that must keep the exact map, and
 * inference would contradict opSimContext's own doctrine ("custom ops never guess from atoms").
 */
const BASE = 'http://localhost:3211';

test('the class is DECLARED per op type: every probe op true; mills, homing and the ATC tool-setters false', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { opSimContext, programSimContext } = await import('/viz/opSimContext.js');
    const probes = ['corner', 'edge', 'middle', 'alignment', 'rotary_clock', 'rotary_center'];
    // atc_length/atc_check are THE trap: they push probe atoms but are machine-frame tool-setter ops.
    const notProbes = ['pocket', 'contour', 'surfacing', 'drill', 'slot', 'text', 'bore', 'wcs', 'homing', 'atc_length', 'atc_check', 'atc_change', 'atc_table'];
    return {
      probes: Object.fromEntries(probes.map((t) => [t, opSimContext(t).probesForWcs])),
      notProbes: Object.fromEntries(notProbes.map((t) => [t, opSimContext(t).probesForWcs])),
      unionWithProbe: programSimContext(['pocket', 'drill', 'corner']).probesForWcs,
      unionMillOnly: programSimContext(['pocket', 'drill']).probesForWcs,
      unionEmpty: programSimContext([]).probesForWcs,
    };
  });
  for (const [t, v] of Object.entries(r.probes)) expect(v, `${t} probes FOR the WCS → declared true`).toBe(true);
  for (const [t, v] of Object.entries(r.notProbes)) expect(v, `${t} must keep the exact machine→part map → false`).toBe(false);
  expect(r.unionWithProbe, 'a program containing ANY probe op folds to true').toBe(true);
  expect(r.unionMillOnly, 'a mill-only program stays false').toBe(false);
  expect(r.unionEmpty, 'the empty default is false (unchanged behaviour)').toBe(false);
});

test('a probe TWIN declares it through the sim block round-trip (one source with the built-in)', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { opSimContext } = await import('/viz/opSimContext.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const mods = {
      corner: await import('/blocks/dataOps/cornerData.js'),
      edge: await import('/blocks/dataOps/edgeData.js'),
      middle: await import('/blocks/dataOps/middleData.js'),
    };
    const out = {};
    for (const [k, m] of Object.entries(mods)) {
      const def = Object.values(m).find((v) => typeof v === 'function' && /DataDef$/.test(v.name))();
      registerUserOp(def);
      out[k] = opSimContext(def.opType).probesForWcs;
    }
    return out;
  });
  for (const [k, v] of Object.entries(r)) expect(v, `the ${k} twin declares probeWcs via its sim block → the twin and the built-in agree`).toBe(true);
});

test('REAL SYMPTOM: with a WCS table declared, a corner probe still renders the honest margin (not the machine map)', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForFunction(() => window.openWiz && window.ddcsGetSettings && window.ddcsSaveSettings);
  // Declare a WCS table with a LARGE Z — the "different setup" the probe must ignore. If the table won, the traced
  // machine-frame lifts would land near machine−WCS (|z| ≫ margin) instead of the ±safeZMargin band around the work.
  await page.evaluate(() => {
    const s = window.ddcsGetSettings();
    s.machine.wcs = { active: 1, table: [{ x: 10, y: 20, z: -50 }] };
    s.machine.safeZMargin = 5;
    window.ddcsSaveSettings && window.ddcsSaveSettings();
  });
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js'); const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops'); U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForFunction(() => { const h = document.querySelector('.wiz-viz3d'); const p = h && h.__panel; return p && p.getSegments && p.getSegments().length > 0; }, null, { timeout: 10000 });
  const r = await page.evaluate(() => {
    const panel = document.querySelector('.wiz-viz3d').__panel;
    const segs = panel.getSegments() || [];
    const zs = segs.flatMap((s) => [s.z1, s.z2]);
    return { hasSetter: typeof panel.setProbesForWcs === 'function', nProbe: segs.filter((s) => s.type === 'probe').length, maxZ: Math.max(...zs), minZ: Math.min(...zs) };
  });
  expect(r.hasSetter, 'the panel exposes the declared setter').toBe(true);
  expect(r.nProbe, 'the corner preview really traced its probes').toBeGreaterThan(0);
  // the honest approximation keeps every Z inside the margin band around the work origin; the declared −50 never appears
  expect(r.maxZ, 'the safe lift is the declared margin above the work (≈ +5), not a machine-mapped height').toBeLessThanOrEqual(10);
  expect(r.minZ, 'and nothing collapses toward the declared WCS Z (−50)').toBeGreaterThan(-20);
});
