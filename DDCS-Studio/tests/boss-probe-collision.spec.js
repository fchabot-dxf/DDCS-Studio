import { test, expect } from '@playwright/test';

// Part 1 (the CORE boss-probe-both fix, BOTH modes): after a REPOSITION the operator re-parks the probe at the NEXT
// per-pass start (②③④), so the probe-vs-stock COLLISION must run from THAT start — not always pass-0's ① (_stockOffset).
// Before: every probe after pass 0 fired from ① into open space and ran the full max-probe (a MISS → the macro's
// IF#1920!=2 error branch). The engine now reads `passStarts[_pass]` (plumbed via trace.js / the live run). This is the
// SIMULATED REPOSITION for MANUAL (the sim places the probe at ② as the operator would jog) AND completes AUTO.
test.use({ viewport: { width: 1280, height: 900 } });

test('each REPOSITION pass probes from ITS start ② → collides (was: fired from ① and missed)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio);
  const r = await page.evaluate(async () => {
    // t1730 — MiddleWizard (the legacy screen class) was deleted alongside its view; middleStack/opSimStarts are
    // the surviving builder + start-inference registry.
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const stock = { x: 100, y: 80, z: 20, shape: 'boss' };
    const base = { featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', stockX: 100, stockY: 80, stockZ: 20, dist: 130, retract: 2 };
    // the FAST probe of each pass = the first probe seg of that pass; clamped (<dist) = collided, full (=dist) = missed.
    const fastByPass = (code, opts) => {
      const probes = (traceToolpath(code, { stock, start: opts.start, passStarts: opts.passStarts }).segments || [])
        .filter((s) => s.type === 'probe' || s.probe).map((s) => ({ pass: s.pass, len: Math.hypot(s.x2 - s.x1, s.y2 - s.y1) }));
      const out = {}; for (const p of probes) if (out[p.pass] == null) out[p.pass] = p.len;   // first (fast) probe per pass
      return out;
    };
    const out = {};
    for (const [name, p] of [['auto', { ...base, inAxis: 'auto', transAxis: 'auto' }], ['manual', { ...base, inAxis: 'manual', transAxis: 'manual' }]]) {
      const code = emitMapped(middleStack(p)).text, starts = opSimStarts('middle', p, stock);
      out[name] = { nStarts: starts.length, without: fastByPass(code, { start: starts[0] }), with: fastByPass(code, { start: starts[0], passStarts: starts }) };
    }
    return out;
  });
  // MANUAL: 4 passes (one wall each). WITHOUT passStarts, passes 1/2/3 miss (~130); WITH, all 4 collide (< 130).
  expect(r.manual.nStarts).toBe(4);
  expect(r.manual.without[1]).toBeGreaterThan(120);          // fired from ① → missed
  for (const p of [0, 1, 2, 3]) expect(r.manual.with[p], `manual pass ${p} collides from its start`).toBeLessThan(60);
  // AUTO: 2 passes (X then Y). The 2nd-axis (Y, pass 1) probe goes from MISS → COLLIDE once it fires from ②.
  expect(r.auto.nStarts).toBe(2);
  expect(r.auto.with[1], 'auto Y pass collides from ②').toBeLessThan(60);
  // t1205 — the AUTO control changed ON PURPOSE and no longer demonstrates the ① miss: passAnchorFor now falls back to
  // the PREVIOUS PASS'S RUNTIME END when a pass has no declared start row, so even without passStarts the probe fires
  // from where the tool physically is (after the programmed traverse) instead of teleporting back to ①. That failure
  // mode is now unreachable by construction. The MANUAL control above still discriminates (its reposition is an operator
  // JOG, so there is no programmed move to carry the tool to the next wall). The property that matters — every pass
  // probes from a REAL position and collides — is asserted for both arms.
  expect(r.auto.without[1], 'auto Y pass collides even without declared starts (it anchors at the previous pass END)').toBeLessThan(60);
});
