import { test, expect } from '@playwright/test';

/**
 * t1431 — REST IS DIAGNOSED, NOT HALF-BUILT: the declared boundary, and the MEASUREMENT that keeps it honest.
 *
 * The T3 tail asked for `pocketwall` and `pocketrest` to become parametric bodies, with rest diagnosed FIRST — if the
 * corner-clear's geometry cannot be a runtime macro loop without SQRT-class maths, it stays literal in a NAMED
 * boundary row (the contour precedent) rather than being half-built.
 *
 * IT CANNOT, AND THIS COUNTS THE REASON RATHER THAN ASSERTING IT. A declaration about somebody else's kernel rots the
 * moment that kernel changes, so this instruments `Math.sqrt` on the REAL walk and requires the obstruction to still
 * be there. The day the rest walk stops needing square roots — the improvement turn that settles SQRT on the machine,
 * or a re-shaped mask — this spec goes RED and `REST_PARAMETRIC_GAP` has to come out. That is the same lock
 * `cam-row-honesty-1414` uses, pointed at a boundary instead of at a row.
 */
test.use({ viewport: { width: 1200, height: 900 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('THE MEASUREMENT — the rest walk really does need square roots, so the boundary is earned', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/restmachining.js');
        const P = { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, wallOffset: 0,
            toolDia: 6, restDia: 3, restStepover: 40, depth: 4, by: 1.5, feed: 600, plunge: 150, clearance: 5 };
        // instrument the REAL walk — not a re-implementation of it
        const real = Math.sqrt; let roots = 0;
        Math.sqrt = (x) => { roots++; return real(x); };
        let moves, region;
        try {
            moves = m.restLevelMoves(P, { z: -1.5, clr: 5, feed: 600, plunge: 150 });
            region = m.restRegion(P);
        } finally { Math.sqrt = real; }
        return {
            roots, moves: moves.length, corners: region.corners, ringPts: region.ring2.length,
            gap: m.restParametricGap(P),
            gapNoRest: m.restParametricGap({ ...P, restDia: 0 }),
            gapSmooth: m.restParametricGap({ ...P, shape: 'circle' }),
            valid: m.restValid(P),
        };
    });

    // THE PREMISE — there IS a rest walk here, and it cuts something (a boundary declared over an empty walk is vacuous)
    expect(r.valid, 'the sample really is a valid rest case').toBe(true);
    expect(r.moves, 'and it emits a real corner-clearing pass').toBeGreaterThan(0);
    expect(r.corners, 'four corners on a rect').toBe(4);
    expect(r.ringPts, 'whose cleared-region ring is bounded by tessellated FILLET ARCS, not straight edges').toBeGreaterThan(8);
    // THE OBSTRUCTION — square roots on ONE depth level, in the corner mask. If this ever hits zero the walk has been
    // re-shaped and the declaration below is stale: delete it, do not relax the assert.
    expect(r.roots, 'ONE depth level of the real walk needs runtime square roots (dx = sqrt(R^2 - dy^2) per row per corner)').toBeGreaterThan(0);
    // THE DECLARATION SAYS SO, in the evidence's own words rather than in effort's
    expect(r.gap, 'and the boundary is declared, not left to be rediscovered').not.toBe('');
    expect(r.gap, 'naming the maths').toMatch(/sqrt/);
    expect(r.gap, 'and the evidence, which is the same one the raster ramp already stands on').toMatch(/unverified on this controller/);
    expect(r.gap, 'and refusing the cheap dodge explicitly, so nobody re-proposes it').toMatch(/square instead would need no root and would cut a different part/);
});

test('THE BOUNDARY IS ABOUT THE WALK, not about a pocket\'s numbers — so nothing can dial past it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/restmachining.js');
        const P = { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, wallOffset: 0, toolDia: 6, restDia: 3, restStepover: 40 };
        const gaps = {};
        // every dimension moved, in both directions — the obstruction is in the walk, so none of them may clear it
        for (const over of [{}, { w: 200, h: 150 }, { w: 12, h: 12 }, { toolDia: 20, restDia: 2 },
            { restStepover: 5 }, { restStepover: 100 }, { wallOffset: -1 }, { shape: 'polygon', dia: 60, sides: 6 }])
            gaps[JSON.stringify(over)] = m.restParametricGap({ ...P, ...over });
        return {
            gaps,
            // …and '' means "there is no rest pass to port at all", which is a different fact and has to read differently
            noTool: m.restParametricGap({ ...P, restDia: 0 }),
            smooth: m.restParametricGap({ ...P, shape: 'circle' }),
            tooBig: m.restParametricGap({ ...P, restDia: 6 }),
        };
    });
    for (const k of Object.keys(r.gaps)) expect(r.gaps[k], `${k}: still refused — the obstruction is the walk, not the numbers`).not.toBe('');
    expect(r.noTool, 'no rest tool declared -> no rest walk to port, so no gap').toBe('');
    expect(r.smooth, 'a smooth pocket leaves no corner material -> nothing to port').toBe('');
    expect(r.tooBig, 'a rest tool that is not smaller cannot reach the corners -> nothing to port').toBe('');
});
