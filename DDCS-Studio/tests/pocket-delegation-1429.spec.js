import { test, expect } from '@playwright/test';

/**
 * t1429 — THE DELEGATION: the rect pocket's clearing body IS the raster atom.
 *
 * ── WHAT THIS CLOSES ──────────────────────────────────────────────────────────────────────────────────────────────
 * Studio held TWO clearing emitters — `surfaceRasterLines` (the wizard/Blocks path, with an envelope and bridges) and
 * `rasterClear` (the CAM slot's, hand-written) — and they had already diverged where it shows: t1412 measured the
 * packed pocket byte-identical across `strategy: spiral|raster` AND across `direction: bothways|oneway`, while the CAM
 * table displayed the operator's pick beside it. This turn the slot delegates, so the pick and the cut are one thing.
 *
 * ── THE TWO RULED BLOCKERS (measured at t1427, ruled at t1428) ────────────────────────────────────────────────────
 *   1. `clearance` never reached the emit — `num(word, 5)` returned the DEFAULT, so a pendant 12mm retract emitted
 *      `G0 Z5` on every lift. It is a geometry TERM now, and the retract prints the register.
 *   2. `stepover` was MILLIMETRES on the slot and a PERCENTAGE in the atom, so a dialled mm was dropped and 60% used
 *      instead — 3.6mm of stepover on a Ø6 tool where the operator typed 2.4. The field is a percentage now (option
 *      (b), t1325's change arriving at the second slot that exposes Tool Ø, for word-for-word its reason).
 *
 * ── AND THE ONE THIS TURN MEASURED ────────────────────────────────────────────────────────────────────────────────
 *   3. The ROW AXIS. Both mill slots have always exposed *"which axis the clearing rows run along"* (macrosApp's
 *      SECOND_CTL) and `rasterClear` has always honoured it; the atom ran rows along X and nothing said so. Delegating
 *      without it would have replaced a `rows ∥ Y` pick with `rows ∥ X` — the same silent substitution one layer up.
 *      So the atom DECLARES its row axis, and PROOF C proves the new walk is the old walk transposed.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** The traced path as comparable strings — the RESOLVED motion, never the emitted text. */
const TRACE = `
(traceToolpath, nc, swap) => {
    const q = (n) => +Number(n).toFixed(3);
    return (traceToolpath(nc).segments || []).map((s) => [s.rapid ? 'R' : 'C',
        q(swap ? s.y1 : s.x1), q(swap ? s.x1 : s.y1), q(s.z1),
        q(swap ? s.y2 : s.x2), q(swap ? s.x2 : s.y2), q(s.z2), q(s.feed || 0)].join(','));
}`;

/**
 * ── PROOF A — THE BAKED PATH DID NOT MOVE ─────────────────────────────────────────────────────────────────────────
 *
 * Two capabilities landed in the atom this turn (a live retract height, a declared row axis) and every program that
 * exists today takes numbers, so this is the guard the act rests on. Asserted over the same 288-config cross-product
 * t1425 pinned — both walks × three descents × three directions × skim × inset × rotation × the confirm cadence —
 * plus the new axis at its default, which is the assumption the declaration made explicit.
 */
test('PROOF A — the baked emit is well-formed across the cross-product, and rowAxis defaults to the old assumption', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const rows = [];
        for (const strategy of ['parallel', 'concentric'])
            for (const entry of ['plunge', 'ramp', 'helix'])
                for (const direction of ['bothways', 'oneway', 'otherway'])
                    for (const zMode of ['', 'skim'])
                        for (const inset of [0, 3])
                            for (const rotAngle of [0, 17])
                                for (const confirmEvery of [0, 2])
                                    rows.push({ x: 12.5, y: -7.25, z0: 2, w: 80, h: 60, inset, depth: 3, stepdown: 1.5,
                                        toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5, strategy, entry,
                                        direction, zMode, rotAngle, rotPivotX: 3, rotPivotY: 4, confirmEvery,
                                        rampAngle: 3, helixDia: 4, helixPitch: 0.75 });
        let bad = null, axisMoved = 0;
        for (const p of rows) {
            const t = m.surfaceRasterLines(p).join('\n');
            if (/NaN|undefined|\[\]/.test(t)) { bad = { p, t: t.split('\n').find((l) => /NaN|undefined|\[\]/.test(l)) }; break; }
            // an ABSENT rowAxis and an explicit 'x' are the same program — that is what "the default is the old
            // assumption" MEANS, and asserting it is what makes the byte-identity of the corpus a property, not a hope.
            if (t !== m.surfaceRasterLines({ ...p, rowAxis: 'x' }).join('\n')) axisMoved++;
        }
        return { count: rows.length, bad, axisMoved,
            axisOf: [m.rasterRowAxisOf({}), m.rasterRowAxisOf({ rowAxis: 'y' }), m.rasterRowAxisOf({ rowAxis: 'nonsense' })] };
    });
    expect(r.bad, `every baked emit is well-formed — ${JSON.stringify(r.bad)}`).toBe(null);
    expect(r.count, 'the cross-product really is the whole matrix').toBe(288);
    expect(r.axisMoved, 'an absent rowAxis emits exactly what an explicit x emits, on every config').toBe(0);
    expect(r.axisOf, 'absent is x, y is y, and an unknown word falls to x rather than inventing a third walk').toEqual(['x', 'y', 'x']);
});

/**
 * ── PROOF B — BLOCKER 1: THE RETRACT HEIGHT REACHES THE MACHINE ───────────────────────────────────────────────────
 *
 * The claim is about MOTION, not text: seed the registers the way a CAM slot does and the traced path must be the
 * same as the program that BAKED those same numbers — at a clearance of 12, deliberately not the atom's default 5,
 * because 5 is exactly what the defect emitted and a test run at the default cannot tell the two apart.
 */
for (const c of [
    { name: 'bothways · rows ∥ X', direction: 'bothways', rowAxis: 'x' },
    { name: 'one-way · rows ∥ X — the walk that lifts to clearance on EVERY row', direction: 'oneway', rowAxis: 'x' },
    { name: 'bothways · rows ∥ Y', direction: 'bothways', rowAxis: 'y' },
    { name: 'one-way · rows ∥ Y', direction: 'oneway', rowAxis: 'y' },
]) {
    test(`PROOF B — a dialled clearance drives every retract: ${c.name}`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async ({ cfg, TRACE }) => {
            const m = await import('/wizards/ops/surfaceraster.js');
            const { traceToolpath } = await import('/engine/trace.js');
            // eslint-disable-next-line no-eval
            const trace = eval(TRACE);
            const V = { x: 12.5, y: -7.25, w: 80, h: 60, inset: 3, depth: 3, stepdown: 1.5, toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150, clearance: 12 };
            const common = { z0: 0, strategy: 'parallel', entry: 'plunge', ...cfg };
            const baked = m.surfaceRasterLines({ ...V, ...common }).join('\n');
            const REG = { x: '#2', y: '#3', w: '#4', h: '#5', inset: '#6', depth: '#7', stepdown: '#8', toolDia: '#9', stepoverPct: '#10', feed: '#11', plunge: '#12', clearance: '#13' };
            const live = Object.keys(REG).map((k) => `${REG[k]}=${V[k]}   ;${k}`)
                .concat(m.surfaceRasterLines({ ...common, ...REG })).join('\n');
            return { baked: trace(traceToolpath, baked), live: trace(traceToolpath, live),
                // THE DEFECT'S OWN SIGNATURE: the atom's default 5 must appear NOWHERE in a live emit…
                liveHasDefault: /G0 Z5\b/.test(live),
                liveRetractsOnTheRegister: (live.match(/G0 Z#13\b/g) || []).length,
                bakedRetractsAt12: (baked.match(/G0 Z12\b/g) || []).length,
                // …and a live clearance must NOT be treated as dialled GEOMETRY: it is a Z retract, so a ramp/helix
                // still honours it. Reading it as geometry would refuse the two descents for no reason.
                gapPlunge: m.surfaceRasterLiveGap({ strategy: 'parallel', entry: 'plunge', clearance: '#13' }),
                gapRamp: m.surfaceRasterLiveGap({ strategy: 'parallel', entry: 'ramp', clearance: '#13' }),
                liveInputs: m.surfaceRasterLiveInputs({ clearance: '#13', w: '#4' }),
            };
        }, { cfg: c, TRACE });

        expect(r.bakedRetractsAt12, 'the baked side really does retract to 12 (so a wrong live one is visible)').toBeGreaterThan(0);
        expect(r.liveHasDefault, "the live emit never falls back to the atom's own default retract").toBe(false);
        expect(r.liveRetractsOnTheRegister, 'every retract rides the register').toBeGreaterThan(0);
        expect(r.baked.length, 'both programs move').toBeGreaterThan(0);
        expect(r.live, 'and they move IDENTICALLY — the register resolves to the number that was baked').toEqual(r.baked);
        expect(r.gapRamp, 'a dialled RETRACT does not refuse a ramp — it is Z, and what a ramp bakes is XY').toBe('');
        expect(r.gapPlunge, 'nor a plunge').toBe('');
        expect(r.liveInputs, 'and it is not counted as dialled geometry').toEqual(['w']);
    });
}

/**
 * ── PROOF C — BLOCKER 3: THE ROW AXIS IS THE SAME WALK, TRANSPOSED ────────────────────────────────────────────────
 *
 * This is why `rowAxis` is NOT a new envelope axis. `direction` earned its rows in SURFACE_RASTER_PROVEN by being a
 * genuinely different body; a row axis is the SAME body with its coordinate pair swapped, and that is a mechanical
 * claim rather than a plausible one: the `y` walk on (x,y,w,h) must cut the `x` walk on (y,x,h,w) with X and Y
 * exchanged, move for move, at the same feeds.
 *
 * THE HELIX IS EXEMPT AND SAYS SO. Its descent is a circle of FIXED handedness about the area centre (CCW, starting
 * at +X from it), so transposing the program would have to mirror the descent's cut direction to match — a handedness
 * the operator never asked to change. The helix is therefore the same helix whichever way the rows run, and only its
 * starting PHASE differs; the walk it descends into is covered by the two entries below it.
 */
for (const direction of ['bothways', 'oneway', 'otherway'])
    for (const entry of ['plunge', 'ramp'])
        test(`PROOF C — rows ∥ Y is rows ∥ X transposed: ${direction} · ${entry}`, async ({ page }) => {
            await boot(page);
            const r = await page.evaluate(async ({ direction, entry, TRACE }) => {
                const m = await import('/wizards/ops/surfaceraster.js');
                const { traceToolpath } = await import('/engine/trace.js');
                // eslint-disable-next-line no-eval
                const trace = eval(TRACE);
                const BASE = { z0: 0, depth: 3, stepdown: 1.5, toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel', direction, entry };
                const out = [];
                for (const [X, Y, W, H, inset] of [[12.5, -7.25, 80, 60, 3], [0, 0, 40, 90, 0], [-5, 3, 55, 55, 2]]) {
                    const yWalk = m.surfaceRasterLines({ ...BASE, rowAxis: 'y', x: X, y: Y, w: W, h: H, inset }).join('\n');
                    const xWalk = m.surfaceRasterLines({ ...BASE, rowAxis: 'x', x: Y, y: X, w: H, h: W, inset }).join('\n');
                    out.push({ rect: [X, Y, W, H, inset], y: trace(traceToolpath, yWalk, true), x: trace(traceToolpath, xWalk, false),
                        // the premise: the two really are different programs before the swap
                        differsUnswapped: yWalk !== m.surfaceRasterLines({ ...BASE, rowAxis: 'x', x: X, y: Y, w: W, h: H, inset }).join('\n') });
                }
                return out;
            }, { direction, entry, TRACE });

            for (const c of r) {
                expect(c.differsUnswapped, `rows ∥ Y is a genuinely different program on ${JSON.stringify(c.rect)}`).toBe(true);
                expect(c.y.length, 'and it cuts something').toBeGreaterThan(0);
                expect(c.y, `the transposed y-walk is the x-walk on the transposed rect ${JSON.stringify(c.rect)}`).toEqual(c.x);
            }
        });

/**
 * ── PROOF D — THE PACKED SLOT'S CLEAR PHASE **IS** THE WIZARD PATH ────────────────────────────────────────────────
 *
 * The whole point of the delegation, asserted per phase (the t1406 shape): slice the CLEAR out of the packed macro,
 * seed the #2600 pendant registers the way the controller does, trace it, and require the resolved motion to equal
 * the wizard-path atom emitted at the same values. Twelve combinations — both strategies × three directions × both
 * row axes — and the pendant values are deliberately NOT the field defaults, so a register that fails to reach the
 * body shows up as a different cut rather than as a coincidence.
 */
test('PROOF D — the packed clear cuts exactly what the wizard path cuts, on every carried pick', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ TRACE }) => {
        const { pocketSlot } = await import('/data/millToSlot.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const { traceToolpath } = await import('/engine/trace.js');
        // eslint-disable-next-line no-eval
        const trace = eval(TRACE);
        const D = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { exposed: false, value: v }]));
        const V = { w: 90, h: 55, depth: 4, stepdown: 1.5, stepoverPct: 35, toolDia: 8, feed: 620, plunge: 160, clearance: 12, rpm: 9000 };
        const out = [];
        for (const strategy of ['raster', 'spiral'])
            for (const direction of ['bothways', 'oneway', 'otherway'])
                for (const rowAxis of ['x', 'y']) {
                    const g = pocketSlot(new Set(), 0, rowAxis, D({ strategy, direction, entry: 'plunge' }));
                    const lines = g.body.split('\n');
                    const s = lines.findIndex((l) => /---- (AREA CLEARING|SURFACING)/.test(l));
                    const e = lines.findIndex((l) => /wall finish pass at the inset boundary|^M5 /.test(l));
                    const packed = g.fields.map((f) => `#${f.idx + 1500}=${V[f.key]}`)
                        .concat(lines.slice(0, s), lines.slice(s, e)).join('\n');
                    const ref = surfaceRasterLines({ x: 0, y: 0, z0: 0, w: V.w, h: V.h, inset: V.toolDia / 2,
                        depth: V.depth, stepdown: V.stepdown, toolDia: V.toolDia, stepoverPct: V.stepoverPct,
                        feed: V.feed, plunge: V.plunge, clearance: V.clearance, entry: 'plunge',
                        strategy: strategy === 'spiral' ? 'concentric' : 'parallel', direction, rowAxis }).join('\n');
                    out.push({ k: `${strategy}/${direction}/${rowAxis}`, packed: trace(traceToolpath, packed), ref: trace(traceToolpath, ref),
                        header: lines[s] || '', sliced: s >= 0 && e > s });
                }
        return out;
    }, { TRACE });

    for (const c of r) {
        expect(c.sliced, `${c.k}: the packed macro really contains the atom's clear phase`).toBe(true);
        expect(c.header, `${c.k}: and it announces itself as area clearing, not as surfacing`).toContain('AREA CLEARING');
        expect(c.ref.length, `${c.k}: the wizard-path reference cuts`).toBeGreaterThan(0);
        expect(c.packed, `${c.k}: the packed clear resolves to the wizard path, move for move (${c.packed.length} vs ${c.ref.length})`).toEqual(c.ref);
    }
});

/**
 * ── PROOF E — NO KNOB THE SLOT HONOURS GOES DARK ──────────────────────────────────────────────────────────────────
 *
 * The requirement this act was gated on, asserted the only way that means anything: change ONE pendant field and the
 * TRACED motion must change. A test that asserted the register merely APPEARS in the text is the test that would have
 * passed on both defects this act closes — `#5` appeared in `#44=[#9 * 60 / 100]`'s neighbourhood and did nothing.
 *
 * `rpm` is the one exemption and it is named rather than skipped: it commands the spindle, not the path, so it is
 * asserted on the S word instead.
 */
test('PROOF E — every POCKET_FIELDS knob drives the traced motion (rpm drives the spindle word)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async ({ TRACE }) => {
        const { pocketSlot } = await import('/data/millToSlot.js');
        const { traceToolpath } = await import('/engine/trace.js');
        // eslint-disable-next-line no-eval
        const trace = eval(TRACE);
        const D = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { exposed: false, value: v }]));
        const BASE = { w: 90, h: 55, depth: 4, stepdown: 1.5, stepoverPct: 35, toolDia: 8, feed: 620, plunge: 160, clearance: 12, rpm: 9000 };
        const BUMP = { w: 70, h: 40, depth: 6, stepdown: 1, stepoverPct: 55, toolDia: 6, feed: 900, plunge: 90, clearance: 20, rpm: 12000 };
        const build = (vals, picks) => {
            const g = pocketSlot(new Set(), 0, 'x', D(picks || { strategy: 'raster', direction: 'bothways', entry: 'plunge' }));
            return g.fields.map((f) => `#${f.idx + 1500}=${vals[f.key]}`).concat(g.body.split('\n')).join('\n');
        };
        const base = build(BASE), bp = trace(traceToolpath, base);
        const knobs = {};
        for (const k of Object.keys(BASE)) {
            const nc = build({ ...BASE, [k]: BUMP[k] });
            knobs[k] = { moved: JSON.stringify(trace(traceToolpath, nc)) !== JSON.stringify(bp), sWord: /M3 S\[#\d+\]/.test(nc) };
        }
        return { knobs, moves: bp.length, cuts: bp.filter((l) => l[0] === 'C').length,
            fields: pocketSlot(new Set(), 0, 'x').fields.map((f) => f.key) };
    }, { TRACE });

    expect(r.moves, 'the packed slot moves at all').toBeGreaterThan(0);
    expect(r.cuts, 'and cuts').toBeGreaterThan(0);
    expect(r.fields, 'the slot exposes the ten knobs — and stepover is a PERCENTAGE now (ruled blocker 2)')
        .toEqual(['w', 'h', 'depth', 'stepdown', 'stepoverPct', 'toolDia', 'feed', 'plunge', 'clearance', 'rpm']);
    for (const k of Object.keys(r.knobs)) {
        if (k === 'rpm') { expect(r.knobs.rpm.sWord, 'rpm commands the spindle, which is why it moves no axis').toBe(true); continue; }
        expect(r.knobs[k].moved, `${k}: dialling it CHANGES the traced motion — nothing goes dark`).toBe(true);
    }
});

/**
 * ── PROOF F — THE PICKS ARE CARRIED, AND THE ONE THAT CANNOT BE SAYS SO IN THE PROGRAM ────────────────────────────
 *
 * t1412's defect, inverted: the macro now differs per arm for all three picks. `entry` is the honest exception and it
 * is the atom's own convention rather than a new mechanism — ramp and helix compute their geometry from a FIXED area
 * and this slot's area is a pendant knob, so the emitter degrades to the plunge it can always do correctly and prints
 * the reason on the line where it descends. The row says the same thing before a chip is cut (GENERATOR_BAKES_PICK).
 */
test('PROOF F — strategy, direction and entry all reach the macro; a ramp degrades in the open', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketSlot } = await import('/data/millToSlot.js');
        const D = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { exposed: false, value: v }]));
        const body = (over) => pocketSlot(new Set(), 0, over.rowAxis || 'x',
            D({ strategy: 'raster', direction: 'bothways', entry: 'plunge', ...over })).body;
        const base = body({});
        return {
            base, strategy: body({ strategy: 'spiral' }), direction: body({ direction: 'oneway' }),
            entry: body({ entry: 'ramp' }), helix: body({ entry: 'helix' }), rowAxis: body({ rowAxis: 'y' }),
        };
    });

    expect(r.strategy, 'a SPIRAL pocket packs a different macro — the t1412 lie is gone').not.toBe(r.base);
    expect(r.direction, 'and so does a ONE-WAY one').not.toBe(r.base);
    expect(r.entry, 'and a RAMP one').not.toBe(r.base);
    expect(r.rowAxis, 'and rows ∥ Y').not.toBe(r.base);
    expect(r.entry, 'a ramp pick degrades to a plunge and SAYS so, on the descent line').toMatch(/ramp entry degraded to a plunge/);
    expect(r.helix, 'and a helix pick names itself in its own degrade').toMatch(/helix entry degraded to a plunge/);
    expect(r.entry, 'and emits no ramp move at all — it degrades, it does not half-ramp').not.toMatch(/\( ramp \)/);
    // THE WALL FOLLOWS THE STRATEGY, because that is what carrying it means: the concentric walk's outermost ring IS
    // the wall (the op's own help says a spiral has no separate wall pass), so a second one would be a wasted pass.
    expect(r.base, 'the raster pocket finishes with a wall pass, in its OWN depth loop after the clear (t1405)').toMatch(/wall finish pass at the inset boundary — its OWN depth loop/);
    expect(r.strategy, 'the spiral pocket has none — its outer ring already is the wall').not.toMatch(/wall finish pass/);
    // …and the slot refuses BEFORE any motion, because the atom's own guards fall through into the wall.
    expect(r.base, 'the positive guards refuse at the top, and end on M30 rather than falling into the wall').toMatch(/IF #\d+ LE 0 GOTO 7/);
    expect(r.base, 'with the reason the operator reads').toMatch(/ERROR: stepover \/ stepdown \/ tool \/ clearance must be > 0/);
});

/**
 * ── PROOF G — THE BANDS, NOW THAT THE ATOM'S BODY LIVES INSIDE THE SLOT'S PROGRAM ─────────────────────────────────
 *
 * t1425's PROOF 4 pinned the atom's band against the pocket's while they were still separate programs. They are one
 * program now, so the assertion moves with the fact: the pocket's DECLARED band must CONTAIN the atom's (that is what
 * stops a form field being minted onto a register the atom writes — the `#20 = rpm` class of failure this module
 * exists for), while the atom's band stays disjoint from the hand-written mill scratch it sits beside.
 */
test('PROOF G — the pocket declares the atom band it now writes, and no field var lands in it', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { RASTER_SCRATCH } = await import('/wizards/ops/surfaceraster.js');
        const { bandsFor, fieldVarCollisions } = await import('/data/camScratch.js');
        const { pocketSlot } = await import('/data/millToSlot.js');
        const spread = (bands) => { const s = new Set(); for (const [lo, hi] of bands) for (let n = lo; n <= hi; n++) s.add(n); return s; };
        const atom = spread(RASTER_SCRATCH), pocket = spread(bandsFor('pocket')), mill = spread(bandsFor('surface'));
        // a pocket built at a HIGH varOffset is the case that would have collided: its locals start where a previous
        // composed part's left off, which is how they reach #34+ in the first place.
        const far = pocketSlot(new Set(), 30, 'x');
        far.fields.forEach((f) => { f._op = 0; });
        return {
            missing: [...atom].filter((n) => !pocket.has(n)),
            millOverlap: [...atom].filter((n) => mill.has(n)),
            farVars: far.fields.map((f) => Number(String(f.var).replace('#', ''))),
            collisions: fieldVarCollisions(far.fields, [{ type: 'pocket' }]).map((c) => c.varNum),
        };
    });
    expect(r.missing, 'every register the atom writes is inside the pocket generator\'s declared band').toEqual([]);
    expect(r.millOverlap, 'and the atom still shares none with the hand-written mill scratch beside it').toEqual([]);
    expect(r.farVars.length, 'the far-offset pocket really did mint field vars').toBe(10);
    expect(r.collisions, 'none of which land on a register the pocket\'s own body writes').toEqual([]);
});
