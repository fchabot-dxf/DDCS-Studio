import { test, expect } from '@playwright/test';

/**
 * t1389 RULING 3, STEP ONE — THE OWNERSHIP TEST, RE-RUN AT THE DELETION. And it found a blocker.
 *
 * The dispatch required this test be re-run AT the deletion rather than inherited from t1385's both-paths guard. That
 * instruction earned its keep: **the two literal atoms are NOT both pure leaves, and t1385's guard could not see it.**
 *
 *     bore  — NOTHING reaches it. No `newBlock('bore')` anywhere, no binding matching `{type:'bore'}`. A pure leaf.
 *     drill — POCKET OWNS A DEPENDENCY ON IT. `pocketWizard.js` builds `newBlock('drill')` for the TOO-SMALL fallback
 *             (a pocket narrower than its tool becomes a single plunge), and `pocketData.js` binds four params to
 *             `match: {type:'drill'}` and mutates that block by type when it places the hole.
 *
 * WHY t1385's GUARD MISSED IT, which is the lesson worth keeping: that guard walked every registered builder called with
 * `{}` — DEFAULT params. Pocket's drill child appears only on the too-small ARM, which defaults do not reach. A guard
 * that exercises one point in the parameter space cannot answer a question about the whole space, and "no builder reaches
 * it" felt like a complete answer while being a sampled one.
 *
 * SO THE DELETION DOES NOT HAPPEN HERE. Retiring `drill` would force a change to a SURVIVOR's behaviour (pocket's
 * fallback), which is the precise signal that an extraction was skipped. `drill` is a NAMED KEEP with this test as its
 * reason; `bore` is provably retireable and its scope is the advisor's to confirm, since the pair was blessed as a unit
 * on a premise that has turned out false for one half.
 *
 * THIS SPEC IS THE HANDOVER. It fails the day someone deletes either atom without first extracting pocket's tenant — so
 * the blocker lives in the suite instead of in a note somebody has to remember to read.
 */
test.use({ viewport: { width: 1200, height: 800 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('OWNERSHIP — pocket OWNS the literal drill block, across its parameter space (not just at defaults)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const flat = (st, o = []) => { for (const b of (st || [])) { if (!b) continue; o.push(b.type); flat(b.children, o); flat(b.uiChildren, o); } return o; };
        const holes = (p) => { try { return flat(pocketStack(p)).filter((t) => t === 'drill' || t === 'bore'); } catch (e) { return ['ERR:' + String(e).slice(0, 40)]; } };
        const BIG = { toolDia: 6, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5 };
        return {
            // The arm defaults DO reach — no literal hole here, which is why t1385's guard passed.
            rect: holes({ ...BIG, shape: 'rect', w: 80, h: 60 }),
            circle: holes({ ...BIG, shape: 'circle', dia: 50 }),
            // …and the arm they do NOT reach: a pocket smaller than its tool falls back to a single plunge.
            tinyCircle: holes({ ...BIG, shape: 'circle', dia: 4, depth: 3, stepdown: 1 }),
            tinyRect: holes({ ...BIG, shape: 'rect', w: 4, h: 4, depth: 3, stepdown: 1 }),
            // The SUPERSET carries every arm at once (the guarded template the data twin prunes).
            superset: holes({ ...BIG, shape: 'rect', w: 80, h: 60 }, true) || [],
            supersetTypes: (() => { try { return flat(pocketStack({ ...BIG, shape: 'rect', w: 80, h: 60 }, { superset: true })).filter((t) => t === 'drill' || t === 'bore'); } catch (_) { return ['ERR']; } })(),
        };
    });
    // THE ARM t1385's GUARD SAW: no literal hole, so "no builder reaches it" looked true.
    expect(r.rect, 'a normal rect pocket carries no literal hole — this is the arm defaults reach').toEqual([]);
    expect(r.circle, 'nor a normal circle pocket').toEqual([]);
    // THE ARM IT DID NOT: the too-small fallback IS a literal drill.
    expect(r.tinyCircle, 'a pocket narrower than its tool falls back to a literal drill plunge').toEqual(['drill']);
    expect(r.tinyRect, 'both shapes do').toEqual(['drill']);
    // …and the guarded superset carries it too, which is what the pocket data-twin prunes over.
    expect(r.supersetTypes, 'the guarded superset carries the literal drill arm as well').toEqual(['drill']);
});

/**
 * THE RUNTIME DEPENDENCY, not only the structural one — pocket's fallback EMITS THROUGH the literal kernel.
 *
 * (`POCKET_BINDING_SPECS` is module-private, so its `match: {type:'drill'}` rows cannot be read from the page. That is
 * fine: emitting is the stronger claim anyway. A structural child could in principle be inert; a body that carries the
 * literal peck ladder's own shape is proof the literal KERNEL is what produced it.)
 *
 * The signature is unmistakable and is exactly what the switch replaced everywhere else: BAKED Z steps and NO loop. The
 * parametric body would have written `WHILE`/`#81`/`#82` instead.
 */
test('OWNERSHIP — pocket\'s too-small fallback EMITS through the literal peck kernel, not the parametric one', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const tiny = emitMapped(pocketStack({ shape: 'circle', dia: 4, toolDia: 6, depth: 3, stepdown: 1, feed: 600, plunge: 150, clearance: 5 })).text;
        const big = emitMapped(pocketStack({ shape: 'circle', dia: 50, toolDia: 6, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5 })).text;
        return {
            tinyBakedZ: (tiny.match(/^G1 Z-?[\d.]+ F/gm) || []).length,   // baked plunge steps — the literal ladder
            tinyHasLoop: /WHILE \[#8\d/.test(tiny),                        // the parametric body's signature
            tinyHasLiveSeed: /#81=/.test(tiny),
            bigHasZ: /G1 Z/.test(big),
        };
    });
    expect(r.tinyBakedZ, 'the fallback emits BAKED Z plunge steps — the literal peck ladder').toBeGreaterThan(0);
    expect(r.tinyHasLoop, 'and NOT the parametric pattern loop').toBe(false);
    expect(r.tinyHasLiveSeed, 'nor the live depth register the parametric body seeds').toBe(false);
    expect(r.bigHasZ, 'while a normal pocket still cuts (the comparison is against a working sibling)').toBe(true);
});

/**
 * AND WHAT IS ACTUALLY CLEAN — `bore` really is a pure leaf, so the retirement is blocked on ONE of the two, not both.
 * Asserted positively so the next act does not have to re-derive it: if this ever fails, something started using `bore`
 * and the retirement plan needs revisiting.
 */
test('OWNERSHIP — bore IS a pure leaf: registered, reachable by nothing, retireable on its own', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { BUILDERS, builderOf } = await import('/blocks/opBuilders.js');
        const uo = await import('/blocks/userOps.js');
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const flat = (st, o = []) => { for (const b of (st || [])) { if (!b) continue; o.push(b.type); flat(b.children, o); flat(b.uiChildren, o); } return o; };
        const reach = [];
        for (const [op, build] of Object.entries(BUILDERS)) {
            try { if (flat(build({})).includes('bore')) reach.push('BUILDERS:' + op); } catch (_) { /* needs params */ }
        }
        for (const def of uo.listUserOps()) {
            try { if (flat(builderOf(def.opType)(uo.defaultParams(def))).includes('bore')) reach.push('userOp:' + def.opType); } catch (_) { /* needs params */ }
        }
        return { reach, boreRegistered: !!BLOCKS.bore, drillRegistered: !!BLOCKS.drill };
    });
    expect(r.boreRegistered, 'bore is still registered — a NAMED KEEP pending the advisor confirming a split retirement').toBe(true);
    expect(r.drillRegistered, 'and drill is a NAMED KEEP with a real reason: pocket runs through it').toBe(true);
    expect(r.reach, 'nothing reaches the literal bore leaf — it is retireable whenever the scope is confirmed').toEqual([]);
});
