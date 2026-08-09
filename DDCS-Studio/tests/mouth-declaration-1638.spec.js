import { test, expect } from '@playwright/test';

/**
 * t1638 — A BLOCK DECLARES ITS OWN MOUTH. Five times (t1069 opunit · t1093 cam_table · t1595 guard · t1627 uibox ·
 * t1636 skim) a block kind that holds children was missing from ONE of four hand-maintained kind-name lists
 * (bridge.js's `isWrap` array, bridge.js's DO-mouth OR-chain, and its two restatements in stackBridge.js's
 * toRecord/recToJson) and `recToJson` silently wrote it CHILDLESS — the children discarded with no error.
 *
 * The fix: the block DEF now declares `mouth: 'DO'` itself (wizards/ops/*.js), and all four sites read
 * `mouthOf(def)` instead of matching hardcoded kind names — one declaration, not four restatements.
 *
 * THE DURABLE HALF (this spec): a record carrying children whose def declares NO mouth must now FAIL LOUD in
 * `recToJson` instead of silently discarding them — the property that makes a SIXTH silent-loss instance
 * structurally impossible. Proven non-vacuous below: the assertion is shown to fail if the guard clause in
 * stackBridge.js is removed (see WORK-LOG t1638 for the revert-and-rerun measurement).
 */
test('a block kind with children but no declared mouth throws instead of silently discarding them', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.showApp);
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws, { timeout: 8000 });

    const r = await page.evaluate(async () => {
        const { BLOCKS } = await import('/wizards/ops/index.js');
        const { stackToWorkspace } = await import('/blocks/blockly/stackBridge.js');

        // A kind that legitimately has no mouth today (a plain leaf) — sanity control, must NOT throw.
        const leafStack = [{ type: 'comment', id: 'c1', params: { text: 'hi' } }];
        let leafThrew = false;
        try { stackToWorkspace(leafStack, new window.Blockly.Workspace()); } catch (_) { leafThrew = true; }

        // A FRESH fake kind, deliberately registered WITHOUT `mouth` — the exact shape a future t1069/t1093/t1595/
        // t1627/t1636-class mistake would take: a def that forgot to declare it holds children. Also gives Blockly
        // a minimal (mouthless) block definition of its own, so the type is genuinely KNOWN to Blockly — meaning
        // any throw we see comes from recToJson itself (which runs before the Blockly loader), never from
        // Blockly rejecting an unregistered type (which would make this assertion pass for the wrong reason).
        BLOCKS['fake_mouthless_1638'] = { type: 'fake_mouthless_1638', label: 'fake', kind: 'fake_kind_1638', category: 'Move', defaults: {}, fields: [] };
        window.Blockly.defineBlocksWithJsonArray([{ type: 'fake_mouthless_1638', message0: 'fake', args0: [], previousStatement: null, nextStatement: null }]);
        const badStack = [{ type: 'fake_mouthless_1638', id: 'f1', params: {}, children: [{ type: 'comment', id: 'c2', params: { text: 'lost' } }] }];
        let badThrew = false, badMessage = '';
        try { stackToWorkspace(badStack, new window.Blockly.Workspace()); } catch (e) { badThrew = true; badMessage = String(e && e.message || e); }
        delete BLOCKS['fake_mouthless_1638'];

        return { leafThrew, badThrew, badMessage };
    });

    expect(r.leafThrew, 'a genuinely childless/mouthless leaf round-trips fine — no false positive').toBe(false);
    expect(r.badThrew, 'a def with children but no declared `mouth` must throw, not silently discard').toBe(true);
    expect(r.badMessage).toMatch(/fake_mouthless_1638/);
    expect(r.badMessage).toMatch(/mouth/);
});
