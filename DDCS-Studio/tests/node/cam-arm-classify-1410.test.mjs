import { test, expect } from './support/harness.mjs';

/**
 * t1410 — THE CAM TABLE TELLS THE TRUTH PER-ARM.
 *
 * ── WHAT WAS WRONG, AND WHERE IT WAS ALREADY WRITTEN DOWN ─────────────────────────────────────────────────────────
 * `classifyExposable` answered "expose NOTHING" for every guarded twin — corner, pocket, edge, middle — and its own
 * comment said exactly why and exactly what the fix was: a guarded def's frozen `blockIndex` is computed over a
 * canonical-pruned stack, so a lookup against the guarded SUPERSET misaligns and could read fold-membership the
 * dangerous way. Fail closed *"until this classifier mirrors that prune"*. This is that mirror.
 *
 * It is an EXTRACTION, not a second implementation: `resolveArm` is the prune + binding re-derivation lifted out of
 * `instantiate`, so the classifier classifies the very stack the build builds. A classifier that re-derived the arm
 * could drift from the arm actually built — the class of split this whole arc exists to remove.
 *
 * ── THE SAFETY CONDITION IS WHAT MAKES THE ORDERING WELL-DEFINED ──────────────────────────────────────────────────
 * "Resolve the arm, then classify it" is only sound while the arm is decided WITHOUT consulting the classification.
 * If a knob the guards read could be exposed, its token would be a `#var`, the arm would be decided by a value that
 * does not exist until the machine reads it, and the slot would carry one arm's body under another arm's fields.
 * Measured at t1408, PINNED here as a guard — and pinned as a PROPERTY rather than a list, so a future binding on a
 * gap input fails loudly instead of quietly widening the hole.
 *
 * ── NODE-TIER CONVERSION ──────────────────────────────────────────────────────────────────────────────────────────
 * Every test is pure: page.goto/waitForFunction + one page.evaluate importing app modules and returning data, plain
 * expect() on that data. boot() dropped `page.on('dialog', ...)` (defensive browser boilerplate; register.mjs's
 * page.on only understands 'console'). "THE UN-GUARDED TWINS ARE UNMOVED" reads the REAL user-op registry
 * (`listUserOps()`), which is only populated by `createUserOp` (not by import) and is never seeded here the way
 * web/app.js's `seedDefaultPortedUserOps()` seeds it in a real boot — so a representative handful of built-in twins
 * are registered with an existence check before the sweep, the same pattern used across this tier (e.g.
 * tests/node/lathe-matrix.test.mjs).
 */
test.use({ viewport: { width: 1500, height: 1000 } });

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

/**
 * ── t1418 — THE ONE-WAY ARM MOVED SIDES, AND THAT IS THE ACT'S VISIBLE PAYOFF HERE ────────────────────────────────
 * This test used to assert that a one-way pocket sat on the LITERAL fill and therefore exposed nothing, carrying
 * `pocketRasterGap`'s "a one-way raster keeps its literal fill — the walk is always both-ways" as its reason. t1418
 * taught the atom all three directions, so that clause emptied and a one-way pocket rides the parametric arm like any
 * other. The per-arm claim is unchanged and is what makes the change VISIBLE at this level: the arm you are on decides
 * what you may expose, so closing a capability in the atom hands four real pendant knobs to an arm that had none.
 * A refused arm is still asserted here (circle, rest) so "the boundary emptied" cannot be confused with "the boundary
 * stopped being enforced".
 */
test('PER-ARM — a rect pocket exposes its depth walk in every direction; a refused arm does not, and says why', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketDataDef, POCKET_DEFAULTS } = await import('/blocks/dataOps/pocketData.js');
        const { classifyExposable } = await import('/data/exposeClassifier.js');
        const def = pocketDataDef();
        const expo = (c) => Object.entries(c).filter(([, v]) => v && v.exposable).map(([k]) => k).sort();
        const P = { ...POCKET_DEFAULTS, shape: 'rect', strategy: 'spiral' };
        const arms = {
            spiral: classifyExposable(def, P),
            raster: classifyExposable(def, { ...P, strategy: 'raster' }),
            oneway: classifyExposable(def, { ...P, strategy: 'raster', direction: 'oneway' }),
            otherway: classifyExposable(def, { ...P, strategy: 'raster', direction: 'otherway' }),
            circle: classifyExposable(def, { ...P, shape: 'circle', dia: 50 }),
            rest: classifyExposable(def, { ...P, restDia: 3 }),
            // t1444 — EXACTLY TOOL-SIZED (POCKET_DEFAULTS carries toolDia 6). At 4x4 this arm now REFUSES and there
            // is no holecycle to classify, so the assertion below would have been checking the knobs of an arm the
            // build no longer takes. The plunge arm itself is unchanged — only its domain narrowed.
            tiny: classifyExposable(def, { ...P, w: 6, h: 6 }),
            refused: classifyExposable(def, { ...P, w: 4, h: 4 }),   // t1444 — strictly smaller: the refusal arm
            noParams: classifyExposable(def),                       // asked in the ABSTRACT — must stay fail-closed
        };
        return {
            expo: Object.fromEntries(Object.entries(arms).map(([k, c]) => [k, expo(c)])),
            onewayWhy: arms.oneway.depth && arms.oneway.depth.reason,
            restWhy: arms.rest.depth && arms.rest.depth.reason,
            circleWhy: arms.circle.depth && arms.circle.depth.reason,
            spiralWhy: arms.spiral.depth && arms.spiral.depth.reason,
            abstractWhy: arms.noParams.depth && arms.noParams.depth.reason,
            refusedWhy: arms.refused.depth && arms.refused.depth.reason,
        };
    });

    // THE PARAMETRIC ARMS expose the four knobs the atom genuinely carries — and NOTHING else.
    expect(r.expo.spiral, 'a spiral rect pocket exposes the atom\'s live registers').toEqual(['depth', 'feed', 'plunge', 'stepdown']);
    expect(r.expo.raster, 'and so does a both-ways raster one').toEqual(['depth', 'feed', 'plunge', 'stepdown']);
    // t1418 — AND SO DO THE TWO ONE-WAY ARMS NOW. They were on the literal fill until the atom learned the walk; the
    // classifier needed no change to follow, because it classifies the arm the build actually builds.
    expect(r.expo.oneway, 'a one-way raster pocket rides the atom now, so its depth walk is exposable').toEqual(['depth', 'feed', 'plunge', 'stepdown']);
    expect(r.expo.otherway, 'and so does the mirror').toEqual(['depth', 'feed', 'plunge', 'stepdown']);
    // EVERY ARM STILL ON THE LITERAL FILL exposes nothing — its numbers all go through num() into a JS loop.
    for (const k of ['circle', 'rest'])
        expect(r.expo[k], `the ${k} arm is on the literal fill — nothing to expose`).toEqual([]);
    /**
     * …EXCEPT THE TOO-SMALL ARM, and that is a FINDING rather than a leak. A pocket narrower than its tool is not a
     * clearing at all — t1391 re-pointed it through `holecycle`, whose depth/peck/feed have been live registers since
     * t1389, under a place that absorbs. So per-arm classification hands that arm three real pendant knobs it could
     * never have had while the whole def was fail-closed. Asserted EXACTLY, because "some arm exposes something" is
     * the shape a genuine leak would also take: `feed` is absent (the hole's feed IS `plunge` — pocketWizard binds it
     * to holecycle.feed), and nothing geometric appears.
     */
    expect(r.expo.tiny, 'the too-small arm is a parametric holecycle plunge — its own live registers, and only those')
        .toEqual(['depth', 'plunge', 'stepdown']);
    /**
     * t1444 — AND THE ARM THAT REPLACED THE OTHER HALF OF `tiny`. A pocket the tool cannot fit emits a refusal and no
     * motion, so there is no live register anywhere in it and the classifier must expose NOTHING. Asserted rather than
     * assumed, because the interesting failure would be silent: the refusal arm still carries a `placeonstock`, and an
     * arm that kept offering the plunge's three knobs would be handing an operator pendant control over a program that
     * cannot cut — the same wrong-affordance class the fail-closed rule below exists for.
     */
    expect(r.expo.refused, 'a refused arm has no live registers at all — nothing to expose').toEqual([]);
    // …AND THE WHY IS THE BOUNDARY'S OWN WORDS, not a generic grey. This is the operator-facing half: it names the
    // setting to change to get the knob back.
    expect(r.onewayWhy, 'the one-way arm now says it rides through, like every other parametric arm').toContain('rides through emit');
    expect(r.restWhy, 'a rest-tool pocket carries pocketRasterGap\'s own sentence').toContain('a rest pass rides inside the clearing place');
    expect(r.circleWhy, 'and a circle pocket names ITS boundary').toContain('JS contour walk');
    expect(r.spiralWhy, 'while the exposable arm just says it rides through').toContain('rides through emit');
    // FAIL-CLOSED WITHOUT PARAMS — asked in the abstract, a guarded def still exposes nothing. The relaxation is
    // keyed to KNOWING the arm, never to the def's type, so nothing inherits it by accident.
    expect(r.expo.noParams, 'a guarded def asked with no params exposes nothing').toEqual([]);
    expect(r.abstractWhy, 'and says it is the fail-closed rule, not a property of the op').toContain('fail-closed');
});

/**
 * THE SLOT IS THE PROOF. A classifier reading "exposable" would be testing the change against itself; what matters is
 * that the BUILT macro carries the operator's registers where the depth walk reads them, and that nothing else moved.
 *
 * ⚠ THE SHAPE IS THE GENERATOR CONVENTION, not a raw `#42=#2601`: `stackToSlot` prepends one canonical read-line per
 * field (`#n=#26xx ;label`) and the body's LOCAL `#n` is what lands at the socket — exactly what every hand-written
 * generator does with its `v[key]`, and what lets Refresh-fields re-derive them. So the chain asserted here is
 * `#42 → #n → #2601`, which is the real contract; asserting the literal mirror would have been asserting a shape the
 * product deliberately does not emit.
 */
test('THE BUILT SLOT — the pendant registers reach #42/#43/F, and every coordinate is byte-identical', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketDataDef, POCKET_DEFAULTS } = await import('/blocks/dataOps/pocketData.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const def = pocketDataDef();
        const P = { ...POCKET_DEFAULTS, shape: 'rect', strategy: 'spiral', originX: 12.5, originY: -7.25, stockAttach: 'pp', pathDatum: 'pp', stockDatum: 'nnp', stockW: 200, stockH: 160, stockZ: 20 };
        const declOf = (live) => {
            const d = {};
            for (const k of Object.keys(P)) d[k] = { exposed: false, value: P[k] };
            for (const k of live) d[k] = { exposed: true };
            return d;
        };
        const baked = stackToSlot(def, declOf([]), new Set(), 0);
        const live = stackToSlot(def, declOf(['depth', 'stepdown', 'feed']), new Set(), 0);
        const coords = (t) => (t.match(/\b([XYZIJ])(\[[^\]]*\]|-?\d*\.?\d+|#\d+)/g) || []);
        // the LOCAL var each field owns, and the mirror it reads
        const chain = {};
        for (const f of live.fields) {
            const m = new RegExp('^' + f.var.replace('#', '#') + '=(#\\d+)', 'm').exec(live.body);
            chain[f.key] = { local: f.var, mirror: m && m[1] };
        }
        return {
            fields: live.fields.map((f) => f.key),
            chain,
            depthSeed: (live.body.match(/#42=\S+/) || [''])[0],
            stepSeed: (live.body.match(/#43=\S+/) || [''])[0],
            feedWord: (live.body.match(/F#\d+/) || [''])[0],
            bakedDepthSeed: (baked.body.match(/#42=\S+/) || [''])[0],
            bakedCoords: coords(baked.body), liveCoords: coords(live.body),
            liveHasWork: /@work/.test(live.body), bakedHasWork: /@work/.test(baked.body),
        };
    });

    expect(r.fields, 'the three asked-for knobs became pendant fields').toEqual(expect.arrayContaining(['depth', 'stepdown', 'feed']));
    // THE CHAIN: the depth register reads a LOCAL var, and that local reads the #2600 mirror the pendant writes.
    expect(r.depthSeed, 'the atom\'s depth register is seeded from the slot\'s local var').toBe(`#42=${r.chain.depth.local}`);
    expect(r.stepSeed, 'and so is the per-level bite').toBe(`#43=${r.chain.stepdown.local}`);
    expect(r.feedWord, 'and the feed word rides one too').toBe(r.chain.feed.local.replace('#', 'F#'));
    expect(r.chain.depth.mirror, 'the local reads the operator\'s #2600-band mirror').toMatch(/^#26\d\d$/);
    expect(r.chain.stepdown.mirror).toMatch(/^#26\d\d$/);
    expect(r.chain.feed.mirror).toMatch(/^#26\d\d$/);
    // …and it really was a number before, so this is not a comparison of two identical slots.
    expect(r.bakedDepthSeed, 'the all-baked slot seeds a literal').toMatch(/^#42=[\d.]+$/);
    // NOTHING ELSE MOVED. If the place fold were rewriting this body's text, exposing a knob would silently drop the
    // translate and every coordinate would shift — the failure this asserts against.
    expect(r.bakedCoords.length, 'the placed slot emits real coordinate words').toBeGreaterThan(5);
    expect(r.liveCoords, 'every X/Y/Z/I/J is byte-identical').toEqual(r.bakedCoords);
    // t1383's rule survives the exposure: expected work cannot be known once depth/stepdown are live, so it is OMITTED.
    expect(r.bakedHasWork, 'a baked slot declares its work').toBe(true);
    expect(r.liveHasWork, 'a live one does NOT — never declare a number the operator can dial past').toBe(false);
});

/**
 * THE SAFETY CONDITION, PINNED AS A PROPERTY — not as a list of param names.
 *
 * A list would be a second source that drifts the moment `pocketRasterGap` grows a clause. The property is the thing
 * that has to hold: **no param the CAM table can EXPOSE may change which arm the op builds.** So this walks every
 * exposable param, perturbs it across values a pendant could plausibly send, and requires the gap predicate's answer
 * to be unmoved. Then it checks the same thing from the other end — every input the predicate reads is bake-only or
 * has no socket at all — so a future binding on `strategy`/`shape`/`direction`/`restDia` fails here loudly.
 */
test('THE SAFETY CONDITION — no exposable knob can flip the arm a packed program came from', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketDataDef, POCKET_DEFAULTS } = await import('/blocks/dataOps/pocketData.js');
        const { classifyExposable } = await import('/data/exposeClassifier.js');
        const { pocketRasterGap } = await import('/wizards/pocketWizard.js');
        const def = pocketDataDef();
        const ARMS = [
            { ...POCKET_DEFAULTS, shape: 'rect', strategy: 'spiral' },
            { ...POCKET_DEFAULTS, shape: 'rect', strategy: 'raster' },
            { ...POCKET_DEFAULTS, shape: 'rect', strategy: 'raster', direction: 'oneway' },
            { ...POCKET_DEFAULTS, shape: 'circle', dia: 50 },
        ];
        // values a pendant could plausibly write into an exposed numeric field, incl. the degenerate ones
        const PERTURB = [0, 0.001, 1, 7.5, 1000, -5, '#2601', ''];
        const flips = [];
        const exposableSeen = new Set();
        for (const base of ARMS) {
            const cls = classifyExposable(def, base);
            const before = pocketRasterGap(base);
            for (const [param, v] of Object.entries(cls)) {
                if (!v || !v.exposable) continue;
                exposableSeen.add(param);
                for (const val of PERTURB) {
                    const after = pocketRasterGap({ ...base, [param]: val });
                    if (after !== before) flips.push({ param, val: String(val), before, after });
                }
            }
        }
        // …and from the other end: every input the predicate reads must be non-exposable, or absent from the table.
        const GAP_INPUTS = ['shape', 'strategy', 'direction', 'entry', 'toolDia', 'wallOffset', 'w', 'h', 'dia', 'sides', 'restDia'];
        const clsPara = classifyExposable(def, ARMS[0]);
        const leaks = GAP_INPUTS.filter((k) => clsPara[k] && clsPara[k].exposable);
        return { flips, leaks, exposableSeen: [...exposableSeen].sort(), gapPresence: GAP_INPUTS.map((k) => `${k}:${clsPara[k] ? (clsPara[k].exposable ? 'EXPOSABLE' : 'bake') : 'no-socket'}`) };
    });

    expect(r.exposableSeen.length, 'the sweep actually saw exposable params (an empty set would pass vacuously)').toBeGreaterThan(0);
    expect(r.flips, `no exposable knob changes the arm — offenders: ${JSON.stringify(r.flips.slice(0, 4))}`).toEqual([]);
    expect(r.leaks, `no input pocketRasterGap reads is exposable (${r.gapPresence.join(' · ')})`).toEqual([]);
});

/**
 * THE REST OF THE FAMILY IS UNTOUCHED. The relaxation is keyed to a def carrying `bindingSpecs` AND the caller
 * knowing the arm; every un-guarded twin classifies exactly as before. Asserted because "I only changed the guarded
 * path" is the kind of claim that is true of the code and false of the output.
 *
 * ⚠ NODE-TIER: `listUserOps()` reads the localStorage-backed store, which only `createUserOp` writes to and which a
 * real browser boot fills via web/app.js's `seedDefaultPortedUserOps()` — never run by this harness (page.goto is a
 * no-op here). So a representative handful of built-in twins are registered first, with an existence check, the same
 * pattern used elsewhere in this tier (e.g. tests/node/lathe-matrix.test.mjs).
 */
test('THE UN-GUARDED TWINS ARE UNMOVED — the relaxation is keyed to knowing the arm, not to a type list', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { getUserDef, listUserOps, createUserOp } = await import('/blocks/userOps.js');
        const { classifyExposable } = await import('/data/exposeClassifier.js');
        const { cornerDataDef, CORNER_DATA_OPTYPE } = await import('/blocks/dataOps/cornerData.js');
        const { edgeDataDef, EDGE_DATA_OPTYPE } = await import('/blocks/dataOps/edgeData.js');
        const { drillDataDef, DRILL_DATA_OPTYPE } = await import('/blocks/dataOps/drillData.js');
        const { middleDataDef, MIDDLE_DATA_OPTYPE } = await import('/blocks/dataOps/middleData.js');
        const { slotDataDef, SLOT_DATA_OPTYPE } = await import('/blocks/dataOps/slotData.js');
        const { surfacingDataDef, SURFACING_DATA_OPTYPE } = await import('/blocks/dataOps/surfacingData.js');
        const { boreDataDef, BORE_DATA_OPTYPE } = await import('/blocks/dataOps/boreData.js');
        const { contourDataDef, CONTOUR_DATA_OPTYPE } = await import('/blocks/dataOps/contourData.js');
        for (const [fn, optype] of [[cornerDataDef, CORNER_DATA_OPTYPE], [edgeDataDef, EDGE_DATA_OPTYPE],
                                     [drillDataDef, DRILL_DATA_OPTYPE], [middleDataDef, MIDDLE_DATA_OPTYPE],
                                     [slotDataDef, SLOT_DATA_OPTYPE], [surfacingDataDef, SURFACING_DATA_OPTYPE],
                                     [boreDataDef, BORE_DATA_OPTYPE], [contourDataDef, CONTOUR_DATA_OPTYPE]]) {
            if (!listUserOps().some((d) => d.opType === optype)) createUserOp(fn());
        }
        const out = {};
        for (const t of (listUserOps() || []).map((o) => o.opType || o)) {
            const def = getUserDef(t);
            if (!def || !Array.isArray(def.bindings)) continue;
            const a = classifyExposable(def), b = classifyExposable(def, {});
            out[t] = {
                guarded: !!def.bindingSpecs,
                same: JSON.stringify(Object.entries(a).map(([k, v]) => [k, v.exposable])) === JSON.stringify(Object.entries(b).map(([k, v]) => [k, v.exposable])),
                n: Object.keys(a).length,
            };
        }
        return out;
    });
    const rows = Object.entries(r);
    expect(rows.length, 'the registry really has defs to check').toBeGreaterThan(3);
    for (const [t, v] of rows) {
        if (v.guarded) continue;   // a guarded def is exactly what this act changes
        expect(v.same, `${t} (un-guarded) classifies identically with and without params`).toBe(true);
    }
});

/**
 * WHERE THIS REACHES THE OPERATOR — stated exactly, because the honest answer is narrower than "the CAM modal".
 *
 * `camTypeOf` routes a RECT pocket to the hand-written `pocketSlot` generator, whose fields come from its own macro
 * SPEC and never consult the classifier. So the Expose half of this act is reached through the CLASSIFIER-DRIVEN arm
 * — `stackToSlot` (the universal / sub-stack path), which is what a polygon or ellipse pocket, a forked op, or a
 * sub-stack composition builds through. This test says which route each config takes and what the table then shows,
 * so the reach is a recorded fact rather than an assumption about a modal.
 */
test('THE REACH — which route each pocket takes, and what its table then shows', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { seedFromOp, camTypeOf } = await import('/data/opCamMap.js');
        const { pocketDataDef, POCKET_DEFAULTS } = await import('/blocks/dataOps/pocketData.js');
        // the universal route resolves the def through the LIVE registry (getUserDef), which a real boot populates
        // via web/app.js's seedDefaultPortedUserOps() — never run by this harness, so registered explicitly here
        (await import('/blocks/userOps.js')).registerUserOp(pocketDataDef());
        const mk = (over) => ({ type: 'op', opType: 'user_pocket_data', id: 'x', params: { ...POCKET_DEFAULTS, ...over } });
        const look = (over) => {
            const op = mk(over), t = camTypeOf(op), s = seedFromOp(op);
            const f = (s.fields || []).filter((x) => x.exposable !== undefined);
            return {
                route: t.camType || (t.universal ? 'universal' : 'unsupported'),
                exposable: f.filter((x) => x.exposable).map((x) => x.key).sort(),
                tips: Object.fromEntries(f.filter((x) => x._exposeTip).map((x) => [x.key, x._exposeTip])),
                classified: f.length,
            };
        };
        return {
            rect: look({}),
            polySpiral: look({ shape: 'polygon', dia: 50, sides: 6 }),
            polyOneway: look({ shape: 'polygon', dia: 50, sides: 6, strategy: 'raster', direction: 'oneway' }),
        };
    });

    // A RECT pocket has its own hand-written generator — untouched by this act. Its CUT fields come from the macro
    // SPEC and never consult the classifier; the only classified rows on that arm are the def's BUILD enums (the
    // shape/strategy pick appended by seedFromOp), so the depth walk's knobs are not among them.
    expect(r.rect.route, 'a rect pocket routes to the dedicated pocket generator').toBe('pocket');
    for (const k of ['depth', 'stepdown', 'feed'])
        expect(r.rect.exposable, `${k} is not a classified row on the generator arm`).not.toContain(k);
    // A NON-RECT pocket routes to the classifier-driven universal arm — which is where this act shows.
    expect(r.polySpiral.route, 'a polygon pocket routes universal').toBe('universal');
    expect(r.polySpiral.classified, 'and its fields ARE classified').toBeGreaterThan(0);
    // It is on the LITERAL fill (non-rect), so no CUT knob exposes — and the greyed knob carries the boundary's own
    // words into `_exposeTip`, which is the string macrosApp puts on the Expose control's title. (`strategy` remains
    // exposable as a BUILD BRANCH — t1323's separate mechanism, which emits every arm and picks at the machine; it is
    // not a value riding through emit, and stackToSlot now intersects the classification across the arms it carries.)
    for (const k of ['depth', 'stepdown', 'feed', 'plunge'])
        expect(r.polySpiral.exposable, `a polygon pocket clears through a JS contour walk — ${k} cannot expose`).not.toContain(k);
    expect(r.polySpiral.tips.depth, 'and the operator is told WHICH fact refused it').toContain('JS contour walk');
    expect(r.polyOneway.tips.depth, 'shape wins the refusal even when direction would also refuse').toContain('JS contour walk');
});

/**
 * THE BRANCH HOLE — found by the sweep, closed here, and asserted from the outside.
 *
 * A BUILD ENUM exposed as a BRANCH (t1323: every arm emitted, the operator picks at the machine) is a SECOND way the
 * arm can move, and it is invisible to the safety condition above — a branch param is bindingless, so the classifier
 * never sees it. The slot would then carry every arm while its fields were classified for one of them, and on a def
 * whose arms differ structurally that is a `#var` landing in a `num()` socket: NaN, the socket silently takes its
 * default, and the operator's knob does nothing. Exactly what the U1 gate exists to prevent, through a door it did
 * not know about.
 *
 * The rule is the smallest one that closes it: a knob is exposable only if it is exposable on EVERY arm the slot
 * carries. It degenerates to a single classification when nothing branches, which is every slot built today.
 */
test('THE BRANCH INTERSECTION — a knob only exposes if it exposes on every arm the slot carries', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { pocketDataDef, POCKET_DEFAULTS } = await import('/blocks/dataOps/pocketData.js');
        const { stackToSlot } = await import('/data/stackToSlot.js');
        const def = pocketDataDef();
        const build = (over, live, branch) => {
            const P = { ...POCKET_DEFAULTS, ...over };
            const d = {};
            for (const k of Object.keys(P)) d[k] = { exposed: false, value: P[k] };
            for (const k of live) d[k] = { exposed: true };
            for (const k of (branch || [])) d[k] = { exposed: true };
            const s = stackToSlot(def, d, new Set(), 0);
            return { fields: s.fields.map((f) => f.key).sort(), body: s.body };
        };
        const plain = build({ shape: 'rect', strategy: 'spiral' }, ['depth', 'stepdown', 'feed']);
        const branched = build({ shape: 'rect', strategy: 'spiral' }, ['depth', 'stepdown', 'feed'], ['shape']);
        return {
            plainFields: plain.fields,
            branchedFields: branched.fields,
            branchedIsBranch: /GOTO 8\d\d/.test(branched.body) || /N8\d\d/.test(branched.body),
            branchedHasNaN: /NaN/.test(branched.body),
            plainHasNaN: /NaN/.test(plain.body),
        };
    });

    // Unbranched, the three knobs are real fields (the baseline this compares against).
    for (const k of ['depth', 'stepdown', 'feed']) expect(r.plainFields, `${k} exposes on a single-arm slot`).toContain(k);
    expect(r.plainHasNaN, 'and nothing degenerates').toBe(false);
    // BRANCH ON `shape` and the arms stop agreeing — a polygon arm has no `surfaceraster` socket at all — so the cut
    // knobs are force-baked rather than dropped into a socket that would swallow them.
    if (r.branchedIsBranch) {
        for (const k of ['depth', 'stepdown'])
            expect(r.branchedFields, `${k} is force-baked once the slot carries an arm that cannot take it`).not.toContain(k);
    }
    // WHICHEVER WAY THE BRANCH RESOLVED, the one thing that must never appear is a swallowed token.
    expect(r.branchedHasNaN, 'no #var ever lands in a num() socket — that is what the intersection buys').toBe(false);
});
