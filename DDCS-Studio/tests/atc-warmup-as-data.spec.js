import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — Stage 5, the 2nd port (ROADMAP STRATEGIC #3). Validates the equivalence harness on a SECOND,
 * non-drill, non-placement built-in: spindle warmup (`atcWarmupStack`), a STATIC-shape op. Proves:
 *   • BINDING WIRING — all 4 params (rpm1/time1/rpm2/time2) route to the same sockets `atcWarmupStack` uses;
 *   • FUNCTIONAL emit-equivalence — with `stripAnnotations`, the EXECUTABLE G-code is byte-identical to the builder
 *     across a full param sweep (identical machine behavior);
 *   • the NEW frontier — COMPUTED ANNOTATION TEXT: the RAW emit diverges (params are interpolated into comment +
 *     HMI-message text that a static template freezes). Classified COSMETIC (no motion change), unlike drill's
 *     FUNCTIONAL blockers. Asserted as a failing-on-purpose tripwire.
 */
test('atc-warmup-as-data: functionally identical to atcWarmupStack; only the annotation text is frozen', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { atcWarmupStack } = await import('/wizards/atcWarmupWizard.js');
    const { atcWarmupDataDef, ATC_WARMUP_DEFAULTS, ATC_WARMUP_DATA_OPTYPE, ATC_WARMUP_BINDINGS } = await import('/blocks/dataOps/atcWarmupData.js');
    const { emitEquivalence, stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
    const { builderOf, BUILDERS } = await import('/blocks/opBuilders.js');
    const { SCHEMA } = await import('/blocks/opSchema.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    registerUserOp(atcWarmupDataDef());
    const dataBuilder = builderOf(ATC_WARMUP_DATA_OPTYPE);   // === instantiate(def, …): an INDEPENDENT path from atcWarmupStack

    const base = ATC_WARMUP_DEFAULTS;
    const S = (o) => ({ ...base, ...o });

    // Sweep varies ALL 4 params (each feeds a plain spindle.rpm / dwell.sec socket — bound — AND a frozen annotation).
    const sweep = [
      S({}),
      S({ rpm1: 8000 }),
      S({ rpm2: 18000 }),
      S({ time1: 60 }),
      S({ time2: 5 }),
      S({ rpm1: 3000, time1: 45, rpm2: 24000, time2: 90 }),
      S({ rpm1: 10000, rpm2: 10000 }),
      S({ time1: 1, time2: 1 }),
    ];

    // FUNCTIONAL equivalence: strip parenthetical annotations → only executable G/M-code remains → must be identical.
    const functional = emitEquivalence(atcWarmupStack, dataBuilder, sweep, {}, stripAnnotations);
    // RAW equivalence (no normalize): MUST diverge — the frozen comment + HMI-toast text is the cosmetic frontier.
    const rawVaried = emitEquivalence(atcWarmupStack, dataBuilder, [S({ rpm1: 8000 })]);

    // BINDING WIRING — every binding routes its param to the SAME socket atcWarmupStack uses (structural, no emit).
    const wiringFails = [];
    for (const b of ATC_WARMUP_BINDINGS) {
      const dataSock = (flattenBlocks(dataBuilder(S({ [b.param]: 4242 })))[b.blockIndex] || {}).params || {};
      const refSock = (flattenBlocks(atcWarmupStack(S({ [b.param]: 4242 })))[b.blockIndex] || {}).params || {};
      if (dataSock[b.key] !== 4242 || refSock[b.key] !== 4242) wiringFails.push({ param: b.param, blockIndex: b.blockIndex, key: b.key, data: dataSock[b.key], ref: refSock[b.key] });
    }

    const sampleExec = stripAnnotations(emitMapped(dataBuilder(S({ rpm1: 8000, time1: 12 }))).text);
    return {
      resolves: typeof dataBuilder === 'function',
      independentPath: dataBuilder !== atcWarmupStack,
      pristine: BUILDERS[ATC_WARMUP_DATA_OPTYPE] === undefined && SCHEMA[ATC_WARMUP_DATA_OPTYPE] === undefined,
      bindingCount: ATC_WARMUP_BINDINGS.length,
      wiringFails,
      functional: { pass: functional.pass, count: functional.count, firstDiff: functional.firstDiff && { params: functional.firstDiff.params, a: functional.firstDiff.a.slice(0, 500), b: functional.firstDiff.b.slice(0, 500) } },
      rawDiverges: !rawVaried.pass,
      sampleExec,
      sampleHasSpindle: /\bS8000\b/.test(sampleExec),   // the bound stage-1 rpm reaches the executable line
      sampleHasDwell: /\bG0?4\b/.test(sampleExec),      // a dwell executes (G4 or G04)
      sampleHasEnd: /\bM30\b/.test(sampleExec),
    };
  });

  expect(r.resolves, 'atc-warmup-as-data resolves via builderOf').toBe(true);
  expect(r.independentPath, 'data builder is NOT atcWarmupStack (independent path)').toBe(true);
  expect(r.pristine, 'lives in the user layer; built-in BUILDERS/SCHEMA untouched').toBe(true);
  // All 4 bindings wired to the same socket the builder uses.
  expect(r.bindingCount, 'all warmup params are bound').toBe(4);
  expect(r.wiringFails, 'every binding routes to the same socket atcWarmupStack uses').toEqual([]);
  // FUNCTIONAL equivalence holds across the whole sweep (identical executable G-code).
  if (!r.functional.pass) console.log('FUNCTIONAL DIFF @', JSON.stringify(r.functional.firstDiff && r.functional.firstDiff.params) + '\n--A--\n' + (r.functional.firstDiff && r.functional.firstDiff.a) + '\n--B--\n' + (r.functional.firstDiff && r.functional.firstDiff.b));
  expect(r.functional.count, 'a real sweep').toBeGreaterThan(6);
  expect(r.functional.pass, 'executable G-code is byte-identical to atcWarmupStack across the sweep').toBe(true);
  if (!(r.sampleHasSpindle && r.sampleHasDwell && r.sampleHasEnd)) console.log('SAMPLE EXEC:\n' + r.sampleExec);
  expect(r.sampleHasSpindle && r.sampleHasDwell && r.sampleHasEnd, 'emits real spindle/dwell/end G-code').toBe(true);
  // FRONTIER — computed annotation text: the RAW emit MUST diverge (frozen comment + HMI-toast text). Cosmetic only.
  expect(r.rawDiverges, 'frontier: raw emit diverges on the param-interpolated comment/message TEXT a static template freezes').toBe(true);
});
