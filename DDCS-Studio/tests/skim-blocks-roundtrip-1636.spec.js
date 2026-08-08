import { test, expect } from '@playwright/test';

/**
 * t1636 — a `skim` block (wizards/ops/skim.js, kind:'skim') had NO entry in bridge.js's DO-mouth kind lists
 * (the explicit OR-chain at line 260, nor the `isWrap` array line 70) — so it rendered in Blockly as a plain
 * statement block with no C-mouth to hold its children. Per guard.js's own t1595 history (the identical bug,
 * fixed there): a childless mouth means `recToJson` writes the block CHILDLESS and DISCARDS everything nested
 * inside it on render — here, the entire wrapped op (the raster's cutting body, or ANY op run in Skim Z-mode).
 *
 * User-reported symptom: authored a Surfacing (Skim) stack in Blocks, saved it, and the code preview showed
 * only 11 lines of frame — the whole cutting body missing, a valid no-op program that runs the spindle and
 * cuts nothing. Root cause confirmed by round-tripping the REAL surfacingStack(zMode:'skim') output through
 * the SAME stack<->workspace bridge the Blocks tab uses (stackToWorkspace / workspaceToStack) — the skim
 * block's children genuinely vanished pre-fix (measured: 66 lines -> 9, `skim.children` undefined).
 *
 * Fix: `isWrap` (blocks/blockly/bridge.js) — the ONE shared predicate both directions of the bridge gate on
 * (block-shape generation, record->workspace, AND workspace->record) — now includes 'skim' alongside the
 * other wrapper kinds (container/path/loop/cond/depth/fill/place/rotate). skim IS structurally that same
 * class: "a wrapper that runs the wrapped op" (skim.js's own doc comment).
 */
test('a skim-mode op survives the Blocks canvas round-trip byte-identical (not just 11 lines of frame)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.showApp);
    // Blockly (vendored UMD) loads lazily when the Blocks tab first mounts — same boot order a real user hits.
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws, { timeout: 8000 });

    const r = await page.evaluate(async () => {
        const { surfacingStack } = await import('/wizards/surfacingWizard.js');
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        const { workspaceToStack, stackToWorkspace } = await import('/blocks/blockly/stackBridge.js');

        const findSkim = (blocks) => {
            for (const b of blocks || []) { if (b && b.type === 'skim') return b; if (b && b.children) { const f = findSkim(b.children); if (f) return f; } }
            return null;
        };

        const stack = surfacingStack({ zMode: 'skim', w: 100, h: 80, toolDia: 12, depth: 0.5, stepdown: 0.5 });
        const before = emitMapped(stack).text;
        const skimBefore = findSkim(stack);

        const ws = new window.Blockly.Workspace();
        stackToWorkspace(stack, ws);
        const roundTripped = workspaceToStack(ws);
        const after = emitMapped(roundTripped).text;
        const skimAfter = findSkim(roundTripped);

        return {
            before, after,
            skimChildrenBefore: (skimBefore && skimBefore.children && skimBefore.children.length) || 0,
            skimChildrenAfter: (skimAfter && skimAfter.children && skimAfter.children.length) || 0,
        };
    });

    expect(r.skimChildrenBefore, 'the built stack itself carries the wrapped raster (sanity)').toBeGreaterThan(0);
    expect(r.skimChildrenAfter, 'the skim block still carries its children AFTER the Blocks canvas round-trip').toBe(r.skimChildrenBefore);
    expect(r.after, 'the round-tripped emit is byte-identical to the pre-round-trip emit').toBe(r.before);
    // The pre-fix symptom named exactly: a frame with no cutting body at all.
    expect(r.after, 'the raster cutting body (WHILE/G1 rows) survives the round-trip').toMatch(/WHILE \[#48/);
});
