import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openWizardViaBar, fillField } from './support/barGesture.js';
import { stopLiveSim, dismissToasts } from './support/simControls.js';

/**
 * t1804 — a declared draggable canvas handle exists AND is writable on the Blocks pane, on a COLD PAGE (one that
 * has never opened this op's own wizard MODAL in the current session — the very common real flow of launching the
 * app and immediately opening a saved program).
 *
 * ── THE BUG THIS GUARDS ──────────────────────────────────────────────────────────────────────────────────────────
 * `panelTypes.js`'s `_writable`/`_field` used to hardcode `document.querySelector('#wiz_user_form ...')` — the
 * MODAL's form id, unaware that this same module also renders the Blocks pane's own Layout-2D canvas, which has
 * its own namespaced form (`#blk_wiz_user_form`). On a cold page the modal's form was never populated for this op
 * type, so `_field` found nothing and the handle silently never rendered (t1798/t1800's own finding). On a WARM
 * page (the modal had been opened earlier, e.g. via a real Insert) it was WORSE, not better: `_field` found the
 * MODAL's LEFTOVER field from that earlier session and a drag on the PANE silently wrote into the (closed, unread)
 * MODAL's form instead of the pane's own — a silent cross-surface write, confirmed live at t1804 with a real drag.
 *
 * Fixed by dependency injection (`panelTypes.js`'s `setFormHost`, called by `userOpView.js` synchronously,
 * immediately before every render that needs it, with each view instance's own namespaced `elNS('wiz_user_form')`
 * — never a hardcoded selector). This is a CLASS fix (every declared draggable handle, every op), not a corner-only
 * patch, so this file guards the class: corner (a real op, the real REPRODUCTION path) + a synthetic non-corner op
 * (registered at runtime via the same `registerUserOp` real API every custom op uses) sharing NOTHING with corner's
 * own dataOp module.
 */

test.use({ viewport: { width: 1500, height: 950 } });

test('COLD page, real Load: corner\'s reposition handle exists and writes into the PANE, not the modal', async ({ page, browser }) => {
    test.setTimeout(60_000);

    // Build + export a real corner program on a SEPARATE, isolated context (never shares storage with `page`).
    const warmCtx = await browser.newContext();
    const warmPage = await warmCtx.newPage();
    await warmPage.goto('/');
    await warmPage.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    await openWizardViaBar(warmPage, { group: 'Probe', optype: 'corner' });
    await fillField(warmPage, { formSelector: '#wiz_user_form', param: 'dist', value: '741' });
    await warmPage.locator('.wiz-foot button.primary', { hasText: 'INSERT' }).click();
    await warmPage.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    const nc = await warmPage.evaluate(() => window.ddcsSerializeWithMarkers());
    expect(nc).toMatch(/@DDCS:\d+/);
    await warmCtx.close();
    const tmpFile = path.join(process.cwd(), 'test-results', 'canvas-handle-writable-1804-corner.nc');
    fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
    fs.writeFileSync(tmpFile, nc);

    // The COLD page: no bar click, no wizard open — straight to the real file-Load gesture.
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });
    page.once('dialog', (d) => d.accept());
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#editor-file-btn').click();
    await page.locator('[data-efm="load"]').click();
    const chooser = await chooserPromise;
    await chooser.setFiles(tmpFile);

    await page.waitForTimeout(1000);
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await stopLiveSim(page, '#blk_userViz3dBox');
    await page.waitForTimeout(600);
    await dismissToasts(page);

    // The handle EXISTS (the t1798/t1800 finding: it used to be silently absent).
    const handle = page.locator('#blk_wiz_user svg [data-hid="reposition_pos"]');
    await expect(handle).toHaveCount(1);

    // A real drag writes into the PANE's OWN form — never the modal's (which was never even opened this session,
    // so #wiz_user_form has no cross1_x field at all; a cross-surface write would silently no-op there instead).
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 15, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const paneField = await page.evaluate(() => { const f = document.querySelector('#blk_wiz_user_form [data-param="cross1_x"]'); return f ? f.value : null; });
    expect(paneField, 'the drag wrote into the pane\'s own form field').not.toBeNull();
    expect(Number(paneField)).not.toBe(0);
});

test('COLD page: a declared draggable handle on a SYNTHETIC non-corner op is writable on the pane (the class, not corner)', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    // Register a minimal custom op (userOpFromStack + registerUserOp — the SAME real API user-ops.spec.js's own
    // foundation test uses) sharing nothing with corner: a single MOVE atom, its x/y bound as a canvas point via
    // group/role, rendered on the 'form2d' panel (the simpler of the two renderLayout2D call sites t1804 fixed).
    // The op INSTANCE is built via makeOp/_builderAtoms — the SAME reconstruction path programModel.js's own
    // opFromMarker uses on a real file import — not a hand-typed object (which lacks the form's uiChildren tree).
    await page.evaluate(async () => {
        const U = await import('/blocks/userOps.js');
        const stack = [{ type: 'move', params: { x: 33, y: 21, z: -2, mode: 'feed' } }];
        const bindings = [
            { param: 'mx', blockIndex: 0, key: 'x', type: 'number', default: 33, group: 'pt', role: 'x' },
            { param: 'my', blockIndex: 0, key: 'y', type: 'number', default: 21, group: 'pt', role: 'y' },
        ];
        const def = U.userOpFromStack('t1804_synth', 'T1804 Synth', stack, bindings);   // t1164 — userOpFromStack PREFIXES opType (USER_OP_PREFIX); read def.opType back, never assume the literal
        def.panel = 'form2d';   // panelTypes.js's PANEL_TYPES id (mode:'2d') — the plain string '2d' isn't a valid key and silently falls back to the DEFAULT_PANEL ('form3d', mode:'3d')
        U.registerUserOp(def);
        const { makeOp, _builderAtoms } = await import('/blocks/opBuilders.js');
        const params = { mx: 33, my: 21 };
        window.__t1804SynthOp = makeOp(def.opType, params, _builderAtoms(def.opType, params));
    });

    // COLD: this op's own wizard/pane has never rendered before — load it straight into the Blocks pane.
    await page.evaluate(() => window.ddcsLoadBlockStack([window.__t1804SynthOp]));
    await page.locator('[data-app="blocks"]').click();
    await page.waitForFunction(() => window.ddcsGetBlockProgram && window.ddcsGetBlockProgram().length > 0, null, { timeout: 10000 });
    await page.waitForTimeout(1000);
    await dismissToasts(page);

    const handle = page.locator('#blk_wiz_user svg .fc-handle-move');
    await expect(handle).toHaveCount(1);

    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const paneField = await page.evaluate(() => { const f = document.querySelector('#blk_wiz_user_form [data-param="mx"]'); return f ? f.value : null; });
    expect(paneField, 'the drag wrote into the pane\'s own form field for the synthetic op too').not.toBeNull();
    expect(Number(paneField)).not.toBe(33);
});
