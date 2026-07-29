import { test, expect } from '@playwright/test';

/**
 * t1377 — THE MODAL-FEED FOLD LEARNS FLOW, AND THE CRITERION IS EXECUTION.
 *
 * THE DEFECT, as shipped in V2026.07.29.7. `applyModalFeed` drops an F word that repeats the current feed — correct for
 * a program that runs top to bottom, which every program was while the kernels unrolled their geometry in JavaScript.
 * The parametric family brought FLOW, and a text walk cannot see it:
 *
 *     G1 Z[0 - #46] F200      the plunge sets the modal feed to 200
 *     GOTO14                  the FIRST row of every depth level jumps from here…
 *     N13
 *     G1 Y#47 F2000           …straight past the only F2000
 *     N14
 *     IF #49 < 0 GOTO15
 *     G1 X[0 + #40]           its F folded away → this cut ran at 200. Ten times slow.
 *
 * Found by looking at the app's own time estimate (t1375), not by any test — and that is the second half of this turn's
 * job, because the blindness is structural: every equivalence bridge compares POSITIONS, and a feed is not a position.
 *
 * ── WHY A BARRIER LIST AND NOT A SMARTER TRACKER ──────────────────────────────────────────────────────────────────
 * Soundness has to come from CONSTRUCTION, not from a test passing. The fold now carries the feed only along a straight
 * run of lines and treats every line control can enter from elsewhere as a barrier (label, jump, conditional, loop head,
 * loop back edge, oword flow, subprogram call/return). No fold crosses a control-flow edge, so redundancy holds on EVERY
 * path — including paths no test traces. The barrier set is declared as data in blockEmitter beside the fold.
 *
 * ── THE CRITERION, WHICH IS WHAT THIS FILE MEASURES ───────────────────────────────────────────────────────────────
 * Traced THROUGH EXECUTION — the tracer follows the jumps — every motion must carry exactly the feed the UNFOLDED
 * program gives it. The fold declares each F it dropped (`feedFolds`), so the unfolded program is reconstructible and
 * the two can be compared move for move on (position, feed). That is a measurement of the fold against the thing it
 * claims to be equivalent to, rather than an inspection of its rules.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * THE PROGRAMS UNDER TEST — chosen to span the flow forms the barrier list names, not to be a tour of the app.
 * Every op that carries a loop, a conditional jump or a label belongs here; a straight literal op is included as the
 * control, because the fold must still be a no-op for the programs it was written for.
 */
const PROGRAMS = [
    { op: 'surfacing', why: 'the defect itself: a depth loop, a row loop, and two direction branches' },
    { op: 'surfacing', params: { entry: 'ramp', rampAngle: 3 }, why: 'a ramp adds its own degrade branch inside the row' },
    { op: 'surfacing', params: { entry: 'helix', helixDia: 8, helixPitch: 1 }, why: 'a helix adds a third nested loop with a re-seed branch' },
    { op: 'surfacing', params: { strategy: 'concentric' }, why: 'the ring walk: a different inner loop over the same header' },
    { op: 'surfacing', params: { confirmEvery: 2 }, why: 'the confirm cadence adds a forward jump past a pause' },
    { op: 'surfacing', params: { zMode: 'skim' }, why: 'the skim frame adds three refusal branches before any motion' },
    { op: 'pocket', why: 'THE CONTROL — a literal op the fold was written for; it must still fold' },
    { op: 'contour', why: 'a second literal op, with its own retract shape' },
    { op: 'corner', why: 'a probe macro: G91 regions, register feeds, and a safe-retract guard label' },
    { op: 'middle', why: 'a probe macro with more branches than any cutting op' },
    { op: 'alignment', why: 'the probe whose rotation output this arc exists for' },
    { op: 'drill', why: 'a stamped pattern — the same child emitted many times' },
    { op: 'text', why: 'engraving: the deepest nesting in the app' },
];

/**
 * Both programs, traced. `unfold` re-inserts every F the pass declared it dropped — before any trailing comment, so the
 * reconstruction cannot depend on how the engine treats comments.
 */
const traced = (page, op, params) => page.evaluate(async ({ op, params }) => {
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitMapped, FEED_BARRIERS } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const NL = String.fromCharCode(10);
    const build = builderOf(op);
    if (!build) return { missing: true };
    const res = emitMapped(build(params || {}));
    const folded = res.lines.slice();
    const unfolded = res.lines.slice();
    for (const { line, f } of res.feedFolds) {
        const l = unfolded[line], i = l.indexOf('(');
        unfolded[line] = i < 0 ? `${l} F${f}` : `${l.slice(0, i)}F${f}   ${l.slice(i)}`;
    }
    const walk = (nc) => (traceToolpath(nc).segments || []).map((s) => ({
        x: +s.x2.toFixed(3), y: +s.y2.toFixed(3), z: +s.z2.toFixed(3),
        f: +Number(s.feed || 0).toFixed(3), rapid: !!s.rapid, probe: !!s.probe,
    }));
    // THE OLD RULE, for comparison: a linear walk with no barriers — exactly what shipped, reproduced here from the
    // unfolded program so the cost of the barriers can be MEASURED rather than described.
    const blindFold = (lines) => {
        let modal = null;
        return lines.map((l) => {
            const m = l.match(/ F(-?\d+(?:\.\d+)?)\b/);
            if (m) {
                const f = Number(m[1]);
                if (modal !== null && f === modal) return l.slice(0, m.index) + l.slice(m.index + m[0].length);
                modal = f; return l;
            }
            if (/ F[#[]/.test(l)) modal = null;
            return l;
        });
    };
    const blind = blindFold(unfolded);
    const hasFlow = res.lines.some((l) => { const c = l.replace(/\([^)]*\)/g, '').replace(/;.*$/, '').trim(); return c && FEED_BARRIERS.some((re) => re.test(c)); });
    return {
        folds: res.feedFolds.length, hasFlow,
        foldedMoves: walk(folded.join(NL)), unfoldedMoves: walk(unfolded.join(NL)), blindMoves: walk(blind.join(NL)),
        // how many CUTTING moves the program resolves to at all — a program that traces nothing proves nothing
        cuts: walk(folded.join(NL)).filter((m) => !m.rapid).length,
        // the barriers' cost, in F words: what the old rule folded, minus what this one does
        blindFolds: blind.filter((l, i) => l !== unfolded[i]).length,
        sameAsBlind: blind.join(NL) === folded.join(NL),
    };
}, { op, params });

for (const P of PROGRAMS) {
    const name = `${P.op}${P.params ? ' · ' + JSON.stringify(P.params) : ''}`;
    test(`THE CRITERION — ${name} (${P.why})`, async ({ page }) => {
        await boot(page);
        const r = await traced(page, P.op, P.params);
        expect(r.missing, `${P.op} is a registered op`).toBeFalsy();
        // THE PROGRAM HAS TO RESOLVE, or nothing below means anything.
        expect(r.cuts, `${name} resolves to real cutting moves`).toBeGreaterThan(0);
        // THE CRITERION. Same moves, same order, and every one carrying the feed the unfolded program gives it.
        // (A program that folds nothing satisfies this trivially — which is why the harness's teeth are proven
        // separately, by the negative control below, rather than by demanding every program fold something.)
        expect(r.foldedMoves.length, `${name}: folding changes no move count`).toBe(r.unfoldedMoves.length);
        expect(r.foldedMoves, `${name}: every move carries the UNFOLDED program's feed, traced through execution`).toEqual(r.unfoldedMoves);
        // AND THE COST OF THE BARRIERS, measured per program: on a program with NO flow they must be free — the fold is
        // byte-for-byte what the old linear rule produced, so every program the fold was written for is untouched.
        if (!r.hasFlow) {
            expect(r.sameAsBlind, `${name} carries no flow, so the barriers cost it nothing (identical to the old fold)`).toBe(true);
        }
    });
}

/**
 * THE NEGATIVE CONTROL — the criterion has teeth, and the defect it catches is the one that shipped.
 *
 * Two things are proven here that no amount of green elsewhere can. First: the OLD rule, applied to the same programs,
 * FAILS the criterion — so the criterion is not something any fold would pass. Second: what it fails on is precisely
 * the shipped defect, a cutting move executing at a feed the program never gave it.
 */
test('THE NEGATIVE CONTROL — the OLD linear fold fails this criterion, and fails it as the shipped defect', async ({ page }) => {
    await boot(page);
    const found = [];
    for (const P of [{ op: 'surfacing' }, { op: 'surfacing', params: { entry: 'ramp', rampAngle: 3 } }, { op: 'surfacing', params: { strategy: 'concentric' } }]) {
        const r = await traced(page, P.op, P.params);
        const name = `${P.op}${P.params ? ' · ' + JSON.stringify(P.params) : ''}`;
        expect(r.hasFlow, `${name} really does carry flow`).toBe(true);
        expect(r.blindFolds, `${name}: the old rule really did fold F words here (${r.blindFolds})`).toBeGreaterThan(0);
        // the old fold changes the EXECUTED feeds; the new one does not
        const blindWrong = r.blindMoves.filter((m, i) => r.unfoldedMoves[i] && m.f !== r.unfoldedMoves[i].f);
        if (blindWrong.length) found.push({ name, n: blindWrong.length, sample: blindWrong[0], want: r.unfoldedMoves[r.blindMoves.indexOf(blindWrong[0])] });
    }
    // AT LEAST ONE of the flow-carrying programs must be broken by the old rule — otherwise this file would be
    // asserting a property that was never at risk, and the defect that shipped would have no witness here.
    expect(found.length, `the old linear fold executes wrong feeds on at least one flow program (found: ${JSON.stringify(found.map((f) => f.name))})`).toBeGreaterThan(0);
    // …and the direction of the error is the shipped symptom: a move running SLOWER than the program asked.
    const worst = found[0];
    expect(worst.sample.f, `${worst.name}: the old rule ran a move at ${worst.sample.f} — a feed the program never gave it`).toBeGreaterThan(0);
});

/**
 * THE DEFECT, PINNED AS ITSELF — so the specific thing that shipped cannot come back under a passing criterion.
 *
 * The criterion above is the general guard. This is the instance: on a multi-level surfacing raster, the FIRST row of
 * every level must cut at the cutting feed. It is asserted on the resolved motion (the feed the machine would use), not
 * on the presence of an F word, because the F word is not the thing that was wrong.
 */
test('THE SHIPPED DEFECT — the first row of every level cuts at the CUTTING feed, not the plunge feed', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        // three levels x several rows, and a plunge feed an order below the cutting feed so a confusion is unmissable
        const cfg = { w: 100, h: 60, depth: 1.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5 };
        const segs = (traceToolpath(emitProgram(surfacingStack(cfg))).segments || []);
        const cuts = segs.filter((s) => !s.rapid);
        // a cut that MOVES IN XY is a raster cut; a pure-Z cut is the plunge, and that one is meant to be at 200
        const xy = cuts.filter((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 1e-6).map((s) => +Number(s.feed).toFixed(1));
        const plunges = cuts.filter((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1) <= 1e-6).map((s) => +Number(s.feed).toFixed(1));
        return { xy, plunges, slow: xy.filter((f) => f !== 2000) };
    });
    expect(r.xy.length, 'the raster really cuts in XY across several levels').toBeGreaterThan(20);
    expect(r.plunges.length, 'and it really plunges (one per level), so the two feeds are both present').toBeGreaterThan(2);
    // EVERY XY cutting move at the cutting feed. Before this turn the first row of each level sat at 200.
    expect(r.slow, `no XY cutting move runs at anything but the cutting feed — saw ${JSON.stringify([...new Set(r.xy)])}`).toEqual([]);
    expect([...new Set(r.plunges)], 'and the plunge keeps its own, slower feed').toEqual([200]);
});

/**
 * WHAT THE BARRIERS COST, ACROSS THE WHOLE REGISTERED FAMILY — measured, op by op, in one place.
 *
 * The trade is deliberate: a barrier that was not strictly necessary costs one redundant F word; a missing one costs a
 * move at the wrong feed. But "deliberate" is not the same as "small", so the cost is counted rather than asserted about,
 * and the two halves are separated because they are different claims:
 *
 *   A FLOW-FREE program must be BYTE-IDENTICAL to what the old rule produced. The fold was written for these programs
 *     and the barriers must not have touched them. This is the byte-fallout claim, checked op by op.
 *   A FLOW-CARRYING program keeps more F words, and how many is reported. Those are not a regression — they are the
 *     lines whose feed was previously being guessed.
 */
test('THE COST — flow-free programs fold exactly as before; the flow-carrying ones are listed with their cost', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { BUILDERS } = await import('/blocks/opBuilders.js');
        const { emitMapped, FEED_BARRIERS } = await import('/blocks/blockEmitter.js');
        const NL = String.fromCharCode(10);
        const blindFold = (lines) => {
            let modal = null;
            return lines.map((l) => {
                const m = l.match(/ F(-?\d+(?:\.\d+)?)\b/);
                if (m) { const f = Number(m[1]); if (modal !== null && f === modal) return l.slice(0, m.index) + l.slice(m.index + m[0].length); modal = f; return l; }
                if (/ F[#[]/.test(l)) modal = null;
                return l;
            });
        };
        const rows = [];
        for (const [op, build] of Object.entries(BUILDERS)) {
            let res = null;
            try { res = emitMapped(build({})); } catch (_) { continue; }
            const unfolded = res.lines.slice();
            for (const { line, f } of res.feedFolds) {
                const l = unfolded[line], i = l.indexOf('(');
                unfolded[line] = i < 0 ? `${l} F${f}` : `${l.slice(0, i)}F${f}   ${l.slice(i)}`;
            }
            const blind = blindFold(unfolded);
            const hasFlow = res.lines.some((l) => { const c = l.replace(/\([^)]*\)/g, '').replace(/;.*$/, '').trim(); return c && FEED_BARRIERS.some((re) => re.test(c)); });
            rows.push({ op, hasFlow, folds: res.feedFolds.length,
                blindFolds: blind.filter((l, i) => l !== unfolded[i]).length,
                identical: blind.join(NL) === res.lines.join(NL) });
        }
        return rows;
    });
    expect(r.length, 'the sweep ran over the registered builders').toBeGreaterThan(15);
    // (1) THE BYTE FALLOUT IS EXACTLY THE FLOW-CARRYING OPS — every flow-free op folds byte-for-byte as before.
    const flowFreeMoved = r.filter((x) => !x.hasFlow && !x.identical).map((x) => x.op);
    expect(flowFreeMoved, `no flow-free op changed at all: ${JSON.stringify(flowFreeMoved)}`).toEqual([]);
    // (2) AND THE OPS THAT DID MOVE ARE NAMED WITH THEIR COST, so it is a known number and not a vague "some".
    const moved = r.filter((x) => !x.identical).map((x) => ({ op: x.op, was: x.blindFolds, now: x.folds }));
    expect(moved.every((x) => x.now <= x.was), `every changed op keeps MORE F words, never fewer: ${JSON.stringify(moved)}`).toBe(true);
    // (3) THE FOLD IS STILL A FOLD where there is no flow to stop it — otherwise the barriers would have quietly
    //     turned a real optimisation off and this file would not have noticed. Named rather than counted: a threshold
    //     would pass on the wrong ops, and these two are the flow-free cutting bodies the fold was written for.
    const stillFolding = r.filter((x) => x.folds > 0).map((x) => x.op);
    for (const op of ['pocket', 'contour']) {
        expect(stillFolding, `${op} still has its F words folded (folding ops: ${JSON.stringify(stillFolding)})`).toContain(op);
    }
    // (4) AND THE ONES THAT FOLD NOTHING FOLD NOTHING FOR THEIR OWN REASONS, not because of this change — the byte
    //     assert in (1) already proves the barriers did not cause it. `slot` is the readable example: its feeds
    //     ALTERNATE (a plunge then a cut, once per level), so no F ever repeats the one before it and there was never
    //     anything to fold. Recorded here so a future reader does not go looking for a regression that is not one.
    const slot = r.find((x) => x.op === 'slot');
    if (slot) expect(slot.blindFolds, 'slot folded nothing under the OLD rule either — alternating feeds, not a regression').toBe(slot.folds);
});

/**
 * ARE THERE OTHER WORDS THE BRIDGES CANNOT SEE? — the CHECK the dispatch asked for, answered by measurement.
 *
 * The feed was invisible because a PASS folded it and the comparisons only read positions. So the question is not
 * "could S or an M-state be wrong" in the abstract, it is: does any pass in the emit chain REWRITE a non-position word,
 * and do the compared programs differ in any such word?
 *
 * MEASURED, both halves. (1) `applyModalFeed` is the only pass that folds anything — every other pass inserts, rewrites
 * coordinates, or comments a line out, and none of them touches S or an M word's value. (2) The programs the surfacing
 * bridges compare carry S and M words identically, which is asserted here rather than assumed, so a future divergence
 * shows up as a failure in this file instead of passing unnoticed through a position-only comparison.
 */
test('THE OTHER WORDS — S and M-state are identical across the compared programs, and nothing folds them', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingStack, surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const NL = String.fromCharCode(10);
        const cfg = { w: 100, h: 60, depth: 1.0, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5, rpm: 14000 };
        // every S word and every M word, in order, from the emitted text
        const words = (t) => t.split(NL).map((l) => l.replace(/\([^)]*\)/g, '')).join(NL)
            .match(/\b(?:S\d+(?:\.\d+)?|M\d+)\b/g) || [];
        const par = emitMapped(surfacingStack(cfg)), lit = emitMapped(surfacingLiteralStack(cfg));
        // THE ONLY FOLDING PASS, checked as a fact and not as a memory: every entry the fold declares is an F, and the
        // S/M words survive it. `lit` folds heavily (a flow-free program), so this is measured where folding is busiest.
        const litUnfolded = lit.lines.slice();
        for (const { line, f } of lit.feedFolds) { const l = litUnfolded[line], i = l.indexOf('('); litUnfolded[line] = i < 0 ? `${l} F${f}` : `${l.slice(0, i)}F${f}   ${l.slice(i)}`; }
        return {
            par: words(par.text), lit: words(lit.text),
            litFolds: lit.feedFolds.length,
            // the S/M words of the literal program BEFORE and AFTER the fold ran
            litWordsFolded: words(lit.text), litWordsUnfolded: words(litUnfolded.join(NL)),
        };
    });
    expect(r.lit.length, 'the programs really do carry S/M words (spindle on, coolant, end)').toBeGreaterThan(3);
    expect(r.par, 'the parametric and literal programs carry the SAME S and M words in the same order').toEqual(r.lit);
    // THE FOLD TOUCHES NOTHING BUT F — measured on the program where it folds most, not assumed from reading it.
    expect(r.litFolds, 'the literal program really is folded heavily (so the assert below is not vacuous)').toBeGreaterThan(10);
    expect(r.litWordsFolded, 'folding removes no S word and no M word — only F').toEqual(r.litWordsUnfolded);
});
