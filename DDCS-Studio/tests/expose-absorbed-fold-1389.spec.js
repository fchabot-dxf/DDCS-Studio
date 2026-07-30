import { test, expect } from '@playwright/test';

/**
 * t1389 RULING 1 — THE PLACE-FOLD BLANKET RELAXES BY DECLARATION, AND THE PROOF IS THE REAL SYMPTOM.
 *
 * ── THE HAZARD, READ PRECISELY ────────────────────────────────────────────────────────────────────────────────────
 * `exposeClassifier` bakes any socket under a coordinate-transforming fold. The reason it gives is specific: the fold's
 * emit REWRITES ITS CHILD'S TEXT with a numeric regex (`X(-?\d*\.?\d+)`), and `X#n` has no digit for that regex to bite
 * on, so the intended translate is silently dropped and the exposed coordinate comes out WRONG.
 *
 * A `place` fold whose sole child declares `absorbsPlacement` rewrites NOTHING — the emitter hands that child the shift
 * as PARAMS (t1359) and the atom bakes the frame into the coordinates it emits. The named hazard cannot arise, so the
 * blanket was costing a real pendant knob for no safety. It now relaxes on that DECLARATION — never a blanket lift and
 * never a type list, so an atom that does not declare it stays blocked.
 *
 * ── WHY THE PROOF IS A DIFF AND NOT A CLASSIFIER READING ──────────────────────────────────────────────────────────
 * "The classifier now says exposable" would be testing the change against itself. The claim that matters is about G-CODE:
 * put a `#var` in the feed of a PLACED bolt-circle and the ONLY thing that may move is the F words. Every X, Y, Z, I and J
 * must be byte-identical to the baked program — because if the place fold really were rewriting this body's text, the
 * exposure would silently drop the translate and every coordinate would shift. That is the failure this asserts against.
 */
test.use({ viewport: { width: 1400, height: 950 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/** Every coordinate word in emit order — the things that must NOT move when only a feed goes live. */
const COORD_RE = /\b([XYZIJ])(\[[^\]]*\]|-?\d*\.?\d+|#\d+)/g;

test('THE SYMPTOM — a live feed on a PLACED bolt circle changes F words ONLY; every coordinate is byte-identical', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { drillStack } = await import('/wizards/drillWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        // A PLACED bolt circle: stock-attached (so the place fold is doing real work) and off-origin, which is exactly
        // the case a dropped translate would corrupt.
        const P = {
            pattern: 'circle', dia: 100, count: 8, startAngle: 15, depth: 12, peck: 3, clearance: 5,
            stockAttach: 'pp', pathDatum: 'pp', stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20,
            originX: 12.5, originY: -7.25, offZ: 2,
        };
        // ⚠ THE KNOB IS WRITTEN INTO THE SOCKET, not passed through the wizard's front door. `drillStack` coerces its
        // params with `num()`, so `drillStack({feed:'#2601'})` yields the default 100 — measured, and it is the correct
        // behaviour for a FORM (a typed field is a number). A CAM exposure works the way this test now does: the slot
        // substitutes `#2601` into the block's own socket. Staging it through drillStack would have tested nothing.
        const setFeed = (stack, v) => {
            const walk = (bs) => { for (const b of (bs || [])) { if (b.type === 'holecycle') b.params.feed = v; walk(b.children); walk(b.uiChildren); } };
            walk(stack); return stack;
        };
        const baked = emitMapped(setFeed(drillStack(P), 120)).text;
        const live = emitMapped(setFeed(drillStack(P), '#2601')).text;   // the pendant knob, in the socket
        const words = (t) => (t.match(/\b([XYZIJ])(\[[^\]]*\]|-?\d*\.?\d+|#\d+)/g) || []);
        const feeds = (t) => (t.match(/\bF(\[[^\]]*\]|-?\d*\.?\d+|#\d+)/g) || []);
        return {
            bakedCoords: words(baked), liveCoords: words(live),
            bakedFeeds: feeds(baked), liveFeeds: feeds(live),
            liveHasVarFeed: /\bF#2601\b/.test(live),
            sameLineCount: baked.split('\n').length === live.split('\n').length,
        };
    });
    // THE PREMISE, and it is deliberately not a round number: the parametric body is SHORT (that is the fold's whole
    // point), so it carries about seven coordinate words rather than one per hole. What makes the comparison meaningful is
    // not how MANY there are but that the hole's own position is among them as a PLACED expression — that is the word a
    // dropped translate would have corrupted.
    expect(r.bakedCoords.length, 'the placed program emits real coordinate words').toBeGreaterThanOrEqual(5);
    expect(r.bakedCoords.some((w) => /^X\[.*#\d+/.test(w)), "the hole's own placed X is an expression over a register — the word a dropped translate would wreck").toBe(true);
    // THE CLAIM: coordinates byte-identical, in order.
    expect(r.liveCoords, 'every X/Y/Z/I/J is byte-identical — the place fold did not need to rewrite this body').toEqual(r.bakedCoords);
    expect(r.sameLineCount, 'and the program is the same shape').toBe(true);
    // …and the feed really did go live, so this is not a no-op comparison of two identical programs.
    expect(r.liveHasVarFeed, 'the feed rides through as a #var — the knob is real').toBe(true);
    expect(r.liveFeeds, 'the F words are what changed').not.toEqual(r.bakedFeeds);
    expect(r.bakedFeeds.length, 'and there were F words to change').toBeGreaterThan(0);
});

/**
 * THE CLASSIFIER AGREES — and the relaxation is keyed to the DECLARATION, proven by taking the declaration away.
 * This is the part that stops the relaxation from quietly becoming a blanket lift.
 */
test('THE KEY — feed exposes under a place fold ONLY because the child declares absorbsPlacement', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { classifyExposable, blockedIndices } = await import('/data/exposeClassifier.js');
        const { drillDataDef } = await import('/blocks/dataOps/drillData.js');
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const def = drillDataDef();
        const withDecl = classifyExposable(def).feed;
        // TAKE THE DECLARATION AWAY and re-ask. Nothing else changes — same template, same roles, same structure.
        const saved = BLOCKS.holecycle.absorbsPlacement;
        BLOCKS.holecycle.absorbsPlacement = false;
        const without = classifyExposable(drillDataDef()).feed;
        BLOCKS.holecycle.absorbsPlacement = saved;
        const restored = classifyExposable(drillDataDef()).feed;
        // …and a body the emitter would NOT treat as self-framing (TWO children under the place) must stay blocked, because
        // `absorbingChild` is strict about that and the classifier reads the emitter's own predicate rather than its own.
        const mixed = [{ type: 'placeonstock', params: {}, children: [{ type: 'holecycle', params: {} }, { type: 'drill', params: {} }] }];
        const soleAbsorbing = [{ type: 'placeonstock', params: {}, children: [{ type: 'holecycle', params: {} }] }];
        return {
            withDecl, without, restored,
            mixedBlocked: [...blockedIndices(mixed)],
            soleBlocked: [...blockedIndices(soleAbsorbing)],
        };
    });
    expect(r.withDecl.exposable, 'feed exposes on the placed drill op').toBe(true);
    expect(r.withDecl.role, 'as a value role').toBe('value');
    expect(r.without.exposable, 'and WITHOUT the declaration it goes straight back to baked — the key is the declaration').toBe(false);
    expect(r.without.reason, 'naming the fold as the reason, exactly as before').toMatch(/fold/i);
    expect(r.restored.exposable, 'restoring the declaration restores the exposure (no leaked state)').toBe(true);
    // THE STRICTNESS IS INHERITED, not re-decided: a mixed body still falls through to the text rewrite in the emitter,
    // so its children must still be blocked. Index 1 and 2 are the two children of the place at index 0.
    expect(r.mixedBlocked, 'a MIXED body (self-framing atom beside a literal one) stays blocked — the emitter still rewrites it').toEqual([1, 2]);
    expect(r.soleBlocked, 'a sole self-framing child is not blocked').toEqual([]);
});

/**
 * SURFACING INHERITS THE RELAXATION — and a CORRECTION to the ruling's premise about what that buys it.
 *
 * The ruling expected surfacing's feed knob to UN-BAKE as part of this act's evidence. It does not, and the reason is
 * neither a gap nor a bug — the fold relaxation reaches surfacing exactly as designed (its blocked set is EMPTY, measured
 * below, from the same line of code, because it declares `absorbsPlacement` too), but its feed is held back by its ROLE:
 *
 *     holecycle       const feed = val(p.feed, 100)    → emits `F#2601`        → role 'value'     → exposable
 *     surfaceraster   const feed = num(p.feed, 2000)   → emits `F${r3(feed)}`  → a #var is NaN    → role 'geometry'
 *
 * So `atomRoles` is RIGHT about surfacing, and this classifier change was never what stood between it and a live feed.
 * Un-baking it means changing surfaceraster's emit to `val()` — the same class of act as ruling 2 does for holecycle's
 * #81/#82, on a different atom, and not blessed here. Flagged in the t1389 log rather than slipped in.
 *
 * The two claims that ARE this act's evidence for surfacing: the fold no longer blocks it, and its emit is untouched.
 */
test('SURFACING INHERITS — the fold block is lifted, and (t1399) its role caught up so the feed exposes', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { classifyExposable, blockedIndices } = await import('/data/exposeClassifier.js');
        const { surfacingDataDef } = await import('/blocks/dataOps/surfacingData.js');
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const def = surfacingDataDef();
        const c = classifyExposable(def);
        const flat = flattenBlocks(def.template).map((b) => b.type);
        const P = { w: 200, h: 150, depth: 0.8, stepdown: 0.4, toolDia: 12, stepoverPct: 60, feed: 900, plunge: 180, clearance: 5,
            stockAttach: 'pp', stockDatum: 'nnp', stockW: 300, stockH: 250, stockZ: 20, originX: 10, originY: 5 };
        return {
            feed: c.feed, plunge: c.plunge,
            blocked: [...blockedIndices(def.template)],
            hasPlace: flat.includes('placeonstock'), hasRaster: flat.includes('surfaceraster'),
            // the placed emit, so the act can show it did not move
            emitLen: emitMapped(surfacingStack(P)).text.split('\n').length,
        };
    });
    // THE INHERITANCE, measured: surfacing really is a place-wrapped self-framing atom, and NOTHING is fold-blocked now.
    expect(r.hasPlace && r.hasRaster, 'surfacing is a place-wrapped surfaceraster').toBe(true);
    expect(r.blocked, 'the place fold no longer blocks anything in surfacing — the same relaxation, same code').toEqual([]);
    /**
     * ⚠ t1399 — THE SECOND HALF OF THIS TEST INVERTED, and the history is the point.
     *
     * t1389 asserted that surfacing's feed was still BAKED, and carefully distinguished WHY: not by the fold (this act
     * had just lifted that) but by its ROLE — `surfaceraster` emitted `F` through `r3(num(feed))`, which destroys a
     * `#var`. That was true and worth recording, and it named the follow-up act precisely.
     *
     * Step 0 of T3 IS that act: the pocket's rect fill re-points through this atom, and a pocket can only be as live as
     * the atom it reuses, so feed/plunge/depth/stepdown moved onto the live-word path. So the role is no longer geometry
     * and the assert flips. What does NOT change is the structural claim above — the fold blocks nothing — and keeping
     * both halves visible is what stops "exposable" from silently coming to mean "the fold was lifted".
     */
    expect(r.feed.exposable, "surfacing's feed EXPOSES now — the role changed at t1399, the fold was already clear").toBe(true);
    expect(r.feed.role, 'it is a value role: surfaceraster prints F through val() as of step 0').toBe('value');
    expect(r.feed.reason, 'and the reason names the ride-through, not a fold').toMatch(/rides through/i);
    expect(r.feed.reason, 'still not blaming a coordinate-transforming fold').not.toMatch(/fold/i);
    expect(r.plunge.exposable, 'plunge moved with it — the same bare F word, the same act').toBe(true);
    expect(r.emitLen, 'and surfacing still emits a real body (its bridges are re-run in the gate)').toBeGreaterThan(20);
});
