import { test, expect } from '@playwright/test';

/**
 * t1383 — THE TRACE CAP IS DECLARED WORK, NOT INFERRED TEXT LENGTH.
 *
 * t1381 reported the sharpest defect of the drill arc: the tracer's runaway guard was `max(program.length * 50, 5000)`
 * steps — sized by the ONE quantity a parametric loop collapses. A literal helical bore on a 24-hole bolt circle is
 * ~11700 lines (cap ~585k, traces whole); the parametric body emitting the IDENTICAL path is 43 lines, gets the 5000
 * floor, and truncates at about a twelfth of the 117061 steps it needs. `stats.capped` reported it and NOTHING read it,
 * so the 2D/3D preview drew a partial toolpath that looked finished.
 *
 * The ruling: the emitter DECLARES its expected execution size (it already computes the counts), the tracer's cap is
 * declared x a margin, an undeclared program gets a flow-aware floor, and a truncated preview SAYS SO.
 *
 * ⚠ WHAT MAKES THIS SPEC NON-VACUOUS: the parametric body is traced WITHOUT any `traceStepCap` override. t1381's own
 * bridges all pass one (that was the opt-in seam it added so they could tell the truth at all). Here the DEFAULT path
 * is the thing under test, so an override would test nothing.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * THE DEFECT ITSELF, at the default: the config t1381 measured as truncating now traces WHOLE, with no override.
 */
test('THE DEFECT — a bolt-24 helical bore traces to completion at the DEFAULT cap', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { holeCycleLines, holeCycleWorkSteps } = await import('/wizards/ops/holecycle.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const { readDeclaredWork, WORK_MARGIN } = await import('/engine/declaredWork.js');
        const NL = String.fromCharCode(10);
        // the exact shape t1381 measured: 24 holes, helical bore, deep enough to need many revolutions
        const cfg = { pattern: 'circle', dia: 100, count: 24, cycle: 'bore-helix',
            holeDia: 12, toolDia: 6, depth: 10, pitch: 0.5, feed: 120, clearance: 5 };
        const text = ['G90', ...holeCycleLines(cfg), 'M30'].join(NL);
        const t0 = performance.now();
        const tr = traceToolpath(text);            // NO traceStepCap — the default path is the point
        const ms = performance.now() - t0;
        return {
            lines: text.split(NL).length, declared: readDeclaredWork(text), workSteps: holeCycleWorkSteps(cfg),
            capped: tr.stats.capped, cappedWhy: tr.stats.cappedWhy, segs: tr.segments.length, margin: WORK_MARGIN, ms,
        };
    });
    // The body really is short — so a length-sized cap really would have hit its floor. This is the premise, asserted.
    expect(r.lines, 'the parametric body is short — which is exactly why length was the wrong proxy').toBeLessThan(80);
    // The declaration rides IN the emit and is read back out of the text.
    expect(r.declared, 'the emitted program carries its own declared work').toBe(r.workSteps);
    expect(r.declared, 'and it is a large number — six orders above the old 5000 floor for a 43-line body').toBeGreaterThan(100_000);
    // THE FIX: no truncation, at the default.
    expect(r.capped, 'the path traces to completion with NO traceStepCap override').toBe(false);
    expect(r.cappedWhy, 'so there is no truncation sentence to show').toBe('');
    expect(r.segs, 'and the drawn route is the whole helix, not a twelfth of it').toBeGreaterThan(10_000);
});

/**
 * THE DECLARATION IS CALIBRATED, not decorative — it is compared against the steps the engine ACTUALLY takes.
 *
 * This is the assert that keeps the whole mechanism honest: a declaration nobody checks against reality is just a
 * number that happens to be big enough today. If a future cycle edit changes the body's line count, the ratio moves and
 * this fails while the margin still hides it from users.
 */
test('THE DECLARATION — matches the steps the engine really takes, well inside the margin', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { holeCycleLines, holeCycleWorkSteps } = await import('/wizards/ops/holecycle.js');
        const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
        const NL = String.fromCharCode(10);
        const CASES = {
            peckSingle: { pattern: 'single', cycle: 'peck', depth: 20, peck: 2, feed: 100, clearance: 5 },
            peckBolt24: { pattern: 'circle', dia: 100, count: 24, cycle: 'peck', depth: 20, peck: 2, feed: 100, clearance: 5 },
            peckGrid: { pattern: 'grid', cols: 4, rows: 3, dx: 20, dy: 20, cycle: 'peck', depth: 12, peck: 3, feed: 100, clearance: 5 },
            stepBolt8: { pattern: 'circle', dia: 60, count: 8, cycle: 'bore-step', holeDia: 12, toolDia: 6, depth: 10, pitch: 0.5, feed: 120, clearance: 5 },
            helixSingle: { pattern: 'single', cycle: 'bore-helix', holeDia: 12, toolDia: 6, depth: 10, pitch: 0.5, feed: 120, clearance: 5 },
            helixBolt24: { pattern: 'circle', dia: 100, count: 24, cycle: 'bore-helix', holeDia: 12, toolDia: 6, depth: 10, pitch: 0.5, feed: 120, clearance: 5 },
            helixDeep: { pattern: 'circle', dia: 100, count: 24, cycle: 'bore-helix', holeDia: 12, toolDia: 6, depth: 20, pitch: 0.25, feed: 120, clearance: 5 },
            rectPerim: { pattern: 'rect', w: 80, h: 60, nx: 4, ny: 4, cycle: 'peck', depth: 10, peck: 2, feed: 100, clearance: 5 },
        };
        const out = {};
        for (const [k, cfg] of Object.entries(CASES)) {
            const text = ['G90', ...holeCycleLines(cfg), 'M30'].join(NL);
            // Count the REAL steps with the guard effectively disabled, so the number is the truth and not the cap.
            const eng = new GcodeExecutionEngine({ autoAnswer: true });
            eng.traceStepCap = 50_000_000;
            const tr = eng.trace(text);
            const real = eng.stats.steps;
            eng.dispose();
            out[k] = { declared: holeCycleWorkSteps(cfg), real, capped: tr.stats.capped };
        }
        return out;
    });
    for (const [k, v] of Object.entries(r)) {
        expect(v.capped, `${k}: the reference run itself is not truncated (else "real" would be the cap)`).toBe(false);
        expect(v.real, `${k}: the body really executes something`).toBeGreaterThan(10);
        // The declaration must COVER the real work (that is its job) and not by an absurd factor (that would make the
        // guard useless). Both bounds, so neither an under- nor an over-declaration passes silently.
        expect(v.declared * 4, `${k}: declared ${v.declared} x margin 4 covers the real ${v.real} steps`).toBeGreaterThanOrEqual(v.real);
        expect(v.declared, `${k}: and does not over-declare by more than 3x (real ${v.real})`).toBeLessThan(Math.max(3000, v.real * 3));
    }
});

/**
 * SURFACING WAS ALREADY BROKEN — and this is the assert that says the fix is about a SHIPPING op, not a precaution.
 *
 * t1381 reported the length-sized cap as a risk the drill switch would create. It was already live: `surfaceraster` has
 * emitted every surfacing program since t1359 and is ~49 lines whatever the area, so its cap was the 5000-step floor
 * while its work is unbounded. Measured this turn with the guard off: a 0.1/10% face needs 29376 steps (it drew 17% of
 * its path) and a 600x400 at 0.2/15% needs 115698 (4.3%). Silently, both times.
 */
test('SURFACING — the shipping op that was silently truncating now declares, and traces whole', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines, surfaceRasterWorkSteps } = await import('/wizards/ops/surfaceraster.js');
        const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const S = { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 };
        const CASES = {
            plain: S,
            fine: { ...S, stepoverPct: 10, stepdown: 0.1, toolDia: 6 },
            big: { w: 600, h: 400, depth: 4, stepdown: 0.2, toolDia: 6, stepoverPct: 15, feed: 900, plunge: 180, clearance: 5 },
            concentric: { ...S, strategy: 'concentric' },
            concFine: { ...S, strategy: 'concentric', stepoverPct: 10, stepdown: 0.1, toolDia: 6 },
            ramp: { ...S, entry: 'ramp', rampAngle: 3, stepdown: 0.1 },
            helix: { ...S, entry: 'helix', helixDia: 8, helixPitch: 1, stepdown: 0.1 },
            helixDeep: { ...S, entry: 'helix', helixDia: 8, helixPitch: 0.25, depth: 3, stepdown: 0.25 },
        };
        const out = {};
        for (const [k, cfg] of Object.entries(CASES)) {
            const text = ['G90', ...surfaceRasterLines(cfg), 'M30'].join(NL);
            const eng = new GcodeExecutionEngine({ autoAnswer: true });
            eng.traceStepCap = 50_000_000;
            eng.trace(text);
            const real = eng.stats.steps;
            eng.dispose();
            // …and the DEFAULT path, which is what a user's preview actually runs.
            const tr = traceToolpath(text);
            out[k] = { declared: surfaceRasterWorkSteps(cfg), real, lines: text.split(NL).length,
                capped: tr.stats.capped, oldCap: Math.max(text.split(NL).length * 50, 5000) };
        }
        return out;
    });
    let everTruncatedBefore = 0;
    for (const [k, v] of Object.entries(r)) {
        expect(v.capped, `${k}: traces whole at the DEFAULT cap now`).toBe(false);
        expect(v.declared * 4, `${k}: declared ${v.declared} x4 covers the real ${v.real}`).toBeGreaterThanOrEqual(v.real);
        expect(v.declared, `${k}: and does not over-declare absurdly (real ${v.real})`).toBeLessThan(Math.max(2000, v.real * 2));
        if (v.real > v.oldCap) everTruncatedBefore += 1;
    }
    // THE PREMISE, ASSERTED rather than asserted-in-prose: some of these really did exceed the old cap. If a future
    // change made every surfacing body small, this spec would be quietly testing nothing.
    expect(everTruncatedBefore, 'several of these configs really did overrun the old length-sized cap — the defect was live').toBeGreaterThanOrEqual(3);
});

/**
 * THE FALLBACK — an UNDECLARED program that loops is not sized by its text length.
 *
 * This is the branch for text nobody declared: a hand-written pendant macro, another CAM system's .nc. It is not
 * inference standing in for a declaration — there is no declaration to be had — so it splits on the one fact the text
 * does honestly carry: whether it contains a loop at all.
 */
test('THE FALLBACK — a hand-written loop gets the flow-aware floor; straight-line code does not', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { traceCap, hasFlow, FLOW_FLOOR } = await import('/engine/declaredWork.js');
        const NL = String.fromCharCode(10);
        // A tiny hand-written macro that legitimately executes far more steps than it has lines.
        const looped = ['G90', '#10=0', 'WHILE [#10 < 400] DO1', '  #10=[#10 + 1]', '  G1 X#10 F500', '  G1 X0', 'END1', 'M30'].join(NL);
        const straight = ['G90', 'G0 X0 Y0', 'G1 X10 F100', 'G1 Y10', 'M30'].join(NL);
        return {
            loopFlow: hasFlow(looped), straightFlow: hasFlow(straight),
            loopCap: traceCap(looped, 8, 0), straightCap: traceCap(straight, 5, 0),
            declaredWins: traceCap('( ---- x · @work 900000 ---- )' + NL + 'WHILE [#1 < 2] DO1' + NL + 'END1', 3, 0),
            floor: FLOW_FLOOR,
        };
    });
    expect(r.loopFlow, 'a WHILE/DO body is recognised as carrying flow').toBe(true);
    expect(r.straightFlow, 'straight-line G-code is not').toBe(false);
    expect(r.loopCap.source, 'an undeclared loop gets the flow-aware floor, not 50x its 8 lines').toBe('flow-floor');
    expect(r.loopCap.cap, 'which is the measured floor').toBe(r.floor);
    expect(r.straightCap.source, 'straight-line code keeps the length rule — a short linear program needs no more').toBe('length');
    expect(r.straightCap.cap, 'and is nowhere near the loop floor').toBeLessThan(r.floor);
    // A DECLARATION BEATS THE FLOOR IN BOTH DIRECTIONS: it is the source of truth, so a program declaring MORE than the
    // floor gets more (this is the case the ruling is about) …
    expect(r.declaredWins.source, 'a declared program is sized by its declaration').toBe('declared');
    expect(r.declaredWins.cap, 'and 900k declared x 4 outruns the undeclared floor').toBeGreaterThan(r.floor);
});

/**
 * A TRUNCATED PREVIEW SAYS SO — the other half of the ruling, and the half that was purely missing.
 *
 * `stats.capped` was already true and already correct. The defect was that nothing read it, so a partial toolpath was
 * indistinguishable from a finished one in the surface a user checks a program against before cutting.
 */
test('THE HONESTY — a truncated trace carries the sentence, and the preview shows it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { traceToolpath } = await import('/engine/trace.js');
        const { truncationReason } = await import('/engine/declaredWork.js');
        const NL = String.fromCharCode(10);
        // A GENUINE runaway: a loop whose condition never resolves. This is what the guard is for, and it must still fire.
        const runaway = ['G90', '#10=0', 'WHILE [#10 < 1] DO1', '  G1 X1 F100', '  G1 X0', 'END1', 'M30'].join(NL);
        const t0 = performance.now();
        const tr = traceToolpath(runaway);
        const ms = performance.now() - t0;
        // …and an UNDER-DECLARED program: the declaration says 100 steps, the body runs far past 4x that. That is a bug in
        // the declaration, and it must surface as a truncation rather than be trusted.
        const under = ['( ---- fake · @work 100 ---- )', 'G90', '#10=0', 'WHILE [#10 < 1] DO1', '  G1 X1 F100', 'END1', 'M30'].join(NL);
        const tu = traceToolpath(under);
        return {
            capped: tr.stats.capped, why: tr.stats.cappedWhy, ms,
            underCapped: tu.stats.capped, underWhy: tu.stats.cappedWhy,
            phrasing: truncationReason({ cap: 5000, declared: 0, source: 'flow-floor' }),
        };
    });
    expect(r.capped, 'a genuine runaway still gives up — the guard did not become toothless').toBe(true);
    expect(r.why, 'and it SAYS it truncated, in words a user can act on').toMatch(/truncated/i);
    expect(r.why, 'naming the consequence explicitly, not just the mechanism').toMatch(/INCOMPLETE/);
    expect(r.ms, 'and it gives up promptly — the floor is a bound, not a hang').toBeLessThan(8000);
    // AN UNDER-DECLARATION IS CAUGHT, and reads differently, because the action it calls for is different: a wrong
    // declaration is a bug to report, an undeclared runaway is a bug in the G-code.
    expect(r.underCapped, 'a program that overran its OWN declaration truncates too — the declaration is not blind trust').toBe(true);
    expect(r.underWhy, 'and says the declaration was overrun').toMatch(/declared/i);
    expect(r.phrasing, 'the one phrasing lives in declaredWork.js so every surface says the same thing').toMatch(/truncated/i);
});

/**
 * THE PREVIEW SURFACE, for real — the status line the panel already owns, driven by a truncated trace.
 * Asserted through the DOM rather than the trace result, because "the preview says so" is a claim about the pixel.
 */
test('THE SURFACE — the preview status line carries the truncation', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { createPreviewPanel } = await import('/viz/createPreviewPanel.js');
        const NL = String.fromCharCode(10);
        const runaway = ['G90', '#10=0', 'WHILE [#10 < 1] DO1', '  G1 X1 F100', '  G1 X0', 'END1', 'M30'].join(NL);
        const host = document.createElement('div');
        host.style.cssText = 'width:900px;height:520px';
        document.body.appendChild(host);
        const panel = createPreviewPanel(host, { getGcode: () => runaway });
        panel.setGcode(runaway);
        await new Promise((res) => setTimeout(res, 400));
        const el = host.querySelector('.pp-status');
        const out = { text: el ? el.textContent : null, isError: el ? el.classList.contains('has-error') : null };
        try { panel.stop(); } catch (_) { /* teardown best-effort */ }
        host.remove();
        return out;
    });
    expect(r.text, 'the panel status line reports the truncation to the user').toMatch(/truncated/i);
    expect(r.text, 'and says the path is incomplete').toMatch(/INCOMPLETE/);
    expect(r.isError, 'styled as an error — an incomplete toolpath is not a warning-level fact').toBe(true);
});
