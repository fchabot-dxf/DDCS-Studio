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
 * Fixed by dependency injection (`panelTypes.js`'s `setFormHost`, called by `userOpView.js` before every render
 * that needs it, with each view instance's own namespaced `elNS('wiz_user_form')` — never a hardcoded selector).
 * This is a CLASS fix (every declared draggable handle, every op), not a corner-only patch, so this file guards
 * the class: corner (a real op, the real REPRODUCTION path) + a synthetic non-corner op (registered at runtime
 * via the same `registerUserOp` real API every custom op uses) sharing NOTHING with corner's own dataOp module.
 *
 * ── t1806 — THE DEFERRED-READER HALF ────────────────────────────────────────────────────────────────────────────
 * The t1804 fix alone left `_formHost` a MODULE-LEVEL SINGLETON read AGAIN at gesture time by three DEFERRED
 * readers (a drag's `setFields`, `onEdgePick`, `onCornerPick`) — correct for `_writable` (evaluated synchronously
 * during the render that built it) but not for a handler that fires long after that render returned. Demonstrated
 * LIVE via the real "Open as modal" button (`#blkOpenModal`, `blocksApp.js`'s `openLiveAsModal` — opens the SAME
 * op as a modal overlay with NO tab switch away from the Blocks pane): closing that modal does NOT re-render the
 * pane, so the pane's own already-built drag handlers were still reading the singleton, which by then pointed at
 * the modal. That real-gesture repro also surfaced a SEPARATE, unrelated hazard (the `_layout` FeatureCanvas
 * singleton, `panelTypes.js`'s own `renderLayout2D`, reparents across whichever container rendered last — the
 * ARCHITECTURE.md TRAP9 entry already named this as dormant risk) that swallowed the pane's drag entirely once
 * the modal had rendered, making the two bugs' symptoms impossible to cleanly separate through that one gesture.
 * Reported, NOT fixed here — out of this act's scope. Fixed the confirmed one (the deferred-reader window) by
 * capturing the host ONCE at the top of `layoutSpecFromOp` into a local `_host`, so every closure that call
 * builds — deferred or not — closes over that value forever, never re-reading the module singleton. Guarded below
 * with a deterministic, gesture-free proof (no dependence on the separate singleton hazard): build a spec under
 * host A, inject host B (simulating a later render), fire the FIRST spec's own deferred `onDrag` — it must still
 * land in host A.
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
    // t2099 — the corner file menu (#editor-file-btn/[data-efm]) is retired (t2078); Load now reaches the same
    // loadGcodeFile handler via the header quick menu instead — same file-chooser trigger, different door.
    await page.locator('#hdrPostBtn').click();
    await page.locator('#hdrPostMenu [data-act="fileLoad"]').click();
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
    // t1904 — a LEGITIMATE async render boundary in the app, confirmed by reading featureCanvas.js, not guessed:
    // `_mount()` sets up a `ResizeObserver` that fires on first observe and schedules a `requestAnimationFrame`
    // -deferred `render()` once the container's REAL (post-layout) size is known (`:111-116`) — separate from
    // the render this test's own tab-switch already triggered synchronously with whatever size was available at
    // that moment. `_draw()` (`:376-378`) wipes and rebuilds the handles group (`handles.replaceChildren()`) on
    // EVERY render call, cold or deferred, and under sustained CPU contention this can keep re-firing (the
    // container's own layout still settling around it) rather than firing exactly once. `toHaveCount(1)` only
    // proves the node exists somewhere in the DOM, not that it is visible or sized. This element is COLD by the
    // test's own design (its wizard/pane has never rendered before — no warm layout cache to lean on).
    //
    // A SINGLE `toBeVisible()` check is NOT enough — confirmed empirically, not assumed: under the same load
    // batch that first reproduced the crash, `toBeVisible()` PASSED and the very next `boundingBox()` call STILL
    // returned `null` (the render cycle fired again in the gap between those two separate CDP round-trips). So
    // this retries the PAIR together — re-check visibility AND capture the box in the same short window, using
    // the box immediately — rather than trusting one settle check to outlast an ongoing re-render storm. A real
    // poll for the actual completion signal, not a bigger fixed wait.
    let box = null;
    for (let i = 0; i < 20 && !box; i++) {
        await expect(handle).toBeVisible();
        box = await handle.boundingBox();
        if (!box) await page.waitForTimeout(100);
    }
    if (!box) throw new Error('t1904 — the handle never produced a stable bounding box under load (20 retries)');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const paneField = await page.evaluate(() => { const f = document.querySelector('#blk_wiz_user_form [data-param="mx"]'); return f ? f.value : null; });
    expect(paneField, 'the drag wrote into the pane\'s own form field for the synthetic op too').not.toBeNull();
    expect(Number(paneField)).not.toBe(33);
});

test('t1806: a spec built under host A keeps writing to host A after host B is injected later (deferred readers)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    const r = await page.evaluate(async () => {
        const PT = await import('/wizards/ops/panelTypes.js');
        const def = { bindings: [{ param: 'px', group: 'pt', role: 'x' }, { param: 'py', group: 'pt', role: 'y' }] };

        const hostA = document.createElement('div'); hostA.id = 'test_1806_hostA';
        const axA = document.createElement('input'); axA.dataset.param = 'px'; axA.value = '50';
        const ayA = document.createElement('input'); ayA.dataset.param = 'py'; ayA.value = '40';
        hostA.append(axA, ayA); document.body.appendChild(hostA);

        const hostB = document.createElement('div'); hostB.id = 'test_1806_hostB';
        const axB = document.createElement('input'); axB.dataset.param = 'px'; axB.value = '50';
        const ayB = document.createElement('input'); ayB.dataset.param = 'py'; ayB.value = '40';
        hostB.append(axB, ayB); document.body.appendChild(hostB);

        try {
            // Build the spec while host A is the injected host — its onDrag closure must capture host A.
            PT.setFormHost(() => document.getElementById('test_1806_hostA'));
            const specA = PT.layoutSpecFromOp(def, { px: 50, py: 40 });
            const handleId = (specA.handles || [])[0] && specA.handles[0].id;

            // A LATER render (a different surface, e.g. the modal opened via "Open as modal") re-points the
            // singleton to host B — simulating exactly what userOpView.js's next renderLayout2D call does.
            PT.setFormHost(() => document.getElementById('test_1806_hostB'));

            // Fire specA's OWN deferred onDrag — built under host A, long before host B was ever injected. This
            // is the drag/picker-click moment: it must stay loyal to host A, not read the CURRENT singleton.
            specA.onDrag(handleId, { x: 111, y: 222 });

            return { handleId, hostA_px: axA.value, hostA_py: ayA.value, hostB_px: axB.value, hostB_py: ayB.value };
        } finally {
            hostA.remove(); hostB.remove();
        }
    });

    expect(r.handleId, 'a handle was built').toBeTruthy();
    expect(Number(r.hostA_px), 'the deferred drag wrote into host A (captured at build time)').toBe(111);
    expect(Number(r.hostA_py)).toBe(222);
    expect(Number(r.hostB_px), 'host B (injected AFTER the spec was built) must be untouched').toBe(50);
    expect(Number(r.hostB_py)).toBe(40);
});

test('t1808: a real-browser render with NO host injected is LOUD, not silent (a caller bug, not a valid state)', async ({ page }) => {
    // Regression class this guards: custom-op-number-roles.spec.js's own two specs called layoutSpecFromOp
    // directly, in a real browser, with no setFormHost call at all — the t1804/t1806 injection contract makes
    // that a caller bug (every declared handle's drag silently no-ops), and it must be DETECTABLE, not merely
    // "the drag quietly did nothing" (which is exactly how the regression shipped and stayed unnoticed in the
    // first place). Distinguishes it from the two LEGITIMATE silent cases (a host injected but this param has no
    // bound field yet; the node-tier gate, no document at all) — neither of those should ever log this.
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && m.text().includes('panelTypes: layoutSpecFromOp')) errors.push(m.text()); });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.ddcsReady === '1', null, { timeout: 20000 });

    const r = await page.evaluate(async () => {
        const PT = await import('/wizards/ops/panelTypes.js');
        const def = { opType: 't1808_no_host_probe', bindings: [{ param: 'px', group: 'pt', role: 'x' }, { param: 'py', group: 'pt', role: 'y' }] };
        // Deliberately NO setFormHost call — the exact shape the regression shipped as.
        const spec = PT.layoutSpecFromOp(def, { px: 5, py: 6 });
        return { handles: spec.handles.length };
    });

    expect(r.handles, 'the permissive fallback still renders the handle (unchanged, declared-only)').toBe(1);
    expect(errors.length, 'exactly one loud console.error, naming the op, for the no-host render').toBe(1);
    expect(errors[0]).toContain('t1808_no_host_probe');

    // Non-vacuity: the SAME call, WITH a host injected, must NOT log anything.
    const errorsBefore = errors.length;
    await page.evaluate(async () => {
        const PT = await import('/wizards/ops/panelTypes.js');
        const host = document.createElement('div'); host.id = 'test_1808_quiet_host'; document.body.appendChild(host);
        PT.setFormHost(() => document.getElementById('test_1808_quiet_host'));
        PT.layoutSpecFromOp({ opType: 't1808_quiet_probe', bindings: [{ param: 'qx', group: 'q', role: 'x' }, { param: 'qy', group: 'q', role: 'y' }] }, { qx: 1, qy: 2 });
        host.remove();
    });
    await page.waitForTimeout(100);
    expect(errors.length, 'an injected host stays quiet — no false positives').toBe(errorsBefore);
});
