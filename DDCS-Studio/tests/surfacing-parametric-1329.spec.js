import { test, expect } from '@playwright/test';
import { rampDescentRelationship, splitRampDescent, cutBox } from './support/rampRelationship.js';

/**
 * t1329 — THE SURFACING PILOT: the emit becomes PARAMETRIC, and the migration proves itself safe before anything dies.
 *
 * Today a surfacing op unrolls its raster in JavaScript: every row, at every depth, as a literal G1. Thousands of
 * lines that all say the same thing and none of which says why. The parametric emit says the intent instead — named
 * #vars, a depth loop, and a row count derived from the area and the stepover — so changing the tool Ø at the
 * machine re-derives the raster instead of leaving a number computed at a desk.
 *
 * THE EQUIVALENCE BRIDGE IS THE WHOLE SAFETY ARGUMENT: the OLD literal emit at a config and the NEW parametric emit
 * at that same config must EXECUTE THE SAME MOVES. Not "look similar" — the sim runs both and the toolpaths are
 * compared point for point. Only once that holds at the discriminating configs may the old emitter die.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

// THE DISCRIMINATING CONFIGS — chosen where a loop and an unrolled list are most likely to disagree, not where they
// are most likely to match. Even divisions hide off-by-ones; these do not.
const CONFIGS = [
    { name: 'uneven rows — 150 / 7.2 leaves a part row at the far edge', w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 },
    { name: 'SINGLE ROW — the face is narrower than one stepover', w: 120, h: 5, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 },
    { name: 'SINGLE PASS — the depth is exactly one stepdown', w: 80, h: 40, depth: 0.5, stepdown: 0.5, toolDia: 10, stepoverPct: 50, feed: 800, plunge: 150, clearance: 4 },
    { name: 'depth NOT a multiple of stepdown — the last bite is clamped', w: 100, h: 60, depth: 1.1, stepdown: 0.4, toolDia: 8, stepoverPct: 45, feed: 700, plunge: 140, clearance: 6 },
    { name: 'exact division — rows divide evenly, the easy case kept honest', w: 96, h: 72, depth: 1.0, stepdown: 0.5, toolDia: 12, stepoverPct: 50, feed: 1000, plunge: 200, clearance: 5 },
    // t1331 — THE CONFIG THAT CAUGHT THE ROW-COUNT FORMULA. 60 / 7.2 is 8.33: rounding up gives 9 rows and the ninth
    // sits at 61.2, off the far edge, cutting air. The true count is how many rows at step/2 + i·step FIT INSIDE the
    // area. The five configs above all happen to be ones where the two formulas agree — which is precisely how a
    // bridge with a well-chosen-looking config set can still pass over a real bug.
    { name: 'ROW COUNT — 60 / 7.2 rounds up to a row that does not fit', w: 100, h: 60, depth: 1.0, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 },
];

test('THE HEADER SPEAKS, AND THE LOOPS COUNT THEMSELVES', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines, RASTER_SCRATCH } = await import('/wizards/ops/surfaceraster.js');
        const body = surfaceRasterLines({ w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 }).join('\n');
        return { body, band: RASTER_SCRATCH };
    });
    // EVERY HEADER VAR SPEAKS (the lathe comment discipline). Scoped to the HEADER — the block before the first loop
    // — because that is where the discipline earns its keep: those vars are the operator's dials, and one without a
    // stated meaning is a number nobody can safely change. A loop counter in the body (`#46=[#46 + #43]`) is
    // machinery, and commenting every increment would bury the header it exists to protect.
    const header = r.body.split('WHILE')[0];
    const assigns = header.split('\n').filter((l) => /^\s*#\d+\s*=/.test(l));
    expect(assigns.length, 'the header really does declare the job').toBeGreaterThan(4);
    for (const line of assigns) {
        expect(line, `every header var says what it is: ${line}`).toMatch(/\(.*\)|;/);
    }
    // THE COUNT IS DERIVED, not written out — this is the difference between a program and a transcript
    expect(r.body, 'rows are counted from the area and the stepover — the ones that FIT').toMatch(/#45=\[FIX\[\[#41 - #44 \/ 2\] \/ #44\] \+ 1\]/);
    expect(r.body, 'and the stepover is itself derived from tool Ø × %, the same way the CAM does it').toMatch(/#44=\[12 \* 60 \/ 100\]/);
    // THE LOOPS: depth outside, rows inside — the parting-peck shape
    expect(r.body, 'a depth loop').toMatch(/WHILE \[#46 < #42\] DO1/);
    expect(r.body, 'with the row loop nested inside it').toMatch(/WHILE \[#48 < #45\] DO2/);
    expect(r.body.indexOf('DO2')).toBeGreaterThan(r.body.indexOf('DO1'));
    expect(r.body.indexOf('END2')).toBeLessThan(r.body.indexOf('END1'));
    // A ZERO STEPOVER DIVIDES BY ZERO and a zero stepdown loops forever — refused cleanly, not left to the machine
    expect(r.body).toMatch(/IF #44 <= 0 GOTO91/);
    expect(r.body).toMatch(/IF #43 <= 0 GOTO91/);
    expect(r.body, 'with a named error, not a silent halt').toMatch(/ERROR: stepover \/ stepdown/);
    // THE BAND IS DECLARED AS DATA, so the collision guard reads it instead of re-deriving it from the text
    // t1343 — the band extended DOWN to #34 for the helix recurrence's rotating vector, temp and counters. Still
    // one declared contiguous range, still clear of camMacroKit's kit band (#27–#33) and the probe temps (#50–#61).
    expect(r.band, 'the scratch band is declared on the atom — t1355 adds the skim frame trio').toEqual([[34, 49], [62, 64]]);
});

test('EVERY SCRATCH VAR IS ASSIGNED IN ONE PLACE — t1325’s lesson, asserted not remembered', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines, RASTER_SCRATCH } = await import('/wizards/ops/surfaceraster.js');
        const lines = surfaceRasterLines({ w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60 });
        const used = new Set();
        for (const l of lines) for (const m of l.matchAll(/#(\d+)/g)) used.add(Number(m[1]));
        // where each var is ASSIGNED (the left of an =), counted
        const assignedAt = {};
        lines.forEach((l, i) => { const m = l.match(/^\s*#(\d+)\s*=/); if (m) (assignedAt[m[1]] = assignedAt[m[1]] || []).push(i); });
        return { used: [...used].sort((a, b) => a - b), assignedAt, band: RASTER_SCRATCH };
    });
    // NOTHING OUTSIDE THE DECLARED BAND (bar #1505, the controller's own operator-message register)
    const [lo, hi] = r.band[0];
    const stray = r.used.filter((v) => (v < lo || v > hi) && v !== 1505);
    expect(stray, `every var used is inside the declared band ${lo}-${hi}: strays ${JSON.stringify(stray)}`).toEqual([]);
    // …AND THE LOOP COUNTERS ARE THE ONLY THINGS WRITTEN MORE THAN ONCE. The rest are header facts: assigned once,
    // read many times. A header var written twice is exactly how the CAM stepover was silently clobbered.
    const HEADER = ['40', '41', '42', '43', '44', '45'];
    for (const v of HEADER) {
        expect((r.assignedAt[v] || []).length, `#${v} is a header fact — assigned exactly once`).toBe(1);
    }
});

for (const cfg of CONFIGS) {
    test(`EQUIVALENCE — ${cfg.name}`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async (cfg) => {
            const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
            const { emitProgram } = await import('/blocks/blockEmitter.js');
            const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
            const { traceToolpath } = await import('/engine/trace.js');
            const NL = String.fromCharCode(10);

            // THE OLD PATH, exactly as it ships today: the literal unrolled raster.
            const oldText = String(emitProgram(surfacingLiteralStack(cfg)));
            // THE NEW PATH: the parametric body, run through the same tracer. Framed the same way (absolute, at the
            // WCS origin) so the comparison is about the RASTER and nothing else.
            const newText = ['G90', ...surfaceRasterLines(cfg), 'M30'].join(NL);

            // …and both EXECUTED. A text diff would prove nothing here — the whole point is that one is a loop and
            // the other is a list, so they must agree in MOTION, not in shape.
            const moves = (nc) => (traceToolpath(nc).segments || [])
                .filter((s) => !s.rapid || true)
                .map((s) => [+s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3), !!s.rapid]);
            // t1377 — THE FEED JOINS THE TUPLE. Every comparison in this file walked positions only, and a whole class
            // of defect lived in that gap: the modal-feed fold was blind to flow, so the first row of every depth level
            // executed at the PLUNGE feed and every bridge here passed. A move is WHERE and HOW FAST; comparing only
            // where is comparing half a program.
            const cut = (nc) => (traceToolpath(nc).segments || [])
                .filter((s) => !s.rapid)
                .map((s) => [+s.x1.toFixed(3), +s.y1.toFixed(3), +s.z1.toFixed(3), +s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3), +Number(s.feed || 0).toFixed(3)]);
            return { oldLines: oldText.split(NL).length, newLines: newText.split(NL).length,
                oldCut: cut(oldText), newCut: cut(newText), oldAll: moves(oldText).length, newAll: moves(newText).length };
        }, cfg);

        // THE PARAMETRIC EMIT'S LENGTH DOES NOT DEPEND ON THE JOB. A loop has fixed overhead, so on a tiny face it is
        // LONGER than the handful of literal moves it replaces — claiming "always shorter" would have been false, and
        // the small-config case said so on the first run. The real property is constancy, asserted across configs below.
        expect(r.newLines, 'the parametric body is a fixed size').toBeGreaterThan(0);
        // BOTH ACTUALLY CUT SOMETHING (a pair of empty programs would "match" perfectly)
        expect(r.oldCut.length, 'the literal emit cuts').toBeGreaterThan(0);
        expect(r.newCut.length, 'and so does the parametric one').toBeGreaterThan(0);
        // THE CUTTING MOVES ARE THE SAME MOVES — point for point, in order
        expect(r.newCut.length, `same number of cutting moves (literal ${r.oldCut.length}, parametric ${r.newCut.length})`).toBe(r.oldCut.length);
        expect(r.newCut, 'and every cutting move is identical, in order').toEqual(r.oldCut);
    });
}

test('THE SIM EXECUTES THE LOOP — the moves come from running it, not from reading it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const nc = ['G90', ...surfaceRasterLines({ w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 }), 'M30'].join(NL);
        const t = traceToolpath(nc);
        const cuts = (t.segments || []).filter((s) => !s.rapid);
        const ys = [...new Set(cuts.map((s) => +s.y2.toFixed(3)))];
        const zs = [...new Set(cuts.map((s) => +s.z2.toFixed(3)))];
        return { total: (t.segments || []).length, cuts: cuts.length, rows: ys.length, levels: zs.length, zs: zs.sort((a, b) => b - a), capped: !!(t.stats && t.stats.capped) };
    });
    // 150mm of area at a 7.2mm stepover is 21 rows; 0.8 of depth at 0.4 is 2 levels — the loop produced BOTH counts
    // by counting, and the sim walked every one of them.
    expect(r.rows, `the row loop really ran: ${r.rows} distinct rows`).toBe(21);
    expect(r.levels, `and the depth loop nested inside it: ${JSON.stringify(r.zs)}`).toBe(2);
    expect(r.zs, 'at the levels the header says, the last clamped to the total depth').toEqual([-0.4, -0.8]);
    // per level: one plunge, 21 cutting rows, 20 step-overs AT DEPTH (the tool never lifts between rows) → 42 each
    expect(r.cuts, 'a plunge, a cut per row, and a step-over between rows — twice over').toBe(84);
    expect(r.capped, 'and it finished on its own — no step cap hit').toBe(false);
});


test('THE EMIT IS A FIXED SIZE — the literal one grows with the job, this one does not', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const NL = String.fromCharCode(10);
        const small = { w: 80, h: 40, depth: 0.5, stepdown: 0.5, toolDia: 10, stepoverPct: 50, feed: 800, plunge: 150, clearance: 4 };
        const big = { ...small, w: 600, h: 400, depth: 3, stepdown: 0.3 };
        return {
            oldSmall: String(emitProgram(surfacingLiteralStack(small))).split(NL).length,
            oldBig: String(emitProgram(surfacingLiteralStack(big))).split(NL).length,
            newSmall: surfaceRasterLines(small).length,
            newBig: surfaceRasterLines(big).length,
        };
    });
    // THE LITERAL EMIT GROWS WITH THE WORK — a bigger face is a bigger file, line by line
    expect(r.oldBig, `literal: ${r.oldSmall} lines small → ${r.oldBig} big`).toBeGreaterThan(r.oldSmall * 10);
    // THE PARAMETRIC ONE IS THE SAME PROGRAM EITHER WAY — the numbers in the header change, nothing else does
    expect(r.newBig, `parametric: ${r.newSmall} lines small → ${r.newBig} big`).toBe(r.newSmall);
    // …which is the point: on a real job it is orders of magnitude smaller, and it stays READABLE
    expect(r.newBig).toBeLessThan(r.oldBig / 20);
});

/**
 * t1331 — THE COVERAGE BOUNDARY, declared and asserted rather than discovered on the day the old emitter dies.
 *
 * The switch-over cannot retire the literal emitter yet, and this is why, in numbers: the wizard offers concentric
 * rings, ramp and helix descents, a one-way raster and a confirm-every-N halt, and the parametric atom implements
 * the default both-ways parallel plunge raster. Those others are DIFFERENT TOOLPATHS — concentric emits 50 cutting
 * moves where the raster emits 36, helix 80 — not rounding differences that could be waved through.
 *
 * Asserting the boundary is what stops it being forgotten: the day someone teaches the atom concentric rings, this
 * spec fails and tells them to move the line.
 */
test('THE COVERED ENVELOPE IS DECLARED — and everything outside it is named, not silently dropped', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterCovers, surfaceRasterGap } = await import('/wizards/ops/surfaceraster.js');
        const base = { strategy: 'parallel', entry: 'plunge', direction: 'bothways', confirmEvery: 0 };
        const probe = (extra) => ({ covered: surfaceRasterCovers({ ...base, ...extra }), why: surfaceRasterGap({ ...base, ...extra }) });
        return {
            dflt: probe({}),
            empty: { covered: surfaceRasterCovers({}), why: surfaceRasterGap({}) },   // an unset config is the default
            concentric: probe({ strategy: 'concentric' }),
            ramp: probe({ entry: 'ramp' }),
            helix: probe({ entry: 'helix' }),
            oneway: probe({ direction: 'oneway' }),
            confirm: probe({ confirmEvery: 2 }),
        };
    });
    // THE DEFAULT IS COVERED — which is why the bridge could prove the common case end to end
    expect(r.dflt.covered, 'a both-ways parallel plunge raster is inside the proven envelope').toBe(true);
    expect(r.empty.covered, 'and so is an unset config, because those ARE the defaults').toBe(true);
    expect(r.concentric.covered, 't1333 — concentric rings, proven move-for-move').toBe(true);
    expect(r.oneway.covered, 'and one-way was never a gap: the op hard-codes both-ways').toBe(true);
    expect(r.ramp.covered, 't1339 — the ramp descent').toBe(true);
    expect(r.helix.covered, 't1345 — and the helix, within one emit quantum').toBe(true);
    // EVERYTHING ELSE IS OUTSIDE IT, AND SAYS WHY. A bare `false` here would be the silent drop this exists to prevent.
    // t1333 — RESTATED: concentric closed this turn, and one-way was never a real gap (the op hard-codes
    // both-ways — see the correction above). What is left outside the envelope is the descent and the pause.
    // t1345 — RESTATED once more, and finally: the descent closed too, so nothing is outside.
    expect(r.confirm.covered, 'the confirm cadence is covered').toBe(true);
    for (const k of ['ramp', 'helix']) {
        expect(r[k].covered, `${k} is covered now — the envelope is empty`).toBe(true);
        // t1345 — the reason is now EMPTY for every one of them, because there is no gap left to explain. The
        // requirement it encoded (a refusal must say why, never a bare false) held for every day one existed.
        expect(r[k].why, `${k} has no gap left to name`).toBe('');
    }
    expect(r.helix.why, 'nothing left to name').toBe('');
});

test('THE GAP IS REAL, MEASURED — the uncovered cases are different programs, not near-misses', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const base = { w: 100, h: 60, depth: 1.0, stepdown: 0.5, toolDia: 12, stepoverPct: 60, stepover: 7.2, feed: 900, plunge: 180, clearance: 5 };
        const cuts = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid).length;
        const pair = (extra) => {
            const cfg = { ...base, ...extra };
            return { literal: cuts(String(emitProgram(surfacingLiteralStack(cfg)))), parametric: cuts(['G90', ...surfaceRasterLines(cfg), 'M30'].join(NL)) };
        };
        return { covered: pair({}), concentric: pair({ strategy: 'concentric' }), helix: pair({ entry: 'helix', helixDia: 8, helixPitch: 1 }) };
    });
    // INSIDE the envelope the two agree exactly — that is the whole equivalence argument, restated on this config
    expect(r.covered.parametric, `covered: literal ${r.covered.literal} vs parametric ${r.covered.parametric}`).toBe(r.covered.literal);
    // OUTSIDE it they are not close, which is the point: switching wholesale would not be a small regression, it
    // would be a different cut. The numbers are in the spec so nobody has to take the boundary on trust.
    // t1333 — RESTATED: concentric was 50-vs-36 when the atom could not walk rings. It walks them now, so the two
    // AGREE — the gap closed rather than the assert being dropped, which is what closing a gap should look like.
    expect(r.concentric.parametric, `concentric now agrees: literal ${r.concentric.literal} vs ${r.concentric.parametric}`).toBe(r.concentric.literal);
    // t1345 — RESTATED, the concentric pattern again: the helix gap closed, so this flips from "differs by a lot"
    // to equality. Every measured gap in this arc has ended as an assert that changed sides.
    expect(r.helix.parametric, `the helix now agrees too: literal ${r.helix.literal} vs ${r.helix.parametric}`).toBe(r.helix.literal);
});

/**
 * t1333 — COVERAGE: CONCENTRIC RINGS and the ONE-WAY RASTER, each with its own bridge.
 *
 * The configs are chosen ADVERSARIALLY, at the boundaries where the formulas can disagree, not in the interiors
 * where they cannot — the lesson from the row-count bug, where five reasonable-looking configs all happened to sit
 * where a wrong formula coincides with the right one.
 */
const RING_CONFIGS = [
    // the middle closes EXACTLY on a ring boundary: h = 2·k·step, where the k-th ring has zero height and must not
    // be walked at all (the literal kernel breaks on `bx-ax < 1e-6`; the count must agree without being told)
    { name: 'RINGS — the middle collapses exactly on a boundary', w: 100, h: 28.8, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 },
    // a face so small only ONE ring fits
    { name: 'RINGS — a single ring, the middle closes immediately', w: 40, h: 12, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 },
    // the inset does NOT divide the short side evenly — the common case, and the one where an off-by-one hides
    { name: 'RINGS — inset does not divide the short side evenly', w: 120, h: 65, depth: 1.0, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 },
    // square: both sides run out together
    { name: 'RINGS — square, both sides close at once', w: 80, h: 80, depth: 0.5, stepdown: 0.5, toolDia: 10, stepoverPct: 50, feed: 800, plunge: 150, clearance: 4 },
];


const bridge = (page, cfg) => page.evaluate(async (cfg) => {
    const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const NL = String.fromCharCode(10);
    const oldText = String(emitProgram(surfacingLiteralStack(cfg)));
    const newText = ['G90', ...surfaceRasterLines(cfg), 'M30'].join(NL);
    // t1377 — (position, FEED) per move: see the note on the first bridge above. A move is where AND how fast.
    const cut = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid)
        .map((s) => [+s.x1.toFixed(3), +s.y1.toFixed(3), +s.z1.toFixed(3), +s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3), +Number(s.feed || 0).toFixed(3)]);
    return { oldCut: cut(oldText), newCut: cut(newText) };
}, cfg);

for (const cfg of RING_CONFIGS) {
    test(`EQUIVALENCE (concentric) — ${cfg.name}`, async ({ page }) => {
        await boot(page);
        const r = await bridge(page, { ...cfg, strategy: 'concentric' });
        expect(r.oldCut.length, 'the literal ring kernel cuts something').toBeGreaterThan(0);
        expect(r.newCut.length, `same number of cutting moves (literal ${r.oldCut.length}, parametric ${r.newCut.length})`).toBe(r.oldCut.length);
        expect(r.newCut, 'and every cutting move is identical, in order — rings included').toEqual(r.oldCut);
    });
}

/**
 * t1333 — A CORRECTION TO MY OWN t1331 FINDING, asserted so it cannot drift back.
 *
 * t1331 listed `direction: 'oneway'` as one of four uncovered gaps, measured by handing the param to both emitters.
 * That measurement was wrong about the OP: `surfacingStack` hard-codes `direction: 'bothways'` on the fill block, so
 * no surfacing config can reach a one-way raster. A parametric one-way walk was written for it and then DELETED —
 * machinery for a case this op does not have. What follows pins the reason, so nobody re-adds it from the old note.
 */
test('ONE-WAY IS NOT A SURFACING GAP — the op hard-codes both-ways, so no config reaches it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
        const flat = (st, out = []) => { for (const b of (st || [])) { out.push(b); flat(b.children, out); flat(b.uiChildren, out); } return out; };
        // ask the op for a one-way raster, the way my t1331 measurement did…
        const asked = flat(surfacingLiteralStack({ w: 100, h: 60, direction: 'oneway' })).find((b) => b.type === 'surfacefill');
        const dflt = flat(surfacingLiteralStack({ w: 100, h: 60 })).find((b) => b.type === 'surfacefill');
        return { asked: asked && asked.params.direction, dflt: dflt && dflt.params.direction };
    });
    // …and the op ignores it. The param never reaches the emit, so there was never a gap to close.
    expect(r.dflt, 'surfacing always fills both ways').toBe('bothways');
    expect(r.asked, 'asking for one-way changes nothing — the op does not offer it').toBe('bothways');
});


test('THE ENVELOPE SHRANK — concentric and one-way are inside it now, and what remains is NAMED', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterCovers, surfaceRasterGap } = await import('/wizards/ops/surfaceraster.js');
        const probe = (extra) => ({ covered: surfaceRasterCovers(extra), why: surfaceRasterGap(extra) });
        return {
            concentric: probe({ strategy: 'concentric' }),
            oneway: probe({ direction: 'oneway' }),
            otherway: probe({ direction: 'otherway' }),
            ramp: probe({ entry: 'ramp' }),
            helix: probe({ entry: 'helix' }),
            confirm: probe({ confirmEvery: 2 }),
        };
    });
    // CLOSED THIS TURN — proven move-for-move above, so the predicate stops excluding them
    expect(r.concentric.covered, 'concentric rings are covered now').toBe(true);
    expect(r.oneway.covered, 'and the one-way raster').toBe(true);
    expect(r.otherway.covered, 'including its from-the-far-side variant').toBe(true);
    // t1345 — FLIPPED, the last of them: the descent closed, so the predicate is empty and every one of these is in.
    // The history is the point — each line here named a real gap on the day it was written.
    expect(r.ramp.covered, 'the ramp descent closed at t1339').toBe(true);
    expect(r.helix.covered, 'and the helix at t1343-45').toBe(true);
    expect(r.confirm.covered, 'the confirm cadence at t1335').toBe(true);
    for (const k of ['ramp', 'helix', 'confirm']) {
        expect(r[k].why, `${k} names no gap any more`).toBe('');
    }
});

/**
 * t1335 — REACHABILITY FIRST (the rule the one-way correction turned into a method), then the pause.
 */
test('REACHABILITY — the op really can emit these, unlike direction', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
        const flat = (st, out = []) => { for (const b of (st || [])) { out.push(b); flat(b.children, out); flat(b.uiChildren, out); } return out; };
        const fill = (p) => flat(surfacingLiteralStack(p)).find((b) => b.type === 'surfacefill');
        const down = (p) => flat(surfacingLiteralStack(p)).find((b) => b.type === 'stepdown');
        return {
            ramp: fill({ w: 100, h: 60, entry: 'ramp', rampAngle: 3 }).params.entry,
            helix: fill({ w: 100, h: 60, entry: 'helix', helixDia: 8, helixPitch: 1 }).params.entry,
            confirm: down({ w: 100, h: 60, confirmEvery: 2 }).params.confirmEvery,
        };
    });
    // Each of these DOES reach the emit — checked before building for them, which is what the one-way artifact taught.
    expect(r.ramp, 'a ramp entry reaches the fill block').toBe('ramp');
    expect(r.helix, 'and a helix entry').toBe('helix');
    expect(r.confirm, 'and the confirm cadence reaches the stepdown').toBe(2);
});

test('THE TRACER EXECUTES VARIABLE-FED ARCS — measured, because a gap there would outlive surfacing', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const pts = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid).map((s) => [+s.x2.toFixed(2), +s.y2.toFixed(2), +Number(s.feed || 0).toFixed(3)]);   // t1377 — feed included: a var-fed arc must also arrive at the right SPEED
        return {
            literal: pts(['G90', 'G0 X0 Y0', 'G1 Z-1 F100', 'G2 X20 Y0 I10 J0 F200', 'M30'].join(NL)),
            fromVars: pts(['G90', '#40=10', '#41=20', 'G0 X0 Y0', 'G1 Z-1 F100', 'G2 X#41 Y0 I#40 J0 F200', 'M30'].join(NL)),
        };
    });
    // A NEGATIVE FINDING WOULD HAVE BEEN THE REPORT. It is positive: an arc whose endpoint AND centre offset come
    // from #vars traces exactly as the literal one does, so nothing in the parametric arc idea is blocked by the sim.
    expect(r.literal.length, 'the literal arc traces as a real curve').toBeGreaterThan(20);
    expect(r.fromVars, 'and the variable-fed arc is identical, point for point').toEqual(r.literal);
});

for (const N of [1, 2, 3, 9]) {
    test(`CONFIRM EVERY ${N} — the pause lands on the right levels and never on the last`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async ({ N }) => {
            const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
            const { emitProgram } = await import('/blocks/blockEmitter.js');
            const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
            const NL = String.fromCharCode(10);
            // depth 1.5 / stepdown 0.5 = 3 levels, so N=1,2,3 and N>total are all distinguishable
            const cfg = { w: 100, h: 60, depth: 1.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5, confirmEvery: N };
            const count = (t) => (t.match(/^\s*M0+\b/gm) || []).length;
            return { literal: count(String(emitProgram(surfacingLiteralStack(cfg)))), parametric: surfaceRasterLines(cfg).join(NL) };
        }, { N });
        // THE WORD IS THE MACHINE'S, matched not modernised: M00 with the operator sentence the literal path uses
        expect(r.parametric, 'the pause is M00, the same word the literal path emits').toMatch(/M00\s+\( pause - press Cycle Start to resume \)/);
        // …and it is GUARDED so the last level never pauses — a halt on a finished part is a call to the shop floor
        expect(r.parametric, 'the last pass is exempted').toMatch(/IF #46 >= #42 GOTO31/);
        // the cadence test is a modulo written as "does N divide the level index" — no MOD in this dialect
        expect(r.parametric, 'and the cadence is a real divisibility test, not an unrolled list').toMatch(/FIX\[#48 \/ /);
    });
}

test('CONFIRM-EVERY IS INSIDE THE ENVELOPE NOW — and only the descent is left', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterCovers, surfaceRasterGap } = await import('/wizards/ops/surfaceraster.js');
        return {
            confirm: { covered: surfaceRasterCovers({ confirmEvery: 3 }), why: surfaceRasterGap({ confirmEvery: 3 }) },
            ramp: { covered: surfaceRasterCovers({ entry: 'ramp' }), why: surfaceRasterGap({ entry: 'ramp' }) },
            helix: { covered: surfaceRasterCovers({ entry: 'helix' }), why: surfaceRasterGap({ entry: 'helix' }) },
        };
    });
    // FLIPPED TO COVERED, the concentric pattern — the assert changed sides rather than being deleted
    expect(r.confirm.covered, 'the confirm cadence is covered now').toBe(true);
    expect(r.confirm.why, 'so it names no gap').toBe('');
    // THE ENVELOPE DOES NOT END EMPTY, and says exactly what is left and why
    expect(r.ramp.covered, 'closed at t1339').toBe(true);
    expect(r.helix.covered, 'closed at t1343-45').toBe(true);
    expect(r.ramp.why, 'and names no remaining gap').toBe('');
});

/**
 * t1339 — THE RAMP DESCENT, migration-true at build values.
 */
const RAMP_CONFIGS = [
    { name: 'RAMP — a shallow angle needs more run than the area gives (degrades to plunge, with its reason)', w: 40, h: 30, depth: 1.0, stepdown: 0.5, rampAngle: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 },
    { name: 'RAMP — a steep angle fits easily', w: 200, h: 150, depth: 1.0, stepdown: 0.5, rampAngle: 30, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 },
    { name: 'RAMP — the ordinary 3 degrees on a real face', w: 200, h: 150, depth: 0.8, stepdown: 0.4, rampAngle: 3, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 },
];

for (const cfg of RAMP_CONFIGS) {
    test(`EQUIVALENCE (ramp) — ${cfg.name}`, async ({ page }) => {
        await boot(page);
        const r = await bridge(page, { ...cfg, entry: 'ramp' });
        expect(r.oldCut.length, 'the literal ramp path cuts something').toBeGreaterThan(0);
        expect(r.newCut.length, `same number of cutting moves (literal ${r.oldCut.length}, parametric ${r.newCut.length})`).toBe(r.oldCut.length);
        /**
         * ⚠ t1487 — RESTATED, NOT RETIRED (ruled t1486). This asserted the whole path including the ramp, and C4
         * points the ramp along the ROW rather than at the area centre (t1483/t1485; t1339 named the reason — the
         * centre-ward ramp bakes a hypotenuse and SQRT is unverified here). The move count above is unchanged and
         * still asserted; what moved is WHICH way two moves per level point.
         */
        const L = splitRampDescent(r.oldCut), P = splitRampDescent(r.newCut);
        expect(P.walk, 'OUTSIDE the descent every cutting move is identical, in order').toEqual(L.walk);
        if (L.pairs.length) {
            const rel = rampDescentRelationship(r.oldCut, r.newCut, { bbox: cutBox(r.oldCut) });
            expect(rel.ok, `and the descent holds its declared relationship to the literal — ${rel.why}`).toBe(true);
        } else {
            // the shallow-angle config: the run does not fit, so BOTH sides degrade to a plunge and there is no
            // descent to restate. That case stays exact, move for move, and saying so keeps the restatement honest.
            expect(r.newCut, 'a ramp that cannot fit degrades on both sides — still identical, move for move').toEqual(r.oldCut);
        }
    });
}

test('THE RAMP BAKES ONLY WHAT CANNOT MOVE — and says what that costs', async ({ page }) => {
    await boot(page);
    const body = await page.evaluate(async () => {
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        return surfaceRasterLines({ w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, entry: 'ramp', rampAngle: 3, feed: 900, plunge: 180, clearance: 5 }).join('\n');
    });
    // THE RUN IS LIVE off the per-level bite; only the TANGENT is baked, because the angle is a form field and not a
    // knob anyone can turn at the machine.
    //
    // t1375 — THE RUN MOVED FROM #49 TO #34, and pinning the register here is what caught it, so the pin stays. #49 was
    // shared with the row DIRECTION on the grounds that the two never overlap; they do, and the sharing only ever
    // worked because nothing read more than #49's SIGN. The rotated step-over needs the direction's value, so the two
    // quantities are separated. #34 belongs to the DESCENT, and a descent is exactly one of plunge/ramp/helix, so the
    // ramp's run and the helix's rotating vector can never be live together — a sharing that mutual exclusion actually
    // justifies. The ramp's resolved motion is unchanged, which the EQUIVALENCE (ramp) bridges above assert.
    expect(body, 'the run is computed from the live bite').toMatch(/#34=\[#43 \* [\d.]+\]/);
    expect(body, 'and the DIRECTION slot is no longer overwritten by it — #49 is only ever ±1').not.toMatch(/#49=\[#43 \*/);
    expect(body, 'and the tangent is baked, with the reason on the line').toMatch(/tangent is baked; the angle is a form field/);
    // THE HONEST DEGRADE survives the migration: when the run does not fit, the tool plunges and the program says so
    expect(body, 'a ramp that cannot fit degrades').toMatch(/GOTO41/);
    expect(body, 'to a straight plunge, named').toMatch(/the ramp did not fit — straight plunge/);
});

/**
 * t1341 — THE PENDANT GATE. The descent bakes part of its geometry (see rampLines); that is safe on the wizard
 * path, where the text is fixed forever at build values, and unsafe under a pendant that can move the knobs the
 * raster re-derives from. So a helix slot refuses to expose them — greyed with the reason, never hidden.
 *
 * ── ⚠ t1487 — THE RAMP CROSSED TO THE OTHER SIDE OF THIS GATE, and the inversion is the point ────────────────────
 *
 * This test read "a ramp/helix slot refuses", and for the ramp that premise is gone rather than reworded: C4
 * (t1483/t1485) gives the ramp a declared run vector against LIVE span registers and a start on the live row
 * register, so a ramp slot bakes NO geometry and there is nothing a pendant can kink. `SURFACE_RASTER_BAKES` says
 * so with two empty rows, `opCamMap`'s gate narrowed to helix alone, and this is where that has to show.
 *
 * ⚠ THE HELIX IS ASSERTED UNMOVED IN THE SAME TEST — deliberately, and it is the same shape t1483 used for the
 * raster-live PROOF 3 transition. A capability that lifted one descent and quietly carried the other with it would
 * read identically from outside; asserting both here is what makes the lift a claim about the ramp specifically.
 * The helix still bakes the inradius that clamps its radius and seeds the rotating vector (t1343), so it still
 * refuses, still with the reason on the control.
 */
test('THE ENTRY GATE — a HELIX slot refuses the knobs that would kink its descent; the RAMP no longer needs to', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { seedFromOp, ENTRY_GEOMETRY_KNOBS, ENTRY_GATE_REASON } = await import('/data/opCamMap.js');
        const base = { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5, rpm: 12000 };
        const pick = (params) => {
            const s = seedFromOp({ opType: 'surfacing', params });
            const out = {};
            for (const f of (s.fields || [])) out[f.key] = { exposable: f.exposable, exposed: f.exposed, tip: f._exposeTip };
            return out;
        };
        return { plunge: pick(base), ramp: pick({ ...base, entry: 'ramp', rampAngle: 3 }), helix: pick({ ...base, entry: 'helix', helixDia: 8, helixPitch: 1 }), knobs: ENTRY_GEOMETRY_KNOBS, reason: ENTRY_GATE_REASON };
    });
    // A PLUNGE SLOT KEEPS FULL EXPOSURE — a straight drop has no geometry to kink, so nothing is taken away.
    // t1487 — AND A RAMP SLOT NOW SITS BESIDE IT, for the same reason arrived at a different way: it bakes nothing.
    for (const entry of ['plunge', 'ramp']) {
        for (const k of r.knobs) {
            expect(r[entry][k].exposable, `${k} stays exposable on a ${entry} slot — it bakes no geometry to kink`).not.toBe(false);
        }
    }
    // A HELIX SLOT REFUSES EXACTLY THOSE TWO, with the reason ON the control — unmoved by the ramp's lift
    for (const entry of ['helix']) {
        for (const k of r.knobs) {
            expect(r[entry][k].exposable, `${entry}: ${k} is refused`).toBe(false);
            expect(r[entry][k].tip, `${entry}: ${k} carries the reason`).toBe(r.reason);
        }
        // …and NOTHING ELSE is taken away: the gate is narrow, not a blanket lockdown of the slot
        expect(r[entry].feed.exposable, `${entry}: the feed is still the operator's`).not.toBe(false);
        expect(r[entry].depth.exposable, `${entry}: and so is the depth`).not.toBe(false);
    }
    expect(r.reason, 'the reason says what and why, not just no').toMatch(/entry geometry.*baked when built/i);
});

/**
 * t1345 · CONSOLIDATED t1353 — THE HELIX BRIDGE, and THE ARC'S LEDGER.
 *
 * ══ THE MIGRATION'S STATED EXCEPTIONS TO ITS "EXACT" CLAIM ═══════════════════════════════════════════════════════
 * Everything in this migration is move-for-move identical to the literal emitter EXCEPT the two entries below. They
 * live together, in one block, deliberately: the value of a stated exception is that a reader can find ALL of them
 * in one place and count them. An exception recorded next to whichever test happened to discover it is an exception
 * that gets missed. Both are RULED, not assumed, and each points at the bridge that asserts it.
 *
 * ── EXCEPTION 1 (t1343/t1345) — THE HELIX ENTRY, by at most one emit quantum ─────────────────────────────────────
 *   The helix entry differs from the literal by at most ONE EMIT QUANTUM (0.001mm) per point, ALWAYS TOWARD THE
 *   IDEAL, because the literal applies r3() to every point as it generates it and reproducing that mid-generation
 *   rounding would gate a strictly better number behind ROUND — a function this controller has not been verified
 *   to have.
 *
 * The tolerance is one quantum because the emit expresses three decimals: two programs whose points sit within one
 * quantum are indistinguishable at the only precision the machine is ever told about. The measured worst case is
 * 0.00028mm — 3.5× inside it. It licenses MAGNITUDE ONLY: count and order are still exact, and "closer to the ideal"
 * is asserted as arithmetic rather than left as an editorial claim. Asserted by: THE HELIX BRIDGE, immediately below.
 *
 * ── EXCEPTION 2 (t1351/t1353) — THE FIRST PLUNGE'S APPROACH HEIGHT, under a non-zero offZ ────────────────────────
 *   With a placement offZ, the atom's first plunge STARTS higher than the literal's — and the atom is the correct
 *   one. The literal's opening clearance rapid comes from progstart, which sits OUTSIDE placeonstock and so never
 *   learns about offZ: it rapids to an absolute Z<clearance> whatever surface the op was placed on. Measured at
 *   offZ 6 with a 5mm clearance, the shipping literal rapids to Z5 with the faced surface at Z6 — traversing to the
 *   first row one millimetre INSIDE the material. The atom measures clearance from the surface it faces.
 *
 * THIS ONE IS NOT A TOLERANCE, and that is why it is worded differently. It is not a rounding artefact and not a
 * magnitude the two paths merely disagree about: it is a DEFECT IN THE LITERAL that the migration declines to
 * reproduce. USER/ADVISOR RULING (t1353): the atom is sanctioned — clearance measured from the surface it faces is
 * what the word means — and the literal is NOT patched in the interim, because the switch retires that emitter and
 * carries the fix with it. Every cut still ENDS where the literal's ends; exactly one move differs.
 * Asserted by: the PLACEMENT bridges (`PLACEMENT (…) — NON-ZERO offZ …` and the negative/off-grid frames).
 *
 * ══ Two exceptions, both stated, both bridged. A third would need its own ruling before it could be added here. ══
 */
test('THE HELIX BRIDGE — within one emit quantum, never farther from the ideal, and structurally identical', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const cfg = { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5, entry: 'helix', helixDia: 8, helixPitch: 1 };
        const cuts = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid).map((s) => ({ x: s.x2, y: s.y2, z: s.z2, f: +Number(s.feed || 0).toFixed(3) }));
        const lit = cuts(String(emitProgram(surfacingLiteralStack(cfg))));
        const par = cuts(['G90', ...surfaceRasterLines(cfg), 'M30'].join(NL));
        // THE IDEAL — the unrounded mathematics both are approximating. 24 segments per rev about the area centre.
        const cx = cfg.w / 2, cy = cfg.h / 2, R = cfg.helixDia / 2, SEG = 24;
        const ideal = [];
        for (let k = 1; k <= SEG; k++) { const a = k * 2 * Math.PI / SEG; ideal.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }); }
        const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
        const rows = ideal.map((I, i) => ({ gap: d(par[i], lit[i]), parErr: d(par[i], I), litErr: d(lit[i], I) }));
        // t1377 — THE FEED IS NOT PART OF THE TOLERANCE. The quantum exception below licenses POSITION magnitude only;
        // a feed is exact or it is wrong, so it is compared separately and exactly.
        const feeds = (xs) => xs.map((p) => p.f);
        return { nLit: lit.length, nPar: par.length, rows, litFeeds: feeds(lit), parFeeds: feeds(par),
            sameOrder: JSON.stringify(lit.map((p) => [+p.x.toFixed(2), +p.y.toFixed(2)])) === JSON.stringify(par.map((p) => [+p.x.toFixed(2), +p.y.toFixed(2)])) };
    });
    // (3) STRUCTURE IS STILL EXACT — the tolerance licenses magnitude, never a different program
    expect(r.nPar, `same number of cutting moves: literal ${r.nLit}, parametric ${r.nPar}`).toBe(r.nLit);
    // (4) t1377 — AND EVERY MOVE'S FEED IS EXACTLY THE LITERAL'S. No tolerance: the descent's plunge feed and the
    // raster's cutting feed both differ by an order of magnitude, so a confusion between them is not a rounding.
    expect(r.parFeeds, 'every cutting move carries the same feed as the literal path').toEqual(r.litFeeds);
    // (1) WITHIN ONE EMIT QUANTUM at every point of the descent
    const worst = Math.max(...r.rows.map((x) => x.gap));
    expect(worst, `worst point-to-point gap ${worst.toFixed(6)}mm must be within one 0.001mm emit quantum`).toBeLessThanOrEqual(0.001);
    // (2) AND ALWAYS TOWARD THE IDEAL — the declared sentence made checkable. The parametric point is never farther
    // from the unrounded mathematics than the literal's rounded one is.
    for (let i = 0; i < r.rows.length; i++) {
        const { parErr, litErr } = r.rows[i];
        // …allowing the recurrence its OWN DERIVED DRIFT (1e-6mm at 9 decimals with a per-revolution re-seed). At a
        // point where the literal's rounding happens to land exactly on the ideal, the parametric sits 7e-9 away —
        // its accumulated rotation error, three orders inside the bound and six orders inside an emit quantum.
        // Comparing at 1e-12 would be comparing two numbers that are both zero at every precision that exists.
        expect(parErr, `point ${i + 1}: parametric ${parErr.toFixed(9)} from the ideal, literal ${litErr.toFixed(9)} — never farther beyond the derived drift`)
            .toBeLessThanOrEqual(litErr + 1e-6);
    }
    // …and it is strictly better SOMEWHERE, or the claim would be vacuously true of an identical emit
    expect(r.rows.some((x) => x.parErr < x.litErr - 1e-6), 'and strictly closer at least once — the claim is not vacuous').toBe(true);
});

test('THE ENVELOPE IS EMPTY — every strategy and every descent is covered, and it is earned', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterCovers, surfaceRasterGap } = await import('/wizards/ops/surfaceraster.js');
        const CASES = [
            {}, { strategy: 'concentric' }, { direction: 'oneway' }, { confirmEvery: 3 },
            { entry: 'ramp', rampAngle: 3 }, { entry: 'helix', helixDia: 8, helixPitch: 1 },
        ];
        return CASES.map((c) => ({ c, covered: surfaceRasterCovers(c), why: surfaceRasterGap(c) }));
    });
    // EARNED, not declared: each of these was closed by its own bridge, in its own turn, against hand-derived truths.
    for (const row of r) {
        expect(row.covered, `covered: ${JSON.stringify(row.c)}`).toBe(true);
        expect(row.why, `and names no remaining gap: ${JSON.stringify(row.c)}`).toBe('');
    }
});

/**
 * t1351 — THE ENVELOPE'S SCOPE GREW, AND IT RE-OPENED ONE NAME. Both halves matter.
 *
 * GREW: it used to be honest only about the bare body. The atom now carries its own frame, so a PLACED op is inside
 * it — proven by the placement bridges above, not by widening a comment.
 *
 * RE-OPENED: SKIM is named again. That is not the envelope regressing — it is the envelope finally being asked the
 * right question. t1345's empty was measured on the body alone, where skim never appears; at full-program scope skim
 * is a genuinely different emit and pretending otherwise is how a feature vanishes on the day the old path dies.
 * An envelope that can only ever shrink is one nobody re-scopes, and this arc's rule is the opposite: every `false`
 * here is a promise that something still needs its bridge.
 */
test('t1351 — the envelope covers the PLACED program, and names SKIM as the one that still needs its own body', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterCovers, surfaceRasterGap } = await import('/wizards/ops/surfaceraster.js');
        const probe = (c) => ({ covered: surfaceRasterCovers(c), why: surfaceRasterGap(c) });
        return {
            placed: probe({ x: 50, y: 25, z0: 3 }),
            placedConcentric: probe({ x: -30, y: -12, z0: -2, strategy: 'concentric' }),
            skim: probe({ zMode: 'skim' }),
            skimRamp: probe({ zMode: 'skim', entry: 'ramp', rampAngle: 3 }),
            normal: probe({ zMode: 'normal' }),
        };
    });
    // PLACED is in, at both strategies and at a real three-axis frame.
    expect(r.placed.covered, 'a placed op is inside the envelope').toBe(true);
    expect(r.placed.why, 'and names no gap').toBe('');
    expect(r.placedConcentric.covered, 'concentric too, at a negative frame').toBe(true);
    expect(r.normal.covered, 'an explicit Normal Z-mode is in').toBe(true);
    // FLIPPED at t1355 — SKIM IS IN. It was named a gap at t1351 with the runtime-value reason, and it closed the
    // way every gap in this arc has closed: the assert changed SIDES rather than being deleted. And it closed by
    // becoming the SAME body over a runtime frame, so skim × ramp came with it for free rather than needing its own
    // turn — which is why both of these flip together.
    expect(r.skim.covered, 'skim is covered now — the same body, over a frame the machine supplies').toBe(true);
    expect(r.skim.why, 'and names no remaining gap').toBe('');
    expect(r.skimRamp.covered, 'skim with a ramp descent came along with it').toBe(true);
});

/**
 * t1349 → RESTATED t1351 — WHY THE ATOM ABSORBS ITS OWN FRAME.
 *
 * This began as "the folds block the switch". Half of it is now ANSWERED rather than fixed, and the distinction is
 * the whole ruling: the placement fold never learned to carry parametric text — it STOPPED BEING ASKED TO. The atom
 * takes the shift as params (x0/y0/z0) and emits it into its own expressions, proven by the PLACEMENT bridges above.
 * So what follows is no longer a blocker for placement; it is the MEASUREMENT that says why absorbing beats rewriting,
 * kept executable so the reasoning cannot rot into a comment nobody re-checks.
 *
 * THE SKIM HALF IS STILL OPEN, and still blocks. `relativizeProgram` is not a rewrite that could be taught better:
 * the deltas of a loop are runtime values, so there is nothing in the text to rewrite. That is why the ruling for
 * skim is a natively-relative body (or a runtime frame read from the controller — see FINDINGS / V14_wcs_pos.nc),
 * and why the retract assert below is still the pinned defect rather than a flipped equality.
 *
 * A literal raster is a list of numbers, so a text rewrite is exact on it. A parametric raster is expressions and
 * macro registers, and a numeric regex cannot see them — so the rewrite lands on SOME of the axis words and not
 * others, which is worse than landing on none. These asserts record the measured behaviour, at the values it was
 * measured with, and the skim ones SHOULD fail and be restated the day the skim body lands (t1315/t1317 precedent).
 */
test('t1349→t1351 — the folds cannot carry parametric text: PLACEMENT answered by absorption, SKIM still open', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { translateProgram, relativizeProgram } = await import('/data/rotateProgram.js');
        const NL = String.fromCharCode(10);
        const body = surfaceRasterLines({ w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 });
        const before = body.join(NL).split(NL);
        const diff = (after) => before.map((b, i) => [b, after[i]]).filter(([b, a]) => b !== a);
        const tr = translateProgram(before.join(NL), 50, 25, 0);
        return {
            translated: diff(tr.text.split(NL)),
            translateRefused: tr.refused || '',
            translateMoved: tr.moved,
            relativized: diff(relativizeProgram(before.join(NL)).text.split(NL)),
            // the axis words a numeric regex is blind to — an expression or a bare register
            invisible: before.filter((l) => /[XYZ]\s*[[#]/.test(l)).length,
        };
    });

    // (1) FLIPPED at t1353 — THE HALF-SHIFT IS GONE, AND NOT BECAUSE THE REWRITE GOT CLEVERER.
    //
    // This assert used to require the damage: `G0 X0 Y#47` → `G0 X50 Y#47`, the X taking the shift while the register
    // Y did not, shearing the raster. It now requires the REFUSAL. translateProgram consults the declared
    // parametricMotion predicate and returns the program UNTOUCHED with a reason, so there is no half-shifted move to
    // find — and the comment it used to rewrite to a false "X110%" arrives intact too, for the same one reason.
    expect(r.translateRefused, 'the translate REFUSES a parametric program, with a reason on the refusal').toMatch(/refused:/);
    expect(r.translateRefused, 'and the reason names the register, not just "unsupported"').toMatch(/macro register|runtime expression/);
    expect(r.translated, 'NOT ONE LINE is rewritten — refusing is all-or-nothing, never partial').toEqual([]);
    expect(r.translateMoved, 'and it reports having moved nothing').toBe(0);
    expect(r.invisible, 'the axis words a numeric regex cannot see are still there — the predicate is not vacuous').toBeGreaterThan(4);

    // (2) STILL PINNED — SKIM. `relativizeProgram` is deliberately NOT guarded yet: its ruling is a natively-relative
    // body (or a runtime frame — FINDINGS/V14), and until that lands, skim surfacing keeps the literal emitter, so
    // there is no parametric program reaching this fold in the app. The measurement stays executable meanwhile: the
    // inter-level `G0 Z5` relativizes to `G0 Z0` — the tool would not lift between depth levels. This one SHOULD fail
    // and be restated the day the skim body lands.
    const retract = r.relativized.find(([b]) => /clear of the work before the next level/.test(b));
    expect(retract, 'the inter-level clearance retract is rewritten').toBeTruthy();
    expect(retract[1], 'the retract between depth levels becomes a NO-OP — the tool never lifts').toMatch(/G0 Z0\b/);
});

/**
 * t1351 PART 1 — THE ATOM ABSORBS ITS PLACEMENT, and the bridge is against the SHIPPING placed program.
 *
 * The ruling (Fork A): the placement stops being applied to the emitted TEXT and becomes PARAMS the body already
 * speaks — x0/y0 were always there, z0 is new. The FOLD side (placeonstock passing values instead of rewriting)
 * lands with the re-point; what is proven here is that the atom, given the shift as params, emits the same cut the
 * literal path emits when placeonstock translates it.
 *
 * The reference is deliberately NOT a hand-built expectation: it is `surfacingStack` at that placement, which is the
 * program that ships today — literal raster, translated by the place fold. translateProgram is EXACT on a list of
 * numbers, which is precisely why it is trustworthy here and untrustworthy on the parametric body.
 */
const PLACEMENTS = [
    // the config t1349 measured the corruption at, now required to agree
    { name: 'the measured 200x150 at (50, 25)', dx: 50, dy: 25, dz: 0 },
    { name: 'NON-ZERO offZ — the frame the atom had no param for until now', dx: 0, dy: 0, dz: 3 },
    { name: 'a NEGATIVE shift on all three axes', dx: -30, dy: -12, dz: -2 },
    { name: 'all three at once, off-grid', dx: 17.5, dy: -6.25, dz: 1.5 },
    { name: 'ZERO shift — the degenerate anchor', dx: 0, dy: 0, dz: 0 },
];

for (const P of PLACEMENTS) {
    for (const strategy of ['parallel', 'concentric']) {
        test(`PLACEMENT (${strategy}) — ${P.name}`, async ({ page }) => {
            await boot(page);
            const r = await page.evaluate(async ({ P, strategy }) => {
                const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
                const { emitProgram } = await import('/blocks/blockEmitter.js');
                const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
                const { traceToolpath } = await import('/engine/trace.js');
                const NL = String.fromCharCode(10);
                const base = { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5, strategy };

                // THE SHIPPING PATH: the literal raster, PLACED by the fold (originX/originY/offZ → placementShift).
                const literal = String(emitProgram(surfacingLiteralStack({ ...base, originX: P.dx, originY: P.dy, offZ: P.dz })));
                // THE ATOM PATH: the same shift handed in as params, absorbed into the emitted expressions.
                const parametric = ['G90', ...surfaceRasterLines({ ...base, x: P.dx, y: P.dy, z0: P.dz }), 'M30'].join(NL);

                // t1377 — (position, FEED) per move, as everywhere else in this file now.
                const cut = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid)
                    .map((s) => [+s.x1.toFixed(3), +s.y1.toFixed(3), +s.z1.toFixed(3), +s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3), +Number(s.feed || 0).toFixed(3)]);

                return {
                    litCut: cut(literal), parCut: cut(parametric),
                    // the degenerate anchor, asserted as TEXT: a zero frame must change nothing at all
                    bareIdentical: surfaceRasterLines(base).join(NL) === surfaceRasterLines({ ...base, x: 0, y: 0, z0: 0 }).join(NL),
                    // the header comment states a fact about the TOOL; the text rewrite mangled it (t1349), params cannot
                    header: (surfaceRasterLines({ ...base, x: P.dx, y: P.dy, z0: P.dz }).find((l) => /stepover mm = tool/.test(l)) || ''),
                };
            }, { P, strategy });

            expect(r.litCut.length, 'the placed literal really cuts').toBeGreaterThan(0);
            expect(r.parCut.length, `same number of cutting moves (literal ${r.litCut.length}, parametric ${r.parCut.length})`).toBe(r.litCut.length);
            expect(r.bareIdentical, 'the ZERO frame is byte-identical to the bare body — placement adds nothing when there is none').toBe(true);
            // …and the comment arrives intact, saying the true thing about the tool.
            expect(r.header, 'the stepover header comment is untouched by placement').toMatch(/tool Ø 12 x 60%/);

            // EVERY CUT ENDS WHERE THE LITERAL'S DOES — the geometry claim, and the one the t1349 shear broke.
            expect(r.parCut.map((m) => m.slice(3)), 'every cutting move ENDS at the literal’s point, in order').toEqual(r.litCut.map((m) => m.slice(3)));

            const differing = r.litCut.map((m, i) => i).filter((i) => JSON.stringify(r.litCut[i]) !== JSON.stringify(r.parCut[i]));
            if (!P.dz) {
                // NO Z FRAME → POINT FOR POINT, IN ORDER. This is the migration claim proper, and it covers the rows
                // whose Y is a register — exactly where the text rewrite produced a half-shifted move and sheared the raster.
                expect(differing, 'with no Z frame the two are identical move for move').toEqual([]);
            } else {
                // A Z FRAME DIVERGES IN EXACTLY ONE PLACE, AND THE PARAMETRIC IS THE SAFE ONE.
                //
                // The literal's opening clearance rapid comes from PROGSTART, which sits OUTSIDE placeonstock and so
                // never learns about offZ: it rapids to an absolute Z<clearance> whatever surface the op was placed on.
                // The atom measures its clearance from the surface it faces (z0 + clearance), because that is what the
                // word means. So the first plunge STARTS higher on the atom path and ends in the same place.
                //
                // THAT DIFFERENCE IS NOT A ROUNDING ARTEFACT AND IT IS NOT THE ATOM'S BUG — measured at offZ 6 with a
                // 5mm clearance, the shipping literal rapids to Z5 with the faced surface at Z6 and traverses to the
                // first row ONE MILLIMETRE INSIDE THE MATERIAL, then "plunges" upward to Z5.6. Flagged for its own
                // ruling; asserted here so the difference is stated rather than smoothed over.
                expect(differing, 'exactly one move differs, and it is the first plunge').toEqual([0]);
                expect(r.parCut[0].slice(0, 2), 'which starts at the same XY').toEqual(r.litCut[0].slice(0, 2));
                expect(r.parCut[0][2], 'the atom approaches from surface + clearance').toBeCloseTo(P.dz + 5, 3);
                expect(r.litCut[0][2], 'the literal approaches from an offZ-blind absolute clearance').toBeCloseTo(5, 3);
                if (P.dz > 0) expect(r.parCut[0][2], 'so at a positive offZ the atom starts strictly higher — never inside the work').toBeGreaterThan(r.litCut[0][2]);
            }
        });
    }
}

/**
 * t1351 REACHABILITY — asked BEFORE building, because building for an unreachable case is machinery and missing a
 * reachable one is a dropped feature. Both answers are asserted here rather than remembered.
 */
test('t1351 REACHABILITY (a) — SKIM combined with a ramp/helix entry IS reachable, so the skim body must cover it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingDataDef } = await import('/blocks/dataOps/surfacingData.js');
        const def = surfacingDataDef();
        const params = (def.bindings || []).map((b) => b.param);
        const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        // and it is not merely a form pairing — the stack really builds it
        const txt = String(emitProgram(surfacingLiteralStack({ w: 80, h: 40, depth: 0.8, stepdown: 0.4, toolDia: 8, stepoverPct: 50, zMode: 'skim', entry: 'ramp', rampAngle: 3, feed: 800, plunge: 150, clearance: 4 })));
        return { hasZMode: params.includes('zMode'), hasEntry: params.includes('entry'), hasRamp: params.includes('rampAngle'), hasHelix: params.includes('helixPitch'), skimRamp: /G91/.test(txt) && /ramp/i.test(txt) };
    });
    // The TWIN's form (the shipped in-place surfacing form) carries the Z-mode AND the depth-entry cluster, so an
    // operator can select Skim and Ramp together. This is why part 2 covers the descents rather than excluding them.
    expect(r.hasZMode, 'the form offers Z-mode').toBe(true);
    expect(r.hasEntry && r.hasRamp && r.hasHelix, 'and the depth-entry cluster alongside it').toBe(true);
    expect(r.skimRamp, 'and the stack really emits a RELATIVE program with a ramp descent in it').toBe(true);
});

/**
 * (b) ROTATION — surfacingStack does NOT rotate, but the PROGRAM-LEVEL declaration reaches it, and the damage is a
 * different and worse class than the translate. FLAGGED FOR ITS OWN RULING, deliberately NOT built for: rotation
 * couples X and Y, so rotateProgram rewrites a move with BOTH words — and against expressions and registers that
 * does not fail to apply, it APPENDS. A duplicate `Y0` on a cutting move is uncommanded motion, not a missed shift.
 */
test('t1351 REACHABILITY (b) — surfacingStack emits no rotation, but the PROGRAM-level one reaches the body (flagged, not built)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
        const { rotateProgram, mirrorProgram } = await import('/data/rotateProgram.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const NL = String.fromCharCode(10);
        const flat = (bs, out = []) => { for (const b of (bs || [])) { if (!b) continue; out.push(b.type); flat(b.children, out); } return out; };
        const types = flat(surfacingLiteralStack({ w: 100, h: 80, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, originX: 20, offZ: 2 }));
        const body = surfaceRasterLines({ w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 });
        const before = body.join(NL).split(NL);
        const changed = (after) => before.map((b, i) => [b, after[i]]).filter(([b, a]) => b !== a);
        const rot = rotateProgram(before.join(NL), 30, 0, 0);
        const mir = mirrorProgram(before.join(NL), 'X', 200, 150, 25);
        return {
            types,
            rotated: changed(rot.text.split(NL)), rotRefused: rot.refused || '', rotCount: rot.rotated,
            mirrored: changed(mir.text.split(NL)), mirRefused: mir.refused || '', mirroredX: mir.mirrored,
        };
    });
    // The op's OWN stack carries no rotation — so nothing surfacing builds needs a rotated frame.
    expect(r.types, 'surfacingStack emits no rotate/xform of its own').not.toContain('rotate');
    expect(r.types, 'nor a program-transform declaration').not.toContain('xform');

    // FLIPPED at t1353 — the program-level rotation still REACHES a surfacing op (applyProgramTransform rotates every
    // line of the emitted program), and that has not changed. What changed is what it DOES when it gets there.
    //
    // It used to APPEND: `G0 X0 Y#47` became `G0 X0 Y#47 Y0`, because rotation couples the axes and rewrites a move
    // with BOTH words — so a word it could not replace was added alongside the one it could. A second Y the
    // controller obeys, on a cutting line, is uncommanded motion, which is why this was flagged rather than absorbed
    // like the placement was. Now it refuses the whole program and touches nothing.
    expect(r.rotRefused, 'a rotation REFUSES a parametric program, with its reason').toMatch(/rotate refused:/);
    expect(r.rotated, 'and appends nothing — no line is touched at all').toEqual([]);
    expect(r.rotCount, 'nothing rotated').toBe(0);
    // The two-sided flip failed the OTHER way — about X it matched nothing, so a mirrored setup would have cut the
    // first side twice on an already-flipped part. Silence is the worst refusal, so now it says so out loud.
    expect(r.mirRefused, 'the mirror refuses too, rather than silently not mirroring').toMatch(/mirror refused:/);
    expect(r.mirrored, 'touching nothing').toEqual([]);
    expect(r.mirroredX, 'and reporting zero mirrored words — the same number as before, now with a reason attached').toBe(0);
});

/**
 * t1355 — THE SKIM BODY, and it is the SAME body over a runtime frame.
 *
 * The earlier ruling was a natively-relative (G91) emit, because a loop's deltas are runtime values and there is
 * nothing in the text to relativize. That is still true — what changed is that it turned out not to be necessary.
 * #790/#791/#792 hold the live position in the ACTIVE WCS ([COMMUNITY-ATTESTED]; the factory's own gotozero.nc
 * proves #792). So the atom reads the jog position into three LOCAL registers at the top and its ORDINARY ABSOLUTE
 * body runs over them. Skim × concentric, skim × ramp and skim × helix came along for free — no second emitter, no
 * per-descent G91 derivation, and every bridge already written keeps applying.
 *
 * THE REFERENCE is the shipping skim path: `surfacingLiteralStack({zMode:'skim'})`, which is the literal raster put through
 * `relativizeProgram` — G91 deltas from the jog start. The parametric body is absolute in a frame the machine fills
 * in, so the two are compared in the ONE frame they share: distance travelled FROM THE JOG POINT.
 */
const SKIM_JOGS = [
    { name: 'at the WCS origin', jx: 0, jy: 0, jz: 0 },
    { name: 'a NEGATIVE jog point', jx: -40, jy: -25, jz: -12 },
    { name: 'an OFF-GRID jog point', jx: 17.5, jy: -6.25, jz: 3.5 },
];
const SKIM_SHAPES = [
    { name: 'parallel · plunge · MULTI-LEVEL', cfg: { strategy: 'parallel', entry: 'plunge', depth: 1.2, stepdown: 0.4 } },
    // t1487 — the one skim shape whose descent C4 re-points, flagged as DATA (see the branch below)
    { name: 'parallel · ramp', cfg: { strategy: 'parallel', entry: 'ramp', rampAngle: 3, depth: 0.8, stepdown: 0.4 }, ramp: true },
    { name: 'parallel · helix', cfg: { strategy: 'parallel', entry: 'helix', helixDia: 8, helixPitch: 1, depth: 0.8, stepdown: 0.4 } },
    { name: 'CONCENTRIC · plunge', cfg: { strategy: 'concentric', entry: 'plunge', depth: 0.8, stepdown: 0.4 } },
    { name: 'single level, single row', cfg: { strategy: 'parallel', entry: 'plunge', depth: 0.5, stepdown: 0.5, h: 5 } },
];

for (const J of SKIM_JOGS) {
    for (const S of SKIM_SHAPES) {
        test(`SKIM BRIDGE — ${S.name} — ${J.name}`, async ({ page }) => {
            await boot(page);
            const r = await page.evaluate(async ({ J, S }) => {
                const { surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
                const { emitProgram } = await import('/blocks/blockEmitter.js');
                const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
                const { traceToolpath } = await import('/engine/trace.js');
                const NL = String.fromCharCode(10);
                const base = { w: 120, h: 60, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5, ...S.cfg };

                // THE SHIPPING SKIM PATH: literal raster, relativized by the skim fold. G91 from the jog start, so its
                // traced coordinates ARE the distance travelled from that point.
                const literal = String(emitProgram(surfacingLiteralStack({ ...base, zMode: 'skim' })));
                // THE ATOM PATH: absolute, in the frame the machine supplies. The seeds MODEL the controller's read —
                // this is the sim standing in for #790/#791/#792, never the WCS table.
                const parametric = ['G90', `#790=${J.jx}`, `#791=${J.jy}`, `#792=${J.jz}`,
                    ...surfaceRasterLines({ ...base, zMode: 'skim' }), 'M30'].join(NL);

                const segs = (nc) => (traceToolpath(nc).segments || []);
                // t1377 — the FEED rides along: it is frame-independent, so it needs no origin subtraction and a
                // skim body that cut at the wrong speed would now show up here.
                // t1487 — the tuple carries its START as well as its end now. It was end-only, which is all an
                // in-order equality needs; the ramp relationship asks where a descent BEGINS and whether it returns
                // there, and neither question can be asked of an endpoint. Strictly more data, same comparison.
                const cutFrom = (nc, ox, oy, oz) => segs(nc).filter((s) => !s.rapid)
                    .map((s) => [+(s.x1 - ox).toFixed(3), +(s.y1 - oy).toFixed(3), +(s.z1 - oz).toFixed(3),
                        +(s.x2 - ox).toFixed(3), +(s.y2 - oy).toFixed(3), +(s.z2 - oz).toFixed(3), +Number(s.feed || 0).toFixed(3)]);
                // the literal is already relative to the jog; the parametric is absolute in the jog frame
                const lit = cutFrom(literal, 0, 0, 0);
                const par = cutFrom(parametric, J.jx, J.jy, J.jz);

                // the inter-level clearance rapid, as a height ABOVE the jog surface — the pinned no-op's replacement
                const rapidZs = (nc, oz) => [...new Set(segs(nc).filter((s) => s.rapid).map((s) => +(s.z2 - oz).toFixed(3)))];
                return {
                    lit, par,
                    litRapidZ: rapidZs(literal, 0), parRapidZ: rapidZs(parametric, J.jz),
                    hasFrameRead: /#62=#790/.test(parametric), sentinel: /IF #62 == -99999 GOTO93/.test(parametric),
                };
            }, { J, S });

            expect(r.lit.length, 'the shipping skim path cuts').toBeGreaterThan(0);
            expect(r.par.length, `same number of cutting moves (literal ${r.lit.length}, parametric ${r.par.length})`).toBe(r.lit.length);
            // MOVE FOR MOVE, measured from the jog point in both. The frame is the only thing that differs, and it
            // cancels — which is the whole claim.
            if (!S.ramp) {
                expect(r.par, 'every cutting move is the same distance from the jog start, in order').toEqual(r.lit);
            } else {
                // t1487 — RESTATED, NOT RETIRED (ruled t1486). The skim claim is about the FRAME — that it cancels —
                // and that claim is untouched by which way a ramp points. So the walk is still asserted move for
                // move from the jog start, and the descent is asserted on its declared relationship, in the jog
                // frame on both sides. A skim body that lost the frame would still fail on the walk.
                expect(splitRampDescent(r.par).walk, 'every cutting move OUTSIDE the descent is the same distance from the jog start, in order').toEqual(splitRampDescent(r.lit).walk);
                const rel = rampDescentRelationship(r.lit, r.par, { bbox: cutBox(r.lit) });
                expect(rel.ok, `and the descent holds its declared relationship, measured from the jog start — ${rel.why}`).toBe(true);
            }
            // THE FRAME IS READ, not assumed, and guarded before any motion.
            expect(r.hasFrameRead, 'the body reads the live position').toBe(true);
            expect(r.sentinel, 'and refuses if it did not arrive').toBe(true);
            // AND THE TOOL REALLY LIFTS between levels — t1349 pinned the relativized literal collapsing this to a
            // no-op (`G0 Z5` → `G0 Z0`). The parametric body clears to a REAL height above the touched surface.
            expect(Math.max(...r.parRapidZ), 'the clearance rapid is a real lift above the jog surface').toBeCloseTo(5, 3);
        });
    }
}

/**
 * t1349's SKIM PIN, RESTATED — the defect it documented is now the thing that is fixed, so it flips.
 *
 * It pinned `relativizeProgram` collapsing the inter-level retract to `G0 Z0`: the tool never lifting between depth
 * levels, because the delta was computed against a position the loop never actually holds. That is still exactly
 * what the text rewrite does — and it no longer matters, because nothing asks it to. The skim body is emitted
 * relative to a frame the machine supplies, so the retract is written as a height and stays one.
 */
test('t1349 → t1355 — the skim retract is a REAL lift now, because nothing relativizes a loop any more', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { relativizeProgram } = await import('/data/rotateProgram.js');
        const NL = String.fromCharCode(10);
        const cfg = { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 };
        const body = surfaceRasterLines(cfg);
        const skimBody = surfaceRasterLines({ ...cfg, zMode: 'skim' });
        const relLine = relativizeProgram(body.join(NL)).text.split(NL)
            .find((l) => /clear of the work before the next level/.test(l)) || '';
        return {
            // what the OLD path did to the placed body (unchanged, and now unused for skim)
            relativized: relLine,
            // what the skim body itself emits
            skimRetract: skimBody.find((l) => /clear of the work before the next level/.test(l)) || '',
            skimFirstClear: skimBody.find((l) => /clear before the first plunge/.test(l)) || '',
        };
    });
    // The text rewrite still ruins it — that has not changed and is not being fixed.
    expect(r.relativized, 'relativizeProgram still collapses the retract (unchanged, and no longer asked)').toMatch(/G0 Z0\b/);
    // But the skim body emits a real height above the frame, so the tool lifts.
    expect(r.skimRetract, 'the skim body clears to frame + clearance, not to zero').toMatch(/G0 Z\[#64 \+ 5\]/);
    expect(r.skimFirstClear, 'and so does the opening clear').toMatch(/G0 Z\[#64 \+ 5\]/);
});

/**
 * THE PRIMING RULE, SWEPT rather than remembered (CORE_TRUTH 4): the variable-priming freeze concerns PERSISTENT
 * targets. This asserts the frame registers are ordinary locals and — more usefully — that no emitter in the app
 * writes a persistent variable directly from a system one, which is the shape the rule actually warns about.
 */
test('t1355 — the frame lands in LOCALS, and nothing anywhere writes persistent-direct-from-system', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterLines, RASTER_SCRATCH } = await import('/wizards/ops/surfaceraster.js');
        const ob = await import('/blocks/opBuilders.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const NL = String.fromCharCode(10);
        const skim = surfaceRasterLines({ w: 80, h: 40, depth: 0.8, stepdown: 0.4, toolDia: 8, stepoverPct: 50, zMode: 'skim' });
        // every op's emit, swept for `#<persistent> = #<system>`
        const offenders = [];
        for (const opType of Object.keys(ob.BUILDERS || {})) {
            let txt = '';
            try { txt = String(emitProgram(ob.builderOf(opType)({}))); } catch (_) { continue; }
            txt.split(NL).forEach((l, i) => {
                const m = l.match(/^\s*#(\d+)\s*=\s*#(\d+)\s*(?:\(|;|$)/);
                if (!m) return;
                const tgt = Number(m[1]), src = Number(m[2]);
                // THE HAZARD, SPECIFIED: a PERSISTENT target written straight from a SYSTEM register. Both halves
                // matter. My first version tested the target alone and flagged alignment's `#1510=#52` — which is
                // the operator-MESSAGE argument idiom (`#1510`/`#1511` feed the `#1505=-5000(...)` report) sourced
                // from a LOCAL probe temp. Reporting a measurement is not the freeze this rule is about, and a
                // predicate that cannot tell them apart would have made the assert noise nobody trusts.
                const isSystemSrc = (src >= 790 && src <= 794) || (src >= 880 && src <= 884);   // live position families
                if (tgt >= 1153 && isSystemSrc) offenders.push(`${opType}:${i + 1} ${l.trim()}`);
            });
        }
        return { band: RASTER_SCRATCH, frameTargets: skim.filter((l) => /^#6[234]=#79\d/.test(l)).map((l) => l.split('=')[0]), offenders };
    });
    // the frame trio is declared in the band, and every one of them is a LOCAL (far below the #1153+ persistent range)
    expect(r.frameTargets.sort(), 'the three frame registers are the declared ones').toEqual(['#62', '#63', '#64']);
    for (const t of r.frameTargets) expect(Number(t.slice(1)), `${t} is a local, not a persistent target`).toBeLessThan(1153);
    expect(r.band, 'and they are declared as band DATA, not left implicit').toEqual([[34, 49], [62, 64]]);
    // the rule the freeze is actually about, asserted across every registered op rather than remembered
    expect(r.offenders, 'no emitter writes a persistent variable straight from a system one').toEqual([]);
});
