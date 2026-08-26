import { test, expect } from '@playwright/test';

/**
 * t2307 (BACKLOG #23) — REFUSE disabling a CHILD block inside a parametric op, because its state was never
 * going to survive an export/reimport in the first place: `opFromMarker` regenerates a parametric op's
 * children from its own params (confirmed by direct reproduction, WORK-LOG t2307), and `serializeWithMarkers`
 * doesn't even WRITE a child's disabled state into the exported marker to begin with — only the whole-op
 * flag rides it. The owner's own ruling: "silently accepting a disable it cannot keep is the worst of the
 * three options" — so this REFUSES the gesture rather than letting the doomed state form at all.
 *
 * Real gesture, not a synthetic call: `setDisabledReason(true, 'MANUALLY_DISABLED')` on the live block is
 * exactly what Blockly's own native "Disable Block" context-menu item does internally (confirmed by reading
 * blockly.min.js directly) — the guard listens for the SAME `BLOCK_CHANGE`/`element:'disabled'` event either
 * gesture fires, so driving it this way exercises the real listener, not a shortcut around it.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

// t2307-own finding: window.showApp is assigned via an async `import(...).then(...)` chain in app.js, LATER than
// window.ddcsGetBlockProgram/ddcsLoadBlockStack (set synchronously inside programModel.js's own top-level code).
// Gating on ddcsLoadBlockStack let this wait resolve BEFORE window.showApp existed, so `window.showApp && …`
// silently no-op'd (no throw, no console line — confirmed live by instrumenting buildWorkspace() directly: it
// was never entered at all) and the next wait then spun out its full budget waiting for a build that never
// started. save-dialog-declared-1615.spec.js's own boot() avoids this by gating on ddcsEditWizardDef instead —
// same async chain as showApp itself (both land via devMode.js's own dynamic import), so by the time it's
// truthy, showApp is guaranteed to exist too. Mirrored here rather than re-deriving a second gate.
const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsEditWizardDef, null, { timeout: 20000 });
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 100000 });
};

test('a CHILD disabled inside a parametric op (drill) is immediately re-enabled, with a toast explaining why', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate(() => window.ddcsEditWizardDef('user_drill_data'));
    await page.waitForTimeout(500);

    // Blockly's own event dispatch is QUEUED, not synchronous (confirmed live: instrumenting the guard's listener
    // showed the revert's own `disabled:false` BLOCK_CHANGE landing on a LATER tick, after a `viewport_change` in
    // between) — so the disable call and the read-back must be two separate evaluate()s with a real wait between
    // them, or the read-back races the guard's own listener and always sees the pre-revert state.
    const childId = await page.evaluate(() => {
        const ws = window.__blkws;
        const opBlk = ws.getAllBlocks(false).find((b) => b.type === 'op');
        if (!opBlk) return { error: 'no op block found' };
        // any CHILD of the op — not the op container itself
        const child = ws.getAllBlocks(false).find((b) => b.id !== opBlk.id && b.getSurroundParent && (() => {
            let p = b.getSurroundParent();
            while (p && p.type !== 'op') p = p.getSurroundParent();
            return p && p.id === opBlk.id;
        })());
        if (!child) return { error: 'no child block found inside the op' };
        child.setDisabledReason(true, 'MANUALLY_DISABLED');
        return { id: child.id, childType: child.type };
    });
    expect(childId.error, 'a real drill op with a real child was found').toBeUndefined();

    await page.waitForFunction((id) => {
        const blk = window.__blkws.getBlockById(id);
        return blk && !blk.hasDisabledReason('MANUALLY_DISABLED');
    }, childId.id, { timeout: 5000 });
    const disabledAfter = await page.evaluate((id) => window.__blkws.getBlockById(id).hasDisabledReason('MANUALLY_DISABLED'), childId.id);
    expect(disabledAfter, 'the guard reverted the disable — the child reads back ENABLED').toBe(false);

    await expect(page.locator('.toast.bad')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.toast.bad')).toContainText(/won.t survive export\/reimport/);
});

test('CONTROL — disabling the WHOLE OP (not a child) is left alone, matching "round-trips correctly, not in scope"', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate(() => window.ddcsEditWizardDef('user_drill_data'));
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
        const ws = window.__blkws;
        const opBlk = ws.getAllBlocks(false).find((b) => b.type === 'op');
        if (!opBlk) return { error: 'no op block found' };
        opBlk.setDisabledReason(true, 'MANUALLY_DISABLED');
        return { disabledAfter: opBlk.hasDisabledReason('MANUALLY_DISABLED') };
    });
    expect(r.error).toBeUndefined();
    expect(r.disabledAfter, 'a whole-op disable is untouched by the guard').toBe(true);
    await expect(page.locator('.toast.bad')).toHaveCount(0);
});

test('CONTROL — a child inside a HAND-BUILT (non-generator) stack is left alone', async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await page.evaluate(() => window.ddcsLoadBlockStack([
        { type: 'move', params: { x: 10, y: 20, z: -2, mode: 'rapid' } },
        { type: 'spindle', params: { rpm: 12000, on: true } },
    ]));
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
        const ws = window.__blkws;
        const blk = ws.getAllBlocks(false).find((b) => b.type === 'spindle');
        if (!blk) return { error: 'no spindle block found' };
        blk.setDisabledReason(true, 'MANUALLY_DISABLED');
        return { disabledAfter: blk.hasDisabledReason('MANUALLY_DISABLED') };
    });
    expect(r.error).toBeUndefined();
    expect(r.disabledAfter, 'a bare atom outside any op is untouched by the guard').toBe(true);
    await expect(page.locator('.toast.bad')).toHaveCount(0);
});
