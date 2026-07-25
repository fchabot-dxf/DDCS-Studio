import { test, expect } from '@playwright/test';

/**
 * S4-3 — the explicit slot-Update ROUND-TRIP. After S4-2, Editing a universal slot loads its op into Blocks. When the
 * user edits the op there and SAVES the def (updateUserOp → defV++), every CAM slot referencing that op is defVStale →
 * it rebuilds from the NEW def (buildSlotFromOps re-reads getUserDef → fields/body/emit re-derived), preserving the
 * manifest exposed/baked/values overlay and dropping any orphaned overlay keys. The def is the ONE source — no
 * Blocks→slot converter. Wired via a decoupled ddcs:userops-changed event (fired by updateUserOp).
 */
test.use({ viewport: { width: 1280, height: 900 } });

const MOVE_DEPTH = { type: 'move', params: { x: 0, y: 0, z: { type: 'param', params: { name: 'depth', value: -5 } } } };

test('saving a universal op def (defV++) rebuilds the referencing CAM slot from the new def — emit reflects the change', async ({ page }) => {
    await page.goto('http://localhost:3211');
    const reg = await page.evaluate(async (mv) => {
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        U.createUserOp(U.userOpFromStack('univ', 'My Universal', [mv], U.extractParamBlocks([mv])));   // v1
        // a slot referencing it, with a PLACEHOLDER body so a rebuild is observable, op.defV = 1 (matches v1 → not stale yet)
        localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 't', baseSlot: 22 }, slots: [
            { slot: 22, name: 'Custom', body: 'PLACEHOLDER', fields: [], ops: [{ type: 'universal', variant: '', values: {}, exposed: {}, baked: {}, opType: 'user_univ', defV: 1 }] },
        ] }));
        return { v: U.defVOf('user_univ') };
    }, MOVE_DEPTH);
    expect(reg.v, 'v1 registered at defV 1').toBe(1);
    await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); });   // registers the round-trip listener
    await page.waitForFunction(() => window.showApp);

    // SAVE a CHANGED def — adds a second move to X88.5 (this is exactly what the Blocks Save calls: updateUserOp). defV → 2.
    const after = await page.evaluate(async (mv) => {
        const U = await import('/blocks/userOps.js');
        const v2 = [mv, { type: 'move', params: { x: 88.5, y: 0, z: 0 } }];
        U.updateUserOp(U.userOpFromStack('univ', 'My Universal', v2, U.extractParamBlocks(v2)));
        await new Promise((r) => setTimeout(r, 100));   // let the (sync) event handler rebuild + persist
        const slot = JSON.parse(localStorage.getItem('ddcs_campack')).slots[0];
        return { defV: U.defVOf('user_univ'), slotOpDefV: slot.ops[0].defV, body: slot.body || '' };
    }, MOVE_DEPTH);
    expect(after.defV, 'the def bumped to v2 on save').toBe(2);
    expect(after.slotOpDefV, 'the slot op was re-stamped to the new defV (no longer stale)').toBe(2);
    expect(after.body, 'the slot was REBUILT, not left at the placeholder').not.toBe('PLACEHOLDER');
    expect(after.body.includes('88.5'), 'the rebuilt slot macro reflects the new def (the added move to X88.5): ' + after.body).toBe(true);

    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});

test('the rebuild reconciles the overlay: an ORPHAN key (no longer a field) is dropped; the op is re-stamped', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.evaluate(async (mv) => {
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        U.createUserOp(U.userOpFromStack('univ', 'My Universal', [mv], U.extractParamBlocks([mv])));
        // op.defV = 0 (stale for any curV>0) so the very next def-save rebuilds it; overlay carries a BOGUS orphan key
        localStorage.setItem('ddcs_campack', JSON.stringify({ meta: { name: 't', baseSlot: 22 }, slots: [
            { slot: 22, name: 'Custom', body: 'X', fields: [], ops: [{ type: 'universal', variant: '', values: { bogus_orphan: { def: 99 } }, exposed: { bogus_orphan: true }, baked: {}, opType: 'user_univ', defV: 0 }] },
        ] }));
    }, MOVE_DEPTH);
    await page.evaluate(async () => { (await import('/ui/macrosApp.js')).initMacrosApp(); });
    await page.waitForFunction(() => window.showApp);

    const after = await page.evaluate(async (mv) => {
        const U = await import('/blocks/userOps.js');
        U.updateUserOp(U.userOpFromStack('univ', 'My Universal', [mv], U.extractParamBlocks([mv])));   // defV 1 → 2; slot at defV 0 is stale
        await new Promise((r) => setTimeout(r, 100));
        const op = JSON.parse(localStorage.getItem('ddcs_campack')).slots[0].ops[0];
        return { defV: op.defV, valuesKeys: Object.keys(op.values || {}), exposedKeys: Object.keys(op.exposed || {}) };
    }, MOVE_DEPTH);
    expect(after.defV, 'the stale slot op was re-stamped to the current defV').toBe(2);
    expect(after.valuesKeys.includes('bogus_orphan'), 'the orphan key was dropped from values (intersect + drop)').toBe(false);
    expect(after.exposedKeys.includes('bogus_orphan'), 'the orphan key was dropped from exposed').toBe(false);

    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops'));
});
