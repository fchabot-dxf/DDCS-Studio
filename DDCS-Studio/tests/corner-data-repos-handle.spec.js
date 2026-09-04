import { test, expect } from '@playwright/test';

/**
 * sim-marker-track fix (t75) — the Layout FeatureCanvas EMITTING reposition handle (cross1_x/cross1_y) must render at
 * anchor+OFFSET (= the true destination, wall-2), NOT stuck at its anchor (wall-1). ROOT CAUSE was panelTypes' num(param)→0
 * fallback when the socket is UNSET (it relies on the G-code expression default, no JS literal) → the +offset vanished.
 * ONE-SOURCE FIX: layoutSpecFromOp now reads the offset from def.reposDefault (= cornerReposOffsets — the SAME source the sim
 * markers chain by), so the handle sits exactly on the wall-2 sim marker. Byte-parity untouched (preview/UI only).
 */

test.use({ viewport: { width: 1400, height: 1000 } });

test('reposition handle renders at anchor+evaluated-offset (the destination), unset default — FL/YX + BR/XY, one-source', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param="cross1_x"]', { state: 'attached' });   // t1303 — ATTACHED, not visible: this field is DECLARED out of the form (its editor is the canvas handle), so its presence is what proves the handle is built

  const r = await page.evaluate(async () => {
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { opSimStarts, resolveRelToIndex } = await import('/viz/opSimStarts.js');
    const def = cornerDataDef();   // fresh def (carries reposDefault); the registered provider drives opSimStarts
    const stock = window.ddcsGetSettings().stock;
    const S = (o) => ({ ...CORNER_DEFAULTS, ...o, travelDist: 50 });
    const repHandle = (params) => (layoutSpecFromOp(def, params).handles || []).find((h) => h.id === 'reposition_pos') || null;
    const marks = (params) => opSimStarts(CORNER_DATA_OPTYPE, params, stock) || [];
    const wall1Idx = (params) => resolveRelToIndex(CORNER_DATA_OPTYPE, params, { row: 'wall1' });
    const pack = (o) => { const p = S(o); const m = marks(p); const wi = wall1Idx(p); return { h: repHandle(p), wall1: m[wi], wall2: m[m.length - 1] }; };
    return { fl: pack({ corner: 'FL', probeSeq: 'YX' }), br: pack({ corner: 'BR', probeSeq: 'XY' }) };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  const near = (a, b, t = 0.02) => Math.abs(a - b) < t;
  expect(r.fl.h && r.br.h, 'the reposition handle is built (both combos)').toBeTruthy();

  // INDEPENDENT TRUTH (hand-derived, td=50): FL/YX → anchor wall1(7,-43) + cross(#23=-50,#24=+50) = wall2 (-43, 7).
  expect(near(r.fl.h.x, -43) && near(r.fl.h.y, 7), `FL/YX handle at wall2 (-43,7), got (${r.fl.h.x},${r.fl.h.y})`).toBe(true);
  // BR/XY (prefill t109 — base FLIPS to the BR corner) → anchor wall1(143,73) + cross(-50,+50) = wall2 (93, 123).
  expect(near(r.br.h.x, 93) && near(r.br.h.y, 123), `BR/XY handle at wall2 (93,123), got (${r.br.h.x},${r.br.h.y})`).toBe(true);

  // ONE-SOURCE cross-check: the handle sits EXACTLY on the wall-2 sim marker (both chain via cornerReposOffsets).
  expect(near(r.fl.h.x, r.fl.wall2.x) && near(r.fl.h.y, r.fl.wall2.y), 'FL/YX handle coincides with the wall-2 sim marker').toBe(true);
  expect(near(r.br.h.x, r.br.wall2.x) && near(r.br.h.y, r.br.wall2.y), 'BR/XY handle coincides with the wall-2 sim marker').toBe(true);

  // the REGRESSION guard: the handle is NOT stuck at its anchor (wall-1) — the +offset is present, not num()→0.
  expect(near(r.fl.h.x, r.fl.wall1.x) && near(r.fl.h.y, r.fl.wall1.y), 'handle is NOT at its wall-1 anchor (the bug)').toBe(false);
  expect(Math.hypot(r.fl.h.x - r.fl.wall1.x, r.fl.h.y - r.fl.wall1.y) > 10, 'handle is a full reposition away from its anchor').toBe(true);
});

// t107 MACHINE-FAITHFUL — when passEnds is threaded (the real app path via userOpView.getPassEnds), the Layout emitting
// handle RELOCATES from the static wall-2 (start-based) to the machine-correct wall-2 = passEnds[wall1] + cross, matching
// the relocated ② the top panel + 3D show. Without passEnds it degrades to the static start (the case above). One source.
test('the Layout reposition handle relocates to the RUNTIME wall-1 END + cross when passEnds is threaded (matches the top panel)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param="cross1_x"]', { state: 'attached' });

  const r = await page.evaluate(async () => {
    const { layoutSpecFromOp } = await import('/wizards/ops/panelTypes.js');
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const def = cornerDataDef();
    const s = window.ddcsGetSettings().stock;
    const p = { ...CORNER_DEFAULTS, travelDist: 50 };
    // INDEPENDENT passEnds via a fresh trace (the machine-faithful runtime wall-1 end)
    const tstock = { x: s.x, y: s.y, z: s.z, shape: s.shape, show: true };
    const declared = def.simStartsProvider(p, tstock).map((m) => ({ x: m.x, y: m.y, z: m.z || 0, source: m.source, anchorsAtPrev: !!m.anchorsAtPrev }));
    const gcode = emitMapped(builderOf(CORNER_DATA_OPTYPE)(p)).text;
    const passEnds = traceToolpath(gcode, { stock: tstock, start: declared[0], passStarts: declared }).passEnds || [];
    const marks = opSimStarts(CORNER_DATA_OPTYPE, p, s);
    const wall1 = marks[0], wall2Static = marks[marks.length - 1];   // static (start-based) chain
    const cross = { x: wall2Static.x - wall1.x, y: wall2Static.y - wall1.y };
    const hStatic = (layoutSpecFromOp(def, p).handles || []).find((h) => h.id === 'reposition_pos');
    const hFaithful = (layoutSpecFromOp(def, p, null, null, passEnds).handles || []).find((h) => h.id === 'reposition_pos');
    return { hStatic: { x: hStatic.x, y: hStatic.y }, hFaithful: { x: hFaithful.x, y: hFaithful.y }, end0: passEnds[0], cross, wall2Static: { x: wall2Static.x, y: wall2Static.y } };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  const near = (a, b, t = 0.05) => Math.abs(a - b) < t;
  // machine-faithful handle == passEnds[0] + cross (the same relocation the 3D/2D markers use)
  const expX = r.end0.x + r.cross.x, expY = r.end0.y + r.cross.y;
  expect(near(r.hFaithful.x, expX) && near(r.hFaithful.y, expY), `faithful handle at passEnds[0]+cross (${expX},${expY}), got (${r.hFaithful.x},${r.hFaithful.y})`).toBe(true);
  // and it is DISTINCT from the static (start-based) handle — the relocation actually moved it (Y by the probe drift)
  expect(Math.hypot(r.hFaithful.x - r.hStatic.x, r.hFaithful.y - r.hStatic.y), 'the faithful handle is relocated away from the static start-based handle').toBeGreaterThan(20);
  // no-passEnds still degrades to the static wall-2 (the graceful fallback the case above pins)
  expect(near(r.hStatic.x, r.wall2Static.x) && near(r.hStatic.y, r.wall2Static.y), 'without passEnds → the static start-based wall-2 (unchanged)').toBe(true);
});

// PART 2 confirm — the hollow sim-only ◇ renders on the Layout AND (post-fix) is now DISTINCT from the emitting reposition
// handle (they were coincident while the emitting handle was stuck at its anchor = pass-0, masking the ◇).
test('the Layout sim-only ◇ renders and is distinct from the (now correctly-placed) emitting reposition handle', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form [data-param]', { state: 'visible' });
  await page.waitForSelector('#userVizContainer_tree .fc-handle-sim', { timeout: 6000 });
  // t2631 — the feature canvas's ResizeObserver-driven viewBox is rAF-throttled (featureCanvas.js:122); the
  // element existing does not mean it has caught up to its settled container size yet (the tree pane-bodies'
  // own settling lag). A screen-PIXEL distance (unlike this file's other tests, which read world-space x/y
  // straight from layoutSpecFromOp) is sensitive to that race, so wait for it to settle before measuring.
  await page.waitForTimeout(600);

  const info = await page.evaluate(() => {
    const sim = document.querySelector('#userVizContainer_tree .fc-handle-sim');
    const move = document.querySelector('#userVizContainer_tree .fc-handle-move');
    const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 }; };
    return { sim: box(sim), move: box(move), hasBoth: !!sim && !!move };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(info.hasBoth, 'both the sim ◇ and the emitting reposition □ render on the Layout').toBe(true);
  // they are now at DIFFERENT screen positions (the ◇ at pass-0/wall-1, the emitting handle at wall-2) — the ◇ is no longer masked.
  const d = Math.hypot(info.sim.cx - info.move.cx, info.sim.cy - info.move.cy);
  expect(d, `the ◇ and the emitting handle are visibly separated (screen dist ${d.toFixed(0)}px)`).toBeGreaterThan(20);
});
