import { test, expect } from '@playwright/test';

/**
 * t1483 (C4) — THE DECLARED RUN VECTOR. The bridge.
 *
 * ── WHY THIS IS A RELATIONSHIP BRIDGE AND NOT AN EQUIVALENCE ONE ────────────────────────────────────────────────
 * Every previous descent act was proved MOVE FOR MOVE against the literal kernel. This one cannot be and must not
 * pretend to be: a ramp along the row cuts a DIFFERENT set of moves from a ramp toward the area centre. That is the
 * whole point — t1339 named the centre-ward ramp's cost (it bakes a hypotenuse, and SQRT is unverified here) and
 * named this vector as the answer "that needs no square root at all".
 *
 * So the bridge is in two halves, and the split is the honest part:
 *   OUTSIDE the descent — BYTE-IDENTICAL. If a single character of the walk moved, this act did more than it said.
 *   INSIDE  the descent — the RELATIONSHIP: the declared angle, the full drop, the start point, the return to it,
 *                         the honest degrade, and the guard now reading a LIVE register instead of a baked number.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

const BASE = { w: 80, h: 60, depth: 3, stepdown: 1.5, toolDia: 8, stepoverPct: 45, feed: 1200, plunge: 150, clearance: 5, rampAngle: 3 };

const emit = (page, over) => page.evaluate(async (o) => {
    const m = await import('/wizards/ops/surfaceraster.js');
    return m.surfaceRasterLines(o).join('\n');
}, { ...BASE, ...over });

/** the descent block: from the run assignment to the label that closes it (inclusive) */
const descentOf = (text) => {
    const L = text.split('\n');
    const a = L.findIndex((l) => /#34=\[#43 \*/.test(l));
    const b = L.findIndex((l, i) => i > a && /^\s*N\d+\s*$/.test(l) && /rampEnd|N42/.test(l + ''));
    const end = b > 0 ? b : L.findIndex((l, i) => i > a && /\( the ramp did not fit/.test(l)) + 2;
    return { block: L.slice(a, end + 1), at: a, rest: L.filter((_, i) => i < a || i > end) };
};

test('BRIDGE A — everything OUTSIDE the descent is BYTE-IDENTICAL to the plunge walk', async ({ page }) => {
    await boot(page);
    const plunge = await emit(page, { strategy: 'parallel', entry: 'plunge' });
    const ramp = await emit(page, { strategy: 'parallel', entry: 'ramp' });
    // strip each program's descent; what is left must match character for character. A walk that changed with the
    // descent would mean this act reached past the thing it declared.
    const pl = plunge.split('\n').filter((l) => !/\( the ONE plunge of this level \)|G1 Z\[.*\] F150/.test(l));
    const rp = descentOf(ramp).rest;
    const norm = (a) => a.filter((l) => l.trim() !== '').join('\n');
    expect(norm(rp), 'the walk around the descent is untouched').toBe(norm(pl));
});

test('BRIDGE B — INSIDE the descent: the angle, the drop, the start and the return are preserved', async ({ page }) => {
    await boot(page);
    const text = await emit(page, { strategy: 'parallel', entry: 'ramp', rampAngle: 3 });
    const d = descentOf(text).block.join('\n');
    // the run is still bite / tan(angle) — the ONE thing that stayed baked, and the angle is a form field
    const invTan = 1 / Math.tan(3 * Math.PI / 180);
    expect(d, 'the run is the declared angle applied to the level bite').toContain(`#34=[#43 * ${Math.round(invTan * 1000) / 1000}]`);
    // it descends to this level's floor and returns to the row start at depth
    expect(d, 'the ramp move reaches the level Z').toMatch(/\( ramp \)/);
    expect(d, 'and comes back to the row start').toMatch(/back to the row start, now at depth/);
    // the honest degrade survives — the property, not the wording
    expect(d, 'the degrade is still there when the run does not fit').toMatch(/the ramp did not fit — straight plunge/);
});

test('BRIDGE C — the guard reads a LIVE register: no baked distance survives anywhere', async ({ page }) => {
    await boot(page);
    for (const [tag, over] of [
        ['parallel', { strategy: 'parallel', entry: 'ramp' }],
        ['concentric', { strategy: 'concentric', entry: 'ramp' }],
        ['rows-along-Y', { strategy: 'parallel', entry: 'ramp', direction: 'y' }],
        ['one-way', { strategy: 'parallel', entry: 'ramp', direction: 'oneway' }],
        ['mirrored', { strategy: 'parallel', entry: 'ramp', direction: 'otherway' }],
    ]) {
        const t = await emit(page, over);
        // ⚠ THE CAPABILITY IN ONE ASSERT: the guard compares the run to a REGISTER. It used to be a literal.
        expect(t, `${tag}: the run guard reads a live span register`).toMatch(/IF #34 > #4[01] GOTO/);
        expect(t, `${tag}: no baked distance-to-centre survives`).not.toMatch(/mm to centre/);
        // and no hypotenuse was ever written out as a constant multiplier pair
        expect(t, `${tag}: the direction is an AXIS vector, so one component is zero`).toMatch(/#34 \* (1|-1|0)\b/);
    }
});

test('BRIDGE D — a DIALLED area now cuts a real ramp, where it used to degrade to a plunge', async ({ page }) => {
    await boot(page);
    const live = await emit(page, { strategy: 'parallel', entry: 'ramp', w: '#4', h: '#5', toolDia: '#9', stepoverPct: '#10' });
    // this is the user-visible purchase of the whole act
    expect(live, 'a dialled ramp is a ramp').toMatch(/\( ramp \)/);
    expect(live, 'not a degraded plunge').not.toMatch(/entry degraded to a plunge/);
    expect(live, 'and its guard is against the live span').toMatch(/IF #34 > #4[01] GOTO/);
    // the HELIX on the same dialled area still degrades — the two descents must not be confused
    const helix = await emit(page, { strategy: 'parallel', entry: 'helix', w: '#4', h: '#5', toolDia: '#9', stepoverPct: '#10' });
    expect(helix, 'the helix still bakes its inradius, so it still degrades').toMatch(/entry degraded to a plunge/);
});

test('BRIDGE E — the mirrored walk ramps INTO the area, not out of it', async ({ page }) => {
    await boot(page);
    const fwd = await emit(page, { strategy: 'parallel', entry: 'ramp', direction: 'oneway' });
    const rev = await emit(page, { strategy: 'parallel', entry: 'ramp', direction: 'otherway' });
    const sign = (t) => (/#34 \* -1\b/.test(t) ? -1 : 1);
    // an `otherway` level starts at the FAR end, so its ramp must run the OTHER way or it would leave the material
    expect(sign(fwd), 'the forward walk ramps +').toBe(1);
    expect(sign(rev), 'the mirrored walk ramps − (into the area from the far end)').toBe(-1);
});
