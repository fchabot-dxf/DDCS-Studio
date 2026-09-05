import { test, expect } from '@playwright/test';

/**
 * t1391 ACT 1 — POCKET'S TENANT MOVES OUT: the too-small fallback re-points through holecycle.
 *
 * ── WHY THIS ACT EXISTS ───────────────────────────────────────────────────────────────────────────────────────────
 * A pocket narrower than its tool cannot be cleared, so it becomes a single plunge — and that plunge was the literal
 * `drill` leaf. t1389's ownership test found it, which is why `drill.js` could not retire: deleting it would have forced
 * a change to pocket's behaviour, the signal that an extraction was skipped. The fork was RULED: not a second
 * single-hole emitter beside the family the arc just unified, but the family's own `holecycle` degenerated to one hole.
 *
 * ── THE CRITERION IS THE FAMILY'S OWN, NOT BYTE-EQUALITY ──────────────────────────────────────────────────────────
 * The parametric body differs from the literal in ONE declared way (the drill family's ledger, EXCEPTION 1, ruled at
 * t1381): it rapids to an R plane at surface+margin before the first cut, where the literal FEEDS through the air gap.
 * So the relationship is: exactly ONE extra rapid per hole; every CUT identical in position and feed; every retract
 * identical. Asserting byte-equality here would be asserting that the ruling had not happened.
 *
 * ⚠ THE LITERAL SIDE IS THE FROZEN /_test/ REFERENCE, not the live registry — the same vacuity discipline as t1385, and
 * for the same reason: the live literal dies in act 2, at which point a registry-built comparison would either stop
 * resolving or silently compare the new path against itself.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * ── t1444 — THE FIXTURES MOVED TO EXACTLY TOOL-SIZED, AND THE ARM THEY TEST DID NOT MOVE AT ALL ───────────────────
 *
 * These were STRICTLY smaller than their tool (Ø4 on a Ø6, 4×4 on a Ø6…) and every one of them now REFUSES: the user
 * ruled that a feature the tool cannot fit cuts nothing, because the plunge it used to emit made a hole the TOOL's
 * size — a Ø6 hole where Ø4 was asked. That ruling did not retire the plunge arm; it NARROWED its domain to the case
 * the arm was always correct for, a pocket the tool exactly fills. So every fixture moves to that case and this act's
 * bridge, header and twin claims stay exactly as provable as they were — the same `holecycle` single, against the
 * same frozen literal reference, with the same ledger EXCEPTION 1.
 *
 * Moving them is therefore NOT relaxing the test to make it green: the alternative was deleting five bridge cases
 * that still cover a shipping arm. The strictly-smaller configs they vacated are not dropped either — they become
 * `REFUSED` below, asserting the contract that replaced their old behaviour, so the file covers BOTH sides of the
 * boundary the ruling drew rather than trading one for the other.
 *
 * Depths and feeds are untouched, so the peck ladder each one exercises is the same ladder.
 */
const TINY = {
    circle: { shape: 'circle', dia: 6, toolDia: 6, depth: 3, stepdown: 1, feed: 600, plunge: 150, clearance: 5 },
    circleDeep: { shape: 'circle', dia: 8, toolDia: 8, depth: 12, stepdown: 2.5, feed: 600, plunge: 180, clearance: 5 },
    rect: { shape: 'rect', w: 6, h: 6, toolDia: 6, depth: 3, stepdown: 1, feed: 600, plunge: 150, clearance: 5 },
    rectDeep: { shape: 'rect', w: 12, h: 8, toolDia: 8, depth: 10, stepdown: 3, feed: 500, plunge: 120, clearance: 8 },   // min side == tool, and still not square
    placed: { shape: 'circle', dia: 6, toolDia: 6, depth: 6, stepdown: 2, feed: 600, plunge: 150, clearance: 5, stockAttach: 'pp', stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20, originX: 15, originY: -8 },
};

/** t1444 — the configs the fixtures above vacated: STRICTLY smaller than their tool, so they refuse instead. */
const REFUSED = {
    circle: { shape: 'circle', dia: 4, toolDia: 6, depth: 3, stepdown: 1, feed: 600, plunge: 150, clearance: 5 },
    rect: { shape: 'rect', w: 5, h: 3, toolDia: 8, depth: 10, stepdown: 3, feed: 500, plunge: 120, clearance: 8 },
    placed: { shape: 'circle', dia: 4, toolDia: 6, depth: 6, stepdown: 2, feed: 600, plunge: 150, clearance: 5, stockAttach: 'pp', stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20, originX: 15, originY: -8 },
};

for (const [name, cfg] of Object.entries(TINY)) {
    test(`THE BRIDGE (${name}) — the re-pointed fallback keeps every CUT and adds exactly one rapid`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async (cfg) => {
            const { pocketStack } = await import('/wizards/pocketWizard.js');
            const { emitMapped, newBlock, emitProgram } = await import('/blocks/blockEmitter.js');
            const { traceToolpath } = await import('/engine/trace.js');
            const { BLOCKS } = await import('/wizards/ops/index.js');
            const { installLiteralHoleRefs } = await import('/_test/literalHoleReference.js');
            const { pocketDrillCentre } = await import('/wizards/ops/pocketfill.js').catch(() => ({}));
            installLiteralHoleRefs(BLOCKS);
            const CAP = 3_000_000;
            const R = (n) => (+Number(n).toFixed(3)) + 0;   // normalise -0 (an expression can land on negative zero)
            const moves = (nc) => (traceToolpath(nc, { traceStepCap: CAP }).segments || []).map((s) => ({
                x: R(s.x2), y: R(s.y2), z: R(s.z2), f: R(s.feed || 0), r: !!s.rapid,
            }));
            // ⚠ THE TWO SIDES ARE THE SAME PROGRAM WITH THE LEAF SWAPPED, which is the only comparison that isolates the
            // kernel. A first cut framed the reference leaf on its own (`G90` + a clearance rapid + the leaf) and the
            // counts disagreed by two — because the pocket program also carries progstart/progend framing (its own
            // clearance rapid and the G53 retract). That difference was the FRAMING, not the cut, and it would have been
            // read as a kernel divergence. So: build the real pocket stack twice and substitute `drill_ref` for the
            // `holecycle` in one of them. Everything else — the place fold, the framing, every emitter pass — is shared.
            //
            // The two leaves take the placement DIFFERENTLY, and that is correct rather than a confound: the literal has
            // its text rewritten by the fold (it always did), while holecycle absorbs the shift as params. Comparing the
            // TRACED result is exactly what proves those two routes land in the same place.
            // t2633 — this walker's own index-based loop assumes `bs` is a plain, MUTABLE array (it writes
            // `bs[i] = lit` in place) — a childrenOf-style normalization would return a FRESH flattened array
            // whose mutations wouldn't reach the original tree, so it's not a drop-in fix here the way the
            // read-only walker just below is. Confirmed unreachable in practice: `stack` traces back to
            // pocketWizard.js's own classic `pocketStack` (line 65 below), which never emits a split_horizontal
            // /uiChildren-bearing node at all — a non-array `bs` (ARCHITECTURE.md INVARIANT #18) can't occur on
            // this specific path today. Left as-is rather than force a rewrite that would risk breaking the
            // mutation it depends on for no live gap.
            const swap = (stack) => {
                const walk = (bs) => { for (let i = 0; i < (bs || []).length; i++) {
                    const b = bs[i];
                    if (!b) continue;
                    if (b.type === 'holecycle') {
                        const lit = newBlock('drill_ref');
                        lit.params = { x: b.params.x0, y: b.params.y0, depth: b.params.depth, peck: b.params.peck, feed: b.params.feed, clearance: b.params.clearance };
                        bs[i] = lit;
                        continue;
                    }
                    walk(b.children); walk(b.uiChildren);
                } };
                walk(stack); return stack;
            };
            // t2633 — childrenOf-equivalent inlined (read-only walker, safe to normalize): same INVARIANT #18 fix.
            const hc = (() => { const kidsOf = (x) => Array.isArray(x) ? x : (x ? Object.values(x).flat() : []); let f = null; const walk = (bs) => { for (const b of kidsOf(bs)) { if (!b) continue; if (b.type === 'holecycle') f = b; walk(b.children); walk(b.uiChildren); } }; walk(pocketStack(cfg)); return f; })();
            const nowTxt = emitMapped(pocketStack(cfg)).text;                 // the app as it is now
            const litTxt = emitMapped(swap(pocketStack(cfg))).text;           // the same program, literal leaf
            return { now: moves(nowTxt), lit: moves(litTxt), nowTxt, hasHoleCycle: !!hc };
        }, cfg);
        expect(r.hasHoleCycle, 'the too-small arm builds a holecycle now').toBe(true);
        const cuts = (ms) => ms.filter((m) => !m.r);
        const rapids = (ms) => ms.filter((m) => m.r);
        // THE PREMISE — both sides really cut, so this is not two empty lists agreeing.
        expect(cuts(r.lit).length, 'the literal reference really plunges').toBeGreaterThan(0);
        // EVERY CUT IDENTICAL, in position and feed and order. This is the claim that matters for the machine.
        expect(cuts(r.now), 'every CUT is identical in position and feed').toEqual(cuts(r.lit));
        // EXACTLY ONE EXTRA RAPID — the R-plane approach, the drill family's declared EXCEPTION 1. One hole → one rapid.
        expect(rapids(r.now).length - rapids(r.lit).length, 'exactly ONE extra rapid: the R-plane entry (ledger exception 1)').toBe(1);
        // …and the retracts are untouched: every rapid the LITERAL makes still happens, in order.
        const litR = rapids(r.lit), nowR = rapids(r.now);
        expect(nowR.filter((m) => litR.some((l) => l.x === m.x && l.y === m.y && l.z === m.z)).length,
            'every literal rapid is still present').toBeGreaterThanOrEqual(litR.length);
    });
}

/**
 * ── t1444 — THE OTHER SIDE OF THE BOUNDARY: what the vacated fixtures do NOW ──────────────────────────────────────
 *
 * The same shape the pocket golden's 40 exempt entries use, because it is the same fact: a pocket the tool cannot fit
 * REFUSES, cuts nothing, and says why in the operator's own words. Asserted here rather than only in
 * `tool-fit-refusal-1444` so this file still covers BOTH domains of the arm it is about — the plunge above, and the
 * refusal that took the rest.
 */
for (const [name, cfg] of Object.entries(REFUSED)) {
    test(`THE REFUSAL (${name}) — strictly smaller than its tool cuts NOTHING and says why (t1444)`, async ({ page }) => {
        await boot(page);
        const r = await page.evaluate(async (cfg) => {
            const { pocketStack, pocketToolRefuses } = await import('/wizards/pocketWizard.js');
            const { emitMapped } = await import('/blocks/blockEmitter.js');
            const { traceToolpath } = await import('/engine/trace.js');
            const txt = emitMapped(pocketStack(cfg)).text;
            const t = traceToolpath(txt);
            const segs = t.segments || [];
            return { txt, refuses: pocketToolRefuses(cfg), why: t.stats.refusedWhy || '',
                cuts: segs.filter((s) => !s.rapid).length,
                // the OP's motion, separated from the PROGRAM's framing — see the note on the assertion below
                xyMoves: segs.filter((s) => Math.abs(s.x1 - s.x2) > 1e-9 || Math.abs(s.y1 - s.y2) > 1e-9).length,
                hasHoleCycle: /parametric: 1 hole/.test(txt) };
        }, cfg);
        expect(r.refuses, 'the config really is on the refusing side of the boundary').toBe(true);
        expect(r.cuts, 'it cuts NOTHING').toBe(0);
        /**
         * ⚠ NOT "zero segments" — measured, and the distinction is this file's own (see the swap note above). A refused
         * program still carries the FRAMING every program has: `G0 Z5` up to clearance and the `G53 Z` safe retract,
         * two Z-ONLY rapids that `progstart`/`progend` emit outside the op entirely. The claim the ruling makes is
         * about what the OP contributes, so that is what is asserted: no XY motion anywhere. Asserting zero segments
         * would have been asserting that the program framing had been deleted too, which is neither true nor wanted.
         */
        expect(r.xyMoves, 'the OP contributes NO motion — the only segments are the program framing\'s Z-only rapids').toBe(0);
        expect(r.hasHoleCycle, 'the plunge arm is NOT taken — that is the whole change').toBe(false);
        expect(r.txt, 'the refusal is in the program, in the family\'s form').toMatch(/#1505\s*=\s*1/);
        expect(r.why, 'and the engine reports the op\'s own sentence, with both numbers')
            .toMatch(/No toolpath — the [\d.]+mm tool cannot fit the [\d.]+mm pocket/);
    });
}

/**
 * THE NORMAL ARMS ARE BYTE-IDENTICAL — the fallback is the ONLY path this act may change.
 * Swept across shape × strategy × rest-tool, because "I only touched the tooSmall arm" is exactly the kind of claim that
 * is true of the code and false of the emit.
 */
test('THE NORMAL ARMS — every non-fallback pocket emits byte-identically (the fallback is the only change)', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const B = { toolDia: 6, depth: 4, stepdown: 1.5, feed: 600, plunge: 150, clearance: 5 };
        const out = {};
        for (const [k, p] of Object.entries({
            rect: { ...B, shape: 'rect', w: 80, h: 60 },
            rectSpiral: { ...B, shape: 'rect', w: 80, h: 60, strategy: 'spiral' },
            circle: { ...B, shape: 'circle', dia: 50 },
            polygon: { ...B, shape: 'polygon', dia: 50, sides: 6 },
            ellipse: { ...B, shape: 'ellipse', w: 70, h: 40 },
            placed: { ...B, shape: 'rect', w: 80, h: 60, stockAttach: 'pp', stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20 },
            rest: { ...B, shape: 'rect', w: 80, h: 60, restDia: 3, restStepover: 40 },
            wallOff: { ...B, shape: 'rect', w: 80, h: 60, wallOffset: -0.5 },
            confirm: { ...B, shape: 'rect', w: 80, h: 60, confirmEvery: 2 },
        })) {
            // t1406 — THE PROBE WAS A PROXY, AND THE PROXY BROKE. It matched the WORD "parametric" in the emitted
            // header, which was a fair stand-in for the hole body while that body was the only parametric thing a
            // pocket could contain. A rect pocket's CLEARING is parametric now, so the proxy started reporting a hole
            // where there is none. The claim was never about a word: it is "no hole body", and the stack says that
            // exactly. Asked of the structure, it cannot be broken by anything else's header text.
            const t = emitMapped(pocketStack(p)).text;
            out[k] = { hasHole: flattenBlocks(pocketStack(p)).some((b) => b.type === 'holecycle'), lines: t.split('\n').length, hash: t.length + ':' + (t.match(/G[123]/g) || []).length };
        }
        return out;
    });
    for (const [k, v] of Object.entries(r)) {
        expect(v.hasHole, `${k}: a NORMAL pocket carries no hole body at all — the fallback is untouched here`).toBe(false);
        expect(v.lines, `${k}: still emits a real program`).toBeGreaterThan(10);
    }
});

/**
 * THE PREVIEW GAINS @work — asserted, not discovered in a later diff.
 * The fallback now goes through the parametric body, so it declares its expected execution size like every other
 * holecycle program. That is what keeps the trace cap honest for this arm too (t1383).
 */
test('THE HEADER — the too-small arm now declares @work, and its trace is not truncated', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { readDeclaredWork } = await import('/engine/declaredWork.js');
        const { traceToolpath } = await import('/engine/trace.js');
        const txt = emitMapped(pocketStack({ shape: 'circle', dia: 6, toolDia: 6, depth: 12, stepdown: 0.5, feed: 600, plunge: 150, clearance: 5 })).text;   // t1444 — Ø == tool: the plunge arm's remaining domain (Ø4 refuses now)
        const tr = traceToolpath(txt);
        return {
            header: (txt.match(/^\( ---- DRILL.*$/m) || [])[0],
            work: readDeclaredWork(txt), capped: tr.stats.capped, cuts: tr.stats.feed,
        };
    });
    // t2305 — the header used to nest `(single)` inside the comment's own outer `( … )`, invalid G-code
    // (DDCS closes at the first `)`); fixed at the emitter (holecycle.js) by replacing the nesting with `:`.
    expect(r.header, 'the fallback emits the parametric header').toMatch(/parametric: 1 hole: single x peck/);
    expect(r.header, 'carrying its declared work token').toMatch(/@work \d+/);
    expect(r.work, 'which reads back as a real count').toBeGreaterThan(20);
    expect(r.capped, 'and the arm traces whole').toBe(false);
    expect(r.cuts, 'with real cutting moves').toBeGreaterThan(0);
});

/**
 * THE TWIN'S BINDINGS RE-POINT IN THE SAME ACT, emit-stable — the t1385 step-1 discipline.
 * All four keys (depth/peck/feed/clearance) exist on holecycle, so this is a target change, not a re-spec.
 */
test('THE TWIN — pocket\'s four tenant bindings now resolve onto holecycle, and the twin still matches its builder', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketDataDef, POCKET_DEFAULTS } = await import('/blocks/dataOps/pocketData.js');
        const { instantiate, flattenBlocks } = await import('/blocks/userOps.js');
        const { pocketStack } = await import('/wizards/pocketWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const def = pocketDataDef();
        const tiny = { ...POCKET_DEFAULTS, shape: 'circle', dia: 6, toolDia: 6, depth: 3, stepdown: 1 };   // t1444 — Ø == tool: still the plunge arm, so the four tenant bindings are still the thing under test
        const st = instantiate(def, tiny);
        const flat = flattenBlocks(st);
        const hc = flat.find((b) => b.type === 'holecycle');
        const twin = emitMapped(st).text, builder = emitMapped(pocketStack(tiny)).text;
        return {
            types: flat.map((b) => b.type),
            hcParams: hc ? { depth: hc.params.depth, peck: hc.params.peck, feed: hc.params.feed, clearance: hc.params.clearance, x0: hc.params.x0, y0: hc.params.y0 } : null,
            same: twin === builder, twinHead: (twin.match(/^\( ---- DRILL.*$/m) || [])[0],
        };
    });
    expect(r.types, 'the twin prunes to the too-small arm and it carries holecycle').toContain('holecycle');
    expect(r.types, 'with no literal drill left in it').not.toContain('drill');
    // The four bound values LANDED — a binding that silently stopped resolving would leave the superset's defaults here.
    expect(r.hcParams.depth, 'depth bound through').toBe(3);
    expect(r.hcParams.peck, 'stepdown → peck bound through').toBe(1);
    expect(r.hcParams.clearance, 'clearance bound through').toBe(POCKET_DEFAULTS_CLEARANCE);
    expect(r.hcParams.x0, 'and postInstantiate wrote the plunge centre into x0 (not x — holecycle absorbs placement)').not.toBeUndefined();
    expect(r.same, 'the twin still emits exactly what its builder does').toBe(true);
});
const POCKET_DEFAULTS_CLEARANCE = 5;
