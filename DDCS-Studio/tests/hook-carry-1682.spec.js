import { test, expect } from '@playwright/test';

/**
 * t1682 — census finding 3 (t1678): `OP_CODE_HOOKS`, a hand-maintained 8-name allow-list in `userOps.js`, gated
 * which `def.*` properties `reconcileCodeHooks` would remember and re-attach across a fork/import — and went stale
 * the way `KNOWN_LEAF_RECORD_FIELDS` almost did (t1654): 7 real, live hooks added to individual ops over time
 * (`zRuler`/`entryPoint`/`simStartParams`/`armGap`/`simStock`/`latheTool`/`latheProbeAxis`) were never added to it,
 * so forking any op that set one through the Blocks-tab "Customize" path — the PRIMARY editing route for every
 * ported wizard — silently dropped it. Byte-correct emit, clean console, a piece of the UI just missing.
 *
 * THE FIX generalizes rather than appends: `userOpFromStack` (the ONE def constructor) owns a small, stable BASE
 * shape, and `registerUserOp` + its callers add an equally small, stable LIFECYCLE set (registration/versioning/
 * provenance bookkeeping, not per-feature behaviour). `reconcileCodeHooks` now treats ANYTHING ELSE found on a def
 * as a hook — function or plain data, derived from one real call to `userOpFromStack`, not restated as a second
 * list that can drift from the first. `OP_CODE_HOOKS` no longer exists. A new hook needs no list update.
 *
 * NOT ALL "MISSING" HOOKS ARE FUNCTIONS: `zRuler`/`entryPoint`/`simStartParams`/`latheTool`/`latheProbeAxis` are all
 * plain, JSON-safe data — only `armGap`/`simStock` are real functions. A first attempt at this fix filtered on
 * `typeof === 'function'` alone and genuinely missed the other 5 (caught live: a probe def's plain-object `zRuler`
 * came back `undefined` after a simulated fork) — the denylist-of-core-shape approach below is what actually holds
 * for every hook shape, not just the function-valued ones.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

test('DIRECT: reconcileCodeHooks carries every previously-missing hook shape generically (function AND plain data)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => !!window.ddcsStudio);
    const r = await page.evaluate(async () => {
        const uo = await import('/blocks/userOps.js');
        // A def carrying 5 of the 7 previously-missing hooks (a mix of plain-data and function shapes) + 2 of the
        // original 8 (still must keep working) — registered fresh so LOCAL_HOOKS captures them generically, then
        // deleted (LOCAL_HOOKS survives deletion, the whole point — the app still knows its own code).
        const src = uo.userOpFromStack('t1682_probe', 'probe', [{ id: '1', type: 'comment', params: {} }], []);
        src.zRuler = { depthParam: 'depth', stepParam: 'stepdown' };   // plain DATA, not a function
        src.entryPoint = () => ({ x: 0, y: 0 });
        src.armGap = () => 'why';
        src.simStock = () => ({ diameter: 20 });
        src.latheTool = () => ({ type: 'od' });
        src.postInstantiate = (stack) => stack;
        src.previewGeometry = () => ({ paths: [], handles: [] });
        uo.createUserOp(src);
        uo.deleteUserOp('user_t1682_probe');

        // simulate a fork arriving hookless (a JSON round-trip strips every function AND, on devMode's authorFork
        // path specifically, every property at all beyond bindingSpecs/forkedFrom — plain data included) naming
        // forkedFrom; confirm reconcileCodeHooks (reached via createUserOp -> registerUserOp) restores all 7.
        const forked = uo.userOpFromStack('t1682_probe_fork', 'probe fork', [{ id: '1', type: 'comment', params: {} }], []);
        forked.forkedFrom = 'user_t1682_probe';
        uo.createUserOp(forked);
        const after = uo.getUserDef('user_t1682_probe_fork');   // the LIVE def — listUserOps() reads the PERSISTED/JSON view, where a function is undefined by construction
        const out = {
            reattached: (after.hooksReattached || []).sort(),
            hasZRuler: typeof after.zRuler,
            hasEntryPoint: typeof after.entryPoint,
            hasArmGap: typeof after.armGap,
            hasSimStock: typeof after.simStock,
            hasLatheTool: typeof after.latheTool,
            hasPostInstantiate: typeof after.postInstantiate,
            hasPreviewGeometry: typeof after.previewGeometry,
        };
        uo.deleteUserOp('user_t1682_probe_fork');
        return out;
    });
    expect(r.reattached).toEqual(['armGap', 'entryPoint', 'latheTool', 'postInstantiate', 'previewGeometry', 'simStock', 'zRuler'].sort());
    expect(r.hasZRuler, 'zRuler (plain data) survives').toBe('object');
    expect(r.hasEntryPoint, 'entryPoint (plain data, function in this probe) survives').toBe('function');
    expect(r.hasArmGap, 'armGap (function) survives').toBe('function');
    expect(r.hasSimStock, 'simStock (function) survives').toBe('function');
    expect(r.hasLatheTool, 'latheTool survives').toBe('function');
    expect(r.hasPostInstantiate, 'one of the ORIGINAL 8 still works').toBe('function');
    expect(r.hasPreviewGeometry, 'another of the ORIGINAL 8 still works').toBe('function');
});

test('REAL GESTURE: fork surfacing through the actual Customize -> Save as new path; the FORK\'S OWN rendered UI shows the depth ruler', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('dialog', (d) => d.accept());
    await page.goto('/', { timeout: 60000 });
    // t2351 — the app's own declared "everything is wired" signal (t1279), not a hand-picked global subset —
    // see wizard-face-1599's own boot() for the full trace of why this class of wait was silently racy.
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 60000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
    await page.waitForFunction(() => !!window.ddcsSaveAsWizard, null, { timeout: 60000 });

    const forkName = 't1682 fork ' + Date.now();
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate((t) => window.ddcsEditWizardDef(t), 'user_surfacing_data');   // surfacing declares BOTH zRuler and entryPoint
    await page.waitForTimeout(500);
    await page.evaluate(() => window.ddcsSaveAsWizard());
    await page.waitForSelector('.blk-dev-opname', { state: 'visible', timeout: 10000 });
    await page.fill('.blk-dev-opname', forkName);
    await page.click('.blk-dev-save');   // triggers devMode's authorFork -> createWizard -> createUserOp -> reconcileCodeHooks, the exact route that was dropping these 7
    await page.waitForTimeout(800);

    const newOpType = await page.evaluate(async (name) => {
        const uo = await import('/blocks/userOps.js');
        const d = uo.listUserOps().find((x) => x.label === name);
        return d ? d.opType : null;
    }, forkName);
    expect(newOpType, 'the fork was created and is findable by its name').not.toBeNull();

    // The fork is PERSISTED (createUserOp writes the store) — a genuinely fresh page load, not an in-session
    // app-tab switch, both sidesteps a real intermittent DOM-timing flake found while building this test AND is a
    // stronger proof (the fork's hooks survive an actual reload, not just staying in the same live session).
    await page.goto('/', { timeout: 60000 });
    await page.waitForFunction(() => !!window.openWiz, null, { timeout: 60000 });
    await page.evaluate((t) => window.openWiz(t), newOpType);
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);
    const forkState = await page.evaluate(() => ({
        zRulerRow: document.querySelectorAll('.viz-zruler-row').length,
        zRulerTicks: document.querySelectorAll('.zruler-z').length,
    }));

    // the ORIGINAL surfacing, for comparison — proves the fork isn't coincidentally fine for an unrelated reason
    await page.evaluate(() => window.openWiz('user_surfacing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible' });
    await page.waitForTimeout(500);
    const originalState = await page.evaluate(() => ({
        zRulerRow: document.querySelectorAll('.viz-zruler-row').length,
        zRulerTicks: document.querySelectorAll('.zruler-z').length,
    }));

    await page.evaluate(async (t) => { const uo = await import('/blocks/userOps.js'); uo.deleteUserOp(t); }, newOpType);

    expect(originalState.zRulerRow, 'sanity: the SOURCE surfacing shows the depth ruler').toBeGreaterThan(0);
    expect(forkState.zRulerRow, 'the FORK also shows the depth ruler row — zRuler survived the Customize->Save-as-new path').toBeGreaterThan(0);
    expect(forkState.zRulerTicks, 'the fork\'s ruler has real pass ticks, not an empty shell').toBeGreaterThan(0);
});
