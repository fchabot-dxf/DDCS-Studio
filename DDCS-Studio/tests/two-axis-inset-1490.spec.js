import { test, expect } from '@playwright/test';

/**
 * t1490 (C2) — THE ANISOTROPIC (TWO-AXIS) INSET. Slot capability arc 2/4.
 *
 * ── THE DEFECT, MEASURED AT t1442 BEFORE ANY OF THIS WAS BUILT ────────────────────────────────────────────────────
 * The atom held ONE inset and moved it on BOTH axes (w − 2i, h − 2i). A slot needs `tool/2` ACROSS its width and
 * NOTHING along its length — the tool centre runs the full centreline, A to B. Handing the atom a tool radius walked
 * a 60mm slot from x=3 to x=57: a 54mm channel where 60 was asked, in the NARROW direction, which leaves stock.
 *
 * ── THE TWO ARMS THE ARC'S C2 ROW ASKS FOR ───────────────────────────────────────────────────────────────────────
 *   the STAY  — "the single-inset case must stay BYTE-IDENTICAL: the existing callers pass one number and must keep
 *               emitting exactly what they emit today". Asserted over the cross-product, not a sample.
 *   the GAIN  — "(tool/2, 0) against slotPath's own span": the walked rect becomes the slot's own rect.
 *
 * ⚠ AND WHAT C2 DOES **NOT** DO, asserted here so nobody reads this capability as more than it is: the atom is still
 * not slot-ready. C2 fixes the walked SPAN. The ROWS inside that span are still uniformly spaced half a stepover in,
 * so a 12mm-wide slot is still walked −1.8..3 where the slot needs −3..3. That is C1 (phase + clamp, which the arc
 * rules must land as ONE step or it ships a gouge), and C1's own `stepsAfter` names C2 as its precondition. A
 * capability that let itself be read as the whole fix is how a boundary quietly stops being true.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * ── THE STAY — one inset and an EVEN pair are the same program, character for character ───────────────────────────
 *
 * Over the whole cross-product that reaches the changed seeds: both walks × three descents × three directions × both
 * ROW AXES (the pair maps through `rowAxis`, so this is the axis that could transpose it) × skim × rotation × a LIVE
 * inset. 432 configs. The existing corpus passes ONE number, so this is the guard the whole act rests on.
 */
test('THE STAY — a single inset and an EVEN pair emit the same program, across the cross-product', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        let count = 0; const differ = [];
        for (const strategy of ['parallel', 'concentric'])
            for (const entry of ['plunge', 'ramp', 'helix'])
                for (const direction of ['bothways', 'oneway', 'otherway'])
                    for (const rowAxis of ['x', 'y'])
                        for (const zMode of ['', 'skim'])
                            for (const inset of [0, 3, '#6'])
                                for (const rotAngle of [0, 17]) {
                                    count++;
                                    const base = { x: 12.5, y: -7.25, z0: 2, w: 80, h: 60, depth: 3, stepdown: 1.5,
                                        toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5, strategy,
                                        entry, direction, rowAxis, zMode, rotAngle, rotPivotX: 3, rotPivotY: 4,
                                        rampAngle: 3, helixDia: 4, helixPitch: 0.75 };
                                    const NL = String.fromCharCode(10);
                                    const one = m.surfaceRasterLines({ ...base, inset }).join(NL);
                                    const pair = m.surfaceRasterLines({ ...base, insetAlong: inset, insetAcross: inset }).join(NL);
                                    if (one !== pair) differ.push({ strategy, entry, direction, rowAxis, zMode, inset, rotAngle });
                                }
        return { count, differ };
    });
    expect(r.count, 'the cross-product really is the whole matrix that reaches the seeds').toBe(432);
    expect(r.differ, `every config emits identically — ${JSON.stringify(r.differ.slice(0, 3))}`).toEqual([]);
});

/**
 * ── THE GAIN — an anisotropic pair walks the slot's own span ─────────────────────────────────────────────────────
 *
 * The traced WALK box, because the claim is about where the tool goes, not about which words the seeds print.
 */
test('THE GAIN — (along 0, across tool/2) walks the FULL centreline, where one inset ate 3mm off each end', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const q = (v) => +Number(v).toFixed(3);
        const box = (lines) => {
            const s = (traceToolpath(['G90', ...lines, 'M30'].join(NL)).segments || []).filter((x) => !x.rapid);
            return { minX: q(Math.min(...s.map((v) => Math.min(v.x1, v.x2)))), maxX: q(Math.max(...s.map((v) => Math.max(v.x1, v.x2)))),
                minY: q(Math.min(...s.map((v) => Math.min(v.y1, v.y2)))), maxY: q(Math.max(...s.map((v) => Math.max(v.y1, v.y2)))) };
        };
        // a 60×12 slot, Ø6 @40% — t1442's own measuring config
        const SLOT = { x: 0, y: -6, z0: 0, w: 60, h: 12, depth: 1.5, stepdown: 1.5, toolDia: 6, stepoverPct: 40,
            feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel', direction: 'bothways', entry: 'plunge', rowAxis: 'x' };
        return {
            one: box(m.surfaceRasterLines({ ...SLOT, inset: 3 })),
            pair: box(m.surfaceRasterLines({ ...SLOT, insetAlong: 0, insetAcross: 3 })),
            // the pair is named by ROLE, so turning the rows 90° must move the inset with them
            turned: box(m.surfaceRasterLines({ ...SLOT, x: -6, y: 0, w: 12, h: 60, rowAxis: 'y', insetAlong: 0, insetAcross: 3 })),
            work: {
                one: m.surfaceRasterWorkSteps({ ...SLOT, inset: 3 }),
                pair: m.surfaceRasterWorkSteps({ ...SLOT, insetAlong: 0, insetAcross: 3 }),
                acrossOff: m.surfaceRasterWorkSteps({ ...SLOT, insetAlong: 0, insetAcross: 0 }),
                alongOn: m.surfaceRasterWorkSteps({ ...SLOT, insetAlong: 3, insetAcross: 3 }),
                liveAcross: m.surfaceRasterWorkSteps({ ...SLOT, insetAlong: 0, insetAcross: '#7' }),
            },
        };
    });
    // ⚠ THE DEFECT, AND ITS CLOSURE, IN ONE PAIR OF LINES
    expect(r.one.minX, 'one inset ate 3mm off the near end (t1442)').toBe(3);
    expect(r.one.maxX, '…and 3mm off the far one — a 54mm channel where 60 was asked').toBe(57);
    expect(r.pair.minX, 'the pair runs the tool centre from the true start').toBe(0);
    expect(r.pair.maxX, '…to the true end: the full centreline, A to B').toBe(60);
    // and ACROSS is untouched by that — the inset that matters is still held
    expect(r.pair.minY, 'while ACROSS still holds its inset').toBe(r.one.minY);
    expect(r.pair.maxY).toBe(r.one.maxY);
    // THE ROLE NAMING IS REAL: the same pair on a walk whose rows run ∥ Y insets the OTHER axis
    expect(r.turned.minY, 'rows ∥ Y: "along" is now Y, so the length runs full').toBe(0);
    expect(r.turned.maxY, '…A to B on the other axis').toBe(60);
    /**
     * @WORK FOLLOWS THE WALK — and the property is sharper than "it changes", which is what a first cut of this
     * assert claimed and the run refuted: `@work` counts EXECUTED STEPS, and a longer pass is the same number of
     * steps, only longer moves. What decides the count is the ROW COUNT, and rows are counted in the CROSS span.
     * So the ACROSS inset moves it and the ALONG inset does not — which is exactly the anisotropy, read off the
     * declaration instead of off the toolpath. (Written this way after measuring 93 / 67 / 67.)
     */
    expect(r.work.acrossOff, 'dropping the ACROSS inset opens the span, so more rows are declared').toBeGreaterThan(r.work.pair);
    expect(r.work.alongOn, 'while the ALONG inset changes no row count — it changes how FAR each row runs').toBe(r.work.pair);
    expect(r.work.liveAcross, 'and a LIVE inset on either axis makes the count unknowable → declare nothing (t1399)').toBeNull();
});

/**
 * ── WHAT C2 IS NOT — the honest boundary, asserted rather than left to a reader ───────────────────────────────────
 */
test('THE REMAINDER — C2 fixes the SPAN; the row rule inside it is still C1\'s, and the boundary says so', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const { SLOT_RASTER_GAP } = await import('/wizards/ops/slot.js');
        const arc = await import('/data/slotCapabilityArc.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const q = (v) => +Number(v).toFixed(3);
        const lines = m.surfaceRasterLines({ x: 0, y: -6, z0: 0, w: 60, h: 12, depth: 1.5, stepdown: 1.5, toolDia: 6,
            stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel', direction: 'bothways',
            entry: 'plunge', rowAxis: 'x', insetAlong: 0, insetAcross: 3 });
        const cuts = (traceToolpath(['G90', ...lines, 'M30'].join(NL)).segments || []).filter((s) => !s.rapid);
        return {
            rowYs: [...new Set(cuts.filter((s) => Math.abs(s.z1 - s.z2) < 1e-6).map((s) => q(s.y2)))].sort((a, b) => a - b),
            gap: SLOT_RASTER_GAP,
            landed: arc.SLOT_CAPABILITIES.find((c) => c.id === 'two-axis-inset').landed,
        };
    });
    /**
     * ⚠ t1492 — C1 HAS SINCE LANDED, and this is where C2's remainder is re-stated rather than left reading as
     * though the row rule were still open. What C2 actually asserted is UNCHANGED and still asserted: a walk that
     * does not ask for the wall anchor still sits half a stepover in, because `fit` is the default and C2 never
     * touched the row rule. What moved is the BOUNDARY's wording — and because that wording NAMES its capabilities
     * instead of counting them, this assertion moves by one name rather than by a number nobody would have checked.
     */
    expect(r.rowYs[0], 'a FIT walk still sits half a stepover in — C2 did not touch the row rule').toBe(-1.8);
    expect(r.rowYs[0], 'which is not where a slot needs it').not.toBe(-3);
    // AND THE DECLARATIONS SAY BOTH HALVES — the clause C2 retires, and what still stands now C1 has landed too.
    expect(r.gap, 'the boundary records the inset clause as retired by C2').toMatch(/C2 \(t1490\) taught it a PAIR/);
    expect(r.gap, 'and the row rule as retired by C1').toMatch(/C1 \(t1492\) taught it the wall rule/);
    expect(r.gap, 'with THE AXIS the capability that still stands').toMatch(/THE AXIS \(C3\)/);
    expect(r.landed, 'and the arc records C2 as shipped').toMatch(/SHIPPED at t1490/);
    expect(r.landed, 'while saying plainly that it does NOT make the atom slot-ready').toMatch(/DOES NOT MAKE THE ATOM SLOT-READY/);
});

/**
 * ── THE ENVELOPE — one axis may be dialled while the other is baked (the arc's C2 envelope row) ──────────────────
 */
test('THE ENVELOPE — the BAKES key became two, so a config can dial one axis and bake the other', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        return {
            // the caller's own spelling is what comes back, so a refusal can name the word they used
            one: m.surfaceRasterLiveInputs({ w: 80, inset: '#6' }),
            along: m.surfaceRasterLiveInputs({ w: 80, insetAlong: '#6', insetAcross: 3 }),
            across: m.surfaceRasterLiveInputs({ w: 80, insetAlong: 0, insetAcross: '#7' }),
            both: m.surfaceRasterLiveInputs({ w: 80, insetAlong: '#6', insetAcross: '#7' }),
            none: m.surfaceRasterLiveInputs({ w: 80, insetAlong: 0, insetAcross: 3 }),
            // plunge takes a dialled inset either way; a helix still refuses it, in whichever spelling
            plungeGap: m.surfaceRasterLiveGap({ strategy: 'parallel', entry: 'plunge', insetAcross: '#7' }),
            helixGap: m.surfaceRasterLiveGap({ strategy: 'parallel', entry: 'helix', insetAcross: '#7' }),
            helixGapOne: m.surfaceRasterLiveGap({ strategy: 'parallel', entry: 'helix', inset: '#6' }),
            fields: m.surfaceRasterBlock.fields,
            roundTripSafe: (() => { const i = m.rasterInsetOf({ inset: 3, insetAlong: 0 }); return i.along === 0 && i.across === 3; })(),
        };
    });
    expect(r.one, 'the single spelling still reports as `inset`').toEqual(['inset']);
    expect(r.along, 'one axis dialled, the other baked — reported by the axis that IS dialled').toEqual(['insetAlong']);
    expect(r.across).toEqual(['insetAcross']);
    expect(r.both, 'and both, when both are').toEqual(['insetAlong', 'insetAcross']);
    expect(r.none, 'two baked numbers dial nothing').toEqual([]);
    // THE ROWS THAT BAKE THE WALKED SPAN STILL REFUSE IT — in either spelling, which is the point of carrying both
    expect(r.plungeGap, 'plunge honours a dialled inset on one axis').toBe('');
    expect(r.helixGap, 'a helix still refuses it — it bakes the inradius the span clamps').toMatch(/inradius/);
    expect(r.helixGapOne, 'and refuses the single spelling too, so neither word is a way around the gate').toMatch(/inradius/);
    /**
     * ⚠ THE SEAM IS AT THE EMITTER, NOT ON THE BLOCK — a NAMED gap, asserted so it cannot drift into an oversight.
     *
     * t1351 says an emitter reading a key the block does not declare is a drop waiting to happen, so the first cut
     * declared the pair here. The full suite refused it: `roundtrip-whole-program-1319`'s iron rule (text
     * differences may only SHRINK from 11) went to 12. A NULLABLE field does not survive the Blockly round trip, and
     * null is the only honest "unspecified" here — 0 is a MEANINGFUL inset and is exactly what the slot wants along
     * its length, so it cannot double as the sentinel. If null came back as 0, `rasterInsetOf` would read a real
     * inset of zero and silently drop the caller's single `inset`.
     *
     * Nothing is lost today: no block instance carries these keys and every consumer hands params straight to the
     * emitter. The day a block must carry them, the nullable round trip is the thing to fix first, in `stackBridge`.
     */
    expect(r.fields, '`inset` is the declared block field, and every existing caller spells it that way').toContain('inset');
    expect(r.fields, 'the pair is deliberately NOT a block field yet — see the gap named in surfaceRasterBlock').not.toContain('insetAlong');
    expect(r.roundTripSafe, 'and the emitter still reads the pair when it is handed one directly').toBe(true);
});
