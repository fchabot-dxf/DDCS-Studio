import { test, expect } from '@playwright/test';

/**
 * t1900 — CROSS-DIALECT for `user_lathe_parting` (safe-by-absence-today, t1896's own flag: `parting.js` has no
 * build-time dialect read currently, so this can only ever catch a FUTURE branch introduced without updating the
 * value-only `applyPartHeader` postInstantiate — the exact state homing_data was in before someone added one).
 * No PRE-EXISTING byte-identical spec covered this op at all; this is the minimal one, mirroring the same
 * cheap pattern (`emitMapped`'s own `{dialect}` option — no setActivePostId/reload needed for a SAFE,
 * emit-time-only op) already applied to pocket/rotaryCenter/rotaryClock/slot this same turn.
 */
test('CROSS-DIALECT: user_lathe_parting == partingStack for EVERY registered dialect, both kinds (t1900)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram);
    const r = await page.evaluate(async () => {
        const { partingStack, PART_DEFAULTS } = await import('/wizards/lathe/parting.js');
        const { PART_DATA_OPTYPE } = await import('/blocks/dataOps/partingData.js');
        const { builderOf } = await import('/blocks/opBuilders.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { resolveActivePost, listPosts } = await import('/wizards/dialects/index.js');
        const build = builderOf(PART_DATA_OPTYPE);
        const reps = [PART_DEFAULTS, { ...PART_DEFAULTS, kind: 'groove', floorDiameter: 12 }];
        const dialects = listPosts().map((p) => p.id);
        let diffs = 0, first = null, combos = 0;
        for (const dialectId of dialects) {
            const post = resolveActivePost(dialectId);
            for (const p of reps) {
                combos++;
                const twin = emitMapped(build(p), post).text;
                const builtin = emitMapped(partingStack(p), post).text;
                if (twin !== builtin) { diffs++; if (!first) first = { dialectId, kind: p.kind, twin: twin.slice(0, 600), builtin: builtin.slice(0, 600) }; }
            }
        }
        return { diffs, first, combos, dialectCount: dialects.length, registered: !!build };
    });
    if (r.first) console.log('PARTING XDIALECT DIFF ' + JSON.stringify(r.first));
    expect(r.registered, 'the twin is seeded/registered on boot').toBe(true);
    expect(r.dialectCount, 'sanity: 7 registered dialects').toBe(7);
    expect(r.combos, 'the sweep = 7 dialects × 2 representative kinds (part/groove)').toBe(14);
    expect(r.diffs, 'twin emit == partingStack for EVERY registered dialect, both kinds (byte-diff = ZERO)').toBe(0);
});
