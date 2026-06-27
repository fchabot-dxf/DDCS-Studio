import { test, expect } from '@playwright/test';

/**
 * WIZARDS-AS-DATA — Stage 5, the 2nd port (ROADMAP STRATEGIC #3). Validates the equivalence harness on a SECOND,
 * non-drill, non-placement built-in: spindle warmup (`atcWarmupStack`), a STATIC-shape op. Proves:
 *   • BINDING WIRING — all 4 params (rpm1/time1/rpm2/time2) route to the same sockets `atcWarmupStack` uses;
 *   • BYTE-IDENTICAL emit-equivalence — the FULL emit (annotations included) matches the builder across a param sweep.
 *
 * This op once was only FUNCTIONALLY equivalent (stripAnnotations): the wizard interpolated params into comment +
 * HMI-message TEXT (`Stage 1: 6000 RPM…`, `Starting at 6000 RPM`) that a static template FROZE — so a forked/data-def
 * warmup at 8000 RPM would emit `M3 S8000` but still TELL THE OPERATOR "6000 RPM" (a stale message = a lie at the
 * machine, not a cosmetic nit). FIXED by making that annotation text STATIC: the rpm/time are the single source of
 * truth in the executable Spindle (M3 S<rpm>) + Dwell (G04 P<ms>) atoms, never duplicated into prose (principle #4).
 * ⇒ The COMPUTED-ANNOTATION-TEXT frontier is CLOSED for value-FREE messages; it returns only for a VALUE-BEARING one
 *   (e.g. a probe "Probing 50mm — press Enter" the operator checks before committing), which a future GENERAL
 *   annotation-text atom must render from a BOUND param — built when an op forces it, not speculatively. See NEXT-SESSION.
 */
test('atc-warmup-as-data: BYTE-IDENTICAL to atcWarmupStack across a param sweep + binding-wiring', async ({ page }) => {
  await page.goto('http://localhost:3211');
  await page.waitForFunction(() => window.ddcsGetBlockProgram);

  const r = await page.evaluate(async () => {
    const { atcWarmupStack } = await import('/wizards/atcWarmupWizard.js');
    const { atcWarmupDataDef, ATC_WARMUP_DEFAULTS, ATC_WARMUP_DATA_OPTYPE, ATC_WARMUP_BINDINGS } = await import('/blocks/dataOps/atcWarmupData.js');
    const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
    const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
    const { builderOf, BUILDERS } = await import('/blocks/opBuilders.js');
    const { SCHEMA } = await import('/blocks/opSchema.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');

    registerUserOp(atcWarmupDataDef());
    const dataBuilder = builderOf(ATC_WARMUP_DATA_OPTYPE);   // === instantiate(def, …): an INDEPENDENT path from atcWarmupStack

    const base = ATC_WARMUP_DEFAULTS;
    const S = (o) => ({ ...base, ...o });

    // Sweep varies ALL 4 params (each feeds a plain spindle.rpm / dwell.sec socket — bound — and NO annotation now).
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

    // BYTE-IDENTICAL: the FULL emit (annotations INCLUDED, no normalizer) matches the builder across the sweep — the
    // annotation text is static now, so nothing drifts when a binding sets a new rpm/time.
    const raw = emitEquivalence(atcWarmupStack, dataBuilder, sweep);

    // BINDING WIRING — every binding routes its param to the SAME socket atcWarmupStack uses (structural, no emit).
    const wiringFails = [];
    for (const b of ATC_WARMUP_BINDINGS) {
      const dataSock = (flattenBlocks(dataBuilder(S({ [b.param]: 4242 })))[b.blockIndex] || {}).params || {};
      const refSock = (flattenBlocks(atcWarmupStack(S({ [b.param]: 4242 })))[b.blockIndex] || {}).params || {};
      if (dataSock[b.key] !== 4242 || refSock[b.key] !== 4242) wiringFails.push({ param: b.param, blockIndex: b.blockIndex, key: b.key, data: dataSock[b.key], ref: refSock[b.key] });
    }

    const sample = emitMapped(dataBuilder(S({ rpm1: 8000, time1: 12 }))).text;   // a fork: stage-1 rpm = 8000
    return {
      resolves: typeof dataBuilder === 'function',
      independentPath: dataBuilder !== atcWarmupStack,
      pristine: BUILDERS[ATC_WARMUP_DATA_OPTYPE] === undefined && SCHEMA[ATC_WARMUP_DATA_OPTYPE] === undefined,
      bindingCount: ATC_WARMUP_BINDINGS.length,
      wiringFails,
      raw: { pass: raw.pass, count: raw.count, firstDiff: raw.firstDiff && { params: raw.firstDiff.params, a: raw.firstDiff.a.slice(0, 500), b: raw.firstDiff.b.slice(0, 500) } },
      noStaleMsg: !/6000\s*RPM/i.test(sample),         // regression: a rpm1=8000 fork must NOT carry the frozen default 6000 in any message
      sampleHasSpindle: /\bS8000\b/.test(sample),      // the bound stage-1 rpm reaches the executable line
      sampleHasDwell: /\bG0?4\b/.test(sample),         // a dwell executes (G4 or G04)
      sampleHasEnd: /\bM30\b/.test(sample),
    };
  });

  expect(r.resolves, 'atc-warmup-as-data resolves via builderOf').toBe(true);
  expect(r.independentPath, 'data builder is NOT atcWarmupStack (independent path)').toBe(true);
  expect(r.pristine, 'lives in the user layer; built-in BUILDERS/SCHEMA untouched').toBe(true);
  // All 4 bindings wired to the same socket the builder uses.
  expect(r.bindingCount, 'all warmup params are bound').toBe(4);
  expect(r.wiringFails, 'every binding routes to the same socket atcWarmupStack uses').toEqual([]);
  // BYTE-IDENTICAL across the whole sweep (full emit, annotations included).
  if (!r.raw.pass) console.log('RAW DIFF @', JSON.stringify(r.raw.firstDiff && r.raw.firstDiff.params) + '\n--A--\n' + (r.raw.firstDiff && r.raw.firstDiff.a) + '\n--B--\n' + (r.raw.firstDiff && r.raw.firstDiff.b));
  expect(r.raw.count, 'a real sweep').toBeGreaterThan(6);
  expect(r.raw.pass, 'FULL emit is byte-identical to atcWarmupStack across the sweep (annotations included)').toBe(true);
  // The static-text fix: a forked rpm1=8000 warmup never tells the operator the stale default 6000.
  expect(r.noStaleMsg, 'a forked rpm1=8000 warmup emits NO stale "6000 RPM" message').toBe(true);
  if (!(r.sampleHasSpindle && r.sampleHasDwell && r.sampleHasEnd)) console.log('SAMPLE:\n' + r.sampleExec);
  expect(r.sampleHasSpindle && r.sampleHasDwell && r.sampleHasEnd, 'emits real spindle/dwell/end G-code').toBe(true);
});
