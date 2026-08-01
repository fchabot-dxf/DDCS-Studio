import { test, expect } from '@playwright/test';

/**
 * t1510 — THE CAM LIFT'S BUILD MEASURED ITS OWN PREMISE FALSE, and this pins the measurement.
 *
 * The scout (t1508) settled WHICH KNOBS a packed slot carries. The build's first emit probe asked the next question —
 * can the atom walk a slot whose bearing is baked while its knobs are LIVE? — and found that for an ANGLED slot it
 * cannot, and does not say so: it drops the angle and emits an axis-aligned channel while `surfaceRasterCovers`
 * reports the config as covered.
 *
 * What lands this turn is the ENVELOPE FIX (the atom refuses a bearing it cannot apply) plus these assertions. The
 * generator arm and the #2600 format change are PARKED at a gate: their domain is narrower than the act assumed, and
 * that is the advisor's ruling to make.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * ── THE DEFECT, MEASURED IN BOTH DIRECTIONS ───────────────────────────────────────────────────────────────────────
 *
 * Asserted on the EMITTED TEXT rather than on the predicate, because the predicate is what was wrong: a body that
 * mixes both axes by the rotation constants is walking the bearing; one that moves a single axis per move is not.
 */
test('THE DROP — an ANGLED slot with live knobs emits an AXIS-ALIGNED walk, and the baked one does not', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const r30 = 30 * Math.PI / 180;
        const baked = slotRasterParams({ x0: 5, y0: 7, x1: 5 + 60 * Math.cos(r30), y1: 7 + 60 * Math.sin(r30),
            width: 16, tool: 8, depth: 4, stepdown: 1.5, stepoverPct: 40, entry: 'plunge', feed: 2000, plunge: 150, clearance: 5 });
        const rad = baked.bearing * Math.PI / 180;
        const live = { ...baked, x: `[5+[#35/2]*${Math.sin(rad).toFixed(9)}]`, y: `[7-[#35/2]*${Math.cos(rad).toFixed(9)}]`,
            h: '#35', toolDia: '#36', stepoverPct: '#37', insetAcross: '[#36/2]' };
        const cut = (ls) => ls.filter((l) => /^\s*G[01] /.test(l)).map((l) => l.trim().replace(/\s+\(.*$/, ''));
        // a move is ROTATED when its X word carries the row register: the bearing mixes the across-axis into X
        const rotatedMoves = (ls) => cut(ls).filter((l) => /X\[[^\]]*#47/.test(l)).length;
        return { bearing: baked.bearing, bakedRotated: rotatedMoves(surfaceRasterLines(baked)), liveRotated: rotatedMoves(surfaceRasterLines(live)) };
    });
    expect(r.bearing, 'the config really is a 30° slot').toBeCloseTo(30, 6);
    expect(r.bakedRotated, 'FULLY BAKED: the walk mixes the row axis into X — it runs on the bearing').toBeGreaterThan(0);
    expect(r.liveRotated, '⚠ WITH LIVE KNOBS: not one move carries it — the 30° is DROPPED, and the channel comes out axis-aligned').toBe(0);
});

/**
 * ── THE ENVELOPE HOLE, AND THAT IT IS CLOSED ──────────────────────────────────────────────────────────────────────
 *
 * The fix reads `surfaceRasterAbsorbsRotation` rather than restating its condition, so a bearing is refused for the
 * SAME reasons a rotation cannot be baked — including skim, which had the identical gap.
 */
test('THE FIX — the atom now REFUSES a bearing it cannot apply, and stays silent where it can', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { surfaceRasterCovers, surfaceRasterGap, surfaceRasterAbsorbsRotation } = await import('/wizards/ops/surfaceraster.js');
        const mk = (deg) => { const rr = deg * Math.PI / 180;
            return slotRasterParams({ x0: 5, y0: 7, x1: 5 + 60 * Math.cos(rr), y1: 7 + 60 * Math.sin(rr), width: 16, tool: 8,
                depth: 4, stepdown: 1.5, stepoverPct: 40, entry: 'plunge', feed: 2000, plunge: 150, clearance: 5 }); };
        const liveify = (b) => { const rad = b.bearing * Math.PI / 180;
            return { ...b, x: `[5+[#35/2]*${Math.sin(rad).toFixed(9)}]`, y: `[7-[#35/2]*${Math.cos(rad).toFixed(9)}]`,
                h: '#35', toolDia: '#36', stepoverPct: '#37', insetAcross: '[#36/2]' }; };
        const look = (p) => ({ covers: surfaceRasterCovers(p), gap: surfaceRasterGap(p), absorbs: surfaceRasterAbsorbsRotation(p) === true });
        return {
            bakedAngled: look(mk(30)),          // the WIZARD path — unchanged, must still be covered
            liveAngled: look(liveify(mk(30))),  // the PACKED shape at an angle — must now refuse
            liveStraight: look(liveify(mk(0))), // the PACKED shape axis-aligned — nothing to drop, must stay covered
            bakedRotProgram: look({ ...mk(0), rotAngle: 45 }),   // a program rotation with NO bearing — untouched
        };
    });
    // the wizard path is NOT narrowed: a fully-baked angled slot still rides the atom
    expect(r.bakedAngled.covers, 'a fully-baked angled slot is still covered — the wizard path is untouched').toBe(true);
    expect(r.bakedAngled.absorbs, '…because it absorbs its own rotation').toBe(true);
    // the hole is closed, and the refusal says WHY in the atom's words
    expect(r.liveAngled.covers, '⚠ the packed ANGLED shape is now refused — it used to be reported as covered').toBe(false);
    expect(r.liveAngled.gap, 'the refusal names the bearing and the number').toMatch(/bearing of 30/);
    expect(r.liveAngled.gap, '…and says the bearing has no downstream fallback a rotation has').toMatch(/NOTHING downstream applies a bearing/);
    // …and it is NARROW: the reachable case is still reachable
    expect(r.liveStraight.covers, 'the packed AXIS-ALIGNED shape stays covered — there is no angle to drop').toBe(true);
    expect(r.liveStraight.gap, '…with no refusal at all').toBe('');
    expect(r.bakedRotProgram.covers, 'and a program rotation with no bearing is untouched').toBe(true);
});

/**
 * ── WHAT IS REACHABLE — the axis-aligned arm is an EXACT delegation, measured, not asserted by predicate ───────────
 *
 * This is the assertion a build act rests on: with the register values substituted, the packed arm's emit is the
 * fully-baked wizard emit move for move. If that ever stops being true the lift is not a delegation any more.
 */
test('THE REACHABLE ARM — a bearing-0 packed slot emits the BAKED walk move for move', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const baked = slotRasterParams({ x0: 5, y0: 7, x1: 65, y1: 7, width: 16, tool: 8, depth: 4, stepdown: 1.5,
            stepoverPct: 40, entry: 'plunge', feed: 2000, plunge: 150, clearance: 5 });
        const live = { ...baked, h: '#35', toolDia: '#36', stepoverPct: '#37', insetAcross: '[#36/2]' };
        const cut = (ls) => ls.filter((l) => /^\s*G[01] /.test(l)).map((l) => l.trim().replace(/\s+\(.*$/, ''));
        // substitute the register VALUES back in — the operator dialling the seeded numbers must reproduce the baked walk
        const subst = (ls) => ls.map((l) => l.replace(/\[#36\/2\]/g, '4').replace(/#35/g, '16').replace(/#36/g, '8').replace(/#37/g, '40'));
        const a = cut(surfaceRasterLines(baked)), b = subst(cut(surfaceRasterLines(live)));
        const firstDiff = a.findIndex((l, i) => l !== b[i]);
        return { bearing: baked.bearing, n: a.length, equal: a.length === b.length && firstDiff < 0,
                 firstDiff, aAt: a[firstDiff], bAt: b[firstDiff] };
    });
    expect(r.bearing, 'an A→B along +X slot bears 0').toBe(0);
    expect(r.n, 'there is a real walk to compare').toBeGreaterThan(5);
    expect(r.equal, `the packed arm IS the baked walk (first difference at ${r.firstDiff}: "${r.aAt}" vs "${r.bAt}")`).toBe(true);
});

/**
 * ── AND THE +Y CASE IS **NOT** A FREE RENAME, which is why the lift is +X only this turn ──────────────────────────
 *
 * A bearing-90 slot could in principle be re-expressed as bearing 0 with the spans swapped and rows running along Y —
 * no rotation, so live knobs would survive. Measured: it is not the same walk. Rotating (0, across) by 90° marches the
 * rows in −X while the swapped form marches +X, so the passes come out MIRRORED. Geometrically the same channel,
 * a different order and a different entry end — a bridge, not a rename, and not smuggled in here.
 */
test('THE +Y ROUTE IS A MIRROR, NOT A RENAME — measured, so it stays out of this lift', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { surfaceRasterLines } = await import('/wizards/ops/surfaceraster.js');
        const leaf = { x0: 5, y0: 7, x1: 5, y1: 67, width: 16, tool: 8, depth: 4, stepdown: 1.5, stepoverPct: 40,
            entry: 'plunge', feed: 2000, plunge: 150, clearance: 5 };
        const bearing90 = slotRasterParams(leaf);
        const swapped = { ...bearing90, bearing: 0, rowAxis: 'y', w: 16, h: 60, x: 5 - 8, y: 7, insetAlong: 0, insetAcross: 4 };
        const cut = (ls) => ls.filter((l) => /^\s*G[01] /.test(l)).map((l) => l.trim().replace(/\s+\(.*$/, ''));
        const a = cut(surfaceRasterLines(bearing90)), b = cut(surfaceRasterLines(swapped));
        return { bearing: bearing90.bearing, equal: a.length === b.length && a.every((l, i) => l === b[i]),
                 a: a.slice(1, 3), b: b.slice(1, 3) };
    });
    expect(r.bearing, 'the +Y slot bears 90').toBeCloseTo(90, 6);
    expect(r.equal, `the swapped-axis form is NOT the bearing-90 walk (${JSON.stringify(r.a)} vs ${JSON.stringify(r.b)})`).toBe(false);
});

/**
 * ── THE DOMAIN, DECLARED — so the parked build reads a measured fact, not this test's memory of one ───────────────
 */
test('THE DOMAIN IS DECLARED — the corrected reach, the corrected field list, and the open band question', async ({ page }) => {
    await boot(page);
    const d = await page.evaluate(async () => {
        const m = await import('/data/slotCapabilityArc.js');
        return { dom: m.SLOT_CAM_PACK_DOMAIN, inherit: m.SLOT_CAM_INHERITANCE, design: m.SLOT_CAM_PACK_DESIGN };
    });
    expect(d.dom, 'the domain finding is inert data the build act can read').toBeTruthy();
    expect(d.dom.reachableToday, 'the reachable arm is the bearing-0 one').toMatch(/BEARING IS 0/);
    expect(d.dom.refusedToday, '…and every other bearing is refused, naming the wizard as the exit').toMatch(/wizard/);
    expect(d.dom.fieldListDeltaCorrected, 'the field list gains PLUNGE, which the scout\'s delta line omitted').toMatch(/PLUNGE/);
    expect(d.dom.theCapabilityThatWouldLiftIt, 'the angled half is named as a CAPABILITY (C5), not as effort').toMatch(/C5/);
    expect(d.dom.bandKeyingIsOpen, 'and the band keying is flagged as a decision rather than silently taken').toMatch(/decision/);
    // ⚠ the finding agrees with the INHERITANCE TABLE this file has carried all along — the two halves were always
    // separate rows, so the correction is the design being read, not the design being changed
    const c3 = d.inherit.find((r) => /C3/.test(r.when));
    expect(c3, 'the C3 row still exists').toBeTruthy();
    expect(c3.unlocks, 'and it always said an angled wide slot stays wizard-only until C3 reaches the CAM arm').toMatch(/wizard-only/);
    // the scout's own field list is untouched by this — it was right about the KNOBS
    expect(d.design.live, 'the live set still names width').toMatch(/WIDTH/);
    expect(d.design.baked, 'and the endpoints are still baked with the frame they derive').toMatch(/ax/);
});
