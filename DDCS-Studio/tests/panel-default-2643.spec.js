import { test, expect } from '@playwright/test';

/**
 * t2643 (BACKLOG #71/#72) — THE t2639 DEAD END, ROOT-CAUSED AND FIXED: t2639 built a real, hand-authored
 * feature_canvas+point_handle wizard through the Blocks UI and got a completely empty (black) visualization
 * pane with zero rendered handles. Root-caused live, not reasoned:
 *
 *  1. `feature_canvas`'s own PANEL field (bridge.js's jsonDef) is a plain Blockly `field_dropdown` — its
 *     built-in `fromJson` has NO initial-value property at all; a fresh block ALWAYS gets `options[0]`,
 *     regardless of the block's own declared `defaults.panel`. PANEL_TYPES' own key order (panelTypes.js) put
 *     `'form'` (viz:false — hides the WHOLE `.wiz-visual` pane) first, so every freshly-dragged feature_canvas
 *     silently got the one option that renders nothing at all.
 *  2. The Save dialog's own "is a panel already declared" prefill (devMode.js's `blkPanel`, ~line 974) scans
 *     `flattenBlocks(a.opRec.children)` — the EXECUTION tree only — never `uiChildren`, where a `feature_canvas`
 *     actually lives. So for a canvas+handle wizard it ALWAYS treats the panel as undeclared and shows the
 *     dropdown (defaulting to its own first `<option>`, 'form3d') — a separate, real but lower-severity
 *     confusion this turn did NOT fix (named below), because `registerUserOp`'s own self-heal
 *     (`resolvePanelMeta` -> `panelFromStack`, userOps.js) correctly re-derives `def.panel` from the TRUE
 *     uiChildren-nested feature_canvas at registration time regardless of what the dialog committed — so the
 *     dialog's own wrong prefill is cosmetically confusing but not a data-loss bug.
 *
 * Fix (contained, bridge.js's jsonDef dropdown branch + featureCanvas.js's own default): reorder JUST this
 * field's own options so its declared default (now 'form2d' — feature_canvas's actual purpose, "the 2D-capable
 * half" paired with preview3d; measured: 31 of 32 shipped ops already set it explicitly) sorts first. The
 * GENERAL defect (no dropdown-kind field on any block ever honours `def.defaults[f]`, only option order does)
 * is named in bridge.js's own comment, not generally fixed — an unmeasured, registry-wide blast radius, exactly
 * the class of mistake t2641's own Part B got burned by.
 */
test('a freshly-dragged feature_canvas defaults its own PANEL field to form2d, not the viz-hiding form', async ({ page }) => {
    async function searchFor(text) {
        const s = page.locator('.blk-search');
        await s.click(); await s.fill(''); await s.fill(text);
        await page.waitForTimeout(250);
    }
    async function flyoutBlockCenter(type) {
        return page.evaluate((t) => {
            const ws = window.__blkws;
            const fws = ws.getToolbox().getFlyout().getWorkspace();
            const blk = fws.getAllBlocks().find((b) => b.type === t);
            const root = blk.getSvgRoot();
            const target = root.querySelector('text.blocklyText, .blocklyText') || root;
            const rect = target.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        }, type);
    }
    async function dragFlyoutBlockTo(type, targetPt) {
        const grab = await flyoutBlockCenter(type);
        await page.mouse.move(grab.x, grab.y);
        await page.mouse.down();
        await page.waitForTimeout(80);
        await page.mouse.move(grab.x + 30, grab.y + 20, { steps: 5 });
        await page.mouse.move(targetPt.x, targetPt.y, { steps: 20 });
        await page.waitForTimeout(80);
        await page.mouse.up();
        await page.waitForTimeout(300);
    }
    async function mouthPoint(blockType, inputName) {
        return page.evaluate(({ blockType, inputName }) => {
            const ws = window.__blkws;
            const blk = ws.getAllBlocks(false).find((b) => b.type === blockType);
            const inp = blk.inputList.find((i) => i.name === inputName);
            const off = inp.connection.getOffsetInBlock();
            const rect = blk.getSvgRoot().getBoundingClientRect();
            return { x: rect.left + off.x * ws.scale, y: rect.top + off.y * ws.scale };
        }, { blockType, inputName });
    }

    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.showApp && window.ddcsStudio);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    await page.waitForTimeout(300);

    await searchFor('Define Custom Wizard');
    await dragFlyoutBlockTo('user_root', { x: 1200, y: 200 });
    const presMouth = await mouthPoint('user_root', 'PRESENTATION');
    await searchFor('feature canvas');
    await dragFlyoutBlockTo('feature_canvas', presMouth);

    const freshPanel = await page.evaluate(() => window.__blkws.getAllBlocks(false).find((b) => b.type === 'feature_canvas').getFieldValue('PANEL'));
    expect(freshPanel, 'a freshly-dragged feature_canvas now serializes form2d — a real 2D canvas, where handle blocks actually render — never having touched its own PANEL dropdown').toBe('form2d');

    // every OTHER panel option must still be reachable (reordering, not narrowing, the field's own options)
    const allOptions = await page.evaluate(() => {
        const b = window.__blkws.getAllBlocks(false).find((x) => x.type === 'feature_canvas');
        return b.getField('PANEL').getOptions().map((o) => o[1]);
    });
    expect(allOptions.sort(), 'reordering only — every panel kind stays offered').toEqual(['commscreen', 'form', 'form2d', 'form3d', 'form3d+2d']);
});
