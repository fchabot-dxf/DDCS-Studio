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
 *
 * ── ⚠ t1514 (C5) — THE BOUNDARY THIS FILE PINNED HAS LIFTED, AND THE FILE KEEPS MEASURING BOTH SIDES OF IT ─────────
 *
 * `affineFrame` prints the rotation mix with REGISTER operands now, so a live frame turns and the packed ANGLED slot
 * PACKS. Two pins below flip, and neither is deleted — the frozen-kernel pattern: a spec that only asserts the new
 * truth reads as though nothing was ever wrong, and the DROP measured here is the reason the eligibility gate is
 * shaped the way it is (it asks the ENVELOPE, so the envelope opening IS the lift, with no CAM-layer edit).
 *
 *   THE DROP   — same probe, same config, and the answer inverts: 0 rotated moves BEFORE, every move rotated AFTER.
 *   THE FIX    — the refusal is not gone, it NARROWED: what it now catches is skim and the two-pivot pair.
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
test('THE DROP, LIFTED — the SAME probe that measured 0 rotated moves now measures every one of them', async ({ page }) => {
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
        /**
         * a move is ROTATED when its X word carries the row register: the bearing mixes the across-axis into X.
         * ⚠ THE WORD IS EXTRACTED BY BALANCING BRACKETS, not by `/X\[[^\]]*#47/` — which is what this test carried
         * until t1514 and which reports a rotated live word as UNROTATED the moment the origin is an expression
         * (`X[0 + [[5 + [#35/2] * …] …] - #47 * 0.5]` closes a bracket before it reaches `#47`). The same class as
         * t1512's `#4` prefix bug: a harness that reads the emit with the wrong shape in mind measures its own regex.
         */
        const wordAt = (s, ax) => { const i = s.indexOf(' ' + ax); if (i < 0) return '';
            let j = i + 2, d = 0, o = ''; while (j < s.length) { const c = s[j];
                if (c === '[') d++; if (c === ']') d--; if (c === ' ' && d === 0) break; o += c; j++; } return o; };
        const rotatedMoves = (ls) => cut(ls).filter((l) => /#47/.test(wordAt(l, 'X'))).length;
        return { bearing: baked.bearing, bakedRotated: rotatedMoves(surfaceRasterLines(baked)), liveRotated: rotatedMoves(surfaceRasterLines(live)) };
    });
    expect(r.bearing, 'the config really is a 30° slot').toBeCloseTo(30, 6);
    expect(r.bakedRotated, 'FULLY BAKED: the walk mixes the row axis into X — it runs on the bearing').toBeGreaterThan(0);
    // ⚠ t1514 — THIS ASSERTION IS THE ONE THAT INVERTED. It read `.toBe(0)`: with live knobs not one move carried the
    // bearing, the 30° was DROPPED and the channel came out axis-aligned while the envelope called the config covered.
    // The probe is unchanged, deliberately — the same question, the opposite answer, is the measurement of the lift.
    expect(r.liveRotated, '⚠ WITH LIVE KNOBS the 30° used to VANISH (0 rotated moves). C5: the live frame turns').toBe(r.bakedRotated);
    expect(r.liveRotated, '…and it is every move the baked walk rotates, not a subset').toBeGreaterThan(0);
});

/**
 * ── THE ENVELOPE HOLE, CLOSED AT t1510 AND **NARROWED** AT t1514 ──────────────────────────────────────────────────
 *
 * The fix reads `surfaceRasterAbsorbsRotation` rather than restating its condition, so a bearing is refused for the
 * SAME reasons a rotation cannot be baked — including skim, which had the identical gap. That indirection is what
 * makes this test still the right one after C5: the refusal did not go away, its PREDICATE narrowed, and the packed
 * angled shape fell out of it. What is still caught is skim (a jogged frame has no datum to turn about) and the one
 * pair a live origin cannot carry — a bearing AND a program rotation, two pivots on one register.
 */
test('THE FIX, NARROWED — the refusal now catches only skim and the two-pivot pair, and the angled slot passes', async ({ page }) => {
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
            liveAngled: look(liveify(mk(30))),  // the PACKED shape at an angle — REFUSED at t1510, covered since t1514
            liveStraight: look(liveify(mk(0))), // the PACKED shape axis-aligned — nothing to drop, must stay covered
            bakedRotProgram: look({ ...mk(0), rotAngle: 45 }),   // a program rotation with NO bearing — untouched
            liveRotProgram: look({ ...liveify(mk(0)), rotAngle: 45 }),          // a live frame turning about the DATUM
            liveTwoPivots: look({ ...liveify(mk(30)), rotAngle: 45 }),          // ⚠ both at once — the one that refuses
            liveSkim: look({ ...liveify(mk(30)), zMode: 'skim' }),              // …and skim, which never had a datum
        };
    });
    // the wizard path is NOT narrowed: a fully-baked angled slot still rides the atom
    expect(r.bakedAngled.covers, 'a fully-baked angled slot is still covered — the wizard path is untouched').toBe(true);
    expect(r.bakedAngled.absorbs, '…because it absorbs its own rotation').toBe(true);
    // ⚠ t1514 — the pin that flipped. It read `.toBe(false)` with a `/bearing of 30/` refusal behind it; the packed
    // angled shape was refused because the atom would have dropped the angle. C5 removed the cause, so it is covered.
    expect(r.liveAngled.covers, '⚠ the packed ANGLED shape is COVERED since C5 — t1510 measured it refused').toBe(true);
    expect(r.liveAngled.gap, '…with no refusal left to make').toBe('');
    expect(r.liveAngled.absorbs, '…because a live frame absorbs its own rotation now').toBe(true);
    // …and the reachable case is still reachable, unchanged
    expect(r.liveStraight.covers, 'the packed AXIS-ALIGNED shape stays covered — there is no angle to drop').toBe(true);
    expect(r.liveStraight.gap, '…with no refusal at all').toBe('');
    expect(r.bakedRotProgram.covers, 'and a program rotation with no bearing is untouched').toBe(true);
    expect(r.liveRotProgram.covers, '…as is a LIVE frame turning about the part datum, which C5 also lifted').toBe(true);
    // WHAT IS LEFT REFUSED, and it is narrow: two pivots on one live origin, and skim
    expect(r.liveTwoPivots.covers, '⚠ a bearing AND a program rotation on a live origin still refuses').toBe(false);
    expect(r.liveTwoPivots.gap, 'the refusal names the bearing and the number').toMatch(/bearing of 30/);
    expect(r.liveTwoPivots.gap, '…and says WHY: two pivots cannot share one register origin').toMatch(/TWO rotations|two different pivots/);
    expect(r.liveTwoPivots.gap, '…and names an exit rather than a capability to wait for').toMatch(/drop the program rotation/);
    expect(r.liveTwoPivots.gap, '…so no sentence promises a capability that has already shipped').not.toMatch(/waits on C5/);
    expect(r.liveSkim.covers, 'and a skim frame still refuses — it has no datum to turn about').toBe(false);
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
    // ⚠ t1514 — the reach ROW moved with the capability. It read "the reachable arm is the bearing-0 one"; the row
    // still carries that (it is what the axis-aligned lift measured) and now leads with what C5 added.
    expect(d.dom.reachableToday, 'the reachable arm is ANY bearing since C5').toMatch(/ANY BEARING/);
    expect(d.dom.reachableToday, '…and it keeps the bearing-0 measurement it lifted from').toMatch(/BEARING IS 0/);
    expect(d.dom.refusedToday, '…what is refused is the two-pivot pair, and the row remembers what it used to say').toMatch(/TWO pivots/);
    expect(d.dom.fieldListDeltaCorrected, 'the field list gains PLUNGE, which the scout\'s delta line omitted').toMatch(/PLUNGE/);
    expect(d.dom.theCapabilityThatWouldLiftIt, 'the angled half was named as a CAPABILITY (C5), not as effort').toMatch(/C5/);
    expect(d.dom.theCapabilityThatWouldLiftIt, '…and that capability is recorded as LANDED, not as pending').toMatch(/LANDED/);
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
