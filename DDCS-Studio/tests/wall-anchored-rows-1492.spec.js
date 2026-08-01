import { test, expect } from '@playwright/test';

/**
 * t1492 (C1) — WALL-ANCHORED ROWS: THE PHASE AND THE CLAMP, IN ONE ACT. Slot capability arc 3/4.
 *
 * ── WHY THE TWO HALVES CANNOT BE SPLIT, WHICH IS THIS CAPABILITY'S WHOLE POINT ───────────────────────────────────
 * The arc re-measured it at t1478 rather than inheriting the sentence, and the inherited one was not reproducible:
 * the RAW atom never coincides with the slot kernel at any width — its rows sit exactly half a stepover off, which
 * is the PHASE. Only the phase-corrected atom coincides, and then exactly when (width − tool) is a whole multiple of
 * the stepover. Where it is NOT whole, the phased-but-unclamped last row OVERSHOOTS the far wall:
 *
 *     12 × Ø6 @40%   +1.20mm past the wall          16.8 × Ø6 @40%   +1.20mm
 *     15 × Ø6 @40%   +0.60mm past the wall          …every one in the OVERSIZE, DESTRUCTIVE direction
 *
 * So the phase ALONE is worse than neither — it converts a channel that is 1.2mm narrow (leaves stock, recoverable)
 * into one that is 1.2mm wide (removes material that was never meant to go, not recoverable). They land together or
 * the capability ships a gouge. This spec asserts BOTH arms, and the divergence arm is the one that proves the clamp.
 *
 * ── HOW BOTH FALL OUT OF ONE COUNT AND ONE GUARD ─────────────────────────────────────────────────────────────────
 *     n = FIX[(span − 0.001)/step] + 2     row = origin + i·step     IF row > far wall THEN row = far wall
 * At a whole multiple the last loop row lands exactly ON the wall and the clamp is a no-op; elsewhere the clamp is
 * what stops the overshoot. The −0.001 is the ring count's own collapse boundary, and it is what keeps the
 * whole-multiple case from emitting the wall twice.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** The arc's own widths: three WHOLE multiples of the stepover, three not, and four edges added here. */
const WIDTHS = [
    { w: 18, tool: 6, pct: 40, whole: true, why: 'the arc\'s first equality case' },
    { w: 13.2, tool: 6, pct: 40, whole: true, why: 'a fractional width that still divides evenly' },
    { w: 20, tool: 8, pct: 50, whole: true, why: 'a different tool and stepover' },
    { w: 12, tool: 6, pct: 40, whole: false, why: 'the arc measured +1.20mm OVERSIZE here without the clamp' },
    { w: 16.8, tool: 6, pct: 40, whole: false, why: '+1.20mm' },
    { w: 15, tool: 6, pct: 40, whole: false, why: '+0.60mm' },
    { w: 7, tool: 6, pct: 40, whole: false, why: 'a band NARROWER than one stepover — both walls, nothing between' },
    { w: 6.5, tool: 6, pct: 40, whole: false, why: 'narrower still' },
    { w: 9, tool: 8, pct: 50, whole: false, why: 'narrow, bigger tool' },
    { w: 60, tool: 6, pct: 40, whole: false, why: 'long — 24 passes, so an off-by-one cannot hide' },
];

const READ = `
(traceToolpath, lines) => {
    const NL = String.fromCharCode(10);
    const segs = (traceToolpath(['G90'].concat(lines, ['M30']).join(NL)).segments || [])
        .filter((s) => !s.rapid && Math.abs(s.z1 - s.z2) < 1e-6);
    const q = (v) => +Number(v).toFixed(3);
    return [...new Set(segs.map((s) => q(s.y2)))].sort((a, b) => a - b);
}`;

for (const c of WIDTHS) {
    test(`THE BRIDGE — ${c.whole ? 'EQUALITY' : 'DIVERGENCE'} arm: ${c.w}×Ø${c.tool}@${c.pct}% (${c.why})`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async ({ c, READ }) => {
            const { slotPath } = await import('/wizards/ops/slot.js');
            const m = await import('/wizards/ops/surfaceraster.js');
            const { traceToolpath } = await import('/engine/trace.js');
            // eslint-disable-next-line no-eval
            const rows = eval(READ);
            const common = { depth: 1.5, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5 };
            const slot = slotPath({ x0: 0, y0: 0, x1: 60, y1: 0, width: c.w, tool: c.tool, stepoverPct: c.pct, ...common });
            // the atom given the SLOT'S OWN rect: C2's anisotropic inset (tool/2 across, nothing along) and C1's anchor
            const atomCfg = { x: 0, y: -c.w / 2, z0: 0, w: 60, h: c.w, insetAlong: 0, insetAcross: c.tool / 2,
                rowAnchor: 'wall', toolDia: c.tool, stepoverPct: c.pct, strategy: 'parallel', direction: 'bothways',
                entry: 'plunge', rowAxis: 'x', ...common };
            return {
                slot: rows(traceToolpath, slot),
                atom: rows(traceToolpath, m.surfaceRasterLines(atomCfg)),
                // the SAME rect with the phase but WITHOUT the clamp is not reachable through the API — that is the
                // point of landing them together — so the overshoot is computed here, from the rule, to show what the
                // clamp is preventing rather than asserting a state the code refuses to be in.
                unclampedLast: (() => { const band = c.w - c.tool, step = c.tool * c.pct / 100;
                    return +(-band / 2 + (Math.floor((band - 0.001) / step) + 1) * step).toFixed(3); })(),
                wall: +((c.w - c.tool) / 2).toFixed(3),
                declared: m.surfaceRasterWorkSteps(atomCfg),
                declaredFit: m.surfaceRasterWorkSteps({ ...atomCfg, rowAnchor: 'fit' }),
            };
        }, { c, READ });

        // ⚠ THE BRIDGE: move for move against the kernel that has always cut this channel correctly.
        expect(r.slot.length, 'the slot kernel cuts passes on this width (else the case proves nothing)').toBeGreaterThan(1);
        expect(r.atom, `the atom reproduces slotPath's passes — slot ${JSON.stringify(r.slot)}`).toEqual(r.slot);
        // …and the property the CLAMP owns, stated on its own so a regression names itself
        expect(r.atom[r.atom.length - 1], 'the last pass lands exactly ON the far wall').toBeCloseTo(r.wall, 3);
        expect(r.atom[0], 'and the first is anchored ON the near wall — that is the phase').toBeCloseTo(-r.wall, 3);
        expect(Math.max(...r.atom), 'NOTHING rides past the wall — the oversize direction is the destructive one').toBeLessThanOrEqual(r.wall + 0.001);

        if (c.whole) {
            // THE EQUALITY ARM: the clamp is a NO-OP here, and saying so is what makes the divergence arm meaningful
            expect(r.unclampedLast, 'a whole multiple lands on the wall unaided, so the clamp changes nothing').toBeCloseTo(r.wall, 3);
        } else {
            // ⚠ THE DIVERGENCE ARM — THE CLAMP IS LOAD-BEARING, and by how much is measured rather than asserted
            expect(r.unclampedLast, 'without the clamp this width overshoots the wall').toBeGreaterThan(r.wall + 0.001);
            expect(r.atom[r.atom.length - 1], 'and the clamp is what brings it back to the wall').toBeLessThan(r.unclampedLast);
        }
        // @WORK FOLLOWS THE CLAMP'S EXTRA PASS — a declaration still reading the fit rule would under-count this job
        expect(r.declared, 'the wall walk declares more work than the fit walk on the same span').toBeGreaterThan(r.declaredFit);
    });
}

/**
 * ── THE STAY — surfacing and a pocket must NOT phase ──────────────────────────────────────────────────────────────
 * Every caller that exists today wants the FIT rule, so `wall` is opt-in and absence is `fit`, exactly as an unknown
 * direction or row-axis word falls to its default. Asserted over the cross-product, not a sample.
 */
test('THE STAY — absent, `fit`, and an unknown word all emit today\'s program, across the cross-product', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const NL = String.fromCharCode(10);
        let count = 0; const differ = [];
        for (const strategy of ['parallel', 'concentric'])
            for (const entry of ['plunge', 'ramp', 'helix'])
                for (const direction of ['bothways', 'oneway', 'otherway'])
                    for (const rowAxis of ['x', 'y'])
                        for (const zMode of ['', 'skim'])
                            for (const inset of [0, 3, '#6'])
                                for (const rotAngle of [0, 17]) {
                                    count++;
                                    const base = { x: 12.5, y: -7.25, z0: 2, w: 80, h: 60, depth: 3, stepdown: 1.5,
                                        toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5, strategy,
                                        entry, direction, rowAxis, zMode, rotAngle, rotPivotX: 3, rotPivotY: 4,
                                        rampAngle: 3, helixDia: 4, helixPitch: 0.75, inset };
                                    const plain = m.surfaceRasterLines(base).join(NL);
                                    const fit = m.surfaceRasterLines({ ...base, rowAnchor: 'fit' }).join(NL);
                                    const junk = m.surfaceRasterLines({ ...base, rowAnchor: 'nonsense' }).join(NL);
                                    if (plain !== fit || plain !== junk) differ.push({ strategy, entry, direction, rowAxis, zMode, inset, rotAngle });
                                }
        // and the SHIPPING surfacing path, through the real wizard stack
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const text = String(emitProgram(surfacingStack({ w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 })));
        return { count, differ, surfacingIsFit: /rows that FIT/.test(text), surfacingIsWall: /- 0\.001\] \/ #44\] \+ 2/.test(text) };
    });
    expect(r.count, 'the cross-product really is the whole matrix that reaches the row rule').toBe(432);
    expect(r.differ, `every config is unchanged — ${JSON.stringify(r.differ.slice(0, 3))}`).toEqual([]);
    expect(r.surfacingIsFit, 'and the shipping surfacing program still counts rows that FIT').toBe(true);
    expect(r.surfacingIsWall, 'and emits no wall-anchored count at all').toBe(false);
});

/**
 * ── WHAT C1 LEAVES — the boundary after two clauses have been retired ────────────────────────────────────────────
 */
test('THE REMAINDER — the row rule and the inset are both retired; the AXIS is what still stands', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { SLOT_RASTER_GAP } = await import('/wizards/ops/slot.js');
        const arc = await import('/data/slotCapabilityArc.js');
        const m = await import('/wizards/ops/surfaceraster.js');
        return {
            gap: SLOT_RASTER_GAP,
            landed: arc.SLOT_CAPABILITIES.find((c) => c.id === 'wall-anchored-rows').landed,
            anchorDefault: m.rasterRowAnchorOf({}), anchorWall: m.rasterRowAnchorOf({ rowAnchor: 'wall' }),
            anchorJunk: m.rasterRowAnchorOf({ rowAnchor: 'sideways' }),
        };
    });
    expect(r.anchorDefault, 'absent is the fit rule').toBe('fit');
    expect(r.anchorWall, 'and the slot rule is opt-in by name').toBe('wall');
    expect(r.anchorJunk, 'an unknown word falls to the default, like every other walk word').toBe('fit');
    expect(r.gap, 'the boundary records the row rule as retired by C1').toMatch(/C1 \(t1492\) taught it the wall rule/);
    expect(r.gap, 'and the inset as retired by C2').toMatch(/C2 \(t1490\) taught it a PAIR/);
    // ⚠ THE BOUNDARY STILL STANDS, on the one capability that is left plus the helix
    // t1494 - C3 landed and the ARC CLOSED, so no clause names a capability gap any more. What the boundary
    // still holds is TWO EVIDENCE GATES (a dialled bearing needs trig; a slot helix wants the true-arc form),
    // and asserting THAT is what keeps this line honest as the arc finished under it.
    expect(r.gap, 'the arc closed: every clause is retired').toMatch(/ALL FOUR CLAUSES ARE RETIRED NOW/);
    expect(r.gap, 'and what remains is EVIDENCE, not a walk the atom cannot do').toMatch(/TWO NAMED EVIDENCE GATES/);
    // t1494 — this asserted "an angled slot is the case that cannot be faked", which C3 made false three turns
    // later by teaching the atom a BAKED bearing. What is still true, and is the sharper claim, is that the DIALLED
    // bearing remains gated on trig evidence — so the sentence moves from a capability the atom lacks to a decision
    // the machine has not made.
    expect(r.gap, 'a DIALLED bearing is what still waits, and it waits on evidence').toMatch(/DIALLED bearing needs COS\/SIN of a runtime angle/);
    expect(r.landed, 'the arc records C1 as shipped, both halves together').toMatch(/SHIPPED at t1492, phase AND clamp in ONE act/);
    expect(r.landed, 'and names the degenerate where the two kernels still diverge, rather than papering it over').toMatch(/width == tool/);
});
