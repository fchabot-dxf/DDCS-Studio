import { test, expect } from '@playwright/test';

/**
 * t2661 — closing t2639's gap 4: user_root's PRESENTATION and EXECUTION mouths sat close enough that a bad
 * drop could land ambiguously near BOTH, connecting silently in the wrong one. MEASURED, not assumed: at the
 * app's own default zoom (0.9), the two mouths sat 47.7px apart against Blockly's own 28px snapRadius
 * (25.2px effective at that scale) — a narrow ~2.7px overlap band (any two catch-radii overlap once their
 * centres sit closer than 2x the radius, 50.4px here). Fixed with a blank spacer row — Blockly's OWN
 * input_dummy mechanism, the SAME one the mouths' own sub-labels already use — never a Blockly-core change,
 * scoped to user_root alone.
 */
test('user_root: PRESENTATION and EXECUTION sit past 2x the snap radius apart — no ambiguous drop zone', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);

    const info = await page.evaluate(() => {
        const ws = window.__blkws;
        const Blockly = window.Blockly;
        window.Blockly.serialization.blocks.append({ type: 'user_root' }, ws);
        const blk = ws.getAllBlocks(false).find((b) => b.type === 'user_root');
        const scale = ws.scale;
        const rect = blk.getSvgRoot().getBoundingClientRect();
        const at = {};
        for (const inp of blk.inputList) {
            if (!inp.connection) continue;
            const off = inp.connection.getOffsetInBlock();
            at[inp.name] = { x: rect.left + off.x * scale, y: rect.top + off.y * scale };
        }
        return { scale, snapRadius: Blockly.config.snapRadius, presentation: at.PRESENTATION, execution: at.EXECUTION };
    });
    expect(info.presentation && info.execution, 'both mouths resolve to real connections').toBeTruthy();

    const pxDist = Math.hypot(info.presentation.x - info.execution.x, info.presentation.y - info.execution.y);
    const effectiveRadius = info.snapRadius * info.scale;
    expect(pxDist, `mouth distance (${pxDist}px) must clear 2x the effective snap radius (${2 * effectiveRadius}px) — no drop point can be in range of both`)
        .toBeGreaterThan(2 * effectiveRadius);
});
