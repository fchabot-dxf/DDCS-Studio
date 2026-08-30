import { test, expect } from '@playwright/test';

/**
 * t1389 RULING 2 — DEPTH / PECK / PITCH BECOME REAL PENDANT KNOBS, and `@work` stops declaring when they do.
 *
 * ── WHAT WAS ACTUALLY BROKEN ──────────────────────────────────────────────────────────────────────────────────────
 * `#81` (total depth) and `#82` (the bite) have been described as LIVE since t1379, and that was true of the REGISTERS:
 * the loop reads them, so re-seeding them changes the cut. What was NOT true is that anything could hand them a live
 * value — both seeds went out through `r3(num(...))`, which turns a `#var` into NaN and then into the default. So the CAM
 * path could never expose them, which is precisely what `opToSlot`/`opCamMap` recorded as impossible. `val()` at the two
 * assigns is the whole fix.
 *
 * ── AND THE TRADE THIS TAKES, STATED ──────────────────────────────────────────────────────────────────────────────
 * The trace cap's `@work` declaration is computed from depth and bite at BUILD time. Once either is live the real count
 * does not exist yet, so the marker is OMITTED rather than written wrong (t1383's own principle), and the program falls
 * back to the flow-aware floor — which was sized to cover the worst realistic job and which SAYS SO if it truncates.
 * **The preview stops declaring its work when a knob goes live.** That is the accepted cost, asserted here so it is a
 * recorded decision rather than a surprise.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** An exposed knob writes the SOCKET (drillStack's own params run through num(), as a form's fields should). */
const withSocket = (patch) => `(function (stack) {
    const walk = (bs) => { for (const b of (bs || [])) { if (b.type === 'holecycle') Object.assign(b.params, ${JSON.stringify(patch)}); walk(b.children); walk(b.uiChildren); } };
    walk(stack); return stack;
})`;

test('THE KNOB — a live depth reaches the register seed, and every other line is untouched', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (patchSrc) => {
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const set = eval(patchSrc);
        const P = { pattern: 'circle', dia: 80, count: 6, depth: 12, peck: 3, feed: 120, clearance: 5 };
        const baked = emitMapped(drillStack(P)).text.split('\n');
        const live = emitMapped(set(drillStack(P))).text.split('\n');
        const diff = [];
        for (let i = 0; i < Math.max(baked.length, live.length); i++) if (baked[i] !== live[i]) diff.push({ i, baked: baked[i], live: live[i] });
        return { diff, seed: live.find((l) => /^#81=/.test(l)), bakedSeed: baked.find((l) => /^#81=/.test(l)), sameLen: baked.length === live.length };
    }, withSocket({ depth: '#2601' }));
    expect(r.sameLen, 'the program shape is unchanged — a live seed is still one line').toBe(true);
    expect(r.bakedSeed, 'baked, the seed is a literal').toMatch(/^#81=12\b/);
    expect(r.seed, 'live, the seed carries the #var straight through to the register').toMatch(/^#81=#2601\b/);
    // ONLY the seed line and the header (which drops its @work token) may differ. Anything else means a knob leaked into
    // geometry — the failure this asserts against.
    const changed = r.diff.map((d) => d.i);
    expect(changed.length, `exactly two lines move: the seed and the header. Moved: ${JSON.stringify(r.diff)}`).toBe(2);
    expect(r.diff.some((d) => /^#81=/.test(d.baked)), 'one of them is the #81 seed').toBe(true);
    expect(r.diff.some((d) => /parametric/.test(d.baked)), 'the other is the header comment').toBe(true);
});

test('THE TRADE — a live input OMITS the @work marker rather than declaring a number it cannot know', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (patchSrc) => {
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { holeCycleWorkSteps } = await import('/wizards/ops/holecycle.js');
        const { readDeclaredWork, traceCap } = await import('/engine/declaredWork.js');
        const set = eval(patchSrc);
        const P = { pattern: 'circle', dia: 80, count: 6, depth: 12, peck: 3, feed: 120, clearance: 5 };
        const bakedTxt = emitMapped(drillStack(P)).text;
        const liveTxt = emitMapped(set(drillStack(P))).text;
        return {
            bakedWork: readDeclaredWork(bakedTxt), liveWork: readDeclaredWork(liveTxt),
            stepsNumeric: holeCycleWorkSteps({ ...P }),
            stepsLiveDepth: holeCycleWorkSteps({ ...P, depth: '#2601' }),
            stepsLivePeck: holeCycleWorkSteps({ ...P, peck: '#2602' }),
            stepsLivePitch: holeCycleWorkSteps({ ...P, cycle: 'bore-step', pitch: '[#2603 * 2]' }),
            liveCap: traceCap(liveTxt, liveTxt.split('\n').length, 0),
            bakedCap: traceCap(bakedTxt, bakedTxt.split('\n').length, 0),
            // …and a BIG config, where the declaration is the candidate that actually wins. On the small program above the
            // honest winner is `length` (40 lines x 50 = 2000 beats 276 declared x 4), which is a correct label rather than
            // a bug — so the "declared sizes the cap" claim is made where declaring is what decides.
            bigCap: (() => { const t = emitMapped(drillStack({ pattern: 'circle', dia: 100, count: 24, cycle: 'bore-helix', holeDia: 12, toolDia: 6, depth: 20, pitch: 0.25, feed: 120, clearance: 5 })).text; return traceCap(t, t.split('\n').length, 0); })(),
        };
    }, withSocket({ depth: '#2601' }));
    // Numeric → declares. Any live input → null, and the marker is simply not in the text.
    expect(r.stepsNumeric, 'all-numeric inputs still declare a real count').toBeGreaterThan(100);
    expect(r.stepsLiveDepth, 'a live DEPTH refuses to declare').toBeNull();
    expect(r.stepsLivePeck, 'a live PECK refuses to declare').toBeNull();
    expect(r.stepsLivePitch, 'and a live PITCH expression too').toBeNull();
    expect(r.bakedWork, 'the baked program carries its declaration').toBeGreaterThan(100);
    expect(r.liveWork, 'the live one carries NONE — omitted, not zero-filled or guessed').toBe(0);
    // AND THE FALLBACK IS THE HONEST ONE, not a collapse to the 5000 floor: the body carries flow, so it gets the
    // flow-aware floor that was sized to cover the worst realistic job.
    expect(r.bakedCap.declared, 'the baked program hands the tracer a declaration to size by').toBeGreaterThan(100);
    expect(r.liveCap.declared, 'the live one hands it nothing — so there is nothing to be wrong about').toBe(0);
    expect(r.bigCap.source, 'and where the declaration is the winning candidate, it is what sizes the cap').toBe('declared');
    expect(r.liveCap.source, 'live → the flow-aware floor, which is the declared fallback').toBe('flow-floor');
    expect(r.liveCap.cap, 'and that floor is large, not the 5000 base').toBeGreaterThan(500_000);
});

/**
 * THE FLOOR SEMANTICS — a live bite is guarded at RUN time, not clamped at build time, and that is deliberate.
 * `Math.max(0.1, …)` cannot apply to a value that does not exist yet; the body's own refusal is the mechanism, and it was
 * written for exactly this case (an operator zeroing a live knob).
 */
test('THE GUARD — a live bite keeps the run-time refusal instead of an impossible build-time clamp', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (patchSrc) => {
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const set = eval(patchSrc);
        const P = { pattern: 'grid', cols: 2, rows: 2, depth: 10, peck: 2, feed: 100, clearance: 5 };
        const live = emitMapped(set(drillStack(P))).text;
        // a BAKED zero bite still clamps at build time (unchanged behaviour)
        const bakedZero = emitMapped(drillStack({ ...P, peck: 0 })).text;
        return {
            liveSeed: (live.match(/^#82=.*$/m) || [])[0],
            liveHasRefusal: /IF #82 <= 0 GOTO\d+/.test(live) && /must be greater than zero/.test(live),
            bakedZeroSeed: (bakedZero.match(/^#82=.*$/m) || [])[0],
        };
    }, withSocket({ peck: '#2602' }));
    expect(r.liveSeed, 'the live bite rides through unclamped — build time cannot know its value').toMatch(/^#82=#2602\b/);
    expect(r.liveHasRefusal, 'and the run-time refusal is present, which is what makes that safe').toBe(true);
    expect(r.bakedZeroSeed, 'a BAKED zero is still floored at build time — that path is unchanged').toMatch(/^#82=0\.1\b/);
});

/**
 * THE CAM SURFACE — the knobs `opToSlot` recorded as impossible are now classified exposable, end to end.
 * This is the claim the whole arc was for, so it is read off the real classifier rather than the table.
 */
test('THE CAM KNOBS — depth/peck expose on the drill op, holeDia/toolDia stay baked with their reason', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { classifyExposable } = await import('/data/exposeClassifier.js');
        const { drillDataDef, DRILL_DEFAULTS } = await import('/blocks/dataOps/drillData.js');
        const { boreDataDef } = await import('/blocks/dataOps/boreData.js');
        const pick = (c, k) => (c[k] ? { exposable: c[k].exposable, role: c[k].role, reason: c[k].reason } : null);
        // t2415 (BACKLOG #23) — drill is now a bindingSpecs def (the guarded holesEnabled toggle needs
        // per-build re-derivation); classifyExposable must be given the ARM it's classifying (bore is
        // unaffected — untouched this turn, still a frozen-bindings def, no params needed).
        const d = classifyExposable(drillDataDef(), DRILL_DEFAULTS), b = classifyExposable(boreDataDef());
        return {
            drill: { depth: pick(d, 'depth'), peck: pick(d, 'peck'), feed: pick(d, 'feed'), dia: pick(d, 'dia') },
            bore: { depth: pick(b, 'depth'), pitch: pick(b, 'pitch'), holeDia: pick(b, 'holeDia'), toolDia: pick(b, 'toolDia') },
        };
    });
    // THE PAYOFF: the three knobs the CAM note called impossible.
    expect(r.drill.depth.exposable, 'drill depth is a pendant knob at last').toBe(true);
    expect(r.drill.peck.exposable, 'and so is the peck').toBe(true);
    expect(r.drill.feed.exposable, 'feed too (t1389 ruling 1 unblocked the fold)').toBe(true);
    expect(r.bore.depth.exposable, 'the bore twin gets depth').toBe(true);
    expect(r.bore.pitch.exposable, 'and pitch').toBe(true);
    // AND THE LINE HELD: geometry that a pendant edit would KINK is still baked, with the reason on the control.
    expect(r.bore.holeDia.exposable, 'hole Ø stays baked — the arc I/J is folded from it, so a live edit kinks the circle').toBe(false);
    expect(r.bore.toolDia.exposable, 'tool Ø likewise').toBe(false);
    expect(r.drill.dia.exposable, 'and the bolt-circle Ø stays baked — it multiplies baked trig').toBe(false);
});
