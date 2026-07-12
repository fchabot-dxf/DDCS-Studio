import { test, expect } from '@playwright/test';

/**
 * t778 Phase 2b — THE TAPPING DATA-TWIN. tapData.js emits byte-equal to tapStack; the pitch-locked feed is shown
 * read-only (statusHint, live); the RIGID toggle grey-gates on a declared encoder/servo spindle (spindle.tapCapable) AND
 * the Expert post; a non-reversible spindle warns; the emit honestly degrades rigid → floating off-Expert. The twin
 * round-trips (params via the op marker) and inherits the tool picker (toolBindingsFor).
 */
test.use({ viewport: { width: 1200, height: 860 } });

test('the tap twin builds + emits BYTE-EQUAL to tapStack across a sweep; pitch is a threadpick + tool picker inherited', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { tapStack } = await import('/wizards/tapWizard.js');
    const { tapDataDef, TAP_DATA_OPTYPE, TAP_DEFAULTS } = await import('/blocks/dataOps/tapData.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const def = tapDataDef(); registerUserOp(def);
    const build = builderOf(TAP_DATA_OPTYPE);
    const S = (o) => ({ ...TAP_DEFAULTS, ...o });
    const sweep = [S({}), S({ pitch: 1.25, depth: 16, rpm: 500 }), S({ pitch: 25.4 / 20, x: 5, y: 8 }), S({ originX: 10, originY: 5, depth: 8 }), S({ dwell: 0.5 })];
    let pass = true, firstDiff = null;
    for (const p of sweep) { const a = emitMapped(tapStack(p)).text, b = emitMapped(build(p)).text; if (a !== b) { pass = false; firstDiff = { a: a.slice(0, 500), b: b.slice(0, 500) }; break; } }
    const binds = def.bindings || [];
    return { pass, firstDiff, threadpick: binds.some((x) => x.param === 'pitch' && x.widget === 'threadpick'), toolpick: binds.some((x) => x.param === 'toolNum' && x.widget === 'toolpick') };
  });
  if (!r.pass) console.log('BYTE DIFF', JSON.stringify(r.firstDiff));
  expect(r.threadpick, 'pitch renders as the thread-preset picker').toBe(true);
  expect(r.toolpick, 'the tap inherits the shared tool picker (tap-tool + tool-change tie-in)').toBe(true);
  expect(r.pass, 'twin == tapStack byte-for-byte across the sweep').toBe(true);
});

test('the derived pitch-locked feed shows read-only via statusHint: M6×1.0@400 → 400; 1/4-20@400 → 508', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { tapDataDef } = await import('/blocks/dataOps/tapData.js');
    const s = window.ddcsGetSettings(); s.spindle = s.spindle || {}; s.spindle.reversible = true;
    const hint = tapDataDef().statusHint;
    return { metric: hint({ rpm: 400, pitch: 1.0 }), imperial: hint({ rpm: 400, pitch: 25.4 / 20 }) };
  });
  expect(r.metric, 'M6×1.0 @ 400 → feed 400 mm/min').toMatch(/feed 400 mm\/min/);
  expect(r.imperial, '1/4-20 @ 400 → feed 508 mm/min').toMatch(/feed 508 mm\/min/);
});

test('a NON-reversible declared spindle warns in the status (the plain why); reversible → no warning', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetSettings);
  const r = await page.evaluate(async () => {
    const { tapDataDef } = await import('/blocks/dataOps/tapData.js');
    const hint = tapDataDef().statusHint;
    const s = window.ddcsGetSettings(); s.spindle = s.spindle || {};
    s.spindle.reversible = false; const warn = hint({ rpm: 400, pitch: 1.0, rigid: false });
    s.spindle.reversible = true; const ok = hint({ rpm: 400, pitch: 1.0, rigid: false });
    return { warn, ok };
  });
  expect(r.warn, 'non-reversible → the M4-cannot-back-out warning').toMatch(/non-reversible|back out/i);
  expect(r.ok, 'reversible → no warning').not.toMatch(/non-reversible/i);
});

test('the RIGID toggle is gated on _rigidOk (spindle.tapCapable AND Expert); the emit degrades rigid→floating off-Expert', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { tapDataDef } = await import('/blocks/dataOps/tapData.js');
    const { tapStack } = await import('/wizards/tapWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { DIALECTS } = await import('/wizards/dialects/index.js');
    const rigidBind = (tapDataDef().bindings || []).find((b) => b.param === 'rigid');
    const expert = emitMapped(tapStack({ rigid: true, depth: 10, pitch: 1.0 }), { dialect: DIALECTS['ddcs-expert-m350'] }).text;
    const grbl = emitMapped(tapStack({ rigid: true, depth: 10, pitch: 1.0 }), { dialect: DIALECTS['grbl'] }).text;
    return { gated: !!(rigidBind && rigidBind.gate && rigidBind.gate.param === '_rigidOk'), expertG84: /G84/.test(expert), grblG84: /G84/.test(grbl), grblFloat: /M4 S/.test(grbl) };
  });
  expect(r.gated, 'rigid is grey-gated on _rigidOk (tapCapable AND Expert)').toBe(true);
  expect(r.expertG84, 'Expert + rigid → the G84 cycle').toBe(true);
  expect(r.grblG84, 'a non-Expert post never emits G84').toBe(false);
  expect(r.grblFloat, 'off-Expert, rigid honestly degrades to the floating cycle').toBe(true);
});

test('the twin round-trips its params through the op marker (pitch/rpm/depth/rigid survive reload)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);
  const r = await page.evaluate(async () => {
    const { TAP_DATA_OPTYPE } = await import('/blocks/dataOps/tapData.js');
    const { markerLine, parseMarker } = await import('/blocks/opSchema.js');
    const back = parseMarker(markerLine(TAP_DATA_OPTYPE, { pitch: 1.25, rpm: 500, depth: 16, rigid: true, x: 5, y: 8 }));
    return back && back.params;
  });
  expect(Number(r.pitch)).toBe(1.25);
  expect(Number(r.rpm)).toBe(500);
  expect(Number(r.depth)).toBe(16);
  expect(r.rigid).toBe(true);
});
