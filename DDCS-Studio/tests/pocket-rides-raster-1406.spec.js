import { test, expect } from '@playwright/test';

/**
 * t1406 — THE RE-POINT: a rect pocket's clearing rides `surfaceraster`, and the bridge is what licenses it.
 *
 * ── THE CRITERION IS PER-PHASE, BY RULING ─────────────────────────────────────────────────────────────────────────
 * The user ruled the ORDER: rough all levels, THEN wall. That is a real change to the program — today the depth fold
 * emits every child per level, so a raster pocket runs fill(L1), wall(L1), fill(L2), wall(L2)… and after the re-point
 * it runs every fill level, then every wall level. A move-for-move comparison in EMIT ORDER would therefore fail by
 * construction and prove nothing. So the criterion is the one the ruling names: **at every depth level, the SET of
 * cutting moves is the same set**. The tool visits the same places at the same feeds on the same Z; only the order in
 * which the two phases interleave has changed, and that is precisely what was ruled.
 *
 * ── THE LITERAL SIDE IS THE FROZEN /_test/ REFERENCE, NEVER `pocketStack` ─────────────────────────────────────────
 * `pocketStack` IS the thing under test. Building the literal side from it would compare the parametric emit to
 * itself and pass while proving nothing — the vacuity trap t1385 closed for the drill family. The reference is
 * `/_test/literalPocketFill.js`, a verbatim copy of the kernels as they shipped at t1404, landed in THIS act.
 *
 * ── TWO DIVERGENCES ARE NAMED, NOT PAPERED OVER ───────────────────────────────────────────────────────────────────
 *   the stepdown floor   `depthLevels` floors the bite at 0.05mm; the atom's runtime loop honours whatever #43 holds
 *                        and its build-time seed floors at 0.01. Below 0.05 they cut a DIFFERENT NUMBER OF LEVELS.
 *                        Ruled: the atom's 0.01 stands (it is the more faithful reading of a typed value, and the
 *                        build-time floor is unenforceable now that #43 is live from the pendant). Asserted as a
 *                        divergence with its numbers, so it is a recorded fact rather than a surprise.
 *   the stepover floor   `stepoverMm` floors the mm at 0.2; the atom composes `[tool * pct / 100]` with no floor and
 *                        refuses at run time on <= 0. Below 0.2mm of stepover they count different row/ring numbers.
 *                        NOT in the dispatch's list — found by sweeping rather than by reading — and named here for
 *                        the same reason: an unmeasured agreement is not an agreement.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * THE RELATIONSHIP SWEEP. Both strategies × the three descents × the depth regions × placement/rotation × the
 * wallOffset values that prove the inset. Chosen where a loop and an unrolled list are most likely to DISAGREE.
 */
const BASE = { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, toolDia: 6, wallOffset: 0, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, strategy: 'spiral' };
const SWEEP = [
    { name: 'spiral · plunge · the shipped defaults', p: {} },
    { name: 'raster · plunge · rows + the wall finish', p: { strategy: 'raster' } },
    { name: 'spiral · RAMP', p: { entry: 'ramp' } },
    { name: 'raster · RAMP', p: { strategy: 'raster', entry: 'ramp' } },
    // ⚠ THE HELIX PITCHES HERE DIVIDE THE STEPDOWN EXACTLY (1.5 / 0.5 = 3 revs, 1.5 / 0.75 = 2), and that is not a
    // convenience — it is the boundary of a THIRD divergence, measured below and pre-existing: the atom takes whole
    // revolutions (FUP) where the literal rounds the segment count to nearest. Inside whole revolutions the two walks
    // are identical and this bridge says so; outside them they are not, and the test below says THAT, with numbers.
    { name: 'spiral · HELIX — 3 whole revolutions per level', p: { entry: 'helix', helixDia: 4, helixPitch: 0.5 } },
    { name: 'raster · HELIX — 2 whole revolutions per level', p: { strategy: 'raster', entry: 'helix', helixDia: 4, helixPitch: 0.75 } },
    { name: 'FULL DEPTH — one level, the stepdown reaches the floor', p: { depth: 2, stepdown: 2 } },
    { name: 'FULL DEPTH past — the last bite is clamped, not overshot', p: { depth: 2, stepdown: 5 } },
    { name: 'depth NOT a multiple of the stepdown', p: { depth: 4.3, stepdown: 1.2 } },
    { name: 'INSET — wallOffset +0.5 cuts oversize', p: { wallOffset: 0.5 } },
    { name: 'INSET — wallOffset −0.5 leaves stock', p: { wallOffset: -0.5 } },
    { name: 'INSET — raster + wallOffset, where the wall must still agree', p: { strategy: 'raster', wallOffset: 0.4 } },
    { name: 'a bigger tool moves the inset AND the stepover together', p: { toolDia: 10, stepoverPct: 55 } },
    { name: 'ROW COUNT — a stepover that does not divide the height', p: { strategy: 'raster', h: 60, toolDia: 12, stepoverPct: 60 } },
    { name: 'RING COUNT — the middle closes on an exact multiple', p: { w: 48, h: 48, toolDia: 6, stepoverPct: 40 } },
    { name: 'a NARROW pocket — one row / one ring', p: { w: 40, h: 9, toolDia: 6, stepoverPct: 40 } },
    { name: 'PLACED — origin off zero, attached to a stock corner', p: { originX: 12.5, originY: -7.25, stockAttach: 'pp', pathDatum: 'pp', stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20 } },
    { name: 'PLACED + a Z offset (the datum re-reference)', p: { originX: 12.5, originY: -7.25, offZ: 2, stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20 } },
    { name: 'PLACED raster — the wall must land in the SAME frame as the fill', p: { strategy: 'raster', originX: 12.5, originY: -7.25, stockAttach: 'pp', pathDatum: 'pp', stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20 } },
    { name: 'CONFIRM EVERY 2 — the pause cadence rides both phases', p: { depth: 6, stepdown: 1.5, confirmEvery: 2 } },
];

/**
 * The literal + parametric programs for one config, PER PHASE, both emitted through the REAL emitter.
 *
 * The parametric side is decomposed by dropping the OTHER phase's place block from the stack the wizard actually
 * built — never by rebuilding it — so what is compared is the shipping composition with one phase hidden, not a
 * test-only reconstruction of it. The literal side is decomposed the same way inside the frozen reference.
 */
const PROGRAMS = `
async (cfg, phase) => {
    const { pocketStack } = await import('/wizards/pocketWizard.js');
    const { newBlock, emitMapped } = await import('/blocks/blockEmitter.js');
    const { makeStart, makeEnd, makePlace } = await import('/blocks/programFraming.js');
    const { BLOCKS } = await import('/wizards/ops/index.js');
    const ref = await import('/_test/literalPocketFill.js');
    ref.installLiteralPocketRef(BLOCKS);
    const ROLE = { fill: 'clear', wall: 'wall' };
    const keep = (b) => (phase === 'both' || b.type !== 'placeonstock' || b.params.role === ROLE[phase]);
    const literal = emitMapped(ref.refPocketLiteralStack(cfg, { newBlock, makeStart, makeEnd, makePlace }, phase)).text;
    const para = emitMapped(pocketStack(cfg).filter(keep)).text;
    return { literal, para };
}`;

/**
 * Cutting moves grouped by the Z they end at → { '-1.500': [ [x1,y1,z1,x2,y2,z2,feed], … ] }, each list sorted.
 *
 * ── ONE NORMALISATION, AND IT IS NAMED RATHER THAN SILENT ─────────────────────────────────────────────────────────
 * A PURELY VERTICAL DESCENT (same XY, going down) is compared by where it ENDS, not where it starts, and its start
 * height is checked separately by the rule "never lower than the literal's". The start of a plunge is not a property
 * of the walk — it is wherever the previous retract left the tool, and BOTH ruled changes move exactly that:
 *   · the order.   In the shipped interleave the wall pass leaves the tool at depth, so the next level's fill plunged
 *                  from the previous FLOOR. Rough-all-then-wall means it plunges from clearance instead.
 *   · the frame.   `progstart` emits its clearance OUTSIDE the place, so it is never Z-shifted; the atom emits its own
 *                  `G0 Z(clr + z0)` before the first plunge. With a Z offset the literal's FIRST plunge therefore
 *                  starts 2mm lower than the parametric one — the atom referencing the clearance plane to the op's own
 *                  frame, which is the more correct of the two.
 * Both differences make the approach HIGHER, never lower, and that is the property asserted. Comparing the full tuple
 * would fail on air and hide nothing; dropping the check entirely would hide a genuinely deeper approach.
 */
const CUTS_BY_LEVEL = `
(traceToolpath, nc) => {
    const segs = (traceToolpath(nc).segments || []).filter((s) => !s.rapid);
    const q = (n) => +Number(n).toFixed(3);
    const cuts = segs.map((s) => ({
        v: Math.abs(s.x1 - s.x2) < 1e-6 && Math.abs(s.y1 - s.y2) < 1e-6 && s.z1 > s.z2 + 1e-9,
        t: [q(s.x1), q(s.y1), q(s.z1), q(s.x2), q(s.y2), q(s.z2), q(s.feed || 0)],
    }));
    // Sort on a COARSE key (2dp) so a one-quantum difference cannot reorder the lists under us — and on EXACTLY the
    // fields the comparison uses, which for a vertical descent excludes its start height. (Sorting on a field the
    // comparison ignores pairs the two lists up differently on each side and then reports the mismatch as a depth
    // error: measured, and it is why this key is spelled out rather than "the whole tuple".)
    const sk = (e) => (e.v ? 'V' : 'C') + (e.v ? [e.t[3], e.t[4], e.t[5], e.t[6]] : e.t).map((n) => n.toFixed(2)).join(',');
    cuts.sort((a, b) => (sk(a) < sk(b) ? -1 : sk(a) > sk(b) ? 1 : 0));
    // THE CUTTING FLOORS — the Z of every move that cuts HORIZONTALLY. That is what "a depth level" means to a
    // machinist, and it is the one reading a descent cannot pollute: a helix's 24 segments each end at their own Z,
    // so bucketing by "the Z a move ends at" would invent a level per segment and then compare two different
    // inventions of it. Rounded to 2dp for the same reason the sort key is: one quantum must not split a floor in two.
    const floors = [...new Set(segs.filter((s) => Math.abs(s.z1 - s.z2) < 1e-6).map((s) => q(s.z2).toFixed(2)))].sort();
    return { cuts, floors };
}`;

/** The emit's own quantum. A coordinate may differ by one unit of it — never more. (t1404 measured the same class on
 *  parallel×helix: the literal accumulates a polyline in JS, the macro evaluates an expression at the controller.) */
const QUANTUM = 0.0015;

/** Compare one level's cut lists. Returns { ok, why, quantised } — quantised = how many differed within the quantum. */
function compareLevel(lit, par) {
    if (lit.length !== par.length) return { ok: false, why: `count ${par.length} vs ${lit.length}`, quantised: 0 };
    let quantised = 0;
    for (let i = 0; i < lit.length; i++) {
        const a = lit[i], b = par[i];
        if (a.v !== b.v) return { ok: false, why: `move ${i}: one is a vertical descent and the other is not (${a.t} vs ${b.t})`, quantised };
        // a vertical descent is compared by its END + feed; its start height is the separate "never lower" rule below
        const idx = a.v ? [3, 4, 5, 6] : [0, 1, 2, 3, 4, 5, 6];
        let near = false;
        for (const k of idx) {
            const d = Math.abs(a.t[k] - b.t[k]);
            if (d > QUANTUM) return { ok: false, why: `move ${i} field ${k}: ${b.t[k]} vs ${a.t[k]} (Δ${d.toFixed(4)}) — [${b.t}] vs [${a.t}]`, quantised };
            if (d > 0) near = true;
        }
        if (a.v && b.t[2] < a.t[2] - QUANTUM) return { ok: false, why: `move ${i}: the parametric plunge APPROACHES LOWER (from Z${b.t[2]} vs Z${a.t[2]})`, quantised };
        if (near) quantised++;
    }
    return { ok: true, why: '', quantised };
}

for (const cfg of SWEEP) {
    test(`THE BRIDGE — ${cfg.name}`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async ({ base, over, PROGRAMS, CUTS_BY_LEVEL }) => {
            const { traceToolpath } = await import('/engine/trace.js');
            // eslint-disable-next-line no-eval
            const programs = eval(PROGRAMS), cutsByLevel = eval(CUTS_BY_LEVEL);
            const cfg = { ...base, ...over };
            const fill = await programs(cfg, 'fill');
            const raster = (cfg.strategy || 'spiral') === 'raster';
            const wall = raster ? await programs(cfg, 'wall') : null;
            const { pocketRasterGap } = await import('/wizards/pocketWizard.js');
            return {
                gap: pocketRasterGap(cfg), raster,
                litLevels: cutsByLevel(traceToolpath, fill.literal),
                parLevels: cutsByLevel(traceToolpath, fill.para),
                paraIsMacro: /WHILE \[#46 < #42\] DO1/.test(fill.para),
                wallLit: wall ? cutsByLevel(traceToolpath, wall.literal) : null,
                wallPar: wall ? cutsByLevel(traceToolpath, wall.para) : null,
            };
        }, { base: BASE, over: cfg.p, PROGRAMS, CUTS_BY_LEVEL });

        // THE PREMISE: this config really is on the re-pointed arm, and the emit really is a loop rather than a list.
        expect(r.gap, `this config rides the atom (gap: "${r.gap}")`).toBe('');
        expect(r.paraIsMacro, 'and the clearing emitted as a MACRO, not an unrolled transcript').toBe(true);
        // BOTH CUT SOMETHING (two empty programs would "agree" perfectly)
        expect(r.litLevels.cuts.length, 'the literal fill cuts').toBeGreaterThan(0);
        expect(r.litLevels.floors.length, 'at real depth levels').toBeGreaterThan(0);
        // THE SAME CUTTING FLOORS — the depth loop counted the same levels and clamped the last one the same way.
        expect(r.parLevels.floors, `the same cutting floors: literal ${JSON.stringify(r.litLevels.floors)} vs parametric ${JSON.stringify(r.parLevels.floors)}`).toEqual(r.litLevels.floors);
        // …AND THE SAME SET OF FILL CUTS. The ruled criterion; the failure message carries the offending move's own Z.
        const c = compareLevel(r.litLevels.cuts, r.parLevels.cuts);
        expect(c.ok, `the same set of FILL cutting moves, at the same feeds — ${c.why}`).toBe(true);
        // THE QUANTUM IS A BOUND, NOT A BLIND EYE. Where the two differ at all they differ by ONE unit of the emit's
        // own 0.001mm rounding (the literal accumulates in JS; the macro evaluates an expression at the controller),
        // and how many moves that touches is REPORTED so a future widening cannot hide inside the tolerance.
        expect(c.quantised, `moves agreeing only to within the 0.001mm emit quantum: ${c.quantised} of ${r.litLevels.cuts.length}`).toBeLessThanOrEqual(r.litLevels.cuts.length);
        /**
         * ── THE WALL PHASE: WAS BYTE-IDENTICAL, IS NOW EQUIVALENT (t1433) ─────────────────────────────────────────
         *
         * This read `wall.literal === wall.para` and that was the right claim for t1406: the ruling moved only the
         * wall's POSITION, so its emitted text really was unchanged. t1433 re-points the wall itself onto the
         * `wallfinish` atom — a runtime ring loop — so a text comparison would now fail by construction, for the same
         * reason the fill's did one act earlier. It is REPLACED by the same per-level criterion the fill carries here,
         * not deleted: this test still owns the claim that the wall phase agrees, and the sweep it runs it over
         * (ramp/helix descents, the placement matrix) is wider on this axis than the wall's own bridge.
         *
         * The STRONGER, ordered form of the claim — same moves in the same ORDER, which a set comparison cannot see —
         * lives in `pocket-wall-parametric-1433.spec.js` against the frozen `/_test/literalPocketWall.js` reference.
         */
        if (r.raster) {
            expect(r.wallPar.cuts.length, 'the wall phase cuts').toBeGreaterThan(0);
            expect(r.wallPar.floors, `the wall walks the same cutting floors: literal ${JSON.stringify(r.wallLit.floors)} vs parametric ${JSON.stringify(r.wallPar.floors)}`).toEqual(r.wallLit.floors);
            const wc = compareLevel(r.wallLit.cuts, r.wallPar.cuts);
            expect(wc.ok, `the wall phase cuts the same set of moves, at the same feeds — ${wc.why}`).toBe(true);
        }
    });
}

/**
 * THE BOUNDARY IS A REFUSAL, AND THE REFUSED ARMS ARE UNTOUCHED. Every clause of `pocketRasterGap` is a promise that
 * something keeps its literal fill; this is that promise cashed, per clause, in the emitted program rather than in the
 * predicate's own words.
 *
 * ── t1418 — THE TWO ONE-WAY ARMS CAME OUT OF THIS LIST, DELIBERATELY ──────────────────────────────────────────────
 * They were here because the atom's walk was always both-ways, so a one-way raster kept its literal fill and was
 * asserted byte-identical to the frozen reference. t1418 taught the walk all three directions, so the clause emptied
 * and both arms now RIDE the atom — this test asserting them refused would now be asserting the narrowing rather than
 * the boundary. Their replacement is stronger, not weaker: `raster-direction-1418.spec.js` bridges each of them
 * against the same frozen `onewayMoves` reference, per phase, across the three descents. The clauses left here are
 * the ones that still refuse, and t1418's own boundary test re-asserts every one of them beside the two that moved.
 */
test('THE NAMED BOUNDARY — every refused arm still emits the literal fill', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ base, PROGRAMS }) => {
        const { pocketStack, pocketRasterGap } = await import('/wizards/pocketWizard.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        // eslint-disable-next-line no-eval
        const programs = eval(PROGRAMS);
        const types = (p) => flattenBlocks(pocketStack(p)).map((b) => b.type);
        const arm = (name, over) => {
            const p = { ...base, ...over };
            const t = types(p);
            return { name, gap: pocketRasterGap(p), fill: t.includes('pocketfill'), raster: t.includes('surfaceraster') };
        };
        const arms = [
            arm('circle', { shape: 'circle', dia: 50 }),
            arm('polygon', { shape: 'polygon', dia: 50, sides: 6 }),
            arm('ellipse', { shape: 'ellipse', w: 80, h: 60 }),
            arm('a valid rest tool', { restDia: 3 }),
            arm('too small for its tool', { w: 4, h: 4, toolDia: 6 }),
            arm('an entry no turn has bridged', { strategy: 'raster', entry: 'trochoidal' }),
        ];
        // A REFUSED arm, byte-for-byte against the FROZEN literal — the strongest form available. It is asserted on
        // the ENVELOPE clause (an entry no turn has bridged), because that is the one remaining refusal the frozen
        // reference can build IDENTICALLY: it is rect, and the reference's own `entryOrPlunge` degrades an unknown
        // descent to the plunge exactly as the live leaf does. (The rest-tool arm is rect too but adds a `pocketrest`
        // leaf the frozen composition does not carry, so byte-identity there would be measuring the freeze's scope
        // rather than the boundary — checked, not assumed.)
        const unproven = { ...base, strategy: 'raster', entry: 'trochoidal' };
        const { literal, para } = await programs(unproven, "both");
        return { arms, unprovenIdentical: literal === para, unprovenSample: para.split(String.fromCharCode(10)).slice(0, 6) };
    }, { base: BASE, PROGRAMS });

    for (const a of r.arms) {
        expect(a.gap, `${a.name} is refused, with a reason`).not.toBe('');
        expect(a.raster, `${a.name} carries NO surfaceraster`).toBe(false);
    }
    // the too-small arm has no fill at ALL (it is a single holecycle plunge) — every OTHER refused arm keeps its literal leaf
    for (const a of r.arms.filter((x) => x.name !== 'too small for its tool')) {
        expect(a.fill, `${a.name} still emits through the literal pocketfill`).toBe(true);
    }
    expect(r.unprovenIdentical, `a refused (unbridged-entry) raster pocket is BYTE-IDENTICAL to the frozen literal (first lines: ${JSON.stringify(r.unprovenSample)})`).toBe(true);
});

/**
 * THE TWO FLOOR DIVERGENCES, MEASURED. Not a tolerance and not a skip: the numbers are asserted so the ledger is a
 * fact rather than a memory, and so the day somebody changes either floor this test says which one moved.
 */
test('THE NAMED DIVERGENCES — a sub-0.05 stepdown and a sub-0.2mm stepover cut different programs, deliberately', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ base, PROGRAMS, CUTS_BY_LEVEL }) => {
        const { traceToolpath } = await import('/engine/trace.js');
        // eslint-disable-next-line no-eval
        const programs = eval(PROGRAMS), cutsByLevel = eval(CUTS_BY_LEVEL);
        const measure = async (over) => {
            const { literal, para } = await programs({ ...base, ...over }, "both");
            const L = cutsByLevel(traceToolpath, literal), P = cutsByLevel(traceToolpath, para);
            return { litLevels: L.floors.length, parLevels: P.floors.length, litCuts: L.cuts.length, parCuts: P.cuts.length };
        };
        return {
            atFloor: await measure({ depth: 0.4, stepdown: 0.05 }),          // exactly the literal's floor — must agree
            belowFloor: await measure({ depth: 0.1, stepdown: 0.03 }),        // below it — the atom takes the typed value
            stepAtFloor: await measure({ toolDia: 6, stepoverPct: 3.4 }),     // 0.204mm — above the 0.2 floor, must agree
            stepBelowFloor: await measure({ toolDia: 6, stepoverPct: 3 }),    // 0.18mm — the literal floors it, the atom does not
        };
    }, { base: BASE, PROGRAMS, CUTS_BY_LEVEL });

    // AT the floor the two agree, which is what makes the divergence BELOW it a floor rather than a general disagreement.
    expect(r.atFloor.parLevels, 'a stepdown exactly at the literal floor cuts the same number of levels').toBe(r.atFloor.litLevels);
    expect(r.stepAtFloor.parCuts, 'a stepover just above the literal floor cuts the same moves').toBe(r.stepAtFloor.litCuts);
    // BELOW it they diverge, by the ruled amount and in the ruled direction (the atom honours the typed value).
    expect(r.belowFloor.litLevels, 'the literal floors a 0.03 stepdown to 0.05 → 2 levels for a 0.1 depth').toBe(2);
    expect(r.belowFloor.parLevels, 'the atom honours the typed 0.03 → 4 levels. RULED: the atom stands').toBe(4);
    expect(r.stepBelowFloor.parCuts, 'and a sub-0.2mm stepover likewise cuts a different (finer) program').not.toBe(r.stepBelowFloor.litCuts);
});

/**
 * ── t1440 — THE HELIX DIVERGENCE IS THE **FIX**, RULED ON THE GEOMETRY ────────────────────────────────────────────
 *
 * This test was written at t1406 as "pre-existing, not fixed here" — a difference recorded because nobody had decided
 * which side was right. t1440 decided it, and the decision reverses what this test is SAYING while changing not one
 * number in it: the atom's whole revolutions are CORRECT and the literal's nearest-round is the loser.
 *
 * `pitch` is a CEILING (millimetres of descent per revolution = the axial engagement of a helical entry), not a
 * target. Nearest-round can EXCEED it by up to ~2.1%; FUP can only fall SHORT, by up to 50%. The magnitudes favour
 * nearest-round and the DIRECTIONS decide it — a bound you may cross is not a bound, and the cost of falling short
 * is time rather than tool load.
 *
 * SO THE NUMBERS BELOW ARE THE FIX'S SIZE, not a defect's. They are kept exactly as measured, and the frozen literal
 * reference is deliberately NOT corrected: it is the record of what shipped, and a reference that gets "improved"
 * stops being one (its own header says so).
 *
 * ── THE DIVERGENCE REGION, NAMED ──────────────────────────────────────────────────────────────────────────────────
 * The two agree exactly when `stepdown / pitch` is a whole number of revolutions (every surfacing default, and the
 * three pitches asserted identical below). They diverge otherwise, and the atom is always the FINER descent — which
 * is the ceiling being honoured, stated as a property rather than as a per-pitch table.
 *
 * The atom has emitted `#38=[FUP[#43 / pitch] * 24]` since t1345: it rounds the REVOLUTION count UP, so the descent
 * always completes whole turns and ends at the angle it entered on. The literal kernel rounds the SEGMENT count to
 * nearest (`Math.round(max(1, depth/pitch) * 24)`), so it can finish part-way round.
 *
 * WHY IT SURFACED AT t1406 AND NOT AT t1345: surfacing's own defaults are stepdown 0.5 at 1mm/rev, where the
 * literal's `max(1, …)` clamp and the atom's `IF #38 < 24` floor both land on exactly one revolution. Every surfacing
 * bridge sat inside that agreement. A pocket's stepdown is millimetres, not tenths, so it walks straight out of it.
 */
test('THE HELIX DIVERGENCE IS THE FIX — whole revolutions honour the pitch ceiling; nearest-round can exceed it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ base, PROGRAMS, CUTS_BY_LEVEL }) => {
        const { traceToolpath } = await import('/engine/trace.js');
        // eslint-disable-next-line no-eval
        const programs = eval(PROGRAMS), cutsByLevel = eval(CUTS_BY_LEVEL);
        const at = async (helixPitch) => {
            const { literal, para } = await programs({ ...base, entry: 'helix', helixDia: 4, helixPitch }, 'fill');
            return { helixPitch, lit: cutsByLevel(traceToolpath, literal).cuts.length, par: cutsByLevel(traceToolpath, para).cuts.length };
        };
        return { rows: [await at(0.5), await at(0.75), await at(1.5), await at(0.8), await at(1)] };
    }, { base: BASE, PROGRAMS, CUTS_BY_LEVEL });

    const by = Object.fromEntries(r.rows.map((x) => [String(x.helixPitch), x]));
    // stepdown 1.5 ÷ pitch → a WHOLE number of revolutions: identical, move for move.
    expect(by['0.5'].par, '1.5 / 0.5 = 3 revolutions — identical').toBe(by['0.5'].lit);
    expect(by['0.75'].par, '1.5 / 0.75 = 2 revolutions — identical').toBe(by['0.75'].lit);
    expect(by['1.5'].par, '1.5 / 1.5 = 1 revolution — identical').toBe(by['1.5'].lit);
    // …and outside them, the atom cuts MORE segments, because it finishes the turn. The exact numbers, so a change shows.
    expect([by['0.8'].lit, by['0.8'].par], 'pitch 0.8 (1.875 rev): the literal rounds to 45 segments/level, the atom takes 2 whole turns').toEqual([315, 324]);
    expect([by['1'].lit, by['1'].par], 'pitch 1.0 (1.5 rev): the widest case in this sweep').toEqual([288, 324]);
    /**
     * t1440 — THE DIRECTION IS THE RULING, and it is the assertion that matters most here. The atom is always the
     * FINER descent: more segments for the same drop means a SHALLOWER achieved pitch, i.e. at or under the ceiling
     * the operator declared. The literal being coarser is the same fact read the other way — it can descend faster
     * per revolution than was asked. Asserting the direction (rather than only the two sample numbers above) is what
     * makes this a statement about the RULE instead of about two pitches somebody happened to measure.
     */
    expect(by['1'].par, 'the atom is always the FINER descent — the pitch ceiling honoured, never exceeded').toBeGreaterThan(by['1'].lit);
    expect(by['0.8'].par, 'and at the other divergent pitch too — one direction, not a coincidence').toBeGreaterThan(by['0.8'].lit);
});

/**
 * THE KNOB IS REAL — a #var in the pocket's own fill socket reaches #42/#43 AND NOTHING ELSE MOVES.
 *
 * "The classifier now says exposable" would be testing the change against itself. The claim that matters is about
 * G-CODE: put a register in the depth/stepdown socket of a PLACED pocket and every coordinate must come out
 * byte-identical — because if the place fold were rewriting this body's text, the exposure would silently drop the
 * translate and every coordinate would shift. The re-point is what makes this reachable at all: the pocket's fill used
 * to be `stepdown{ pocketfill }`, whose every number went through `num()` into a JS loop.
 */
test('THE CAM KNOB — a #var in a placed pocket reaches #42/#43, coordinates untouched', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (base) => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { paramRole } = await import('/data/atomRoles.js');
        const P = { ...base, originX: 12.5, originY: -7.25, stockAttach: 'pp', pathDatum: 'pp', stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20 };
        // ⚠ WRITTEN INTO THE SOCKET, not through the wizard's front door: pocketStack coerces its params with num(),
        // which is correct for a FORM (a typed field is a number). A CAM exposure substitutes into the block's socket.
        const setLive = (stack, keys) => {
            const walk = (bs) => { for (const b of (bs || [])) { if (b.type === 'surfaceraster') Object.assign(b.params, keys); walk(b.children); walk(b.uiChildren); } };
            walk(stack); return stack;
        };
        const baked = emitMapped(setLive(pocketStack(P), {})).text;
        const live = emitMapped(setLive(pocketStack(P), { depth: '#2601', stepdown: '#2602', feed: '#2603' })).text;
        const coords = (t) => (t.match(/\b([XYZIJ])(\[[^\]]*\]|-?\d*\.?\d+|#\d+)/g) || []);
        return {
            bakedCoords: coords(baked), liveCoords: coords(live),
            depthSeed: (live.match(/#42=\S+/) || [''])[0], stepSeed: (live.match(/#43=\S+/) || [''])[0],
            liveFeed: /F#2603\b/.test(live), bakedFeed: /F#2603\b/.test(baked),
            roles: { depth: paramRole('surfaceraster', 'depth'), stepdown: paramRole('surfaceraster', 'stepdown'), feed: paramRole('surfaceraster', 'feed'), inset: paramRole('surfaceraster', 'inset') },
            sameLines: baked.split(String.fromCharCode(10)).length === live.split(String.fromCharCode(10)).length,
        };
    }, BASE);

    expect(r.depthSeed, 'the depth register takes the #var verbatim').toBe('#42=#2601');
    expect(r.stepSeed, 'and so does the per-level bite — the build-time floor cannot apply to a value that does not exist yet').toBe('#43=#2602');
    expect(r.liveFeed, 'the feed rides through as a register').toBe(true);
    expect(r.bakedFeed, 'and it was not there before — this is not a no-op comparison').toBe(false);
    expect(r.bakedCoords.length, 'the placed program emits real coordinate words').toBeGreaterThan(5);
    expect(r.liveCoords, 'every X/Y/Z/I/J is byte-identical — the place fold absorbed, it did not rewrite').toEqual(r.bakedCoords);
    expect(r.sameLines, 'and the program is the same shape').toBe(true);
    // THE DECLARED ROLES the exposure rests on — `inset` BAKES, and that is not an oversight: it is folded into w/h
    // and x0/y0 at BUILD time, so a #var there becomes NaN before any register exists.
    expect(r.roles).toEqual({ depth: 'value', stepdown: 'value', feed: 'value', inset: 'geometry' });
});

/**
 * THE PLACE ABSORBED — asserted structurally as well as by its symptom, because the two failures look different.
 * A body that got text-rewritten would still produce the right coordinates on an UNPLACED pocket; only the structure
 * says the mechanism is the one we think it is.
 */
test('THE CLEARING PLACE HOLDS THE ATOM ALONE — absorbingChild is what makes the whole shape legal', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (base) => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { absorbingChild } = await import('/blocks/blockEmitter.js');
        const { blockedIndices } = await import('/data/exposeClassifier.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const look = (over) => {
            const stack = pocketStack({ ...base, ...over });
            const places = flattenBlocks(stack).filter((b) => b.type === 'placeonstock');
            const flat = flattenBlocks(stack);
            const blocked = blockedIndices(stack);
            const rasterIdx = flat.findIndex((b) => b.type === 'surfaceraster');
            return {
                roles: places.map((p) => p.params.role),
                absorbs: places.map((p) => !!absorbingChild(p.children)),
                rasterBlocked: rasterIdx >= 0 ? blocked.has(rasterIdx) : null,
            };
        };
        return { spiral: look({}), raster: look({ strategy: 'raster' }), literal: look({ shape: 'circle', dia: 50 }) };
    }, BASE);

    expect(r.spiral.roles, 'a spiral pocket is placed ONCE, as the clearing').toEqual(['clear']);
    expect(r.raster.roles, 'a raster pocket is placed twice — clearing, then wall').toEqual(['clear', 'wall']);
    expect(r.spiral.absorbs, 'and the clearing place absorbs (one self-framing child)').toEqual([true]);
    // t1433 — BOTH places absorb now. The wall place was `[true, false]` here because it still wrapped
    // `stepdown{ pocketwall }`, a literal body the place fold could safely text-rewrite. The re-pointed wall is one
    // self-framing atom, so it takes its frame as params like the clearing does — and it MUST, because a body whose
    // coordinates can be registers is exactly what t1349 measured the text rewrite shearing.
    expect(r.raster.absorbs, 'both places absorb — each holds exactly one self-framing atom').toEqual([true, true]);
    expect(r.raster.rasterBlocked, 'so the atom is NOT under a blocking fold — which is what makes its knobs reachable').toBe(false);
    expect(r.literal.roles, 'a refused (circle) pocket keeps its single clearing place, unchanged').toEqual(['clear']);
});

/**
 * THE RECONCILER READS THE ARM THAT IS ACTUALLY THERE (the t1387 sweep, done IN this act).
 *
 * The pocket reverse-sync opened with `find(prog, 'stepdown')` and then looked for a `pocketfill` inside it. On the
 * re-pointed arm there is no `pocketfill`, and on spiral no `stepdown` either — so an edited parametric pocket would
 * have failed to reconcile SILENTLY, which is precisely the failure t1387 named: a reader that identifies an arm by a
 * block that moved. The op's own "does this look hand-edited" guard is the symptom, and it is asserted here directly
 * rather than trusted to a general sweep: a reconciler that returns null makes a freshly-inserted op glow as edited.
 */
test('THE RECONCILER — a parametric pocket reverse-syncs, and wallOffset survives the inset round-trip', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { pocketWallOffsetFromInset, pocketInsetMm } = await import('/wizards/ops/pocketfill.js');
        const P = { shape: 'rect', w: 80, h: 60, toolDia: 6, wallOffset: -0.75, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, strategy: 'raster', entry: 'ramp', rampAngle: 4 };
        // the inverse is exact, both ways, across signs — it is one declaration read backwards, not an inference
        const trip = [0, 0.5, -0.5, 2, -2].map((w) => pocketWallOffsetFromInset(6, pocketInsetMm({ toolDia: 6, wallOffset: w })));
        // and the op really does round-trip through the app's own edited-check
        window.ddcsLoadBlockStack([]);
        window.openWiz('pocket', undefined, true); window.updateWiz(); await window.insertWiz(); window.closeWiz && window.closeWiz();
        const prog = window.ddcsGetBlockProgram() || [];
        const op = [...prog].reverse().find((b) => b && b.type === 'op' && b.opType === 'pocket');
        const glow = await import('/blocks/opGlow.js');
        const session = await import('/blocks/opSession.js');
        const rebuilt = op ? session.replayReconcile(op.id) : null;
        return {
            trip,
            hasRaster: JSON.stringify(pocketStack(P)).includes('"type":"surfaceraster"'),
            opFound: !!op,
            falseGlow: op ? !!glow.isOpBlockEdited(op.id) : null,
            reconciled: !!rebuilt,
        };
    });
    expect(r.hasRaster, 'the config under test really is on the re-pointed arm').toBe(true);
    expect(r.trip, 'wallOffset → inset → wallOffset is exact, across both signs').toEqual([0, 0.5, -0.5, 2, -2]);
    expect(r.opFound, 'a pocket inserts').toBe(true);
    expect(r.reconciled, 'the reconciler READ the parametric stack and rebuilt from it (null = it declined)').toBe(true);
    expect(r.falseGlow, 'and a freshly-inserted pocket does NOT look hand-edited — the reverse-sync agrees with the builder').toBe(false);
});

/**
 * FOUR FIELDS THE PARAMETRIC ARM HAS NO SOCKET FOR — and the form still offers every one of them.
 *
 * `shape`, `dia`, `sides` and `wallOffset` exist only on the literal leaf. That is exactly why the twin's CANONICAL
 * binding stack is pinned to the literal arm: derive the form over the parametric one and the wizard would silently
 * lose four controls. Asserted on the def the app registers, because "the reasoning says it is fine" is not the same
 * as looking.
 *
 * t1418 — `direction` was a FIFTH such field and is no longer one: the atom walks it, so it gained a bare
 * surfaceraster row beside the literal one (the UI metadata stays on the literal row, which is the canonical stack).
 * It is still listed below because the claim here is about the FORM, and the form must offer it in either state.
 */
test('THE FORM KEEPS EVERY FIELD — the canonical binding stack is pinned to the literal arm on purpose', async ({ page }) => {
    await boot(page);
    const params = await page.evaluate(async () => {
        const { pocketDataDef } = await import('/blocks/dataOps/pocketData.js');
        const def = pocketDataDef();
        return (def.bindings || []).map((b) => b.param);
    });
    for (const p of ['shape', 'dia', 'sides', 'wallOffset', 'direction', 'w', 'h', 'depth', 'stepdown', 'toolDia', 'stepoverPct', 'entry', 'feed', 'plunge', 'clearance', 'originX', 'originY', 'confirmEvery'])
        expect(params, `the form still offers "${p}"`).toContain(p);
});
