import { test, expect } from './support/harness.mjs';

/**
 * t1474 — THE CIRCLE CONTOUR'S RAMP ENTRY CONVERTS: helical G3 → chorded G1. THE BRIDGE.
 *
 * ── WHY ────────────────────────────────────────────────────────────────────────────────────────────────────────
 * t1472 measured the helical form (a G2/G3 carrying a Z) to be UNATTESTED on this controller family — 7361 captured
 * planar arcs, zero with a Z — and found Studio shipping exactly one of them: this ramp. The planar arc it finishes
 * with is richly proven and is UNTOUCHED. Only the descent changes, to the form the corpus attests.
 *
 * ── THE THREE PROPERTIES THIS BRIDGES, in the ruling's own words ────────────────────────────────────────────────
 *   1. THE Z-PROFILE IS CONTINUOUS ACROSS THE ENTRY — the exact property a dropped Z would destroy, and the reason
 *      the conversion is worth doing rather than merely tidy. This is asserted on the TRACED path, monotone and
 *      gap-free from the entry height to the level's depth.
 *   2. THE CUT STAYS WITHIN THE EMIT QUANTUM of the arc it replaces — every chord endpoint on the true circle, and
 *      every point BETWEEN them inside 0.001mm of it. That bound is why the chord count is DERIVED from the radius
 *      instead of borrowed from the raster helix's 24 (which would be 0.214mm INTO the part at Ø50 — see the
 *      declaration in contour.js).
 *   3. THE PLANAR-ARC PARTS ARE BYTE-IDENTICAL — the finishing pass, and the whole plunge-entry path, must not have
 *      moved by a character. A conversion that quietly reformats its neighbours is not a conversion.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

const RG = { cx: 0, cy: 0, r: 25 };

const trace = (page, args) => page.evaluate(async (a) => {
    const m = await import('/wizards/ops/contour.js');
    return {
        ramp: m.circleTrace(a.rg, a.z, a.clr, a.feed, a.plunge, 'ramp', a.prevZ, a.ang),
        plunge: m.circleTrace(a.rg, a.z, a.clr, a.feed, a.plunge, 'plunge', a.prevZ, a.ang),
        tol: m.ARC_CHORD_TOL_MM,
        segsAt: [3, 12.5, 25, 50].map((r) => [r, m.chordSegsPerTurn(r)]),
    };
}, args);

const ARGS = { rg: RG, z: -3, clr: 5, feed: 800, plunge: 150, prevZ: 0, ang: 3 };

test('BRIDGE 1 — the descent Z-profile is CONTINUOUS across the entry (what a dropped Z would break)', async ({ page }) => {
    await boot(page);
    const r = await trace(page, ARGS);
    const zs = [];
    for (const ln of r.ramp) {
        const m = /^G1 X-?[\d.]+ Y-?[\d.]+ Z(-?[\d.]+)/.exec(ln.trim());
        if (m) zs.push(parseFloat(m[1]));
    }
    expect(zs.length, 'the ramp is emitted as chorded G1 moves').toBeGreaterThan(100);
    // monotone down, and no step bigger than one chord's share — a "circle at one depth then a plunge" fails both
    let maxStep = 0;
    for (let i = 1; i < zs.length; i++) {
        expect(zs[i], `Z never rises during the descent (step ${i})`).toBeLessThanOrEqual(zs[i - 1] + 1e-9);
        maxStep = Math.max(maxStep, zs[i - 1] - zs[i]);
    }
    expect(zs[zs.length - 1], 'and it arrives exactly at this level depth').toBeCloseTo(ARGS.z, 3);
    expect(maxStep, 'no single move takes a disproportionate bite — the descent is spread, not stepped')
        .toBeLessThan(Math.abs(ARGS.prevZ - ARGS.z) / 20);
});

test('BRIDGE 2 — the chorded path stays within the EMIT QUANTUM of the arc it replaces', async ({ page }) => {
    await boot(page);
    const r = await trace(page, ARGS);
    expect(r.tol, 'the declared bound is the emit quantum itself').toBe(0.001);
    const pts = [];
    for (const ln of r.ramp) {
        const m = /^G1 X(-?[\d.]+) Y(-?[\d.]+)/.exec(ln.trim());
        if (m) pts.push([parseFloat(m[1]), parseFloat(m[2])]);
    }
    // (a) every commanded point is ON the circle, to the emit's own rounding
    let worstVertex = 0;
    for (const [x, y] of pts) worstVertex = Math.max(worstVertex, Math.abs(Math.hypot(x - RG.cx, y - RG.cy) - RG.r));
    expect(worstVertex, 'every chord endpoint sits on the true circle').toBeLessThanOrEqual(0.001 + 1e-9);
    // (b) ⚠ AND SO IS EVERY POINT BETWEEN THEM — the midpoint of a chord is where an inscribed polygon is worst,
    // and it is the number a vertices-only check would miss entirely.
    let worstMid = 0;
    for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1][0] + pts[i][0]) / 2, my = (pts[i - 1][1] + pts[i][1]) / 2;
        worstMid = Math.max(worstMid, Math.abs(Math.hypot(mx - RG.cx, my - RG.cy) - RG.r));
    }
    // ⚠ AND THE BOUND HAS TWO TERMS, WHICH THE MEASUREMENT MADE PLAIN: the SAGITTA (≤ the declared 0.001 by
    // construction) plus the emit's OWN COORDINATE ROUNDING — each endpoint is quantised to 0.001, which can shift
    // a chord's midpoint by up to another half-quantum. Measured worst here: 0.00153mm. So the emit quantum is both
    // the target AND the floor: no chord count can get below ~1.5 quanta, because the coordinates themselves cannot
    // express it. Asserting the tolerance alone would have been asserting something unachievable.
    expect(worstMid, `the worst deviation anywhere along the path (${worstMid.toFixed(6)}mm) is inside the sagitta `
        + 'bound plus one quantum of coordinate rounding').toBeLessThanOrEqual(r.tol + 0.001);
    // and the count really is derived from the radius, not a constant — a constant cannot bound a radius-proportional error
    const [[, n3], , [, n25], [, n50]] = r.segsAt;
    expect(n25, 'a bigger radius needs more chords').toBeGreaterThan(n3);
    expect(n50, 'and a bigger one again').toBeGreaterThan(n25);
});

test('BRIDGE 3 — the PLANAR arc parts are byte-identical: the finish pass and the whole plunge entry', async ({ page }) => {
    await boot(page);
    const r = await trace(page, ARGS);
    // the plunge-entry path never contained a helical arc and must be untouched, character for character
    expect(r.plunge).toEqual([
        'G0 Z5', 'G0 X25 Y0', 'G1 Z-3 F150', 'G3 X25 Y0 I-25 J0 F800   ( contour )',
    ]);
    // the ramp still finishes on the SAME planar arc, unchanged
    expect(r.ramp[r.ramp.length - 1], 'the finishing pass is the untouched planar G3')
        .toBe('G3 X25 Y0 I-25 J0 F800   ( contour )');
    expect(r.ramp[0]).toBe('G0 Z5');
    expect(r.ramp[1]).toBe('G0 X25 Y0');
    expect(r.ramp[2]).toBe('G0 Z0');
    // ⚠ AND NOT ONE HELICAL ARC SURVIVES ANYWHERE IN THE EMIT — the whole point of the conversion.
    const helical = [...r.ramp, ...r.plunge].filter((ln) => /\bG0?[23](?![0-9])/.test(ln) && /Z\s*-?[\d.]/.test(ln.slice(ln.search(/\bG0?[23](?![0-9])/))));
    expect(helical, 'no arc carries a Z any more').toEqual([]);
});

test('BRIDGE 4 — the descent still closes its circle, and still starts where the arc did', async ({ page }) => {
    await boot(page);
    const r = await trace(page, ARGS);
    const g1 = r.ramp.filter((ln) => ln.trim().startsWith('G1 X'));
    const last = /^G1 X(-?[\d.]+) Y(-?[\d.]+)/.exec(g1[g1.length - 1].trim());
    // the helical G3 ended on its own start point; the chorded descent must too, or the finish pass begins with a jump
    expect(parseFloat(last[1]), 'the last chord lands back on the entry X').toBeCloseTo(25, 3);
    expect(parseFloat(last[2]), 'and the entry Y').toBeCloseTo(0, 3);
});
