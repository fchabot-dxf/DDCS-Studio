import { test, expect } from '@playwright/test';

/**
 * FIX A — DRAW-ANCHOR DECOUPLE (t94). The preview/sim disconnect: `passStarts[N]` (the probe-FIRE net endpoint,
 * wall_N = wall_{N-1}+cross) was used UNMODIFIED as BOTH the marker sprite AND the per-pass ROUTE draw-anchor. The
 * dog-leg emits INCREMENTALLY after the `reposition:` pos-reset, so world = anchor + local double-counted +cross →
 * the route (and the sim's probe-collision origin O) fired +cross beyond ②. Fix: the provider DECLARES `anchorsAtPrev`
 * on AUTO reposition rows; drawAnchorFor resolves the route/collision anchor LIVE = starts[N-1] (else self); the marker
 * {x,y} stays the net endpoint. PREVIEW/SIM only — emit byte-identical. Every caveat below is assert-the-value + is
 * mutation-proven in WORK-LOG (revert a code piece → the named test goes RED).
 *
 * Default FL/YX (probeZ off): marker0 ①=(7,-43) (operator jog), marker1 ②=(-43,7) (auto reposition, #23/#24).
 */
const stock = { x: 100, y: 80, z: 20, shape: 'box', show: true };
const R1 = (n) => Math.round(n * 10) / 10;

async function traceCorner(page, params) {
  return page.evaluate(async ({ params, stock }) => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const { drawAnchorFor } = await import('/engine/passAnchor.js');
    registerUserOp(CD.cornerDataDef());
    const def = CD.cornerDataDef();
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const p = { ...CD.CORNER_DEFAULTS, ...params };
    const declared = def.simStartsProvider(p, stock).map((m) => ({ x: m.x, y: m.y, z: m.z || 0, source: m.source, anchorsAtPrev: !!m.anchorsAtPrev }));
    const gcode = emitMapped(build(p)).text;
    const parsed = traceToolpath(gcode, { stock, start: declared[0], passStarts: declared });
    // WORLD segments, offset by the SAME drawAnchorFor the viz/engine use (mirrors gcodeViz3d off / toolpath2d passOff)
    const segs = (parsed.segments || []).map((s) => {
      const o = drawAnchorFor(declared, s.pass) || { x: 0, y: 0 };
      return { pass: s.pass, t: s.type, ax: s.x1 + o.x, ay: s.y1 + o.y, bx: s.x2 + o.x, by: s.y2 + o.y };
    }).filter((s) => Math.abs(s.ax - s.bx) > 1e-6 || Math.abs(s.ay - s.by) > 1e-6);
    return { declared, gcode, segs, emitHasAnchor: /anchor/i.test(gcode) };
  }, { params, stock });
}

// (4) ROUTE RECONNECT — real coordinates, not "looks connected": pass-1's route STARTS at marker[0] (the re-park) and
// the wall-2 PROBE FIRES at marker[1]=② (the net endpoint). The dog-leg connects ①→② continuously.
test('(4) route reconnect: auto pass-1 dog-leg starts at marker[0], wall-2 probe fires at marker[1]=②', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await traceCorner(page, {});
  const m0 = r.declared[0], m1 = r.declared[1];
  expect([R1(m0.x), R1(m0.y)], 'marker0 ① = (7,-43)').toEqual([7, -43]);
  expect([R1(m1.x), R1(m1.y)], 'marker1 ② = (-43,7)').toEqual([-43, 7]);
  const pass1 = r.segs.filter((s) => s.pass === 1);
  const firstRapid = pass1.find((s) => s.t === 'rapid');
  const firstProbe = pass1.find((s) => s.t === 'probe');
  // the dog-leg's FIRST leg STARTS at marker[0] (re-park), NOT at marker[1] (the old +cross-shifted bug drew from ②)
  expect([R1(firstRapid.ax), R1(firstRapid.ay)], 'pass-1 dog-leg starts at marker[0] (7,-43)').toEqual([7, -43]);
  // the wall-2 probe FIRES from marker[1]=② (-43,7). Buggy: it fired from (-93,57) (+cross beyond ②).
  expect([R1(firstProbe.ax), R1(firstProbe.ay)], 'wall-2 probe fires at ② (-43,7), not +cross beyond it').toEqual([-43, 7]);
});

// (1) ENGINE-FRAME — the SIM's probe-vs-stock collision fires from the right point. The last probe (wall-2, X) trigger
// #1926 (its Y) == ②.y; buggy O = net endpoint → the probe fires from (-93,57) → #1926 = 57. Real-value, not pixel.
test('(1) engine-frame: the wall-2 probe trigger #1926 == ②.y (the sim fires from the re-park anchor, not +cross)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ stock }) => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    registerUserOp(CD.cornerDataDef());
    const def = CD.cornerDataDef();
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const p = { ...CD.CORNER_DEFAULTS };
    const declared = def.simStartsProvider(p, stock).map((m) => ({ x: m.x, y: m.y, z: m.z || 0, source: m.source, anchorsAtPrev: !!m.anchorsAtPrev }));
    const gcode = emitMapped(build(p)).text;
    const eng = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: declared[0] });
    eng._passStarts = declared;
    eng.trace(gcode);
    const m1 = declared[declared.length - 1];
    return { y1926: eng.vars.get(1926), x1925: eng.vars.get(1925), wall2y: m1.y, wall2x: m1.x };
  }, { stock });
  // #1926 (last probe = wall-2 X-probe trigger Y) sits on ②'s Y row (the X-probe holds Y). Buggy = 57 (+cross).
  expect(R1(r.y1926), 'the sim wall-2 probe trigger Y == ②.y = 7 (fires from the re-park anchor)').toBe(R1(r.wall2y));
  // and #1925 (the contact X) is a sane on-stock value reachable FROM ②, not the (-93…) +cross-shifted fire point
  expect(r.x1925, 'the wall-2 contact X is within the stock, not shifted by +cross').toBeGreaterThan(-50);
});

// (2) FALLBACK — the #1 all-ops-regression guard. drawAnchorFor with NO flag resolves to SELF (never undefined/NaN),
// and a NON-CORNER multi-pass op (middle) traces with every world coord FINITE + each pass anchored at its OWN start.
test('(2) fallback: no anchorsAtPrev → self; a non-corner multi-pass op has NO NaN + per-pass self-anchor', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ stock }) => {
    const { drawAnchorFor } = await import('/engine/passAnchor.js');
    const { MiddleWizard } = await import('/wizards/middleWizard.js');
    const { traceToolpath } = await import('/engine/trace.js');
    // unit: no flag → self (===); pass 0 → self; absent pass → undefined (caller's own || fallback covers it)
    const plain = [{ x: 10, y: 20, z: 0 }, { x: 50, y: -30, z: 0 }];
    const unit = {
      p0Self: drawAnchorFor(plain, 0) === plain[0],
      p1Self: drawAnchorFor(plain, 1) === plain[1],       // NO flag → self, NOT starts[0] and NOT undefined
      absent: drawAnchorFor(plain, 5) === undefined,
      flagged: (() => { const a = [{ x: 1, y: 1 }, { x: 2, y: 2, anchorsAtPrev: true }]; return drawAnchorFor(a, 1) === a[0]; })(),
    };
    // integration: a real non-corner multi-pass op (middle boss, 2-axis) — anchorsAtPrev is never set → every segment finite
    const w = new MiddleWizard();
    const mstock = { x: 100, y: 80, z: 20, shape: 'boss', show: true };
    const gcode = w.generate({ featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg', stockX: 100, stockY: 80, stockZ: 20 });
    const starts = (typeof w.inferStarts === 'function') ? w.inferStarts({ featureType: 'boss', twoAxis: true, axis: 'X', dir1: 'pos', dir2: 'neg' }, { stock: mstock }) : [{ x: 0, y: 0, z: 0 }];
    const parsed = traceToolpath(gcode, { stock: mstock, start: starts[0], passStarts: starts });
    let anyNaN = false;
    for (const s of (parsed.segments || [])) { const o = drawAnchorFor(starts, s.pass) || { x: 0, y: 0 }; if (!Number.isFinite(s.x1 + o.x) || !Number.isFinite(s.y1 + o.y)) anyNaN = true; }
    // each middle pass with a declared start resolves to ITS OWN start (no flag → self, not pass-0)
    const perPassSelf = starts.every((_, i) => drawAnchorFor(starts, i) === starts[i]);
    return { unit, anyNaN, perPassSelf, passes: parsed.stats && parsed.stats.passes };
  }, { stock });
  expect(r.unit.p0Self, 'pass 0 → self').toBe(true);
  expect(r.unit.p1Self, 'no flag → SELF (not starts[0], not undefined) — the fallback').toBe(true);
  expect(r.unit.absent, 'absent pass → undefined (caller keeps its own || fallback)').toBe(true);
  expect(r.unit.flagged, 'flagged → starts[N-1]').toBe(true);
  expect(r.anyNaN, 'a non-corner multi-pass op has NO NaN world coord (the all-ops-regression guard)').toBe(false);
  expect(r.perPassSelf, 'every non-corner pass anchors at its OWN start (no flag → self, never pass-0)').toBe(true);
});

// (3) SOURCE-GATE — a MANUAL corner reposition has NO dog-leg (the operator jogs), so it must KEEP anchor=self (the
// jog line bridges). The provider sets anchorsAtPrev only for source==='auto'. Manual pass-1 resolves to its own marker.
test('(3) source-gate: MANUAL reposition keeps anchor=self (anchorsAtPrev off), so the route does not shift', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const auto = await traceCorner(page, { travelApproach: 'auto' });
  const manual = await traceCorner(page, { travelApproach: 'manual' });
  // auto: pass-1 IS flagged; manual: pass-1 is NOT (no programmed dog-leg)
  expect(auto.declared[1].anchorsAtPrev, 'auto reposition row is flagged anchorsAtPrev').toBe(true);
  expect(manual.declared.every((m) => m.anchorsAtPrev === false), 'MANUAL: no row is flagged (self-anchor; the jog bridges)').toBe(true);
  // manual pass-1's route resolves against its OWN marker (self), so the wall-2 probe fires at ② directly (no re-park hop)
  const mProbe = manual.segs.filter((s) => s.pass === 1).find((s) => s.t === 'probe');
  expect([R1(mProbe.ax), R1(mProbe.ay)], 'manual wall-2 probe fires at ② (self-anchored, not shifted to marker[0])').toEqual([R1(manual.declared[1].x), R1(manual.declared[1].y)]);
});

// (5) DRAG-CONSISTENCY — the anchor is resolved LIVE from the current array, NOT a frozen snapshot: mutating marker[N-1]
// in place (what a drag does, gcodeViz3d:1471) and re-resolving reflects the new position → pass-N's route re-drags.
test('(5) drag-consistency: the resolved anchor tracks a LIVE mutation of marker[N-1] (not frozen)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { drawAnchorFor } = await import('/engine/passAnchor.js');
    const starts = [{ x: 7, y: -43, z: 0 }, { x: -43, y: 7, z: 0, anchorsAtPrev: true }];
    const before = drawAnchorFor(starts, 1);                 // === starts[0] (the re-park)
    starts[0].x = 999; starts[0].y = -999;                    // simulate dragging marker[0] IN PLACE (a real drag mutates the row)
    const after = drawAnchorFor(starts, 1);                   // re-resolve LIVE
    return { beforeIsPrev: before === starts[0], afterX: after.x, afterY: after.y };
  });
  expect(r.beforeIsPrev, 'pass-1 anchor resolves to marker[0] (the previous start)').toBe(true);
  expect([r.afterX, r.afterY], 'after dragging marker[0], pass-1 anchor tracks it LIVE (999,-999) — not a frozen snapshot').toEqual([999, -999]);
});

// (7) LIVE-HEAD — the engine-driven 3D tool sprite rides the SAME re-park anchor as its route (gcodeViz3d setToolPosition),
// else on a corner AUTO reposition pass the live head floats +cross off the dog-leg it traces (the two views disagree).
test('(7) live-head: the 3D tool sprite rides the re-park anchor for a flagged corner pass (not the net endpoint)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._anchorToStart = true;
    viz.starts = [{ x: 7, y: -43, z: 0 }, { x: -43, y: 7, z: 0, anchorsAtPrev: true }];   // pass 1 = a flagged auto reposition
    viz.setToolPosition({ x: 0, y: 0, z: 0, pass: 1 });   // the head at pass-1-local origin (the dog-leg start)
    return { hx: viz._animTool.position.x, hy: viz._animTool.position.y };
  });
  // the live head sits at the re-park anchor marker[0]=(7,-43) (where the dog-leg begins), NOT the net endpoint marker[1]=(-43,7)
  expect([R1(r.hx), R1(r.hy)], 'the 3D tool head rides the re-park anchor (7,-43), matching its route — not marker[1]').toEqual([7, -43]);
});

// (6) BYTE-PARITY — the anchor decouple is PREVIEW/SIM only: the emitted G-code is untouched (no `anchor` text) and the
// twin still reproduces the built-in cornerStack byte-for-byte across the probeZFirst×travelApproach matrix.
test('(6) byte-parity: emit is untouched (no anchor leak) + twin == cornerStack byte-for-byte', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(CD.cornerDataDef());
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const parity = [];
    for (const pz of [0, 1]) for (const ta of ['auto', 'manual']) {
      const p = { ...CD.CORNER_DEFAULTS, probeZFirst: pz, travelApproach: ta };
      const twin = emitMapped(build(p)).text;
      const built = emitMapped(cornerStack(p)).text;
      parity.push({ pz, ta, equal: twin === built, hasAnchor: /anchor/i.test(twin) });
    }
    return { parity };
  });
  for (const c of r.parity) {
    expect(c.equal, `twin == cornerStack byte-for-byte at probeZFirst=${c.pz} travelApproach=${c.ta}`).toBe(true);
    expect(c.hasAnchor, `no anchor flag leaks into the emitted .nc (probeZFirst=${c.pz} ${c.ta})`).toBe(false);
  }
});
