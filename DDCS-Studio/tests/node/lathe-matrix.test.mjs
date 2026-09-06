import { test, expect } from './support/harness.mjs';

/**
 * t1297 — THE LATHE CONFIG MATRIX. ~50 configurations across all five lathe wizards, each run the whole way through
 * the app's own chain — builderOf → emit → trace → carve — and judged against a truth DERIVED HERE.
 *
 * THAT IS THE POINT OF THE FILE. Every expected pass list, wall position, peck floor and polygon radius below is
 * computed from the parameters by an independent formula written in this spec; nothing is read back out of the app
 * and then asserted to equal itself. A per-op spec proves an op is self-consistent at its defaults; this one asks
 * whether the family still tells the truth at fifty settings a user might actually type.
 *
 * MERGE-GATE WEIGHT, deliberately: ~50 emits/traces/carves is too heavy for a per-change fast tier, and it earns its
 * place in the full suite instead. (Ported from the advisor's probe script, whose derivations are the ones here.)
 *
 * t2689 — TIER MIGRATION BATCH 2: shape-gated before moving (batch 1's middle-superset lesson: a giant compute sweep
 * can REGRESS in node). MEASURED first: this file's own comment claims "too heavy for a per-change fast tier," but
 * the actual browser run timed 4.84s total across all 5 tests — nothing like middle-superset's 14336-combo sweep.
 * Converted and re-measured: 5/5 pass in well under a second, no regression. boot() seeds all 5 lathe turning twins
 * via createUserOp (batch 1's registerUserOp-vs-listUserOps bug applies here too), fresh-if-missing per call.
 */
const EPS = 0.13;                                  // half a profile step
const near = (a, b, e = EPS) => Math.abs(a - b) <= e;
const BAR_R = 10;                                  // every op's default bar: Ø20 → radius 10

/**
 * t1313 — THIS SPEC DECLARES THE BAR IT TESTS. The stock modal made the WORKSPACE record the one bar in the chuck,
 * so an op's own `barDiameter` default no longer outranks it (that default WAS the parallel store the redesign
 * removed). Every hand-derived truth below is against a Ø20 bar, so the workspace is told to hold one — which is
 * what a turner would have done before running any of this.
 */
const setBar = (page, diameter = 20, stickOut = 60) => page.evaluate(async ({ d, so }) => {
    // built straight from the declared bar shape — NOT through latheSimStock, which now (correctly) prefers the
    // workspace bar and would therefore hand back the one already there instead of the one being asked for
    const { barStock } = await import('/data/stockShape.js');
    window.ddcsGetSettings().stock = barStock({ diameter: d, stickOut: so, allowance: 1 }, window.ddcsGetSettings().stock);
    try { window.ddcsSaveSettings && window.ddcsSaveSettings(); } catch (_) {}
}, { d: diameter, so: stickOut });

const boot = async (page) => {
    const uo = await import('/blocks/userOps.js');
    const { facingDataDef, FACING_DATA_OPTYPE } = await import('/blocks/dataOps/facingData.js');
    const { odTurnDataDef, OD_DATA_OPTYPE } = await import('/blocks/dataOps/odTurnData.js');
    const { partingDataDef, PART_DATA_OPTYPE } = await import('/blocks/dataOps/partingData.js');
    const { centerDrillDataDef, CDRILL_DATA_OPTYPE } = await import('/blocks/dataOps/centerDrillData.js');
    const { polygonDataDef, POLY_DATA_OPTYPE } = await import('/blocks/dataOps/polygonData.js');
    for (const [fn, optype] of [[facingDataDef, FACING_DATA_OPTYPE], [odTurnDataDef, OD_DATA_OPTYPE],
                                 [partingDataDef, PART_DATA_OPTYPE], [centerDrillDataDef, CDRILL_DATA_OPTYPE],
                                 [polygonDataDef, POLY_DATA_OPTYPE]]) {
        if (!uo.listUserOps().some((d) => d.opType === optype)) uo.createUserOp(fn());
    }
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async () => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ name: 'Rig', kind: 'lathe', chuck: 'axis' }, false);
    });
    await setBar(page);   // t1313 — the workspace holds the Ø20 bar these truths are derived against
};

/** One configuration, all the way through the app's own chain: emit → trace → carve, sampled where asked. */
const run = (page, type, extra, zs) => page.evaluate(async ({ t, x, zz }) => {
    const uo = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const P = await import('/data/latheProfile.js');
    const S = await import('/viz/latheScene.js');
    const def = uo.listUserOps().find((d) => d.opType === t);
    const params = { ...uo.defaultParams(def), ...(x || {}) };
    const nc = String(emitProgram(builderOf(t)(params)));
    const prof = P.profileFromBar(S.latheBarFrom(params, {}));
    const segs = (traceToolpath(nc).segments || []).filter((s) => !s.rapid && !s.probe)
        .map((s) => ({ x1: +s.x1.toFixed(4), z1: +s.z1.toFixed(4), x2: +s.x2.toFixed(4), z2: +s.z2.toFixed(4) }));
    for (const s of segs) {
        const onCentre = Math.abs(s.x1) < 0.001 && Math.abs(s.x2) < 0.001;
        if (onCentre && t === 'user_lathe_centerdrill') P.carveBore(prof, 1.5, Math.min(s.z1, s.z2));
        else P.carveSegment(prof, s, Number(params.width) || 0);
    }
    const at = (z) => { const i = Math.max(0, Math.min(prof.n - 1, Math.round((z - prof.z0) / prof.step))); return { o: +prof.rOut[i].toFixed(4), i: +prof.rIn[i].toFixed(4) }; };
    return { segs, stats: P.profileStats(prof), s: Object.fromEntries((zz || []).map((z) => [String(z), at(Number(z))])), nc };
}, { t: type, x: extra, zz: zs });

// ── THE DERIVATIONS ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * FACING: the family's light-pass-first rule. Count UP from the finished face in whole steps until the next one
 * would leave the material, step back once — that outermost remainder is the FIRST cut — then work in to Z0.
 */
const facingPasses = (allowance, doc) => {
    if (doc <= 0) return null;
    let v = 0; while (v < allowance - 1e-9) v += doc; v -= doc;
    const out = []; for (let p = v; p > 1e-9; p -= doc) out.push(+p.toFixed(6));
    out.push(0);
    return out;
};

/** OD ROUGHING: the same rule on the radius — count out from the roughing floor, outermost first, ending on it. */
const odRoughing = (barR, floor, doc) => {
    if (doc <= 0) return [];
    let v = floor; while (v < barR - 1e-9) v += doc; v -= doc;
    const out = []; for (let p = v; p > floor + 1e-9; p -= doc) out.push(+p.toFixed(6));
    out.push(+floor.toFixed(6));
    return out;
};

/** The radius of a polygon's corner, given the size across its flats. The apothem is the flat; this is the corner. */
const cornerR = (across, sides) => (across / 2) / Math.cos(Math.PI / sides);

test('FACING — the pass list, the finished face, and the grip, over 18 configurations', async ({ page }) => {
    await boot(page);
    for (const A of [0.5, 1, 3, 7.9, 8, 12]) {
        for (const D of [0.5, 1, 2.5]) {
            const r = await run(page, 'user_lathe_facing', { allowance: A, doc: D }, [-0.3, -59.7]);
            const cuts = r.segs.filter((s) => near(s.x2, 0, 0.01) && near(s.z1, s.z2, 0.01)).map((s) => +s.z1.toFixed(6));
            expect(cuts, `A=${A} D=${D}: the passes, lightest first, ending on the face`).toEqual(facingPasses(A, D));
            expect(near(r.stats.zEnd, 0), `A=${A} D=${D}: the bar ends exactly at the finished face (zEnd=${r.stats.zEnd})`).toBe(true);
            expect(near(r.s['-59.7'].o, BAR_R), `A=${A} D=${D}: the grip end is untouched (r=${r.s['-59.7'].o})`).toBe(true);
        }
    }
});

test('OD TURNING — roughing plus the FINISH pass, the turned size, and the shoulder wall, over 8 configurations', async ({ page }) => {
    await boot(page);
    for (const [tgt, len] of [[14, 25], [10, 40], [6, 50], [18, 10]]) {
        for (const D of [1, 2]) {
            const F = 0.5, floor = tgt / 2 + F;
            const r = await run(page, 'user_lathe_odturn', { targetDiameter: tgt, depth: len, doc: D, finish: F },
                [-len / 2, -(len - 0.3), -(len + 0.4)]);
            const full = r.segs.filter((s) => near(s.x1, s.x2, 0.001) && near(s.z2, -len, 0.01)).map((s) => +s.x1.toFixed(6));
            // THE FINISH PASS IS ONE OF THEM. It runs the full length at a constant radius exactly like a roughing
            // pass — so a filter on constant-X-to-the-shoulder catches it, and the expected list must say so or the
            // check quietly demands the finish pass be MISSING.
            const want = [...odRoughing(BAR_R, floor, D), +(tgt / 2).toFixed(6)];
            expect(full, `t${tgt} l${len} D${D}: roughing outermost-first, then the finish cut at the size`).toEqual(want);
            expect(near(r.s[String(-len / 2)].o, tgt / 2), `t${tgt} l${len} D${D}: turned to size (r=${r.s[String(-len / 2)].o})`).toBe(true);
            expect(near(r.s[String(-(len - 0.3))].o, tgt / 2), `t${tgt} l${len} D${D}: turned right up to the shoulder`).toBe(true);
            expect(near(r.s[String(-(len + 0.4))].o, BAR_R), `t${tgt} l${len} D${D}: and full bar the other side of it`).toBe(true);
        }
    }
});

test('PARTING — one-sided walls, the slot floor, parting-off, and the peck count', async ({ page }) => {
    await boot(page);
    for (const [face, W, floorDia, peck] of [[-10, 3, 12, 0], [-10, 6, 12, 0], [-20, 3, 0, 0], [-15, 4, 8, 2], [-30, 3, 0, 3]]) {
        const zs = [face + 0.5, face - W + 0.5, face - W - 0.6, face + 1.2];
        const r = await run(page, 'user_lathe_parting', { zFace: face, width: W, floorDiameter: floorDia, peck }, zs);
        const fr = floorDia / 2, through = fr < 0.01;
        const tag = `f${face} w${W} fl${floorDia} p${peck}`;
        if (!through) {
            expect(near(r.s[String(face - W + 0.5)].o, fr), `${tag}: the groove floor is the declared radius (r=${r.s[String(face - W + 0.5)].o})`).toBe(true);
            expect(near(r.s[String(face + 1.2)].o, BAR_R), `${tag}: full bar ahead of the near wall`).toBe(true);
            expect(near(r.s[String(face - W - 0.6)].o, BAR_R), `${tag}: full bar behind the far wall — the kerf is ONE-sided`).toBe(true);
        } else {
            expect(near(r.stats.zEnd, face - W, 0.3), `${tag}: parted off, the stub ending a kerf past the face (zEnd=${r.stats.zEnd})`).toBe(true);
        }
        if (peck > 0) {
            const plunges = r.segs.filter((s) => near(s.z1, face - W, 0.01) && s.x2 < s.x1 - 1e-6);
            expect(plunges.length, `${tag}: one advance per peck down to the floor`).toBe(Math.ceil((BAR_R - fr) / peck));
        }
    }
});

test('CENTRE DRILLING — peck floors, the bore, and an outside diameter left alone', async ({ page }) => {
    await boot(page);
    for (const [depth, peck] of [[15, 5], [30, 4], [40, 6], [12, 0], [7, 10]]) {
        const r = await run(page, 'user_lathe_centerdrill', { depth, peck, kind: peck > 0 ? 'peck' : 'straight' },
            [-(depth - 0.3), -(depth + 0.4), -depth / 2]);
        const bottoms = r.segs.filter((s) => s.z2 < s.z1 - 1e-6 && near(s.x1, 0, 0.01)).map((s) => +s.z2.toFixed(4));
        const want = [];
        if (peck > 0) { for (let d = peck; d < depth - 1e-9; d += peck) want.push(+(-d).toFixed(4)); }
        want.push(-depth);                                            // …and the last peck lands exactly on depth
        const tag = `d${depth} p${peck}`;
        expect(bottoms, `${tag}: each peck deeper by the step, the last one on depth`).toEqual(want);
        expect(r.s[String(-(depth - 0.3))].i, `${tag}: the bore is open just short of the bottom`).toBeGreaterThan(0.5);
        expect(r.s[String(-(depth + 0.4))].i, `${tag}: and solid past it — a drill does not go deeper than it was told`).toBe(0);
        expect(near(r.s[String(-depth / 2)].o, BAR_R), `${tag}: the outside is untouched (r=${r.s[String(-depth / 2)].o})`).toBe(true);
    }
});

test('POLYGON TURNING — the FINAL sweep spans apothem to corner, and no A ever moves without X', async ({ page }) => {
    await boot(page);
    for (const [sides, across] of [[4, 20], [6, 17], [6, 24], [8, 20]]) {
        const r = await page.evaluate(async ({ n, a }) => {
            const uo = await import('/blocks/userOps.js');
            const { builderOf } = await import('/blocks/opBuilders.js');
            const { emitProgram } = await import('/blocks/blockEmitter.js');
            const def = uo.listUserOps().find((d) => d.opType === 'user_lathe_polygon');
            const nc = String(emitProgram(builderOf('user_lathe_polygon')({ ...uo.defaultParams(def), sides: n, acrossFlats: a })));
            const lines = nc.split('\n');
            // THE FINAL SWEEP ONLY. A roughing sweep is a LARGER polygon still buried in the bar, so its corner
            // radius legitimately exceeds the finished one — judging the maximum over every sweep asks the roughing
            // passes to be the finished size, which would be a wrong cut. The emit names its last sweep; take it.
            const at = lines.findIndex((L) => /finishing sweep/.test(L));
            const finalSweep = at >= 0 ? lines.slice(at) : lines;
            const xs = []; let aNoX = 0;
            for (const L of finalSweep) {
                if (!/^G1/.test(L)) continue;
                const mX = L.match(/\bX(-?\d+(?:\.\d+)?)/), hasA = /\bA-?\d/.test(L);
                if (hasA && !mX) aNoX++;
                if (mX) xs.push(Math.abs(parseFloat(mX[1])));
            }
            // …and the no-A-without-X rule is judged over the WHOLE program, roughing included
            let aNoXAll = 0;
            for (const L of lines) { if (/^G1/.test(L) && /\bA-?\d/.test(L) && !/\bX-?\d/.test(L)) aNoXAll++; }
            return { min: Math.min(...xs), max: Math.max(...xs), named: at >= 0, aNoX, aNoXAll, sweeps: lines.filter((L) => /sweep/.test(L)).length };
        }, { n: sides, a: across });
        const tag = `n${sides} a${across}`;
        expect(r.named, `${tag}: the emit names its finishing sweep, so the spec can find it`).toBe(true);
        expect(near(r.min, across / 2, 0.05), `${tag}: the tool comes in to the flat — the apothem (min=${r.min})`).toBe(true);
        expect(near(r.max, cornerR(across, sides), 0.25), `${tag}: and out to the corner (max=${r.max} want=${cornerR(across, sides).toFixed(3)})`).toBe(true);
        expect(r.aNoXAll, `${tag}: the chuck never turns without the cross-slide following it`).toBe(0);
    }
});
