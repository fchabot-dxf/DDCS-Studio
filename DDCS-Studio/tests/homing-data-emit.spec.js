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
 * E2 M2 RULING (t550) — the emit operates on the OP'S OWN STORED STACK: a Blocks edit (an added/edited child atom) SURVIVES
 * the settings recompose, AND the settings-dependent values still track a settings change. The recompose UNROLLS/VALUE-SWAPS
 * in place — it never regenerates arms in a way that discards the edit. (This is the north-star gate the rebuild shape was
 * approved against.)
 */
test('E2 ruling: a Blocks edit SURVIVES the settings recompose (in-place on the stored stack) + the seek still tracks settings', async ({ page }) => {
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

        // settings change: Z travel -120 → 600 → the recompose (on the STORED, EDITED stack) must UPDATE the seek AND KEEP the edit
        window.__s = { machine: { z: 600, x: 300, y: 300 }, limits: { zMaxHome: true }, homing: { axes: cfg } };
        const recomposed = def.postInstantiate(stack, { axes: ['z'], softLimits: true });
        const emitAfter = emitMapped(recomposed).text;

        const seek = (t) => (t.match(/G31 Z(-?[\d.]+)/) || [])[1];
        return { before: emitBefore, after: emitAfter, seekBefore: seek(emitBefore), seekAfter: seek(emitAfter) };
    });
    expect(r.before, 'the edit is present in the initial emit').toContain('USER BEEP - do not lose me');
    expect(r.after, 'the Blocks edit SURVIVES the settings recompose (the emit is on the stored stack, not a rebuild)').toContain('USER BEEP - do not lose me');
    expect(Number(r.seekBefore), 'initial: Z=-120 → seek 140').toBe(140);
    expect(Number(r.seekAfter), 'after the edit: the seek STILL tracks the settings change (Z=600 → 620)').toBe(620);
});
