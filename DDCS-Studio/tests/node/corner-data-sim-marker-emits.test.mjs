import { test, expect } from './support/harness.mjs';

/**
 * sim-marker-distinguish (t69) — a per-pass-start `emits` flag gives EMITTING markers (a drag writes a macro var into the
 * emitted program, corner #21-#24) a DISTINCT SHAPE from SIM-ONLY jog-preview markers (never emitted), ON A NEW AXIS
 * ORTHOGONAL to the existing auto/manual COLOUR: 2D → FILLED ◆ vs HOLLOW ◇; 3D → filled vs hollow sprite. Declared per
 * CORNER_SIM_STARTS row; the FIRST surviving pass is always the operator's manual start (sim-only) so `emits` bites from
 * pass 2 on. Pure SIM/viz change — the emit path never sees the flag (byte-parity preserved).
 *
 * TIER MIGRATION (batch 12 straggler sweep): split out of tests/corner-data-sim-marker-emits.spec.js. Tests (A), (D)
 * and (E) below are pure data/emit checks with zero DOM; (B) end-to-end wizard wiring, (C)/(C2) real canvas
 * getImageData sampling, and (F) cross-pane Layout DOM all stay in
 * tests/corner-data-sim-marker-emits-drive.spec.js.
 */

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
