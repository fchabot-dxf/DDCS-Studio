import { test, expect } from '@playwright/test';

/**
 * t1305 — THE TAPER BRANCH MOVES ONTO THE CONTROLLER.
 *
 * The OD turn's straight/taper choice used to be made when the program was POSTED. That is correct for the program as
 * built and wrong the moment the operator does what this family's whole design invites: retune a diameter AT THE
 * MACHINE. A program built straight then ran full-length passes down a cone — safe, since it cuts less than it
 * should, but not re-planned, and the finish pass was left a ridge to take off in one bite.
 *
 * ── READ THE ASSERTS, NOT A TEXT DIFF ────────────────────────────────────────────────────────────────────────────
 * The program TEXT necessarily changed: it now carries all three routes and an IF that picks between them. So the
 * straight case is pinned by its EXECUTED MOVE LIST — what the sim actually does — against the same pass list
 * `odPasses` derives. A byte diff against the old emit is expected to differ and means nothing here.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async () => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ name: 'Rig', kind: 'lathe', chuck: 'axis' }, false);
    });
};

/**
 * Emit through the path the app resolves, optionally EDITING one header line first — which is exactly what an
 * operator does at the controller: they change the number, not the program.
 */
const run = (page, params, edit) => page.evaluate(async ({ p, e }) => {
    const uo = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_odturn');
    let nc = String(emitProgram(builderOf('user_lathe_odturn')({ ...uo.defaultParams(def), ...(p || {}) })));
    if (e) nc = nc.split('\n').map((l) => (l.startsWith(e.find) ? e.to : l)).join('\n');
    const segs = (traceToolpath(nc).segments || []).filter((s) => !s.rapid && !s.probe)
        .map((s) => ({ x1: +s.x1.toFixed(3), z1: +s.z1.toFixed(3), x2: +s.x2.toFixed(3), z2: +s.z2.toFixed(3) }));
    return { nc, segs };
}, { p: params, e: edit });

/** The truth, derived here: where a cone of these two radii reaches `x`, clamped into the turned length. */
const crossing = (x, rFace, rFar, depth) => {
    if (Math.abs(rFar - rFace) < 1e-9) return -depth;
    const z = -depth * (x - rFace) / (rFar - rFace);
    return Math.min(0, Math.max(-depth, z));
};

/** The roughing radii, outermost first, ending on the floor — the family's anchored-on-the-floor rule. */
const roughing = (barR, floor, doc) => {
    let v = floor; while (v < barR - 1e-9) v += doc; v -= doc;
    const out = []; for (let p = v; p > floor + 1e-9; p -= doc) out.push(+p.toFixed(6));
    out.push(+floor.toFixed(6));
    return out;
};

test('STRAIGHT — the executed moves are exactly the pass list, unchanged by carrying the branch', async ({ page }) => {
    await boot(page);
    const { segs } = await run(page, { targetDiameter: 14, depth: 25, doc: 1, finish: 0.5 });
    // Ø20 bar → r10; target r7; floor 7.5. Anchored on the floor: 9.5, 8.5, 7.5 — then the finish at 7, which on a
    // straight turn is ALSO a constant-X full-length cut, so the expected list has to name it (the same trap the
    // config matrix had: a filter on constant-X catches the finish pass, and a list that stops at the floor is
    // quietly demanding it be missing).
    const want = [...roughing(10, 7.5, 1), 7];
    const full = segs.filter((s) => Math.abs(s.x1 - s.x2) < 1e-6);
    expect(full.map((s) => s.x1), 'every roughing pass outermost first, then the finish').toEqual(want);
    for (const s of full) {
        // …the cut BEGINS at the safe Z, ahead of the raw face: the tool is fed in from clear air rather than
        // starting its feed already touching the work. zSafe = the raw allowance (1) + the clearance (2).
        expect(s.z1, `pass at r${s.x1} feeds in from ahead of the raw face`).toBeCloseTo(3, 3);
        expect(s.z2, 'and runs the WHOLE length — a straight turn has no cone to stop at').toBeCloseTo(-25, 3);
    }
    // …and the finish pass lands on the size, interpolating to a far end that IS the target
    const fin = segs[segs.length - 1];
    expect(fin.x2, 'the finished radius').toBeCloseTo(7, 3);
    expect(fin.z2).toBeCloseTo(-25, 3);
    expect(fin.x1, 'starting at the target, because the extrapolation term is zero when the ends are equal').toBeCloseTo(7, 3);
});

test('FAT FAR END — each pass stops where the cone reaches it', async ({ page }) => {
    await boot(page);
    const rFace = 7, rFar = 9, depth = 25;
    const { segs } = await run(page, { kind: 'taper', targetDiameter: 14, endDiameter: 18, depth, doc: 1, finish: 0.5 });
    const cuts = segs.filter((s) => Math.abs(s.x1 - s.x2) < 1e-6);
    const want = roughing(10, Math.min(rFace, rFar) + 0.5, 1);
    expect(cuts.map((s) => s.x1), 'the floor is the THINNER end plus the allowance').toEqual(want);
    for (const s of cuts) {
        expect(s.z1, 'the thin material is at the face, so the cut feeds in from ahead of it').toBeCloseTo(3, 3);
        expect(s.z2, `pass at r${s.x1} stops where the cone reaches it`).toBeCloseTo(crossing(s.x1, rFace, rFar, depth), 2);
    }
});

test('FAT FACE — each pass comes in AT the crossing and runs to the far end', async ({ page }) => {
    await boot(page);
    const rFace = 9, rFar = 5, depth = 25;
    const { segs } = await run(page, { kind: 'taper', targetDiameter: 18, endDiameter: 10, depth, doc: 1, finish: 0.5 });
    const cuts = segs.filter((s) => Math.abs(s.x1 - s.x2) < 1e-6);
    const want = roughing(10, Math.min(rFace, rFar) + 0.5, 1);
    expect(cuts.map((s) => s.x1), 'the floor follows the far end, which is the thin one here').toEqual(want);
    for (const s of cuts) {
        expect(s.z1, `pass at r${s.x1} comes in at the crossing — touching the cone, not cutting into it`).toBeCloseTo(crossing(s.x1, rFace, rFar, depth), 2);
        expect(s.z2, 'and runs to the far end').toBeCloseTo(-depth, 3);
    }
});

test('THE SCENARIO THAT MOTIVATES THE TURN — built straight, retuned at the machine, and the cone is followed', async ({ page }) => {
    await boot(page);
    const depth = 25;
    // Built with straight defaults. The operator then types a far-end diameter into the header, which is the ONE
    // edit a controller makes easy — the program is untouched otherwise.
    for (const [dEnd, rFar, where] of [[18, 9, 'far'], [10, 5, 'face']]) {
        const { nc, segs } = await run(page, { targetDiameter: 14, depth, doc: 1, finish: 0.5 },
            { find: '#133=', to: `#133=${dEnd} ( retuned at the machine )` });
        expect(nc, 'the program still carries the straight header it was built with').toMatch(/#132=14/);
        const rFace = 7;
        const cuts = segs.filter((s) => Math.abs(s.x1 - s.x2) < 1e-6);
        // THE FLOOR RE-DERIVED ITSELF: roughing now stops at the thinner end, which the built program never knew.
        expect(cuts[cuts.length - 1].x1, `Ø${dEnd}: the floor followed the retuned end`).toBeCloseTo(Math.min(rFace, rFar) + 0.5, 3);
        for (const s of cuts) {
            const zc = crossing(s.x1, rFace, rFar, depth);
            if (where === 'far') {
                expect(s.z1, `Ø${dEnd}: feeds in from ahead of the face`).toBeCloseTo(3, 3);
                expect(s.z2, `Ø${dEnd}: and stops on the cone at r${s.x1}`).toBeCloseTo(zc, 2);
            } else {
                expect(s.z1, `Ø${dEnd}: comes in on the cone at r${s.x1}`).toBeCloseTo(zc, 2);
                expect(s.z2, `Ø${dEnd}: and runs to the far end`).toBeCloseTo(-depth, 3);
            }
        }
        // …and the finish pass now interpolates to the retuned size instead of the one it was posted with
        const fin = segs[segs.length - 1];
        expect(fin.x2, `Ø${dEnd}: the finish pass ends on the retuned radius`).toBeCloseTo(rFar, 3);
    }
});

test('AND RETUNED BACK TO EQUAL, it degrades to a straight turn — no division by a zero difference', async ({ page }) => {
    await boot(page);
    // The operator types the target's own number into the far end: the crossing formula would divide by zero, and
    // the macro must never reach it. This is the case the straight-first ordering of the IF exists for.
    const { segs } = await run(page, { kind: 'taper', targetDiameter: 14, endDiameter: 18, depth: 25, doc: 1, finish: 0.5 },
        { find: '#133=', to: '#133=14 ( retuned back to straight )' });
    const cuts = segs.filter((s) => Math.abs(s.x1 - s.x2) < 1e-6);
    expect(cuts.map((s) => s.x1), 'the pass list is the straight one, finish pass included').toEqual([...roughing(10, 7.5, 1), 7]);
    for (const s of cuts) {
        expect(s.z1).toBeCloseTo(3, 3);
        expect(s.z2, 'and every pass runs the full length again').toBeCloseTo(-25, 3);
    }
    const fin = segs[segs.length - 1];
    expect(fin.x1, 'the finish pass starts at the target — the extrapolation term is zero').toBeCloseTo(7, 3);
    expect(fin.x2).toBeCloseTo(7, 3);
    expect(segs.every((s) => Number.isFinite(s.x1) && Number.isFinite(s.z2)), 'nothing divided by zero').toBe(true);
});
