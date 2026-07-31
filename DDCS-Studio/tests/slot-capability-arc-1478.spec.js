import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SLOT_CAPABILITIES, SLOT_ARC_BAND, SLOT_CAM_INHERITANCE, SLOT_ARC_NOT_INCLUDED } from '../web/data/slotCapabilityArc.js';

/**
 * t1478 — THE SLOT CAPABILITY ARC SCOUT: the design, locked against the code it describes.
 *
 * A design written in one act and built in four is a design that rots in between. Every factual claim the registry
 * makes about the CURRENT shape of things is re-checked here on the real kernels — so if the atom or the slot moves
 * before the build acts run, the design goes RED and gets re-decided rather than quietly followed into a wrong build.
 *
 * These are not tests of behaviour that exists. They are tests that the DESIGN'S PREMISES still hold.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('PREMISE 1 — the register band is still full on both sides (the design\'s binding constraint)', () => {
    const src = readFileSync(join('web', 'wizards', 'ops', 'surfaceraster.js'), 'utf8');
    // the design costs every capability against this band; if the band moves, the costings are stale
    expect(src, 'the atom still declares its band').toContain('#40–#49');
    expect(src, 'still bounded below by camMacroKit\'s kit band').toMatch(/#2[07]–#33|#27-#33/);
    expect(src, 'still bounded above by the probe temps').toMatch(/#50–#61|#50-#61/);
    expect(SLOT_ARC_BAND.descent, 'the descent band the run vector grows into').toBe('#34-#39');
    // and the descent really is mutually exclusive — the +1 costing depends on it
    expect(src, 'plunge/ramp/helix share the descent band by mutual exclusion').toMatch(/mutual(ly)? exclus/i);
});

test('PREMISE 2 — the atom still has the four shapes the design says it has', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const src = { rowAxis: typeof m.rasterRowAxisOf === 'function' };
        return {
            ...src,
            // C1: the row count really is the "fit" rule (half a stepover in, keep what fits)
            axisX: m.rasterRowAxisOf({ direction: 'x' }), axisY: m.rasterRowAxisOf({ direction: 'y' }),
            // C4: the ramp rows really do still bake their geometry
            rampBakes: (m.SURFACE_RASTER_BAKES['parallel/ramp'].inputs || []).length > 0,
            rampWhy: m.SURFACE_RASTER_BAKES['parallel/ramp'].why,
            plungeClean: (m.SURFACE_RASTER_BAKES['parallel/plunge'].inputs || []).length === 0,
            // C2: inset really is one number on both axes
            insetIsOne: (m.SURFACE_RASTER_BAKES['parallel/ramp'].inputs || []).includes('inset'),
        };
    });
    expect(r.rowAxis, 'the row axis is still chosen by a declared helper (C3\'s starting point)').toBe(true);
    expect(r.rampBakes, 'the ramp still bakes its geometry — C4 is what collapses this').toBe(true);
    expect(r.rampWhy, 'and it still bakes it for the distance-to-centre reason C4 removes').toMatch(/hypotenuse|centre/i);
    expect(r.plungeClean, 'plunge already bakes nothing, so C4 changes only the two descents').toBe(true);
    expect(r.insetIsOne, 'inset is still a single declared input — C2 is what splits it').toBe(true);
});

test('PREMISE 3 — the slot kernel still expresses what the atom must learn (C4 is half-built already)', () => {
    const src = readFileSync(join('web', 'wizards', 'ops', 'slot.js'), 'utf8');
    // the design's claim that C4 is the smallest step rests on the literal kernel ALREADY declaring these
    for (const k of ['runX', 'runY', 'maxHelixR', 'helixR']) {
        expect(src, `the literal kernel already declares ${k} — the vector C4 hands the atom`).toContain(k);
    }
    // C1's wall anchor and forced final pass
    expect(src, 'the wall-anchored offsets are still ±(width−tool)/2').toMatch(/band\s*\/\s*2|half\s*=\s*band/);
    // and the boundary this arc exists to close is still declared
    expect(src, 'SLOT_RASTER_GAP is still the declaration this arc answers').toContain('SLOT_RASTER_GAP');
});

test('PREMISE 4 — the CAM width gate is still there, still keyed on width > tool, and still names the wizard exit', () => {
    const src = readFileSync(join('web', 'data', 'opCamMap.js'), 'utf8');
    expect(src, 'the width gate still refuses wide slots').toMatch(/width[^\n]*>[^\n]*toolDia/);
    expect(src, 'and still names the wizard as the exit (t1444)').toMatch(/Slot wizard/i);
    expect(src, 'and still points at this arc as what lifts it').toContain('SLOT_RASTER_GAP');
    // the inheritance table must not promise the gate moves on a capability that cannot move it
    const c4 = SLOT_CAM_INHERITANCE.find((r) => r.when.includes('C4'));
    expect(c4.unlocks, 'C4 is a descent capability and must be declared as unlocking NOTHING for the gate')
        .toMatch(/nothing/i);
});

/**
 * ⚠ THE SCOUT'S MAIN FINDING, RE-MEASURED HERE RATHER THAN INHERITED — because the design's C1 bridge rests on it
 * and the sentence it came from was not reproducible as written. The RAW atom never coincides with the slot at any
 * width (its rows sit half a stepover off — the PHASE). Only the phase-corrected atom coincides, and then only on
 * whole multiples; everywhere else its last row overshoots the far wall in the OVERSIZE direction. So the phase and
 * the clamp are one teaching, and this test is what stops a build act shipping the phase on its own.
 */
test('FINDING — the phase and the clamp are ONE teaching: the phase alone overshoots the wall', () => {
    const slotOffs = (w, t, so) => {
        const band = Math.max(0, w - t);
        if (band < 1e-6) return [0];
        const half = band / 2, o = [];
        for (let v = -half; v < half - 1e-6; v += so) o.push(+v.toFixed(6));
        o.push(+half.toFixed(6));
        return o;
    };
    const rawAtom = (band, so) => {
        const n = Math.max(1, Math.floor((band - so / 2) / so) + 1), o = [];
        for (let i = 0; i < n; i++) o.push(+(-band / 2 + so / 2 + i * so).toFixed(6));
        return o;
    };
    const phased = (band, so) => {
        const n = Math.max(1, Math.floor((band + so / 2) / so) + 1), o = [];
        for (let i = 0; i < n; i++) o.push(+(-band / 2 + i * so).toFixed(6));
        return o;
    };
    const eq = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

    // (1) the RAW atom coincides with the slot NOWHERE — including on the whole multiples
    for (const [w, t, pct] of [[18, 6, 40], [13.2, 6, 40], [20, 8, 50], [12, 6, 40]]) {
        const so = t * pct / 100, band = w - t;
        expect(eq(slotOffs(w, t, so), rawAtom(band, so)), `raw atom must NOT already match the slot at ${w}×Ø${t}`).toBe(false);
    }
    // (2) PHASED coincides exactly on whole multiples — the bridge's true equality arm
    for (const [w, t, pct] of [[18, 6, 40], [13.2, 6, 40], [20, 8, 50]]) {
        const so = t * pct / 100, band = w - t;
        expect((band / so) % 1, `${w}×Ø${t} is a whole multiple`).toBeCloseTo(0, 9);
        expect(eq(slotOffs(w, t, so), phased(band, so)), `phase alone matches at ${w}×Ø${t}`).toBe(true);
    }
    // (3) ⚠ and OVERSHOOTS everywhere else, always in the OVERSIZE direction — which is why the clamp is not optional
    for (const [w, t, pct, miss] of [[12, 6, 40, 1.2], [16.8, 6, 40, 1.2], [15, 6, 40, 0.6]]) {
        const so = t * pct / 100, band = w - t;
        const p = phased(band, so), s = slotOffs(w, t, so);
        const over = p[p.length - 1] - s[s.length - 1];
        expect(over, `${w}×Ø${t}: the phase alone puts the last pass PAST the wall`).toBeCloseTo(miss, 6);
        expect(over, 'and the miss is always oversize, never undersize').toBeGreaterThan(0);
    }
});

test('DESIGN — the arc is ordered, costed, bridged, and honest about its one gate', () => {
    expect(SLOT_CAPABILITIES.length, 'the four capabilities t1442 named').toBe(4);
    expect(SLOT_CAPABILITIES.map((c) => c.order).sort(), 'ordered 1..4 with no ties').toEqual([1, 2, 3, 4]);
    // smallest-first: the one that pays twice leads
    expect(SLOT_CAPABILITIES.find((c) => c.order === 1).id).toBe('declared-run-vector');
    expect(SLOT_CAPABILITIES.find((c) => c.order === 1).paysTwice, 'and the reason it leads is declared').toBeTruthy();
    // the evidence-gated one is LAST, so the arc cannot stall on a machine visit
    const gated = SLOT_CAPABILITIES.filter((c) => c.gate);
    expect(gated.length, 'exactly one capability carries a gate').toBe(1);
    expect(gated[0].order, 'and it is last').toBe(4);
    expect(gated[0].gate, 'the gate is the trig one, and it is scoped to the LIVE form only').toMatch(/V13|trig/i);
    expect(gated[0].gate, 'with the baked form explicitly ungated').toMatch(/BAKED FORM IS UNGATED|baked form/i);
    // every step must be independently bridgeable, costed against the band, and say what must NOT move
    for (const c of SLOT_CAPABILITIES) {
        expect(c.bridge.length, `${c.id} declares its bridge`).toBeGreaterThan(40);
        expect(c.stays.length, `${c.id} declares what must NOT move — the half that makes it bridgeable`).toBeGreaterThan(20);
        expect(c.registers, `${c.id} is costed against the full band`).toMatch(/^[+]?\d|^0/);
    }
    // the arc as a whole costs +1: exactly one capability adds a register in its baked form
    const adds = SLOT_CAPABILITIES.filter((c) => /^\+[1-9]/.test(c.registers));
    expect(adds.length, 'exactly one capability grows the band, and it grows it by one').toBe(1);
    expect(adds[0].registers).toMatch(/^\+1\b/);
    // ⚠ t1480 — C4's REACH, mapped before any emit was touched: the capability is declared in THREE places, and
    // collapsing it in one leaves the other two asserting something untrue. The build act reads this list.
    const c4 = SLOT_CAPABILITIES.find((c) => c.order === 1);
    expect(Array.isArray(c4.reach) && c4.reach.length >= 6, 'C4 declares every consumer it reaches').toBe(true);
    expect(c4.reach.join(' '), 'including the CAM entry gate, which nothing else would catch').toMatch(/entryHasGeometry/);
    expect(c4.reach.join(' '), 'and the trig lift plan, whose raster-ramp row goes stale the moment C4 lands').toMatch(/trigEvidence/);
    expect(c4.reach.join(' '), 'and the LOCK that ties the two into ONE act rather than a follow-up').toMatch(/LOCK 2/);
    expect(c4.needsRuling, 'the one decision C4 cannot make for itself is named').toMatch(/raster-ramp/);

    // and the evidence-blocked neighbour stays OUT, named
    expect(SLOT_ARC_NOT_INCLUDED.what).toMatch(/rest/i);
    expect(SLOT_ARC_NOT_INCLUDED.why, 'because it is evidence-blocked, not teachable').toMatch(/SQRT|evidence/i);
});
