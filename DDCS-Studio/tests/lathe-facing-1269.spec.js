import { test, expect } from '@playwright/test';

/**
 * t1269 — FACING, the lathe family's GATED PILOT. OD / parting / drilling do not start until this is right.
 *
 * THE GROUND TRUTH IS HAND-DERIVED, not read back from the code under test. For a Ø20 bar with 3mm of material
 * ahead of the finished face, cut 1mm per pass, a turner cuts at Z = 2, then 1, then 0 — three passes, the last one
 * landing ON the face. Every assertion below is anchored to that independently-known answer.
 *
 * WHY THE MACRO IS PARAMETRIC (user ruling): the passes are NOT unrolled. The emit writes a #var config header and
 * an IF/GOTO loop that runs on the controller, so the operator can change the allowance or the depth of cut ON THE
 * MACHINE and the program adapts. That makes the emit a RECIPE — and it means proving it works requires RUNNING the
 * loop, which is what the sim assertions do.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsStudio, null, { timeout: 15000 });
};

test('THE PASS LIST matches hand-derived turning — Ø20, 3mm to remove, 1mm per pass → Z 2, 1, 0', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const F = await import('/wizards/lathe/facing.js');
        return {
            base: F.facingPasses({ allowance: 3, doc: 1 }),
            finish: F.facingPasses({ allowance: 3, doc: 1, finish: 0.2 }),
            uneven: F.facingPasses({ allowance: 3, doc: 0.8 }),
            nothing: F.facingPasses({ allowance: 0, doc: 1 }),
        };
    });
    expect(r.base, 'the hand-derived case').toEqual([2, 1, 0]);
    // a finishing skim owns the last 0.2: roughing stops at 0.2, then one pass lands on the face
    expect(r.finish, 'roughing stops above the face and the finish pass takes the rest').toEqual([2, 1, 0.2, 0]);
    // an uneven depth of cut must never overshoot INTO the part — the last pass is clamped to the floor
    expect(r.uneven, 'the last pass is clamped to the face, not stepped past it').toEqual([2.2, 1.4, 0.6, 0]);
    expect(r.nothing, 'nothing to remove still leaves one skim at the face').toEqual([0]);
});

test('THE EMIT is a PARAMETRIC macro: a #var header, a controller-side loop, and X in RADIUS', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const F = await import('/wizards/lathe/facing.js');
        const L = await import('/data/lathe.js');
        const stack = F.facingStack({ barDiameter: 20, allowance: 3, doc: 1, clearance: 2, feed: 120, rpm: 900 });
        const assigns = stack.filter((b) => b.type === 'assign').map((b) => [b.params.var, b.params.value]);
        return {
            vars: F.FACING_VARS,
            assigns,
            loops: stack.filter((b) => b.type === 'ifgoto').map((b) => `${b.params.lhs}${b.params.op}${b.params.rhs}->${b.params.goto}`),
            labels: stack.filter((b) => b.type === 'label').map((b) => b.params.n),
            xStart: (assigns.find(([v]) => v === F.FACING_VARS.xStart) || [])[1],
            expectedX: String(L.radiusOf(20) + 2),
            unrolledMoves: stack.filter((b) => b.type === 'move').length,
        };
    });
    // the config header exists and every number the operator might change is in it
    const varNames = r.assigns.map(([v]) => v);
    expect(varNames, 'allowance, depth of cut, X start and feed are all declared up front')
        .toEqual(expect.arrayContaining([r.vars.allowance, r.vars.doc, r.vars.xStart, r.vars.feed]));
    // X IS A RADIUS: bar Ø20 → radius 10, + 2 clearance = 12. A diameter here would start the tool 12mm inside the bar.
    expect(r.xStart, 'the start X is bar RADIUS + clearance, through the one converter').toBe('12');
    expect(r.expectedX).toBe('12');
    // the loop is real: a label to jump back to, and a conditional that decides whether to
    expect(r.labels.length, 'the macro carries jump targets').toBeGreaterThan(0);
    expect(r.loops.length, 'and conditional jumps that drive the passes').toBeGreaterThan(0);
    expect(r.loops.some((l) => l.includes('->' + r.labels[0])), 'one of them jumps BACK — that is the pass loop').toBe(true);
    // NOT UNROLLED: three passes must not mean three copies of the cut moves
    expect(r.unrolledMoves, 'the move count is fixed — the passes come from the loop, not from repetition').toBeLessThan(10);
});

test('THE SIM RUNS THE LOOP — the resolved trace hits exactly the hand-derived Zs and ends at the face', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const F = await import('/wizards/lathe/facing.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const nc = emitProgram(F.facingStack({ barDiameter: 20, allowance: 3, doc: 1, clearance: 2, feed: 120 }));
        // traceToolpath is THE one program trace every preview uses - it resolves #vars and IF/GOTO, which is exactly
        // what has to be exercised here: an unrolled program would prove nothing about the loop.
        const { traceToolpath } = await import('/engine/trace.js');
        const text = typeof nc === 'string' ? nc : String(nc);
        const t = traceToolpath(text);
        // a trace segment is a LINE: (x1,z1) -> (x2,z2). The pass Zs are where a CUT ends at the centreline.
        const segs = (t.segments || []).map((s) => ({ x: s.x2, z: s.z2, cutting: !s.rapid && !s.probe }));
        return { nc: text, segs, count: segs.length };
    });
    // the trace is the proof the LOOP resolves — an unrolled program would prove nothing about IF/GOTO
    // CUTS that reach the centreline are the passes. Filtering on "ends at X0" alone also caught the opening
    // clearance rapid (G0 Z5 at X0) — a segment that is at the centre because the tool has not moved out yet.
    const cutZ = [...new Set(r.segs.filter((s) => s.cutting && Math.abs(s.x) < 0.001).map((s) => Math.round(s.z * 1000) / 1000))];
    expect(cutZ, 'every pass reaches the centreline, at exactly the hand-derived Zs').toEqual([2, 1, 0]);
    expect(r.segs.length, 'and the loop actually ran (a dead loop would trace almost nothing)').toBeGreaterThan(6);
    const last = r.segs[r.segs.length - 1];
    expect(Math.abs(last.x), 'it finishes retracted, clear of the bar').toBeGreaterThan(0);
});

test('THE MACRO IS READABLE — the header says what each number is, in the operator’s words', async ({ page }) => {
    await boot(page);
    const nc = await page.evaluate(async () => {
        const F = await import('/wizards/lathe/facing.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const out = emitProgram(F.facingStack({ barDiameter: 20, allowance: 3, doc: 1 }));
        return typeof out === 'string' ? out : String(out);
    });
    expect(nc, 'the config header names the material ahead of the face').toMatch(/material ahead of the face/i);
    expect(nc, 'and the depth per pass').toMatch(/depth per pass/i);
    // the RADIUS note is the one that stops a person "fixing" the number to a diameter
    expect(nc, 'and says the X value is a radius, where a turner would expect a diameter').toMatch(/RADIUS/);
});
