import { test, expect } from './support/harness.mjs';

/**
 * t2469 (BACKLOG #60, part 2) — FACING as a data-op twin, proven byte-identical to the hand-coded
 * `facingStack` across `doc`/`feed` (the two bound params that read straight through). Same frozen-template
 * pattern as centerDrill/drill (BACKLOG #60's own criterion): `facingDataDef` has no `postInstantiate` at all.
 *
 * ⚠ A GENUINE FRONTIER FOUND WRITING THIS TEST, not assumed from BACKLOG #60's own "no design call needed"
 * framing (measured directly, corrected here): `allowance` and `finish` do NOT emit byte-identically once
 * varied from their defaults, for TWO DIFFERENT reasons —
 *   - `allowance` IS a bound leaf (`#111=<value>`, the register updates correctly), but the SAME value also
 *     drives the clearance-approach Z (`G0 X#113 Z<n>`) and the final retract Z (`G0 Z<n>`) via plain JS math
 *     in `facingStack` — computed ONCE, at template-freeze time, using `FACING_DEFAULTS.allowance`, and never
 *     recomputed when the bound register changes. The register is live; those two Z heights are frozen.
 *   - `finish` is not bound at all — always the DEFAULT (`0`), full stop.
 * `xStart` has the same shape as `allowance` for a different reason: `facingStack` COMPUTES it live from
 * `barDiameter`/`clearance` (both unbound, frozen); the twin instead binds it as an independently-editable
 * field. Sweeping it alone diverges by DESIGN, not by bug (confirmed live, not swept into the frontier above).
 *
 * This is NOT the same shape as drill's SOLVED frontiers (a live bbox recompute closed those) — closing it
 * here needs `facingDataDef` to gain a `postInstantiate` that recomputes the two baked Z heights from the
 * live `allowance`, mirroring `centerDrillData.js`'s own `applyStraightPeck` shape. A real, buildable fix —
 * but a CODE change, out of scope for this turn's own "write the test" ask. Reported, not built, matching
 * this session's own standing rule against forcing a test to claim more than what was actually proven.
 *
 * t2691 — TIER MIGRATION BATCH 3: moved browser→node. The original never called registerUserOp — it relies on
 * facingDataDef being pre-seeded (SEED_BUILDERS, run at real app boot by seedDefaultPortedUserOps()). The node
 * harness's page.goto() only imports settingsPanel.js, so added an explicit `registerUserOp(facingDataDef())`
 * (plain, not createUserOp: this file never calls listUserOps()).
 */
const boot = async (page) => {
    const uo = await import('/blocks/userOps.js');
    const { facingDataDef } = await import('/blocks/dataOps/facingData.js');
    uo.registerUserOp(facingDataDef());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
};

test('facing-data-emit: the data def emits byte-identical G-code to facingStack across doc/feed', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(async () => {
        const { facingStack, FACING_DEFAULTS } = await import('/wizards/lathe/facing.js');
        const { FACING_DATA_OPTYPE } = await import('/blocks/dataOps/facingData.js');
        const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
        const { builderOf, BUILDERS } = await import('/blocks/opBuilders.js');
        const { SCHEMA } = await import('/blocks/opSchema.js');
        const build = builderOf(FACING_DATA_OPTYPE);

        const S = (o) => ({ ...FACING_DEFAULTS, ...o });
        // ONLY doc/feed -- allowance/finish are the NAMED, still-open frontier above; xStart diverges by design.
        const sweep = [
            S({}),
            S({ doc: 2 }),
            S({ doc: 0.5 }),
            S({ feed: 200 }),
            S({ doc: 2, feed: 200 }),
            S({ doc: 0 }),               // facingPasses' own degenerate-loop guard (one skim, no step)
            S({ doc: 0.35, feed: 65 }),
        ];
        const main = emitEquivalence(facingStack, build, sweep);

        // The named frontier, CONFIRMED live (not asserted from theory) so a future close shows up as a win,
        // exactly the drill-as-data.spec.js pattern for its own still-open/solved frontiers.
        const allowanceFrontier = emitEquivalence(facingStack, build, [S({ allowance: 6 })]);
        const finishFrontier = emitEquivalence(facingStack, build, [S({ finish: 1 })]);
        const xStartByDesign = emitEquivalence(facingStack, build, [S({ xStart: 30 })]);

        const sampleText = (await import('/blocks/blockEmitter.js')).emitMapped(build(sweep[0])).text;

        return {
            resolves: typeof build === 'function',
            independentPath: build !== facingStack,
            pristine: BUILDERS[FACING_DATA_OPTYPE] === undefined && SCHEMA[FACING_DATA_OPTYPE] === undefined,
            main: { pass: main.pass, count: main.count, firstDiff: main.firstDiff && { params: main.firstDiff.params, a: main.firstDiff.a.slice(0, 500), b: main.firstDiff.b.slice(0, 500) } },
            allowanceFrontierPass: allowanceFrontier.pass,
            finishFrontierPass: finishFrontier.pass,
            xStartByDesignPass: xStartByDesign.pass,
            sampleHasMotion: /G1 X0 F#\d+/.test(sampleText),
        };
    });

    expect(r.resolves, 'facing-data-emit resolves via builderOf').toBe(true);
    expect(r.independentPath, 'data builder is NOT facingStack (independent code path)').toBe(true);
    expect(r.pristine, 'the twin lives in the user layer, built-in BUILDERS/SCHEMA untouched').toBe(true);

    if (!r.main.pass) console.log('FIRST DIFF @ ' + JSON.stringify(r.main.firstDiff && r.main.firstDiff.params) + '\n--A--\n' + (r.main.firstDiff && r.main.firstDiff.a) + '\n--B--\n' + (r.main.firstDiff && r.main.firstDiff.b));
    expect(r.main.count, 'the sweep is substantial for the params proven equivalent').toBeGreaterThanOrEqual(7);
    expect(r.main.pass, 'facing-data-emit == facingStack byte-for-byte across doc/feed').toBe(true);
    expect(r.sampleHasMotion, 'emits a real facing pass').toBe(true);

    // STILL-OPEN FRONTIERS — MUST currently diverge (baked-at-freeze-time Z heights / an unbound param / a
    // by-design independent binding). Regression tripwires: if a future postInstantiate closes one, this
    // flips to `true` and the fix is confirmed working, exactly as drill's solved-frontier assertions do.
    expect(r.allowanceFrontierPass, 'OPEN: allowance is bound at the register but two Z heights are baked at freeze time — diverges by omission, not by design').toBe(false);
    expect(r.finishFrontierPass, 'OPEN: finish is entirely unbound, always the default — diverges by omission').toBe(false);
    expect(r.xStartByDesignPass, 'BY DESIGN: xStart is an independent bound field on the twin vs a live computation on facingStack — diverges deliberately').toBe(false);
});

test('facing-data-emit: cross-dialect -- byte-identical to facingStack for EVERY registered dialect (doc/feed only)', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(async () => {
        const { facingStack, FACING_DEFAULTS } = await import('/wizards/lathe/facing.js');
        const { FACING_DATA_OPTYPE } = await import('/blocks/dataOps/facingData.js');
        const { emitEquivalence } = await import('/blocks/dataOps/equivalence.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { listPosts } = await import('/wizards/dialects/index.js');
        const build = builderOf(FACING_DATA_OPTYPE);

        const S = (o) => ({ ...FACING_DEFAULTS, ...o });
        const sweep = [S({}), S({ doc: 2, feed: 200 }), S({ doc: 0 })];
        const dialects = listPosts().map((p) => p.id);
        let diffs = 0, first = null, combos = 0;
        for (const dialectId of dialects) {
            for (const p of sweep) {
                combos++;
                const a = emitEquivalence(facingStack, build, [p], { profileId: dialectId });
                if (!a.pass) { diffs++; if (!first) first = { dialectId, p, ...a.firstDiff }; }
            }
        }
        return { diffs, first, combos, dialectCount: dialects.length };
    });
    if (r.first) console.log('FACING XDIALECT DIFF ' + JSON.stringify(r.first.dialectId) + ' @ ' + JSON.stringify(r.first.params) + '\n--TWIN--\n' + (r.first.b || '').slice(0, 600) + '\n--BUILTIN--\n' + (r.first.a || '').slice(0, 600));
    expect(r.dialectCount, 'sanity: 7 registered dialects').toBe(7);
    expect(r.combos, 'the sweep = 7 dialects x 3 representative doc/feed cases').toBe(21);
    expect(r.diffs, 'byte-identical for EVERY registered dialect, incl. V4.1 and DM500').toBe(0);
});
