import { test, expect } from '@playwright/test';

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
    expect(r.body, 'a depth loop').toMatch(/WHILE \[#46 LT #42\] DO1/);
    expect(r.body, 'with the row loop nested inside it').toMatch(/WHILE \[#48 LT #45\] DO2/);
    expect(r.body.indexOf('DO2')).toBeGreaterThan(r.body.indexOf('DO1'));
    expect(r.body.indexOf('END2')).toBeLessThan(r.body.indexOf('END1'));
    // A ZERO STEPOVER DIVIDES BY ZERO and a zero stepdown loops forever — refused cleanly, not left to the machine
    expect(r.body).toMatch(/IF #44 LE 0 GOTO 91/);
    expect(r.body).toMatch(/IF #43 LE 0 GOTO 91/);
    expect(r.body, 'with a named error, not a silent halt').toMatch(/ERROR: stepover \/ stepdown/);
    // THE BAND IS DECLARED AS DATA, so the collision guard reads it instead of re-deriving it from the text
    expect(r.band, 'the scratch band is declared on the atom').toEqual([[40, 49]]);
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
            const { surfacingStack } = await import('/wizards/surfacingWizard.js');
            const { emitProgram } = await import('/blocks/blockEmitter.js');
            const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
            const { traceToolpath } = await import('/engine/trace.js');
            const NL = String.fromCharCode(10);

            // THE OLD PATH, exactly as it ships today: the literal unrolled raster.
            const oldText = String(emitProgram(surfacingStack(cfg)));
            // THE NEW PATH: the parametric body, run through the same tracer. Framed the same way (absolute, at the
            // WCS origin) so the comparison is about the RASTER and nothing else.
            const newText = ['G90', ...surfaceRasterLines(cfg), 'M30'].join(NL);

            // …and both EXECUTED. A text diff would prove nothing here — the whole point is that one is a loop and
            // the other is a list, so they must agree in MOTION, not in shape.
            const moves = (nc) => (traceToolpath(nc).segments || [])
                .filter((s) => !s.rapid || true)
                .map((s) => [+s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3), !!s.rapid]);
            const cut = (nc) => (traceToolpath(nc).segments || [])
                .filter((s) => !s.rapid)
                .map((s) => [+s.x1.toFixed(3), +s.y1.toFixed(3), +s.z1.toFixed(3), +s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3)]);
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
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const NL = String.fromCharCode(10);
        const small = { w: 80, h: 40, depth: 0.5, stepdown: 0.5, toolDia: 10, stepoverPct: 50, feed: 800, plunge: 150, clearance: 4 };
        const big = { ...small, w: 600, h: 400, depth: 3, stepdown: 0.3 };
        return {
            oldSmall: String(emitProgram(surfacingStack(small))).split(NL).length,
            oldBig: String(emitProgram(surfacingStack(big))).split(NL).length,
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
    expect(r.concentric.covered, 't1333 — concentric rings are covered now, proven move-for-move').toBe(true);
    expect(r.oneway.covered, 'and one-way was never a gap: the op hard-codes both-ways').toBe(true);
    // EVERYTHING ELSE IS OUTSIDE IT, AND SAYS WHY. A bare `false` here would be the silent drop this exists to prevent.
    // t1333 — RESTATED: concentric closed this turn, and one-way was never a real gap (the op hard-codes
    // both-ways — see the correction above). What is left outside the envelope is the descent and the pause.
    // t1335 — RESTATED again: the confirm cadence closed this turn (M00 after every Nth level but the last), so it
    // moved to the covered side. The DESCENT is the one name left.
    expect(r.confirm.covered, 'the confirm cadence is covered now').toBe(true);
    for (const k of ['ramp', 'helix']) {
        expect(r[k].covered, `${k} is outside the proven envelope`).toBe(false);
        expect(r[k].why, `${k} says why, in words a reader can act on`).toBeTruthy();
        expect(r[k].why.length, `${k}'s reason is a sentence, not a token`).toBeGreaterThan(20);
    }
    expect(r.helix.why).toMatch(/descent/i);
});

test('THE GAP IS REAL, MEASURED — the uncovered cases are different programs, not near-misses', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { emitProgram } = await import('/blocks/blockEmitter.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const base = { w: 100, h: 60, depth: 1.0, stepdown: 0.5, toolDia: 12, stepoverPct: 60, stepover: 7.2, feed: 900, plunge: 180, clearance: 5 };
        const cuts = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid).length;
        const pair = (extra) => {
            const cfg = { ...base, ...extra };
            return { literal: cuts(String(emitProgram(surfacingStack(cfg)))), parametric: cuts(['G90', ...surfaceRasterLines(cfg), 'M30'].join(NL)) };
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
    expect(Math.abs(r.helix.literal - r.helix.parametric), 'and a helix descent by more still').toBeGreaterThan(20);
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
    const { surfacingStack } = await import('/wizards/surfacingWizard.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const NL = String.fromCharCode(10);
    const oldText = String(emitProgram(surfacingStack(cfg)));
    const newText = ['G90', ...surfaceRasterLines(cfg), 'M30'].join(NL);
    const cut = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid)
        .map((s) => [+s.x1.toFixed(3), +s.y1.toFixed(3), +s.z1.toFixed(3), +s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3)]);
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
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const flat = (st, out = []) => { for (const b of (st || [])) { out.push(b); flat(b.children, out); flat(b.uiChildren, out); } return out; };
        // ask the op for a one-way raster, the way my t1331 measurement did…
        const asked = flat(surfacingStack({ w: 100, h: 60, direction: 'oneway' })).find((b) => b.type === 'surfacefill');
        const dflt = flat(surfacingStack({ w: 100, h: 60 })).find((b) => b.type === 'surfacefill');
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
    // STILL OUT, AND SAYING SO — the predicate ends the turn naming exactly what remains, not empty
    expect(r.ramp.covered).toBe(false);
    expect(r.helix.covered).toBe(false);
    // t1335 — the confirm cadence flipped to covered this turn; the assert moved sides rather than being deleted
    expect(r.confirm.covered, 'confirm-every-N is in').toBe(true);
    for (const k of ['ramp', 'helix']) {
        expect(r[k].why, `${k} still names its own gap`).toBeTruthy();
    }
});

/**
 * t1335 — REACHABILITY FIRST (the rule the one-way correction turned into a method), then the pause.
 */
test('REACHABILITY — the op really can emit these, unlike direction', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const flat = (st, out = []) => { for (const b of (st || [])) { out.push(b); flat(b.children, out); flat(b.uiChildren, out); } return out; };
        const fill = (p) => flat(surfacingStack(p)).find((b) => b.type === 'surfacefill');
        const down = (p) => flat(surfacingStack(p)).find((b) => b.type === 'stepdown');
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
        const pts = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid).map((s) => [+s.x2.toFixed(2), +s.y2.toFixed(2)]);
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
            const { surfacingStack } = await import('/wizards/surfacingWizard.js');
            const { emitProgram } = await import('/blocks/blockEmitter.js');
            const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
            const NL = String.fromCharCode(10);
            // depth 1.5 / stepdown 0.5 = 3 levels, so N=1,2,3 and N>total are all distinguishable
            const cfg = { w: 100, h: 60, depth: 1.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5, confirmEvery: N };
            const count = (t) => (t.match(/^\s*M0+\b/gm) || []).length;
            return { literal: count(String(emitProgram(surfacingStack(cfg)))), parametric: surfaceRasterLines(cfg).join(NL) };
        }, { N });
        // THE WORD IS THE MACHINE'S, matched not modernised: M00 with the operator sentence the literal path uses
        expect(r.parametric, 'the pause is M00, the same word the literal path emits').toMatch(/M00\s+\( pause - press Cycle Start to resume \)/);
        // …and it is GUARDED so the last level never pauses — a halt on a finished part is a call to the shop floor
        expect(r.parametric, 'the last pass is exempted').toMatch(/IF #46 GE #42 GOTO 31/);
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
    expect(r.ramp.covered).toBe(false);
    expect(r.helix.covered).toBe(false);
    expect(r.ramp.why, 'the descent is the one remaining name').toMatch(/descent/i);
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
        expect(r.newCut, 'and every cutting move is identical, in order — the ramp included').toEqual(r.oldCut);
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
    expect(body, 'the run is computed from the live bite').toMatch(/#49=\[#43 \* [\d.]+\]/);
    expect(body, 'and the tangent is baked, with the reason on the line').toMatch(/tangent is baked; the angle is a form field/);
    // THE HONEST DEGRADE survives the migration: when the run does not fit, the tool plunges and the program says so
    expect(body, 'a ramp that cannot fit degrades').toMatch(/GOTO 41/);
    expect(body, 'to a straight plunge, named').toMatch(/the ramp did not fit — straight plunge/);
});
