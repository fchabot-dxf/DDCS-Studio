import { test, expect } from '@playwright/test';

/**
 * t1664 (ruled) — THE CORNER WALL. Corner's Customize surface builds ~1852 Blockly blocks (371 guards fully
 * rendering both structural arms, per t1595) and takes ~5.2-5.4s to settle — a friendliness defect wearing a
 * perf costume, on a project whose stated priority is friendliness/customization FIRST.
 *
 * MEASURED (this turn, same methodology both times — the established `customize()` settle-loop):
 *   BEFORE: blockCount 1852, msToFirstBlocks ~3820, msToSettle ~5400
 *   AFTER:  blockCount 1852, msToFirstBlocks ~3753, msToSettle ~5179   (~4% wall-clock reduction)
 *
 * ⚠ NAMED SUSPECT, MEASURED CAUSE: the block COUNT does not change (collapsed blocks are still fully
 * INSTANTIATED by Blockly's deserializer — `stackToWorkspace` costs ~1.45s whether or not guard blocks carry
 * `collapsed:true`). Profiled `editWizardDef`'s own phases: `reconstructUserOpBlock` ~3ms, `stackToWorkspace`
 * ~1.45s (the single largest identified synchronous cost), `workspaceToStack` ~3ms, an `applyOpGating`-shaped
 * loop over all 1852 blocks ~13ms, `emitMapped` ~41ms. None of the JS-side conversion steps explain the full
 * observed wall-clock — the remainder is Blockly's own internal SVG/layout rendering, which the native
 * `collapsed` flag changes the VISUAL TREATMENT of but does not skip instantiating. A real wall-clock fix
 * needs collapsed subtrees NOT INSTANTIATED at all (lazy/deferred materialization on first expand) — a
 * materially bigger architectural change than "set a flag," reported here as a recommendation, not built,
 * per rule 4 (no new affordances beyond what collapsing requires).
 *
 * WHAT THIS ACT DELIVERS: the ruled direction itself (collapse by default), real and verified — every guard
 * block on a fresh Customize open starts collapsed; nothing is hidden (one click expands, full content
 * present); Corner's emitted G-code is byte-identical (a rendering-only change, `collapsed` is a Blockly UI
 * property with no semantic reading anywhere in the emit path).
 */

const bootRegistry = async (page) => {
    await page.goto('/', { timeout: 60000 });
    // t2351 — the app's own declared "everything is wired" signal (t1279), not a hand-picked global subset —
    // see wizard-face-1599's own boot() for the full trace of why this class of wait was silently racy.
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 60000 });
};
const boot = async (page) => {
    await bootRegistry(page);
    await page.evaluate(() => window.showApp && window.showApp('blocks'));
    await page.waitForFunction(() => !!window.__blkws, null, { timeout: 60000 });
};
const customize = async (page, opType) => {
    await page.evaluate(() => window.ddcsLoadBlockStack([]));
    await page.evaluate((x) => window.ddcsEditWizardDef(x), opType);
    await page.waitForFunction(() => {
        const op = (window.ddcsGetBlockProgram() || []).find((b) => b && b.type === 'op');
        return !!(op && (op.children || []).length) && window.__blkws.getAllBlocks().length > 0;
    }, null, { timeout: 60000 });
    let last = -1;
    for (let i = 0; i < 120; i++) {
        const n = await page.evaluate(() => window.__blkws.getAllBlocks().length);
        if (n === last && n > 0) return;
        last = n;
        await page.waitForTimeout(250);
    }
};

test('MEASURED: opening Corner starts every guard block collapsed by default', async ({ page }) => {
    test.setTimeout(60000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    await customize(page, 'user_corner_data');
    const r = await page.evaluate(() => {
        const guards = window.__blkws.getAllBlocks(false).filter((b) => b.type === 'guard');
        const collapsedCount = guards.filter((b) => b.isCollapsed && b.isCollapsed()).length;
        return { guardCount: guards.length, collapsedCount, totalBlocks: window.__blkws.getAllBlocks().length };
    });
    expect(r.guardCount, 'Corner really does have a substantial number of guard blocks').toBeGreaterThan(300);
    expect(r.collapsedCount, 'EVERY guard block starts collapsed on a fresh Customize open').toBe(r.guardCount);
});

test('NOTHING IS HIDDEN: expanding a collapsed guard reveals its full field + child content', async ({ page }) => {
    test.setTimeout(60000);
    page.on('dialog', (d) => d.accept());
    await boot(page);
    await customize(page, 'user_corner_data');

    const before = await page.evaluate(() => {
        const g = window.__blkws.getAllBlocks(false).find((b) => b.type === 'guard');
        return { id: g.id, collapsed: g.isCollapsed(), childCount: (g.getChildren ? g.getChildren(false) : []).length };
    });
    expect(before.collapsed, 'starts collapsed').toBe(true);

    const after = await page.evaluate((id) => {
        const g = window.__blkws.getBlockById(id);
        g.setCollapsed(false);   // the real expand gesture (a user click toggles the SAME API)
        return { collapsed: g.isCollapsed(), childCount: (g.getChildren ? g.getChildren(false) : []).length };
    }, before.id);
    expect(after.collapsed, 'expands on request').toBe(false);
    expect(after.childCount, 'expanding reveals the SAME children that were always there — nothing was dropped by collapsing').toBe(before.childCount);
    expect(after.childCount, 'a guard with a structural arm really does have children to reveal').toBeGreaterThan(0);
});

test('BYTE-IDENTICAL EMIT: collapsing is rendering-only — Corner emits the exact same program whether guards start collapsed or not', async ({ page }) => {
    await bootRegistry(page);
    const r = await page.evaluate(async () => {
        const DM = await import('/blocks/devMode.js');
        const BE = await import('/blocks/blockEmitter.js');
        const { childrenOf } = await import('/blocks/userOps.js');
        const rec = await DM.reconstructUserOpBlock('user_corner_data');   // collapsed:true is now set on its guards
        const collapsedEmit = BE.emitMapped([rec.opC], {}).text;

        // the SAME op, with collapsed forced OFF everywhere — the counterfactual "as if this act never shipped"
        // t2631 — childrenOf (not a bare `.forEach`), same ARCHITECTURE.md INVARIANT #18 fix drill's own header
        // documents: `children`/`uiChildren` can be a mouth-keyed {LEFT,RIGHT} object, not always an array —
        // corner's own split_horizontal (new this migration) is what first exercises this helper against one.
        const strip = (b) => { if (!b) return; delete b.collapsed; childrenOf(b.children).forEach(strip); childrenOf(b.uiChildren).forEach(strip); };
        strip(rec.opC);
        const uncollapsedEmit = BE.emitMapped([rec.opC], {}).text;

        return { same: collapsedEmit === uncollapsedEmit, len: collapsedEmit.length };
    });
    expect(r.same, 'collapsed vs uncollapsed emit byte-for-byte identical text').toBe(true);
    expect(r.len, 'sanity: a real, substantial program was actually compared').toBeGreaterThan(1000);
});
