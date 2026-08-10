import { test, expect } from '@playwright/test';

/**
 * sim-marker-distinguish (t69) — a per-pass-start `emits` flag gives EMITTING markers (a drag writes a macro var into the
 * emitted program, corner #21-#24) a DISTINCT SHAPE from SIM-ONLY jog-preview markers (never emitted), ON A NEW AXIS
 * ORTHOGONAL to the existing auto/manual COLOUR: 2D → FILLED ◆ vs HOLLOW ◇; 3D → filled vs hollow sprite. Declared per
 * CORNER_SIM_STARTS row; the FIRST surviving pass is always the operator's manual start (sim-only) so `emits` bites from
 * pass 2 on. Pure SIM/viz change — the emit path never sees the flag (byte-parity preserved).
 *
 * Hardened: (A) the emits DATA per pass vs an INDEPENDENT truth table, BOTH probeZFirst states, index-aligned; (B) the flag
 * threads end-to-end to the shared passStarts BOTH renderers consume (real wizard); (C) the REAL 2D visual symptom — the
 * emitting marker paints a FILLED centre, the sim-only one a HOLLOW centre, same colour; (D) edge/middle unchanged;
 * (E) emit byte-parity (the flag never leaks into the G-code).
 */

test.use({ viewport: { width: 1400, height: 1000 } });

// (A) THE DATA — opSimStarts tags each pass with emits. Independent truth from the LOCKED handle model (NOT read back from
//     the impl): OFF = [wall1, wall2] → the operator jogs to wall1 (sim-only), wall2 is the #23/#24 reposition (emits).
//     ON = [zsurf, wall1, wall2] → the operator jogs to zsurf (sim-only); wall1 emits #21/#22; wall2 emits #23/#24.
test('(A) emits per pass: first pass sim-only, reposition destinations emit — both probeZFirst states, index-aligned', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    registerUserOp(cornerDataDef());
    const stock = { x: 100, y: 80, z: 20 };
    const S = (o) => ({ ...CORNER_DEFAULTS, ...o });
    const off = opSimStarts(CORNER_DATA_OPTYPE, S({ probeZFirst: false }), stock) || [];
    const on = opSimStarts(CORNER_DATA_OPTYPE, S({ probeZFirst: true }), stock) || [];
    return { off: off.map((s) => !!s.emits), on: on.map((s) => !!s.emits) };
  });
  // OFF: 2 passes — [sim-only lead, emitting wall-2].
  expect(r.off, 'probeZFirst OFF → 2 passes: wall-1 is the operator jog (sim-only), wall-2 emits #23/#24').toEqual([false, true]);
  // ON: 3 passes — [sim-only zsurf lead, emitting wall-1 #21/#22, emitting wall-2 #23/#24].
  expect(r.on, 'probeZFirst ON → 3 passes: zsurf jog (sim-only), wall-1 emits #21/#22, wall-2 emits #23/#24').toEqual([false, true, true]);
});

// (B) END-TO-END — the flag threads opSimStarts → computePassStarts → the shared passStarts that BOTH the 2D and 3D
//     renderers read, in the REAL wizard preview. First pass always sim-only; the last (wall-2) always emits; the 3D viz
//     receives the same shape array. (State-agnostic invariants so this holds whatever the default probeZFirst is.)
test('(B) end-to-end: the emits flag reaches the shared passStarts + the 3D renderer in the live wizard preview', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
  await page.evaluate(async () => {
    const U = await import('/blocks/userOps.js');
    const CD = await import('/blocks/dataOps/cornerData.js');
    localStorage.removeItem('ddcs_user_ops');
    U.createUserOp(CD.cornerDataDef());
  });
  await page.evaluate(() => window.openWiz('user_corner_data'));
  await page.waitForSelector('#wiz_user_form input[type="number"]', { state: 'visible' });

  const r = await page.evaluate(() => {
    const c = document.getElementById('userViz3dContainer');
    const host = c && c.parentElement && c.parentElement.querySelector('.wiz-viz3d');
    const panel = host && host.__panel;
    if (!panel || typeof panel.getPassStarts !== 'function') return { wired: false };
    const passEmits = (panel.getPassStarts() || []).map((s) => !!s.emits);
    const vizEmits = panel.viz && Array.isArray(panel.viz._startEmits) ? panel.viz._startEmits.slice() : null;
    return { wired: true, passEmits, vizEmits };
  });
  await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));

  expect(r.wired, 'the wizard preview exposes getPassStarts + viz').toBe(true);
  expect(r.passEmits.length, 'sanity: the multi-pass corner has ≥2 start markers').toBeGreaterThanOrEqual(2);
  expect(r.passEmits[0], 'the FIRST pass-start is the operator jog — always sim-only').toBe(false);
  expect(r.passEmits[r.passEmits.length - 1], 'the LAST pass-start (wall-2 reposition #23/#24) always emits').toBe(true);
  expect(r.vizEmits, 'the 3D renderer received the SAME per-pass shape array (setStartEmits wired)').toEqual(r.passEmits);
});

// (C) THE REAL 2D VISUAL SYMPTOM — an EMITTING marker paints a FILLED centre; a SIM-ONLY marker's centre is HOLLOW. Same
//     colour (cyan, auto) both — the SHAPE is the new axis. Rendered on a real (sized) canvas; sampled at the marker's own
//     drawn coords (__t2starts), so it's view-agnostic and deterministic (static paint, no animation).
test('(C) 2D visual: the marker COLOUR follows the SOURCE (decoupled from emits) — a later pass flips cyan↔amber by travel', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const px = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    // render pass-1 (a reposition) with emits held TRUE; vary only the SOURCE → the colour must follow the source.
    const render = (src1) => {
      const canvas = document.createElement('canvas'); canvas.style.width = '240px'; canvas.style.height = '200px';
      document.body.appendChild(canvas);
      const t2 = createToolpath2d(canvas);
      t2.setStock({ x: 100, y: 80, z: 20 });
      t2.setStarts([{ x: 30, y: 40, z: 0 }, { x: 70, y: 40, z: 0 }]);
      t2.setStartSources(['auto', src1]); t2.setStartEmits([false, true]);   // emits HELD true on pass 1; only the source varies
      t2.fit();
      const rec = canvas.__t2starts; if (!rec || rec.length < 2) return { ok: false };
      const dpr = window.devicePixelRatio || 1; const ctx = canvas.getContext('2d');
      const d = ctx.getImageData(Math.round(rec[1].sx * dpr), Math.round(rec[1].sy * dpr), 1, 1).data;
      canvas.remove(); return { ok: true, r: d[0], g: d[1], b: d[2] };
    };
    return { auto: render('auto'), manual: render('manual') };
  });
  expect(px.auto.ok && px.manual.ok, 'both painted').toBe(true);
  // emits was TRUE in both renders → the colour is driven by SOURCE, not emits: auto = cyan (blue), manual = amber (red+green)
  expect(px.auto.b, 'auto source → cyan (blue high)').toBeGreaterThan(150);
  expect(px.auto.b, 'cyan: blue > red').toBeGreaterThan(px.auto.r);
  expect(px.manual.r > px.manual.b && px.manual.g > px.manual.b, 'manual source → amber (despite emits=true)').toBe(true);
});

// (C2) t1684 (census finding 2) — the docstring above this file has promised "FILLED vs HOLLOW" since t69, but until now
//     nothing ever sampled the CENTRE ALPHA to prove it: drawStartHandles never read startEmits at all (a second instance
//     of the SAME declared-but-unread defect the census exists to end, this time in a TEST's own unchecked claim). Same
//     colour (auto/cyan) both passes — only emits varies: pass-1 centre alpha must actually differ hollow vs filled.
test('(C2) 2D visual: a LATER pass emits:false paints a HOLLOW centre; emits:true paints FILLED — same colour, shape is the axis', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const px = await page.evaluate(async () => {
    const { createToolpath2d } = await import('/viz/toolpath2d.js');
    const render = (emits1) => {
      const canvas = document.createElement('canvas'); canvas.style.width = '240px'; canvas.style.height = '200px';
      document.body.appendChild(canvas);
      const t2 = createToolpath2d(canvas);
      t2.setStock({ x: 100, y: 80, z: 20 });
      t2.setStarts([{ x: 30, y: 40, z: 0 }, { x: 70, y: 40, z: 0 }]);
      t2.setStartSources(['auto', 'auto']); t2.setStartEmits([false, emits1]);   // colour held constant (both auto/cyan); only pass-1's emits varies
      t2.fit();
      const rec = canvas.__t2starts; if (!rec || rec.length < 2) return { ok: false };
      const dpr = window.devicePixelRatio || 1; const ctx = canvas.getContext('2d');
      const d = ctx.getImageData(Math.round(rec[1].sx * dpr), Math.round(rec[1].sy * dpr), 1, 1).data;
      canvas.remove(); return { ok: true, a: d[3] };
    };
    return { filled: render(true), hollow: render(false) };
  });
  expect(px.filled.ok && px.hollow.ok, 'both painted').toBe(true);
  expect(px.filled.a, 'emits:true pass-1 centre is FILLED (opaque)').toBeGreaterThan(150);
  expect(px.hollow.a, 'emits:false pass-1 centre is HOLLOW (the stroke-only ring leaves the centre transparent)').toBeLessThan(150);
});

// (D) BACKWARD-COMPAT — the built-in multi-pass ops (middle/alignment) declare no `emits` → every pass stays sim-only, so
//     their markers render exactly as before (all hollow). No visual regression for edge/middle.
test('(D) backward-compat: built-in middle/alignment start markers stay sim-only (all emits false)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { opSimStarts } = await import('/viz/opSimStarts.js');
    const mid = opSimStarts('middle', { featureType: 'boss', twoAxis: true, inAxis: 'manual', dist: 20 }, { x: 100, y: 80, z: 20 }) || [];
    const ali = opSimStarts('alignment', { checkAxis: 'X' }, { x: 150, y: 100, z: 25 }) || [];
    return { mid: mid.map((s) => !!s.emits), ali: ali.map((s) => !!s.emits), midLen: mid.length, aliLen: ali.length };
  });
  expect(r.midLen, 'sanity: middle boss-both is multi-pass').toBeGreaterThan(1);
  expect(r.mid.every((e) => e === false), 'every middle pass stays sim-only (unchanged)').toBe(true);
  expect(r.ali.every((e) => e === false), 'every alignment pass stays sim-only (unchanged)').toBe(true);
});

// (E) EMIT BYTE-PARITY — the emits flag is SIM-ONLY: the twin's emitted G-code stays byte-identical to cornerStack (both
//     probeZFirst states) and the word "emits" never appears in the program. Proves the change never touched the emit path.
test('(E) emit byte-parity: the emits flag is sim-only — no G-code change, no leak', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { cornerStack } = await import('/wizards/cornerWizard.js');
    const { cornerDataDef, CORNER_DEFAULTS, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitEquivalence, stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    registerUserOp(cornerDataDef());
    const build = builderOf(CORNER_DATA_OPTYPE);
    const S = (o) => ({ ...CORNER_DEFAULTS, ...o });
    const off = emitEquivalence(cornerStack, build, [S({ probeZFirst: false })], {}, stripAnnotations).pass;
    const on = emitEquivalence(cornerStack, build, [S({ probeZFirst: true })], {}, stripAnnotations).pass;
    return { off, on, gcode: build(S({ probeZFirst: true })) };
  });
  expect(r.off, 'probeZFirst OFF: twin emit == cornerStack byte-for-byte').toBe(true);
  expect(r.on, 'probeZFirst ON: twin emit == cornerStack byte-for-byte').toBe(true);
  expect(/emits/i.test(r.gcode), 'the sim-only emits flag never leaks into the emitted G-code').toBe(false);
});
