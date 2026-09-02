import { test, expect } from '@playwright/test';

/**
 * t1636 — a `formfield` block whose Match Var names no `assign` block in the stack used to save SILENTLY: the
 * live-view derivation (`formfieldBindings`) catches the mismatch and returns `[]`, and the actual save path
 * never even called it — `saveAsCustomOp` assembled `bindings` from ticked-knob/param-pill extraction only, so
 * a formfield-only stack saved with a bindings array that quietly didn't include the dangling field either way.
 * The operator got a wizard labelled "No parameters — inserts as-is" with no indication anything was declared
 * and dropped. Fix: `formfieldMatchReport` (blocks/userOps.js) counts every declared spec's match hits without
 * throwing, and `saveAsCustomOp` now REFUSES the save and names every unmatched field when any exist.
 *
 * Drives the real save button + real dialog (not a direct model call), same discipline as
 * formfield-authoring-1610.spec.js.
 */

// t1718 named this spec's load-sensitivity (confirmed 2/2 green with --workers=1); t1724 retired the PER-SPEC
// retries declared here in favor of a config-level policy (playwright.config.js's `retries`) — a fixed list
// goes stale every run as the starved population shifts (measured at t1719).

test.use({ viewport: { width: 1400, height: 1000 } });

test('a dangling formfield (Match Var names nothing) REFUSES the save and names the field', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });

    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar);
    await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });

    // A leaf op atom (no assign blocks at all) + a formfield whose Match Var (#1) matches nothing in the stack —
    // the exact shape a formfield authored over a real-op leaf (not a macro-var atom) produces today.
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const specs = [{ param: 'w', type: 'number', default: 100, label: 'Width', section: 'CUT', match: { type: 'assign', var: '#1' }, key: 'value' }];
        const stack = [{
            type: 'user_root', params: {},
            uiChildren: [{ type: 'feature_canvas', params: { panel: 'form3d+2d' } }, { type: 'param_group', params: { group: 'Pilot' }, children: U.bindingsToBlocks(specs) }],
            children: [{ type: 'surfaceraster', params: { x: 0, y: 0, z0: 0, w: 100, h: 80, inset: 0, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5, strategy: 'parallel', direction: 'bothways', rowAxis: 'x', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, confirmEvery: 0 } }],
        }];
        window.ddcsLoadBlockStack(stack);
    });
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, { timeout: 8000 });
    await page.waitForTimeout(500);
    await page.waitForSelector('.blk-dev-savebtn', { state: 'visible' });
    await page.evaluate(() => window.ddcsSaveAsWizard());
    await page.waitForTimeout(300);

    expect(dialogs.length, 'a dialog fired instead of the save dialog silently opening').toBeGreaterThan(0);
    expect(dialogs[0], 'the message names the field count and the dangling param').toMatch(/1 field declared, 0 matched/);
    expect(dialogs[0], 'the message names the param').toMatch(/\bw\b/);
    // The save dialog must NOT have opened (the refusal happens before it) — no wizard persisted.
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ddcs_user_ops') || '[]').length);
    expect(saved, 'nothing saved — the operator is never handed a silently-broken wizard').toBe(0);
});

test('a genuinely parameterless stack (no formfield at all) still saves cleanly — the honest case survives', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1' && window.ddcsStudio && window.showApp && window.ddcsRefreshWizardBar);
    await page.evaluate(() => { localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout'); window.ddcsRefreshWizardBar(); });

    await page.evaluate(async () => {
        const stack = [{
            type: 'user_root', params: {},
            uiChildren: [{ type: 'feature_canvas', params: { panel: 'form3d+2d' } }],
            children: [{ type: 'surfaceraster', params: { x: 0, y: 0, z0: 0, w: 100, h: 80, inset: 0, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5, strategy: 'parallel', direction: 'bothways', rowAxis: 'x', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, confirmEvery: 0 } }],
        }];
        window.ddcsLoadBlockStack(stack);
    });
    await page.evaluate(() => window.showApp('blocks'));
    await page.waitForFunction(() => window.__blkws && window.__blkws.getAllBlocks().length > 0, { timeout: 8000 });
    await page.waitForTimeout(500);
    await page.waitForSelector('.blk-dev-savebtn', { state: 'visible' });
    await page.evaluate(() => window.ddcsSaveAsWizard());
    await page.waitForSelector('.blk-dev-savedlg', { state: 'visible' });
    await page.fill('.blk-dev-savedlg .blk-dev-opname', 'Parameterless 1636');
    await page.click('.blk-dev-savedlg .blk-dev-save');
    await page.waitForTimeout(300);

    const savedOpType = await page.evaluate(() => {
        const arr = JSON.parse(localStorage.getItem('ddcs_user_ops') || '[]');
        const found = arr.find((o) => o.label === 'Parameterless 1636');
        return found ? found.opType : null;
    });
    expect(savedOpType, 'a stack with NO formfield blocks saves normally (no false refusal)').toBeTruthy();

    await page.evaluate(async (opType) => {
        const U = await import('/blocks/userOps.js');
        try { U.deleteUserOp(opType); } catch (_) {}
        localStorage.removeItem('ddcs_user_ops'); localStorage.removeItem('ddcs_wizard_layout');
    }, savedOpType);
});
