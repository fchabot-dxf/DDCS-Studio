import { test, expect } from '@playwright/test';

/**
 * t1494 (C3) — THE BAKED BEARING. Slot capability arc 4/4, and the arc CLOSES here.
 *
 * The atom's rows have always run parallel to X or Y. A slot's passes run on its BEARING, and `rotAngle` could not
 * express it: that socket means the PROGRAM's declared rotation, a second and unrelated quantity the bearing has to
 * compose WITH rather than borrow.
 *
 * ── BAKED ONLY, AND THE SPLIT IS EVIDENCE RATHER THAN EFFORT ─────────────────────────────────────────────────────
 * A bearing is geometry the operator DREW, not a knob they turn at the pendant, so the baked form is what a slot
 * needs: two build-time constants, no registers, no evidence. A DIALLED bearing would need COS/SIN of a runtime
 * angle — trig, unverified on this controller, V13's decision — and is REFUSED here in its own words.
 *
 * ── THE THREE MEASUREMENTS, IN THE ORDER THEY WERE TAKEN ─────────────────────────────────────────────────────────
 *   1. THE ALGEBRA, before any emit changed: two rotations about different pivots compose into ONE rotation by the
 *      sum plus a translation (worst error 5.7e-14). That is what lets `bearingShift` fold the bearing into the
 *      rotation this atom already had, with the translation absorbed by the origin it already carries.
 *   2. SELF-CONSISTENCY: a bearing must be a PURE ROTATION of the atom's own unrotated path. This is the assert
 *      that caught the act's two real defects — pivoting on the walk origin instead of the declared one (the inset
 *      then held the walk in from the world's axes instead of across the PASS), and shifting the frame's origin
 *      while the walks still declared their constants from the unshifted one.
 *   3. THE BRIDGE against slotPath at seven bearings.
 * …plus THE NULL CASE, which this arc row calls the strongest assert this step has, and it is right.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * ── THE NULL CASE — a zero bearing reproduces the unrotated emit BYTE-FOR-BYTE ────────────────────────────────────
 *
 * Over the cross-product INCLUDING rotated configs and both row anchors: 864 programs. It holds by construction
 * rather than by an argument about rounding — a zero bearing takes the untouched path entirely, because the
 * composite form picks a different pivot and shifts the origin, which is arithmetically identical but prints
 * different intermediate constants.
 */
test('THE NULL CASE — bearing 0 is the unrotated emit, character for character, across the cross-product', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const NL = String.fromCharCode(10);
        let count = 0; const differ = [];
        for (const strategy of ['parallel', 'concentric'])
            for (const entry of ['plunge', 'ramp', 'helix'])
                for (const direction of ['bothways', 'oneway', 'otherway'])
                    for (const rowAxis of ['x', 'y'])
                        for (const zMode of ['', 'skim'])
                            for (const inset of [0, 3, '#6'])
                                for (const rotAngle of [0, 17])
                                    for (const rowAnchor of ['fit', 'wall']) {
                                        count++;
                                        const b = { x: 12.5, y: -7.25, z0: 2, w: 80, h: 60, depth: 3, stepdown: 1.5,
                                            toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5,
                                            strategy, entry, direction, rowAxis, zMode, rotAngle, rotPivotX: 3,
                                            rotPivotY: 4, rampAngle: 3, helixDia: 4, helixPitch: 0.75, inset, rowAnchor };
                                        if (m.surfaceRasterLines(b).join(NL) !== m.surfaceRasterLines({ ...b, bearing: 0 }).join(NL)) {
                                            differ.push(`${strategy}/${entry}/${rowAxis}/rot${rotAngle}/${rowAnchor}`);
                                        }
                                    }
        return { count, differ };
    });
    expect(r.count, 'the cross-product covers both anchors and the rotated configs').toBe(864);
    expect(r.differ, `a zero bearing changes nothing — ${JSON.stringify(r.differ.slice(0, 3))}`).toEqual([]);
});

/**
 * ── SELF-CONSISTENCY — a bearing IS a rotation, measured against the atom's own unrotated path ───────────────────
 * Independent of slotPath entirely, which is what makes it able to catch a placement error in the bridge harness
 * rather than blaming the code for it (it did, both ways round, during this act).
 */
test('SELF-CONSISTENT — a bearing rotates the atom\'s own path about the DECLARED origin, and nothing else', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const NL = String.fromCharCode(10);
        const cuts = (lines) => (traceToolpath(['G90', ...lines, 'M30'].join(NL)).segments || [])
            .filter((s) => !s.rapid).map((s) => [s.x1, s.y1, s.x2, s.y2]);
        const P = { x: 0, y: -6, z0: 0, w: 60, h: 12, insetAlong: 0, insetAcross: 3, rowAnchor: 'wall', depth: 1.5,
            stepdown: 1.5, toolDia: 6, stepoverPct: 40, feed: 2000, plunge: 150, clearance: 5, strategy: 'parallel',
            direction: 'bothways', entry: 'plunge', rowAxis: 'x' };
        const base = cuts(m.surfaceRasterLines(P));
        const out = [];
        for (const ang of [30, 45, 90, -30, 137.5]) {
            const rot = cuts(m.surfaceRasterLines({ ...P, bearing: ang }));
            const rad = ang * Math.PI / 180, c = Math.cos(rad), s2 = Math.sin(rad);
            const sp = (x, y) => [P.x + (x - P.x) * c - (y - P.y) * s2, P.y + (x - P.x) * s2 + (y - P.y) * c];
            let worst = 0;
            if (base.length !== rot.length) { out.push({ ang, worst: -1 }); continue; }
            for (let i = 0; i < base.length; i++) {
                const [ax, ay] = sp(base[i][0], base[i][1]), [bx, by] = sp(base[i][2], base[i][3]);
                worst = Math.max(worst, Math.abs(ax - rot[i][0]), Math.abs(ay - rot[i][1]), Math.abs(bx - rot[i][2]), Math.abs(by - rot[i][3]));
            }
            out.push({ ang, worst: +worst.toFixed(4), moves: rot.length });
        }
        return out;
    });
    for (const c of r) {
        expect(c.worst, `bearing ${c.ang}: the path is the unrotated one turned about the declared origin`).toBeGreaterThanOrEqual(0);
        expect(c.moves, `bearing ${c.ang}: it still cuts`).toBeGreaterThan(0);
        expect(c.worst, `bearing ${c.ang}: within the emit's own 0.001mm quantum (worst ${c.worst})`).toBeLessThanOrEqual(0.0015);
    }
});

/**
 * ── THE BRIDGE — against slotPath's own angled passes ────────────────────────────────────────────────────────────
 * The op is placed so the walked rect's near-edge MIDPOINT lands on the slot's start: (x,y) = A − R(bearing)(0, h/2).
 * ⚠ That placement is computed UNROUNDED. Rounding it to the emit's 3 decimals injects up to half a quantum of
 * placement error and then reports it as a code difference — measured during this act at 137.5°, where it read
 * 0.0020 until the harness stopped rounding its own inputs.
 */
const BEARINGS = [0, 30, 45, 90, -30, 137.5, 180];
for (const ang of BEARINGS) {
    test(`THE BRIDGE — a ${ang}° slot: the atom's passes are slotPath's passes`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async (ang) => {
            const { slotPath } = await import('/wizards/ops/slot.js');
            const m = await import('/wizards/ops/surfaceraster.js');
            const { traceToolpath } = await import('/engine/trace.js');
            const NL = String.fromCharCode(10);
            const q = (v) => +Number(v).toFixed(3);
            const passes = (lines) => (traceToolpath(['G90', ...lines, 'M30'].join(NL)).segments || [])
                .filter((s) => !s.rapid && Math.abs(s.z1 - s.z2) < 1e-6 && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 5)
                .map((s) => [q(s.x1), q(s.y1), q(s.x2), q(s.y2)].join(',')).sort();
            const len = 60, wid = 12, tool = 6, pct = 40, rad = ang * Math.PI / 180;
            const c = Math.cos(rad), sn = Math.sin(rad);
            const common = { depth: 1.5, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5 };
            const slot = slotPath({ x0: 0, y0: 0, x1: len * c, y1: len * sn, width: wid, tool, stepoverPct: pct, ...common });
            const atom = m.surfaceRasterLines({ x: (wid / 2) * sn, y: -(wid / 2) * c, z0: 0, w: len, h: wid,
                insetAlong: 0, insetAcross: tool / 2, rowAnchor: 'wall', bearing: ang, toolDia: tool,
                stepoverPct: pct, strategy: 'parallel', direction: 'bothways', entry: 'plunge', rowAxis: 'x', ...common });
            const sp = passes(slot), ap = passes(atom);
            let worst = 0;
            if (sp.length === ap.length) for (let i = 0; i < sp.length; i++) {
                const a = sp[i].split(',').map(Number), b = ap[i].split(',').map(Number);
                for (let j = 0; j < 4; j++) worst = Math.max(worst, Math.abs(a[j] - b[j]));
            }
            return { n: sp.length, m: ap.length, worst: +worst.toFixed(4) };
        }, ang);
        expect(r.n, 'the slot kernel cuts passes here').toBeGreaterThan(1);
        expect(r.m, `the atom cuts the same NUMBER of passes (slot ${r.n})`).toBe(r.n);
        expect(r.worst, `and each lands in the same place (worst ${r.worst}mm)`).toBeLessThanOrEqual(0.0015);
    });
}

/**
 * ── THE TRIG GATE — the live half is refused, in its own words ───────────────────────────────────────────────────
 */
test('THE GATE — a BAKED bearing is ungated; a DIALLED one is refused with its reason', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const { SLOT_RASTER_GAP } = await import('/wizards/ops/slot.js');
        const arc = await import('/data/slotCapabilityArc.js');
        const base = { strategy: 'parallel', entry: 'plunge', w: 60, h: 12 };
        return {
            bakedGap: m.surfaceRasterLiveGap({ ...base, bearing: 30 }),
            liveGap: m.surfaceRasterLiveGap({ ...base, bearing: '#30' }),
            bakedCovers: m.surfaceRasterCovers({ ...base, bearing: 30 }),
            isLive: m.rasterBearingIsLive({ bearing: '#30' }), isBaked: m.rasterBearingIsLive({ bearing: 30 }),
            zero: m.rasterBearingOf({}), read: m.rasterBearingOf({ bearing: 30 }),
            // the shift resolves both rotations into one, and is a NO-OP when no bearing is asked for
            noBear: m.bearingShift({ bearing: 0, rotA: 17, rotPX: 3, rotPY: 4 }),
            withBear: m.bearingShift({ bearing: 30, rotA: 17, rotPX: 3, rotPY: 4, ox: 1, oy: 2 }),
            gap: SLOT_RASTER_GAP,
            landed: arc.SLOT_CAPABILITIES.find((c) => c.id === 'bearing').landed,
        };
    });
    expect(r.zero, 'no bearing is zero').toBe(0);
    expect(r.read, 'and a declared one is read as degrees').toBe(30);
    expect(r.isBaked, 'a number is baked').toBe(false);
    expect(r.isLive, 'a register is live').toBe(true);
    // ⚠ THE SPLIT: baked passes, dialled refuses — and the refusal names TRIG, not geometry
    expect(r.bakedGap, 'a baked bearing needs no evidence at all').toBe('');
    expect(r.bakedCovers, 'so it is inside the envelope').toBe(true);
    expect(r.liveGap, 'a dialled one is refused').not.toBe('');
    expect(r.liveGap, 'and the reason is TRIG, with the decider named').toMatch(/COS\/SIN of a runtime angle/);
    expect(r.liveGap, 'V13 is what lifts it').toMatch(/V13_trig/);
    // THE COMPOSITION: one rotation by the sum, and untouched when no bearing is asked for
    expect(r.noBear, 'no bearing → the frame call is exactly what it was').toEqual({ tx: 0, ty: 0, angle: 17, pivotX: 3, pivotY: 4 });
    expect(r.withBear.angle, 'a bearing → ONE rotation by the SUM of the two angles').toBe(47);
    expect(r.withBear.pivotX, 'about a shifted origin rather than two pivots').toBe(0);
    // THE ARC CLOSES, and the declarations say what is left
    expect(r.gap, 'the boundary records the axis clause retired by C3').toMatch(/C3 \(t1494\) gave it a BAKED bearing/);
    expect(r.gap, 'all four clauses are retired').toMatch(/ALL FOUR CLAUSES ARE RETIRED NOW/);
    expect(r.gap, 'and what is left is named as EVIDENCE gates, not capability gaps').toMatch(/TWO NAMED EVIDENCE GATES/);
    expect(r.gap, 'so re-pointing the kernel is a ruling, not a gap').toMatch(/a RULING rather than a capability gap/);
    expect(r.landed, 'the arc records C3 shipped baked').toMatch(/SHIPPED at t1494, BAKED/);
    expect(r.landed, 'and that the live half did not').toMatch(/THE LIVE HALF DID NOT SHIP/);
});
