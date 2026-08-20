import { test, expect } from '@playwright/test';
import { rampDescentRelationship, splitRampDescent, cutBox } from './support/rampRelationship.js';

/**
 * t1404 — THE RINGS DESCEND, THE ENVELOPE STOPS LYING, AND THE INSET SEAM LANDS.
 *
 * THE DEFECT THIS FIXES, stated so nobody has to reconstruct it. `surfacingStack` — the path that SHIPS — emitted a
 * straight PLUNGE whenever `strategy: 'concentric'` was combined with `entry: 'ramp'` or `'helix'`. `ringWalk` never
 * destructured entry/rampAngle/helixDia/helixPitch; only `rowWalk` did. Measured at t1402 against the literal
 * emitter the bridges keep alive: the literal cut 2 ramping moves and 48 helical ones, the parametric cut ZERO.
 *
 * It matters because of WHY an operator picks a ramp: the endmill will not plunge. Getting a straight plunge is the
 * exact failure that selection exists to prevent, so this is a wrong-motion defect, not a cosmetic one.
 *
 * WHY NOTHING CAUGHT IT — and this is the part the spec is really guarding. `surfaceRasterCovers` had been reduced
 * to a bare `return true` (an honest summary of t1355's moment), and every bridge that probed a DESCENT probed it
 * against `strategy: 'parallel'`. So `concentric × ramp` was never measured, and the predicate answered `true` for
 * it in a voice indistinguishable from the five answers that were earned. Same class as t1399's atomRoles finding:
 * a default that reads like a decision.
 *
 * So the first test below is the fix, and the rest are the reasons it cannot happen again.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
};

const BASE = { w: 100, h: 60, depth: 1.0, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5 };

/** literal vs parametric, as (position, feed) per cut move — the t1329/t1377 comparator, unchanged. */
const bridge = (page, cfg) => page.evaluate(async (cfg) => {
    const { surfacingStack, surfacingLiteralStack } = await import('/wizards/surfacingWizard.js');
    const { emitProgram } = await import('/blocks/blockEmitter.js');
    const { traceToolpath } = await import('/engine/trace.js');
    const cut = (nc) => (traceToolpath(nc).segments || []).filter((s) => !s.rapid)
        .map((s) => [+s.x1.toFixed(3), +s.y1.toFixed(3), +s.z1.toFixed(3), +s.x2.toFixed(3), +s.y2.toFixed(3), +s.z2.toFixed(3), +Number(s.feed || 0).toFixed(3)]);
    // A DESCENT move: cutting, changing Z, AND moving in XY. A straight plunge changes Z with no XY, so this counts
    // exactly the thing the defect destroyed rather than counting moves in general.
    const ramping = (rows) => rows.filter((r) => Math.abs(r[5] - r[2]) > 1e-6 && (Math.abs(r[3] - r[0]) > 1e-6 || Math.abs(r[4] - r[1]) > 1e-6)).length;
    const L = cut(String(emitProgram(surfacingLiteralStack(cfg)))), P = cut(String(emitProgram(surfacingStack(cfg))));
    return { L, P, lRamp: ramping(L), pRamp: ramping(P) };
}, cfg);

/**
 * THE FIX, ON THE ADVERSARIAL CONFIGS RATHER THAN ONE SAMPLE. The ring boundaries are t1333's own choices — where a
 * ring collapses exactly, where only one fits, where the inset does not divide the short side — because those are
 * where a descent bolted onto the wrong ring would show up. A single interior config would pass either way.
 */
const RING_CONFIGS = [
    { name: 'the middle collapses exactly on a boundary', extra: { w: 100, h: 28.8 } },
    { name: 'a single ring, the middle closes immediately', extra: { w: 40, h: 12 } },
    { name: 'inset does not divide the short side evenly', extra: { w: 120, h: 65, depth: 1.0 } },
    { name: 'square — both sides close at once', extra: { w: 80, h: 80, toolDia: 10, stepoverPct: 50 } },
    { name: 'many levels, so the descent repeats', extra: { depth: 3, stepdown: 0.4 } },
    { name: 'a steep ramp angle', extra: { rampAngle: 20 } },
];

for (const c of RING_CONFIGS) {
    test(`RINGS RAMP — ${c.name}`, async ({ page }) => {
        await boot(page);
        const r = await bridge(page, { ...BASE, strategy: 'concentric', entry: 'ramp', ...c.extra });
        // THE DEFECT ITSELF: the literal descends, so the parametric must descend too. Asserting the COUNT of ramping
        // moves (not just equality of the arrays) states the defect in its own terms — a regression that reverted the
        // fix would show up here as `0`, naming what broke, rather than as an opaque array mismatch.
        expect(r.lRamp, `the literal ramps on this config (else the config proves nothing)`).toBeGreaterThan(0);
        expect(r.pRamp, `the parametric must ramp too — this is the t1402 defect`).toBe(r.lRamp);
        /**
         * ⚠ t1487 — THE CRITERION IS RESTATED, THE COVERAGE IS NOT DROPPED (ruled t1486; the t1391/t1406 precedent).
         *
         * This read `expect(r.P).toEqual(r.L)` — the whole toolpath, move for move. C4 (t1483/t1485) points the ramp
         * along the ROW instead of at the area centre, because the centre-ward ramp had to bake a hypotenuse and SQRT
         * is unverified here (t1339). So the literal's descent is no longer the reference for THIS descent — and the
         * walk around it still is, exactly as before.
         *
         * What replaces it is not weaker, it is more specific: the walk is asserted move-for-move as it always was,
         * and the descent is asserted on the properties an operator picks a ramp FOR — same start, same drop, same
         * run length (which IS the angle: the run is drop/tan(angle) on both sides), same feed, returns to its start,
         * stays in the material. See tests/support/rampRelationship.js for the measurement this rests on.
         */
        const L = splitRampDescent(r.L), P = splitRampDescent(r.P);
        expect(P.walk, 'OUTSIDE the descent the toolpath is unchanged, move for move').toEqual(L.walk);
        const rel = rampDescentRelationship(r.L, r.P, { bbox: cutBox(r.L) });
        expect(rel.ok, `and the descent holds its declared relationship to the literal — ${rel.why}`).toBe(true);
    });
}

test('RINGS HELIX — the descent the rings never had, move for move', async ({ page }) => {
    await boot(page);
    const r = await bridge(page, { ...BASE, strategy: 'concentric', entry: 'helix', helixDia: 8, helixPitch: 1 });
    expect(r.lRamp, 'the literal helixes').toBeGreaterThan(0);
    expect(r.pRamp, 'and so does the parametric now').toBe(r.lRamp);
    // NOT `toEqual` on the arrays, and the reason is measured rather than waved through: parallel×helix ALREADY
    // differs from the literal by 0.001mm in Z on some segments (measured at t1404 against HEAD — parallel/helix is
    // byte-identical across this change, so the divergence predates it and is not this act's). It is one unit of the
    // emit's own rounding on a polyline the literal builds by a different accumulation. Naming it beats either
    // pretending equality or silently loosening the ring assert to hide it.
    // Rounded before comparing: both sides are 3-decimal quantities, so their difference is only meaningful to about
    // 1e-9 — a raw subtraction yields 0.0010000000000000009 and would fail a bound the values actually meet.
    const worst = Math.max(...r.P.map((p, i) => Math.max(...p.map((v, j) => Math.abs(v - (r.L[i] || [])[j])))));
    expect(r.P.length, 'same number of cut moves').toBe(r.L.length);
    expect(+worst.toFixed(6), 'every coordinate within one unit of the emit rounding (0.001mm)').toBeLessThanOrEqual(0.001);
});

/**
 * THE REGRESSION GUARD IN THE OTHER DIRECTION. The fix may change the two broken combinations and NOTHING else —
 * that is what makes it a fix rather than a rewrite. Byte-identity against HEAD was measured directly in a worktree
 * (36/54 configs unchanged; the 18 that changed were exactly concentric×ramp and concentric×helix, across rotation,
 * skim, confirm-every, a tiny area, deeper depth, stepover, ramp angle and helix diameter). This is that claim
 * expressed as a standing assert: every working combination still agrees with the literal move for move.
 */
const UNCHANGED = [
    { name: 'parallel × plunge', cfg: { strategy: 'parallel', entry: 'plunge' } },
    // t1487 — the ONE row here whose descent C4 re-points, flagged as DATA rather than by a branch reading its name.
    // Everything this row ever claimed still holds outside the descent, which is what the flag scopes.
    { name: 'parallel × ramp', cfg: { strategy: 'parallel', entry: 'ramp' }, ramp: true },
    { name: 'concentric × plunge', cfg: { strategy: 'concentric', entry: 'plunge' } },
    { name: 'concentric × plunge, rotated', cfg: { strategy: 'concentric', entry: 'plunge', rotAngle: 17, rotPivotX: 5, rotPivotY: -3 } },
    { name: 'concentric × plunge, confirm every 2', cfg: { strategy: 'concentric', entry: 'plunge', confirmEvery: 2 } },
];
for (const u of UNCHANGED) {
    test(`STILL EXACT — ${u.name}`, async ({ page }) => {
        await boot(page);
        const r = await bridge(page, { ...BASE, ...u.cfg });
        if (!u.ramp) {
            expect(r.P, 'the fix touched only the two broken combinations').toEqual(r.L);
            return;
        }
        // t1487 — the ramp row keeps the SAME claim about everything C4 did not touch, and states the descent as the
        // relationship (see RINGS RAMP above). A row that quietly dropped to "the descent is exempt" would let a
        // regression in the WALK hide behind the one part that legitimately moved.
        expect(splitRampDescent(r.P).walk, 'the walk around the descent is exact, as it always was').toEqual(splitRampDescent(r.L).walk);
        const rel = rampDescentRelationship(r.L, r.P, { bbox: cutBox(r.L) });
        expect(rel.ok, `and the descent holds its declared relationship — ${rel.why}`).toBe(true);
    });
}

/**
 * ── THE ENVELOPE ─────────────────────────────────────────────────────────────────────────────────────────────────
 * The cross-product, in full. The old spec probed ramp and helix against a `strategy: 'parallel'` base and never
 * combined them with concentric — which is precisely how the gap hid. Enumerating the product means a combination
 * cannot be missed by being forgotten; it has to be listed to be claimed.
 */
test('THE ENVELOPE IS A TABLE — every strategy × entry is claimed BY NAME, and an unknown one refuses', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const m = await import('/wizards/ops/surfaceraster.js');
        const grid = {};
        for (const strategy of ['parallel', 'concentric']) {
            for (const entry of ['plunge', 'ramp', 'helix']) {
                grid[`${strategy}/${entry}`] = { covered: m.surfaceRasterCovers({ strategy, entry }), why: m.surfaceRasterGap({ strategy, entry }) };
            }
        }
        return {
            grid,
            proven: m.SURFACE_RASTER_PROVEN,
            // t1418 — the table gained a DIRECTION axis on the parallel arm, so this act's claim ("every strategy ×
            // entry the app can ask for is claimed by name") is now read through the same key builder the table uses
            // rather than by assuming the key shape. The claim is unchanged; only the key it is asked in moved.
            provenAtDefault: Object.fromEntries(Object.keys(grid).map((k) => {
                const [strategy, entry] = k.split('/');
                const axes = m.SURFACE_RASTER_AXES[strategy];
                return [k, m.SURFACE_RASTER_PROVEN[axes.map((a) => ({ strategy, direction: 'bothways', entry })[a]).join('/')]];
            })),
            ignores: m.SURFACE_RASTER_IGNORES,
            // an entry the atom does not implement must NOT read as proven — the defect's shape, asked directly
            bogusEntry: { covered: m.surfaceRasterCovers({ strategy: 'concentric', entry: 'trochoidal' }), why: m.surfaceRasterGap({ strategy: 'concentric', entry: 'trochoidal' }) },
            bogusStrategy: { covered: m.surfaceRasterCovers({ strategy: 'adaptive', entry: 'plunge' }), why: m.surfaceRasterGap({ strategy: 'adaptive', entry: 'plunge' }) },
            // the defaults still resolve to the proven corner
            empty: { covered: m.surfaceRasterCovers({}), why: m.surfaceRasterGap({}) },
        };
    });
    // ALL SIX are covered — and each is covered because a ROW SAYS SO, with the turn that earned it.
    for (const [k, v] of Object.entries(r.grid)) {
        expect(v.covered, `${k} is claimed`).toBe(true);
        expect(v.why, `${k} names no gap`).toBe('');
        expect(r.provenAtDefault[k], `${k} carries the turn that earned it, not a bare true`).toBeTruthy();
    }
    // t1418 — the whole-table shape ("no extra rows, none missing") moved to the act that owns the new axis
    // (raster-direction-1418.spec.js asserts it against the declared axis product). What this act still owns is that
    // its own six combinations are each claimed by a named row, which is the loop above.
    // t1404 — the two the rings gained this turn say so in the table itself.
    expect(r.proven['concentric/ramp']).toMatch(/t1404/);
    expect(r.proven['concentric/helix']).toMatch(/t1404/);

    // AND THE POINT OF A TABLE: something not in it REFUSES, with a reason. Under the old `return true` both of
    // these read as proven — which is exactly how concentric×ramp shipped broken.
    expect(r.bogusEntry.covered, 'an unimplemented descent is NOT inside the envelope').toBe(false);
    expect(r.bogusEntry.why, 'and it says why, never a bare false').toContain('no equivalence bridge');
    expect(r.bogusStrategy.covered, 'nor is an unimplemented strategy').toBe(false);
    expect(r.bogusStrategy.why).toContain('no equivalence bridge');
    expect(r.empty.covered, 'an unset config is the defaults, which are proven').toBe(true);

    // WHAT THE ATOM IGNORES is declared too. t1404 put ONE fact here — `direction` was read by no branch in either
    // walk — precisely so the NEXT caller (pocket has a real direction param) would find it instead of rediscovering
    // it the way t1402 rediscovered the descent. It worked: t1406 read this line and narrowed the pocket's arm.
    //
    // t1418 CLOSED THE CAPABILITY, so the entry is GONE rather than reworded, and this assertion is inverted to say
    // so. That inversion is not the declaration failing — it is a declaration built to be removed being removable,
    // which is the only reason writing it down was worth doing. (The other half of the claim, that the walk now
    // genuinely branches on the word, is the bridge in raster-direction-1418.spec.js: an empty table proves nothing
    // by itself.)
    expect(r.ignores.direction, 't1418 taught the walk all three directions, so the entry came out').toBeUndefined();
});

/**
 * ── THE INSET SEAM ───────────────────────────────────────────────────────────────────────────────────────────────
 * Nothing in the app passes `inset` yet — the re-point consumes it next act. That is not dead code: it is a declared
 * seam landing WITH its proof, which is the only way the consumer can rely on it without re-deriving it.
 *
 * The property that matters is the one t1402 measured the hard way: `extent` must keep declaring the GIVEN rect
 * while the walk runs inside it. When the two were the same declaration, the place fold aligned the tool-centre
 * sweep where it should have aligned the pocket, and a placed pocket slid by exactly the tool radius.
 */
test('INSET — the walk moves in, the declared footprint does NOT', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { emitProgram, newBlock } = await import('/blocks/blockEmitter.js');
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const P = { x: 10, y: 5, z0: 0, w: 80, h: 60, depth: 1, stepdown: 0.5, toolDia: 6, stepoverPct: 40, feed: 900, plunge: 180, clearance: 5, strategy: 'concentric', entry: 'plunge' };
        const mk = (extra) => { const b = newBlock('surfaceraster'); b.params = { ...P, ...extra }; return b; };
        const box = (nc) => {
            const s = (traceToolpath(nc).segments || []).filter((x) => !x.rapid);
            return { minX: +Math.min(...s.map((v) => Math.min(v.x1, v.x2))).toFixed(3), maxX: +Math.max(...s.map((v) => Math.max(v.x1, v.x2))).toFixed(3),
                minY: +Math.min(...s.map((v) => Math.min(v.y1, v.y2))).toFixed(3), maxY: +Math.max(...s.map((v) => Math.max(v.y1, v.y2))).toFixed(3) };
        };
        const def = BLOCKS.surfaceraster;
        const at = (n) => ({ extent: def.extent({ ...P, inset: n }), walk: box(String(emitProgram([mk({ inset: n })]))), text: String(emitProgram([mk({ inset: n })])) });
        return { zero: at(0), three: at(3), collapse: at(45), fields: def.fields, defaults: def.defaults };
    });
    // THE DECLARED FOOTPRINT IS THE GIVEN RECT AT BOTH INSETS — this is the property that keeps a placed pocket put.
    expect(r.zero.extent, 'extent = the given rect').toEqual({ minX: 10, maxX: 90, minY: 5, maxY: 65 });
    expect(r.three.extent, 'and an inset does NOT shrink it — the op still occupies its outline').toEqual(r.zero.extent);
    // THE WALK DOES MOVE IN, by exactly the inset on all four sides.
    expect(r.zero.walk, 'inset 0 → the walk IS the rect (surfacing faces the whole top)').toEqual({ minX: 10, maxX: 90, minY: 5, maxY: 65 });
    expect(r.three.walk, 'inset 3 → 3mm in on every side').toEqual({ minX: 13, maxX: 87, minY: 8, maxY: 62 });
    // AND THE ZERO CASE ADDS NOTHING TO THE TEXT — no guard, no label, no comment. (Byte-identity against HEAD was
    // measured in a worktree across 54 configs; this is the same promise stated where a reader will see it.)
    // t2095 — this used to check the LITERAL 'GOTO95', because insetErrLabel used to always land on 95. t2070 added
    // applyInlineClampSkip (blockEmitter.js), a POST pass that rewrites the unconditional ring-count floor clamp
    // (`IF n<1 THEN n=1`, present for every concentric config regardless of inset) into its own GOTO-skip, numbered
    // dynamically as "one above the highest N-label already in the program". For inset:0, insetErrLabel/insetOkLabel
    // are not declared at all (see flowLabels' insetOnDecl gate), which shifts the declared numbering down and leaves
    // 95 as that dynamic clamp's number — a coincidental reuse of the digits '95' by an UNRELATED mechanism, not an
    // inset guard leaking through. (No collision inside the program itself: applyInlineClampSkip only ever picks a
    // number strictly above the max N-label already emitted, per its own comment.) The semantic property this test
    // actually cares about — whether the INSET-refusal machinery specifically ran — is the inset-only wording
    // (surfaceraster.js:1057/1094), which is independent of whatever number either mechanism happens to allocate.
    expect(r.zero.text, 'inset 0 emits no inset machinery at all').not.toMatch(/leaves no (width|area) to clear/);
    expect(r.three.text, 'a declared inset brings its own guard').toMatch(/leaves no width to clear/);
    // A WRONG OPERATOR MESSAGE IS A DEFECT: an inset that eats the area must not refuse by blaming the stepover.
    expect(r.collapse.text, 'the collapse refuses in its own words').toMatch(/inset leaves no area to clear/);
    expect(r.collapse.text, 'and not by blaming a knob the operator did not touch')
        .not.toMatch(/GOTO91\s*\(\s*the/);
    // THE DECLARATION KNOWS ABOUT IT — an emitter that reads a key the block does not declare is a drop waiting to
    // happen the day this atom round-trips through the canvas (the t1351 lesson about z0).
    expect(r.fields, 'inset is a declared field').toContain('inset');
    expect(r.defaults.inset, 'and defaults to 0 = surfacing unchanged').toBe(0);
});

test('INSET — @work declares the work over the INSET area, not the given one', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { surfaceRasterWorkSteps } = await import('/wizards/ops/surfaceraster.js');
        const P = { x: 0, y: 0, w: 80, h: 60, depth: 1, stepdown: 0.5, toolDia: 6, stepoverPct: 40, feed: 900, plunge: 180, clearance: 5, strategy: 'parallel', entry: 'plunge' };
        return {
            given: surfaceRasterWorkSteps({ ...P, inset: 0 }),
            insetted: surfaceRasterWorkSteps({ ...P, inset: 6 }),
            // the SAME area expressed directly — the inset declaration must agree with the rect it walks
            equivalent: surfaceRasterWorkSteps({ ...P, w: 68, h: 48, inset: 0 }),
            liveInset: surfaceRasterWorkSteps({ ...P, inset: '#500' }),
        };
    });
    expect(r.insetted, 'an inset shrinks the declared work — it walks a smaller area').toBeLessThan(r.given);
    /**
     * ── t1528 — THIS CLAIM WAS ABOUT THE **AREA**, and it now says so, because the two are no longer equal ────────
     *
     * It read `insetted === equivalent`: an inset of 6 on an 80×60 rect declares what a bare 68×48 rect declares.
     * The claim it was making — and still makes — is that the inset is honoured in the AREA the work is counted
     * over, which is what t1404 landed and what a declaration reading the GIVEN rect would get wrong by two insets'
     * worth of rows on every consumer.
     *
     * What it also asserted, silently, was that an insetted body costs NOTHING EXTRA — and that was false. A
     * declared inset brings four executed statements of its own: this file's two `IF <span> <= 0` guards and the
     * `GOTO`/label pair that carries the good path past their error message. They are the INSET'S OWN COST, not the
     * area's, and the model never counted them, so every insetted program declared four steps too few — the
     * TRUNCATING direction (t1383's whole reason for existing). Measured by differencing these two exact configs,
     * whose only difference IS the machinery: +4 executed, identical across 48 configs, closed at t1528.
     *
     * So the equality becomes the AREA claim plus the machinery, named separately. Written as `+ MACHINERY` rather
     * than as a literal so the number cannot drift out of the sentence that explains it.
     */
    const INSET_MACHINERY = 4;   // two span guards + the GOTO/label pair — see above
    expect(r.insetted - INSET_MACHINERY, 'the AREA claim, unchanged: an inset declares over the rect it WALKS, exactly as the equivalent bare rect does').toBe(r.equivalent);
    expect(r.insetted - r.equivalent, '…and the difference is the inset\'s OWN machinery, nothing else').toBe(INSET_MACHINERY);
    // t1399's rule, applied to the new key the moment it exists rather than two turns later: an input that cannot be
    // known at build time means the declaration is OMITTED, never written wrong.
    expect(r.liveInset, 'a live inset makes the count unknowable → declare nothing').toBeNull();
});
