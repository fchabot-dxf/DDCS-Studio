import { test, expect } from '@playwright/test';

/**
 * t1283 — THE LATHE WORLD: the profile carve, the chuck, the turning tool, and a DRO that speaks diameter.
 *
 * THE CARVE IS ASSERTED AGAINST THE HAND-DERIVED PASS TRUTHS, not against itself: after facing removes its 3mm
 * allowance the bar is 3 SHORTER; after turning to Ø14 over 25 the profile steps at exactly those numbers; a Ø12
 * groove at Z−10 leaves Ø12 there and the full bar either side; a 15-deep centre drill opens a bore 15 deep and
 * leaves the outside alone.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async () => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ name: 'Rig', kind: 'lathe', chuck: 'axis' }, false);
    });
};

/** Run an op's real emitted program through the profile carve, exactly as the viz does. */
const carveOp = async (page, type, extra) => page.evaluate(async ({ t, x }) => {
    const uo = await import('/blocks/userOps.js');
    const { builderOf } = await import('/blocks/opBuilders.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const P = await import('/data/latheProfile.js');
    const S = await import('/viz/latheScene.js');
    const def = uo.listUserOps().find((d) => d.opType === t);
    const params = { ...uo.defaultParams(def), ...(x || {}) };
    const nc = String(emitProgram(builderOf(t)(params)));
    const bar = S.latheBarFrom(params, {});
    const prof = P.profileFromBar(bar);
    const cuts = (traceToolpath(nc).segments || []).filter((s) => !s.rapid && !s.probe);
    for (const s of cuts) {
        const onCentre = Math.abs(s.x1) < 0.001 && Math.abs(s.x2) < 0.001;
        if (onCentre) P.carveBore(prof, 1.5, Math.min(s.z1, s.z2));
        else P.carveSegment(prof, s, Number(params.width) || 0);
    }
    const at = (z) => { const i = Math.round((z - prof.z0) / prof.step); return { rOut: prof.rOut[i], rIn: prof.rIn[i] }; };
    return { stats: P.profileStats(prof), bar, at: { f0: at(0), fm1: at(-1), fm5: at(-5), fm13: at(-13), fm26: at(-26), fm40: at(-40) },
             cuts: cuts.length };
}, { t: type, x: extra });

test('FACING SHORTENS THE BAR — by exactly the allowance it removes', async ({ page }) => {
    await boot(page);
    const r = await carveOp(page, 'user_lathe_facing');
    // the bar starts 60 of stick-out plus its 3mm of raw end; facing takes that 3 off
    expect(r.bar.allowance, 'the drawn bar holds the material facing removes').toBe(3);
    expect(r.stats.zEnd, 'the finished face is at Z0 — the raw end is gone').toBeCloseTo(0, 1);
    expect(r.stats.length, 'so the bar is 3 shorter than it started').toBeCloseTo(60, 1);
    // …and just INSIDE the new face it is still the full bar: facing shortens, it does not taper. (Sampled a
    // millimetre in, because the plane the last pass cut THROUGH is by definition where material stops.)
    expect(r.at.fm1.rOut, 'and just inside the new face it is still full diameter').toBeCloseTo(10, 1);
});

test('OD TURNING STEPS THE PROFILE — at exactly the hand-derived diameter and length', async ({ page }) => {
    await boot(page);
    const r = await carveOp(page, 'user_lathe_odturn');
    // Ø14 over 25mm: the turned length sits at radius 7, and beyond it the bar is untouched at radius 10
    expect(r.at.fm5.rOut, 'inside the turned length the bar is at the finished radius').toBeCloseTo(7, 2);
    expect(r.at.fm13.rOut, 'all the way along it').toBeCloseTo(7, 2);
    expect(r.at.fm26.rOut, 'and past the shoulder it is still the raw bar').toBeCloseTo(10, 2);
    expect(r.stats.minDia, 'the smallest diameter left is the one on the drawing').toBeCloseTo(14, 1);
    expect(r.stats.maxDia, 'and the largest is still the bar').toBeCloseTo(20, 1);
});

test('PARTING OPENS ITS GROOVE — at the blade Z, as wide as the blade, and nowhere else', async ({ page }) => {
    await boot(page);
    const r = await carveOp(page, 'user_lathe_parting');
    // the default groove: Ø12 at a face of Z−10 with a 3mm blade → the slot spans Z−13…−10
    expect(r.at.fm13.rOut, 'the groove is cut to its diameter').toBeCloseTo(6, 2);
    expect(r.at.fm5.rOut, 'the bar ahead of it is untouched').toBeCloseTo(10, 2);
    expect(r.at.fm26.rOut, 'and so is the bar behind it').toBeCloseTo(10, 2);
    expect(r.stats.minDia, 'the smallest thing left is the groove floor').toBeCloseTo(12, 1);
});

test('CENTRE DRILLING OPENS A BORE — down the middle, without touching the outside', async ({ page }) => {
    await boot(page);
    const r = await carveOp(page, 'user_lathe_centerdrill');
    expect(r.at.f0.rIn, 'there is a hole at the face').toBeGreaterThan(0);
    expect(r.at.fm5.rIn, 'and it runs into the part').toBeGreaterThan(0);
    expect(r.at.fm26.rIn, 'but stops at the declared depth — 15 deep, so nothing at 26').toBe(0);
    expect(r.at.fm5.rOut, 'and the outside diameter is untouched: a drill is not a turning tool').toBeCloseTo(10, 2);
});

test('THE PROFILE MODEL ITSELF — a cut removes what it passed through, and says when it cut air', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const P = await import('/data/latheProfile.js');
        const p = P.profileFromBar({ diameter: 20, stickOut: 30, allowance: 0 });
        const first = P.carveSegment(p, { x1: 7, z1: 0, x2: 7, z2: -10 });      // a turning pass
        const again = P.carveSegment(p, { x1: 9, z1: 0, x2: 9, z2: -10 });      // …a bigger radius: cuts AIR
        const taper = P.carveSegment(p, { x1: 7, z1: -10, x2: 9, z2: -20 });    // a taper down the bar
        const at = (z) => p.rOut[Math.round((z - p.z0) / p.step)];
        return { first, again, taper, r0: at(-5), r15: at(-15), r25: at(-25) };
    });
    expect(r.first, 'the first pass removes material').toBeGreaterThan(0);
    expect(r.again, 'a pass at a BIGGER radius removes nothing — it swings through air, and says so').toBe(0);
    expect(r.r0, 'the turned length is at the pass radius').toBeCloseTo(7, 2);
    // the taper's radius is interpolated ALONG the move: half way between 7 and 9 at its midpoint
    expect(r.r15, 'a taper removes the right amount at each Z, not a step').toBeCloseTo(8, 1);
    expect(r.r25, 'and past the cut the bar is untouched').toBeCloseTo(10, 2);
});

test('THE DRO SPEAKS DIAMETER on a lathe — and the frame stays radius underneath', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const D = await import('/viz/latheDro.js');
        const L = await import('/data/lathe.js');
        return {
            lathe: { label: D.droAxisLabel('x'), shown: D.droValue('x', 7), z: D.droValue('z', -12.5), y: D.droAxisLabel('z') },
            radiusOf: L.radiusOf(14),
        };
    });
    // the X readout is a DIAMETER, marked as one — 7 on the machine is Ø14 to the operator
    expect(r.lathe.label, 'the X row is marked as a diameter').toMatch(/Ø/);
    expect(r.lathe.shown, 'and shows twice the radius the machine is at').toBe(14);
    expect(r.lathe.z, 'Z is untouched — it was never a radius').toBe(-12.5);
    expect(r.lathe.y, 'and so is its label').toBe('Z');
    // …and the model's ONE conversion is still the only halving: this is a display, not a second frame
    expect(r.radiusOf, 'radiusOf remains the one converter').toBe(7);
});

test('A MILL DRO IS UNTOUCHED — the diameter reading is a lathe declaration, not a global', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await page.evaluate(async () => {
        const M = await import('/data/workspaceMachine.js');
        M.setMachine({ kind: 'mill' }, false);
    });
    const r = await page.evaluate(async () => {
        const D = await import('/viz/latheDro.js');
        return { label: D.droAxisLabel('x'), shown: D.droValue('x', 7) };
    });
    expect(r.label, 'a mill X is an X').toBe('X');
    expect(r.shown, 'and its number is the number').toBe(7);
});
