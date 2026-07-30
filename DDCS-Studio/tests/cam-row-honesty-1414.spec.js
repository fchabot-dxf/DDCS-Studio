import { test, expect } from '@playwright/test';

/**
 * t1414 — A GREYED BUILD-ENUM ROW MAY NOT LIE, AND IT MAY NOT LAG THE MACRO EITHER WAY.
 *
 * ── THE DEFECT (measured t1412, live in released code) ────────────────────────────────────────────────────────────
 * `opCamMap`'s own rule for a build-enum row is *"the row states the shape being built and stays greyed —
 * informative, never a control that lies."* For pocket it lied: `pocketSlot`'s packed body is BYTE-IDENTICAL across
 * `strategy: spiral|raster` and across `direction: bothways|oneway` — one hand-written raster+wall — while the table
 * displayed the operator's pick beside it. A concentric pocket packed a slot that cuts a raster and the surface
 * agreed with the request. Same class as t1402's ring defect.
 *
 * ── WHY THIS TEST IS A LOCK RATHER THAN A SNAPSHOT ────────────────────────────────────────────────────────────────
 * The fix is a DECLARATION (`GENERATOR_IGNORES`), and a declaration about someone else's macro rots the moment that
 * macro changes. So this asserts the agreement in BOTH directions, per generator, per build enum:
 *
 *     listed as ignored   ⇒ the packed bodies at its arms must be IDENTICAL   (else the row under-claims: the macro
 *                           grew a capability and the table is now hiding it)
 *     NOT listed          ⇒ the packed bodies at its arms must DIFFER         (else a new liar has appeared)
 *
 * The ruled C-act — pocket's clearing body delegating to the atom — will make `strategy` genuinely carried. On that
 * day this test goes RED and the row must come out. That is the point: the row cannot lag the macro in either
 * direction, which is the only version of "honest" that survives the next act.
 *
 * ── AND IT IS THE SWEEP ───────────────────────────────────────────────────────────────────────────────────────────
 * It walks EVERY per-type generator rather than the one that was caught, so a clean generator is reported as MEASURED
 * clean rather than assumed clean.
 */
test.use({ viewport: { width: 1500, height: 1000 } });

const boot = async (page) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
};

test('THE SWEEP + THE LOCK — every per-type generator, every build enum, both directions', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { seedFromOp, camTypeOf, buildEnumFields, GENERATOR_IGNORES, GENERATOR_BAKES_PICK, generatorIgnores, generatorBakesPick, PARAM_ALIAS } = await import('/data/opCamMap.js');
        const { getUserDef } = await import('/blocks/userOps.js');
        const { cornerSlot, edgeSlot, probeZSlot, insideCentreSlot, bossCentreSlot, alignmentSlot } = await import('/data/probeToSlot.js');
        const { pocketSlot, circlePocketSlot, surfacingSlot } = await import('/data/millToSlot.js');
        const { slotFromOp } = await import('/data/opToSlot.js');
        const GEN = { corner: cornerSlot, edge: edgeSlot, zprobe: probeZSlot, inside: insideCentreSlot, boss: bossCentreSlot, align: alignmentSlot, pocket: pocketSlot, cpocket: circlePocketSlot, surface: surfacingSlot };
        const genOf = (camType, variant, decl) => (GEN[camType] ? GEN[camType](new Set(), 0, variant, decl)
            : (camType === 'slot' || camType === 'drill' || camType === 'bore') ? slotFromOp(camType, variant || 'circle', new Set(), 0, decl) : null);

        // Every op the CAM builder can route, with a params seed that reaches its DEFAULT (generator) arm.
        const OPS = [
            { opType: 'user_pocket_data', base: { shape: 'rect' } },
            { opType: 'user_pocket_data', base: { shape: 'circle', dia: 50 } },
            { opType: 'user_surfacing_data', base: {} },
            { opType: 'user_corner_data', base: {} },
            { opType: 'user_edge_data', base: {} },
            { opType: 'user_slot_data', base: {} },
            { opType: 'user_drill_data', base: {} },
        ];
        const rows = [];
        for (const o of OPS) {
            const def = getUserDef(o.opType);
            if (!def) { rows.push({ opType: o.opType, skipped: 'no registered def' }); continue; }
            const params = { ...(def.bindings || []).reduce((a, b) => (b && b.param != null ? { ...a, [b.param]: b.default } : a), {}), ...o.base };
            const t = camTypeOf({ opType: o.opType, params });
            if (!t.camType) { rows.push({ opType: o.opType, shape: o.base.shape, skipped: t.universal ? 'universal arm' : 'unsupported' }); continue; }
            const seed = seedFromOp({ opType: o.opType, params });
            const enums = buildEnumFields(def, params, t.camType);
            for (const e of enums) {
                // ⚠ ARMS THAT ROUTE ELSEWHERE ARE OUT OF SCOPE. `camTypeOf` forks some picks to a DIFFERENT generator
                // (surfacing's zMode:'skim' goes to the universal arm, a pocket shape to cpocket/universal). That fork
                // is the file's declared honesty, not a lie — this generator is simply never asked for that arm, so
                // comparing its body across one is measuring a question nobody asks.
                const arms = (e.buildEnum || []).map((a) => a.value)
                    .filter((v) => (camTypeOf({ opType: o.opType, params: { ...params, [e.key]: v } }).camType === t.camType));
                if (arms.length < 2) continue;
                // build the generator's body at each arm — decl mirrors what the pack would declare
                const bodyAt = (v) => {
                    const s = seedFromOp({ opType: o.opType, params: { ...params, [e.key]: v } });
                    const decl = {};
                    for (const f of (s.fields || [])) decl[f.key] = { exposed: f.exposed !== false, value: f.value };
                    const g = genOf(t.camType, undefined, decl);
                    return g ? g.body : null;
                };
                const bodies = arms.map(bodyAt);
                const allSame = bodies.every((b) => b === bodies[0]);
                const seedRow = (seed.fields || []).find((f) => f.key === e.key) || {};
                // …AND A PICK CAN REACH THE MACRO WITHOUT CHANGING ITS TEXT. When the generator also owns a VALUE
                // field aliased to this param, the macro reads it as a NUMBER at run time (corner's `seq`, `wcs`) —
                // the body is identical by design and the pick is fully carried. Conflating those two mechanisms is
                // how a body-only criterion invents liars: measured, and it invented three on the first run.
                const alias = (PARAM_ALIAS[t.camType] || {});
                const valueField = (seed.fields || []).find((f) => f.key !== e.key && !f._branch
                    && (f.key === e.key || (Array.isArray(alias[f.key]) ? alias[f.key] : [alias[f.key]]).includes(e.key)));
                rows.push({
                    opType: o.opType, shape: o.base.shape, camType: t.camType, param: e.key, arms: arms.length,
                    carried: !allSame || !!valueField,
                    via: !allSame ? 'body' : (valueField ? 'runtime field ' + valueField.key : 'nothing'),
                    // t1429 — RESOLVED, never looked up raw: a disposition may be a function of another pick (the
                    // pocket's `direction` is carried by the raster walk and meaningless to the rings), and a raw key
                    // read returns a truthy function that calls every conditional row a liar in both directions.
                    declaredIgnored: !!generatorIgnores(t.camType, e.key, params),
                    declaredBakes: !!generatorBakesPick(t.camType, e.key, params),
                    seedExposable: !!seedRow.exposable, seedTip: seedRow._exposeTip || '',
                    buildable: bodies.every((b) => typeof b === 'string' && b.length > 0),
                });
            }
        }
        return { rows, table: GENERATOR_IGNORES, bakes: GENERATOR_BAKES_PICK };
    });

    const measured = r.rows.filter((x) => !x.skipped);
    console.log('CAM ROW SWEEP:\n' + r.rows.map((x) => x.skipped
        ? `  ${x.opType}${x.shape ? '/' + x.shape : ''}: SKIPPED (${x.skipped})`
        : `  ${x.camType}.${x.param}: carried=${x.carried} via=${x.via} declaredIgnored=${x.declaredIgnored} exposable=${x.seedExposable}`).join('\n'));

    expect(measured.length, 'the sweep actually measured build enums (zero would pass vacuously)').toBeGreaterThan(0);
    for (const x of measured) {
        expect(x.buildable, `${x.camType}.${x.param}: every arm builds a body`).toBe(true);
        // ── THE LOCK, both ways ──
        expect(x.declaredIgnored, `${x.camType}.${x.param}: the macro ${x.carried ? 'DOES carry this pick, so it must NOT be declared ignored (has the C-act landed? remove the row)' : 'does NOT carry this pick, so it MUST be declared ignored (a new liar)'}`)
            .toBe(!x.carried);
        // …and the table row follows the declaration: a pick the macro ignores cannot be branched either, because
        // "branch" means the macro carries every arm — exactly what it does not do.
        if (!x.carried) {
            expect(x.seedExposable, `${x.camType}.${x.param}: a pick the macro ignores is not branchable`).toBe(false);
            expect(x.seedTip, `${x.camType}.${x.param}: and the row SAYS what the macro really does`).toMatch(/NOT carried/);
        }
        // ── t1429 — THE THIRD DISPOSITION, locked the same way ──
        // Removing a GENERATOR_IGNORES row makes a pick `branchable` (that flag is gated on `!ignored`), so the C-act's
        // own fix would have offered "Expose as a BRANCH: the macro carries every arm and jumps on the pendant number"
        // for a pick the pack BAKES into one arm — one lie swapped for another. A declared BAKED pick is carried AND
        // un-branchable, and it has to say which: this asserts the row cannot claim a runtime branch it does not have.
        if (x.declaredBakes) {
            expect(x.carried, `${x.camType}.${x.param}: a pick declared BAKED must genuinely reach the macro`).toBe(true);
            expect(x.declaredIgnored, `${x.camType}.${x.param}: …so it is not also declared ignored`).toBe(false);
            expect(x.seedExposable, `${x.camType}.${x.param}: a BAKED pick is not a runtime branch`).toBe(false);
            expect(x.seedTip, `${x.camType}.${x.param}: and the row says the slot contains the shape you picked`).toMatch(/BAKED into this slot/);
        }
    }
});

/**
 * THE SENTENCE THE OPERATOR READS — asserted on the real seed, in the words a machinist can act on. `_exposeTip` is
 * what macrosApp puts on the Expose control's title, so this is the string that reaches the screen.
 *
 * ── t1429 — THIS TEST WENT RED AND CAME BACK GREEN, WHICH IS THE C-ACT'S PROOF ────────────────────────────────────
 * It used to assert the pocket row said *"This slot's macro cuts a RASTER clear… a Spiral pick is NOT carried"*, and
 * the header above predicted the day that would invert: *"when the ruled C-act lands and the clearing body delegates
 * to the atom, this spec goes RED and the row must come out."* It did, on the delegation commit — the LOCK's
 * `declaredIgnored === !carried` fired the moment the packed bodies started differing per arm — and the row came out.
 * What replaced it is the THIRD disposition (GENERATOR_BAKES_PICK): the pick is carried, the slot contains the shape
 * that was picked, and it is NOT a runtime branch. The three assertions below are the same three facts, inverted.
 */
test('THE ROW SAYS WHAT THE MACRO DOES — a spiral pocket now packs a spiral, and the row says it is BAKED', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { seedFromOp } = await import('/data/opCamMap.js');
        const { POCKET_DEFAULTS } = await import('/blocks/dataOps/pocketData.js');
        const row = (over, key) => {
            const s = seedFromOp({ opType: 'user_pocket_data', params: { ...POCKET_DEFAULTS, shape: 'rect', ...over } });
            return (s.fields || []).find((f) => f.key === key) || null;
        };
        return {
            spiralStrategy: row({ strategy: 'spiral' }, 'strategy'),
            rasterStrategy: row({ strategy: 'raster' }, 'strategy'),
            direction: row({ strategy: 'raster', direction: 'oneway' }, 'direction'),
            entryRow: row({ entry: 'ramp' }, 'entry'),
            stepdownRow: row({ entry: 'ramp' }, 'stepdown'),
        };
    });

    // The row still STATES the operator's pick — informative, not hidden (postGating's rule) …
    expect(r.spiralStrategy.value, 'the row shows the pick the op carries').toBe('spiral');
    // … and now says, in words, that the macro BAKES it: the slot contains the walk that was picked.
    expect(r.spiralStrategy._exposeTip, 'the spiral pocket is told its slot cuts rings').toMatch(/BAKED into this slot/);
    expect(r.spiralStrategy._exposeTip, 'and the not-carried sentence is GONE — the macro carries the pick now').not.toMatch(/NOT carried/);
    expect(r.spiralStrategy._exposeTip, 'and it names what each arm actually cuts, not just that it differs').toMatch(/Spiral \(concentric\) cuts rings inward/);
    expect(r.spiralStrategy.exposable, 'and it still cannot be BRANCHED — a baked pick is one arm, chosen at build').toBe(false);
    // The RASTER pick gets the identical sentence — the row is about the MACRO, not about whether this particular
    // op happens to agree with it. (A sentence that appeared only on disagreement would be a warning, not a fact.)
    expect(r.rasterStrategy._exposeTip, 'the same fact is stated whichever way the op is set').toBe(r.spiralStrategy._exposeTip);
    // ⚠ `direction` HAS a row now, and its absence used to be honest-by-omission for exactly one reason: the macro
    // ignored it, so nothing could misstate it. The delegated macro bakes it (one-way lifts and re-plunges every pass),
    // so silence would have become the omission that hides a real pick — the same lie, told by saying nothing.
    expect(r.direction, 'direction has a row now, because the macro carries it').not.toBe(null);
    expect(r.direction._exposeTip, 'and it says the slot contains the walk that was picked').toMatch(/BAKED into this slot/);
    expect(r.direction.value, 'showing the pick the op holds').toBe('oneway');
    // ⚠ `entry` is the honest exception: it reaches the macro, and what the macro DOES with a ramp/helix pick against
    // a pendant-dialled area is degrade to a plunge and say so. The row says that before a chip is cut, rather than
    // leaving the operator to find it by reading the descent line.
    expect(r.entryRow, 'entry has a row too').not.toBe(null);
    expect(r.entryRow._exposeTip, 'entry genuinely reaches the macro — no not-carried sentence').not.toMatch(/NOT carried/);
    expect(r.entryRow._exposeTip, 'and it warns that a ramp/helix pick degrades, in the program, with the reason').toMatch(/degrades to a plunge/);
    // …and the entry gate it drives still greys the two knobs its geometry bakes.
    expect(r.stepdownRow.exposable, 'the t1341 entry gate is untouched').toBe(false);
});

/**
 * THE ONE-ARM REFUSAL — a small lie found by PICTURING the fix, and in exactly its class.
 *
 * The screenshot of the honest rows showed `material` (a single-option enum) reading *"1 arms would duplicate the
 * program 1 times — too big for one macro"*. Broken grammar carrying a wrong reason: a one-option enum is not refused
 * for SIZE, it is refused because there is nothing to branch between — a different fact, and the one the operator
 * needs. Worth recording that it surfaced from looking at the rendered rows rather than from reading the code.
 */
test('THE ONE-ARM REFUSAL SAYS THE RIGHT THING — nothing to branch between, not "too big"', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { branchRefusal, seedFromOp } = await import('/data/opCamMap.js');
        const { POCKET_DEFAULTS } = await import('/blocks/dataOps/pocketData.js');
        const s = seedFromOp({ opType: 'user_pocket_data', params: { ...POCKET_DEFAULTS, shape: 'rect' } });
        const oneArm = (s.fields || []).filter((f) => f._branch && (f.buildEnum || []).length < 2);
        return { one: branchRefusal(1), four: branchRefusal(4), rows: oneArm.map((f) => ({ k: f.key, tip: f._exposeTip })) };
    });
    expect(r.one, 'a single option is refused for the right reason').toMatch(/nothing to branch between/);
    expect(r.one, 'and never for size').not.toMatch(/too big/);
    expect(r.four, 'a genuinely over-budget enum keeps the size refusal').toMatch(/too big for one macro/);
    for (const row of r.rows) expect(row.tip, `${row.k}'s row carries the right refusal`).toMatch(/nothing to branch between/);
});
