import { test, expect } from '@playwright/test';

/**
 * t2393 (BACKLOG #48 item 2) — THE t1520 IRON RULE: a Blockly dropdown must offer its field's FULL declared
 * domain, or an out-of-list value is silently REWRITTEN to option[0] the moment a block loads — confirmed
 * live before this fix (see WORK-LOG t2393): a `layout` block's `KIND` field, deserialized from a state
 * carrying `'drill'` (one of `LAYOUT_TYPES`' 14 declared kinds — panelTypes.js), came back `'none'`; a `panel`
 * block's `PANEL` field, deserialized from `'commscreen'` (one of `PANEL_TYPES`' 5 declared panels), came back
 * `'form3d'`. Both are REAL wizard-authoring values (`def.layout`/`def.panel`), not hypotheticals — any wizard
 * whose canvas round-trips through Blockly with either set to a non-offered value silently loses it.
 *
 * This spec pins the domain agreement structurally (in-browser — bridge.js's own import chain carries
 * top-level browser-only side effects, so these checks run via `page.evaluate`, not a Node-side static
 * import) — `bridge.js`'s dropdown for each field must equal (as a SET) the declaring table's own keys, so a
 * THIRD kind/panel added to `panelTypes.js` without updating the dropdown fails this test immediately, rather
 * than silently reopening the same class of data loss.
 */

test('layout.kind dropdown offers every LAYOUT_TYPES key', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    const { offered, declared } = await page.evaluate(async () => {
        const { LAYOUT_TYPES } = await import('/wizards/ops/panelTypes.js');
        const { fieldOptions } = await import('/blocks/blockly/bridge.js');
        const { layoutBlock } = await import('/wizards/ops/layout.js');
        return { offered: fieldOptions(layoutBlock, 'kind').map((o) => (Array.isArray(o) ? o[1] : o)), declared: Object.keys(LAYOUT_TYPES) };
    });
    expect(new Set(offered)).toEqual(new Set(declared));
});

test('panel.panel dropdown offers every PANEL_TYPES key (including commscreen)', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    const { offered, declared } = await page.evaluate(async () => {
        const { PANEL_TYPES } = await import('/wizards/ops/panelTypes.js');
        const { fieldOptions } = await import('/blocks/blockly/bridge.js');
        const { panelBlock } = await import('/wizards/ops/panel.js');
        return { offered: fieldOptions(panelBlock, 'panel').map((o) => (Array.isArray(o) ? o[1] : o)), declared: Object.keys(PANEL_TYPES) };
    });
    expect(new Set(offered)).toEqual(new Set(declared));
    expect(offered).toContain('commscreen');
});

test('flip.axis dropdown is narrowed to X/Y only — Z/A/B/C are offered but flip cannot mean them', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1');
    const offered = await page.evaluate(async () => {
        const { fieldOptions } = await import('/blocks/blockly/bridge.js');
        const { flipBlock } = await import('/wizards/ops/transform.js');
        return fieldOptions(flipBlock, 'axis').map((o) => (Array.isArray(o) ? o[1] : o));
    });
    expect(new Set(offered)).toEqual(new Set(['X', 'Y']));
});

test('LIVE: a layout block loaded with kind=drill (a real LAYOUT_TYPES value) round-trips intact, not silently coerced to none', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.showApp);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    const kind = await page.evaluate(() => {
        const ws = window.__blkws;
        const blk = window.Blockly.serialization.blocks.append({ type: 'layout', fields: { KIND: 'drill' } }, ws);
        const v = blk.getFieldValue('KIND');
        blk.dispose();
        return v;
    });
    expect(kind).toBe('drill');
});

test('LIVE: a panel block loaded with panel=commscreen round-trips intact, not silently coerced to form3d', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.showApp);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws);
    const panel = await page.evaluate(() => {
        const ws = window.__blkws;
        const blk = window.Blockly.serialization.blocks.append({ type: 'panel', fields: { PANEL: 'commscreen' } }, ws);
        const v = blk.getFieldValue('PANEL');
        blk.dispose();
        return v;
    });
    expect(panel).toBe('commscreen');
});
