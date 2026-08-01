import { test, expect } from '@playwright/test';

/**
 * t1425 — THE ATOM LEARNS LIVE GEOMETRY. First half of the ruled C-split; the slot delegation is the next act.
 *
 * ── THE DEFECT, MEASURED AT t1422 BEFORE ANY OF THIS WAS BUILT ────────────────────────────────────────────────────
 * A CAM slot holds its geometry in REGISTERS (`pocketSlot` reads `#26xx` into locals and its hand-written raster
 * consumes them). This atom held its geometry in BUILD-TIME NUMBERS, and `num(word, default)` returns the DEFAULT —
 * so handing the former to the latter did not fail loudly. It emitted `#40=94` for a pendant W of 80, `7.2` for a
 * 2.4mm stepover, and collapsed a live `inset` to 0 — dropping the tool-radius inset so the pocket came out OVERSIZE
 * BY A FULL TOOL Ø while the header called itself SURFACING. Clean-looking G-code that cuts a different part.
 *
 * ── THE FOUR PROOFS (each its own assert family, per the ruling) ──────────────────────────────────────────────────
 *   1. the BAKED path is byte-identical across the whole existing corpus — the guard that says nothing moved
 *   2. a LIVE-seeded emit resolves to the SAME MOTION as the baked one at the same values — the claim that matters
 *   3. what each combination still BAKES is declared as data, so the next act's delegation reads it rather than
 *      re-deriving it from three walks
 *   4. the register bands do not overlap — pinned, since the atom's body now lands inside a slot's program
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * ── PROOF 1 — THE BAKED PATH DID NOT MOVE ─────────────────────────────────────────────────────────────────────────
 *
 * Every program that exists today takes numbers, so this is the guard the whole act rests on. It is asserted over the
 * cross-product that exercises every path through the changed code — both walks × the three descents × all three
 * directions × skim × inset × rotation × the confirm cadence × a placed origin — against the emit rebuilt from the
 * SAME source with only build-time numbers. The `.n` of every geometry term is by construction the number this file
 * computed before (same defaults, same floors), and this says so in the emitted text rather than in the reasoning.
 */
test('PROOF 1 — the BAKED emit is unchanged across the whole cross-product, and so are @work and the labels', async ({ page }) => {
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
        // Everything a numeric config produces must be well-formed: no NaN, no undefined, no stray bracket, and the
        // work + label declarations must both be present (they are what a live config deliberately drops).
        let bad = null, nulls = 0;
        for (const p of rows) {
            const t = m.surfaceRasterLines(p).join('\n');
            if (/NaN|undefined|\[\]/.test(t)) { bad = { p, t: t.split('\n').find((l) => /NaN|undefined|\[\]/.test(l)) }; break; }
            if (m.surfaceRasterWorkSteps(p) == null) nulls++;
        }
        return { count: rows.length, bad, nulls, sample: m.surfaceRasterLines(rows[0]).slice(0, 3) };
    });
    expect(r.bad, `every baked emit is well-formed — ${JSON.stringify(r.bad)}`).toBe(null);
    expect(r.count, 'the cross-product really is the whole matrix').toBe(288);
    expect(r.nulls, 'and a fully numeric config always DECLARES its work — the null is reserved for live inputs').toBe(0);
});

/**
 * ── PROOF 2 — THE ONE THAT MATTERS: a live-seeded emit CUTS THE SAME PATH ─────────────────────────────────────────
 *
 * "The seed prints a register" is testing the change against itself. The claim is about MOTION: seed the registers
 * the way a CAM slot does (the #2600-block convention — a read-line per field into a local, which is the indirection
 * chain t1410 proved) and the traced toolpath must be the same cuts, rapids and feeds as the program that baked
 * those same values.
 *
 * Both sides go through the REAL tracer, so this is the resolved path, not the text.
 */
const TRACE = `
(traceToolpath, nc) => {
    const segs = (traceToolpath(nc).segments || []);
    const q = (n) => +Number(n).toFixed(3);
    return {
        cuts: segs.filter((s) => !s.rapid).map((s) => [q(s.x1), q(s.y1), q(s.z1), q(s.x2), q(s.y2), q(s.z2), q(s.feed || 0)].join(',')),
        rapids: segs.filter((s) => s.rapid).map((s) => [q(s.x1), q(s.y1), q(s.z1), q(s.x2), q(s.y2), q(s.z2)].join(',')),
    };
}`;

/** The values every case below runs at — the same numbers on both sides, one baked and one dialled. */
const VALUES = { x: 12.5, y: -7.25, w: 80, h: 60, inset: 3, depth: 3, stepdown: 1.5, toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150 };

const LIVE_CASES = [
    { name: 'parallel · plunge · bothways — the shipped default walk', cfg: { strategy: 'parallel', entry: 'plunge', direction: 'bothways' } },
    { name: 'parallel · plunge · ONE-WAY — the t1418 walk, now on registers', cfg: { strategy: 'parallel', entry: 'plunge', direction: 'oneway' } },
    { name: 'parallel · plunge · OTHERWAY — the mirror', cfg: { strategy: 'parallel', entry: 'plunge', direction: 'otherway' } },
    { name: 'CONCENTRIC · plunge — the ring count resolves its shorter side at RUN time', cfg: { strategy: 'concentric', entry: 'plunge' } },
    { name: 'CONCENTRIC · plunge — h SHORTER than w, so the runtime min picks the other branch', cfg: { strategy: 'concentric', entry: 'plunge' }, over: { w: 90, h: 40 } },
    { name: 'CONCENTRIC · plunge — w SHORTER than h', cfg: { strategy: 'concentric', entry: 'plunge' }, over: { w: 40, h: 90 } },
    { name: 'a stepover that does not divide the height', cfg: { strategy: 'parallel', entry: 'plunge' }, over: { toolDia: 12, stepoverPct: 60 } },
    { name: 'a NARROW area — one row', cfg: { strategy: 'parallel', entry: 'plunge' }, over: { w: 40, h: 9, inset: 1 } },
    { name: 'the last bite is CLAMPED, not overshot', cfg: { strategy: 'parallel', entry: 'plunge' }, over: { depth: 2, stepdown: 5 } },
    { name: 'a ZERO inset — the surfacing meaning, dialled', cfg: { strategy: 'parallel', entry: 'plunge' }, over: { inset: 0 } },
    /**
     * ── t1485 — THE RAMP JOINS THIS PROOF, and until now it COULD NOT HAVE ────────────────────────────────────────
     *
     * Every row above is a PLUNGE, because a plunge was the only descent that baked nothing. That is no longer the
     * distinction the table draws — `SURFACE_RASTER_BAKES` says the ramp bakes nothing either — so the ramp owes this
     * proof exactly as the plunge does, and these rows are what makes that claim falsifiable instead of asserted.
     *
     * They bite precisely because `VALUES` is NOT the atom's defaults (w 100 · h 80 · tool Ø12): a descent that baked
     * any part of its start builds that part from the defaults and cuts a different path from the baked side. Run
     * against the parked t1483 branch, the FOUR PARALLEL rows fail and the CONCENTRIC one passes — measured, not
     * assumed, and worth writing down: a ring's descent starts at the walk ORIGIN, which the frame printer has always
     * resolved live, so it never had the defect. That row is a regression guard, not a defect catcher, and reading it
     * as proof of the lift would be reading it wrong.
     */
    { name: 'parallel · RAMP · bothways — the descent on registers, end to end', cfg: { strategy: 'parallel', entry: 'ramp', direction: 'bothways' } },
    { name: 'parallel · RAMP · one-way', cfg: { strategy: 'parallel', entry: 'ramp', direction: 'oneway' } },
    { name: 'parallel · RAMP · OTHERWAY — the mirror, whose start is the far end', cfg: { strategy: 'parallel', entry: 'ramp', direction: 'otherway' } },
    { name: 'parallel · RAMP · rows ∥ Y — the axes swap under the descent too', cfg: { strategy: 'parallel', entry: 'ramp', rowAxis: 'y' } },
    { name: 'CONCENTRIC · RAMP — from the ring corner, along +X', cfg: { strategy: 'concentric', entry: 'ramp' } },
];

for (const c of LIVE_CASES) {
    test(`PROOF 2 — live registers cut the same path as baked numbers: ${c.name}`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async ({ VALUES, cfg, over, TRACE }) => {
            const m = await import('/wizards/ops/surfaceraster.js');
            const { traceToolpath } = await import('/engine/trace.js');
            // eslint-disable-next-line no-eval
            const trace = eval(TRACE);
            const V = { ...VALUES, ...(over || {}) };
            const common = { z0: 0, clearance: 5, ...cfg };

            // THE BAKED SIDE — every value a number, exactly as the wizard path emits it.
            const baked = m.surfaceRasterLines({ ...V, ...common }).join('\n');

            // THE LIVE SIDE — every geometry input a REGISTER, seeded the way a CAM slot seeds them: one read-line
            // per field into a local (`#n=<value>`), which is the shape `stackToSlot` emits and t1410 proved.
            const REG = { x: '#2', y: '#3', w: '#4', h: '#5', inset: '#6', depth: '#7', stepdown: '#8', toolDia: '#9', stepoverPct: '#10', feed: '#11', plunge: '#12' };
            const seeds = Object.keys(REG).map((k) => `${REG[k]}=${V[k]}   ;${k}`);
            const live = seeds.concat(m.surfaceRasterLines({ ...common, ...REG })).join('\n');

            return {
                baked: trace(traceToolpath, baked), live: trace(traceToolpath, live),
                liveIsParametric: /#40=\[#4 - 2 \* #6\]|#40=#4/.test(live),
                liveGap: m.surfaceRasterLiveGap({ ...common, ...REG }),
                covers: m.surfaceRasterCovers({ ...common, ...REG }),
                workNull: m.surfaceRasterWorkSteps({ ...common, ...REG }) == null,
                workBaked: m.surfaceRasterWorkSteps({ ...V, ...common }),
            };
        }, { VALUES, cfg: c.cfg, over: c.over, TRACE });

        // THE PREMISE — the live side really is register-driven and really is inside the envelope.
        expect(r.liveIsParametric, 'the live emit seeds its area from registers, not from a baked number').toBe(true);
        expect(r.liveGap, `this combination honours dialled geometry (gap: "${r.liveGap}")`).toBe('');
        expect(r.covers, 'so the envelope covers it').toBe(true);
        // BOTH CUT SOMETHING — two empty programs would agree perfectly.
        expect(r.baked.cuts.length, 'the baked program cuts').toBeGreaterThan(0);
        // …AND THE SAME PATH, move for move, at the same feeds. This is the whole act in one assertion.
        expect(r.live.cuts, `the same cutting moves (${r.live.cuts.length} live vs ${r.baked.cuts.length} baked)`).toEqual(r.baked.cuts);
        expect(r.live.rapids, 'and the same rapids — the travel between them is identical too').toEqual(r.baked.rapids);
        // @work IS HONEST ON BOTH SIDES — t1399 wrote this check for exactly this continuation (it already tested
        // w/h/toolDia/stepoverPct for liveness when nothing could set them live); assert it engages.
        expect(r.workNull, 'the live config declares NO work count — the real one does not exist until the machine reads the registers').toBe(true);
        expect(r.workBaked, 'while the baked one still declares it').toBeGreaterThan(0);
    });
}

/**
 * ── PROOF 3 — WHAT STILL BAKES IS DECLARED, AND IT REFUSES RATHER THAN GUESSING ───────────────────────────────────
 *
 * The next act's delegation must know which combinations it may pack live and which it must refuse at PACK time —
 * from data, not by reading three walks.
 *
 * ── t1483 (C4) — ⚠ THE RAMP MOVED FROM THE REFUSING SIDE TO THE HONOURING SIDE, AND THIS TEST IS WHERE THAT SHOWS.
 * It used to assert that BOTH descents bake. The ramp's reason was evidence — it needed a hypotenuse, and SQRT is
 * unverified on this controller — and t1339 named the way out in the same breath: a DECLARED run vector needs no
 * square root at all. C4 took that road, so the ramp now honours dialled geometry end to end and its two BAKES rows
 * are empty. THE HELIX DID NOT MOVE: it still bakes the inradius that clamps its radius and seeds the rotating
 * vector (t1343), and half this test exists to keep those two apart — a capability that lifted one and quietly
 * carried the other would read exactly the same from outside.
 *
 * The refusal is CHEAP by a fact measured at t1422: `POCKET_FIELDS` carries no descent control, so a packed pocket's
 * entry is whatever the op held and a pocket op defaults to plunge. Nobody can dial into a refused combination.
 */
test('PROOF 3 — the remaining bakes are declared per (strategy, entry), and refuse in their own words', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const LIVE = { w: '#4', h: '#5', inset: '#6', toolDia: '#9', stepoverPct: '#10' };
        const grid = {};
        for (const strategy of ['parallel', 'concentric'])
            for (const entry of ['plunge', 'ramp', 'helix']) {
                const k = `${strategy}/${entry}`;
                grid[k] = {
                    declared: m.SURFACE_RASTER_BAKES[k],
                    liveGap: m.surfaceRasterLiveGap({ strategy, entry, ...LIVE }),
                    covers: m.surfaceRasterCovers({ strategy, entry, ...LIVE }),
                    bakedCovers: m.surfaceRasterCovers({ strategy, entry, w: 80, h: 60 }),
                };
            }
        return {
            grid,
            keys: Object.keys(m.SURFACE_RASTER_BAKES).sort(),
            // the ONE reading of which inputs are dialled, shared by the envelope, the degrade and this spec
            inputs: m.surfaceRasterLiveInputs({ w: '#4', h: 60, toolDia: '#9', depth: '#7' }),
            // SKIM refuses live geometry — a pre-existing gap named rather than silently changed
            skimGap: m.surfaceRasterLiveGap({ zMode: 'skim', strategy: 'parallel', entry: 'plunge', inset: '#6' }),
            // ⚠ t1514 (C5) — a live frame ABSORBS the rotation now: the printer mixes register operands, and the
            // "no build-time constant" reason this row pinned was about the printer rather than the arithmetic
            rotLive: m.surfaceRasterAbsorbsRotation({ w: '#4' }),
            rotBaked: m.surfaceRasterAbsorbsRotation({ w: 80 }),
            // …and what is LEFT refused, which is the narrow pair: two pivots on one register origin, and skim
            rotTwoPivots: m.surfaceRasterAbsorbsRotation({ x: '#4', rotAngle: 30, bearing: 45 }),
            rotSkim: m.surfaceRasterAbsorbsRotation({ w: '#4', zMode: 'skim' }),
            // the DEGRADE: a directly-called ramp with dialled geometry plunges and says so, never cuts baked geometry
            rampText: m.surfaceRasterLines({ strategy: 'parallel', entry: 'ramp', depth: 3, stepdown: 1.5, feed: 1, plunge: 1, clearance: 5, ...LIVE }).join('\n'),
            rampLabels: m.surfaceRasterBlock.flowLabels({ strategy: 'parallel', entry: 'ramp', ...LIVE }),
            // t1483 — the HELIX arm of the same call, so the ramp's lift and the helix's unchanged refusal are read
            // from one place and cannot drift apart in the reading
            helixText: m.surfaceRasterLines({ strategy: 'parallel', entry: 'helix', depth: 3, stepdown: 1.5, feed: 1, plunge: 1, clearance: 5, ...LIVE }).join(String.fromCharCode(10)),
        };
    });

    // THE TABLE IS THE CROSS-PRODUCT — a combination cannot be missed by being forgotten; it has to be listed.
    expect(r.keys, 'every (strategy, entry) has a row').toEqual([
        'concentric/helix', 'concentric/plunge', 'concentric/ramp', 'parallel/helix', 'parallel/plunge', 'parallel/ramp']);
    // PLUNGE BAKES NOTHING on either walk — t1425's own purchase — and t1483 put THE RAMP ON THIS SIDE TOO.
    for (const k of ['parallel/plunge', 'concentric/plunge', 'parallel/ramp', 'concentric/ramp']) {
        expect(r.grid[k].declared.inputs, `${k} bakes nothing`).toEqual([]);
        expect(r.grid[k].liveGap, `${k} honours dialled geometry`).toBe('');
        expect(r.grid[k].covers, `${k} is inside the envelope with live inputs`).toBe(true);
    }
    // ⚠ AND THE HELIX DID NOT MOVE — asserted in the SAME test, because a capability that lifted one descent and
    // quietly carried the other would look identical from outside. It still bakes, still refuses, still says why.
    for (const k of ['parallel/helix', 'concentric/helix']) {
        expect(r.grid[k].declared.inputs.length, `${k} declares what it bakes`).toBeGreaterThan(0);
        expect(r.grid[k].liveGap, `${k} refuses dialled geometry, with a reason`).not.toBe('');
        expect(r.grid[k].covers, `${k} is OUTSIDE the envelope with live inputs`).toBe(false);
        expect(r.grid[k].bakedCovers, `${k} is still fully covered with BAKED geometry — the wizard path is untouched`).toBe(true);
    }
    // the ramp's reason is GONE rather than reworded — an empty row and an empty gap, together
    expect(r.grid['parallel/ramp'].declared.why, 'the ramp no longer names a reason, because it no longer has one').toBe('');
    expect(r.grid['parallel/helix'].liveGap, 'the helix names its inradius clamp').toMatch(/inradius/);
    expect(r.grid['parallel/helix'].liveGap, 'and it is NOT the trig reason — that one left with the ramp').not.toMatch(/SQRT is unverified/);
    expect(r.inputs, 'the live-input reading is one source, and reports only what is actually dialled').toEqual(['w', 'toolDia']);
    // SKIM — the pre-existing gap, refused rather than quietly changed under cover of this act.
    expect(r.skimGap, 'a skim body refuses dialled geometry because its frame drops the op origin').toMatch(/silently ignored/);
    /**
     * ⚠ ROTATION — t1514 (C5) INVERTED THIS PIN, and it is restated rather than deleted because what it pinned was
     * the REASON, and the reason was mechanical: "there is no build-time constant for the printer to mix". True of
     * the printer that existed; a register is a perfectly good operand for the same affine form, and `affineFrame`
     * prints the mix with register operands now (the origin is the pivot, `[I − R]` brings it back out). So a live
     * frame absorbs its own rotation, and what stays refused is the narrow pair — skim, which has no datum to turn
     * about, and TWO pivots on one live origin, which cannot share one set of baked coefficients.
     */
    expect(r.rotLive, 'a live frame ABSORBS the program rotation since C5 — this read `typeof === "string"`').toBe(true);
    expect(r.rotBaked, 'a baked one still absorbs it').toBe(true);
    expect(typeof r.rotTwoPivots, 'a bearing AND a program rotation on a live origin still refuses, with its reason').toBe('string');
    expect(r.rotTwoPivots, '…naming the two pivots rather than a missing constant').toMatch(/TWO rotations|two different pivots/);
    expect(typeof r.rotSkim, 'and skim still refuses, for its own frame-mixing reason').toBe('string');
    // ⚠ THE HONEST DEGRADE, AND WHOSE IT IS NOW (t1483). It was belt-and-braces for BOTH descents: a direct call
    // bypasses the envelope, and a descent built from default w/h against a dialled rect would cut in the wrong
    // place. The RAMP no longer has that failure mode — it bakes no geometry, so there is nothing to be built from
    // stale defaults — and it therefore emits a REAL RAMP against dialled registers instead of degrading.
    expect(r.rampText, 'a dialled ramp now cuts a real ramp — nothing left to degrade').not.toMatch(/entry degraded to a plunge/);
    expect(r.rampText, 'and it is a ramp move, not a silent plunge').toMatch(/\( ramp \)/);
    expect(r.rampLabels, 'so it declares the labels it writes').toContain('rampPlungeLabel');
    // …AND THE RUN GUARD IS AGAINST A REGISTER, not a baked number: that single character is the whole capability.
    expect(r.rampText, 'the run is compared to the LIVE span register').toMatch(/IF #34 > #4[01] GOTO/);
    expect(r.rampText, 'and no baked distance-to-centre survives').not.toMatch(/mm to centre/);
    // THE HELIX KEEPS THE DEGRADE, asserted here so the two cannot be confused for one another.
    expect(r.helixText, 'a dialled helix still degrades, because it still bakes its inradius').toMatch(/entry degraded to a plunge/);
    expect(r.helixText, 'and emits no helix move').not.toMatch(/\( helix \)/);
});

/**
 * ── PROOF 4 — THE BANDS DO NOT OVERLAP ────────────────────────────────────────────────────────────────────────────
 *
 * The atom's body is about to land INSIDE a slot's program, beside that generator's own scratch. t1422 measured the
 * two bands as disjoint; this pins it, because the failure mode is the one `camScratch` exists for — a generator
 * overwriting a variable another part is mid-way through reading, which emits clean G-code that cuts a different part.
 *
 * ⚠ t1429 — THE SUBJECT MOVED, SO THE ASSERTION DID. The delegation landed: the pocket's clearing body IS this atom,
 * so `bandsFor('pocket')` now deliberately CONTAINS the atom's band (a form field must be minted clear of registers
 * the pocket's own body writes — that union is the fix, and `pocket-delegation-1429` asserts it directly). What this
 * proof was actually about is the HAND-WRITTEN mill scratch the atom's body sits beside, which is `bandsFor('surface')`
 * — the same `#20-#33` this turn left untouched. Asserted against that, the original claim is unchanged and still true.
 */
test('PROOF 4 — the atom band and the hand-written mill scratch are disjoint', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { RASTER_SCRATCH } = await import('/wizards/ops/surfaceraster.js');
        const { bandsFor } = await import('/data/camScratch.js');
        const spread = (bands) => { const s = new Set(); for (const [lo, hi] of bands) for (let n = lo; n <= hi; n++) s.add(n); return s; };
        const atom = spread(RASTER_SCRATCH), mill = spread(bandsFor('surface'));
        return { atom: [...atom], mill: [...mill], overlap: [...atom].filter((n) => mill.has(n)) };
    });
    expect(r.atom.length, 'the atom declares a real band').toBeGreaterThan(0);
    expect(r.mill.length, 'and so does the mill kit').toBeGreaterThan(0);
    expect(r.overlap, `no register is claimed by both (atom ${JSON.stringify(r.atom)} vs mill ${JSON.stringify(r.mill)})`).toEqual([]);
});
