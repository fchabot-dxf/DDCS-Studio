import { test, expect } from '@playwright/test';

/**
 * t1440 — THE DECLARED-WORK AUDIT, BY DIFFERENCING AGAINST THE ENGINE'S OWN STEP COUNT.
 *
 * ── WHAT WENT WRONG, AND WHY IT IS A CLASS RATHER THAN AN INSTANCE ────────────────────────────────────────────────
 * `@work` declares EXECUTED lines; the tracer sizes its runaway guard at 4× it (engine/declaredWork.js), and t1383
 * measured what an undersized cap costs — a preview silently drawing a fraction of the toolpath. The declarations
 * were built by COUNTING THE EMITTED BODY. A walk's body is full of forks, and only one arm of each fork executes
 * per pass, so counting lines counts what you can SEE rather than what the controller RUNS. The both-ways row is
 * 20 lines and 13 steps.
 *
 * ── THE METHOD, WHICH IS WHY THESE NUMBERS ARE FACTS ──────────────────────────────────────────────────────────────
 * The cap override only ever RAISES the guard (`traceCap` takes a max), so the count cannot be found by squeezing it.
 * Instead the engine's own `_executeStep` is instrumented and the body run to completion; then two AREAS at one depth
 * difference out the per-pass term, and two DEPTHS at one area difference out the per-level term and the header.
 * Nothing here counts a line.
 *
 * ── THE ONE THAT WAS ON THE WRONG SIDE ────────────────────────────────────────────────────────────────────────────
 * Over-declaring is safe (the cap draws more than needed); UNDER-declaring truncates. Three of the four corrections
 * were safe-direction overstatements. The helix's per-segment cost (`* 10` against a measured 10.46) and the wall's
 * header (6 against 9) were UNDER — the direction that loses toolpath — and neither had ever surfaced because the 4×
 * margin was absorbing them.
 */
test.use({ viewport: { width: 1200, height: 800 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram, null, { timeout: 20000 });
};

/** Instrument the engine's step call and run a body to completion — the real executed-line count. */
const STEPS = `
async () => {
    const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
    return (nc) => {
        const eng = new GcodeExecutionEngine({ autoAnswer: true });
        let n = 0;
        const orig = eng._executeStep.bind(eng);
        eng._executeStep = (s) => { n++; return orig(s); };
        eng.traceStepCap = 8000000;
        const res = eng.trace(nc);
        return { n, capped: !!res.stats.capped };
    };
}`;

/**
 * EVERY DECLARING CONFIG, DECLARED vs EXECUTED. The claim is two-sided and both sides matter:
 *   never UNDER  — an under-declaration truncates the preview, which is the defect t1383 exists to prevent.
 *   never far OVER — a declaration wrong by more than 4x is, by the module's own words, a bug in the declaration;
 *                    this holds it to 1.15x, which is far tighter and is what makes it a calibration rather than
 *                    a shrug.
 */
test('THE SURFACING FAMILY — declared work matches the engine, per walk and per descent', async ({ page }) => {
    await boot(page);
    const rows = await page.evaluate(async (STEPS) => {
        // eslint-disable-next-line no-eval
        const steps = await eval(STEPS)();
        const { surfaceRasterLines, surfaceRasterWorkSteps } = await import('/wizards/ops/surfaceraster.js');
        const BASE = { x: 0, y: 0, z0: 0, w: 200, inset: 0, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5, rampAngle: 3, helixDia: 8, helixPitch: 0.5 };
        const out = [];
        for (const strategy of ['parallel', 'concentric']) {
            for (const direction of (strategy === 'parallel' ? ['bothways', 'oneway'] : ['bothways'])) {
                for (const entry of ['plunge', 'ramp', 'helix']) {
                    /**
                     * ── t1528 — THE MATRIX GAINS ITS TWO DARK DIMENSIONS: the INSET and the ROW ANCHOR ────────────
                     *
                     * Every row of this audit ran at `inset: 0` and at the default anchor, and BOTH hid a term that
                     * was on the truncating side. An inset brings four executed statements of its own machinery
                     * (t1404's two span guards plus the GOTO/label pair); a WALL-anchored row emits C1's far-wall
                     * clamp on EVERY pass, so its per-pass cost is one higher than the fit walk's — and `wall` is
                     * what every packed CAM slot uses, so that one was the shipped path. Neither could be seen by a
                     * matrix that never varied the dimension, which is the real lesson of both: a constant nobody
                     * exercises goes wrong again the next time the emit grows a line. Varied here so the class
                     * cannot go dark a third time.
                     */
                    for (const [h, depth, inset, rowAnchor] of [
                        [150, 0.5, 0, 'fit'], [150, 2.0, 0, 'fit'], [40, 1.0, 0, 'fit'],
                        [150, 0.5, 6, 'fit'], [150, 2.0, 6, 'wall'], [40, 1.0, 0, 'wall'],
                        [150, 1.0, 6, 'wall'],   // both at once — the terms must be independent, not one fudge
                    ]) {
                        const p = { ...BASE, h, depth, stepdown: 0.5, strategy, direction, entry, inset, rowAnchor };
                        const r = steps(surfaceRasterLines(p).join(String.fromCharCode(10)));
                        out.push({ k: `${strategy}/${direction}/${entry} h${h} d${depth} i${inset} ${rowAnchor}`,
                                   declared: surfaceRasterWorkSteps(p), real: r.n, capped: r.capped });
                    }
                }
            }
        }
        return out;
    }, STEPS);

    for (const r of rows) {
        expect(r.capped, `${r.k}: the body ran to completion (an incomplete run measures nothing)`).toBe(false);
        expect(r.real, `${r.k}: it really executes work`).toBeGreaterThan(20);
        expect(r.declared >= r.real, `${r.k}: declared ${r.declared} must not be UNDER the executed ${r.real} — under-declaring truncates the preview`).toBe(true);
        expect(r.declared / r.real, `${r.k}: declared ${r.declared} vs executed ${r.real} — calibrated, not merely inside the 4x margin`).toBeLessThanOrEqual(1.15);
    }
    // …and the PLUNGE + RAMP rows are EXACT, which is what makes the model's shape (per-walk level overhead, a
    // walk-independent descent cost) a measured structure rather than a curve fitted to a few points.
    // t1528 — and they are exact over the INSET and ANCHOR dimensions too, which is the stronger claim: two terms
    // added in one act could have been one fudge covering both, and a row carrying BOTH at once says they are not.
    for (const r of rows.filter((x) => /plunge|ramp/.test(x.k))) {
        expect(r.declared, `${r.k}: exact — the model is the structure, not a fit`).toBe(r.real);
    }
    // the matrix really does exercise what it claims to (a row list edited down to nothing would pass silently)
    expect(rows.filter((x) => / i6 /.test(x.k)).length, 'the matrix carries non-zero-inset rows').toBeGreaterThan(8);
    expect(rows.filter((x) => / wall$/.test(x.k)).length, '…and wall-anchored rows').toBeGreaterThan(8);
});

/**
 * THE THREE PER-PASS CONSTANTS, PINNED BY DIFFERENCING — the numbers, not just the totals.
 *
 * A total can be right for the wrong reasons (two errors cancelling). Differencing two AREAS at one depth isolates
 * the per-pass term alone, so this asserts the constants themselves. t1418's `11` for the one-way row is asserted
 * UNCHANGED here: it was the one number derived by counting what executes rather than what is written, and the audit
 * that moved the other two confirms it.
 */
test('THE PER-PASS CONSTANTS — 13 both-ways · 11 one-way · 12 concentric, differenced from real steps', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (STEPS) => {
        // eslint-disable-next-line no-eval
        const steps = await eval(STEPS)();
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const BASE = { x: 0, y: 0, z0: 0, w: 200, inset: 0, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5, entry: 'plunge', depth: 0.5, stepdown: 0.5 };
        const step = 12 * 0.6;
        const passes = (strategy, h) => (strategy === 'concentric'
            ? Math.max(1, Math.floor((Math.min(200, h) - 0.001) / (2 * step)) + 1)
            : Math.max(1, Math.floor((h - step / 2) / step) + 1));
        const solve = (strategy, direction) => {
            const big = steps(surfaceRasterLines({ ...BASE, h: 150, strategy, direction }).join(String.fromCharCode(10))).n;
            const small = steps(surfaceRasterLines({ ...BASE, h: 40, strategy, direction }).join(String.fromCharCode(10))).n;
            const pB = passes(strategy, 150), pS = passes(strategy, 40);
            return { perPass: (big - small) / (pB - pS), pB, pS };
        };
        return {
            bothways: solve('parallel', 'bothways'),
            oneway: solve('parallel', 'oneway'),
            concentric: solve('concentric', 'bothways'),
        };
    }, STEPS);
    expect(r.bothways.pB - r.bothways.pS, 'the two areas really differ in pass count — otherwise the difference is 0/0').toBeGreaterThan(5);
    expect(r.bothways.perPass, 'the both-ways row executes 13 steps per pass (its BODY is 20 lines — only one arm of each fork runs)').toBe(13);
    expect(r.oneway.perPass, 'the one-way row executes 11 — t1418 counted this one correctly, and it is unchanged').toBe(11);
    expect(r.concentric.perPass, 'a concentric ring executes 12, not the 14 declared since t1329').toBe(12);
});

/**
 * THE WALL, and the SIBLING SWEEP'S OTHER HALF — `holecycle` was audited the same way and needed no change.
 *
 * A sweep that only reports what it changed is indistinguishable from one that only looked where it expected to find
 * something. `holecycle`'s peck declaration is asserted here IN THE SAME TEST as the wall's corrections, so "it was
 * checked and it was right" is a recorded fact rather than a claim in a work log.
 */
test('THE WALL + HOLECYCLE — the wall header was UNDER, and holecycle needed no change', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (STEPS) => {
        // eslint-disable-next-line no-eval
        const steps = await eval(STEPS)();
        const { wallFinishLines, wallFinishWorkSteps } = await import('/wizards/ops/wallfinish.js');
        const { holeCycleLines, holeCycleWorkSteps } = await import('/wizards/ops/holecycle.js');
        const { activeDialectOpts } = await import('/wizards/previewEmit.js');
        const D = activeDialectOpts().dialect;
        const W = { x: 0, y: 0, z0: 0, w: 200, h: 150, inset: 6, stepdown: 0.5, feed: 2000, plunge: 150, clearance: 5 };
        const wall = [];
        for (const [depth, confirmEvery] of [[0.5, 0], [1.0, 0], [2.0, 0], [2.0, 2], [6.0, 3]]) {
            const p = { ...W, depth, confirmEvery };
            wall.push({ k: `d${depth} c${confirmEvery}`, declared: wallFinishWorkSteps(p), real: steps(wallFinishLines(p, D).join(String.fromCharCode(10))).n });
        }
        const holes = [];
        const HC = { x0: 0, y0: 0, z0: 0, holeDia: 6, toolDia: 6, feed: 300, clearance: 5, cycle: 'peck', pattern: 'line', spacing: 20, angle: 0 };
        for (const [count, depth, peck] of [[1, 4, 1], [1, 8, 1], [4, 4, 1], [4, 8, 0.5]]) {
            const p = { ...HC, count, depth, peck };
            holes.push({ k: `n${count} d${depth} p${peck}`, declared: holeCycleWorkSteps(p), real: steps(holeCycleLines(p).join(String.fromCharCode(10))).n });
        }
        return { wall, holes };
    }, STEPS);

    for (const w of r.wall) {
        expect(w.declared >= w.real, `wall ${w.k}: declared ${w.declared} must not be UNDER the executed ${w.real}`).toBe(true);
        expect(w.declared / w.real, `wall ${w.k}: ${w.declared} vs ${w.real} — calibrated`).toBeLessThanOrEqual(1.15);
    }
    // the exact case that caught it: one level, no confirm — the header alone, which was declared 6 against 9
    expect(r.wall[0].real, 'a one-level wall executes 20 steps (header 9 + one level of 11)').toBe(20);
    expect(r.wall[0].declared, 'and it is declared as exactly that now').toBe(20);
    // holecycle: UNCHANGED by this act, and asserted so rather than assumed
    for (const h of r.holes) {
        expect(h.declared >= h.real, `holecycle ${h.k}: declared ${h.declared} covers the executed ${h.real}`).toBe(true);
        expect(h.declared / h.real, `holecycle ${h.k}: ${h.declared} vs ${h.real} — already calibrated; this act changed nothing here`).toBeLessThanOrEqual(1.2);
    }
});
