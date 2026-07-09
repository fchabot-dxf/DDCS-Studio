import { test, expect } from '@playwright/test';

/**
 * ATC-TEST E1 (t558) — the user_atc_test_data TWIN emit. On the E0 superset (826f23f): deriveGuards (the mode) collapses the
 * template to the chosen arm; postInstantiate UNROLLS/RECOMPOSES the arm from the CURRENT settings via the ONE shared builder
 * (atcTestStack) — the POCKETS arm re-unrolls the live settings.atc.magazine; the DRAWBAR arm's release/lock/sensor M-codes
 * are the DECLARED ATC I/O (Settings → ATC I/O). VERIFY: twin emit == atcTestStack byte-diff ZERO across the mode × magazine
 * size × drawbar-count sweep for the CURRENT settings; a magazine / declared-code change is TRACKED by the NEXT emit (no
 * frozen snapshot); a user edit inside an unrolled arm SURVIVES the recompose (the M2 gate). NOT registered/in-place yet (E2).
 */
function setAtc(page, magazine, io) {
    return page.evaluate(({ magazine, io }) => {
        window.__atc = { atc: { magazine }, outputs: (io && io.outputs) || [], inputs: (io && io.inputs) || [] };
        window.ddcsGetSettings = () => window.__atc;
    }, { magazine, io });
}

test('E1: the twin emit == atcTestStack byte-diff ZERO across mode × magazine size × drawbar-count for the CURRENT settings', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { atcTestDataDef } = await import('/blocks/dataOps/atcTestData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { atcTestStack } = await import('/wizards/atcTestWizard.js');
        registerUserOp(atcTestDataDef());
        const build = builderOf('user_atc_test_data');
        const mkMag = (n) => Array.from({ length: n }, (_, i) => ({ tool: i + 1, x: 100 + i * 12, y: 40 + i * 5, z: -20 - i }));
        let diffs = 0, first = null, combos = 0;
        for (const mode of ['drawbar', 'pockets', undefined]) for (const mag of [0, 1, 3, 8]) for (const n of [1, 10, 25]) {
            for (const descend of [false, true]) {
                combos++;
                const magazine = mkMag(mag);
                // the twin reads magazine from CURRENT settings — set it, then emit both the twin + the concrete for the SAME magazine
                window.__atc = { atc: { magazine }, outputs: [], inputs: [] };
                window.ddcsGetSettings = () => window.__atc;
                const params = { mode, cycles: n, dwellMs: 500, first: 1, count: mag || 8, zClear: 0, descend };
                const twin = emitMapped(build(params)).text;
                const builtin = emitMapped(atcTestStack({ ...params, magazine })).text;
                if (twin !== builtin) { diffs++; if (!first) { const tl = twin.split('\n'), bl = builtin.split('\n'); let i = 0; while (i < tl.length && tl[i] === bl[i]) i++; first = { mode, mag, n, descend, line: i, twin: tl.slice(i, i + 3), builtin: bl.slice(i, i + 3) }; } }
            }
        }
        return { diffs, first, combos };
    });
    if (r.first) console.log('ATC-TEST E1 DIFF ' + JSON.stringify(r.first));
    expect(r.combos, 'the sweep = 3 modes × 4 magazine sizes × 3 counts × 2 descend').toBe(72);
    expect(r.diffs, 'twin emit == atcTestStack for ALL combos (byte-diff = ZERO)').toBe(0);
});

test('E1: the pockets unroll TRACKS the live magazine — add / edit a pocket → the NEXT emit reflects it (no snapshot)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { atcTestDataDef } = await import('/blocks/dataOps/atcTestData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        registerUserOp(atcTestDataDef());
        const build = builderOf('user_atc_test_data');
        const params = { mode: 'pockets', first: 1, count: 8, zClear: 0, descend: false };
        const pocketCount = (t) => (t.match(/Pocket \d+ — T\d+/g) || []).length;   // the head "( Pocket N — T# )" (NOT the confirm's "Pocket N — verify")
        const xVals = (t) => (t.match(/#110=(-?[\d.]+)/g) || []).map((s) => s.replace('#110=', ''));

        // start: 2 pockets
        window.__atc = { atc: { magazine: [{ tool: 1, x: 100, y: 50, z: -20 }, { tool: 2, x: 150, y: 50, z: -20 }] }, outputs: [], inputs: [] };
        window.ddcsGetSettings = () => window.__atc;
        const a = emitMapped(build(params)).text;

        // ADD a 3rd pocket + EDIT pocket 2's X → the NEXT emit unrolls 3 arms with the new X (tracked live, not frozen at 2 × old X)
        window.__atc = { atc: { magazine: [{ tool: 1, x: 100, y: 50, z: -20 }, { tool: 2, x: 199, y: 50, z: -20 }, { tool: 3, x: 250, y: 50, z: -20 }] }, outputs: [], inputs: [] };
        const b = emitMapped(build(params)).text;

        return { countA: pocketCount(a), countB: pocketCount(b), xA: xVals(a), xB: xVals(b) };
    });
    expect(r.countA, 'start: 2 taught pockets → 2 visit-arms').toBe(2);
    expect(r.countB, 'added a 3rd pocket → the NEXT emit unrolls 3 arms (tracked live)').toBe(3);
    expect(r.xA, 'start: pocket X = 100, 150').toEqual(['100', '150']);
    expect(r.xB, 'edited pocket 2 X → 199 + the new pocket 3 X = 250 (tracked)').toEqual(['100', '199', '250']);
});

/**
 * E1 M2 RULING (t550) — the recompose operates on the OP'S OWN STORED STACK: a Blocks edit inside an UNROLLED pocket arm
 * SURVIVES a magazine change, AND the pocket values still track. The recompose value-swaps in place — it never regenerates
 * arms in a way that discards the edit.
 */
test('E1 M2: a Blocks edit inside a pocket arm SURVIVES the magazine recompose + the pocket X still tracks settings', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { atcTestDataDef } = await import('/blocks/dataOps/atcTestData.js');
        const { registerUserOp, flattenBlocks } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const def = atcTestDataDef();
        registerUserOp(def);
        const build = builderOf('user_atc_test_data');
        const params = { mode: 'pockets', first: 1, count: 8, zClear: 0, descend: false };

        // instantiate with 3 pockets
        window.__atc = { atc: { magazine: [{ tool: 1, x: 100, y: 50, z: -20 }, { tool: 2, x: 150, y: 50, z: -20 }, { tool: 3, x: 200, y: 50, z: -20 }] }, outputs: [], inputs: [] };
        window.ddcsGetSettings = () => window.__atc;
        const stack = build(params);

        // MUTATE a child atom (as a Blocks edit would) — inject a user comment INSIDE pocket 2's arm
        const root = stack.find((b) => b.type === 'user_root');
        const p2 = root.children.findIndex((b) => b.type === 'comment' && /^Pocket 2\b/.test((b.params && b.params.text) || ''));
        root.children.splice(p2 + 1, 0, { type: 'comment', params: { text: 'USER NOTE - keep me' } });
        const before = emitMapped(stack).text;

        // magazine change: pocket 2 X 150 → 177 → the recompose (on the STORED, EDITED stack) UPDATES the X AND KEEPS the edit
        window.__atc = { atc: { magazine: [{ tool: 1, x: 100, y: 50, z: -20 }, { tool: 2, x: 177, y: 50, z: -20 }, { tool: 3, x: 200, y: 50, z: -20 }] }, outputs: [], inputs: [] };
        const recomposed = def.postInstantiate(stack, params);
        const after = emitMapped(recomposed).text;

        const p2x = (t) => { const seg = t.split('Pocket 2 ')[1] || ''; return (seg.match(/#110=(-?[\d.]+)/) || [])[1]; };
        return { before, after, p2xBefore: p2x(before), p2xAfter: p2x(after) };
    });
    expect(r.before, 'the edit is present in the initial emit').toContain('USER NOTE - keep me');
    expect(r.after, 'the Blocks edit SURVIVES the magazine recompose (in-place on the stored stack, not a rebuild)').toContain('USER NOTE - keep me');
    expect(r.p2xBefore, 'initial: pocket 2 X = 150').toBe('150');
    expect(r.p2xAfter, 'after the edit: pocket 2 X STILL tracks the settings change (150 → 177)').toBe('177');
});

/**
 * E1 ONE-SOURCE — the drawbar / sensor M-codes are the DECLARED ATC I/O (Settings → ATC I/O), read via the SAME
 * resolveAction the tool-change emit uses. Default I/O → the canonical codes (M154/M155/M301/M302/M300); a declared override
 * → BOTH the twin AND the concrete build TRACK it (one source, byte-identical).
 */
test('E1 declared-I/O: the drawbar/sensor codes == Settings → ATC I/O — a declared override tracks in BOTH twin + concrete', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { atcTestDataDef } = await import('/blocks/dataOps/atcTestData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { atcTestStack } = await import('/wizards/atcTestWizard.js');
        registerUserOp(atcTestDataDef());
        const build = builderOf('user_atc_test_data');
        const params = { mode: 'drawbar', cycles: 3, dwellMs: 500 };
        const codes = (t) => (t.match(/M\d+/g) || []).filter((m) => /M(154|155|300|301|302|254|255|350|351|352)/.test(m));

        // DEFAULT (no ATC I/O) → the canonical literals
        window.__atc = { atc: { magazine: [] }, outputs: [], inputs: [] };
        window.ddcsGetSettings = () => window.__atc;
        const def = emitMapped(build(params)).text;

        // DECLARED OVERRIDE — a drawbar output with custom on/off codes + custom sensor waits → BOTH twin + concrete track them
        window.__atc = {
            atc: { magazine: [] },
            outputs: [{ type: 'drawbar', onCode: 'M254', offCode: 'M255' }],
            inputs: [{ group: 'atc', id: 'drawbar_released_atc', waitCode: 'M351' }, { group: 'atc', id: 'drawbar_clamped_atc', waitCode: 'M352' }, { group: 'atc', id: 'spindle_stopped_atc', waitCode: 'M350' }],
        };
        const twin = emitMapped(build(params)).text;
        const builtin = emitMapped(atcTestStack({ ...params, magazine: [] })).text;
        return { defHasDefault: /M154/.test(def) && /M301/.test(def), twin, builtin };
    });
    expect(r.defHasDefault, 'default I/O → the canonical M154 / M301 (byte-identical to the old literals)').toBe(true);
    expect(r.twin, 'declared override → the release code tracks (M254)').toContain('M254');
    expect(r.twin, 'declared override → the lock code tracks (M255)').toContain('M255');
    expect(r.twin, 'declared override → the released-sensor code tracks (M351)').toContain('M351');
    expect(r.twin, 'declared override → the spindle-stopped code tracks (M350)').toContain('M350');
    expect(r.twin, 'the twin should NOT still emit the default M154 after the override').not.toContain('M154');
    expect(r.twin).toBe(r.builtin);   // ONE SOURCE — the twin + the concrete build read the SAME declared I/O → byte-identical
});
