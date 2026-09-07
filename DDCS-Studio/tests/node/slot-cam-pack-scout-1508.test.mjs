import { test, expect } from './support/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// "THE PREMISES" reads a source file as raw TEXT (to regex for the bake hook) — the browser original used
// `fetch('/data/opToSlot.js')` against the page's own origin; there is no origin here, so it reads the same file
// off disk instead. Same bytes, the mechanically necessary node-tier substitute for a same-origin fetch.
const WEB = path.resolve(fileURLToPath(import.meta.url), '../../../web');

/**
 * t1508 — THE CAM LIFT, SCOUTED. No product behaviour changes here; what lands is the DESIGN plus the assertions
 * that keep it from rotting between being written and being built (the `slot-capability-arc-1478` precedent).
 *
 * The act was dispatched as three pieces. The scout found that the FIRST one decides the SECOND's field list, and
 * not in the direction the dispatch assumed — so it is recorded and asserted before any emit is touched.
 *
 * NODE-TIER CONVERSION: every test is pure (page.evaluate imports + returns data, plain expect() on it) — moved
 * whole, no behavioural change.
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
    // t1634 — ATAN is hardware-confirmed now (the comma form, on both macro-var controllers); SQRT is still the
    // weakest tier and still what this test's CRUX rests on (the packed slot needs BOTH atan2 AND hypot live).
    expect(r.ATAN.tier, 'ATAN is hardware-confirmed as of t1634 — the comma form, proven on the Expert and V4.1').toBe('hardware-confirmed');
    expect(r.SQRT.tier, 'SQRT — the length — is still community-referenced, the weakest tier').toBe('community-referenced');
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
        const src = fs.readFileSync(path.join(WEB, 'data', 'opToSlot.js'), 'utf8');
        // the frame really is derived from A/B by trig — measured, not read off the comment
        const leaf = { x0: 5, y0: 7, x1: 5 + 60 * Math.cos(Math.PI / 6), y1: 7 + 60 * Math.sin(Math.PI / 6), width: 16, tool: 8, depth: 4, stepdown: 1.5, stepoverPct: 40, entry: 'plunge' };
        const f = slotRasterParams(leaf);
        const base = { width: 16, toolDia: 8, ax: 0, ay: 0, bx: 60, by: 0, depth: 4, stepdown: 1.5 };
        return {
            bearing: +f.bearing.toFixed(6), w: +f.w.toFixed(6),
            frameX: +f.x.toFixed(6), frameY: +f.y.toFixed(6),
            // the width gate the lift was aimed at — LIFTED at t1512 for the slots the atom can walk, still refusing the rest
            wideGate: camTypeOf({ opType: 'slot', params: base }),
            narrowGate: camTypeOf({ opType: 'slot', params: { ...base, width: 8 } }),
            // an ANGLED wide slot: refused at t1510 (the atom DROPPED the bearing), PACKING since t1514 (C5)
            angledGate: camTypeOf({ opType: 'slot', params: { ...base, bx: 0, by: 60 } }),
            // the bake mechanism the design depends on
            hasBakeHook: /exposed === false/.test(src),
            slotBands: bandsFor('slot'), rasterBands: RASTER_SCRATCH,
        };
    });
    // the frame IS trig-derived: a 30° slot bears 30 and its length is the hypotenuse
    expect(r.bearing, 'the frame\'s bearing is atan2 of the endpoints').toBeCloseTo(30, 6);
    expect(r.w, '…and its width is the hypotenuse of them').toBeCloseTo(60, 6);
    /**
     * ⚠ t1512 — THIS PIN WENT RED AND IS RESTATED RATHER THAN DELETED. It asserted the width gate was still SHUT,
     * which was the whole point of pinning it: the day the lift landed, this test had to be revisited by hand instead
     * of the scout's premise quietly rotting into a claim about a gate that had moved. The gate is open now — for the
     * slots the atom can genuinely walk, and for no others.
     */
    expect(r.wideGate.camType, 'the width gate is LIFTED: a wide slot on a bearing of 0 packs the atom now').toBe('slot');
    expect(r.narrowGate.camType, 'a slot the centreline body cuts correctly still packs').toBe('slot');
    /**
     * ⚠ t1514 — THE THIRD RED PIN OF THIS FILE, AND THE SAME TREATMENT. It asserted the ANGLED half still refused,
     * named C5 as the pending capability and the wizard as the exit — which is exactly what it was for: the day C5
     * landed, the scout's premise had to be revisited by hand rather than quietly rot into a claim about a boundary
     * that had moved. C5 landed at t1514, the gate is open for the angled half too, and nothing in the CAM layer
     * changed to open it (the gate asks the atom's envelope — `slot-cam-pack-1512` PROOF 6 asserts that structurally).
     */
    expect(r.angledGate.camType, 'an ANGLED wide slot PACKS since C5 — t1510 measured it refused, the atom dropping the bearing').toBe('slot');
    expect(r.angledGate.unsupported, '…with no refusal left to make').toBeFalsy();
    // the machinery the design leans on exists
    expect(r.hasBakeHook, 'opToSlot already honours a BAKED param (no #11xx, no field)').toBe(true);
    /**
     * ⚠ t1512 — THE SECOND PIN THAT WENT RED, AND ALSO RESTATED RATHER THAN DELETED. The scout asserted this band did
     * NOT cover the atom's registers, precisely so "piece 3 is real work" could not become a claim nobody rechecked.
     * The union landed, so the assertion inverts: the slot band must now cover BOTH the atom's registers (its clearing
     * IS the atom on the packed arm) and the literal centreline body's own #50-#54.
     */
    const covers = (bands, [lo, hi]) => (bands || []).some(([a, b]) => a <= lo && b >= hi);
    expect(covers(r.slotBands, r.rasterBands[0]), 'the slot band now covers the atom\'s #34-#49 — the packed arm writes them').toBe(true);
    expect(covers(r.slotBands, r.rasterBands[1]), '…and the atom\'s upper band too').toBe(true);
    expect(covers(r.slotBands, [50, 54]), '…while still covering the literal centreline body\'s own #50-#54').toBe(true);
});
