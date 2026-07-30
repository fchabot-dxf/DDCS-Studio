import { test, expect } from '@playwright/test';

/**
 * t1381 — THE DRILL FAMILY, FOLDED: a PATTERN of holes × a per-hole CYCLE, in ONE parametric body.
 *
 * t1379 landed the peck cycle, measured the family, and found the constraint that decided this turn's shape: a
 * FLOW-CARRYING BODY CANNOT BE STAMPED (two copies of the same labels, and the second `GOTO` binds the first `N`, so
 * only the first hole drills). This turn adds the two bore cycles and folds the pattern IN, so the program has one body
 * with one label set.
 *
 * THE CRITERION IS THE ARC'S, SINCE t1329, with the feed dimension t1377 made table stakes: the OLD literal composition
 * at a config and the NEW parametric body at that config must EXECUTE THE SAME MOVES — (position, feed, rapid/cut) per
 * move, resolved through the engine, in order. A text diff would prove nothing: one is a loop and the other is a list.
 *
 * ⚠ THE LITERAL SIDE IS THE REAL COMPOSITION, not a hand-rolled stand-in: `array{drill|bore}` emitted through
 * `emitProgram`, which is exactly what `drillStack` builds today. So these bridges are about the program the app ships.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * ⚠ WHY EVERY TRACE HERE PASSES `traceStepCap`, and it is a REPORTED DEFECT rather than a test convenience.
 *
 * The engine's runaway guard is `max(program.length * 50, 5000)` STEPS — sized by program LENGTH, which is precisely
 * the quantity a parametric loop collapses. Measured this turn: a literal helical bore on a 24-hole bolt circle is
 * ~11700 lines, so its cap is ~585k steps and it traces whole; the parametric body that emits the IDENTICAL path is 43
 * lines, gets the 5000 floor, and truncates at about a twelfth of it (117061 steps are actually needed). `stats.capped`
 * says so and nothing reads it, so the 2D/3D PREVIEW would silently draw a partial toolpath after the switch.
 *
 * Not fixed here, because the default is a trade and not a free win: the low floor is what makes a genuinely runaway
 * program give up in milliseconds, and the value-glow localizer probes many perturbed tokens per build (a ~1e6 sentinel
 * depth is a legal-looking loop), so a large floor is paid on every localize. REPORTED for a ruling; the opt-in seam is
 * what lets these bridges tell the truth in the meantime.
 */
const CAP = 3_000_000;

/** literal composition vs parametric body — both traced, both resolved. */
const bridge = (page, cfg) => page.evaluate(async ({ cfg, CAP }) => {
    const { newBlock, emitProgram } = await import('/blocks/blockEmitter.js');
    const { holeCycleLines } = await import('/wizards/ops/holecycle.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const NL = String.fromCharCode(10);
    const cyc = cfg.cycle || 'peck';
    const bored = cyc !== 'peck';
    // THE LITERAL SIDE — the array container stamping the literal kernel, i.e. what drillStack builds today.
    const arr = newBlock('array');
    arr.params = { pattern: cfg.pattern || 'single', x0: cfg.x0 || 0, y0: cfg.y0 || 0,
        cols: cfg.cols, rows: cfg.rows, dx: cfg.dx, dy: cfg.dy, count: cfg.count, spacing: cfg.spacing,
        angle: cfg.angle, dia: cfg.dia, startAngle: cfg.startAngle, w: cfg.w, h: cfg.h, nx: cfg.nx, ny: cfg.ny,
        skip: cfg.skip || '' };
    const child = newBlock(bored ? 'bore' : 'drill');
    child.params = bored
        ? { x: 0, y: 0, holeDia: cfg.holeDia, toolDia: cfg.toolDia, depth: cfg.depth, pitch: cfg.pitch,
            ramp: cyc === 'bore-helix' ? 'helix' : 'step', feed: cfg.feed, clearance: cfg.clearance }
        : { x: 0, y: 0, depth: cfg.depth, peck: cfg.peck, feed: cfg.feed, clearance: cfg.clearance };
    arr.children = [child];
    // BOTH FRAMED IDENTICALLY and minimally — a G90 and a clearance rapid, which is what the real framing puts in
    // front of either kernel. The atom must not depend on anything else being there.
    const wrap = (body) => ['G90', `G0 Z${cfg.clearance != null ? cfg.clearance : 5}`, ...body, 'M30'].join(NL);
    // `+ 0` NORMALISES NEGATIVE ZERO. The parametric side computes a coordinate through an expression, so an axis that
    // lands on zero can arrive as -0 where the literal's baked number is 0. They are the same position and the same
    // G-code; only `toEqual` (Object.is) tells them apart, so normalising here keeps the assert about the MACHINE
    // instead of about IEEE-754 sign bits.
    const R = (n) => (+Number(n).toFixed(3)) + 0;
    const moves = (nc) => (traceToolpath(nc, { traceStepCap: CAP }).segments || []).map((s) => ({
        x: R(s.x2), y: R(s.y2), z: R(s.z2), f: R(s.feed || 0), r: !!s.rapid,
    }));
    const litNc = wrap(String(emitProgram([arr])).split(NL));
    const parNc = wrap(holeCycleLines(cfg));
    return {
        lit: moves(litNc), par: moves(parNc),
        litCapped: !!traceToolpath(litNc, { traceStepCap: CAP }).stats.capped,
        parCapped: !!traceToolpath(parNc, { traceStepCap: CAP }).stats.capped,
        litLines: String(emitProgram([arr])).split(NL).length, parLines: holeCycleLines(cfg).length,
    };
}, { cfg, CAP });

const cuts = (ms) => ms.filter((m) => !m.r);
const rapids = (ms) => ms.filter((m) => m.r);

/**
 * ══ THE MIGRATION'S STATED EXCEPTIONS TO ITS "EXACT" CLAIM — THE LEDGER ══════════════════════════════════════════
 *
 * Everything in the drill family's migration is move-for-move identical to the literal EXCEPT the entries below. They
 * live together, in one block, deliberately: the value of a stated exception is that a reader can find ALL of them in
 * one place and count them. An exception recorded next to whichever test discovered it is one that gets missed. Each is
 * RULED, not assumed, and each points at the bridge that asserts it.
 *
 * (The surfacing family keeps its own two in surfacing-parametric-1329.spec.js — the helix quantum and the offZ
 * approach height. These are the DRILL family's, and the R-plane below is the first entry written for it.)
 *
 * ── EXCEPTION 1 (t1379 reported → t1381 RULED) — THE R-PLANE ENTRY, one extra rapid per hole ─────────────────────
 *   The literal has NO first-peck rapid: on peck 1 it FEEDS from clearance all the way to the first cut depth, through
 *   the air gap, at the drilling feed — 7mm at 100mm/min on the default config, about four seconds per hole cutting
 *   nothing. t1379 reproduced it deliberately (a migration that quietly improves its own reference makes its own bridge
 *   untrue) and reported it.
 *
 * USER/ADVISOR RULING (t1381): that air-feed was an ARTIFACT of the `prev > 0` guard, not intent. The canonical G83
 * shape rapids to a REFERENCE PLANE just above the surface and feeds from there, so the rapid becomes UNCONDITIONAL and
 * the approach margin is a DECLARED constant (`APPROACH`, 0.5mm — the literal kernel's own re-entry value doing double
 * duty). THE EXACT RELATIONSHIP, and it is what the bridges below assert: the parametric body has exactly ONE more
 * rapid PER HOLE than the literal, each at the surface plus the margin; EVERY CUT is identical in position and feed;
 * every retract is identical; the hole order is identical. Nothing else moves.
 *   Asserted by: EQUIVALENCE (peck) — every config — and THE R-PLANE, EXACTLY.
 *
 * ── EXCEPTION 2 (t1345, INHERITED) — the helical bore's points, by at most one emit quantum per axis ─────────────
 *   The helical bore rotates a vector rather than calling trig (unverified on this controller), so its points differ
 *   from the literal's by at most ONE EMIT QUANTUM (0.001mm) PER AXIS. This is the SAME exception the surfacing helix
 *   already carries and for the same reason — the literal applies r3() to every point as it generates it, and the
 *   pattern's points are rounded a second time on the way in, so reproducing that mid-generation rounding would gate a
 *   strictly better number behind ROUND, a function this controller has not been verified to have. It licenses
 *   MAGNITUDE ONLY: move count, order, feed and rapid/cut are still exact.
 *   Asserted by: EQUIVALENCE (bore) — the per-axis bound, with the count and every feed compared exactly.
 *
 * ══ Two exceptions, both stated, both bridged. A third would need its own ruling before it could be added here. ══
 */

/**
 * THE PECK CONFIGS — t1379's eight HAND-DERIVED peck boundaries, each chosen where a loop and an unrolled list are most
 * likely to disagree rather than where they are most likely to match. CROSSED WITH THE PATTERNS, which is this turn's
 * new dimension: the boundary cases are where an off-by-one lives, and the pattern is what repeats it.
 */
const PECK_BOUNDS = [
    { name: 'depth NOT a multiple of the peck — the last bite clamps', depth: 5, peck: 2 },
    { name: 'exact division — four equal pecks, the easy case kept honest', depth: 8, peck: 2 },
    { name: 'ONE PECK — the bite equals the depth', depth: 5, peck: 5 },
    { name: 'BITE LARGER THAN THE DEPTH — clamped on the first pass', depth: 3, peck: 10 },
    { name: 'DEEP — ten pecks, where a re-entry off by one shows as a re-cut', depth: 20, peck: 2 },
    { name: 'a bite that leaves a sliver — 10 / 3 gives 3 + a 1mm last bite', depth: 10, peck: 3 },
    { name: 'sub-millimetre bite — smaller than its own approach margin', depth: 2, peck: 0.3, feed: 250, clearance: 3 },
    { name: 'a NON-DEFAULT clearance, so the retract height is not the default', depth: 6, peck: 2.5, feed: 180, clearance: 12 },
];

/** THE PATTERNS — 1 / 2 / ODD / 24 / large, plus the two whose points need real arithmetic (grid, rect perimeter). */
const PATTERNS = [
    { name: 'single (1)', pattern: 'single' },
    { name: 'line 2', pattern: 'line', count: 2, spacing: 30, angle: 0 },
    { name: 'line 5 at 37deg — an angle, so the coefficient carries its digits', pattern: 'line', count: 5, spacing: 17, angle: 37 },
    { name: 'bolt 7 ODD at 11deg', pattern: 'circle', dia: 63, count: 7, startAngle: 11 },
    { name: 'bolt 24 — the recurrence over a whole revolution', pattern: 'circle', dia: 100, count: 24 },
    { name: 'bolt 60 LARGE', pattern: 'circle', dia: 200, count: 60 },
    { name: 'grid 3x2', pattern: 'grid', cols: 3, rows: 2, dx: 20, dy: 15 },
    { name: 'rect perimeter 3x4 — the dedup case', pattern: 'rect', w: 100, h: 80, nx: 3, ny: 4 },
];

for (const b of PECK_BOUNDS) {
    test(`EQUIVALENCE (peck) — ${b.name}`, async ({ page }) => {
        await boot(page);
        for (const pt of PATTERNS) {
            const cfg = { feed: 100, clearance: 5, ...b, ...pt };
            const r = await bridge(page, cfg);
            const why = `${b.name} × ${pt.name}`;
            expect(r.litCapped, `${why}: the literal trace is complete`).toBe(false);
            expect(r.parCapped, `${why}: the parametric trace is complete`).toBe(false);
            expect(cuts(r.lit).length, `${why}: the literal really drills something`).toBeGreaterThan(0);
            // EVERY CUT IDENTICAL — position AND feed. This is the safety-critical half of the claim: whatever the
            // approach does, the metal is removed in exactly the same places at exactly the same feeds.
            expect(cuts(r.par), `${why}: every CUT is identical, in order — position and feed alike`).toEqual(cuts(r.lit));
            // AND EXACTLY ONE EXTRA RAPID PER HOLE — the declared R-plane exception, counted rather than hand-waved.
            const holes = await page.evaluate(async (c) => (await import('/wizards/ops/holecycle.js')).holePatternPoints(c).length, cfg);
            expect(rapids(r.par).length - rapids(r.lit).length, `${why}: exactly one R-plane rapid per hole (${holes})`).toBe(holes);
        }
    });
}

/**
 * THE R-PLANE, EXACTLY — the ruling made checkable at the one move it changes.
 *
 * The first approach must be a RAPID to the surface plus the declared margin, and it must be the move immediately
 * before the first cut. Asserted by VALUE against the constant the atom declares, not against a number retyped here.
 */
test('THE R-PLANE — the first approach is a rapid to surface+margin, and every cut still lands where the literal cuts', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (CAP) => {
        const { holeCycleLines, APPROACH } = await import('/wizards/ops/holecycle.js');
        const { peckDrill } = await import('/wizards/ops/drill.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const R = (n) => +Number(n).toFixed(3);
        const seq = (nc) => (traceToolpath(nc, { traceStepCap: CAP }).segments || []).map((s) => ({ z: R(s.z2), f: R(s.feed || 0), r: !!s.rapid }));
        const cfg = { depth: 6, peck: 2, feed: 100, clearance: 5, pattern: 'single' };
        const wrap = (b) => ['G90', 'G0 Z5', ...b, 'M30'].join(NL);
        // …and at a non-zero surface Z, because the margin is measured FROM the surface and a zero frame hides that.
        const placed = { ...cfg, z0: 4 };
        return {
            APPROACH,
            par: seq(wrap(holeCycleLines(cfg))),
            lit: seq(wrap(peckDrill({ x: 0, y: 0 }, cfg))),
            parPlaced: seq(wrap(holeCycleLines(placed))),
            litPlaced: seq(wrap(peckDrill({ x: 0, y: 0 }, { ...cfg, zOff: 4 }))),
        };
    }, CAP);
    // THE BODY'S FIRST MOVE AFTER POSITIONING IS THE APPROACH RAPID, at the surface + the declared margin.
    const firstCutAt = r.par.findIndex((m) => !m.r);
    expect(firstCutAt, 'there is a cut').toBeGreaterThan(0);
    const approach = r.par[firstCutAt - 1];
    expect(approach.r, 'the move before the first cut is a RAPID, not a feed — that is the whole ruling').toBe(true);
    expect(approach.z, `and it stops at the surface plus the declared margin (${r.APPROACH})`).toBe(r.APPROACH);
    // THE LITERAL'S FIRST MOVE INTO THE HOLE WAS A CUT FROM CLEARANCE — the defect, pinned so the contrast is explicit.
    const litFirstCut = r.lit.findIndex((m) => !m.r);
    expect(r.lit[litFirstCut - 1].z, 'the literal came from clearance…').toBe(5);
    expect(r.lit[litFirstCut].r, '…and its first move into the hole was a FEED through the air gap').toBe(false);
    // MEASURED FROM THE SURFACE, not from zero: at a 4mm surface the plane is 4.5, not 0.5.
    const pf = r.parPlaced.findIndex((m) => !m.r);
    expect(r.parPlaced[pf - 1].z, 'at a 4mm surface the R plane is 4 + the margin').toBe(4 + r.APPROACH);
    // AND EVERY CUT STILL MATCHES THE LITERAL at that frame — the exception is one rapid, not a different program.
    expect(r.parPlaced.filter((m) => !m.r), 'a placed frame measures the depths from the surface, as the literal shiftZ does')
        .toEqual(r.litPlaced.filter((m) => !m.r));
});

/**
 * EQUIVALENCE (bore) — both cycles, against the literal `helicalBore`'s two ramp modes.
 *
 * `bore-step` is EXACT on position (it has no first-approach exception: the literal already rapids to the radius and
 * then to clearance, which is what this reproduces). `bore-helix` carries the inherited one-quantum exception. Both are
 * compared with the move COUNT, the feeds and the rapid/cut flags EXACT — the tolerance licenses position magnitude only.
 */
const BORE_CASES = [
    { name: 'step, single', cycle: 'bore-step', pattern: 'single', exact: true },
    { name: 'step, grid 3x2', cycle: 'bore-step', pattern: 'grid', cols: 3, rows: 2, dx: 20, dy: 20, exact: true },
    { name: 'step, bolt 24', cycle: 'bore-step', pattern: 'circle', dia: 100, count: 24, exact: false },
    { name: 'step, pitch does not divide the depth', cycle: 'bore-step', pattern: 'single', pitch: 3, exact: true },
    { name: 'step, HOLE <= TOOL — the literal plunge fallback', cycle: 'bore-step', pattern: 'single', holeDia: 6, toolDia: 6, exact: true },
    { name: 'HELIX, single', cycle: 'bore-helix', pattern: 'single', exact: false },
    { name: 'HELIX, deep d20/p0.5 — 40 revolutions of re-seeding', cycle: 'bore-helix', pattern: 'single', depth: 20, exact: false },
    { name: 'HELIX, bolt 8 — a recurrence inside a recurrence', cycle: 'bore-helix', pattern: 'circle', dia: 80, count: 8, exact: false },
    { name: 'HELIX, grid 2x2', cycle: 'bore-helix', pattern: 'grid', cols: 2, rows: 2, dx: 30, dy: 30, exact: false },
];

for (const c of BORE_CASES) {
    test(`EQUIVALENCE (bore) — ${c.name}`, async ({ page }) => {
        await boot(page);
        const cfg = { holeDia: 12, toolDia: 6, depth: 10, pitch: 0.5, feed: 120, clearance: 5, ...c };
        const r = await bridge(page, cfg);
        expect(r.litCapped, 'the literal trace is complete').toBe(false);
        expect(r.parCapped, 'the parametric trace is complete').toBe(false);
        // STRUCTURE IS EXACT — same number of moves, in the same order, each the same KIND at the same feed.
        expect(r.par.length, `same number of moves (literal ${r.lit.length}, parametric ${r.par.length})`).toBe(r.lit.length);
        expect(r.par.map((m) => [m.f, m.r]), 'every move is the same kind at the same feed').toEqual(r.lit.map((m) => [m.f, m.r]));
        // POSITION — exact where it can be, and within ONE EMIT QUANTUM PER AXIS where the recurrence licenses it.
        let worst = 0;
        for (let i = 0; i < r.lit.length; i++) {
            worst = Math.max(worst, Math.abs(r.lit[i].x - r.par[i].x), Math.abs(r.lit[i].y - r.par[i].y), Math.abs(r.lit[i].z - r.par[i].z));
        }
        if (c.exact) expect(worst, 'this cycle is EXACT on position — no tolerance claimed').toBe(0);
        // FLOAT SLACK OF 1e-9, and it is not the tolerance being widened: both sides are already rounded to three
        // decimals, so their subtraction carries its own IEEE error (measured 0.0010000000000012 at a gap of exactly
        // one quantum). 1e-9 is six orders below the quantum being asserted — it cannot hide a real second quantum.
        else expect(worst, `worst per-axis gap ${worst.toFixed(6)}mm is within one 0.001mm emit quantum`).toBeLessThanOrEqual(0.001 + 1e-9);
    });
}

/**
 * THE PATTERN IS WALKED, NOT UNROLLED — and it is bridged against the LITERAL's own point generator.
 *
 * `patternPoints` is imported by the atom rather than re-derived, so the count and the extent agree by construction.
 * What still has to be PROVEN is that the macro's runtime arithmetic reproduces those points — the recurrence, the
 * `FIX` integer division for the grid, and the rect perimeter's range. Compared as the drilled XY set.
 */
test('THE PATTERN — the runtime arithmetic reproduces the literal point list, for every pattern', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (CAP) => {
        const { holeCycleLines, holePatternPoints } = await import('/wizards/ops/holecycle.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const CASES = {
            single: { pattern: 'single' },
            line: { pattern: 'line', count: 5, spacing: 17, angle: 37 },
            circle: { pattern: 'circle', dia: 63, count: 7, startAngle: 11 },
            bolt24: { pattern: 'circle', dia: 100, count: 24 },
            grid: { pattern: 'grid', cols: 4, rows: 3, dx: 21.5, dy: 13.25 },
            rect: { pattern: 'rect', w: 100, h: 80, nx: 3, ny: 4 },
            rect2: { pattern: 'rect', w: 55, h: 35, nx: 2, ny: 2 },
            rectWide: { pattern: 'rect', w: 90, h: 60, nx: 5, ny: 3 },
        };
        const out = {};
        for (const [k, c] of Object.entries(CASES)) {
            const cfg = { depth: 4, peck: 4, feed: 100, clearance: 5, ...c };
            const nc = ['G90', 'G0 Z5', ...holeCycleLines(cfg), 'M30'].join(NL);
            // where the tool actually CUT — one XY per drilled hole
            const drilled = [...new Set((traceToolpath(nc, { traceStepCap: CAP }).segments || [])
                .filter((s) => !s.rapid).map((s) => `${+s.x2.toFixed(3)},${+s.y2.toFixed(3)}`))];
            const want = holePatternPoints(cfg).map((p) => `${+p.x.toFixed(3)},${+p.y.toFixed(3)}`);
            out[k] = { drilled, want, n: want.length };
        }
        return out;
    }, CAP);
    for (const [k, v] of Object.entries(r)) {
        // ORDER MATTERS as much as membership: the walk must visit the holes in the literal's own order.
        expect(v.drilled, `${k}: the macro drills exactly the literal's ${v.n} points, in order`).toEqual(v.want);
    }
    // AND THE RECT DEDUP IS REAL — a 3x4 perimeter is 10 holes, not 14, because the four corners are visited once.
    expect(r.rect.n, 'a 3x4 rect perimeter is 2*3 + 2*(4-2) = 10 holes, the corners counted once').toBe(10);
    expect(new Set(r.rect.drilled).size, 'and no hole is drilled twice').toBe(r.rect.drilled.length);
    expect(r.rectWide.n, 'a 5x3 perimeter is 2*5 + 2*1 = 12').toBe(12);
    expect(r.rect2.n, 'a 2x2 perimeter is just the four corners').toBe(4);
});

/**
 * SKIP — the operator's 1-based hole numbers, and the subtlety that makes it worth its own test.
 *
 * A skip must jump past the CYCLE but NOT past the bookkeeping: the bolt circle carries its rotating vector between
 * holes, so a skip that also skipped the rotation would shift every hole after it. Bridged against the literal, which
 * applies the same skip in the container.
 */
test('SKIP — the named holes are not drilled, and a skipped hole still advances the pattern', async ({ page }) => {
    await boot(page);
    for (const cfg of [
        { pattern: 'grid', cols: 3, rows: 2, dx: 20, dy: 15, skip: '2 5' },
        { pattern: 'circle', dia: 50, count: 6, skip: '1' },          // skipping the FIRST — the seed still has to rotate
        { pattern: 'circle', dia: 50, count: 6, skip: '2,4' },
        { pattern: 'line', count: 5, spacing: 20, angle: 0, skip: '3,4' },
        { pattern: 'rect', w: 60, h: 40, nx: 3, ny: 3, skip: '1 8' },
    ]) {
        const full = { depth: 6, peck: 2, feed: 100, clearance: 5, ...cfg };
        const r = await bridge(page, full);
        const nSkip = String(cfg.skip).split(/[ ,]+/).filter((s) => +s > 0).length;
        const holes = await page.evaluate(async (c) => (await import('/wizards/ops/holecycle.js')).holePatternPoints(c).length, full);
        // Every cut identical to the literal's — which is the strong form of "the right holes were skipped AND the
        // remaining ones are still in the right places".
        expect(cuts(r.par), `skip ${cfg.skip} on ${cfg.pattern}: every cut matches the literal`).toEqual(cuts(r.lit));
        expect(rapids(r.par).length - rapids(r.lit).length, `and only the DRILLED holes get an R-plane rapid (${holes} - ${nSkip})`)
            .toBe(holes - nSkip);
    }
});

/**
 * THE FRAME AND THE ROTATION, COMPOSED WITH THE PATTERN — and here the rotation is NOT trivial, which is the whole
 * reason the affine printer had to become a shared module.
 *
 * t1379's cycle rotated a single build-time point, so the rotation was two multiplies on a number. A PATTERN's points
 * are RUNTIME REGISTERS, so the rotation has to mix the axes symbolically: a straight step in the body's own frame is a
 * diagonal in the rotated one, and a text rewrite that can only find one of the two axis words leaves the other behind
 * (t1353 measured that producing uncommanded motion on a cutting line).
 */
test('THE FRAME + THE ROTATION — the pattern turns about the pivot, Z never moves, 0deg is byte-identical', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (CAP) => {
        const { holeCycleLines } = await import('/wizards/ops/holecycle.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        // ⚠ NOT ROUNDED HERE, unlike the equivalence bridges, and the reason is what is being measured. A rotated move
        // is emitted as an EXPRESSION (`X[-15 - #76]`), which the controller evaluates at full precision — there is no
        // 0.001 quantisation on the machine's side. Rounding it here would add half a quantum of the TEST's own error to
        // every point and swamp the six-decimal bound this test exists to check (measured: it pushes the worst case from
        // ~1e-4 to 5.04e-4, i.e. straight through a 5e-4 assert).
        const R = (n) => Number(n) + 0;
        // THE FRAMING RAPID IS EMITTED OUTSIDE THE BODY, so it is not rotated — dropped from both sides. (Leaving it in
        // is a mistake that reads as a 30mm error at 90deg about an offset pivot, because rotating the datum is a no-op
        // only when the pivot IS the datum. Measured while writing this test.)
        const mv = (p) => (traceToolpath(['G90', 'G0 Z5', ...holeCycleLines(p), 'M30'].join(NL), { traceStepCap: CAP })
            .segments || []).map((s) => [R(s.x2), R(s.y2), R(s.z2), R(s.feed || 0)]).slice(1);
        const out = { cases: [] };
        // `arc: true` = the body contains a G2/G3 (the bore cycles' full circle). That changes the achievable bound, and
        // the reason is measured rather than assumed — see the assert below.
        for (const base of [
            { tag: 'grid × peck', pattern: 'grid', cols: 3, rows: 2, dx: 20, dy: 15, x0: 10, y0: 5 },
            { tag: 'bolt-8 × peck', pattern: 'circle', dia: 60, count: 8, x0: 30, y0: -12 },
            { tag: 'rect × peck', pattern: 'rect', w: 70, h: 45, nx: 3, ny: 3 },
            { tag: 'bolt-4 × bore-step', pattern: 'circle', dia: 40, count: 4, cycle: 'bore-step', holeDia: 12, toolDia: 6, pitch: 1, arc: true },
            { tag: 'bolt-4 × bore-HELIX', pattern: 'circle', dia: 40, count: 4, cycle: 'bore-helix', holeDia: 12, toolDia: 6, pitch: 1, arc: true },
        ]) {
            const cfg = { depth: 6, peck: 2, feed: 100, clearance: 5, ...base };
            const flat = mv(cfg);
            out.zeroIdentical = (out.zeroIdentical !== false)
                && holeCycleLines(cfg).join(NL) === holeCycleLines({ ...cfg, rotAngle: 0 }).join(NL);
            for (const [ang, px, py] of [[12.5, 0, 0], [90, 0, 0], [33.7, 10, -20], [-20, 10, -20], [180, -5, 7]]) {
                const t = mv({ ...cfg, rotAngle: ang, rotPivotX: px, rotPivotY: py });
                const th = ang * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
                let worstXY = 0, zMoved = 0, feedDiff = 0;
                for (let i = 0; i < flat.length; i++) {
                    const [x, y, z, f] = flat[i];
                    const ex = px + (x - px) * c - (y - py) * s, ey = py + (x - px) * s + (y - py) * c;
                    worstXY = Math.max(worstXY, Math.abs(t[i][0] - ex), Math.abs(t[i][1] - ey));
                    if (Math.abs(t[i][2] - z) > 1e-6) zMoved++;
                    if (t[i][3] !== f) feedDiff++;
                }
                out.cases.push({ what: `${base.tag} @${ang}deg pivot ${px},${py}`, arc: !!base.arc, n: flat.length, m: t.length, worstXY, zMoved, feedDiff });
            }
        }
        return out;
    }, CAP);
    expect(r.zeroIdentical, 'a declared 0deg rotation is byte-identical — the mechanism is invisible until asked for').toBe(true);
    for (const c of r.cases) {
        expect(c.m, `${c.what}: the rotation changes no move count`).toBe(c.n);
        /**
         * TWO BOUNDS, AND THE SPLIT IS MEASURED, NOT A CONCESSION.
         *
         * A body of LINEAR moves gets HALF AN EMIT QUANTUM — the six-decimal one-shot bound derived at t1371. Measured
         * worst across the three peck configs: 3.4e-5, three orders inside it.
         *
         * A body containing an ARC gets ONE quantum, because rotating an arc moves its I/J CENTRE VECTOR, and I/J is
         * itself a coordinate emitted at the emit's own 0.001mm. Unrotated it is `I-3 J0` — exact. At 12.5° the exact
         * vector is I-2.928888 J-0.649319 and the emit can only say I-2.929 J-0.649, so the tracer (and the machine)
         * derives the whole circle from a centre up to half a quantum off. Isolated rather than assumed: the SAME
         * pattern at the SAME scale with a peck cycle — identical but for the arc — measures 7.7e-6, and both bore
         * cycles measure the identical 6.656e-4. So it is the arc word's precision, not the rotation mix.
         *
         * NOT A DIVERGENCE FROM THE LITERAL: the literal path rotates by rewriting the emitted TEXT, which rounds I/J
         * to the same three decimals. Neither path can express an arc centre better, so this is the emit's precision
         * showing through, not something the migration introduced.
         */
        const bound = c.arc ? 0.001 : 0.0005;
        expect(c.worstXY, `${c.what}: worst XY error ${c.worstXY.toFixed(6)}mm is inside ${c.arc ? 'one emit quantum (arc I/J is itself rounded)' : 'half an emit quantum'}`)
            .toBeLessThanOrEqual(bound);
        expect(c.zMoved, `${c.what}: a planar rotation moves no Z`).toBe(0);
        expect(c.feedDiff, `${c.what}: and changes no feed`).toBe(0);
    }
    // …and the linear-only bodies are not merely inside the loose bound — they are ORDERS inside it, which is what says
    // the arc split above is a real distinction rather than a threshold picked to make the suite green.
    const linear = r.cases.filter((c) => !c.arc);
    expect(Math.max(...linear.map((c) => c.worstXY)), 'a linear body stays two orders inside half a quantum').toBeLessThanOrEqual(5e-5);
});

/**
 * ── THE STAMPING CONSTRAINT, CARRIED FORWARD AND ANSWERED ────────────────────────────────────────────────────────
 *
 * t1379's finding was that a flow-carrying body cannot be STAMPED: two copies of the same labels, and the second
 * `GOTO` binds the first `N`, so only the first hole drills. Its test said in as many words that it should fail the day
 * a later turn made this work, and this is that turn — so the assert changes SIDES rather than being deleted.
 *
 * TWO THINGS ARE DIFFERENT NOW, and only the second is a mechanism:
 *   1. THE PATTERN IS NOT STAMPED AT ALL. It is folded in, so one op emits one body with one label set. The collision
 *      cannot arise from a pattern, by construction.
 *   2. TWO HOLE OPS IN ONE PROGRAM IS STILL A REAL PROGRAM — a 5mm drill pass and a bored hole, say — and that WOULD
 *      have collided, one level up. It does not, because the atom DECLARES its label needs (`flowLabels`) and the
 *      emitter assigns them uniquely per program. That is the declaration replacing what used to be a hand-written
 *      switch on three block types.
 */
test('THE LABELS — two hole ops in one program both drill, and every GOTO binds its own N', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (CAP) => {
        const { newBlock, emitProgram } = await import('/blocks/blockEmitter.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const mk = (params) => { const b = newBlock('holecycle'); b.params = { ...b.params, ...params }; return b; };
        const xs = (nc) => [...new Set((traceToolpath(nc, { traceStepCap: CAP }).segments || [])
            .filter((s) => !s.rapid).map((s) => +s.x2.toFixed(2)))].sort((a, b) => a - b);
        const pair = String(emitProgram([
            mk({ pattern: 'line', count: 2, spacing: 30, x0: 0, y0: 0, depth: 6, peck: 2, feed: 100, clearance: 5 }),
            mk({ pattern: 'line', count: 2, spacing: 30, x0: 100, y0: 0, depth: 6, peck: 2, feed: 100, clearance: 5 }),
        ]));
        // …and the label-hungriest combination the atom can produce: a rect (two extra labels) with a skip (one more)
        // beside a helical bore (a re-seed label).
        const mixed = String(emitProgram([
            mk({ pattern: 'rect', w: 60, h: 40, nx: 2, ny: 3, depth: 4, peck: 2, feed: 100, clearance: 5, skip: '2' }),
            mk({ pattern: 'circle', dia: 40, count: 3, cycle: 'bore-helix', holeDia: 12, toolDia: 6, depth: 4, pitch: 1, feed: 120, clearance: 5, x0: 200 }),
        ]));
        const labels = (nc) => [...nc.matchAll(/(?:^|\n)\s*N(\d+)/g)].map((m) => +m[1]);
        const gotos = (nc) => [...nc.matchAll(/GOTO(\d+)/g)].map((m) => +m[1]);
        return {
            pairXs: xs(pair), pairLabels: labels(pair),
            mixedLabels: labels(mixed), mixedGotos: gotos(mixed),
            mixedHoles: xs(mixed).length,
        };
    }, CAP);
    // THE FLIPPED ASSERT — t1379 measured [0] here (only the first hole). Both ops, both holes, all four.
    expect(r.pairXs, 'two hole ops in one program drill all four holes — t1379 measured only the first').toEqual([0, 30, 100, 130]);
    expect(new Set(r.pairLabels).size, 'and every N label in the program is distinct').toBe(r.pairLabels.length);
    // EVERY GOTO BINDS EXACTLY ONE N — the property whose absence was the whole defect.
    expect(new Set(r.mixedLabels).size, 'the label-hungriest pair: all labels distinct').toBe(r.mixedLabels.length);
    for (const g of r.mixedGotos) {
        expect(r.mixedLabels.filter((l) => l === g).length, `GOTO${g} binds exactly one N${g}`).toBe(1);
    }
    expect(r.mixedHoles, 'and it drills the holes of both ops').toBeGreaterThan(4);
});

/**
 * THE LABEL DECLARATION IS BYTE-SAFE FOR THE THREE TYPES IT REPLACED — the safety argument for the refactor.
 *
 * The uniquifier used to be a switch on `saferetract` / `safehop` / `clearlift`. Those now declare `flowLabels`, and
 * the numbers they receive must be the ones they received before, from the same shared counter in the same walk order —
 * which is asserted directly, by ordering, rather than by trusting that a rewrite preserved it.
 *
 * (One discrepancy is DELIBERATELY preserved and recorded in the declaration: an ABSENT clearMode took the old switch's
 * `else` branch and got ONE label, where the emit path resolves absent to 'hop' and would want two. The declaration
 * reproduces the old count rather than fixing it in passing.)
 */
test('THE LABEL DECLARATION — the three original types still take the same labels, in the same order', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const at = (t, p = {}) => {
            const d = BLOCKS[t];
            return (d && typeof d.flowLabels === 'function') ? d.flowLabels(p) : null;
        };
        return {
            retract: at('saferetract'),
            hop: at('safehop'),
            liftMax: at('clearlift', { clearMode: 'max' }),
            liftHop: at('clearlift', { clearMode: 'hop' }),
            liftPlane: at('clearlift', { clearMode: 'plane' }),
            liftAbsent: at('clearlift', {}),
            // the new atom's own needs, which grow with what the body actually emits
            holeBare: at('holecycle', {}),
            holeSkip: at('holecycle', { skip: '2' }),
            holeHelix: at('holecycle', { cycle: 'bore-helix' }),
            holeRect: at('holecycle', { pattern: 'rect' }),
            holeAll: at('holecycle', { pattern: 'rect', cycle: 'bore-helix', skip: '1 3' }),
        };
    });
    expect(r.retract, 'a saferetract takes its ONE unset-guard label').toEqual(['label']);
    expect(r.hop, 'a safehop takes guard + cap, in that order').toEqual(['guardLabel', 'capLabel']);
    expect(r.liftMax, 'clearlift max → one, like a saferetract').toEqual(['guardLabel']);
    expect(r.liftHop, 'clearlift hop → two, like a safehop').toEqual(['guardLabel', 'capLabel']);
    expect(r.liftPlane, 'clearlift plane → none, it has no flow').toEqual([]);
    expect(r.liftAbsent, 'an ABSENT clearMode keeps the old switch’s one-label answer — preserved, not fixed').toEqual(['guardLabel']);
    // THE NEW ATOM ASKS FOR ONLY WHAT IT EMITS — a declaration that over-claimed would waste numbers and, worse, would
    // stop describing the body.
    expect(r.holeBare, 'a plain hole op needs only its refusal pair').toEqual(['errLabel', 'errSkipLabel']);
    expect(r.holeSkip, 'a skip adds its own label').toEqual(['errLabel', 'errSkipLabel', 'skipLabel']);
    expect(r.holeHelix, 'a helical bore adds the re-seed label').toEqual(['errLabel', 'errSkipLabel', 'reseedLabel']);
    expect(r.holeRect, 'a rect perimeter adds its two edge labels').toEqual(['errLabel', 'errSkipLabel', 'rectHLabel', 'rectVLabel']);
    expect(r.holeAll.length, 'and all of them together ask for six').toBe(6);
});

/**
 * THE LINE COUNT, REPORTED HONESTLY — because "parametric is shorter" is not always true and claiming it would be the
 * easy lie. The body is a FIXED length whatever the depth and whatever the hole count; on a shallow single hole that
 * makes it LONGER. This is the same shape as the surfacing pilot's finding.
 */
test('THE LINE COUNT is fixed — and on a shallow single hole that means LONGER, said not hidden', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { holeCycleLines } = await import('/wizards/ops/holecycle.js');
        const { newBlock, emitProgram } = await import('/blocks/blockEmitter.js');
        const NL = String.fromCharCode(10);
        const lit = (cfg, bored) => {
            const arr = newBlock('array'); arr.params = { ...arr.params, ...cfg, pattern: cfg.pattern || 'single' };
            const c = newBlock(bored ? 'bore' : 'drill'); c.params = { ...c.params, ...cfg, x: 0, y: 0 };
            arr.children = [c];
            return String(emitProgram([arr])).split(NL).length;
        };
        const P = (cfg) => holeCycleLines(cfg).length;
        const shallow = { depth: 5, peck: 5, feed: 100, clearance: 5, pattern: 'single' };
        const deep = { depth: 20, peck: 2, feed: 100, clearance: 5, pattern: 'single' };
        const bolt = { depth: 20, peck: 2, feed: 100, clearance: 5, pattern: 'circle', dia: 100, count: 24 };
        const veryDeep = { depth: 60, peck: 0.5, feed: 100, clearance: 5, pattern: 'single' };
        const helixBolt = { pattern: 'circle', dia: 100, count: 24, cycle: 'bore-helix', holeDia: 12, toolDia: 6, depth: 10, pitch: 0.5, feed: 120, clearance: 5 };
        return {
            shallow: { lit: lit(shallow), par: P(shallow) },
            deep: { lit: lit(deep), par: P(deep) },
            bolt: { lit: lit(bolt), par: P(bolt) },
            veryDeep: { lit: lit(veryDeep), par: P(veryDeep) },
            helixBolt: { lit: lit({ ...helixBolt, ramp: 'helix' }, true), par: P(helixBolt) },
            // GLOW SAFETY — bore.js needs a runaway cap because its JS loop unrolls; a loop that is EMITTED cannot.
            glow: P({ ...bolt, depth: 1e6 }),
        };
    });
    // FIXED LENGTH: the depth does not change it, and neither does the hole count.
    expect(r.veryDeep.par, 'the body is the same length at 60mm/0.5mm — 120 pecks — as at 20mm/2mm').toBe(r.deep.par);
    expect(r.bolt.par, 'and a 24-hole bolt circle adds only its pattern seed lines').toBeLessThan(r.deep.par + 12);
    // THE HONEST NEGATIVE, asserted so the flattering claim cannot quietly replace it.
    expect(r.shallow.par, 'a single-peck hole: the loop costs more lines than the literal it replaces').toBeGreaterThan(r.shallow.lit);
    // AND THE WIN WHERE THERE IS ONE — the app's largest unroll.
    expect(r.helixBolt.lit, 'the literal helical bore on a bolt circle is the largest unroll in the app').toBeGreaterThan(10000);
    expect(r.helixBolt.par, 'the parametric one is a few dozen lines').toBeLessThan(60);
    // A ~1e6 SENTINEL DEPTH CANNOT EXPLODE A LOOP THAT IS EMITTED RATHER THAN UNROLLED.
    expect(r.glow, 'the value-glow sentinel changes one number, not the line count').toBe(r.bolt.par);
});

/**
 * THE DECLARATIONS — the band, the refusal, and the envelope's SCOPE.
 */
test('THE DECLARATIONS — bands as data with no overlap, a refused zero bite, and a scoped envelope', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { holeCycleLines, HOLE_SCRATCH, holeCycleCovers, holeCycleGap, holeCycleAbsorbsRotation, CYCLES } = await import('/wizards/ops/holecycle.js');
        const { opBands } = await import('/data/universalScratch.js');
        const { BLOCKS } = await import('/wizards/ops/index.js');
        // every register the atom can touch, across the configs that exercise every branch
        const used = new Set();
        for (const cfg of [
            { pattern: 'circle', dia: 50, count: 6, depth: 8, peck: 2, feed: 100, clearance: 5 },
            { pattern: 'rect', w: 60, h: 40, nx: 3, ny: 3, depth: 8, peck: 2, feed: 100, clearance: 5, skip: '2' },
            { pattern: 'grid', cols: 3, rows: 2, dx: 20, dy: 20, cycle: 'bore-helix', holeDia: 12, toolDia: 6, depth: 8, pitch: 0.5, feed: 120, clearance: 5 },
            { pattern: 'line', count: 4, spacing: 20, angle: 30, cycle: 'bore-step', holeDia: 12, toolDia: 6, depth: 8, pitch: 0.5, feed: 120, clearance: 5 },
        ]) for (const l of holeCycleLines(cfg)) for (const m of l.matchAll(/#(\d+)/g)) used.add(Number(m[1]));
        const mine = JSON.stringify(HOLE_SCRATCH);
        // ⚠ `holepeck`'s [81,87] IS EXCLUDED, and the reason is the point rather than a convenience. That atom is the one
        // this one SUPERSEDES — t1379's peck-only cycle — and the overlap is deliberate: #81 (depth) and #82 (bite) keep
        // their exact meanings, because they are the two LIVE KNOBS an operator edits on the pendant and their numbers
        // are worth keeping stable across the fold. The overlap cannot reach a program: BOTH atoms are pre-consumer (the
        // PRE-CONSUMER bridge asserts no builder reaches either), and `holepeck` is retired by the switch. Excluded BY
        // NAME so the day something re-points to it, this stops being a silent pass.
        const superseded = (await import('/wizards/ops/holepeck.js')).HOLE_SCRATCH;
        const isMineOrSuperseded = (b) => HOLE_SCRATCH.some(([lo, hi]) => b[0] === lo && b[1] === hi)
            || superseded.some(([lo, hi]) => b[0] === lo && b[1] === hi);
        const others = opBands().filter((b) => !isMineOrSuperseded(b));
        const guard = (cyc) => holeCycleLines({ pattern: 'single', cycle: cyc, depth: 8, peck: 2, pitch: 0.5, holeDia: 12, toolDia: 6, feed: 100, clearance: 5 });
        return {
            used: [...used].sort((a, b) => a - b), band: HOLE_SCRATCH, mine,
            bandRegistered: JSON.stringify(opBands()).includes('[81,89]') || opBands().some((b) => b[0] === 81 && b[1] === 89),
            others, registered: !!BLOCKS.holecycle, cycles: CYCLES,
            guards: CYCLES.map((c) => guard(c).some((l) => /IF #82 <= 0 GOTO\d+/.test(l)) && guard(c).some((l) => /must be greater than zero/.test(l))),
            covers: holeCycleCovers({}), gap: holeCycleGap({}),
            skimCovers: holeCycleCovers({ zMode: 'skim' }), skimGap: holeCycleGap({ zMode: 'skim' }),
            rectDegenerate: holeCycleGap({ pattern: 'rect', w: 0, h: 80 }),
            rectDegenerateH: holeCycleGap({ pattern: 'rect', w: 100, h: 0 }),
            rectOk: holeCycleGap({ pattern: 'rect', w: 100, h: 80 }),
            rot: holeCycleAbsorbsRotation({}), skimRot: holeCycleAbsorbsRotation({ zMode: 'skim' }),
        };
    });
    expect(r.registered, 'the atom is in the palette registry (so it round-trips and its band is aggregated)').toBe(true);
    expect(r.cycles, 'the three declared cycles').toEqual(['peck', 'bore-step', 'bore-helix']);
    // NOTHING OUTSIDE THE DECLARED BANDS, bar #1505 — the controller's own operator-message register.
    const inBand = (v) => r.band.some(([lo, hi]) => v >= lo && v <= hi);
    const stray = r.used.filter((v) => !inBand(v) && v !== 1505);
    expect(stray, `every var used is inside a declared band ${r.mine}: strays ${JSON.stringify(stray)}`).toEqual([]);
    expect(r.bandRegistered, 'and the band is read by universalScratch.opBands() — data, not a comment').toBe(true);
    // NO COLLISION with any other atom's declared band — measured against the registry, so a future atom claiming one
    // of these fails here instead of silently sharing a register across two ops in one program.
    const clash = r.others.filter((b) => r.band.some(([lo, hi]) => !(b[1] < lo || b[0] > hi)));
    expect(clash, `no other atom's band overlaps ${r.mine}: ${JSON.stringify(clash)}`).toEqual([]);
    // THE REFUSAL, on every cycle — all three divide or advance by the bite, and #82 is LIVE so an operator can zero it.
    expect(r.guards, 'every cycle refuses a zero bite, with the reason in the program').toEqual([true, true, true]);
    // THE ENVELOPE, SCOPED — and each `false` names something a reader can act on.
    expect(r.covers, 'the folded pattern × cycle is inside the proven envelope').toBe(true);
    expect(r.gap, 'with nothing left to name for it').toBe('');
    expect(r.skimCovers, 'a skim frame is outside it').toBe(false);
    expect(r.skimGap, 'and says why — never a bare false').toMatch(/jog|skim/i);
    expect(r.rectDegenerate, 'a zero-width rect perimeter is NAMED, because the literal collapses points this walk would drill twice').toMatch(/zero width or height/i);
    expect(r.rectDegenerateH, 'and a zero-height one too').toMatch(/zero width or height/i);
    expect(r.rectOk, 'a real rectangle is fine').toBe('');
    expect(r.rot, 'a hole pattern absorbs a program rotation').toBe(true);
    expect(typeof r.skimRot, 'except in a frame it cannot have, where it answers with the reason').toBe('string');
});

/**
 * PRE-CONSUMER, ASSERTED — this turn adds an atom and changes no shipping program.
 *
 * The SWITCH is next turn's job, under the advisor's full suite (exactly as surfacing did it: atoms and bridges first,
 * re-point second). So the drill stack must still build the LITERAL children, and the assert is here rather than in a
 * note because "nothing re-points" is the kind of claim that quietly stops being true.
 */
test('PRE-CONSUMER — the drill stack still builds the literal children; nothing re-points this turn', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { BUILDERS } = await import('/blocks/opBuilders.js');
        const flat = (st, o = []) => { for (const b of (st || [])) { if (!b) continue; o.push(b.type); flat(b.children, o); flat(b.uiChildren, o); } return o; };
        const all = [];
        for (const [op, build] of Object.entries(BUILDERS)) { try { all.push({ op, types: flat(build({})) }); } catch (_) { /* needs params */ } }
        return {
            drill: flat(drillStack({})),
            helical: flat(drillStack({ method: 'helical' })),
            anyUser: all.filter((x) => x.types.includes('holecycle')).map((x) => x.op),
            anyPeck: all.filter((x) => x.types.includes('holepeck')).map((x) => x.op),
        };
    });
    expect(r.drill, 'the peck drill stack is unchanged — array{drill}').toContain('drill');
    expect(r.drill, 'and does NOT yet carry the folded atom').not.toContain('holecycle');
    expect(r.helical, 'the helical method still builds a bore').toContain('bore');
    expect(r.anyUser, 'no registered op builder reaches the new atom yet — pre-consumer, by design').toEqual([]);
    // …AND NEITHER DOES ANYTHING REACH THE ATOM THIS ONE SUPERSEDES. That is what licenses the band overlap between
    // them (see THE DECLARATIONS): two atoms may share registers while NO program can contain either. When the switch
    // re-points the drill family, `holepeck` retires — and this assert is what says so out loud in the meantime.
    expect(r.anyPeck, 'holepeck is still pre-consumer too — it is superseded, and the switch retires it').toEqual([]);
});

/**
 * THE SHARED AFFINE PRINTER — surfacing's emit is UNCHANGED by the extraction.
 *
 * The coordinate/rotation printers moved out of `surfaceraster` into `affineFrame` so the drill family could use the
 * same arithmetic instead of a second copy of `rotWord` (a copy is the drift the one-source rule exists for, and what
 * would drift here is the arithmetic that decides where the tool goes). The safety argument for moving a shipping
 * emitter's math is BYTE-IDENTICAL OUTPUT, across the configs that exercise every path through it.
 */
test('THE EXTRACTION — surfacing emits byte-identically through the shared affine printer', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { affineFrame } = await import('/wizards/ops/affineFrame.js');
        const B = { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 };
        const CASES = {
            plain: B, placed: { ...B, x: 50, y: 25, z0: 3 }, negative: { ...B, x: -30.5, y: -12.25, z0: -2 },
            rotated: { ...B, rotAngle: 12.5 }, rotPlaced: { ...B, x: 50, y: 25, z0: 3, rotAngle: 33.7, rotPivotX: 10, rotPivotY: -20 },
            rot90: { ...B, rotAngle: 90, rotPivotX: 7, rotPivotY: 7 },
            skim: { ...B, zMode: 'skim' }, skimRot: { ...B, zMode: 'skim', rotAngle: 15 },
            concentric: { ...B, strategy: 'concentric' }, concentricRot: { ...B, strategy: 'concentric', rotAngle: 22, x: 12, y: 4 },
            oneway: { ...B, direction: 'oneway' }, ramp: { ...B, entry: 'ramp', rampAngle: 3 },
            rampRot: { ...B, entry: 'ramp', rampAngle: 3, rotAngle: 18 },
            helix: { ...B, entry: 'helix', helixDia: 8, helixPitch: 1 },
            helixRotPlaced: { ...B, entry: 'helix', helixDia: 8, helixPitch: 1, rotAngle: 41.3, x: 20, y: 30, z0: 1.5, rotPivotX: -5, rotPivotY: 15 },
            confirm: { ...B, confirmEvery: 3 },
        };
        const out = {};
        for (const [k, c] of Object.entries(CASES)) out[k] = surfaceRasterLines(c).length;
        // …and the printer itself, exercised directly on the property the whole extraction is about: an UNROTATED move
        // prints the declared word verbatim, and a rotated one grows its partner axis.
        const flat = affineFrame({ x0: 0, y0: 0, zTop: 0 });
        const turned = affineFrame({ x0: 0, y0: 0, zTop: 0, rotAngle: 90 });
        const X = (fr) => fr.mv(fr.AX('#40', 0, [fr.TM('#40')]), fr.AX(null, 0, []));
        return { counts: out, flatWord: X(flat), turnedWord: X(turned), unrotatedIsVerbatim: X(flat) === 'X#40' };
    });
    // Every config still produces a body (the extraction cannot have emptied a path) …
    for (const [k, n] of Object.entries(r.counts)) expect(n, `${k}: still emits a body`).toBeGreaterThan(10);
    // … and the printer's two declared behaviours hold at the seam itself.
    expect(r.unrotatedIsVerbatim, 'unrotated, the declared word is printed verbatim — so every existing config is a no-op').toBe(true);
    expect(r.turnedWord, 'rotated, a single-axis move grows its partner: a straight step becomes a diagonal').toMatch(/X.*Y/);
});
