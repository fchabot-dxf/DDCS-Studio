import { test, expect } from '@playwright/test';

/**
 * sim-marker-track (t73) — two coupled preview fixes (both PREVIEW-ONLY, emit byte-parity untouched):
 *  PART 1: the reposition-DESTINATION sim markers CHAIN off their anchor by the SAME #21-#24 reposition defaults the emit
 *          uses (cornerReposOffsets, shared axesOf/opp/travelDist geometry) — so each marker sits where the tool ARRIVES,
 *          not a disconnected static stock-fraction. Was: wall1 (20,-50) ~15u off its zsurf anchor; now zsurf + (0,-50).
 *  PART 2: the sim-only first-start handle also renders on the Layout FeatureCanvas (a HOLLOW ◇) as a SECOND writer of the
 *          same createPreviewPanel.userStarts seam — a drag there writes userStarts (never emitted).
 */

test.use({ viewport: { width: 1400, height: 1000 } });

// (1) PART 1 — the markers track their anchor by the JS-evaluated reposition, combo-correct. INDEPENDENT truth: the deltas
//     are HAND-derived from the geometry (dirsOf/axesOf/own/opp, td=50), NOT read back from cornerReposOffsets (no tautology).
test('(1) sim markers chain off their anchor by the reposition — both probeZ states, FL/YX + BR/XY (independent truth)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsInteractive === '1');
  const r = await page.evaluate(async () => {
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    registerUserOp(cornerDataDef());
    const stock = { x: 100, y: 80, z: 20 };
    const S = (o) => ({ ...CORNER_DEFAULTS, ...o, travelDist: 50 });
    const marks = (o) => (opSimStarts(CORNER_DATA_OPTYPE, S(o), stock) || []).map((m) => ({ x: +(+m.x).toFixed(3), y: +(+m.y).toFixed(3) }));
    return {
      offFL: marks({ probeZFirst: false, corner: 'FL', probeSeq: 'YX' }),
      onFL: marks({ probeZFirst: true, corner: 'FL', probeSeq: 'YX' }),
      onBRXY: marks({ probeZFirst: true, corner: 'BR', probeSeq: 'XY' }),
    };
  });
  const near = (a, b, t = 0.02) => Math.abs(a - b) < t;
  const at = (m, x, y, msg) => expect(near(m.x, x) && near(m.y, y), `${msg} — expected (${x},${y}), got (${m.x},${m.y})`).toBe(true);

  // Z-OFF FL/YX (2 passes): wall1 = zsurf-frac(7,7) + start(0,-50) = (7,-43) — the SAME physical point as Z-on (the #23/#24
  //                          anchor invariant: wall-1 is one wall regardless of Z-first); wall2 = wall1 + cross(-50,+50) = (-43,7).
  expect(r.offFL.length).toBe(2);
  at(r.offFL[0], 7, -43, 'Z-off wall1 chains off the zsurf-frac anchor (SAME point as Z-on)');
  at(r.offFL[1], -43, 7, 'Z-off wall2 = wall1 + (-50,+50)');
  // Z-ON FL/YX (3 passes): zsurf=(7,7); wall1 = zsurf + start(0,-50) = (7,-43); wall2 = wall1 + cross(-50,+50) = (-43,7).
  expect(r.onFL.length).toBe(3);
  at(r.onFL[0], 7, 7, 'Z-on zsurf frac lead');
  at(r.onFL[1], 7, -43, 'Z-on wall1 = zsurf + (0,-50) — TRACKS zsurf (X aligned), not the old disconnected (20,-50)');
  at(r.onFL[2], -43, 7, 'Z-on wall2 = wall1 + (-50,+50)');
  // Z-ON BR/XY (combo — advisor: not just FL/YX). PREFILL FIX (t109): the zsurf frac anchor now FLIPS to the BR corner
  // (dirsOf(BR)=[-,-] → base = (sx-7, sy-7) = (93,73)), so the whole chain sits at the RIGHT corner (was canonical-FL (7,7)
  // → the sim probe fired into empty space). XY → fA=X,fD=- → start(+50,0); #23=own(-)=-50,#24=opp(-)=+50 → cross(-50,+50).
  // zsurf=(93,73); wall1 = zsurf + (+50,0) = (143,73) (outside the x=100 wall); wall2 = wall1 + (-50,+50) = (93,123) (outside y=80).
  expect(r.onBRXY.length).toBe(3);
  at(r.onBRXY[0], 93, 73, 'BR/XY zsurf FLIPS to the BR corner (base sx-7,sy-7), NOT canonical-FL (7,7)');
  at(r.onBRXY[1], 143, 73, 'BR/XY wall1 = zsurf + (+50,0) — outside the x=100 wall');
  at(r.onBRXY[2], 93, 123, 'BR/XY wall2 = wall1 + (-50,+50) — outside the y=80 wall');

  // marker-to-anchor PROXIMITY (the advisor's live check): under Z-first, wall1 sits exactly travelDist(50) from zsurf via
  // the reposition — NOT the old ~58u disconnected jump.
  const d = Math.hypot(r.onFL[1].x - r.onFL[0].x, r.onFL[1].y - r.onFL[0].y);
  expect(Math.abs(d - 50) < 0.02, `wall1 is exactly the reposition distance (50) from zsurf, got ${d.toFixed(2)}`).toBe(true);
});

// (2) PART 1 — the chaining is PREVIEW-ONLY: the hoist (dirsOf/axesOf → module scope) + the provider never change the emit.
test('(2) emit byte-parity: marker chaining + geometry hoist never touch the G-code (across combos + probeZ)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsInteractive === '1');
  const passes = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitEquivalence, stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    registerUserOp(cornerDataDef());
    const build = builderOf(CORNER_DATA_OPTYPE);
    const S = (o) => ({ ...CORNER_DEFAULTS, ...o });
    const combos = [{}, { probeZFirst: true }, { corner: 'BR', probeSeq: 'XY' }, { corner: 'FR', probeSeq: 'XY', probeZFirst: true }];
    return combos.map((c) => emitEquivalence(cornerStack, build, [S(c)], {}, stripAnnotations).pass);
  });
  expect(passes.every(Boolean), 'twin emit == cornerStack across all combos (hoist is byte-safe; marker math is preview-only)').toBe(true);
});

// (3) PART 2 — the sim-only start handle renders on the Layout FeatureCanvas as a HOLLOW circle ○ (t81; distinct from the filled emitting handles).
test('(3) Layout canvas: the Start marker is a filled AMBER circle (second renderer of the userStarts seam)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsInteractive === '1');
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });
  await page.waitForSelector('#userVizContainer .fc-handle-sim', { timeout: 6000 });
  const info = await page.evaluate(() => {
    const h = document.querySelector('#userVizContainer .fc-handle-sim');
    const move = document.querySelector('#userVizContainer .fc-handle-move');   // an emitting handle (filled)
    // t89 — read the COMPUTED colour (fill/stroke are now set via INLINE STYLE so they beat the .fc-handle class rule; the
    // old getAttribute check saw the right value while the class silently overrode the paint). Computed cyan #22d3ee = rgb(34, 211, 238).
    const cs = h && getComputedStyle(h);
    return { present: !!h, tag: h && h.tagName.toLowerCase(), fill: cs && cs.fill, stroke: cs && cs.stroke, hasEmitting: !!move };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
  expect(info.present, 'the Start handle renders on the Layout canvas').toBe(true);
  expect(info.tag, 'drawn as a CIRCLE (t293 — the manual-jog shape, distinct from the auto square)').toBe('circle');
  // t293 — the Start is the operator's manual jog → a FILLED AMBER circle (was hollow cyan)
  expect(info.fill, 'FILLED amber (the manual Start)').toBe('rgb(255, 179, 0)');
  expect(info.stroke, 'amber stroke — the manual-jog colour').toBe('rgb(255, 179, 0)');
});

// (4) PART 2 — the EMITTING reposition handle owns its OWN drag (writes cross1_x): it sits at its destination (wall-2), clear
//     of the now-draggable sim ◇ (at pass-0), so dragging it grabs the emitting handle — the ◇ doesn't steal a separated hit.
//     (t87: the sim ◇ is itself draggable now — covered by corner-layout-sim-drag; here we just guard the emitting handle.)
test('(4) the emitting reposition handle owns its own drag (writes cross1_x); the separated sim ◇ does not steal it', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => document.documentElement.dataset.ddcsInteractive === '1');
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });
  await page.waitForSelector('#userVizContainer .fc-handle-sim', { timeout: 6000 });   // the sim marker renders (visual)

  const cx = () => page.evaluate(() => document.querySelector('#wiz_user_form [data-param="cross1_x"]').value);
  const before = await cx();
  // dragging the EMITTING reposition handle writes cross1_x; the visual ◇ (excluded from the hit-test) never steals it.
  const handle = page.locator('#userVizContainer .fc-handle-move').first();
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 80, hb.y + 55, { steps: 12 });
  await page.mouse.up();
  await expect.poll(cx, { timeout: 4000 }).not.toBe(before);
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
