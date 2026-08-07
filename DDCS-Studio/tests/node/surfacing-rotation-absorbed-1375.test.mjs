import { test, expect } from './support/harness.mjs';
import { rampDescentRelationship, splitRampDescent, cutBox } from '../support/rampRelationship.js';

/**
 * t1375 — THE PROGRAM ROTATION IS ABSORBED BY THE ATOM, so a surfacing program can be aligned again.
 *
 * THE HOLE THIS FILLS. A declared program rotation (⟳ Transform, and the alignment fix that types a measured angle)
 * used to be applied to the emitted TEXT after every op had emitted. That works on coordinates that ARE numbers and
 * cannot work at all on `G0 X0 Y#47`: rotation couples the axes, so a move the rewriter can only half-replace gains a
 * SECOND axis word — uncommanded motion on a cutting line (t1353 measured it). The transforms refuse such a program
 * rather than half-applying one, which was the safe answer and left a real flow narrowed: from the day surfacing went
 * parametric, a program containing it could not be aligned. Two specs in this suite were re-seeded from a pocket to say
 * so honestly (transform-declared-736, alignment-correction-840); both flip back this turn.
 *
 * THE SEAM, and why it is one level up from the placement seam. t1371 measured what actually rotates a program: the
 * Transform modal writes a FLAT program-level `xform` SIBLING at the top of the stack, pivot at the datum (0,0). It is
 * not a wrapper, and the op is not inside it — so the placement analogy does not hold (a placement fold hands params to
 * the child it wraps; nothing wraps an xform). The angle therefore reaches `emit()` as program CONTEXT, an atom that
 * declares `absorbsRotation` bakes it into the coordinates it emits, and `applyProgramTransform` became RANGE-AWARE so
 * it still rotates everything else — the framing moves, the retract, and any literal op in the same program.
 *
 * WHAT THE BRIDGE COMPARES, and why it is the right criterion. The literal surfacing emitter still exists as the named
 * test-only reference, and text-rotating IT is exact (all its coordinates are numbers). So the truth for every config
 * below is: the OLD literal program, text-rotated by the proven pass, must EXECUTE THE SAME CUTTING MOVES as the NEW
 * parametric program that baked the rotation itself. Resolved through the engine, point for point — the same criterion
 * the placement and skim bridges used, extended by one transform.
 *
 * THE TWO HAZARDS THIS FILE EXISTS TO PIN:
 *   1. DOUBLE-ROTATE. If the declared range map drifts from what was emitted, a line is rotated twice and the result
 *      is a plausible-looking wrong part. The map is declared by the EMITTER at emit time (a per-line stamp, exposed as
 *      `absorbed`) and the pass never re-scans the text — and the coherence test below proves the map matches what was
 *      emitted, then breaks it on purpose to show the guard is not vacuous.
 *   2. THE MIXED SEAM. A literal op beside the parametric one is where a one-line gap or overlap hides: the framing and
 *      the literal op rotate as text, the atom bakes, and the two must meet exactly. That config is the one that earns
 *      the mechanism, so it is measured against an all-literal equivalent of the same program.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

// A face big enough to have several rows and several levels — a rotation that is wrong is then wrong VISIBLY, not
// within a rounding of right.
const FACE = { w: 100, h: 60, depth: 1.0, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 };

/**
 * THE ANGLES, chosen for what each one can catch rather than for coverage:
 *   0°       the BYTE-IDENTICAL ANCHOR — the mechanism must be invisible when nothing is declared
 *   90°      exact constants (c=0, s=1): an axis SWAP, where a coupling bug cannot hide behind small numbers
 *   12.5°    an odd angle: both constants irrational, so every coordinate is genuinely recomputed
 *   −7°      negative: the sign of the cross term is where a hand-derived rotation matrix goes wrong
 */
const ANGLES = [
    { name: '0° — the byte-identical anchor', angle: 0 },
    { name: '90° — an exact axis swap', angle: 90 },
    { name: '12.5° — an odd angle, nothing exact', angle: 12.5 },
    { name: '−7° — negative, where the cross term flips', angle: -7 },
    { name: '12.5° about a pivot away from the datum', angle: 12.5, pivotX: 30, pivotY: -20 },
];

/**
 * THE CRITERION, and the correction that produced it.
 *
 * The first version of this file compared the two programs' resolved points for EXACT equality at three decimals, and
 * it passed at four of five angles. It failed at the fifth for a reason worth keeping: **exact agreement between two
 * correctly-rounded programs is not something either of them can promise.** Both express coordinates to 0.001mm, so
 * each is within half a quantum of the truth — and when the truth happens to sit near a rounding boundary the two land
 * on opposite sides of it. Measured: a point 0.0001mm from the ideal printed as −1.468 where the literal printed
 * −1.467. Nothing was wrong; the criterion was.
 *
 * So each config is measured three ways, none of which depends on a boundary:
 *   (A) COUNT AND ORDER are exact. A rotation is never a different program.
 *   (B) vs the LITERAL reference, PER AXIS, within one emit quantum — the unit the emit expresses, so two programs
 *       inside it are the same program as far as the machine is ever told.
 *   (C) vs the EXACT rotation of the same program UNROTATED, computed at full precision here. This has no literal in
 *       it, so it isolates what this turn built from every divergence that predates it — including the helix's ruled
 *       one — and it is the assert that would catch a coupling error, a wrong sign, or a pivot applied to a vector.
 * The 0° config additionally holds the byte-identical anchor.
 */
const bridge = (page, cfg) => page.evaluate(async (cfg) => {
    const { surfacingStack, surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
    const { emitProgram, emitMapped } = await import('/blocks/blockEmitter.js');
    const { makeXform } = await import('/blocks/programFraming.js');
    const { traceToolpath } = await import('/engine/trace.js');
    // t1377 — the FEED rides in the tuple. A rotation is a planar map: it must not change how fast anything cuts, and
    // that is now measured rather than assumed (the modal-feed fold's flow blindness lived in exactly this gap).
    // t1487 — the tuple carries its START too. Everything below reads the ENDPOINT (fields 3-5) and the feed (6),
    // exactly as it read fields 0-2 and 3 before; the start is what lets the ramp relationship ask where a descent
    // begins and whether it returns there, which an endpoint cannot answer.
    const cut = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid).map((s) => [s.x1, s.y1, s.z1, s.x2, s.y2, s.z2, +Number(s.feed || 0).toFixed(3)]);
    const xf = makeXform({ angle: cfg.angle, pivotX: cfg.pivotX || 0, pivotY: cfg.pivotY || 0 });
    const p = { ...cfg };
    const litRes = emitMapped([xf, ...surfacingLiteralStack(p)]);
    const parRes = emitMapped([xf, ...surfacingStack(p)]);
    return {
        lit: cut(litRes.text), par: cut(parRes.text), flat: cut(emitProgram(surfacingStack(p))),
        absorbed: parRes.absorbed.length,
        plain: emitProgram(surfacingStack(p)), rotatedText: parRes.text,
    };
}, cfg);

/** The three measurements above, as numbers — computed in the test, never taken from the thing under test. */
function measure(r, angle, pivotX = 0, pivotY = 0, skip = new Set()) {
    const th = angle * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    let vsLit = 0, vsExact = 0, litVsExact = 0, worstZ = 0;
    // t1377 — the FEEDS are compared EXACTLY, and against BOTH truths: the literal reference and this program
    // unrotated. A feed is not a position, so it gets no quantum tolerance.
    const feedsOf = (xs) => xs.filter((_, i) => !skip.has(i)).map((m) => m[6]);
    const feedVsLit = JSON.stringify(feedsOf(r.par)) === JSON.stringify(feedsOf(r.lit));
    const feedVsFlat = JSON.stringify(feedsOf(r.par)) === JSON.stringify(feedsOf(r.flat));
    // t1487 — `skip` carries the DESCENT's move positions when the caller is comparing a ramp against the literal.
    // It is empty for every other caller, so those measurements are the ones they always were.
    for (let i = 0; i < Math.min(r.par.length, r.lit.length); i++) {
        if (skip.has(i)) continue;
        vsLit = Math.max(vsLit, Math.abs(r.par[i][3] - r.lit[i][3]), Math.abs(r.par[i][4] - r.lit[i][4]));
        worstZ = Math.max(worstZ, Math.abs(r.par[i][5] - r.lit[i][5]));
    }
    for (let i = 0; i < Math.min(r.par.length, r.flat.length); i++) {
        const [, , , x, y] = r.flat[i];
        const ex = pivotX + (x - pivotX) * c - (y - pivotY) * s;
        const ey = pivotY + (x - pivotX) * s + (y - pivotY) * c;
        vsExact = Math.max(vsExact, Math.abs(r.par[i][3] - ex), Math.abs(r.par[i][4] - ey));
        if (i < r.lit.length && !skip.has(i)) litVsExact = Math.max(litVsExact, Math.abs(r.lit[i][3] - ex), Math.abs(r.lit[i][4] - ey));
    }
    return { vsLit, vsExact, litVsExact, worstZ, feedVsLit, feedVsFlat };
}

for (const A of ANGLES) {
    for (const strategy of ['parallel', 'concentric']) {
        test(`BRIDGE (${strategy}) — ${A.name}`, async ({ page }) => {
            await boot(page);
            const r = await bridge(page, { ...FACE, ...A, strategy });
            const m = measure(r, A.angle, A.pivotX || 0, A.pivotY || 0);
            // (A) STRUCTURE
            expect(r.lit.length, 'the literal reference really cuts something').toBeGreaterThan(4);
            expect(r.par.length, `same number of cutting moves (literal ${r.lit.length}, parametric ${r.par.length})`).toBe(r.lit.length);
            expect(r.par.length, 'and the rotation changes no move count of its own').toBe(r.flat.length);
            // (B) AGAINST THE SHIPPING LITERAL REFERENCE, per axis, inside the emit's own precision
            expect(m.vsLit, `worst per-axis gap vs the literal ${m.vsLit.toFixed(6)}mm — within one 0.001mm emit quantum`).toBeLessThanOrEqual(0.001);
            expect(m.worstZ, 'Z is untouched by a planar rotation').toBeLessThanOrEqual(0.001);
            // (B2) t1377 — AND THE FEEDS ARE EXACT, against both truths. A rotation is a planar map: it may move a point
            // and it may never change how fast the tool gets there.
            expect(m.feedVsLit, 'every move carries the literal reference\'s feed, exactly').toBe(true);
            expect(m.feedVsFlat, 'and the same feed it carries unrotated — a rotation changes no speed').toBe(true);
            // (C) AGAINST AN EXACT ROTATION — the sharp one, and the one no pre-existing divergence can excuse
            expect(m.vsExact, `worst per-axis gap vs an EXACT rotation ${m.vsExact.toFixed(6)}mm`).toBeLessThanOrEqual(0.001);
            // …AND NEVER FARTHER FROM IT THAN THE LITERAL IS (the t1345 pattern): being inside a bound is not enough if
            // the shipping reference is closer. 1e-6 of slack for the baked coefficients' own derived error.
            expect(m.vsExact, `parametric ${m.vsExact.toFixed(6)} from the exact rotation, literal ${m.litVsExact.toFixed(6)} — never farther`)
                .toBeLessThanOrEqual(m.litVsExact + 1e-6);
            if (A.angle === 0) {
                // THE ANCHOR: a declared 0° must not merely resolve the same, it must emit the SAME BYTES. The whole
                // mechanism is required to be invisible until an angle is declared.
                expect(r.rotatedText, 'a declared 0° rotation is byte-identical to no rotation at all').toBe(r.plain);
                expect(r.absorbed, 'and nothing is claimed as absorbed at 0° — there was nothing to absorb').toBe(0);
            } else {
                expect(r.absorbed, 'the atom really did absorb (the bridge is not passing because nothing happened)').toBeGreaterThan(10);
            }
        });
    }
}

/**
 * THE DERIVED BOUND, CHECKED RATHER THAN ASSERTED — six decimals, on the config the derivation is about.
 *
 * t1371 derived it: the rotation is two multiplies by a baked constant and one add, ONCE per coordinate, with no
 * recurrence, so the coordinate error is bounded by `(|ex|+|ey|)·5·10^−(d+1)`. At d=6 and offsets under 500mm that is
 * 5·10⁻⁴ mm — half the emit's own quantum. A plunge raster's coordinates are exact numbers unrotated, so the ONLY error
 * in the rotated program is the one that derivation bounds: this measures it instead of trusting it.
 */
test('THE 6-DECIMAL BOUND — a plunge raster is within HALF a quantum of an exact rotation, as derived', async ({ page }) => {
    await boot(page);
    for (const strategy of ['parallel', 'concentric']) {
        const r = await bridge(page, { ...FACE, strategy, entry: 'plunge', angle: 12.5 });
        const m = measure(r, 12.5);
        expect(m.vsExact, `${strategy}: worst per-axis error ${m.vsExact.toFixed(7)}mm must be inside the derived 5e-4 bound`).toBeLessThanOrEqual(0.0005);
    }
});

/**
 * ROTATION COMPOSED WITH A PLACEMENT SHIFT — the two absorbed frames in one program.
 *
 * Placement is absorbed as params (t1359) and now so is the rotation. If they compose wrongly the error is a part cut
 * in the right shape at the wrong place, which is the class this arc keeps refusing to ship. The pivot stays at the
 * DATUM while the geometry sits away from it, so the shift and the rotation cannot be confused for one another.
 */
for (const entry of ['plunge', 'ramp', 'helix']) {
    test(`COMPOSED — rotation × placement shift × ${entry} descent`, async ({ page }) => {
        await boot(page);
        const r = await bridge(page, { ...FACE, entry, helixDia: 8, helixPitch: 1, angle: 12.5, originX: 40, originY: 25, attach: 'll' });
        /**
         * ⚠ t1487 — RESTATED, NOT RETIRED (ruled t1486). C4 points the ramp along the ROW rather than at the area
         * centre (t1483/t1485), so on the ramp arm the two descents are no longer the same two moves — and this
         * test's claim was never about that. It is about the ROTATION composing with the placement shift, which is
         * asserted against an EXACT rotation of this same program (`vsExact`) and is untouched: that comparison is
         * parametric-against-parametric and covers the descent moves too, ramp included.
         *
         * So only the vs-LITERAL measurement steps around the descent, and the descent gets its declared
         * relationship instead — measured in the ROTATED frame on both sides, which is the stronger reading here.
         */
        const skip = entry === 'ramp' ? new Set(splitRampDescent(r.par).indices) : new Set();
        const m = measure(r, 12.5, 0, 0, skip);
        if (entry === 'ramp') {
            const rel = rampDescentRelationship(r.lit, r.par, { bbox: cutBox(r.lit) });
            expect(rel.ok, `the rotated descent holds its declared relationship to the rotated literal — ${rel.why}`).toBe(true);
            expect(skip.size, 'and the descent really was found, so the skip above is not silently empty').toBeGreaterThan(0);
        }
        expect(r.lit.length, 'the literal reference cuts').toBeGreaterThan(4);
        expect(r.par.length, `same count (literal ${r.lit.length}, parametric ${r.par.length})`).toBe(r.lit.length);
        expect(r.par.length, 'and the rotation changes no move count').toBe(r.flat.length);
        expect(m.vsLit, `placed AND rotated: worst per-axis vs the literal ${m.vsLit.toFixed(6)}mm`).toBeLessThanOrEqual(0.001);
        expect(m.vsExact, `and vs an EXACT rotation ${m.vsExact.toFixed(6)}mm — the shift and the angle compose`).toBeLessThanOrEqual(0.001);
        expect(m.worstZ, 'Z untouched').toBeLessThanOrEqual(0.001);
        expect(m.feedVsLit, 'and the feeds are exactly the literal\'s (t1377)').toBe(true);
        expect(m.feedVsFlat, 'and unchanged by the rotation').toBe(true);
    });
}

/**
 * THE MIXED PROGRAM — a literal op beside the parametric one, under ONE declared rotation. The config that earns the
 * mechanism: the framing and the literal op rotate as TEXT, the parametric op baked its own rotation, and the two have
 * to meet with neither a gap (a line that should have rotated and did not) nor an overlap (a line rotated twice).
 *
 * The truth is the SAME program built entirely from the literal emitter and text-rotated by the proven pass. Comparing
 * resolved motion is what makes "no gap and no overlap" measurable rather than asserted: a gap leaves one op unrotated
 * and a double-rotate moves it twice as far, and both show up as a mismatched point.
 */
const mixed = (page, angle) => page.evaluate(async (angle) => {
    const { surfacingStack, surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
    const { emitMapped } = await import('/blocks/blockEmitter.js');
    const { makeXform } = await import('/blocks/programFraming.js');
    const { traceToolpath } = await import('/engine/trace.js');
    // t1377 — (position, FEED). It matters most here: the two ops are configured with DIFFERENT feeds, so the seam
    // between a text-rotated op and a rotation-absorbed one is checked on speed as well as place.
    const cut = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid)
        .map((s) => [+s.x1.toFixed(3), +s.y1.toFixed(3), +s.z1.toFixed(3), +s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3), +Number(s.feed || 0).toFixed(3)]);
    // TWO DIFFERENT AREAS, so the two ops are distinguishable in the resolved path and neither can stand in for the other
    const A = { w: 60, h: 40, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 };
    const B = { w: 30, h: 20, depth: 0.5, stepdown: 0.5, toolDia: 8, stepoverPct: 50, feed: 700, plunge: 150, clearance: 5, originX: 100, originY: 10, attach: 'll' };
    const xf = makeXform({ angle, pivotX: 0, pivotY: 0 });
    // [ xform · progstart · wcs · PARAMETRIC op · LITERAL op · progend ] — one framing, two ops of different kinds
    const pa = surfacingStack(A), la = surfacingLiteralStack(A), lb = surfacingLiteralStack(B);
    const mixedStack = [xf, pa[0], pa[1], pa[2], lb[2], pa[3]];
    const truthStack = [xf, la[0], la[1], la[2], lb[2], la[3]];
    const mixedRes = emitMapped(mixedStack), truthRes = emitMapped(truthStack);
    // WHICH LINES BELONG TO WHICH OP — read from the emitter's own line→block map, not from the text
    const rasterId = (pa[2].children || []).map((c) => c.id).find((id) => /^surfaceraster/.test(String(id)));
    const ofRaster = [];
    mixedRes.map.forEach((src, i) => { if (Array.isArray(src) && src.includes(rasterId)) ofRaster.push(i); });
    return {
        mixedCut: cut(mixedRes.text), truthCut: cut(truthRes.text),
        absorbed: mixedRes.absorbed, ofRaster, text: mixedRes.text,
    };
}, angle);

test('MIXED PROGRAM — a literal op beside the parametric one, one rotation, and the seam holds', async ({ page }) => {
    await boot(page);
    const warnings = [];
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    const r = await mixed(page, 12.5);

    // (a) THE MAP IS EXACTLY THE PARAMETRIC OP'S LINES — no gap, no overlap, measured against the emitter's own
    //     line→block ancestry. This is the coherence the never-re-scan ruling rests on.
    expect(r.ofRaster.length, 'the parametric op really emitted lines').toBeGreaterThan(10);
    expect(r.absorbed, 'the absorbed map is EXACTLY the parametric op lines — the literal op is not in it').toEqual(r.ofRaster);

    // (b) NOTHING WAS REFUSED. A mixed program is the case that would refuse if the map were wrong.
    expect(warnings.join(' | '), `no refusal on the mixed program (saw: ${warnings.join(' | ')})`).not.toMatch(/refused|skipped/i);

    // (c) AND BOTH OPS LAND WHERE THE ALL-LITERAL ROTATION PUTS THEM. A gap leaves an op unrotated; an overlap moves
    //     one twice. Either shows up here as a mismatched point.
    expect(r.truthCut.length, 'the all-literal truth cuts both ops').toBeGreaterThan(8);
    expect(r.mixedCut.length, `same move count (truth ${r.truthCut.length}, mixed ${r.mixedCut.length})`).toBe(r.truthCut.length);
    expect(r.mixedCut, 'every move of BOTH ops matches the all-literal rotated program').toEqual(r.truthCut);
});

/**
 * MAP-VS-EMIT COHERENCE, and then BROKEN ON PURPOSE.
 *
 * The ruling is that the emitter declares the range map and the pass never re-scans. What makes that safe rather than
 * merely stated is this pair of asserts: the map covers every line whose coordinates the machine resolves (so nothing
 * parametric is left for the text pass to maul), and a map with ONE line missing makes the rotation REFUSE instead of
 * quietly rotating an already-rotated line. A drifted map is loud, not wrong.
 */
test('COHERENCE — the declared map matches the emit, and a map one line short REFUSES', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { makeXform } = await import('/blocks/programFraming.js');
        const { parametricMotion, rotateProgram } = await import('/data/rotateProgram.js');
        const cfg = { w: 100, h: 60, depth: 1.0, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 };
        const res = emitMapped([makeXform({ angle: 12.5 }), ...surfacingStack(cfg)]);
        const raw = res.lines.join(String.fromCharCode(10));
        // DRIFT, of the ONLY kind that can actually happen: a line the atom DID rotate is missing from the map. Pick a
        // line that genuinely carries a baked rotated coordinate — dropping a comment or a `#var=` header line proves
        // nothing, because there is nothing on it for the text pass to touch.
        const bakedXY = res.absorbed.filter((i) => /\bX[[#]/.test(res.lines[i]));
        const drifted = res.absorbed.filter((i) => i !== bakedXY[Math.floor(bakedXY.length / 2)]);
        return {
            absorbed: res.absorbed.length, raw, bakedXY: bakedXY.length,
            // with the declared map, no UNABSORBED line carries an absolute register/expression axis word
            leftover: parametricMotion(raw, res.absorbed),
            // …and without any map at all, the same program is refused — so the map is doing real work
            noMap: parametricMotion(raw),
            drift: rotateProgram(raw, 12.5, 0, 0, { absorbed: drifted }),
            good: rotateProgram(raw, 12.5, 0, 0, { absorbed: res.absorbed }),
        };
    });
    expect(r.absorbed, 'the atom claimed a real range').toBeGreaterThan(10);
    expect(r.bakedXY, 'and the range really contains baked rotated coordinates').toBeGreaterThan(4);
    expect(r.leftover, 'with the declared map, nothing parametric is left for the text pass to rewrite').toBe(null);
    expect(r.noMap, 'and the same program WITHOUT the map is refused — the map is load-bearing').toBeTruthy();
    expect(r.good.refused || '', 'the coherent map rotates cleanly').toBe('');
    expect(r.good.absorbed, 'and it passed the claimed lines through untouched').toBe(r.absorbed);
    // THE DOUBLE-ROTATE HAZARD, made loud. The only drift that can occur is an UNDER-claim — the stamp is applied to
    // the absorbing atom's own emitted lines, so the map cannot name a line the atom never wrote. An under-claim hands
    // an already-rotated coordinate back to the text pass, and the pass refuses it rather than rotating it a second
    // time: the failure mode is a whole-program refusal with a reason, never a plausible-looking wrong part.
    expect(r.drift.refused, 'a map one line short REFUSES rather than double-rotating that line').toMatch(/rotate refused:/);
    expect(r.drift.text, 'and refusing leaves the program completely untouched').toBe(r.raw);
});

/**
 * SKIM × ROTATION IS REFUSED, WITH THE REASON — and it costs nothing against the path it replaced.
 *
 * A skim body is measured from wherever the operator jogged to: it reads the live work position into three registers
 * and runs its ordinary absolute body over them. A program rotation is about the PART DATUM. Rotating a jog-referenced
 * body about the datum mixes two frames with no fixed relationship — the result is not less accurate, it is
 * meaningless. So the atom declares that it cannot absorb one and says why, and the whole-program pass then refuses the
 * parametric text as well, leaving the program untouched rather than half-rotated.
 *
 * THE PARITY IS THE POINT: a LITERAL skim program is G91-wrapped, and every whole-program transform returns G91
 * regions untouched, so the text rotation never rotated a skim body either. This refusal narrows nothing.
 */
test('SKIM × ROTATION — refused with its reason, and the literal path never rotated one either', async ({ page }) => {
    await boot(page);
    const warnings = [];
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    const r = await page.evaluate(async () => {
        const { surfacingStack, surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { makeXform } = await import('/blocks/programFraming.js');
        const { surfaceRasterAbsorbsRotation } = await import('/wizards/ops/surfaceraster.js');
        const cfg = { w: 80, h: 50, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5, zMode: 'skim' };
        const xf = makeXform({ angle: 12.5 });
        return {
            why: surfaceRasterAbsorbsRotation(cfg),
            canNormal: surfaceRasterAbsorbsRotation({ ...cfg, zMode: '' }),
            plain: emitProgram(surfacingStack(cfg)),
            rotated: emitProgram([xf, ...surfacingStack(cfg)]),
            litPlain: emitProgram(surfacingLiteralStack(cfg)),
            litRotated: emitProgram([xf, ...surfacingLiteralStack(cfg)]),
        };
    });
    // THE DECLARATION SAYS WHY, in a reader's words — never a bare false.
    expect(r.canNormal, 'a datum-framed surfacing op CAN absorb a rotation').toBe(true);
    expect(typeof r.why, 'a skim op answers with a reason, not a boolean').toBe('string');
    expect(r.why, 'and the reason names the frame mix').toMatch(/jog|frame/i);
    // THE PROGRAM IS UNTOUCHED — not half-rotated.
    expect(r.rotated, 'a skim program comes back byte-identical: nothing was half-applied').toBe(r.plain);
    expect(warnings.join(' | '), `and the refusal is said out loud (saw: ${warnings.join(' | ')})`).toMatch(/(rotation absorption|rotate|program rotation).*(refused|skipped)/i);
    // PARITY WITH THE PATH IT REPLACED: the literal skim program is G91, so it was never rotated either.
    expect(r.litRotated, 'the LITERAL skim program is unrotated too (G91 is exempt) — this is parity, not a narrowing').toBe(r.litPlain);
});

/**
 * MIRROR IS NOT REACHABLE FROM ANY WIZARD FLOW — the precise statement, because "unreachable" alone would be wrong.
 *
 * `applySetupFlips` mirrors a named setup's own line range and needs a `setup` block carrying a `flip` child. t1371
 * measured that NO wizard emits one, while both blocks ARE in the palette — so a mirror is hand-authorable in Blocks
 * and cannot arrive from a form. That is why the mirror keeps its refusal instead of gaining an absorption path: there
 * is no user flow that would reach it, and building the machinery for one would be machinery ahead of its case.
 */
test('MIRROR — no wizard builds a setup+flip, the blocks stay palette-only, and the refusal is kept', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { BUILDERS } = await import('/blocks/opBuilders.js');
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const { mirrorProgram } = await import('/data/rotateProgram.js');
        const flat = (st, out = []) => { for (const b of (st || [])) { if (!b) continue; out.push(b); flat(b.children, out); flat(b.uiChildren, out); } return out; };
        const offenders = [];
        let built = 0;
        for (const [op, build] of Object.entries(BUILDERS)) {
            let stack = null;
            try { stack = build({}); } catch (_) { continue; }   // an op that needs params is measured by the ones that don't
            built += 1;
            const types = flat(stack).map((b) => b.type);
            if (types.includes('setup') || types.includes('flip')) offenders.push(op);
        }
        const NL = String.fromCharCode(10);
        const para = ['G90', 'G0 X0 Y#47', 'G1 X[0 + #40] F900', 'M30'].join(NL);
        return { built, offenders, inPalette: { setup: !!BLOCKS.setup, flip: !!BLOCKS.flip }, mi: mirrorProgram(para, 'Y', 200, 150, 25) };
    });
    expect(r.built, 'the sweep really ran over the registered op builders').toBeGreaterThan(15);
    expect(r.offenders, 'no wizard flow builds a setup or a flip — a mirror cannot arrive from a form').toEqual([]);
    expect(r.inPalette.setup && r.inPalette.flip, 'both blocks ARE in the palette: hand-authorable in Blocks, which is the precise statement').toBe(true);
    expect(r.mi.refused, 'so the mirror keeps its refusal on parametric text').toMatch(/mirror refused:/);
    expect(r.mi.mirrored, 'and mirrors nothing').toBe(0);
});
