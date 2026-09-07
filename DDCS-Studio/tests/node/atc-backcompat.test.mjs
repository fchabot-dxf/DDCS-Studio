import { test, expect } from './support/harness.mjs';

// INC-D — BACK-COMPAT migrate-on-rebuild + round-trip stability for atc_change markers. These pin the FINAL emit at
// the FILE level: an old/legacy marker rebuilds to the T# M6 call (gentle migrate), a T# M6 region is byte-stable
// across reload, the inline region regenerates from LIVE settings (the 4b property at file scope), and stray/stale
// marker keys load BENIGNLY (the emit ignores them). Assertions are vs INDEPENDENT truth (the expected lines / live
// settings). NOTE (t255 finding, see WORK-LOG): the marker codec does NOT normalize params on rebuild, so the
// "rewritten marker carries callMacro / drops stray keys" clauses of the dispatch are DEFERRED pending an advisor
// ruling on marker normalization (a codec change with a forward-compat tradeoff). These tests are ruling-AGNOSTIC —
// they assert the emit/load behavior, not marker cleanliness.
test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsStudio && window.ddcsGetSettings);
});

// (1) OLD-marker + LEGACY-op load → gentle migrate-on-rebuild: no callMacro key → defaults TRUE → the T# M6 call.
test('INC-D (1): old/legacy atc_change markers rebuild to the T# M6 call (migrate-on-rebuild)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { parseMarker } = await import('/blocks/opSchema.js');
    const { opFromMarker } = await import('/blocks/programModel.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const rebuild = (json) => {
      const rec = parseMarker('( @DDCS:1 ' + json + ' )');
      const op = opFromMarker(rec.opType, rec.params);
      return emitMapped(op.children || [op]).text;
    };
    return {
      oldGeneric: rebuild('{"op":"atc_change","method":"generic","fixedT":2}'),    // pre-INC-B: no callMacro key
      oldFirmware: rebuild('{"op":"atc_change","method":"firmware","fixedT":3}'),
      legacyAuto: rebuild('{"op":"atc_change","mode":"auto","fixedT":4}'),          // legacy: mode/no method → generic
      legacyDisk: rebuild('{"op":"atc_change","mode":"auto","magType":"disk","fixedT":5}'),  // legacy → disk
    };
  });
  // a pre-INC-B marker (callMacro undefined → TRUE) rebuilds as the DEFAULT T# M6 call + the install note, target follows fixedT
  expect(r.oldGeneric, 'old generic → T2 M6 call').toMatch(/^T2 M6$/m);
  expect(r.oldGeneric, 'carries the install note').toContain('call the installed T.nc macro');
  expect(r.oldGeneric, 'is NOT the inline body').not.toContain('#1504');
  expect(r.oldFirmware, 'old firmware → T3 M6 call').toMatch(/^T3 M6$/m);
  // a LEGACY pre-method op (mode/magType via the resolveMethod back-compat map) migrates the SAME way
  expect(r.legacyAuto, 'legacy mode:auto → generic → T4 M6').toMatch(/^T4 M6$/m);
  expect(r.legacyDisk, 'legacy mode:auto+disk → disk → T5 M6').toMatch(/^T5 M6$/m);
});

// (2) Round-trip stability: the T# M6 region is byte-identical across serialize→parse→rebuild (settings-independent);
// the INLINE region regenerates from LIVE settings (a settings change flows on the next rebuild — 4b at file level).
test('INC-D (2): T# M6 region byte-identical on rebuild; the inline region follows LIVE settings', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { parseMarker, markerLine } = await import('/blocks/opSchema.js');
    const { opFromMarker } = await import('/blocks/programModel.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const s = window.ddcsGetSettings();
    s.atc = { magazine: [{ pocket: 1, tool: 1, x: 10, y: 0, z: -5 }] };
    s.outputs = [{ type: 'drawbar', onCode: 'M54', offCode: 'M55' }]; s.inputs = [];
    // a full serialize → parse → rebuild → emit cycle
    const cycle = (params) => {
      const op1 = opFromMarker('atc_change', parseMarker(markerLine('atc_change', params)).params);
      const emit1 = emitMapped(op1.children || [op1]).text;
      const op2 = opFromMarker('atc_change', parseMarker(markerLine('atc_change', op1.params)).params);
      const emit2 = emitMapped(op2.children || [op2]).text;
      return { emit1, emit2 };
    };
    const t6 = cycle({ method: 'generic', fixedT: 2, callMacro: true });
    const inlineOld = cycle({ method: 'generic', callMacro: false }).emit1;   // reads M54 (live)
    s.outputs = [{ type: 'drawbar', onCode: 'M56', offCode: 'M55' }];         // the user changes their drawbar code…
    const inlineNew = cycle({ method: 'generic', callMacro: false }).emit1;   // …the NEXT rebuild follows it
    return { t6, inlineOld, inlineNew };
  });
  expect(r.t6.emit1, 'the T# M6 region is byte-identical across a reload cycle (settings-independent)').toBe(r.t6.emit2);
  expect(r.t6.emit1, 'and is the T2 M6 call').toMatch(/^T2 M6$/m);
  expect(r.inlineOld, 'the inline region regenerates from LIVE settings (M54)').toContain('M54');
  expect(r.inlineNew, 'a settings change flows on the next rebuild (M56) — codes follow settings, not file text').toContain('M56');
  expect(r.inlineNew, 'the stale M54 is gone').not.toContain('M54');
});

// (3) Unknown/stale marker keys are BENIGN: a 4a-era _atc snapshot + a hypothetical future field load without
// breaking; parseMarker rehydrates them, and the emit IGNORES them (it reads LIVE settings, not the stale snapshot).
test('INC-D (3): stray/stale marker keys load benignly; the emit uses LIVE settings, not the snapshot', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { parseMarker } = await import('/blocks/opSchema.js');
    const { opFromMarker } = await import('/blocks/programModel.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const s = window.ddcsGetSettings();
    s.atc = { magazine: [{ pocket: 1, tool: 7, x: 1, y: 2, z: 3 }] };   // LIVE: tool 7
    s.outputs = [{ type: 'drawbar', onCode: 'M54', offCode: 'M55' }]; s.inputs = [];
    // a 4a-era marker with a STALE _atc snapshot (tool 99) + a hypothetical future key
    const line = '( @DDCS:1 {"op":"atc_change","method":"generic","callMacro":false,"_atc":{"magazine":[{"pocket":1,"tool":99}]},"_futureField":42} )';
    let err = null, emit = '', params = null;
    try { const rec = parseMarker(line); params = rec.params; const op = opFromMarker(rec.opType, rec.params); emit = emitMapped(op.children || [op]).text; } catch (e) { err = String(e && e.message || e); }
    return { err, emit, rehydrated: params && (params._atc != null && params._futureField === 42) };
  });
  expect(r.err, 'stray keys load without breaking').toBeNull();
  expect(r.rehydrated, 'parseMarker rehydrates the stray keys (benign)').toBe(true);
  // the emit IGNORES the stale _atc snapshot — it fetches T7 (LIVE settings), never T99 (the stale snapshot tool)
  expect(r.emit, 'the inline body uses LIVE settings (tool 7)').toContain('T7');
  expect(r.emit, 'it does NOT use the stale _atc snapshot tool (99)').not.toContain('T99');
});
