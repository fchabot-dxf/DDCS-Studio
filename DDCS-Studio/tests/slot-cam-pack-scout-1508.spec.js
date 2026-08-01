import { test, expect } from '@playwright/test';

/**
 * t1508 — THE CAM LIFT, SCOUTED. No product behaviour changes here; what lands is the DESIGN plus the assertions
 * that keep it from rotting between being written and being built (the `slot-capability-arc-1478` precedent).
 *
 * The act was dispatched as three pieces. The scout found that the FIRST one decides the SECOND's field list, and
 * not in the direction the dispatch assumed — so it is recorded and asserted before any emit is touched.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * ── THE CONSTRAINT — the bearing cannot be live, and the evidence registry is what says so ────────────────────────
 *
 * Asserted against `trigEvidence` rather than restated, so the day ATAN or SQRT is promoted on a machine visit this
 * test changes its mind on its own instead of holding a stale conclusion.
 */
test('THE CRUX — atan2 and hypot are V13-gated, so a packed slot\'s frame is build-time or nothing', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const te = await import('/data/trigEvidence.js');
        const fns = te.TRIG_FUNCTIONS || te.FUNCTIONS || te.default || {};
        const pick = (k) => { const f = fns[k]; return f && { tier: f.tier, test: f.test }; };
        return { ATAN: pick('ATAN'), SQRT: pick('SQRT'), SIN: pick('SIN'), COS: pick('COS'), keys: Object.keys(fns) };
    });
    // the registry still carries all four, and the two the slot frame would need are on the WEAKEST tier
    expect(r.keys, 'the trig registry still declares the four functions').toEqual(expect.arrayContaining(['ATAN', 'SQRT', 'SIN', 'COS']));
    expect(r.ATAN.tier, 'ATAN — the bearing — is community-referenced, the weakest tier').toBe('community-referenced');
    expect(r.SQRT.tier, 'SQRT — the length — likewise').toBe('community-referenced');
    // …and each still names the machine test that would settle it, so the lift plan stays actionable
    expect(r.ATAN.test, 'ATAN still cites its V13 test').toMatch(/V13/);
    expect(r.SQRT.test, 'SQRT still cites its V13 test').toMatch(/V13/);
});

/**
 * ── THE DESIGN, AND THE ONE CORRECTION IT MAKES TO THE ACT ────────────────────────────────────────────────────────
 *
 * The dispatch said tool Ø + stepover% JOIN the live layout. True, and not the whole change: the ENDPOINTS must
 * LEAVE it in the same act, because a baked bearing beside live endpoints cuts the old angle through the new point.
 */
test('THE DESIGN — the packed slot\'s knobs are the ATOM\'s, and the endpoints bake WITH the frame they derive', async ({ page }) => {
    await boot(page);
    const d = await page.evaluate(async () => (await import('/data/slotCapabilityArc.js')).SLOT_CAM_PACK_DESIGN);
    expect(d, 'the design is declared as data the build act can read').toBeTruthy();
    for (const k of ['toolDia', 'stepoverPct', 'width']) {
        expect(d.live, `${k} is a LIVE knob on the packed arm`).toContain(k);
    }
    for (const k of ['ax', 'ay', 'bx', 'by']) {
        expect(d.baked, `${k} is BAKED — it feeds a frame the controller cannot recompute`).toContain(k);
    }
    expect(d.why, 'and the reason is the trig gate, named').toMatch(/atan2 \+ hypot are V13-gated/);
    expect(d.fieldListDelta, 'the field-list delta states BOTH halves — what joins and what leaves').toMatch(/\+toolDia.*-ax/s);
    expect(d.refusalIfExposed, 'an exposed endpoint must REFUSE at pack, not emit').toMatch(/REFUSE/);
    expect(d.bands, 'and the band reconciliation names both the atom band and the literal one').toMatch(/#34-#49.*#50-#54/s);
});

/**
 * ── THE PREMISES THE BUILD RESTS ON, asserted against the REAL code rather than the design's prose ────────────────
 *
 * Each of these is something the build act will assume. If any drifts before that act runs, this fails and the
 * design gets corrected instead of being built against a stale reading.
 */
test('THE PREMISES — the bake mechanism, the atom\'s frame formula, and the gate that is waiting to lift', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { camTypeOf } = await import('/data/opCamMap.js');
        const { bandsFor } = await import('/data/camScratch.js');
        const { RASTER_SCRATCH } = await import('/wizards/ops/surfaceraster.js');
        const src = await (await fetch('/data/opToSlot.js')).text();
        // the frame really is derived from A/B by trig — measured, not read off the comment
        const leaf = { x0: 5, y0: 7, x1: 5 + 60 * Math.cos(Math.PI / 6), y1: 7 + 60 * Math.sin(Math.PI / 6), width: 16, tool: 8, depth: 4, stepdown: 1.5, stepoverPct: 40, entry: 'plunge' };
        const f = slotRasterParams(leaf);
        const base = { width: 16, toolDia: 8, ax: 0, ay: 0, bx: 60, by: 0, depth: 4, stepdown: 1.5 };
        return {
            bearing: +f.bearing.toFixed(6), w: +f.w.toFixed(6),
            frameX: +f.x.toFixed(6), frameY: +f.y.toFixed(6),
            // the width gate the lift is aimed at — still refusing, in its own words
            wideGate: camTypeOf({ opType: 'slot', params: base }),
            narrowGate: camTypeOf({ opType: 'slot', params: { ...base, width: 8 } }),
            // the bake mechanism the design depends on
            hasBakeHook: /exposed === false/.test(src),
            slotBands: bandsFor('slot'), rasterBands: RASTER_SCRATCH,
        };
    });
    // the frame IS trig-derived: a 30° slot bears 30 and its length is the hypotenuse
    expect(r.bearing, 'the frame\'s bearing is atan2 of the endpoints').toBeCloseTo(30, 6);
    expect(r.w, '…and its width is the hypotenuse of them').toBeCloseTo(60, 6);
    // the gate is still shut for a wide slot, and open for one the centreline body cuts correctly
    expect(r.wideGate.unsupported, 'the CAM width gate still refuses a wide slot — this is what the lift opens').toMatch(/centreline pass/);
    expect(r.wideGate.unsupported, '…and still names the wizard as the exit (t1444)').toMatch(/Slot wizard/);
    expect(r.narrowGate.camType, 'a slot the centreline body cuts correctly still packs').toBe('slot');
    // the machinery the design leans on exists
    expect(r.hasBakeHook, 'opToSlot already honours a BAKED param (no #11xx, no field)').toBe(true);
    // ⚠ the band reconciliation is REAL work, not bookkeeping: today's slot band does NOT cover the atom's registers
    const covers = (bands, [lo, hi]) => (bands || []).some(([a, b]) => a <= lo && b >= hi);
    expect(covers(r.slotBands, r.rasterBands[0]), 'TODAY the slot band does NOT cover the atom\'s #34-#49 — piece 3 is why').toBe(false);
});
