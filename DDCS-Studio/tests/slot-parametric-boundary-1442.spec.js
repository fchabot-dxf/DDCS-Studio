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
            insetXs, slotXs, bearings, arcs,
            slotRamp: firstCut(slotEntry('ramp')), atomRamp: firstCut(atomEntry('ramp')),
            slotHelix: firstCut(slotEntry('helix')), atomHelix: firstCut(atomEntry('helix')),
            gap: h.SLOT_RASTER_GAP,
        };
    }, { H: HARNESS, SLOT });

    // 2 — ANISOTROPIC INSET
    expect(r.slotXs, 'the slot runs its full centreline, A to B').toEqual([0, 60]);
    expect(r.insetXs, 'the atom holds the SAME inset along the length — a 54mm channel where 60 was asked').toEqual([3, 57]);
    expect(r.gap).toContain('a 60mm slot walks 3..57');

    // 3 — THE BEARING, and the arc-ends hypothesis REFUTED rather than assumed
    expect(r.bearings.filter((b) => Math.abs(Math.abs(b) - 30) < 0.01 || Math.abs(Math.abs(b) - 150) < 0.01).length,
        'a 30° slot cuts its passes on the 30° bearing').toBeGreaterThan(0);
    expect(r.arcs, 'and NO width emits an arc — the ends are round because the TOOL is, not because a G2/G3 says so').toEqual([0, 0, 0]);

    // 4 — THE DESCENT
    expect(r.slotRamp[1], 'the slot ramps ALONG its length: the pass Y never changes').toBeCloseTo(r.slotRamp[3], 3);
    expect(r.atomRamp[1] === r.atomRamp[3], 'the atom ramps toward the AREA CENTRE, so its Y drifts across the channel').toBe(false);
    expect(r.slotHelix[0], 'the slot helixes at the ENTRY END').toBeLessThan(10);
    expect(r.atomHelix[0], '…the atom in the MIDDLE of the channel, which it then cuts back out of').toBeGreaterThan(25);
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
        const { camTypeOf, GENERATOR_IGNORES, generatorIgnores } = await import('/data/opCamMap.js');
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
        };
    }, { H: HARNESS });

    // THE MEASURED DROP — the op's width, its stepover, its descent and its plunge feed have no field at all
    expect(r.dropped, 'the generator has no field for any of these').toEqual(
        expect.arrayContaining(['width', 'toolDia', 'stepoverPct', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'plunge', 'pattern']));
    expect(r.keys, '…and carries exactly these').toEqual(['ax', 'ay', 'bx', 'by', 'depth', 'stepdown', 'feed', 'clearance', 'rpm']);
    // WHAT IT COSTS, in millimetres: the wizard cuts the typed width, the macro cuts the tool
    expect(r.wizardWidth, 'the wizard cuts the 12mm channel that was typed').toBeCloseTo(12, 3);
    // t1444 — …and a slot the macro would cut WRONGLY no longer reaches it: the pack refuses, by name, with the exit
    expect(r.camRoute.camType, 'a 12mm-wide slot no longer packs the centreline generator').toBeUndefined();
    expect(r.camRoute.unsupported, 'it is refused at PACK, in the operator\'s own terms').toContain('ONE centreline pass');
    expect(r.camRoute.unsupported, '…with somewhere to go, because "unsupported" alone makes the operator guess').toContain('Slot wizard');
    expect(r.camEqual.camType, 'and the case the macro DOES cut correctly still packs — width == tool').toBe('slot');
    // THE PLUNGE FEED IS DROPPED TOO — the macro descends at the CUTTING feed
    expect(r.zLine, 'the Z descent rides F#7, the cut feed — the op\'s plunge feed has no field').toBe('G1 Z[-#50] F#7');
    // AND NOTHING DECLARES ANY OF IT
    expect(r.slotIgnores, 'GENERATOR_IGNORES has no slot key at all — the drop is undeclared').toBeNull();
    expect(r.entrySentence, 'so a ramp/helix pick reaches the pendant with nothing said about it').toBe('');
});
