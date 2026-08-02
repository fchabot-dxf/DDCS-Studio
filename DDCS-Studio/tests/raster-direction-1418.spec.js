import { test, expect } from '@playwright/test';
import { rampDescentRelationship, splitRampDescent, cutBox } from './support/rampRelationship.js';

/**
 * t1418 — DIRECTION-TAUGHT: `surfaceraster` walks all three directions, and the one-way boundary clause empties.
 *
 * ── WHAT WAS TRUE BEFORE ──────────────────────────────────────────────────────────────────────────────────────────
 * The atom's row walk was ALWAYS both-ways — `#49` seeded 1 and negated every row, no branch — and t1404 DECLARED that
 * (`SURFACE_RASTER_IGNORES.direction`) so the next caller would find the fact rather than rediscover it. It worked:
 * t1406 read that line and NARROWED the pocket's arm, so a one-way raster kept its literal fill instead of silently
 * emitting a zig-zag against the request. This turn closes the capability, so the narrowing and the declaration both
 * come out — and the declaration coming out is the shape of a declaration built to be removed actually being removable.
 *
 * ── THE CRITERION, AND WHY IT IS NOT THE CUT COUNT (t1416's scout, measured before this was built) ────────────────
 * On the literal at 80×60, Ø6 @40%, 3 levels: both-ways cuts 92 with 6 rapids; one-way cuts 92 with 94 rapids. THE CUT
 * COUNT IS IDENTICAL FOR A DIFFERENT REASON EACH TIME — both-ways is 46 rows + 46 step-overs-at-depth, one-way is 46
 * rows + 46 PLUNGES — so a bridge comparing counts would PASS on a walk that never lifted. The discriminators are the
 * RAPIDS and the row DIRECTIONS, and both are asserted here as premises before the equivalence is claimed.
 *
 * ── THE LITERAL SIDE IS THE FROZEN /_test/ REFERENCE ──────────────────────────────────────────────────────────────
 * `onewayMoves` in `/_test/literalPocketFill.js`, frozen at t1404 and landed in t1406's act. Building the literal side
 * from `pocketStack` would compare the parametric emit to itself and pass while proving nothing (the t1385 vacuity
 * trap). The relationship class is t1406's: at every depth level, the SET of cutting moves is the same set.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** t1406's base, unchanged, so the two acts' numbers are comparable. `strategy: 'raster'` is the arm direction reaches. */
const BASE = { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, toolDia: 6, wallOffset: 0, stepoverPct: 40, depth: 4, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, strategy: 'raster' };

/**
 * THE SWEEP — both one-way words × the three descents, plus the cases most likely to make a loop and an unrolled list
 * disagree: an inset in both signs (the wallOffset the dispatch names), a row count that does not divide, a single-row
 * pocket, a clamped last bite, and a placed frame where the walk's START END and the placement must both land right.
 *
 * The helix pitches divide the stepdown EXACTLY (1.5/0.5 = 3 revs, 1.5/0.75 = 2) — not a convenience but the boundary
 * of t1406's third named divergence (the atom takes whole revolutions, the literal rounds the segment count). Inside
 * whole revolutions the descents are identical and this bridge really does prove the helix; outside them they are not,
 * and t1406's spec already says so with numbers. Nothing about that is changed by the direction axis.
 */
const SWEEP = [];
for (const direction of ['oneway', 'otherway']) {
    SWEEP.push(
        { name: `${direction} · plunge · the shipped defaults`, p: { direction } },
        { name: `${direction} · RAMP`, p: { direction, entry: 'ramp' } },
        { name: `${direction} · HELIX — 2 whole revolutions per level`, p: { direction, entry: 'helix', helixDia: 4, helixPitch: 0.75 } },
        { name: `${direction} · INSET — wallOffset +0.5 cuts oversize`, p: { direction, wallOffset: 0.5 } },
        { name: `${direction} · INSET — wallOffset −0.5 leaves stock`, p: { direction, wallOffset: -0.5 } },
        { name: `${direction} · ROW COUNT — a stepover that does not divide the height`, p: { direction, h: 60, toolDia: 12, stepoverPct: 60 } },
        { name: `${direction} · a NARROW pocket — ONE row, so the walk is descent-only`, p: { direction, w: 40, h: 9 } },
        { name: `${direction} · the last bite is CLAMPED, not overshot`, p: { direction, depth: 2, stepdown: 5 } },
        { name: `${direction} · depth NOT a multiple of the stepdown`, p: { direction, depth: 4.3, stepdown: 1.2 } },
        { name: `${direction} · PLACED — the start end must land in the placed frame`, p: { direction, originX: 12.5, originY: -7.25, stockAttach: 'pp', pathDatum: 'pp', stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20 } },
        { name: `${direction} · RAMP + inset, where the descent starts from the row's own end`, p: { direction, entry: 'ramp', wallOffset: 0.4 } },
    );
}

/** t1406's PROGRAMS, verbatim in shape: both sides through the REAL emitter, decomposed by dropping the other phase's place. */
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
 * t1406's reader, EXTENDED with the two discriminators this act needs — the rapid count and the signed row directions.
 * Everything above them is verbatim, including the named normalisation of a vertical descent's start height (compared
 * by where it ENDS, with the separate "never approaches lower" rule), because the reasons for it are unchanged here.
 *
 * `rowDirs` is the sign of every HORIZONTAL cut long enough to be a row rather than a step-over: a one-way walk's rows
 * are all one sign, a both-ways walk's alternate. It is taken in EMIT order, not sorted — order is exactly the property
 * being read.
 */
const READ = `
(traceToolpath, nc) => {
    const all = (traceToolpath(nc).segments || []);
    const segs = all.filter((s) => !s.rapid);
    const q = (n) => +Number(n).toFixed(3);
    const cuts = segs.map((s) => ({
        v: Math.abs(s.x1 - s.x2) < 1e-6 && Math.abs(s.y1 - s.y2) < 1e-6 && s.z1 > s.z2 + 1e-9,
        t: [q(s.x1), q(s.y1), q(s.z1), q(s.x2), q(s.y2), q(s.z2), q(s.feed || 0)],
    }));
    const sk = (e) => (e.v ? 'V' : 'C') + (e.v ? [e.t[3], e.t[4], e.t[5], e.t[6]] : e.t).map((n) => n.toFixed(2)).join(',');
    cuts.sort((a, b) => (sk(a) < sk(b) ? -1 : sk(a) > sk(b) ? 1 : 0));
    const floors = [...new Set(segs.filter((s) => Math.abs(s.z1 - s.z2) < 1e-6).map((s) => q(s.z2).toFixed(2)))].sort();
    // A ROW CUT IS A FULL-WIDTH TRAVERSE, and saying that explicitly is not pedantry — it is a correction made after
    // the first run FAILED. "Every horizontal cut at a level floor" also catches a DESCENT's return leg: a ramp cuts
    // back from its midpoint to the row start at depth, and a helix cuts out from the area centre, both horizontally,
    // both in the direction OPPOSITE the row they are entering. Reading those as rows made a perfectly consistent
    // one-way walk look like it changed direction. A row spans the whole walk width; a descent's return leg cannot
    // (its run is bounded by the distance to the CENTRE), so the widest horizontal cut in the program is the row.
    const hz = segs.filter((s) => Math.abs(s.z1 - s.z2) < 1e-6 && Math.abs(s.x1 - s.x2) > 1e-6);
    const span = hz.reduce((m, s) => Math.max(m, Math.abs(s.x1 - s.x2)), 0);
    const rowCuts = hz.filter((s) => Math.abs(Math.abs(s.x1 - s.x2) - span) < 0.002);
    // THE ROW SET — each row as { lo, hi, y, z } with the ends ORDERED, so the same row read left-to-right and
    // right-to-left is the same entry. That is what makes "the row set does not change with direction" sayable at all.
    const rows = rowCuts.map((s) => [q(Math.min(s.x1, s.x2)), q(Math.max(s.x1, s.x2)), q(s.y1), q(s.z2)].join(','));
    const rowDirs = rowCuts.map((s) => (s.x2 > s.x1 ? 1 : -1));
    return { cuts, floors, rapids: all.length - segs.length, rows: rows.slice().sort(), rowDirs };
}`;

const QUANTUM = 0.0015;

/** t1406's comparator, verbatim — the criterion is the same relationship class, applied to a different walk. */
function compareLevel(lit, par) {
    if (lit.length !== par.length) return { ok: false, why: `count ${par.length} vs ${lit.length}`, quantised: 0 };
    let quantised = 0;
    for (let i = 0; i < lit.length; i++) {
        const a = lit[i], b = par[i];
        if (a.v !== b.v) return { ok: false, why: `move ${i}: one is a vertical descent and the other is not (${a.t} vs ${b.t})`, quantised };
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
    test(`THE ONE-WAY BRIDGE — ${cfg.name}`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async ({ base, over, PROGRAMS, READ }) => {
            const { traceToolpath } = await import('/engine/trace.js');
            // eslint-disable-next-line no-eval
            const programs = eval(PROGRAMS), read = eval(READ);
            const cfg = { ...base, ...over };
            const fill = await programs(cfg, 'fill');
            const wall = await programs(cfg, 'wall');
            const { pocketRasterGap } = await import('/wizards/pocketWizard.js');
            return {
                gap: pocketRasterGap(cfg),
                lit: read(traceToolpath, fill.literal), par: read(traceToolpath, fill.para),
                paraIsMacro: /WHILE \[#46 < #42\] DO1/.test(fill.para),
                // the one-way body writes TWO row labels and never the four end-choosing ones
                endLabels: /N1[5678]\b/.test(fill.para),
                wallLit: read(traceToolpath, wall.literal), wallPar: read(traceToolpath, wall.para),
            };
        }, { base: BASE, over: cfg.p, PROGRAMS, READ });

        // THE PREMISE — this config is on the re-pointed arm at all, which is the whole boundary change.
        expect(r.gap, `a one-way pocket now rides the atom (gap: "${r.gap}")`).toBe('');
        expect(r.paraIsMacro, 'and the clearing emitted as a MACRO, not an unrolled transcript').toBe(true);
        expect(r.lit.cuts.length, 'the literal fill cuts').toBeGreaterThan(0);

        // ── THE DISCRIMINATORS, ASSERTED BEFORE THE EQUIVALENCE (the scout's trap) ─────────────────────────────────
        // Every row runs the SAME way. This is the property the operator is buying, and it is the one a cut-count
        // comparison cannot see.
        const dirs = new Set(r.par.rowDirs);
        expect(r.par.rowDirs.length, 'the parametric walk cuts rows').toBeGreaterThan(0);
        expect([...dirs], `every row runs the same way (saw ${JSON.stringify(r.par.rowDirs.slice(0, 12))}…)`).toEqual([cfg.p.direction === 'otherway' ? -1 : 1]);
        expect([...new Set(r.lit.rowDirs)], 'and the literal reference agrees, in the same direction').toEqual([...dirs]);
        // THE TOOL REALLY LIFTS. A one-way walk that quietly linked at depth would still cut the same set of rows and
        // would still count 92 cuts; what it would NOT do is spend a rapid per row.
        expect(r.par.rapids, `the one-way walk lifts and rapids back between rows (literal ${r.lit.rapids})`).toBeGreaterThan(r.par.rowDirs.length);

        // THE SAME CUTTING FLOORS, then the ruled per-phase criterion.
        expect(r.par.floors, `the same cutting floors: literal ${JSON.stringify(r.lit.floors)} vs parametric ${JSON.stringify(r.par.floors)}`).toEqual(r.lit.floors);
        /**
         * ⚠ t1487 — RESTATED, NOT RETIRED (ruled t1486). On the RAMP arm the descent is taken out of the per-phase
         * comparison and asserted on its declared relationship instead: C4 points the ramp along the ROW rather than
         * at the area centre (t1483/t1485), so the literal's two descent moves per level stopped being this
         * descent's reference while everything around them stayed exactly what it was.
         *
         * ⚠ GATED ON `entry: 'ramp'` DELIBERATELY. A HELIX descent also cuts while changing Z and moving in XY, so an
         * ungated split would quietly lift the helix rows out of their move-for-move criterion too — and the ruling
         * is explicit that plunge and helix keep theirs untouched. On a plunge config the split is a no-op anyway
         * (there is no ramping move to find); the gate is what makes that true of the helix as well.
         */
        const isRamp = cfg.p.entry === 'ramp';
        const litFill = isRamp ? splitRampDescent(r.lit.cuts, (e) => e.t) : null;
        const parFill = isRamp ? splitRampDescent(r.par.cuts, (e) => e.t) : null;
        const c = compareLevel(litFill ? litFill.walk : r.lit.cuts, parFill ? parFill.walk : r.par.cuts);

        expect(c.ok, `the same set of FILL cutting moves${isRamp ? ' OUTSIDE the descent' : ''}, at the same feeds — ${c.why}`).toBe(true);
        if (isRamp) {
            // t1524 — `actualDrop`: the literal side is the FROZEN pre-change reference, so a CLAMPED final level
            // legitimately starts its ramp higher there than here. Shaped allowance, both directions asserted —
            // see the block comment in rampRelationship.js and the sibling call in pocket-rides-raster-1406.
            const rel = rampDescentRelationship(r.lit.cuts, r.par.cuts, { at: (e) => e.t, bbox: cutBox(r.lit.cuts, (e) => e.t), actualDrop: true });
            expect(rel.ok, `and the descent holds its declared relationship to the literal — ${rel.why}`).toBe(true);
        }
        expect(c.quantised, `moves agreeing only to within the 0.001mm emit quantum: ${c.quantised} of ${r.lit.cuts.length}`).toBeLessThanOrEqual(r.lit.cuts.length);

        // THE FOUR END-CHOOSING LABELS ARE NOT EMITTED — the flowLabels declaration and the body agree (see below).
        expect(r.endLabels, 'the one-way body writes none of the four end-choosing labels').toBe(false);

        /**
         * THE WALL ARM IS UNAFFECTED BY `direction` — which is the claim this test owns, and it survives t1433 intact.
         *
         * It read `wall.literal === wall.para`, byte-identity, because at t1418 the wall was still the literal
         * `stepdown{ pocketwall }` on BOTH sides. t1433 re-points it onto the `wallfinish` atom, so the text differs
         * by construction while the claim here — "a one-way or conventional pocket gets the SAME wall finish a
         * both-ways one gets" — is unchanged and is now stated on the motion. `direction` still never reaches the
         * wall: the atom has no such field at all.
         */
        expect(r.wallPar.cuts.length, 'the wall phase cuts').toBeGreaterThan(0);
        expect(r.wallPar.floors, `the wall walks the same cutting floors: literal ${JSON.stringify(r.wallLit.floors)} vs parametric ${JSON.stringify(r.wallPar.floors)}`).toEqual(r.wallLit.floors);
        const wc = compareLevel(r.wallLit.cuts, r.wallPar.cuts);
        expect(wc.ok, `the wall phase cuts the same set of moves, whichever direction the fill ran — ${wc.why}`).toBe(true);
    });
}

/**
 * THE ROW SET DOES NOT MOVE — the scout's first fact, asserted as an invariant rather than re-derived per direction.
 *
 * A one-way walk is a TRAVEL change, not a geometry change: same rows, same Y, same extents, same depths. If this ever
 * fails, the direction axis has started deciding WHERE the tool cuts instead of only how it gets there, which is a
 * different and much larger claim than the one this act makes.
 */
test('THE ROW SET IS DIRECTION-INVARIANT — same rows, same extents, all three ways', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ base, PROGRAMS, READ }) => {
        const { traceToolpath } = await import('/engine/trace.js');
        // eslint-disable-next-line no-eval
        const programs = eval(PROGRAMS), read = eval(READ);
        const at = async (direction) => {
            const { para, literal } = await programs({ ...base, direction }, 'fill');
            const P = read(traceToolpath, para), L = read(traceToolpath, literal);
            return { rows: P.rows, litRows: L.rows, rapids: P.rapids, cuts: P.cuts.length };
        };
        return { bothways: await at('bothways'), oneway: await at('oneway'), otherway: await at('otherway') };
    }, { base: BASE, PROGRAMS, READ });

    expect(r.bothways.rows.length, 'the both-ways walk cuts rows').toBeGreaterThan(1);
    expect(r.oneway.rows, 'one-way cuts exactly the same rows as both-ways').toEqual(r.bothways.rows);
    expect(r.otherway.rows, 'and so does the mirror').toEqual(r.bothways.rows);
    expect(r.oneway.litRows, 'and the frozen literal agrees on that set too').toEqual(r.oneway.rows);
    // THE COST, MEASURED — the numbers the scout predicted, now asserted on the shipping emit. The equal CUT COUNT is
    // exactly the trap: it is the RAPIDS that tell the two walks apart.
    expect(r.oneway.cuts, 'the cut counts are EQUAL — which is why this is not the criterion').toBe(r.bothways.cuts);
    expect(r.otherway.cuts, 'likewise for the mirror').toBe(r.bothways.cuts);
    expect(r.oneway.rapids, 'a one-way walk spends far more rapids — that is what it costs').toBeGreaterThan(r.bothways.rapids * 5);
    expect(r.otherway.rapids, 'and the mirror costs the same').toBe(r.oneway.rapids);
});

/**
 * THE DEFAULT PATH DID NOT MOVE — the guard that makes every claim above safe to ship.
 *
 * Both-ways is what every surfacing op and every pocket built before this turn emits, so the assertion is BYTE
 * identity, not equivalence. Surfacing is checked through its OWN stack (which hard-codes `bothways` on the block)
 * rather than through the atom, because the claim is about the shipped op, not about a param nobody can set on it.
 */
test('BOTH-WAYS IS BYTE-IDENTICAL — and surfacing, which hard-codes it, is untouched', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (base) => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { surfaceRasterLines, SURFACE_RASTER_IGNORES } = await import('/wizards/ops/surfaceraster.js');
        const text = (stack) => emitMapped(stack).text;
        // A POCKET: an absent direction and an explicit both-ways must emit the same program — the default is a word,
        // not a special case.
        const absent = text(pocketStack({ ...base }));
        const explicit = text(pocketStack({ ...base, direction: 'bothways' }));
        // SURFACING: its own stack, across the descents and both strategies, with an `oneway` in the OP params to prove
        // the hard-code holds — the wizard must not start honouring a word it never offered.
        const surf = [];
        for (const strategy of ['raster', 'concentric']) for (const entry of ['plunge', 'ramp', 'helix']) {
            const p = { w: 200, h: 150, depth: 1, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5, strategy, entry, rampAngle: 3, helixDia: 6, helixPitch: 1 };
            surf.push([`${strategy}/${entry}`, text(surfacingStack(p)) === text(surfacingStack({ ...p, direction: 'oneway' }))]);
        }
        // AND THE ATOM ITSELF: an UNKNOWN direction word emits the both-ways body (the emitter's own resolution), which
        // is what makes the envelope — not the emitter — the thing that refuses it.
        const A = { x: 0, y: 0, w: 80, h: 60, depth: 3, stepdown: 1.5, toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel', entry: 'plunge' };
        return {
            pocketSame: absent === explicit,
            surf,
            unknownIsBothways: surfaceRasterLines({ ...A, direction: 'sideways' }).join('|') === surfaceRasterLines({ ...A, direction: 'bothways' }).join('|'),
            ignores: SURFACE_RASTER_IGNORES,
        };
    }, BASE);

    expect(r.pocketSame, 'an absent direction and an explicit both-ways are the same program').toBe(true);
    for (const [k, same] of r.surf) expect(same, `surfacing ${k} is byte-identical with a one-way in its params — the stack hard-codes both-ways`).toBe(true);
    expect(r.unknownIsBothways, 'an unknown direction word emits the both-ways body; the ENVELOPE is what refuses it').toBe(true);
    // THE DECLARATION BUILT TO BE REMOVED IS REMOVED. Both halves: the key is gone AND the walk reads the word (the
    // bridge above is that second half). An empty table on its own would prove nothing.
    expect(Object.keys(r.ignores), 'SURFACE_RASTER_IGNORES is empty — the atom no longer ignores anything it declares').toEqual([]);
});

/**
 * THE ENVELOPE GREW AN AXIS, HONESTLY — twelve rows, and not one of them invented.
 *
 * The naive key `strategy/direction/entry` would have manufactured SIX false concentric rows, each reading like a
 * bridged combination when the rings have no direction to bridge. So the axis set is DATA per strategy and the key is
 * built from it — asserted here against the declared product rather than against a hand-written list, so the table and
 * the axes can never drift apart.
 */
test('THE ENVELOPE — twelve rows over the DECLARED axes, six of them earned this turn', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const VALUES = { strategy: ['parallel', 'concentric'], direction: ['bothways', 'oneway', 'otherway'], entry: ['plunge', 'ramp', 'helix'] };
        // the product the DECLARATION implies — every strategy crossed with the values of the axes IT reads
        const expected = [];
        for (const strategy of VALUES.strategy) {
            const axes = m.SURFACE_RASTER_AXES[strategy];
            let keys = [''];
            for (const a of axes) keys = keys.flatMap((k) => (a === 'strategy' ? [strategy] : VALUES[a].map((v) => `${k}/${v}`)));
            expected.push(...keys);
        }
        const grid = {};
        for (const strategy of VALUES.strategy) for (const direction of VALUES.direction) for (const entry of VALUES.entry)
            grid[`${strategy}|${direction}|${entry}`] = { covered: m.surfaceRasterCovers({ strategy, direction, entry }), why: m.surfaceRasterGap({ strategy, direction, entry }) };
        return {
            axes: m.SURFACE_RASTER_AXES, proven: m.SURFACE_RASTER_PROVEN, expected: expected.sort(), grid,
            bogusDirection: { covered: m.surfaceRasterCovers({ strategy: 'parallel', direction: 'sideways', entry: 'plunge' }), why: m.surfaceRasterGap({ strategy: 'parallel', direction: 'sideways', entry: 'plunge' }) },
            bogusEntry: { covered: m.surfaceRasterCovers({ strategy: 'concentric', entry: 'trochoidal' }), why: m.surfaceRasterGap({ strategy: 'concentric', entry: 'trochoidal' }) },
            bogusStrategy: { covered: m.surfaceRasterCovers({ strategy: 'adaptive', entry: 'plunge' }), why: m.surfaceRasterGap({ strategy: 'adaptive', entry: 'plunge' }) },
            empty: { covered: m.surfaceRasterCovers({}), why: m.surfaceRasterGap({}) },
        };
    });

    // THE AXES ARE THE DECLARATION, and concentric's missing direction axis is the whole reason the table is 12 and
    // not 18. It is stated here so a future reader sees the decision rather than inferring it from a row count.
    expect(r.axes.parallel, 'the row walk reads all three axes').toEqual(['strategy', 'direction', 'entry']);
    expect(r.axes.concentric, 'the ring walk reads no direction — it never looks at the word, and neither does the reference').toEqual(['strategy', 'entry']);
    expect(Object.keys(r.proven).sort(), 'the table is exactly the product the axes declare — no extra rows, none missing').toEqual(r.expected);
    expect(Object.keys(r.proven).length, 'twelve: nine parallel, three concentric').toBe(12);

    // EVERY combination of the three user-facing words is covered, and each because a ROW says so with its turn.
    for (const [k, v] of Object.entries(r.grid)) {
        expect(v.covered, `${k} is claimed`).toBe(true);
        expect(v.why, `${k} names no gap`).toBe('');
    }
    // THE SIX EARNED THIS TURN SAY SO IN THE TABLE ITSELF.
    for (const d of ['oneway', 'otherway']) for (const e of ['plunge', 'ramp', 'helix'])
        expect(r.proven[`parallel/${d}/${e}`], `parallel/${d}/${e} carries the turn that earned it`).toMatch(/t1418/);
    // …AND THE THREE THAT DID NOT MOVE STILL CARRY THEIRS, re-keyed but not re-attributed.
    expect(r.proven['parallel/bothways/plunge']).toMatch(/t1329/);
    expect(r.proven['concentric/ramp']).toMatch(/t1404/);

    // THE POINT OF A TABLE: an unmeasured word REFUSES, with a reason — including on the axis added this turn.
    expect(r.bogusDirection.covered, 'a direction word no walk implements is NOT inside the envelope').toBe(false);
    expect(r.bogusDirection.why, 'and it says why, never a bare false').toContain('no equivalence bridge');
    expect(r.bogusEntry.covered, 'an unimplemented descent is still refused').toBe(false);
    expect(r.bogusStrategy.covered, 'nor is an unimplemented strategy — the new axis did not weaken the old ones').toBe(false);
    expect(r.empty.covered, 'an unset config is the defaults, which are proven').toBe(true);
});

/**
 * THE BOUNDARY CLAUSE EMPTIED — cashed in the emitted program, not in the predicate's own words.
 *
 * t1406's spec asserted the opposite for these two arms (refused, byte-identical to the literal) and this act
 * deliberately turns that around; the remaining clauses are re-asserted here as well, so "the clause emptied" cannot
 * be confused with "the boundary got weaker".
 */
test('THE BOUNDARY — one-way AND otherway ride the atom; every other refusal stands', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (base) => {
        const { pocketStack, pocketRasterGap } = await import('/wizards/pocketWizard.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const arm = (name, over) => {
            const p = { ...base, ...over };
            const t = flattenBlocks(pocketStack(p)).map((b) => b.type);
            const rast = flattenBlocks(pocketStack(p)).find((b) => b.type === 'surfaceraster');
            return { name, gap: pocketRasterGap(p), fill: t.includes('pocketfill'), raster: t.includes('surfaceraster'), dir: rast ? rast.params.direction : null };
        };
        return {
            rides: [arm('one-way raster', { strategy: 'raster', direction: 'oneway' }), arm('other-way raster', { strategy: 'raster', direction: 'otherway' })],
            // a SPIRAL pocket was always eligible whatever direction held — the rings ignore it on both sides
            spiralOneway: arm('spiral + oneway', { strategy: 'spiral', direction: 'oneway' }),
            refused: [
                arm('circle', { shape: 'circle', dia: 50 }),
                arm('polygon', { shape: 'polygon', dia: 50, sides: 6 }),
                arm('ellipse', { shape: 'ellipse', w: 80, h: 60 }),
                arm('a valid rest tool', { restDia: 3 }),
                arm('too small for its tool', { w: 4, h: 4, toolDia: 6 }),
                arm('one-way + a rest tool — a NARROWING clause still wins', { strategy: 'raster', direction: 'oneway', restDia: 3 }),
                arm('one-way on a CIRCLE — still the contour walk', { shape: 'circle', dia: 50, strategy: 'raster', direction: 'oneway' }),
            ],
        };
    }, BASE);

    for (const a of r.rides) {
        expect(a.gap, `${a.name} is no longer refused (gap: "${a.gap}")`).toBe('');
        expect(a.raster, `${a.name} carries the atom`).toBe(true);
        expect(a.fill, `${a.name} no longer emits through the literal pocketfill`).toBe(false);
    }
    // THE WORD REACHES THE SOCKET. The arm being eligible and the request being honoured are two different claims,
    // and building the first without the second is precisely what t1406 refused to do.
    expect(r.rides.map((a) => a.dir), 'and each carries the direction the operator asked for, not a pinned default').toEqual(['oneway', 'otherway']);
    expect(r.spiralOneway.gap, 'a spiral pocket is eligible whatever direction holds — the rings ignore it').toBe('');
    expect(r.spiralOneway.raster, 'and it rides the atom').toBe(true);
    for (const a of r.refused) {
        expect(a.gap, `${a.name} is still refused, with a reason`).not.toBe('');
        expect(a.raster, `${a.name} carries NO surfaceraster`).toBe(false);
    }
});

/**
 * `direction` IS CARRIED AT BUILD, NOT LIVE — asserted as G-CODE, because "the role table says other" would be
 * testing the change against itself.
 *
 * It selects which WALK gets written into the macro text, so it is spent before any register exists. A #var in the
 * socket cannot reach it: it matches neither one-way word and the body comes out both-ways — the DEFAULT walk, which
 * is the safe answer, and never a register printed into a comparison the controller would then evaluate.
 *
 * WHAT IT STOPPED BEING is ARM-DECIDING: `pocketRasterGap` no longer branches on it, so it decides a walk rather than
 * which emitter runs. Both facts are asserted; they are easy to conflate and they fail differently.
 */
test('THE ROLE — a #var in the direction socket does NOT become a register, and the arm no longer turns on it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (base) => {
        const { pocketStack, pocketRasterGap } = await import('/wizards/pocketWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { paramRole } = await import('/data/atomRoles.js');
        const setDir = (stack, v) => {
            const walk = (bs) => { for (const b of (bs || [])) { if (b.type === 'surfaceraster') b.params.direction = v; walk(b.children); walk(b.uiChildren); } };
            walk(stack); return stack;
        };
        const P = { ...base, direction: 'oneway' };
        const live = emitMapped(setDir(pocketStack(P), '#2604')).text;
        const bothways = emitMapped(setDir(pocketStack(P), 'bothways')).text;
        const oneway = emitMapped(pocketStack(P)).text;
        return {
            role: paramRole('surfaceraster', 'direction'),
            registerLeaked: /#2604/.test(live),
            liveIsBothways: live === bothways,
            onewayDiffers: oneway !== bothways,
            // the arm is the same either way — direction decides the WALK now, not the emitter
            gaps: [pocketRasterGap({ ...base, direction: 'bothways' }), pocketRasterGap({ ...base, direction: 'oneway' }), pocketRasterGap({ ...base, direction: 'otherway' })],
        };
    }, BASE);

    expect(r.role, 'the declared role is a discrete selector, spent at build').toBe('other');
    expect(r.registerLeaked, 'a #var in the direction socket never reaches the emitted program').toBe(false);
    expect(r.liveIsBothways, 'it falls to the default walk instead — the safe answer, and the same one an unknown word gets').toBe(true);
    expect(r.onewayDiffers, 'and the comparison is not vacuous: a real one-way word DOES emit a different program').toBe(true);
    expect(r.gaps, 'the arm no longer turns on direction — every word is eligible').toEqual(['', '', '']);
});

/**
 * @work FOLLOWS THE REAL COUNT — calibrated against the emitted body, not asserted as a constant (the t1383 shape).
 *
 * The declaration exists because this atom is ~49 lines whatever the area while the WORK is unbounded, so the tracer's
 * length-sized cap silently truncated the preview a user checks their program against. A one-way row body is a
 * different size from a both-ways one, so a declaration that did not follow the direction would under- or over-state
 * the very thing it exists to state.
 *
 * ── AND THE NUMBER IS NOT THE ONE THE SCOUT PREDICTED, WHICH IS WHY THIS IS MEASURED ──────────────────────────────
 * t1416 predicted 22 per pass (20 + the lift/rapid/plunge triple − the step-over line), assuming the both-ways walk's
 * end-choosing branches survived. They do not: with no direction to flip there is nothing to choose, so four branch
 * lines, the step-over and the `#49` negation all go, and the real body is ELEVEN. Recovered here by differencing the
 * declaration across a one-row change and compared against the emitted row body, so neither can drift from the other.
 */
test('THE DECLARED WORK — the per-pass count is the emitted row body, in every direction', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const A = { x: 0, y: 0, w: 80, h: 60, depth: 3, stepdown: 1.5, toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel', entry: 'plunge' };
        const out = {};
        for (const direction of ['bothways', 'oneway', 'otherway', 'concentric']) {
            const p = direction === 'concentric' ? { ...A, strategy: 'concentric' } : { ...A, direction };
            const L = m.surfaceRasterLines(p);
            // THE EMITTED BODY: the lines strictly inside the pass loop, less the ONE line a plunge descent costs.
            const i = L.findIndex((l) => /DO2/.test(l)), j = L.findIndex((l) => /^\s*END2\s*$/.test(l));
            const measured = (j - i - 1) - 1;
            /**
             * ── t1440 — AND THE EXECUTED COUNT, WHICH IS THE ONE THE DECLARATION IS ABOUT ─────────────────────────
             * The line count above is what you can SEE; a walk's body is full of forks and only one arm of each runs
             * per pass, so the two are different numbers and this test used to compare the declaration against the
             * wrong one. Executed steps come from the engine's own step call, differenced across one more pass.
             */
            const { GcodeExecutionEngine } = await import('/engine/GcodeExecutionEngine.js');
            const runSteps = (q) => {
                const eng = new GcodeExecutionEngine({ autoAnswer: true });
                let n = 0; const orig = eng._executeStep.bind(eng);
                eng._executeStep = (s) => { n++; return orig(s); };
                eng.traceStepCap = 8000000;
                eng.trace(m.surfaceRasterLines(q).join(String.fromCharCode(10)));
                return n;
            };
            // THE DECLARATION, differenced across exactly one more PASS at the same level count. A pass is a row on
            // the parallel walk and a RING on the concentric one, and using the row formula for both is what made
            // this read 0 on the first run — the ring count is driven by the SHORTER side, so growing `h` past 80
            // stopped moving it at all. Each walk is differenced by its own count.
            const passes = (q) => {
                const step = q.toolDia * q.stepoverPct / 100;
                return q.strategy === 'concentric'
                    ? Math.max(1, Math.floor((Math.min(q.w, q.h) - 0.001) / (2 * step)) + 1)
                    : Math.max(1, Math.floor((q.h - step / 2) / step) + 1);
            };
            let big = { ...p }; while (passes(big) === passes(p)) big = { ...big, w: big.w + 0.5, h: big.h + 0.5 };
            const levels = Math.ceil(p.depth / p.stepdown);
            const declared = (m.surfaceRasterWorkSteps(big) - m.surfaceRasterWorkSteps(p)) / (levels * (passes(big) - passes(p)));
            const executed = (runSteps(big) - runSteps(p)) / (levels * (passes(big) - passes(p)));
            out[direction] = { measured, declared, executed, i, j };
        }
        return out;
    });

    /**
     * ── THE SAFETY PROPERTY, AGAINST THE RIGHT NUMBER (restated t1440) ────────────────────────────────────────────
     *
     * The declaration is a CAP on EXECUTED steps, so it may overstate but must never UNDERSTATE — understating is the
     * shipping defect t1383 measured, a preview silently drawing a fraction of the toolpath.
     *
     * IT USED TO BE ASSERTED AGAINST THE EMITTED LINE COUNT, and that was the class defect t1440 swept: a walk's body
     * is full of forks and only one arm of each executes per pass, so the line count is not the executed count and
     * this test was enforcing the very confusion that made the declarations wrong. Comparing against the ENGINE is
     * the correction, and it is a strictly stronger check — the line count is now recorded as context, not criterion.
     */
    for (const [dir, v] of Object.entries(r))
        expect(v.declared, `${dir}: the declared per-pass count (${v.declared}) is never below the EXECUTED count (${v.executed}; its emitted body is ${v.measured} lines)`).toBeGreaterThanOrEqual(v.executed);
    // THE FOUR, EXACT, and both numbers written down so a change to either side has to come here and say what moved.
    // The GAP between them is the finding: 20 lines of both-ways body, 13 of which run on any given pass.
    expect([r.bothways.declared, r.bothways.executed, r.bothways.measured], 'the both-ways row: 20 lines emitted, THIRTEEN executed, declared 13 (was 20 — the t1440 correction)').toEqual([13, 13, 20]);
    expect([r.oneway.declared, r.oneway.executed, r.oneway.measured], 'the one-way row is ELEVEN both ways — it has no end-choosing branch to skip, so its lines and its steps coincide. t1418 counted this one right.').toEqual([11, 11, 11]);
    expect([r.otherway.declared, r.otherway.executed, r.otherway.measured], 'and the mirror is the same size').toEqual([11, 11, 11]);
    expect([r.concentric.declared, r.concentric.executed], 'a concentric ring executes 12, not the 14 declared since t1329').toEqual([12, 12]);
    /**
     * ── THE RING'S OVER-DECLARATION IS FIXED (t1440) — this note is its history line ───────────────────────────────
     *
     * t1418 found `PER_PASS = 14` for concentric against an emitted ring body of 12, named it as pre-existing and in
     * the safe direction, and deliberately left it: moving it moves the declared work of every shipped spiral pocket
     * and every concentric surfacing op, which is its own act. t1440 IS that act, and it corrected more than the
     * instance — the same audit found the both-ways row declaring 20 against 13 executed, and the helix's per-segment
     * cost UNDER-declared, which is the direction that truncates.
     *
     * The line count (12) is kept in the assertion above as CONTEXT: for the ring it happens to equal the executed
     * count, and that coincidence is exactly what made "count the body" look like a valid method for years.
     */
    expect(r.concentric.measured, 'the emitted ring body is 12 lines — and for THIS walk that equals its executed count').toBe(12);
});

/**
 * THE FLOW LABELS AND THE BODY AGREE — the declaration is what `uniquifyFlowLabels` assigns from, so a label declared
 * but not emitted is a number nobody can account for, and a label emitted but not declared is the t1408 defect (two
 * bodies writing the same `N`, and the second op silently not executing).
 *
 * Asserted BOTH WAYS on the emitted text, per direction, because the one-way walk is the first config in this atom to
 * declare a SHORTER row-label list than the walk beside it.
 */
test('THE FLOW LABELS — declared exactly, emitted exactly, in every direction', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const A = { x: 0, y: 0, w: 80, h: 60, depth: 3, stepdown: 1.5, toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel' };
        const ROW_LABELS = { rowStepLabel: 13, rowCutLabel: 14, rowNearLabel: 15, rowEndLabel: 16, rowFarLabel: 17, rowStartLabel: 18 };
        const out = {};
        for (const direction of ['bothways', 'oneway', 'otherway']) for (const entry of ['plunge', 'ramp', 'helix']) {
            const p = { ...A, direction, entry, rampAngle: 3, helixDia: 4, helixPitch: 0.75 };
            const text = m.surfaceRasterLines(p).join('\n');
            const declared = m.surfaceRasterBlock.flowLabels(p);
            // every N the body actually writes
            const emitted = [...new Set((text.match(/^\s*N(\d+)\b/gm) || []).map((s) => +s.trim().slice(1)))].sort((a, b) => a - b);
            const declaredNums = declared.filter((k) => k in ROW_LABELS).map((k) => ROW_LABELS[k]).sort((a, b) => a - b);
            const emittedRowNums = emitted.filter((n) => n >= 13 && n <= 18);
            out[`${direction}/${entry}`] = { declaredRow: declared.filter((k) => k in ROW_LABELS).sort(), declaredNums, emittedRowNums };
        }
        return out;
    });

    for (const [k, v] of Object.entries(r)) {
        expect(v.emittedRowNums, `${k}: every declared row label is emitted, and no undeclared one is`).toEqual(v.declaredNums);
        const oneWay = k.startsWith('oneway') || k.startsWith('otherway');
        expect(v.declaredRow, `${k}: ${oneWay ? 'a one-way walk declares TWO row labels' : 'the both-ways walk declares all six'}`)
            .toEqual(oneWay ? ['rowCutLabel', 'rowStepLabel'] : ['rowCutLabel', 'rowEndLabel', 'rowFarLabel', 'rowNearLabel', 'rowStartLabel', 'rowStepLabel']);
    }
});
