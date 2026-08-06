import { test, expect } from './support/harness.mjs';

/**
 * t1399 STEP 0 — SURFACING'S KNOBS BECOME REACHABLE, and every numeric program stays byte-identical.
 *
 * ── WHY THIS IS STEP 0 OF THE POCKET WORK ─────────────────────────────────────────────────────────────────────────
 * The rect pocket re-points its fill through `surfaceraster` (t1399 ruling), so **a pocket can only be as live as the
 * atom it reuses**. Surfacing has emitted parametrically since t1359 — the loops read `#42`/`#43` at the machine — but
 * nothing could HAND those registers a value: the seeds printed through `r3(num(...))`, which turns a `#var` into NaN
 * and then into the default. Same gap the drill family had until t1389, on a different atom.
 *
 * ── WHAT CHANGED, EXACTLY ─────────────────────────────────────────────────────────────────────────────────────────
 *   feed / plunge        → val() at their print sites (each is only ever a bare `F<word>`; neither is read by any
 *                          arithmetic in the file — checked, not assumed)
 *   depth / stepdown     → the seed is a live WORD or the old NUMBER, never a plain val()
 *   surfaceRasterWorkSteps → returns null when any input it multiplies is live (t1383's rule; surfacing never had it
 *                          because until now none of its inputs could be live)
 *
 * ⚠ THE SEED IS WORD-OR-NUMBER AND NOT `val()`, and that distinction is the whole reason this spec has edge cases.
 * `stepdown` is floored at 0.01 before printing. A plain `val()` would emit `#43=0` for a typed zero where this file has
 * always emitted `#43=0.01` — a byte change AND a behaviour change (0.01 crawls; 0 hits the refusal). Measured against
 * HEAD in a worktree rather than reasoned about, which is how it was caught.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('THE KNOBS — a live depth, stepdown, feed and plunge each reach the emit', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const B = { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 };
        const one = (patch) => surfaceRasterLines({ ...B, ...patch }).join('\n');
        return {
            depthSeed: (one({ depth: '#2601' }).match(/^#42=.*$/m) || [])[0],
            stepSeed: (one({ stepdown: '#2602' }).match(/^#43=.*$/m) || [])[0],
            feedRides: /F#2603\b/.test(one({ feed: '#2603' })),
            plungeRides: /F#2604\b/.test(one({ plunge: '#2604' })),
            exprDepth: (one({ depth: '[#2601 * 2]' }).match(/^#42=.*$/m) || [])[0],
            // the guard that makes a live stepdown safe — it reads the REGISTER, so a dialled zero refuses at run time
            guard: /IF #43 <= 0 GOTO\d+/.test(one({ stepdown: '#2602' })),
            refusalNamed: /ERROR/i.test(one({ stepdown: '#2602' })) || /GOTO91/.test(one({ stepdown: '#2602' })),
        };
    });
    expect(r.depthSeed, 'a #var depth rides straight to the register the depth loop reads').toMatch(/^#42=#2601\b/);
    expect(r.stepSeed, 'and so does the stepdown').toMatch(/^#43=#2602\b/);
    expect(r.exprDepth, 'a bracketed EXPRESSION rides too, not just a bare #var').toMatch(/^#42=\[#2601 \* 2\]/);
    expect(r.feedRides, 'a #var feed reaches the F word').toBe(true);
    expect(r.plungeRides, 'and a #var plunge does too').toBe(true);
    expect(r.guard, 'the zero-advance guard reads the REGISTER — which is what makes a dialled stepdown safe').toBe(true);
});

/**
 * THE NUMERICS DO NOT MOVE — the promise this change had to keep.
 * The edge cases are the point: the floor, the negative, the absent value, and a fractional feed are exactly where a
 * careless `val()` would have shifted a byte.
 */
test('THE BYTES — every numeric config emits what it always did, floors and all', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const B = { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 };
        const seed = (patch, re) => (surfaceRasterLines({ ...B, ...patch }).join('\n').match(re) || [])[0];
        // ALL the F words, not the first: the first one in the body is the PLUNGE, so `match(/F[\d.]+/)` answered a
        // different question than the one being asked (it returned F180 for a feed probe).
        const F = (patch) => [...new Set((surfaceRasterLines({ ...B, ...patch }).join('\n').match(/F[\d.]+/g) || []))];
        return {
            zeroStep: seed({ stepdown: 0 }, /^#43=.*$/m),
            negStep: seed({ stepdown: -1 }, /^#43=.*$/m),
            tinyStep: seed({ stepdown: 0.001 }, /^#43=.*$/m),
            zeroDepth: seed({ depth: 0 }, /^#42=.*$/m),
            fracDepth: seed({ depth: 1.25 }, /^#42=.*$/m),
            plainStep: seed({}, /^#43=.*$/m),
            fracFeed: F({ feed: 812.5, plunge: 137.25 }),
        };
    });
    // THE FLOOR SURVIVES for a typed number — this is the assert that would have caught a plain val().
    expect(r.zeroStep, 'a typed ZERO stepdown still floors to 0.01, exactly as it always did').toMatch(/^#43=0\.01\b/);
    expect(r.negStep, 'and a negative one').toMatch(/^#43=0\.01\b/);
    expect(r.tinyStep, 'and one below the floor').toMatch(/^#43=0\.01\b/);
    // …while values above the floor, and depth (which has no floor), print unchanged.
    expect(r.plainStep, 'an ordinary stepdown is untouched').toMatch(/^#43=0\.4\b/);
    expect(r.zeroDepth, 'a zero DEPTH has no floor and still prints 0').toMatch(/^#42=0\b/);
    expect(r.fracDepth, 'a fractional depth keeps its digits').toMatch(/^#42=1\.25\b/);
    expect(r.fracFeed, 'a fractional FEED prints as before — val() rounds a literal exactly as r3 did').toContain('F812.5');
    expect(r.fracFeed, 'and the fractional PLUNGE does too, which is the other word this turn moved').toContain('F137.25');
});

/**
 * @work STOPS DECLARING WHEN A KNOB GOES LIVE — t1383's rule, arriving on surfacing with the knobs that create the case.
 */
test('THE DECLARATION — @work is omitted once any input it multiplies is live, and kept when it is not', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines, surfaceRasterWorkSteps } = await import('/wizards/ops/surfaceraster.js');
        const { readDeclaredWork, traceCap } = await import('/engine/declaredWork.js');
        const B = { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 };
        const txt = (patch) => surfaceRasterLines({ ...B, ...patch }).join('\n');
        const numericTxt = txt({});
        const liveTxt = txt({ depth: '#2601' });
        return {
            numericWork: surfaceRasterWorkSteps(B), numericToken: readDeclaredWork(numericTxt),
            liveDepth: surfaceRasterWorkSteps({ ...B, depth: '#2601' }),
            liveStep: surfaceRasterWorkSteps({ ...B, stepdown: '#2602' }),
            liveW: surfaceRasterWorkSteps({ ...B, w: '#2605' }),
            liveToken: readDeclaredWork(liveTxt), liveHasMarker: /@work/.test(liveTxt),
            // a live FEED does not make the work unknowable — it multiplies nothing, so the declaration is KEPT
            liveFeedWork: surfaceRasterWorkSteps({ ...B, feed: '#2603' }),
            liveCap: traceCap(liveTxt, liveTxt.split('\n').length, 0),
        };
    });
    expect(r.numericWork, 'an all-numeric config declares a real count').toBeGreaterThan(100);
    expect(r.numericToken, 'and the token is in the emit').toBe(r.numericWork);
    expect(r.liveDepth, 'a live DEPTH makes the count unknowable → null').toBeNull();
    expect(r.liveStep, 'so does a live stepdown').toBeNull();
    expect(r.liveW, 'and any other input it multiplies, not just the two this turn made live').toBeNull();
    expect(r.liveToken, 'so the emit carries NO marker — omitted, never guessed').toBe(0);
    expect(r.liveHasMarker, 'not even an empty one').toBe(false);
    expect(r.liveFeedWork, 'but a live FEED multiplies nothing, so the declaration is KEPT').toBeGreaterThan(100);
    expect(r.liveCap.source, 'and the undeclared program falls back to the flow-aware floor, which says so if it truncates').toBe('flow-floor');
});

/**
 * THE FULL-DEPTH REGION — stepdown >= depth, i.e. levels = 1 (t1399 amendment, user request: depth-first clearing).
 *
 * Making stepdown a pendant knob makes "one full-depth pass at a low stepover" something an operator can DIAL, not just
 * something an author can type. That is a parameter REGION of the existing walk rather than a new strategy — so it is
 * pinned here rather than built: the body must treat levels = 1 as first-class, with no multi-level assumption hiding in
 * it, the ramp/helix entries must descend the WHOLE depth in one go, and `@work` must be right at one level.
 *
 * (The user also ruled OUT a wizard preset for it — per-wizard setting persistence already covers the workflow — so this
 * is coverage of an existing capability, and nothing was built for it.)
 */
test('FULL DEPTH — levels = 1 at a low stepover is first-class, on both strategies and every entry', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines, surfaceRasterWorkSteps } = await import('/wizards/ops/surfaceraster.js');
        const { traceToolpath } = await import('/engine/trace.js');
        // depth 3, stepdown 3 → exactly ONE level; stepover 10% of a 6mm tool → 0.6mm, a fine pass.
        const D = { w: 60, h: 40, depth: 3, stepdown: 3, toolDia: 6, stepoverPct: 10, feed: 900, plunge: 180, clearance: 5 };
        const CASES = {
            raster: { ...D, strategy: 'raster' },
            concentric: { ...D, strategy: 'concentric' },
            ramp: { ...D, strategy: 'raster', entry: 'ramp', rampAngle: 3 },
            helix: { ...D, strategy: 'raster', entry: 'helix', helixDia: 4, helixPitch: 1 },
            deeperStep: { ...D, stepdown: 10 },            // stepdown well PAST the depth — still one level, not zero
            liveStepAtDepth: { ...D, stepdown: '#2602' },  // …and the same region reached by a pendant knob
        };
        const out = {};
        for (const [k, c] of Object.entries(CASES)) {
            const txt = ['G90', ...surfaceRasterLines(c), 'M30'].join('\n');
            const tr = traceToolpath(txt);
            const cuts = (tr.segments || []).filter((s) => !s.rapid);
            out[k] = {
                work: surfaceRasterWorkSteps(c),
                cuts: cuts.length,
                capped: tr.stats.capped,
                // every cut must sit at the FULL depth — one level means no intermediate floors
                depths: [...new Set(cuts.map((s) => +s.z2.toFixed(3)))].sort((a, b) => a - b),
                seed: (txt.match(/^#43=.*$/m) || [])[0],
            };
        }
        return out;
    });
    for (const k of ['raster', 'concentric', 'ramp', 'helix', 'deeperStep']) {
        expect(r[k].cuts, `${k}: the single level really cuts`).toBeGreaterThan(10);
        expect(r[k].capped, `${k}: and traces whole`).toBe(false);
        expect(r[k].work, `${k}: @work is declared at one level`).toBeGreaterThan(10);
    }
    // ONE LEVEL MEANS ONE CUTTING FLOOR. A body carrying a multi-level assumption would show intermediate Z floors here;
    // the ramp/helix entries descend THROUGH the depth, so their DESCENT touches other Z values — which is why this is
    // asserted on the flat strategies, where every cut belongs to the floor.
    expect(r.raster.depths, 'raster at one level cuts at exactly one Z — the full depth').toEqual([-3]);
    expect(r.concentric.depths, 'and so does concentric').toEqual([-3]);
    expect(r.deeperStep.depths, 'a stepdown PAST the depth clamps to the depth, it does not overshoot').toEqual([-3]);
    // the entries still reach the floor, having descended the whole way in one go
    expect(r.ramp.depths, 'the ramp descends the whole depth and finishes at the floor').toContain(-3);
    expect(r.helix.depths, 'and the helix').toContain(-3);
    // …and the region is reachable from the PENDANT, which is what the val() knobs bought.
    expect(r.liveStepAtDepth.seed, 'a live stepdown reaches the same region').toMatch(/^#43=#2602\b/);
    expect(r.liveStepAtDepth.work, 'and its work is undeclared, because a dialled stepdown is unknowable at build').toBeNull();
});

/**
 * THE CAM SURFACE — the four knobs are classified exposable end to end, and the geometry that folds at BUILD time is not.
 */
test('THE CAM ROWS — feed/plunge/depth/stepdown expose; build-time geometry stays baked', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { classifyExposable } = await import('/data/exposeClassifier.js');
        const { surfacingDataDef } = await import('/blocks/dataOps/surfacingData.js');
        const c = classifyExposable(surfacingDataDef());
        const pick = (k) => (c[k] ? { exposable: c[k].exposable, role: c[k].role } : null);
        return { feed: pick('feed'), plunge: pick('plunge'), depth: pick('depth'), stepdown: pick('stepdown'),
            w: pick('w'), h: pick('h'), toolDia: pick('toolDia'), stepoverPct: pick('stepoverPct'), strategy: pick('strategy') };
    });
    for (const k of ['feed', 'plunge', 'depth', 'stepdown']) {
        expect(r[k], `${k} is classified`).not.toBeNull();
        expect(r[k].role, `${k} is a value role`).toBe('value');
        expect(r[k].exposable, `${k} is a pendant knob at last`).toBe(true);
    }
    // …and the line held: geometry that a #var would destroy at BUILD time is still baked, per key.
    expect(r.w.exposable, 'the area W folds into the ring count at build → baked').toBe(false);
    expect(r.h.exposable, 'and H').toBe(false);
    expect(r.toolDia.exposable, 'the tool Ø composes the stepover expression from baked numbers → baked').toBe(false);
    expect(r.stepoverPct.exposable, 'as does the percentage').toBe(false);
    expect(r.strategy.exposable, 'and a discrete selector is never a tuned value').toBe(false);
});
