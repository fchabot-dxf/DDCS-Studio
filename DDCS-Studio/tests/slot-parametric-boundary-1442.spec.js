import { test, expect } from '@playwright/test';

/**
 * t1442 — THE SLOT IS DIAGNOSED, NOT RE-POINTED: the declared boundary, and the MEASUREMENT that keeps it honest.
 *
 * T4 opened by asking whether `slotPath`'s zig-zag IS `surfaceraster`'s parallel walk over the slot's rect — the
 * t1406 recipe's fifth run. The dispatch's own fallback guessed the blocker would be ARC ENDS. It is not: this kernel
 * emits no G2/G3 at all (asserted below), and the ends are round only because the tool is. The blockers are four
 * other things, and they were measured on BOTH real walks before a line was written.
 *
 * ── WHY THIS IS A LOCK AND NOT A SNAPSHOT (the t1431 rest precedent, pointed at a walk instead of at maths) ────────
 * A declaration about somebody else's kernel rots the moment that kernel changes. So every clause of
 * `SLOT_RASTER_GAP` is re-measured here from the REAL emitters, traced through the REAL engine. The day the atom
 * learns a wall-anchored row rule, a two-axis inset, the slot's bearing or the declared run vector, the matching
 * assertion goes RED and that clause has to come out of the declaration — it cannot lag the code in either direction.
 *
 * ── AND THE AGREEMENT REGION IS ASSERTED TOO ──────────────────────────────────────────────────────────────────────
 * The row rule CAN be dialled past: the two row sets coincide exactly where (width − tool) is a whole multiple of the
 * stepover. Saying only "the rows differ" would be a boundary that a lucky config disproves. So the agreement is
 * measured as a property, which is what makes the boundary rest on the three clauses nothing can dial past.
 */
test.use({ viewport: { width: 1200, height: 900 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** Emitted-and-traced helpers, installed in the page: both walks reduced to the cuts they actually make. */
const HARNESS = `
async () => {
    const { slotPath, SLOT_RASTER_GAP, slotRasterGap } = await import('/wizards/ops/slot.js');
    const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const q = (n) => +Number(n).toFixed(3);
    const segsOf = (lines) => (traceToolpath(lines.join('\\n')).segments || []);
    /** The distinct row coordinates a walk cuts ALONG (level moves only), sorted. */
    const rowsOf = (lines, axis) => {
        const out = new Set();
        for (const s of segsOf(lines)) {
            if (s.rapid || Math.abs(s.z1 - s.z2) > 1e-6) continue;
            const a = axis === 'y' ? s.y1 : s.x1, b = axis === 'y' ? s.y2 : s.x2;
            const u = axis === 'y' ? s.x1 : s.y1, v = axis === 'y' ? s.x2 : s.y2;
            if (Math.abs(a - b) > 1e-6 || Math.abs(u - v) < 1e-6) continue;   // a row runs along, not across
            out.add(q(a));
        }
        return [...out].sort((x, y) => x - y);
    };
    return { slotPath, surfaceRasterLines, SLOT_RASTER_GAP, slotRasterGap, q, segsOf, rowsOf };
}`;

const SLOT = { x0: 0, y0: 0, x1: 60, y1: 0, width: 12, tool: 6, stepoverPct: 40, depth: 1.5, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, entry: 'plunge' };

test('CLAUSE 1 — THE ROW RULE: the slot anchors on the wall and forces a final pass; the atom takes the rows that FIT', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ H, SLOT }) => {
        const h = await (eval(H))();
        const lit = h.rowsOf(h.slotPath(SLOT), 'y');
        // the atom over the SAME channel, seeded the two ways a consumer could reach for
        const atom = (over) => h.rowsOf(h.surfaceRasterLines({
            x: 0, y: -6, z0: 0, w: 60, h: 12, inset: 3, depth: 1.5, stepdown: 1.5, toolDia: 6, stepoverPct: 40,
            feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel', direction: 'bothways', entry: 'plunge', rowAxis: 'x', ...over,
        }), 'y');
        const natural = atom({});
        // PHASE-CORRECTED: walk a rect one stepover taller, so the atom's step/2 offset puts its first row ON the wall
        const phased = atom({ y: -(6 + 2.4) / 2, h: 6 + 2.4, inset: 0 });
        const band = 12 - 6, step = 6 * 40 / 100;
        return { lit, natural, phased, band, step, gap: h.SLOT_RASTER_GAP };
    }, { H: HARNESS, SLOT });

    // THE PREMISE — a real widened channel, walked more than once (a boundary over a one-pass walk is vacuous)
    expect(r.lit.length, 'the sample really is a multi-pass slot').toBeGreaterThan(1);
    // THE SLOT'S RULE: both extremes sit ON the wall, so the finished channel is exactly `width`
    expect(r.lit, 'slotPath: anchored on both walls, with a forced final pass').toEqual([-3, -0.6, 1.8, 3]);
    expect(Math.max(...r.lit) - Math.min(...r.lit) + 6, 'so the channel is the width that was typed').toBeCloseTo(12, 3);
    // THE ATOM'S RULE: uniform rows, half a stepover in, only those that FIT → the channel comes out NARROW
    expect(r.natural, 'the atom, seeded the pocket way').toEqual([-1.8, 0.6, 3]);
    expect(Math.max(...r.natural) - Math.min(...r.natural) + 6, 'a 10.8mm channel where 12 was asked').toBeCloseTo(10.8, 3);
    // …and phase-correcting the seeding does not rescue it, it flips the miss to the DESTRUCTIVE side
    expect(Math.max(...r.phased), 'phase-corrected, the atom runs PAST the wall instead').toBeCloseTo(4.2, 3);
    expect(Math.max(...r.phased)).toBeGreaterThan(r.band / 2);
    expect(r.gap, 'and the declaration carries the numbers, not an adjective').toContain('1.2mm NARROW');
});

test('CLAUSE 1b — THE AGREEMENT REGION, measured: the row sets coincide iff (width − tool) is a whole multiple of the stepover', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ H }) => {
        const h = await (eval(H))();
        const out = [];
        for (const [width, tool, pct] of [[12, 6, 40], [18, 6, 40], [16.8, 6, 40], [13.2, 6, 40], [20, 8, 50], [15, 6, 100]]) {
            const step = tool * pct / 100, band = Math.max(0, width - tool);
            const lit = h.rowsOf(h.slotPath({ x0: 0, y0: 0, x1: 60, y1: 0, width, tool, stepoverPct: pct, depth: 1.5, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, entry: 'plunge' }), 'y');
            // phase-corrected seeding — the most favourable one the atom has, so the comparison is not a straw man
            const hh = band + step;
            const para = h.rowsOf(h.surfaceRasterLines({ x: 0, y: -hh / 2, z0: 0, w: 60, h: hh, inset: 0, depth: 1.5, stepdown: 1.5, toolDia: tool, stepoverPct: pct, feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel', direction: 'bothways', entry: 'plunge', rowAxis: 'x' }), 'y');
            out.push({ width, tool, pct, whole: Math.abs(band / step - Math.round(band / step)) < 1e-9, same: JSON.stringify(lit) === JSON.stringify(para), lit, para });
        }
        return out;
    }, { H: HARNESS });

    for (const c of r)
        expect(c.same, `${c.width}x${c.tool}@${c.pct}%: agreement must track "band is a whole multiple of the stepover" exactly (${JSON.stringify(c.lit)} vs ${JSON.stringify(c.para)})`).toBe(c.whole);
    expect(r.some((c) => c.whole), 'the sweep really does contain agreeing configs').toBe(true);
    expect(r.some((c) => !c.whole), '…and disagreeing ones').toBe(true);
});

test('CLAUSES 2-4 — the inset is anisotropic, the passes carry a BEARING, and the descent is anchored elsewhere', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ H, SLOT }) => {
        const h = await (eval(H))();
        const cutsOf = (lines) => h.segsOf(lines).filter((s) => !s.rapid);

        // 2 — the atom's ONE inset moves both axes: a 60mm slot walks 3..57
        const insetXs = [...new Set(cutsOf(h.surfaceRasterLines({
            x: 0, y: -6, z0: 0, w: 60, h: 12, inset: 3, depth: 1.5, stepdown: 1.5, toolDia: 6, stepoverPct: 40,
            feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel', direction: 'bothways', entry: 'plunge', rowAxis: 'x',
        })).filter((s) => Math.abs(s.z1 - s.z2) < 1e-6).flatMap((s) => [h.q(s.x1), h.q(s.x2)]))].sort((a, b) => a - b);
        const slotXs = [...new Set(cutsOf(h.slotPath(SLOT)).filter((s) => Math.abs(s.z1 - s.z2) < 1e-6).flatMap((s) => [h.q(s.x1), h.q(s.x2)]))].sort((a, b) => a - b);

        // t1490 (C2) — the SAME rect walked with the pair the slot actually needs: nothing along the length,
        // tool/2 across the width. This is the half of clause 2 that C2 retires.
        const insetPairXs = [...new Set(cutsOf(h.surfaceRasterLines({
            x: 0, y: -6, z0: 0, w: 60, h: 12, insetAlong: 0, insetAcross: 3, depth: 1.5, stepdown: 1.5, toolDia: 6,
            stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel', direction: 'bothways',
            entry: 'plunge', rowAxis: 'x',
        })).filter((s) => Math.abs(s.z1 - s.z2) < 1e-6).flatMap((s) => [h.q(s.x1), h.q(s.x2)]))].sort((a, b) => a - b);

        // 3 — the bearing (and: NO ARCS ANYWHERE, which is the dispatch's rounded-end hypothesis, measured)
        const ang = h.slotPath({ ...SLOT, x1: 51.962, y1: 30 });
        const bearings = cutsOf(ang).filter((s) => Math.abs(s.z1 - s.z2) < 1e-6)
            .map((s) => h.q(Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180 / Math.PI));
        const arcs = [6, 12, 20].map((w) => h.slotPath({ ...SLOT, width: w, depth: 3 }).filter((l) => /\\bG0?[23]\\b/.test(l)).length);

        // 4 — where each side ramps / helixes
        const firstCut = (lines) => { const c = cutsOf(lines)[0]; return [h.q(c.x1), h.q(c.y1), h.q(c.x2), h.q(c.y2)]; };
        const atomEntry = (entry) => h.surfaceRasterLines({ x: 0, y: -3, z0: 0, w: 60, h: 6, inset: 0, depth: 3, stepdown: 1.5, toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel', direction: 'bothways', entry, rampAngle: 3, helixDia: 4, helixPitch: 0.75, rowAxis: 'x' });
        const slotEntry = (entry) => h.slotPath({ ...SLOT, depth: 3, entry, rampAngle: 3, helixDia: 4, helixPitch: 0.75 });
        return {
            insetXs, insetPairXs, slotXs, bearings, arcs,
            slotRamp: firstCut(slotEntry('ramp')), atomRamp: firstCut(atomEntry('ramp')),
            slotHelix: firstCut(slotEntry('helix')), atomHelix: firstCut(atomEntry('helix')),
            gap: h.SLOT_RASTER_GAP,
        };
    }, { H: HARNESS, SLOT });

    // 2 — ANISOTROPIC INSET
    expect(r.slotXs, 'the slot runs its full centreline, A to B').toEqual([0, 60]);
    expect(r.insetXs, 'ONE number still holds the same inset on both axes — a 54mm channel where 60 was asked').toEqual([3, 57]);
    /**
     * ── ⚠ t1490 (C2) — THIS CLAUSE IS RETIRED, AND BOTH HALVES ARE ASSERTED HERE ─────────────────────────────────
     *
     * The measurement above is unchanged and still true of a caller passing ONE number, which is why it stays: it is
     * the defect this clause was written from. What changed is that the atom no longer has to be that caller — C2
     * gives it a PAIR (along the pass, across it), and handed the slot's own (0, tool/2) it walks the full
     * centreline. So the clause moves from "the atom cannot" to "the atom can, and here is it doing it".
     *
     * ⚠ THE BOUNDARY DOES NOT MOVE. C2 fixes the walked SPAN; the ROW RULE inside that span is still the atom's own
     * (C1), the AXIS is still X-or-Y (C3), and the descent still stands on its helix half. That is asserted in
     * `two-axis-inset-1490` and named — not counted — in the gap text, so landing the rest of the arc cannot leave a
     * stale number behind.
     */
    expect(r.insetPairXs, '…and the PAIR walks the full centreline, A to B — the clause C2 retires').toEqual([0, 60]);
    expect(r.gap, 'the boundary records the measurement as history').toContain('a 60mm slot walked 3..57');
    expect(r.gap, 'and records C2 as what retired it').toMatch(/C2 \(t1490\) taught it a PAIR/);
    // t1492 — C1 landed, so THE ROW RULE left this list too. What the boundary still names is THE AXIS (plus the
    // descent's helix half), and asserting the NAME rather than a count is what let this line move by one word.
    // t1494 - C3 landed and the ARC CLOSED, so no clause names a capability gap any more. What the boundary
    // still holds is TWO EVIDENCE GATES (a dialled bearing needs trig; a slot helix wants the true-arc form),
    // and asserting THAT is what keeps this line honest as the arc finished under it.
    expect(r.gap, 'the arc closed: every clause is retired').toMatch(/ALL FOUR CLAUSES ARE RETIRED NOW/);
    expect(r.gap, 'and what remains is EVIDENCE, not a walk the atom cannot do').toMatch(/TWO NAMED EVIDENCE GATES/);
    expect(r.gap, 'and recording the row rule as retired by C1, not as pending').toMatch(/C1 \(t1492\) taught it the wall rule/);

    // 3 — THE BEARING, and the arc-ends hypothesis REFUTED rather than assumed
    expect(r.bearings.filter((b) => Math.abs(Math.abs(b) - 30) < 0.01 || Math.abs(Math.abs(b) - 150) < 0.01).length,
        'a 30° slot cuts its passes on the 30° bearing').toBeGreaterThan(0);
    expect(r.arcs, 'and NO width emits an arc — the ends are round because the TOOL is, not because a G2/G3 says so').toEqual([0, 0, 0]);

    // 4 — THE DESCENT
    expect(r.slotRamp[1], 'the slot ramps ALONG its length: the pass Y never changes').toBeCloseTo(r.slotRamp[3], 3);
    /**
     * ── ⚠ t1487 — HALF OF THIS CLAUSE IS RETIRED, AND THE BOUNDARY STANDS ON THE OTHER HALF ──────────────────────
     *
     * This read "the atom ramps toward the AREA CENTRE, so its Y drifts across the channel" — one of the four
     * measured reasons a slot cannot ride the atom. C4 (t1483/t1485) taught the atom a DECLARED RUN VECTOR: its ramp
     * now runs along its own ROW and its cross coordinate never moves, exactly as a slot's does. So that reason is
     * gone, and `SLOT_RASTER_GAP` says so rather than keeping a sentence that stopped being true.
     *
     * ⚠ THE BOUNDARY DOES NOT MOVE, and this is the part worth being careful about: the descent clause survives on
     * its HELIX half (the atom still helixes in the middle of the channel, clamped by the rect inradius — t1472/1474
     * ruled the true-arc helix a different road), and the ramp half only ever agreed with a slot that happens to be
     * AXIS-ALIGNED, which THE AXIS clause already covers. Three of the four still need a capability the atom does not
     * declare. A capability that dissolved one reason and was allowed to read as dissolving the boundary is exactly
     * what this spec exists to prevent.
     */
    expect(r.atomRamp[1], 'the atom ramps along its ROW now (C4) — its cross coordinate no longer drifts').toBeCloseTo(r.atomRamp[3], 3);
    expect(r.gap, 'and the declared boundary records that half as retired, rather than keeping a stale reason').toMatch(/C4, t1485|retired/);
    expect(r.slotHelix[0], 'the slot helixes at the ENTRY END').toBeLessThan(10);
    expect(r.atomHelix[0], '…the atom STILL in the MIDDLE of the channel — the half of this clause that stands').toBeGreaterThan(25);
    // t1494 - the arc finished under this line: all four clauses are retired, so the boundary no longer holds on
    // a COUNT of measured ways. It holds on EVIDENCE, and that is the durable form of the same claim.
    expect(r.gap, 'the boundary now holds on evidence rather than on a count of capabilities').toMatch(/TWO NAMED EVIDENCE GATES/);
});

test('THE BOUNDARY IS ABOUT THE WALK, not about a slot\'s numbers — so nothing can dial past it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ H }) => {
        const h = await (eval(H))();
        const P = { x0: 0, y0: 0, x1: 60, y1: 0, width: 12, tool: 6, stepoverPct: 40, depth: 4, stepdown: 1.5 };
        const gaps = {};
        // every dimension moved, including the ones that make the ROW SETS AGREE — the obstruction is elsewhere
        for (const over of [{}, { width: 18 }, { width: 6 }, { width: 13.2 }, { tool: 12, stepoverPct: 100 },
            { x1: 51.962, y1: 30 }, { x1: 5 }, { stepoverPct: 5 }, { entry: 'ramp' }, { entry: 'helix' }])
            gaps[JSON.stringify(over)] = h.slotRasterGap({ ...P, ...over });
        return { gaps, degenerate: h.slotRasterGap({ ...P, x1: 0, y1: 0 }) };
    }, { H: HARNESS });

    for (const k of Object.keys(r.gaps)) expect(r.gaps[k], `${k}: still refused — the obstruction is the walk, not the numbers`).not.toBe('');
    expect(r.degenerate, 'a zero-length slot is a single plunge -> there is no clearing walk to port, so no gap').toBe('');
});

/**
 * ── THE CAM HONESTY AUDIT — the pocket's, pointed at the slot, and the facts fall harder ──────────────────────────
 *
 * `slotFromOp('slot')` is the generator every slot op packs through (`camTypeOf` returns `{ camType: 'slot' }`
 * UNCONDITIONALLY — no width gate, no pattern gate). Its macro is ONE centreline pass per level, and its own comment
 * admits it: *"For width > tool, add perpendicular offset passes."*
 *
 * ⚠ THIS TEST ASSERTED A GAP, AND t1444 CLOSED HALF OF IT — which is the lock doing its job rather than a nuisance.
 * The generator STILL drops width/stepover/entry/plunge (its macro is unchanged), but a slot it would cut wrongly no
 * longer reaches it: `camTypeOf` now refuses at PACK, on the "never emit a wrong slot" rule that single-axis middle
 * and polygon pockets have always been held to. So the DROP assertions stand as they were and the ROUTING ones are
 * inverted, with the refusal's own sentence asserted. Teaching the macro the offset passes is what closes the rest.
 */
test('CAM AUDIT — the packed slot macro drops the op\'s DEFINING dimension, and nothing declares it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ H }) => {
        const h = await (eval(H))();
        const { slotFromOp } = await import('/data/opToSlot.js');
        const { camTypeOf, GENERATOR_IGNORES, generatorIgnores, generatorBakesPick } = await import('/data/opCamMap.js');
        const gen = slotFromOp('slot', '', new Set(), 0);
        const keys = gen.fields.map((f) => f.key);
        const OP = ['ax', 'ay', 'bx', 'by', 'width', 'toolDia', 'stepoverPct', 'depth', 'stepdown', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'feed', 'plunge', 'clearance', 'pattern'];
        // what the WIZARD cuts for the same op, so the loss is in millimetres rather than in adjectives
        const ys = h.rowsOf(h.slotPath({ x0: 0, y0: 0, x1: 60, y1: 0, width: 12, tool: 6, stepoverPct: 40, depth: 1.5, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, entry: 'plunge' }), 'y');
        return {
            keys, dropped: OP.filter((k) => !keys.includes(k)),
            wizardWidth: Math.max(...ys) - Math.min(...ys) + 6,
            zLine: (gen.body || '').split('\n').map((l) => l.trim()).find((l) => /^G1 Z/.test(l)),
            camRoute: camTypeOf({ opType: 'slot', params: { width: 12, toolDia: 6, pattern: 'grid' } }),
            camEqual: camTypeOf({ opType: 'slot', params: { width: 6, toolDia: 6 } }),
            slotIgnores: GENERATOR_IGNORES.slot || null,
            entrySentence: generatorIgnores('slot', 'entry', {}),
            // t1512 — the drop is DECLARED now, on the arm it happens on (width 6 == tool → the literal centreline arm)
            entryBaked: generatorBakesPick('slot', 'entry', { width: 6, toolDia: 6, ax: 0, ay: 0, bx: 60, by: 0 }),
        };
    }, { H: HARNESS });

    // THE MEASURED DROP — the op's width, its stepover, its descent and its plunge feed have no field at all
    expect(r.dropped, 'the generator has no field for any of these').toEqual(
        expect.arrayContaining(['width', 'toolDia', 'stepoverPct', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'plunge', 'pattern']));
    expect(r.keys, '…and carries exactly these').toEqual(['ax', 'ay', 'bx', 'by', 'depth', 'stepdown', 'feed', 'clearance', 'rpm']);
    // WHAT IT COSTS, in millimetres: the wizard cuts the typed width, the macro cuts the tool
    expect(r.wizardWidth, 'the wizard cuts the 12mm channel that was typed').toBeCloseTo(12, 3);
    /**
     * ⚠ t1512 — THIS AUDIT'S SUBJECT IS NOW THE **LITERAL ARM ONLY**, and the drop it measures above is exactly why the
     * packed arm was built. Everything before this point still holds and is still the motive; what changed is what
     * happens to a WIDE slot. It used to be refused because the only macro was this one. It now PACKS — onto the atom —
     * whenever the atom can walk it, so the refusal below is a patterned slot's (this harness passes `pattern: 'grid'`,
     * and a pattern is not self-framing), stated in the atom envelope's own words instead of the centreline body's.
     */
    /**
     * ⚠ t1516 — AND THE REFUSAL'S **REASON** MOVED, which is the third time this pin has been restated and the first
     * time the sentence got better rather than just newer. Until now a patterned slot was refused only as a SIDE
     * EFFECT: the wizard's arm question hands back a pattern gap, and `slotWideRefusal` quoted it — so a WIDE pattern
     * was refused for a reason about self-framing, and a NARROW one was not refused at all (it packed on the literal
     * arm and cut ONE slot where six were drawn — the silent drop this act closes). The pattern is asked about first
     * now, before either arm, and answers for itself on both.
     */
    expect(r.camRoute.camType, 'a 12mm-wide PATTERNED slot still does not pack').toBeUndefined();
    // (this harness names the pattern KIND but not its size, so the count is the generator's own default — the exact
    //  numbers are pinned in slot-pattern-and-seeds-1516, where the op declares them)
    expect(r.camRoute.unsupported, '…and is refused for the PATTERN\'s own reason now — it used to quote the arm gap ("array")').toMatch(/\d+ slots in a grid pattern/);
    expect(r.camRoute.unsupported, '…naming what packing it would actually cut').toMatch(/drop the other \d+/);
    expect(r.camRoute.unsupported, '…with somewhere to go, because "unsupported" alone makes the operator guess').toContain('Slot wizard');
    expect(r.camRoute.unsupported, '…and NOT told about bearings, which is a reason belonging to a different refusal').not.toContain('C5');
    expect(r.camRoute.unsupported, '…nor about self-framing, which is the ARM question and not this one').not.toContain('array');
    expect(r.camEqual.camType, 'and the case the centreline macro DOES cut correctly still packs — width == tool').toBe('slot');
    // THE PLUNGE FEED IS DROPPED TOO — the LITERAL macro descends at the CUTTING feed (the packed arm carries a real one)
    expect(r.zLine, 'the Z descent rides F#7, the cut feed — the literal arm\'s plunge feed has no field').toBe('G1 Z[-#50] F#7');
    // …AND IT IS DECLARED NOW, which is the other half of what t1512 owed this audit: the drop was silent when this
    // spec was written (no row existed at all), and a greyed row on the literal arm now says the descent pick is not
    // honoured and which setting changes that.
    expect(r.slotIgnores, 'GENERATOR_IGNORES still has no slot key — the pick IS carried (the helix freezes stepdown), so "ignored" would be the wrong word').toBeNull();
    expect(r.entrySentence, '…and therefore no ignored-sentence either').toBe('');
    expect(r.entryBaked, 'the literal arm DECLARES the descent drop as a baked pick, with what to change').toMatch(/always plunges/);
    expect(r.entryBaked, '…and names the widening that gets a real descent').toMatch(/Widen the slot/);
});
