import { test, expect } from '@playwright/test';

/**
 * t2469 (BACKLOG #60, part 2) — CENTRE DRILL as a data-op twin, proven FUNCTIONALLY equivalent to the
 * hand-coded `centerDrillStack` across a param sweep. `centerDrillDataDef` (`blocks/dataOps/centerDrillData.js`)
 * uses the SAME frozen-template-once pattern as drill/pocket/etc: `instantiate()` builds the stack ONCE from
 * defaults, `postInstantiate` (`applyStraightPeck`) only ever mutates the ALREADY-built stack in place — it
 * never re-invokes `centerDrillStack` live, so this is a genuine, non-tautological claim (BACKLOG #60's own
 * criterion, WORK-LOG t2457).
 *
 * ONE genuine, NAMED cosmetic frontier (mirrors `stripAnnotations`'s own doc comment, same shape as drill's
 * annotation-only divergences): when `kind:'straight'`, the reference builder writes the generic
 * `( advance between full retracts 0 = one plunge )` comment on `#162=0` (it always emits that same comment,
 * regardless of how peck arrived at zero), while the twin's `applyStraightPeck` overwrites it with a more
 * specific `( straight — one plunge, so there is no step )` note. Both correctly write `#162=0` — the SAME
 * machine behavior — only the human-readable annotation differs. `stripAnnotations` (equivalence.js) drops
 * every parenthetical before comparing, exactly the tool this frontier exists for.
 */
test('centerdrill-data-emit: the data def is FUNCTIONALLY byte-identical to centerDrillStack across a param sweep', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    const r = await page.evaluate(async () => {
        const { centerDrillStack, CDRILL_DEFAULTS } = await import('/wizards/lathe/centerDrill.js');
        const { CDRILL_DATA_OPTYPE } = await import('/blocks/dataOps/centerDrillData.js');
        const { emitEquivalence, stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
        const { builderOf, BUILDERS } = await import('/blocks/opBuilders.js');
        const { SCHEMA } = await import('/blocks/opSchema.js');
        const build = builderOf(CDRILL_DATA_OPTYPE);

        const S = (o) => ({ ...CDRILL_DEFAULTS, ...o });
        const sweep = [
            S({}),                                  // defaults
            S({ depth: 20, peck: 4 }),
            S({ depth: 8, peck: 0 }),                // peck already 0 while kind stays 'peck' -- straight BY VALUE
            S({ kind: 'straight', peck: 5 }),        // kind='straight' -- postInstantiate zeroes peck to match
            S({ kind: 'straight' }),
            S({ feed: 90, depth: 12 }),
            S({ depth: 30, peck: 10, feed: 45 }),
        ];

        const raw = emitEquivalence(centerDrillStack, build, sweep);
        const functional = emitEquivalence(centerDrillStack, build, sweep, {}, stripAnnotations);

        // Confirm the raw divergence is EXACTLY the two kind='straight' entries (indices 3, 4) and nothing else --
        // a precise claim, not "mostly passes".
        const rawDiffIndices = raw.diffs.map((d) => d.i);

        const sampleText = (await import('/blocks/blockEmitter.js')).emitMapped(build(sweep[0])).text;

        return {
            resolves: typeof build === 'function',
            independentPath: build !== centerDrillStack,
            pristine: BUILDERS[CDRILL_DATA_OPTYPE] === undefined && SCHEMA[CDRILL_DATA_OPTYPE] === undefined,
            rawPass: raw.pass,
            rawDiffIndices,
            functionalPass: functional.pass,
            functionalCount: functional.count,
            functionalFirstDiff: functional.firstDiff && { params: functional.firstDiff.params, a: functional.firstDiff.a.slice(0, 400), b: functional.firstDiff.b.slice(0, 400) },
            sampleHasMotion: /G1 Z#?\d+ F/.test(sampleText),
        };
    });

    expect(r.resolves, 'centerdrill-data-emit resolves via builderOf').toBe(true);
    expect(r.independentPath, 'data builder is NOT centerDrillStack (independent code path)').toBe(true);
    expect(r.pristine, 'the twin lives in the user layer, built-in BUILDERS/SCHEMA untouched').toBe(true);

    // FUNCTIONAL claim: the core assertion. Same machine behavior across the whole sweep.
    if (!r.functionalPass) console.log('FIRST FUNCTIONAL DIFF @ ' + JSON.stringify(r.functionalFirstDiff && r.functionalFirstDiff.params) + '\n--A--\n' + (r.functionalFirstDiff && r.functionalFirstDiff.a) + '\n--B--\n' + (r.functionalFirstDiff && r.functionalFirstDiff.b));
    expect(r.functionalCount, 'the sweep is substantial').toBeGreaterThanOrEqual(7);
    expect(r.functionalPass, 'centerdrill-data-emit == centerDrillStack functionally (annotations stripped) across the sweep').toBe(true);
    expect(r.sampleHasMotion, 'emits real plunge motion').toBe(true);

    // COSMETIC frontier, precisely named: byte-identity fails ONLY on the two kind='straight' entries (3, 4),
    // where postInstantiate's own more-specific note replaces the generic one. Nowhere else.
    expect(r.rawDiffIndices, 'raw byte-identity diverges ONLY on the two kind=straight entries (annotation text only)').toEqual([3, 4]);
});

// BACKLOG #30 -- same cross-dialect discipline as drill-as-data.spec.js/parting-cross-dialect-1900.spec.js:
// a dialect-only branch would pass the EXPERT-only sweep above and still be wrong on V4.1/DM500.
test('centerdrill-data-emit: cross-dialect -- functionally byte-identical to centerDrillStack for EVERY registered dialect', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);

    const r = await page.evaluate(async () => {
        const { centerDrillStack, CDRILL_DEFAULTS } = await import('/wizards/lathe/centerDrill.js');
        const { CDRILL_DATA_OPTYPE } = await import('/blocks/dataOps/centerDrillData.js');
        const { emitEquivalence, stripAnnotations } = await import('/blocks/dataOps/equivalence.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { listPosts } = await import('/wizards/dialects/index.js');
        const build = builderOf(CDRILL_DATA_OPTYPE);

        const S = (o) => ({ ...CDRILL_DEFAULTS, ...o });
        const sweep = [S({}), S({ depth: 20, peck: 4 }), S({ kind: 'straight' })];
        const dialects = listPosts().map((p) => p.id);
        let diffs = 0, first = null, combos = 0;
        for (const dialectId of dialects) {
            for (const p of sweep) {
                combos++;
                const a = emitEquivalence(centerDrillStack, build, [p], { profileId: dialectId }, stripAnnotations);
                if (!a.pass) { diffs++; if (!first) first = { dialectId, p, ...a.firstDiff }; }
            }
        }
        return { diffs, first, combos, dialectCount: dialects.length };
    });
    if (r.first) console.log('CDRILL XDIALECT DIFF ' + JSON.stringify(r.first.dialectId) + ' @ ' + JSON.stringify(r.first.params) + '\n--TWIN--\n' + (r.first.b || '').slice(0, 600) + '\n--BUILTIN--\n' + (r.first.a || '').slice(0, 600));
    expect(r.dialectCount, 'sanity: 7 registered dialects').toBe(7);
    expect(r.combos, 'the sweep = 7 dialects x 3 representative cases').toBe(21);
    expect(r.diffs, 'functionally byte-identical for EVERY registered dialect, incl. V4.1 and DM500').toBe(0);
});
