import { test, expect } from '@playwright/test';

/**
 * HOMING E1 (t548) — the user_homing_data TWIN emit. On the E0 superset: deriveGuards (_run ticks) collapses the template to
 * the selection; postInstantiate UNROLLS the arms in the op's run-ORDER, RECOMPOSED from the CURRENT settings (machine span →
 * seek dist; declared <edge>Home → direction; unset span → skip) via the ONE shared builder. VERIFY: twin emit == homingStack
 * byte-diff ZERO across the axis-selection × Z-sign × declared-home sweep PLUS run-order permutations; a settings change (Z
 * travel / Home flag) is TRACKED by the NEXT emit (no frozen snapshot). NOT registered/opened in-place yet (E2).
 */
function setHomingSettings(page, machine, limits, config) {
    return page.evaluate(({ machine, limits, config }) => {
        window.__homingSettings = { machine, limits, homing: { axes: config } };
        window.ddcsGetSettings = () => window.__homingSettings;
    }, { machine, limits, config });
}

test('E1: the twin emit == homingStack byte-diff ZERO across the selection × Z-sign × declared-home sweep + run-order permutations', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { homingDataDef, HOMING_DEFAULTS } = await import('/blocks/dataOps/homingData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { homingStack } = await import('/wizards/homingWizard.js');
        registerUserOp(homingDataDef());
        const build = builderOf('user_homing_data');
        const cfg = { x: { enable: true, backoff: 5, seekFeed: 800, slowFeed: 100 }, y: { enable: true, backoff: 5 }, z: { enable: true, backoff: 5 }, a: {}, b: {} };
        // canonical-order SELECTIONS + run-order PERMUTATIONS (the unroll) × Z signs × declared-home variants
        const sels = [['x'], ['z'], ['x', 'z'], ['x', 'y', 'z'], ['a'], ['a', 'b'], ['x', 'y', 'z', 'a', 'b'],
                      ['z', 'x', 'y'], ['y', 'x', 'z'], ['y'], ['b', 'a']];   // ← reordered permutations (default Z,X,Y etc.)
        const machines = [{ x: 600, y: 400, z: -120 }, { x: 600, y: 400, z: 500 }];
        const limitsV = [{ zMaxHome: true, xMinHome: true, yMinHome: true }, { zMinHome: true }, {}];
        let diffs = 0, first = null, combos = 0;
        for (const axes of sels) for (const machine of machines) for (const limits of limitsV) {
            combos++;
            // the twin reads config/machine/limits from CURRENT settings — set them to the combo, then emit
            window.__homingSettings = { machine, limits, homing: { axes: cfg } };
            window.ddcsGetSettings = () => window.__homingSettings;
            const twin = emitMapped(build({ axes, softLimits: true })).text;
            const builtin = emitMapped(homingStack({ axes, config: cfg, machine, limits, softLimits: true })).text;
            if (twin !== builtin) { diffs++; if (!first) { const tl = twin.split('\n'), bl = builtin.split('\n'); let i = 0; while (i < tl.length && tl[i] === bl[i]) i++; first = { axes, machine, limits, line: i, twin: tl.slice(i, i + 3), builtin: bl.slice(i, i + 3) }; } }
        }
        return { diffs, first, combos };
    });
    if (r.first) console.log('HOMING E1 DIFF ' + JSON.stringify(r.first));
    expect(r.combos, 'the sweep = 11 selections/permutations × 2 Z signs × 3 declared-home variants').toBe(66);
    expect(r.diffs, 'twin emit == homingStack for ALL combos incl. reordered permutations (byte-diff = ZERO)').toBe(0);
});

/**
 * t1900 — CROSS-DIALECT (t1896's own design opinion, dispatched): the E1 sweep above never varies the ACTIVE
 * DIALECT — it is the exact blind spot that let t1896's BROKEN `homing_data` row hide undetected. `homingStack`
 * reads the dialect at BUILD time (`getDialect()`), so this needs the dialect override cycling the FULL
 * registry BEFORE calling the builder — `emitMapped`'s own `{dialect}` option (the cheap way for a SAFE/
 * emit-time-only op) cannot reach a build-time read. A SMALL representative param set × every registered
 * dialect — not the full 66-combo sweep × 7, which would be the same blanket multiplier already rejected once.
 * t2137 — the live, user-facing override is retired; `__setDialectOverrideForTests` is the in-memory,
 * test-only replacement (wizards/dialects/index.js) — unreachable from any real UI.
 */
test('CROSS-DIALECT: user_homing_data == homingStack for EVERY registered dialect, not just the default (t1900)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { homingDataDef, HOMING_DEFAULTS } = await import('/blocks/dataOps/homingData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { homingStack } = await import('/wizards/homingWizard.js');
        const { __setDialectOverrideForTests, listPosts } = await import('/wizards/dialects/index.js');
        registerUserOp(homingDataDef());
        const build = builderOf('user_homing_data');
        const cfg = { x: { enable: true, backoff: 5, seekFeed: 800, slowFeed: 100 }, y: { enable: true, backoff: 5 }, z: { enable: true, backoff: 5 } };
        const reps = [{ axes: ['x', 'y', 'z'] }, { axes: ['z'] }];
        window.__homingSettings = { machine: { x: 600, y: 400, z: -120 }, limits: { zMaxHome: true, xMinHome: true, yMinHome: true }, homing: { axes: cfg } };
        window.ddcsGetSettings = () => window.__homingSettings;
        const dialects = listPosts().map((p) => p.id);
        let diffs = 0, first = null, combos = 0;
        for (const dialectId of dialects) {
            __setDialectOverrideForTests(dialectId);
            for (const p of reps) {
                combos++;
                const twin = emitMapped(build({ ...p, softLimits: true })).text;
                const builtin = emitMapped(homingStack({ ...p, config: cfg, machine: { x: 600, y: 400, z: -120 }, limits: { zMaxHome: true, xMinHome: true, yMinHome: true }, softLimits: true })).text;
                if (twin !== builtin) { diffs++; if (!first) first = { dialectId, p, twin: twin.slice(0, 400), builtin: builtin.slice(0, 400) }; }
            }
        }
        __setDialectOverrideForTests(null);
        return { diffs, first, combos, dialectCount: dialects.length };
    });
    if (r.first) console.log('HOMING XDIALECT DIFF ' + JSON.stringify(r.first));
    expect(r.dialectCount, 'sanity: 7 registered dialects').toBe(7);
    expect(r.combos, 'the sweep = 7 dialects × 2 representative axis-selections').toBe(14);
    expect(r.diffs, 'twin emit == homingStack for EVERY registered dialect (byte-diff = ZERO) — this is the check that would have caught t1896\'s BROKEN row').toBe(0);
});

test('E1: the twin emit TRACKS live settings — change the Z travel / flip a Home flag → the NEXT emit reflects it (no snapshot)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { homingDataDef } = await import('/blocks/dataOps/homingData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        registerUserOp(homingDataDef());
        const build = builderOf('user_homing_data');
        const cfg = { z: { enable: true, backoff: 5, seekFeed: 800, slowFeed: 100 } };
        const seekOf = (txt) => (txt.match(/G31 Z(-?[\d.]+)/) || [])[1];

        // start: Z travel -120, zMaxHome (declared TOP) → seek UP by |span|+20 = 140
        window.__s = { machine: { z: -120 }, limits: { zMaxHome: true }, homing: { axes: cfg } };
        window.ddcsGetSettings = () => window.__s;
        const a = emitMapped(build({ axes: ['z'], softLimits: true })).text;

        // change the Z TRAVEL to 600 → the NEXT emit seeks |600|+20 = 620 (tracked, not frozen at 140)
        window.__s = { machine: { z: 600 }, limits: { zMaxHome: true }, homing: { axes: cfg } };
        const b = emitMapped(build({ axes: ['z'], softLimits: true })).text;

        // flip the Home flag to zMinHome → the seek direction flips (now toward the min end)
        window.__s = { machine: { z: 600 }, limits: { zMinHome: true }, homing: { axes: cfg } };
        const c = emitMapped(build({ axes: ['z'], softLimits: true })).text;

        return { seekA: seekOf(a), seekB: seekOf(b), seekC: seekOf(c) };
    });
    expect(Number(r.seekA), 'start: Z=-120 zMaxHome → seek |120|+20 = 140 (UP toward the top)').toBe(140);
    expect(Number(r.seekB), 'changed Z travel to 600 → the NEXT emit seeks 620 (tracked live, not frozen at 140)').toBe(620);
    expect(Number(r.seekC), 'flipped to zMinHome → the seek direction flips (now -620 toward the min end)').toBe(-620);
});

/**
 * E2 — SUPERSEDED (t1898, was t550). The old ruling was: the emit operates on the OP'S OWN STORED STACK, so a
 * Blocks edit (an added/edited child atom) SURVIVES the settings recompose. t1896's census found the mechanism
 * that made that possible — a per-arm "does the fresh shape match the stored shape" check — was ALSO the exact
 * mechanism silently defeating `homingWizard.js`'s own explicit V4.1/DM500 safety refusal: the check was
 * VACUOUSLY TRUE whenever the live dialect's fresh build had no per-axis arms at all (the refusal path returns a
 * bare array, no `op` wrapper), so a template frozen under Expert kept re-emitting its OWN stored Expert arms
 * under V4.1 — confirmed live, WORK-LOG t1896/t1892's own #1300 finding is the same class. FIXED (t1898) by a
 * FULL RECOMPOSE, mirroring the atc_length/atc_check fix (t1894): `postInstantiate` rebuilds `root.children`
 * from `homingStack(...)` fresh every time, unconditionally. The trade-off, ACCEPTED and named, not accidental:
 * a Blocks-tab edit to an individual homing arm no longer survives a settings/dialect recompose — there IS no
 * "stored arm" to preserve an edit inside anymore. What survives unchanged from the old ruling: the seek values
 * still track live settings on every render (recompose reads them fresh each time either way).
 */
test('E2 SUPERSEDED: a Blocks edit does NOT survive the full recompose (t1898 — the trade-off for making the V4.1/DM500 refusal actually fire); the seek still tracks live settings', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { homingDataDef } = await import('/blocks/dataOps/homingData.js');
        const { registerUserOp } = await import('/blocks/userOps.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { flattenBlocks } = await import('/blocks/userOps.js');
        const def = homingDataDef();
        registerUserOp(def);
        const build = builderOf('user_homing_data');
        const cfg = { z: { enable: true, backoff: 5, seekFeed: 800, slowFeed: 100 } };

        // instantiate: Z travel -120, zMaxHome → seek |120|+20 = 140
        window.__s = { machine: { z: -120, x: 300, y: 300 }, limits: { zMaxHome: true }, homing: { axes: cfg } };
        window.ddcsGetSettings = () => window.__s;
        const stack = build({ axes: ['z'], softLimits: true });

        // MUTATE a child atom (as a Blocks edit would) — inject a user comment INSIDE the Z arm
        const op = flattenBlocks(stack).find((b) => b.type === 'op' && b.opType === 'homing');
        const zi = op.children.findIndex((b) => b.type === 'comment' && /^Home Z/.test((b.params && b.params.text) || ''));
        op.children.splice(zi + 1, 0, { type: 'comment', params: { text: 'USER BEEP - do not lose me' } });
        const emitBefore = emitMapped(stack).text;

        // settings change: Z travel -120 → 600 → the full recompose rebuilds from scratch, dropping the edit
        window.__s = { machine: { z: 600, x: 300, y: 300 }, limits: { zMaxHome: true }, homing: { axes: cfg } };
        const recomposed = def.postInstantiate(stack, { axes: ['z'], softLimits: true });
        const emitAfter = emitMapped(recomposed).text;

        const seek = (t) => (t.match(/G31 Z(-?[\d.]+)/) || [])[1];
        return { before: emitBefore, after: emitAfter, seekBefore: seek(emitBefore), seekAfter: seek(emitAfter) };
    });
    expect(r.before, 'the edit is present in the initial emit').toContain('USER BEEP - do not lose me');
    expect(r.after, 'the Blocks edit does NOT survive the full recompose — the named trade-off (t1898)').not.toContain('USER BEEP - do not lose me');
    expect(Number(r.seekBefore), 'initial: Z=-120 → seek 140').toBe(140);
    expect(Number(r.seekAfter), 'the seek still tracks the settings change (Z=600 → 620) — unaffected by the trade-off').toBe(620);
});
