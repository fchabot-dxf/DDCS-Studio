import { test, expect } from './support/harness.mjs';

/**
 * ATC-CHANGE E1 (t564) — the user_atc_change_data TWIN emit. On the E0 superset (42c4ff9): deriveGuards injects the DERIVED
 * `_arm`; postInstantiate is the M2 recompose — the STATIC arms (m6/manual/macroCall/firmware) value-swap by role in place
 * (edits survive), the inlineTnc arm is a DECLARED LIVE-VIEW regenerated wholesale from live settings.atc + ATC I/O. VERIFY:
 * twin == atcChangeStack byte-diff ZERO across the method × callMacro × config sweep on TWO profiles (Expert + V4.1); a live
 * ATC I/O change is TRACKED by the inline arm's next emit; a Blocks edit inside a static arm SURVIVES the recompose. NOT
 * registered/in-place yet (E2).
 *
 * t2691 — TIER MIGRATION WORK PACKAGE C: moved browser→node. All three tests already call registerUserOp explicitly (no
 * pre-seeding dependency), so this converts as-is (pattern 1). Measured: browser 3s/3 tests (4 workers) vs node —
 * see the work-package report for the exact node duration_ms; not a regression at this combo count (210-combo sweep).
 */
const CFG_ATC = {
    atc: { magazine: [{ tool: 1, x: 100, y: 50, z: -20, pocket: 1 }, { tool: 2, x: 150, y: 50, z: -20, pocket: 2 }], grip: 'drawbar', motion: 'pick-place', layout: 'linear', safeZ: 10 },
    outputs: [{ type: 'drawbar', onCode: 'M154', offCode: 'M155' }],
    inputs: [{ group: 'atc', id: 'drawbar_released_atc', waitCode: 'M301' }, { group: 'atc', id: 'drawbar_clamped_atc', waitCode: 'M302' }, { group: 'atc', id: 'spindle_stopped_atc', waitCode: 'M300' }],
};

test('E1: the twin emit == atcChangeStack byte-diff ZERO across method × callMacro × config, EVERY registered dialect (t1900, was Expert + V4.1)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async ({ CFG_ATC }) => {
        const { atcChangeDataDef } = await import('/blocks/dataOps/atcChangeData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { atcChangeStack } = await import('/wizards/atcChangeWizard.js');
        // t1900 — the dialect override (not setActiveProfile) reaches ALL 7 registered dialects, not just the 4
        // machine profiles: grbl/centroid/rs274ngc/grblhal have no profile counterpart. t2137 — the live,
        // user-facing override is retired ([[one-workspace-one-machine]]); __setDialectOverrideForTests is its
        // IN-MEMORY, test-only replacement (wizards/dialects/index.js) — unreachable from any real UI.
        const { __setDialectOverrideForTests, listPosts } = await import('/wizards/dialects/index.js');
        registerUserOp(atcChangeDataDef());
        const build = builderOf('user_atc_change_data');
        const methods = ['m6', 'firmware', 'manual', 'generic', 'disk'];
        const callMacros = [true, false, undefined];
        const base = { x: 120, y: 80, z: -5, zClear: 3, fixedT: 4, orient: true };
        const dialects = listPosts().map((p) => p.id);
        let diffs = 0, first = null, combos = 0;
        for (const dialectId of dialects) {
            __setDialectOverrideForTests(dialectId);
            for (const cfg of [{ atc: {}, outputs: [], inputs: [] }, CFG_ATC]) {
                window.__atcS = cfg; window.ddcsGetSettings = () => window.__atcS;
                for (const method of methods) for (const callMacro of callMacros) {
                    combos++;
                    const p = { ...base, method, ...(callMacro === undefined ? {} : { callMacro }) };
                    const twin = emitMapped(build(p)).text;
                    const builtin = emitMapped(atcChangeStack(p)).text;
                    if (twin !== builtin) { diffs++; if (!first) { const tl = twin.split('\n'), bl = builtin.split('\n'); let i = 0; while (i < tl.length && tl[i] === bl[i]) i++; first = { dialectId, method, callMacro, line: i, twin: tl.slice(i, i + 3), builtin: bl.slice(i, i + 3) }; } }
                }
            }
        }
        __setDialectOverrideForTests(null);   // restore (in-memory only — but be tidy)
        return { diffs, first, combos, dialectCount: dialects.length };
    }, { CFG_ATC });
    if (r.first) console.log('ATC-CHANGE E1 DIFF ' + JSON.stringify(r.first));
    expect(r.dialectCount, 'sanity: 7 registered dialects').toBe(7);
    expect(r.combos, 'the sweep = 7 dialects × 2 configs × 5 methods × 3 callMacro').toBe(210);
    expect(r.diffs, 'twin emit == atcChangeStack for ALL combos on EVERY dialect (byte-diff = ZERO) — this is the t1896-flagged latent dro risk, checked, not just asserted safe by reading').toBe(0);
});

test('E1: the inlineTnc arm is a LIVE VIEW — change an ATC I/O code → the NEXT emit tracks (no snapshot)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async ({ CFG_ATC }) => {
        const { atcChangeDataDef } = await import('/blocks/dataOps/atcChangeData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        registerUserOp(atcChangeDataDef());
        const build = builderOf('user_atc_change_data');
        const params = { method: 'generic', callMacro: false };   // → the inlineTnc arm (the live-settings tncProgram body)

        window.__atcS = JSON.parse(JSON.stringify(CFG_ATC)); window.ddcsGetSettings = () => window.__atcS;
        const a = emitMapped(build(params)).text;

        // change the drawbar RELEASE code M154 → M254 → the inline arm's NEXT emit must track it (regenerated live)
        window.__atcS = JSON.parse(JSON.stringify(CFG_ATC)); window.__atcS.outputs = [{ type: 'drawbar', onCode: 'M254', offCode: 'M155' }];
        const b = emitMapped(build(params)).text;
        return { aHas154: a.includes('M154'), bHas254: b.includes('M254'), bHas154: b.includes('M154'), changed: a !== b };
    }, { CFG_ATC });
    expect(r.aHas154, 'the initial inline body sources the declared drawbar RELEASE code M154').toBe(true);
    expect(r.changed, 'changing the declared code changes the inline emit (a live view, not a snapshot)').toBe(true);
    expect(r.bHas254, 'the NEXT emit tracks the new M254').toBe(true);
    expect(r.bHas154, 'the NEXT emit no longer has the old M154').toBe(false);
});

/**
 * E1 M2 RULING (t550) — a Blocks edit inside a STATIC arm SURVIVES a param change, AND the param-derived values still track.
 * The recompose value-swaps in place on the stored stack — it never regenerates the arm in a way that discards the edit.
 */
test('E1 M2: a Blocks edit inside a static arm (manual) SURVIVES the param recompose + the park X still tracks', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { atcChangeDataDef } = await import('/blocks/dataOps/atcChangeData.js');
        const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const def = atcChangeDataDef();
        registerUserOp(def);
        const build = builderOf('user_atc_change_data');
        window.__atcS = { atc: {}, outputs: [], inputs: [] }; window.ddcsGetSettings = () => window.__atcS;

        const params = { method: 'manual', x: 100, y: 100, z: 0 };
        const stack = build(params);
        // MUTATE a child atom (as a Blocks edit would) — inject a user comment INSIDE the manual arm
        const root = stack.find((b) => b.type === 'user_root');
        const at = root.children.findIndex((b) => b.type === 'comment' && /Manual swap/.test((b.params && b.params.text) || ''));
        root.children.splice(at + 1, 0, { type: 'comment', params: { text: 'USER NOTE - keep me' } });
        const before = emitMapped(stack).text;

        // param change: park X 100 → 175 → the recompose (on the STORED, EDITED stack) UPDATES #1 AND KEEPS the edit
        const recomposed = def.postInstantiate(stack, { method: 'manual', x: 175, y: 100, z: 0 });
        const after = emitMapped(recomposed).text;
        const parkX = (t) => (t.match(/#1=(-?[\d.]+)/) || [])[1];
        return { before, after, parkXBefore: parkX(before), parkXAfter: parkX(after) };
    });
    expect(r.before, 'the edit is present in the initial emit').toContain('USER NOTE - keep me');
    expect(r.after, 'the Blocks edit SURVIVES the param recompose (in-place on the stored stack, not a rebuild)').toContain('USER NOTE - keep me');
    expect(r.parkXBefore, 'initial: park X (#1) = 100').toBe('100');
    expect(r.parkXAfter, 'after the edit: park X STILL tracks the param change (100 → 175)').toBe('175');
});
