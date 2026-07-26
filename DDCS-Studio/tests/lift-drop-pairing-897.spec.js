import { test, expect } from '@playwright/test';

/**
 * t897 — RIDER 4: the CRASH-ADJACENT lift/drop pairing. Post-t824/t826 the per-wall retreat became an ABSOLUTE
 * machine-frame G53 lift (to the safe margin), but the reposition DROP stayed RELATIVE — so the tool lifted to an
 * absolute height then dropped a relative amount, landing an ARBITRARY Z. The next wall then probed from the wrong
 * height (crash if too low, miss if too high). The user's symptom: the middle Safe-Z field "changes nothing".
 *
 * THE FIX pairs them HONESTLY: saveMachineZNode records the pre-lift Z (`#95=#882 ( @saveProbeZ )`) and the paired
 * `G53 Z#95 ( @returnProbeZ )` returns the tool to THAT saved Z — so every wall probes from the SAME Z BY
 * CONSTRUCTION. This asserts the RESULTING Z (it SIMULATES the macro), which the emit-literal golden (corner-z-trust)
 * could not — that golden passed on the buggy code because it asserted the emit AS-DESIGNED. The DECLARED sim markers
 * (data/simMarkers.js) let the sim record the scene-Z at the save and restore it exactly at the return — bypassing the
 * undeclared-placement G53 approximation — so the wall-2 probe renders HITTING (not the g53Approx miss) under BOTH
 * undeclared AND declared placement. See also corner-draw-anchor (the specific #1925/#1927), regenerated as this fix.
 */
const stock = { x: 100, y: 80, z: 20, shape: 'box', show: true };
const R = (n) => Math.round(n * 1e4) / 1e4;

// The lateral WALL probes only: a G31 that MOVES in XY at a CONSTANT Z (excludes a Z-surface probe, which moves in Z).
// Every one must fire from the SAME Z — that is the whole point of the honest return.
//
// t1203 FRAME HARDENING (the test was measuring the wrong frame): these Zs used to be read as the RAW `s.z1`, which is
// PASS-LOCAL. Every pass resets its local origin, so a pass-local read shows [0,0,0,0] — identical — even when the
// walls sit at DIFFERENT world heights. That is exactly how the corner re-descend bug stayed green here: pre-fix the
// WORLD Zs were [-5,-5,0,0] (wall-2 one safe-Z margin TOO HIGH) while the locals read [0,0,0,0]. Each trace now stitches
// its probe segments through passAnchorFor IN-PAGE (the fn is a module import, so it can't cross the evaluate boundary)
// and returns `lateralWorldZs` — the height the tool ACTUALLY probes at, which is the property that matters.

test('(1) primitive: a MARKED save/return round-trip nets zero (restores the saved Z); the marker is what drives it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    // scene z=-8 (a plain G0, unambiguous); save; a margin lift; the MARKED return -> restore -8 EXACTLY (bypass g53Approx)
    const marked = new GcodeExecutionEngine({ autoAnswer: true, g53ApproxZ: 5 });
    marked.trace('G90\nG0 Z-8\n#95=#882 ( @saveProbeZ )\nG53 Z-2 ( margin lift )\nG53 Z#95 ( @returnProbeZ )');
    // control: identical geometry but NO markers -> the return G53 Z#95 falls to the g53Approx margin (5), NOT -8
    const bare = new GcodeExecutionEngine({ autoAnswer: true, g53ApproxZ: 5 });
    bare.trace('G90\nG0 Z-8\n#95=#882\nG53 Z-2\nG53 Z#95');
    return { markedZ: R(marked.pos.z), bareZ: R(bare.pos.z) };
    function R(n) { return Math.round(n * 1e4) / 1e4; }
  });
  expect(r.markedZ, 'the MARKED return restores the saved scene-Z exactly (round-trip nets zero, despite the intervening lift)').toBe(-8);
  expect(r.bareZ, 'WITHOUT the marker the SAME G53 Z#95 falls to the g53Approx margin (5) — proving the marker DRIVES the exact restore').toBe(5);
});

async function traceCorner(page, { probeZFirst, declared: declaredPlacement }) {
  return page.evaluate(async ({ stock, probeZFirst, declaredPlacement }) => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const { passAnchorFor } = await import('/engine/passAnchor.js');   // t1203 — world-stitch the pass-local segment Zs
    registerUserOp(CD.cornerDataDef());
    const def = CD.cornerDataDef();
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const p = { ...CD.CORNER_DEFAULTS, probeZFirst };
    const declared = def.simStartsProvider(p, stock).map((m) => ({ x: m.x, y: m.y, z: m.z || 0, source: m.source, anchorsAtPrev: !!m.anchorsAtPrev }));
    const gcode = emitMapped(build(p)).text;
    // undeclared placement → the g53 approximation (the margin); declared placement → an exact machine->part map (a real WCS)
    const opts = declaredPlacement
      ? { wcsOffset: { x: 0, y: 0, z: -50 } }
      : { g53ApproxZ: Math.abs(Number((window.ddcsGetSettings().machine || {}).safeZMargin)) || 5 };
    const parsed = traceToolpath(gcode, { stock, start: declared[0], passStarts: declared, ...opts });
    const eng = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: declared[0], ...opts });
    eng._passStarts = declared;
    eng.trace(gcode);
    // t1203 — hand back the world-stitched probe Zs + the @returnProbeZ segment, computed IN-PAGE (passAnchorFor is a
    // module import, so it cannot cross the evaluate boundary). The return segment is located by its emitted line.
    const segs = parsed.segments || [], pes = parsed.passEnds || [];
    const worldZ = (s) => { const o = passAnchorFor(declared, pes, s.pass) || { z: 0 }; return s.z1 + (o.z || 0); };
    const lateral = segs.filter((s) => s.type === 'probe' && Math.abs(s.z1 - s.z2) < 1e-6 && (Math.abs(s.x1 - s.x2) > 1e-6 || Math.abs(s.y1 - s.y2) > 1e-6));
    const retLines = gcode.split('\n').map((t, i) => (/@returnProbeZ/.test(t) ? i : -1)).filter((i) => i >= 0);
    const retSegs = segs.filter((s) => retLines.includes(s.line)).map((s) => ({ dz: Math.abs(s.z2 - s.z1), pass: s.pass }));
    return {
      segments: segs, x1925: eng.vars.get(1925), hasMarks: /@saveProbeZ/.test(gcode) && /@returnProbeZ/.test(gcode),
      lateralWorldZs: lateral.map((s) => Math.round(worldZ(s) * 1e4) / 1e4), retSegs,
    };
  }, { stock, probeZFirst, declaredPlacement });
}

for (const probeZFirst of [0, 1]) {
  test(`(2) corner probeZ=${probeZFirst}: every wall probes from ONE Z + wall-2 HITS (undeclared placement)`, async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await traceCorner(page, { probeZFirst, declared: false });
    const zs = r.lateralWorldZs;   // t1203 — WORLD Zs (pass-anchor stitched); the old pass-local read hid the defect
    expect(r.hasMarks, 'the corner emit carries the declared save+return markers').toBe(true);
    expect(zs.length, 'there are lateral wall probes to check (both walls)').toBeGreaterThanOrEqual(2);
    expect(new Set(zs).size, `every wall probe fires from ONE WORLD Z (the honest, frame-independent return) — got ${JSON.stringify(zs)}`).toBe(1);
    // t1203 ANTI-REGRESSION (the corner re-descend): when a REPOSITION moved the pass anchor between the save and the
    // return, the @returnProbeZ G53 must render a REAL descent. Pre-fix it was ZERO-LENGTH (the saved Z was stored
    // pass-local, so it restored to the new pass's origin) and wall-2 silently probed one safe-Z margin too high.
    const crossPass = r.retSegs.filter((s) => s.pass > 0);
    if (crossPass.length) expect(Math.min(...crossPass.map((s) => s.dz)), 'the @returnProbeZ G53 is NOT zero-length after a reposition (it re-descends to the scan depth)').toBeGreaterThan(1e-6);
    // the real symptom: the wall-2 X-probe CONTACTS the front face at 0 - tipR(2) = -2. Pre-fix (absolute lift + relative
    // drop, or the emit fix WITHOUT the sim marker) it fired too high and MISSED → #1925 = the full probe travel (952).
    expect(R(r.x1925), 'wall-2 HITS the stock face at -2 (NOT the g53Approx miss 952)').toBe(-2);
  });
}

test('(3) DECLARED placement stays exact: the marked return restores the saved Z, non-return G53 keeps the exact map', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  // "declared placement still exact" = the fix touches ONLY the marked return (map-independent pop). Under a real WCS
  // (wcsOffset, g53ApproxZ null) the marked return still restores the saved scene-Z exactly, AND every OTHER G53 keeps
  // the exact machine->part map (part = machineval - wcsOffset.z) — unchanged. (A full corner trace under declared
  // placement is a separate 'Sits at WCS' geometry concern, orthogonal to this lift/drop pairing.)
  const r = await page.evaluate(async () => {
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const wcsOffset = { x: 0, y: 0, z: -50 };   // part-zero at machine Z -50 → the exact map maps machine v -> part v+50
    const ret = new GcodeExecutionEngine({ autoAnswer: true, wcsOffset });   // g53ApproxZ null → declared/exact
    ret.trace('G90\nG0 Z10\n#95=#882 ( @saveProbeZ )\nG53 Z-2 ( margin lift )\nG53 Z#95 ( @returnProbeZ )');
    const exact = new GcodeExecutionEngine({ autoAnswer: true, wcsOffset });
    exact.trace('G90\nG53 Z-2');   // a NON-return G53 under declared placement → the exact map: -2 - (-50) = 48
    return { returnZ: Math.round(ret.pos.z * 1e4) / 1e4, nonReturnZ: Math.round(exact.pos.z * 1e4) / 1e4 };
  });
  expect(r.returnZ, 'declared placement: the MARKED return restores the saved scene-Z (10) exactly — map-independent').toBe(10);
  expect(r.nonReturnZ, 'declared placement: a NON-return G53 keeps the exact machine->part map (-2 - (-50) = 48), unchanged by the fix').toBe(48);
});

test('(4) middle boss (manual in-axis): every wall probes from ONE Z (the reposition returns to the probe depth)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ stock }) => {
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const { passAnchorFor } = await import('/engine/passAnchor.js');   // t1203 — world-stitch (see the header note)
    const w = new MiddleWizard();
    const mstock = { x: 100, y: 80, z: 20, shape: 'boss', show: true };
    // inAxis 'manual' → the wall1->wall2 within-axis reposition is the MANUAL jog (repositionR — the fixed machine-lift path);
    // auto in-axis uses the relative-symmetric traverseOverR, which the fix (correctly) leaves untouched.
    const cfg = { featureType: 'boss', twoAxis: true, inAxis: 'manual', axis: 'X', dir1: 'pos', dir2: 'neg', stockX: 100, stockY: 80, stockZ: 20 };
    const gcode = w.generate(cfg);
    const starts = (typeof w.inferStarts === 'function') ? w.inferStarts(cfg, { stock: mstock }) : [{ x: 0, y: 0, z: 0 }];
    const g53ApproxZ = Math.abs(Number((window.ddcsGetSettings().machine || {}).safeZMargin)) || 5;
    const parsed = traceToolpath(gcode, { stock: mstock, start: starts[0], passStarts: starts, g53ApproxZ });
    const segs = parsed.segments || [], pes = parsed.passEnds || [];
    const lateral = segs.filter((s) => s.type === 'probe' && Math.abs(s.z1 - s.z2) < 1e-6 && (Math.abs(s.x1 - s.x2) > 1e-6 || Math.abs(s.y1 - s.y2) > 1e-6));
    const worldZ = (s) => { const o = passAnchorFor(starts, pes, s.pass) || { z: 0 }; return s.z1 + (o.z || 0); };
    return { segments: segs, hasMarks: /@saveProbeZ/.test(gcode) && /@returnProbeZ/.test(gcode), lateralWorldZs: lateral.map((s) => Math.round(worldZ(s) * 1e4) / 1e4) };
  }, { stock });
  const zs = r.lateralWorldZs;   // t1203 — WORLD Zs (see the header note); a pass-local read cannot see a cross-pass drift
  expect(r.hasMarks, 'the middle emit carries the declared save+return markers (repositionR returnZ)').toBe(true);
  expect(zs.length, 'there are lateral wall probes to check').toBeGreaterThanOrEqual(2);
  expect(new Set(zs).size, `middle: every wall probe fires from ONE WORLD Z (the reposition returns to the probe depth) — got ${JSON.stringify(zs)}`).toBe(1);
});
