import { test, expect } from '@playwright/test';

/**
 * DRAW-ANCHOR DECOUPLE (t94 Fix A) → MACHINE-FAITHFUL SIM (t107). The preview/sim disconnect: `passStarts[N]` (the
 * probe-FIRE net endpoint, wall_N = wall_{N-1}+cross) was used UNMODIFIED as BOTH the marker sprite AND the per-pass
 * ROUTE draw-anchor. The dog-leg emits INCREMENTALLY after the `reposition:` pos-reset, so world = anchor + local
 * double-counted +cross → the route + collision fired +cross beyond ②. The provider DECLARES `anchorsAtPrev` on AUTO
 * reposition rows.
 *   • t94 (Fix A): resolved the route/collision anchor to the static previous START marker `starts[N-1]` — closed the
 *     gross +cross double-count, but the dog-leg still emanated one probe-distance SHORT of where the tool actually is.
 *   • t107 (machine-faithful): the trace publishes each pass's RUNTIME world-END (`passEnds` — post probe+retract+lift,
 *     collision-clamped). `passAnchorFor(starts, passEnds, N)` anchors a flagged pass at `passEnds[N-1]`, the marker
 *     RELOCATES to `passEnds[N-1] + cross`, and #1925-1927 fire there — route-anchor, marker, and probe-fire all read
 *     this ONE runtime value (coherent). PREVIEW/SIM only — emit byte-identical. Each property is mutation-proven (WORK-LOG).
 *
 * Default FL/YX (probeZ off), stock 100×80×20, tipR 2, retract 5, safeZ 10, scanDepth 5:
 *   DECLARED markers (start-based, from the provider — UNCHANGED): ①=(7,-43,-5) (jog, z=-scanDepth), ②=(-43,7,-5).
 *   off.wall2 = ② − ① = (-50,+50). passEnds[0] (wall-1 runtime END) = (7,-7,5): X unmoved (Y-probe), Y = contact(-2 =
 *   front face 0 − tipR) − retract(5) = -7 (+36 above ①), Z = -5 + safeZ lift = 5. RELOCATED ② = passEnds[0] + off.wall2
 *   = (-43,43,5) = the dog-leg END = the wall-2 probe fire. Engine #1925=-2 (contact X), #1926=43 (=②.y relocated,
 *   was 7 start-based), #1927=-5 (drop z). MANUAL: ② is NOT flagged → self-anchored, unchanged.
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
    const { passAnchorFor } = await import('/engine/passAnchor.js');
    registerUserOp(CD.cornerDataDef());
    const def = CD.cornerDataDef();
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const p = { ...CD.CORNER_DEFAULTS, ...params };
    const declared = def.simStartsProvider(p, stock).map((m) => ({ x: m.x, y: m.y, z: m.z || 0, source: m.source, anchorsAtPrev: !!m.anchorsAtPrev }));
    const gcode = emitMapped(build(p)).text;
    const parsed = traceToolpath(gcode, { stock, start: declared[0], passStarts: declared });
    const passEnds = parsed.passEnds || [];
    // WORLD segments, offset by the SAME passAnchorFor(passEnds) the viz/engine use (t107 — a flagged pass anchors at the
    // previous pass's RUNTIME END, mirroring gcodeViz3d off / toolpath2d passOff / the engine collision O).
    const segs = (parsed.segments || []).map((s) => {
      const o = passAnchorFor(declared, passEnds, s.pass) || { x: 0, y: 0 };
      return { pass: s.pass, t: s.type, ax: s.x1 + o.x, ay: s.y1 + o.y, bx: s.x2 + o.x, by: s.y2 + o.y };
    }).filter((s) => Math.abs(s.ax - s.bx) > 1e-6 || Math.abs(s.ay - s.by) > 1e-6);
    // the RELOCATED marker sprite (t107 — display-only VIEW of the declared row): passEnds[N-1] + (declared[N] − declared[N-1])
    const markerWorld = declared.map((row, i) => {
      const prev = declared[i - 1], end = passEnds[i - 1];
      return (row.anchorsAtPrev && i > 0 && end && prev) ? { x: end.x + (row.x - prev.x), y: end.y + (row.y - prev.y) } : { x: row.x, y: row.y };
    });
    return { declared, passEnds, markerWorld, gcode, segs, emitHasAnchor: /anchor/i.test(gcode) };
  }, { params, stock });
}

// (4) ROUTE RECONNECT (t107 machine-faithful) — real coordinates, not "looks connected": pass-1's dog-leg STARTS at the
// RUNTIME wall-1 END (passEnds[0], post probe+retract+lift), ENDS on the RELOCATED ②, and the wall-2 probe FIRES there.
// route-first == prevEnd == passEnds[0]; route-end == relocated ② == probe-fire. The chain ①→(runtime end)→② is continuous.
test('(4) route reconnect: pass-1 dog-leg starts at the RUNTIME wall-1 END, wall-2 probe fires at the relocated ②', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await traceCorner(page, {});
  const m0 = r.declared[0], m1 = r.declared[1], e0 = r.passEnds[0];
  expect([R1(m0.x), R1(m0.y)], 'declared marker0 ① = (7,-43) (start-based, unchanged)').toEqual([7, -43]);
  expect([R1(m1.x), R1(m1.y)], 'declared marker1 ② = (-43,7) (start-based, unchanged)').toEqual([-43, 7]);
  // passEnds[0] = the RUNTIME wall-1 end (independent geometry): X unmoved (7), Y = contact(-2) − retract(5) = -7 (+36
  // ABOVE ①, the probe-distance the old start-based frame was short by), Z = start(-5) + safeZ lift(10) = 5.
  expect([R1(e0.x), R1(e0.y), R1(e0.z)], 'passEnds[0] = wall-1 runtime end (7,-7,5), NOT the start marker (7,-43,-5)').toEqual([7, -7, 5]);
  expect(e0.y, 'the runtime end sits ~a probe-distance above the jog start (machine-faithful, not the static start)').toBeGreaterThan(m0.y + 30);
  const pass1 = r.segs.filter((s) => s.pass === 1);
  const firstRapid = pass1.find((s) => s.t === 'rapid');
  const firstProbe = pass1.find((s) => s.t === 'probe');
  // route FIRST-POINT == the runtime prevEnd (passEnds[0]=(7,-7)) — the dog-leg emanates from where the tool ACTUALLY is
  expect([R1(firstRapid.ax), R1(firstRapid.ay)], 'pass-1 dog-leg starts at the runtime wall-1 END (7,-7), not the static jog (7,-43)').toEqual([7, -7]);
  // route END == the RELOCATED ② = passEnds[0] + off.wall2(-50,+50) = (-43,43) == where the wall-2 probe fires
  expect([R1(r.markerWorld[1].x), R1(r.markerWorld[1].y)], 'relocated ② = passEnds[0] + off.wall2 = (-43,43)').toEqual([-43, 43]);
  expect([R1(firstProbe.ax), R1(firstProbe.ay)], 'wall-2 probe fires at the RELOCATED ② (-43,43), not the static ② (-43,7)').toEqual([-43, 43]);
  expect([R1(firstProbe.ax), R1(firstProbe.ay)], 'route-end == marker-2 == probe-fire (one runtime value)').toEqual([R1(r.markerWorld[1].x), R1(r.markerWorld[1].y)]);
});

// (1) ENGINE-FRAME (t107 machine-faithful) — the SIM's probe-vs-stock collision fires from the RUNTIME wall-1 END + the
// dog-leg, i.e. the RELOCATED ②, not the static ②. The last probe (wall-2, X-probe) holds Y at the relocated ②.y (43),
// contacts the X face at -2. Real-value, not pixel: #1926 is re-derived from passEnds[0] + off.wall2 via a DIFFERENT path.
test('(1) engine-frame: the wall-2 probe trigger #1926 == the RELOCATED ②.y (fires from the runtime wall-1 END + dog-leg)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async ({ stock }) => {
    const CD = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { GcodeExecutionEngine } = await import('/engine/index.js');
    const { traceToolpath } = await import('/engine/trace.js');
    registerUserOp(CD.cornerDataDef());
    const def = CD.cornerDataDef();
    const build = builderOf(CD.CORNER_DATA_OPTYPE);
    const p = { ...CD.CORNER_DEFAULTS };
    const declared = def.simStartsProvider(p, stock).map((m) => ({ x: m.x, y: m.y, z: m.z || 0, source: m.source, anchorsAtPrev: !!m.anchorsAtPrev }));
    const gcode = emitMapped(build(p)).text;
    // independent re-derivation of the relocated ② from the trace's runtime end (a DIFFERENT path than the engine DRO)
    const parsed = traceToolpath(gcode, { stock, start: declared[0], passStarts: declared });
    const e0 = (parsed.passEnds || [])[0], m0 = declared[0], m1 = declared[1];
    const relY = e0.y + (m1.y - m0.y);   // relocated ②.y = passEnds[0].y + off.wall2.y
    const eng = new GcodeExecutionEngine({ autoAnswer: true, stock, stockOffset: declared[0] });
    eng._passStarts = declared;
    eng.trace(gcode);
    return { y1926: eng.vars.get(1926), x1925: eng.vars.get(1925), z1927: eng.vars.get(1927), relY, staticY: m1.y };
  }, { stock });
  // #1926 (wall-2 X-probe holds Y) == the RELOCATED ②.y = passEnds[0].y + off.wall2.y = 43 — machine-faithful, from a
  // different path (the trace's runtime end). NOT the static ②.y = 7 (the t94 start-based frame the old test codified).
  expect(R1(r.y1926), 'the sim wall-2 probe trigger Y == the RELOCATED ②.y (machine-faithful)').toBe(R1(r.relY));
  expect(R1(r.y1926), 'machine-faithful #1926 == 43').toBe(43);
  expect(R1(r.y1926), 'NOT the static (t94 start-based) ②.y = 7').not.toBe(R1(r.staticY));
  // #1925 (contact X) contacts the X face at -tipR = -2 (reachable from the relocated ②), #1927 (probe height) = drop -5
  expect(R1(r.x1925), 'the wall-2 contact X = front-face 0 − tipR 2 = -2 (on-stock, reachable from the relocated ②)').toBe(-2);
  expect(R1(r.z1927), 'the wall-2 probe fires at the jogged/drop height z = -scanDepth = -5, not above the stock').toBe(-5);
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

// (7) LIVE-HEAD (t107 machine-faithful) — the engine-driven 3D tool sprite rides the SAME runtime-END anchor as its route
// (gcodeViz3d setToolPosition → passAnchorFor(starts, _passEnds, pass)), else on a flagged pass the live head floats off
// the dog-leg it traces. With _passEnds published, the pass-1 head anchors at passEnds[0] (the runtime wall-1 end), not ①.
test('(7) live-head: the 3D tool sprite rides the RUNTIME wall-1 END for a flagged corner pass (not the static start)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz._anchorToStart = true;
    viz.starts = [{ x: 7, y: -43, z: 0 }, { x: -43, y: 7, z: 0, anchorsAtPrev: true }];   // pass 1 = a flagged auto reposition
    if (viz.setPassEnds) viz.setPassEnds([{ x: 7, y: -7, z: 5 }, { x: -7, y: 43, z: 5 }]);  // t107 — the trace's runtime ends
    viz.setToolPosition({ x: 0, y: 0, z: 0, pass: 1 });   // the head at pass-1-local origin (the dog-leg start)
    // and WITHOUT ends (null) it must degrade to the t94 static previous-start (the all-ops fallback stays intact)
    viz.setPassEnds(null);
    viz.setToolPosition({ x: 0, y: 0, z: 0, pass: 1 });
    const fallback = { hx: viz._animTool.position.x, hy: viz._animTool.position.y };
    if (viz.setPassEnds) viz.setPassEnds([{ x: 7, y: -7, z: 5 }, { x: -7, y: 43, z: 5 }]);
    viz.setToolPosition({ x: 0, y: 0, z: 0, pass: 1 });
    return { hx: viz._animTool.position.x, hy: viz._animTool.position.y, fallback };
  });
  // the live head sits at the RUNTIME wall-1 end passEnds[0]=(7,-7) (where the dog-leg begins), NOT the static start (7,-43)
  expect([R1(r.hx), R1(r.hy)], 'the 3D tool head rides the runtime wall-1 END (7,-7), matching its route — not the static start').toEqual([7, -7]);
  // ends=null → the t94 static previous-start (7,-43): the degradation path stays byte-identical for the pre-trace/non-corner case
  expect([R1(r.fallback.hx), R1(r.fallback.hy)], 'ends absent → degrade to the t94 static previous start (7,-43)').toEqual([7, -43]);
});

// (8) MARKER RELOCATION (t107) — the reposition-destination marker SPRITE relocates to its dog-leg END: passEnds[N-1] +
// cross (the machine-correct wall approach), matching the drawn route + the probe fire. A non-flagged / ends-absent marker
// stays at its declared row (display-only VIEW; the drag + #23/#24 still derive from `starts`). Both viz surfaces agree.
test('(8) marker relocation: a flagged marker sprite sits at passEnds[N-1]+cross (matches the route end + probe fire)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
  await page.evaluate(() => window.ddcsStudio.wizardManager.open('drill'));
  await page.waitForSelector('#wiz_drill', { state: 'visible' });
  await page.waitForFunction(() => { const p = window.ddcsStudio.wizardManager._activePanel; return p && p.viz; });
  const r = await page.evaluate(() => {
    const viz = window.ddcsStudio.wizardManager._activePanel.viz;
    viz.starts = [{ x: 7, y: -43, z: -5 }, { x: -43, y: 7, z: -5, anchorsAtPrev: true }];
    // with ends → relocate ② to passEnds[0]+cross = (7,-7)+(-50,50) = (-43,43); pass-0 (not flagged) stays at (7,-43)
    viz.setPassEnds([{ x: 7, y: -7, z: 5 }, { x: -7, y: 43, z: 5 }]);
    const relocated = [viz._markerWorld(0), viz._markerWorld(1)];
    // without ends → BOTH markers sit at their declared rows (the display degrades cleanly for non-corner / pre-trace)
    viz.setPassEnds(null);
    const declared = [viz._markerWorld(0), viz._markerWorld(1)];
    return {
      rel0: [relocated[0].x, relocated[0].y], rel1: [relocated[1].x, relocated[1].y],
      dec0: [declared[0].x, declared[0].y], dec1: [declared[1].x, declared[1].y],
    };
  });
  expect(r.rel0.map(R1), 'pass-0 (not flagged) marker stays at its declared jog start (7,-43)').toEqual([7, -43]);
  expect(r.rel1.map(R1), 'flagged ② relocates to passEnds[0]+cross = (-43,43) = the route end / probe fire').toEqual([-43, 43]);
  expect(r.dec0.map(R1), 'ends=null → pass-0 marker at declared (7,-43)').toEqual([7, -43]);
  expect(r.dec1.map(R1), 'ends=null → ② degrades to its declared row (-43,7) (display-only, no relocation)').toEqual([-43, 7]);
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
