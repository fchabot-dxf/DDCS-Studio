import { test, expect } from '@playwright/test';

/**
 * t1498 — THE SLOT RE-POINT'S DOMAIN, MEASURED AND GATED (the act's evidence half).
 *
 * The arc closed at t1494 with a RULING left open: a baked-bearing, plunge-or-ramp slot is expressible by the raster
 * atom, so should `slotPath`'s clearing re-point onto it? This spec is what that ruling has to rest on — the domain
 * measured against the FROZEN kernel (`/_test/frozenSlotPath.js`, landed t1496), not against the live one, so the
 * bridges cannot go vacuous the day the re-point lands.
 *
 * ⚠ THE FINDING OF THE TURN, AND IT WAS NOT IN THE ARC'S INVENTORY: the expressible domain is SMALLER than the arc
 * recorded. The arc named two things that keep a slot literal — a DIALLED bearing (trig, V13) and the HELIX entry's
 * entry-end clamp. There is a THIRD, it is not trig, and the wizard's OWN DEFAULTS land in it: a RAMP entry over a
 * PARTIAL last depth level. The slot kernel ramps the ACTUAL remaining drop; the shared atom ramps a NOMINAL full
 * stepdown. Measured below at exactly `(stepdown − lastBite)/tan(rampAngle)`, turned by the bearing.
 *
 * NOTHING IS RE-POINTED IN THIS ACT — `slotStack` still builds the literal leaf, and the whole existing corpus is
 * untouched. What lands is the MEASUREMENT, the arm gate that reads it (`slotRasterArmGap`), and one latent defect
 * closed (the atom's `extent` did not turn with the bearing C3 gave it).
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** Both sides framed at the program clearance `slotPath` documents as the ENCLOSING program's job — without it the
 *  first plunge starts from wherever the tracer happens to be and every config reads as 5mm out. */
const HARNESS = `
    const NL = String.fromCharCode(10);
    const q = (v) => +Number(v).toFixed(3);
    const cuts = (lines) => (traceToolpath(['G90', 'G0 Z5', ...lines, 'M30'].join(NL)).segments || [])
        .filter((s) => !s.rapid)
        .map((s) => [q(s.x1), q(s.y1), q(s.z1), q(s.x2), q(s.y2), q(s.z2)].join(','));
`;

/**
 * ── THE EXPRESSIBLE DOMAIN — the atom IS the kernel, move for move ────────────────────────────────────────────────
 *
 * The relationship bridge the re-point will rest on: every config the gate ACCEPTS reproduces the frozen kernel's
 * whole cut path — not just its passes, the descent too — inside the emit's own 0.001mm quantum.
 */
test('THE BRIDGE — every ACCEPTED slot is the frozen kernel move for move, across the cross-product', async ({ page }) => {
    test.setTimeout(120000);
    await boot(page);
    const r = await page.evaluate(async (H) => {
        const frozen = await import('/_test/frozenSlotPath.js');
        const m = await import('/wizards/ops/surfaceraster.js');
        const { slotRidesRaster, slotRasterParams } = await import('/wizards/ops/slot.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const cuts = eval(`(() => { ${H} return cuts; })()`);

        let accepted = 0, refused = 0; const differ = [];
        for (const wid of [6, 6.5, 8, 10, 12, 13.2, 16.8, 18, 24])
            for (const ang of [0, 30, 45, 90, -30, 137.5, 180])
                for (const entry of ['plunge', 'ramp', 'helix'])
                    for (const pct of [30, 40, 50])
                        for (const [depth, stepdown] of [[1.5, 1.5], [3, 1.5], [4, 1.5], [4.5, 1.5], [3.2, 0.8]])
                            for (const tool of [6, 8]) {
                                const rad = ang * Math.PI / 180;
                                const leaf = { x0: 0, y0: 0, x1: 60 * Math.cos(rad), y1: 60 * Math.sin(rad),
                                    width: wid, tool, stepoverPct: pct, depth, stepdown, entry, rampAngle: 3,
                                    helixDia: 0, helixPitch: 1, feed: 2000, plunge: 150, clearance: 5 };
                                if (!slotRidesRaster(leaf)) { refused++; continue; }
                                accepted++;
                                const s = cuts(frozen.frozenSlotPath(leaf));
                                const a = cuts(m.surfaceRasterLines(slotRasterParams(leaf)));
                                if (s.length !== a.length) { differ.push({ wid, ang, entry, pct, depth, tool, ns: s.length, na: a.length }); continue; }
                                let worst = 0;
                                for (let i = 0; i < s.length; i++) {
                                    const A = s[i].split(',').map(Number), B = a[i].split(',').map(Number);
                                    for (let j = 0; j < 6; j++) worst = Math.max(worst, Math.abs(A[j] - B[j]));
                                }
                                if (worst > 0.0015) differ.push({ wid, ang, entry, pct, depth, tool, worst: +worst.toFixed(4) });
                            }
        return { accepted, refused, differ };
    }, HARNESS);

    expect(r.accepted, 'the accepted domain is substantial, not a token sample').toBeGreaterThan(400);
    expect(r.refused, 'and the gate really does refuse a large slice (helix, zero band, partial-bite ramps)').toBeGreaterThan(200);
    expect(r.differ, `every accepted slot matches the frozen kernel — ${JSON.stringify(r.differ.slice(0, 4))}`).toEqual([]);
});

/**
 * ── THE THIRD GATE — a RAMP over a PARTIAL last bite, which the arc's inventory did not name ──────────────────────
 *
 * Asserted in BOTH directions, because a gate that only proves its refusals is a gate nobody can trust to be tight:
 * every partial-bite ramp DIVERGES (so the refusal is earned) and every full-bite ramp AGREES (so it is not
 * over-broad). And the size is the predicted run difference, not merely "nonzero".
 */
test('THE THIRD GATE — the ramp divergence is EXACTLY the partial last bite, and exactly the predicted run', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (H) => {
        const frozen = await import('/_test/frozenSlotPath.js');
        const m = await import('/wizards/ops/surfaceraster.js');
        const { slotRasterParams, slotRasterArmGap } = await import('/wizards/ops/slot.js');
        const { depthLevels } = await import('/wizards/clearing.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const cuts = eval(`(() => { ${H} return cuts; })()`);

        const out = [];
        for (const [depth, stepdown] of [[1.5, 1.5], [3, 1.5], [4.5, 1.5], [4, 1.5], [5, 1.5], [2, 1.5], [3.2, 0.8], [3.5, 0.8], [7, 2.5]]) {
            const leaf = { x0: 0, y0: 0, x1: 60, y1: 0, width: 12, tool: 6, stepoverPct: 40, depth, stepdown,
                entry: 'ramp', rampAngle: 3, helixDia: 0, helixPitch: 1, feed: 2000, plunge: 150, clearance: 5 };
            const lv = depthLevels(depth, stepdown);
            const lastBite = lv.length > 1 ? lv[lv.length - 1] - lv[lv.length - 2] : lv[0];
            const full = Math.abs(lastBite - stepdown) < 1e-9;
            const s = cuts(frozen.frozenSlotPath(leaf)), a = cuts(m.surfaceRasterLines(slotRasterParams(leaf)));
            let worst = 0;
            if (s.length === a.length) for (let i = 0; i < s.length; i++) {
                const A = s[i].split(',').map(Number), B = a[i].split(',').map(Number);
                for (let j = 0; j < 6; j++) worst = Math.max(worst, Math.abs(A[j] - B[j]));
            }
            out.push({ depth, stepdown, lastBite: +lastBite.toFixed(6), full,
                worst: +worst.toFixed(3), gap: slotRasterArmGap(leaf),
                predicted: +((stepdown - lastBite) / Math.tan(3 * Math.PI / 180)).toFixed(3) });
        }
        return out;
    }, HARNESS);

    for (const c of r) {
        if (c.full) {
            expect(c.worst, `depth ${c.depth}@${c.stepdown}: a FULL last bite agrees with the kernel`).toBeLessThanOrEqual(0.0015);
            expect(c.gap, `depth ${c.depth}@${c.stepdown}: …so the gate must NOT refuse it`).toBe('');
        } else {
            // ⚠ the refusal is EARNED: the divergence is real, and it is the predicted run, not a rounding
            expect(c.worst, `depth ${c.depth}@${c.stepdown}: a PARTIAL last bite (${c.lastBite}) really does diverge`).toBeGreaterThan(1);
            expect(c.worst, `…by exactly (stepdown − lastBite)/tan(rampAngle) = ${c.predicted}mm`).toBeCloseTo(c.predicted, 2);
            expect(c.gap, `…and the gate refuses it in its own words`).toMatch(/PARTIAL last depth level/);
        }
    }
    // the wizard's OWN defaults are in the refused set — the reason this is routed rather than rounded past
    const dflt = r.find((c) => c.depth === 4 && c.stepdown === 1.5);
    expect(dflt.full, 'the shipped defaults (depth 4 @ stepdown 1.5) end on a PARTIAL bite').toBe(false);
    expect(dflt.worst, 'and a default ramping slot would have moved 9.54mm').toBeCloseTo(9.54, 2);
});

/**
 * ── THE ZERO BAND — the degenerate the arc's C1 row recorded, measured as an EMPTY emit ───────────────────────────
 * At width == tool the kernel cuts one centreline pass and the atom, handed a span its two insets collapse to
 * nothing, refuses through its collapsed-inset guard and emits NO MOTION AT ALL. A refusal where a pass belongs.
 */
test('THE ZERO BAND — width == tool: the kernel cuts, the atom emits nothing, and the gate routes it literal', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (H) => {
        const frozen = await import('/_test/frozenSlotPath.js');
        const m = await import('/wizards/ops/surfaceraster.js');
        const { slotRasterParams, slotRasterArmGap, slotRidesRaster } = await import('/wizards/ops/slot.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const cuts = eval(`(() => { ${H} return cuts; })()`);
        const leaf = { x0: 0, y0: 0, x1: 60, y1: 0, width: 6, tool: 6, stepoverPct: 40, depth: 3, stepdown: 1.5,
            entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, feed: 2000, plunge: 150, clearance: 5 };
        const wider = { ...leaf, width: 6.5 };
        return {
            kernelCuts: cuts(frozen.frozenSlotPath(leaf)).length,
            atomCuts: cuts(m.surfaceRasterLines(slotRasterParams(leaf))).length,
            gap: slotRasterArmGap(leaf), rides: slotRidesRaster(leaf),
            widerRides: slotRidesRaster(wider),   // just past the band, the atom is back
        };
    }, HARNESS);
    expect(r.kernelCuts, 'the kernel cuts a real centreline pass at every level').toBeGreaterThan(0);
    expect(r.atomCuts, 'the atom emits NO motion at all — the collapsed-inset refusal').toBe(0);
    expect(r.rides, 'so this width must NOT ride the atom').toBe(false);
    expect(r.gap, 'and the gate names the zero band').toMatch(/ZERO band/);
    expect(r.widerRides, 'a hair wider and the atom is back — the boundary is the band, not the width').toBe(true);
});

/**
 * ── THE GATE'S OTHER CLAUSES, each in its own words rather than as a bare false ───────────────────────────────────
 */
test('THE GATE — every refusal names its own reason, and the too-small law is untouched on both sides', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const s = await import('/wizards/ops/slot.js');
        const base = { x0: 0, y0: 0, x1: 60, y1: 0, width: 12, tool: 6, stepoverPct: 40, depth: 3, stepdown: 1.5,
            entry: 'plunge', rampAngle: 3, feed: 2000, plunge: 150, clearance: 5 };
        return {
            ok: s.slotRasterArmGap(base),
            helix: s.slotRasterArmGap({ ...base, entry: 'helix' }),
            zeroLen: s.slotRasterArmGap({ ...base, x1: 0, y1: 0 }),
            tooSmall: s.slotRasterArmGap({ ...base, width: 4 }),
            // t1444's ruling: EXACTLY tool-width is ALLOWED (it still cuts) — it is the zero BAND that routes it
            // literal, not a refusal. Both sides of that line asserted here so the re-point cannot blur them.
            exactRefuses: s.slotTooSmall({ ...base, width: 6, tool: 6 }),
            underRefuses: s.slotTooSmall({ ...base, width: 5.9, tool: 6 }),
            bearing0: s.slotBearingDeg({ x0: 0, y0: 0, x1: 60, y1: 0 }),
            bearing30: +s.slotBearingDeg({ x0: 0, y0: 0, x1: 60 * Math.cos(Math.PI / 6), y1: 60 * Math.sin(Math.PI / 6) }).toFixed(6),
            gapDecl: s.SLOT_RAMP_PARTIAL_GAP, helixDecl: s.SLOT_HELIX_GAP,
        };
    });
    expect(r.ok, 'a plain wide plunging slot rides').toBe('');
    expect(r.helix, 'a helix names the entry-end clamp').toMatch(/ENTRY END/);
    expect(r.zeroLen, 'a zero-length slot is a plunged hole').toMatch(/single plunged hole/);
    expect(r.tooSmall, 'a slot narrower than its tool has no walk to re-point').toMatch(/no motion at all/);
    // ⚠ the t1444 line, both sides — exactly tool-width still CUTS (so it is not a refusal), strictly under does not
    expect(r.exactRefuses, 'EXACTLY tool-width is allowed — it still cuts one pass').toBe(false);
    expect(r.underRefuses, 'strictly narrower refuses').toBe(true);
    expect(r.bearing0, 'a due-east slot bears 0').toBe(0);
    expect(r.bearing30, 'and a 30° slot bears 30 — baked, from two drawn endpoints').toBeCloseTo(30, 6);
    expect(r.gapDecl, 'the new boundary is DATA, and it names what it measured').toMatch(/9\.54mm on the wizard's OWN defaults/);
    expect(r.helixDecl, 'as is the helix gate').toMatch(/rect inradius/);
});

/**
 * ── THE LATENT DEFECT C3 LEFT OPEN — the atom's declared FOOTPRINT did not turn with its bearing ─────────────────
 *
 * `liveExtent` reads this in preference to placeonstock's frozen snapshot, so an angled op attached to a stock
 * corner would have been aligned by a rectangle that is not its own — t1402's measured defect, one capability later.
 * Nothing shipped could reach it (no caller set a bearing), which is exactly why it had to be closed BEFORE the
 * re-point rather than after.
 */
test('THE FOOTPRINT — the atom\'s extent turns with the bearing, and is the slot channel\'s own bbox', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterBlock } = await import('/wizards/ops/surfaceraster.js');
        const { slotRasterParams } = await import('/wizards/ops/slot.js');
        const { slotBBox } = await import('/wizards/slotWizard.js');
        const q = (o) => ({ minX: +o.minX.toFixed(6), maxX: +o.maxX.toFixed(6), minY: +o.minY.toFixed(6), maxY: +o.maxY.toFixed(6) });
        const out = [];
        for (const ang of [0, 30, 45, 90, -30, 137.5, 180]) {
            const rad = ang * Math.PI / 180;
            const wiz = { ax: 0, ay: 0, bx: 60 * Math.cos(rad), by: 60 * Math.sin(rad), width: 12, toolDia: 6 };
            const leaf = { x0: wiz.ax, y0: wiz.ay, x1: wiz.bx, y1: wiz.by, width: 12, tool: 6,
                stepoverPct: 40, depth: 3, stepdown: 1.5, entry: 'plunge' };
            out.push({ ang, atom: q(surfaceRasterBlock.extent(slotRasterParams(leaf))), slot: q(slotBBox(wiz)) });
        }
        // the UNROTATED contract is untouched: no bearing → the plain x..x+w / y..y+h rect it always declared
        const plain = surfaceRasterBlock.extent({ x: 5, y: 7, w: 100, h: 80 });
        return { out, plain, live: surfaceRasterBlock.extent({ x: 5, y: 7, w: 100, h: 80, bearing: '#30' }) };
    });
    expect(r.plain, 'with no bearing it is byte-for-byte the rect it always declared').toEqual({ minX: 5, maxX: 105, minY: 7, maxY: 87 });
    expect(r.live, 'a DIALLED bearing has no build-time footprint, so it declares none rather than guessing').toBe(null);
    for (const c of r.out) {
        expect(c.atom, `bearing ${c.ang}: the atom's footprint IS the slot channel's bbox`).toEqual(c.slot);
    }
});
