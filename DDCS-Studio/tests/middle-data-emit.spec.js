import { test, expect } from '@playwright/test';

/**
 * MIDDLE PORT E1 — the middle built-in expressed as a DATA def (blocks/dataOps/middleData.js) emits G-code BYTE-IDENTICAL
 * to the hand-coded middleStack across (1) the FULL structural sweep (all 896 combos of the 8 structural params, at default
 * scalars) and (2) a SCALAR sweep (each bound #var varied at shapes where its socket is present). The data builder is an
 * INDEPENDENT path (builderOf → instantiate over the pruned superset + bindingSpecs re-derived BY IDENTITY), so reproducing
 * middleStack byte-for-byte IS the pilot payoff. Wiring: every binding routes its param to the SAME assign var the built-in
 * writes (sentinel injection). axis/dir stay baked (E1 scope); the byte-test holds axis/dir at defaults on BOTH sides.
 */
test('middle-data-emit: data-op == built-in middleStack byte-identical across the structural + scalar sweep + derived wiring', async ({ page }) => {
  test.setTimeout(120000);   // the 896-combo structural sweep runs both builders + emits per combo
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { middleDataDef, MIDDLE_DEFAULTS, MIDDLE_DATA_OPTYPE, MIDDLE_BINDINGS, MIDDLE_BINDING_SPECS, MIDDLE_STRUCT_BINDINGS } = await import('/blocks/dataOps/middleData.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf, BUILDERS } = await import('/blocks/opBuilders.js');
    const { SCHEMA } = await import('/blocks/opSchema.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    registerUserOp(middleDataDef());
    const dataBuilder = builderOf(MIDDLE_DATA_OPTYPE);   // === instantiate(def, …): an INDEPENDENT path from middleStack

    // diagnostic: do probe SOURCES resolve in this env? (they must NOT, or the data-op would source #5/#3/#2 while the
    // built-in emits literals — see the middleData header NOTE). Studio profile → {} → applyProbeSources is a no-op.
    const srcResolved = (typeof window.ddcsResolveProbeSources === 'function') ? window.ddcsResolveProbeSources(['port', 'fastFeed', 'retract']) : {};
    const sourcesActive = !!(srcResolved && Object.keys(srcResolved).length);

    // ── (1) FULL STRUCTURAL sweep — all 1792 combos, at default scalars; full-byte (KIND-B text prunes to the same bytes) ──
    const FEATS = ['pocket', 'boss'], MODES = ['auto', 'manual'], BOOLS = [false, true];
    const WCSV = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'], SHAPES = ['dogleg', 'diagonal'];
    const structSweep = [];
    for (const featureType of FEATS)
      for (const inAxis of MODES)
        for (const transAxis of MODES)
          for (const travelShape of SHAPES)
            for (const twoAxis of BOOLS)
              for (const circular of BOOLS)
                for (const probeZ of BOOLS)
                  for (const wcs of WCSV)
                    for (const syncA of BOOLS)
                      structSweep.push({ featureType, inAxis, transAxis, travelShape, twoAxis, circular, probeZ, wcs, syncA });
    const structRes = emitEquivalence(middleStack, dataBuilder, structSweep, {});

    // ── (2) SCALAR sweep — vary each bound #var; #19..#22 need boss+twoAxis+auto so their sockets are present ──
    const bossFull = { featureType: 'boss', inAxis: 'auto', transAxis: 'auto', twoAxis: true, circular: false, probeZ: false, wcs: 'active', syncA: false };
    const pocket = { featureType: 'pocket', inAxis: 'auto', transAxis: 'auto', twoAxis: false, circular: false, probeZ: false, wcs: 'active', syncA: false };
    const scalarSweep = [
      { ...pocket }, { ...pocket, dist: 100 }, { ...pocket, retract: 5 }, { ...pocket, f_fast: 250, f_slow: 40 },
      { ...pocket, port: 5 }, { ...pocket, radius: 3 }, { ...pocket, safeZ: 25 }, { ...pocket, clearOver: 30 },
      { ...bossFull }, { ...bossFull, crossX: 60 }, { ...bossFull, crossY: 70 }, { ...bossFull, crossX: 55, crossY: 65 },
      { ...bossFull, diagTravel: 40 }, { ...bossFull, diagPrimary: '#56' },
      { ...bossFull, dist: 120, retract: 6, f_fast: 220, f_slow: 45, port: 4, radius: 2.5, safeZ: 18, clearOver: 22, crossX: 58, crossY: 62, diagTravel: 44 },
      { ...bossFull, probeZ: true, wcs: 'G55', circular: true }, { ...pocket, probeZ: true, circular: true }, { ...bossFull, syncA: true },
    ];
    const scalarRes = emitEquivalence(middleStack, dataBuilder, scalarSweep, {});

    // ── (3) WIRING — every binding routes its param to the SAME assign var the built-in writes (sentinel injection) ──
    const SENT = 4747;
    const varRe = (v) => new RegExp('(^|\\n)' + String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=' + SENT + '\\b');
    const shapeFor = (spec) => (spec.optional ? bossFull : pocket);   // optionals need the boss+twoAxis shape to be present
    const wiringFails = [];
    for (const spec of MIDDLE_BINDING_SPECS) {
      const params = { ...shapeFor(spec), [spec.param]: SENT };
      const dataOk = varRe(spec.match.var).test(emitMapped(dataBuilder(params)).text);
      const refOk = varRe(spec.match.var).test(emitMapped(middleStack(params)).text);
      if (!dataOk || !refOk) wiringFails.push({ param: spec.param, var: spec.match.var, dataOk, refOk });
    }

    const sample = emitMapped(dataBuilder({})).text;   // {} → all binding defaults = the shipped operator default (a pocket)
    return {
      resolves: typeof dataBuilder === 'function',
      independentPath: dataBuilder !== middleStack,
      pristine: BUILDERS[MIDDLE_DATA_OPTYPE] === undefined && SCHEMA[MIDDLE_DATA_OPTYPE] === undefined,
      bindingCount: MIDDLE_BINDINGS.length, structBindingCount: MIDDLE_STRUCT_BINDINGS.length,
      sourcesActive, wiringFails,
      struct: { pass: structRes.pass, count: structRes.count, firstDiff: structRes.firstDiff && { params: structRes.firstDiff.params, a: structRes.firstDiff.a.slice(0, 1200), b: structRes.firstDiff.b.slice(0, 1200) } },
      scalar: { pass: scalarRes.pass, count: scalarRes.count, firstDiff: scalarRes.firstDiff && { params: scalarRes.firstDiff.params, a: scalarRes.firstDiff.a.slice(0, 1200), b: scalarRes.firstDiff.b.slice(0, 1200) } },
      sampleHasProbe: /G31/.test(sample), sampleLen: sample.length,
    };
  });

  expect(r.resolves, 'middle-data resolves via builderOf').toBe(true);
  expect(r.independentPath, 'data builder is NOT middleStack (independent code path)').toBe(true);
  expect(r.pristine, 'lives in the user layer; built-in BUILDERS/SCHEMA untouched').toBe(true);
  expect(r.bindingCount, 'the 10 bound scalars: 6 always-present (#1-6) + 4 prune-gated (#19,#20,#21,#22) — t919 retired safeZ→#17 (park always Max), t923 retired clearOver→#18 (in-axis cross-over follows the clearance mode)').toBe(10);
  expect(r.structBindingCount, 'the 9 structural toggles (+ travelShape, t383)').toBe(9);
  expect(r.sourcesActive, 'no probe sources resolve in this env (studio profile) → applyProbeSources is a no-op → the byte-test is meaningful').toBe(false);
  expect(r.wiringFails, 'every DERIVED binding routes to the same assign var middleStack writes').toEqual([]);
  if (!r.struct.pass) console.log('STRUCT FIRST DIFF @ ' + JSON.stringify(r.struct.firstDiff && r.struct.firstDiff.params) + '\n--- middleStack ---\n' + (r.struct.firstDiff && r.struct.firstDiff.a) + '\n--- data def ---\n' + (r.struct.firstDiff && r.struct.firstDiff.b));
  expect(r.struct.count, 'the structural sweep is the full 1792 combos').toBe(1792);
  expect(r.struct.pass, 'data-op == middleStack byte-identical across ALL 1792 structural combos (at default scalars)').toBe(true);
  if (!r.scalar.pass) console.log('SCALAR FIRST DIFF @ ' + JSON.stringify(r.scalar.firstDiff && r.scalar.firstDiff.params) + '\n--- middleStack ---\n' + (r.scalar.firstDiff && r.scalar.firstDiff.a) + '\n--- data def ---\n' + (r.scalar.firstDiff && r.scalar.firstDiff.b));
  expect(r.scalar.pass, 'data-op == middleStack byte-identical across the scalar sweep (bound #vars re-injected)').toBe(true);
  expect(r.sampleHasProbe, 'the default data-op emits a real probe (G31)').toBe(true);
  expect(r.sampleLen, 'emits substantial G-code').toBeGreaterThan(200);
});

/**
 * E1-FIX (t375) — with probe sources ACTIVE (an Expert profile), the middle twin is STILL byte-identical to the built-in.
 * The built-in middle has ZERO sourcing (unlike corner), so def.postInstantiate=applyProbeSources on the twin ALONE would
 * have sourced #5/#3/#2 to controller registers and DIVERGED here (studio's sourcesActive=false hid it). applyProbeSources
 * was DROPPED → the twin emits the literals, matching the built-in. This stubs the source resolver ON to prove it.
 */
test('middle-data-emit: byte-identical with probe sources ACTIVE (Expert) — the twin does not source (divergence gone)', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { middleStack } = await import('/wizards/middleWizard.js');
    const { middleDataDef, MIDDLE_DATA_OPTYPE } = await import('/blocks/dataOps/middleData.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp } = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    registerUserOp(middleDataDef());
    const dataBuilder = builderOf(MIDDLE_DATA_OPTYPE);

    // STUB the source resolver ON (Expert-like): if the twin still sourced #5/#3/#2, it would emit #5=#1078 &c. and DIVERGE.
    const prev = window.ddcsResolveProbeSources;
    window.ddcsResolveProbeSources = (fields) => { const m = { port: '#1078', fastFeed: '#1076', retract: '#1077' }; const out = {}; for (const f of (fields || [])) if (m[f]) out[f] = m[f]; return out; };
    try {
      const active = window.ddcsResolveProbeSources(['port', 'fastFeed', 'retract']);
      const sweep = [
        { featureType: 'pocket', inAxis: 'auto', transAxis: 'auto', twoAxis: false, circular: false, probeZ: false, wcs: 'active', syncA: false },
        { featureType: 'boss', inAxis: 'auto', transAxis: 'auto', twoAxis: true, circular: false, probeZ: false, wcs: 'active', syncA: false, port: 5, f_fast: 220, retract: 4 },
      ];
      const res = emitEquivalence(middleStack, dataBuilder, sweep, {});
      const dataEmit = emitMapped(dataBuilder(sweep[0])).text;
      return {
        sourcesActive: !!(active && Object.keys(active).length),
        pass: res.pass, firstDiff: res.firstDiff && { a: res.firstDiff.a.slice(0, 900), b: res.firstDiff.b.slice(0, 900) },
        dataSourcesRegister: /#5=#1078/.test(dataEmit),   // the twin must NOT source #5 to a register (matches the built-in literal)
        dataKeepsLiteral: /^#5=3 \(/m.test(dataEmit),      // the default port literal
      };
    } finally { window.ddcsResolveProbeSources = prev; }
  });

  expect(r.sourcesActive, 'the stub makes probe sources resolve (Expert-like)').toBe(true);
  if (!r.pass) console.log('EXPERT DIFF\n--- middleStack ---\n' + (r.firstDiff && r.firstDiff.a) + '\n--- data ---\n' + (r.firstDiff && r.firstDiff.b));
  expect(r.pass, 'with sources ACTIVE the data-op is STILL byte-identical to the built-in (applyProbeSources dropped)').toBe(true);
  expect(r.dataSourcesRegister, 'the twin does NOT source #5 to a controller register').toBe(false);
  expect(r.dataKeepsLiteral, 'the twin keeps the #5 literal (matches the built-in, which never sources)').toBe(true);
});
