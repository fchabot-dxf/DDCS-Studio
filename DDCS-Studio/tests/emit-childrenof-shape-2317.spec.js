import { test, expect } from '@playwright/test';

/**
 * t2317 (THE FLIP, retry) — attempting the actual flip surfaced a FOURTH+ wave of consumers sharing t2313's own
 * bug pattern, all in blockEmitter.js's own internal walkers (reached only through the exported `emitMapped`):
 * `uniquifyFlowLabels`, `findEntryBlock` (via `applyEntryWaypoint`), `hasSkimFold`, `collectDisabledIds`,
 * `collectComments`, `liveExtent`, and `placeShiftOfStack`'s own walk — plus `devMode.js`'s
 * `collapseGuardsByDefault` (a `.forEach` variant of the same bug t2315's `for...of` sweep didn't catch),
 * `wizards/ops/panelTypes.js`'s own independent `_flattenStack`, `blocks/blockly/tokenGuard.js`'s `collect`,
 * and `blocksApp.js`'s `checkLayoutNodes` (already-correct but a fourth independent copy of the same idea).
 * All now share `childrenOf` (userOps.js, t2315). The flip itself (drillData.js) was reverted after finding a
 * genuine resurfacing of t2293/BACKLOG #21 — see WORK-LOG t2317 — but the machinery fixes here are independent
 * of that and stand on their own: real crashes, now fixed, regardless of whether/when the flip itself ships.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => !!window.ddcsGetBlockProgram, null, { timeout: 20000 });
};

const splitTree = () => ([{
    type: 'split_horizontal', params: { ratio: '360px:*' },
    children: {
        LEFT: [{ type: 'param_group', params: { group: 'X' }, children: [{ type: 'field_ref', params: { param: 'a' } }] }],
        RIGHT: [{ type: 'sim', params: {} }],
    },
}]);

test('emitMapped: does not throw when an op\'s uiChildren carries a split_horizontal node', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (tree) => {
        const { emitMapped } = await import('/blocks/blockEmitter.js');
        // a minimal real op stack (progstart/progend) with the split node riding uiChildren, exactly where
        // emitMapped's own uniquifyFlowLabels/collectDisabledIds/collectComments/findEntryBlock/hasSkimFold
        // all independently recurse.
        const op = { id: 'op1', type: 'op', opType: 'drill', params: {}, uiChildren: tree, children: [
            { type: 'progstart', params: { rpm: 0, dir: 'cw', spinUp: 0, clearance: 5, skim: false } },
            { type: 'progend', params: { coolantOff: true, retract: true, retractZ: 0, park: false, end: 'M30' } },
        ] };
        try {
            const out = emitMapped([op], {});
            return { ok: true, hasText: typeof out.text === 'string' && out.text.length > 0 };
        } catch (e) {
            return { ok: false, message: e.message, stack: e.stack };
        }
    }, splitTree());
    expect(r.ok, `emitMapped did not throw: ${r.message || ''}`).toBe(true);
    expect(r.hasText).toBe(true);
});

test('placeShiftOfStack: does not throw when uiChildren carries a split_horizontal node', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async (tree) => {
        const { placeShiftOfStack } = await import('/blocks/blockEmitter.js');
        const op = { id: 'op1', type: 'op', opType: 'drill', params: {}, uiChildren: tree, children: [
            { type: 'progstart', params: {} },
        ] };
        try {
            const shift = placeShiftOfStack([op]);
            return { ok: true, shift };
        } catch (e) {
            return { ok: false, message: e.message };
        }
    }, splitTree());
    expect(r.ok, `placeShiftOfStack did not throw: ${r.message || ''}`).toBe(true);
    expect(r.shift).toEqual({ x: 0, y: 0, z: 0 });   // no 'place' block present — the documented no-placement default
});
