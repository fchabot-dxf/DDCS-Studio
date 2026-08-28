import { test, expect } from '@playwright/test';

/**
 * t2371 — BACKLOG #32's own closure: `viz/featureCanvas.js` had zero two-pointer/pinch handling — desktop got
 * zoom through `wheel`, mobile got nothing (`_bind()`'s own handlers were exactly pointerdown/pointermove/
 * pointerup/wheel; a pinch is a SECOND, simultaneous pointer, which nothing ever tracked). Fixed by tracking
 * every down pointer in `_pointers` (a Map, by pointerId): ONE pointer keeps today's drag/pan path byte-for-
 * byte unchanged; a SECOND pointer always means pinch — it cancels whatever single-pointer gesture was running
 * (a handle drag fires its own real `onDragEnd`, exactly like a normal release would) and anchors a `_pinch`
 * state at that instant (`dist0`/`scale0` for the zoom ratio, `w0` = the world point under the two-finger
 * midpoint). Every subsequent move re-solves `cxw`/`cyw` to keep `w0` fixed under the CURRENT midpoint at the
 * CURRENT scale — the same "keep the point under the gesture fixed" anchor `wheel`'s own handler already uses
 * for a stationary cursor, just anchored to a drifting midpoint instead. `_userAdjusted` is set (matching
 * wheel/pan), so a pinch also stops the auto-fit fighting the user, per the entry's own explicit ask.
 *
 * A pinch ending (either finger lifting) does NOT hand off to a resumed single-pointer drag/pan — the surviving
 * finger needs its own fresh `pointerdown`, avoiding any ambiguity about which gesture a lone remaining pointer
 * is now performing.
 *
 * `touch-action: none` was ALREADY set on `.feature-canvas` (`_mount()`, inline style) before this turn — the
 * "which touch-action" conflict the entry's own text warns about was already resolved; the missing piece was
 * purely the gesture handler.
 *
 * No native multi-touch API exists in Playwright (`page.touchscreen` is single-point only), so these tests
 * dispatch synthetic two-pointer `PointerEvent`s (`pointerType: 'touch'`) directly at the SVG — the exact
 * events a real two-finger touch produces, read by the exact listeners a real gesture would reach.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function setupOp(page, opType, label) {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => window.openWiz && window.ddcsGetBlockProgram);
    await page.evaluate(async ({ opType, label }) => {
        const U = await import('/blocks/userOps.js');
        localStorage.removeItem('ddcs_user_ops');
        const template = [{ type: 'move', params: {
            x: { type: 'param', params: { name: 'px', value: 30, widget: 'point-x' } },
            y: { type: 'param', params: { name: 'py', value: 40, widget: 'point-y' } },
            z: -2, mode: 'rapid',
        } }];
        const bindings = U.extractParamBlocks(template, new Set(), true);
        U.createUserOp(U.userOpFromStack(opType, label, template, bindings, 'form2d'));
    }, { opType, label });
    await page.evaluate((t) => window.openWiz(t), 'user_' + opType);
    await page.waitForSelector('#userVizContainer .fc-handle-move', { state: 'visible' });
}

async function canvasCenter(page) {
    const box = await page.evaluate(() => {
        const r = document.querySelector('#userVizContainer svg.feature-canvas').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    return { cx: box.x + box.w / 2, cy: box.y + box.h / 2 };
}

async function scaleOf(page) {
    return page.evaluate(() => document.getElementById('userVizContainer').__layout.getTransform().scale);
}

test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('ddcs_user_ops')).catch(() => {});
});

test('BACKLOG #32: two fingers spreading apart (pinch-out) zooms IN', async ({ page }) => {
    await setupOp(page, 'pinchtest_out', 'Pinch Out');
    const before = await scaleOf(page);
    const { cx, cy } = await canvasCenter(page);
    await page.evaluate(({ cx, cy }) => {
        const svg = document.querySelector('#userVizContainer svg.feature-canvas');
        const fire = (type, id, x, y) => svg.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType: 'touch', bubbles: true, cancelable: true, isPrimary: id === 1 }));
        fire('pointerdown', 1, cx - 20, cy);
        fire('pointerdown', 2, cx + 20, cy);
        for (let i = 1; i <= 6; i++) { fire('pointermove', 1, cx - 20 - i * 10, cy); fire('pointermove', 2, cx + 20 + i * 10, cy); }
        fire('pointerup', 1, cx - 80, cy);
        fire('pointerup', 2, cx + 80, cy);
    }, { cx, cy });
    const after = await scaleOf(page);
    expect(after, 'fingers spreading apart increases scale (zoom in)').toBeGreaterThan(before);
});

test('BACKLOG #32: two fingers pinching together (pinch-in) zooms OUT', async ({ page }) => {
    await setupOp(page, 'pinchtest_in', 'Pinch In');
    const before = await scaleOf(page);
    const { cx, cy } = await canvasCenter(page);
    await page.evaluate(({ cx, cy }) => {
        const svg = document.querySelector('#userVizContainer svg.feature-canvas');
        const fire = (type, id, x, y) => svg.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType: 'touch', bubbles: true, cancelable: true, isPrimary: id === 1 }));
        fire('pointerdown', 1, cx - 100, cy);
        fire('pointerdown', 2, cx + 100, cy);
        for (let i = 1; i <= 6; i++) { fire('pointermove', 1, cx - 100 + i * 12, cy); fire('pointermove', 2, cx + 100 - i * 12, cy); }
        fire('pointerup', 1, cx - 28, cy);
        fire('pointerup', 2, cx + 28, cy);
    }, { cx, cy });
    const after = await scaleOf(page);
    expect(after, 'fingers coming together decreases scale (zoom out)').toBeLessThan(before);
});

test('BACKLOG #32: a single-pointer handle drag is byte-for-byte unaffected — still works before and immediately after a pinch', async ({ page }) => {
    await setupOp(page, 'pinchtest_drag', 'Pinch Drag Regress');
    const handle = page.locator('#userVizContainer .fc-handle-move').first();
    const hb = await handle.boundingBox();
    const beforePx = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="px"]').value);
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + 50, hb.y + hb.height / 2 + 30, { steps: 5 });
    await page.mouse.up();
    const afterDrag1 = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="px"]').value);
    expect(afterDrag1, 'a plain single-pointer drag still writes the field, unchanged from before this turn').not.toBe(beforePx);

    const { cx, cy } = await canvasCenter(page);
    await page.evaluate(({ cx, cy }) => {
        const svg = document.querySelector('#userVizContainer svg.feature-canvas');
        const fire = (type, id, x, y) => svg.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType: 'touch', bubbles: true, cancelable: true, isPrimary: id === 1 }));
        fire('pointerdown', 1, cx - 20, cy); fire('pointerdown', 2, cx + 20, cy);
        fire('pointermove', 1, cx - 60, cy); fire('pointermove', 2, cx + 60, cy);
        fire('pointerup', 1, cx - 60, cy); fire('pointerup', 2, cx + 60, cy);
    }, { cx, cy });

    const handle2 = page.locator('#userVizContainer .fc-handle-move').first();
    const hb2 = await handle2.boundingBox();
    await page.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb2.x + hb2.width / 2 + 40, hb2.y + hb2.height / 2 - 20, { steps: 5 });
    await page.mouse.up();
    const afterDrag2 = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="px"]').value);
    expect(afterDrag2, 'a fresh single-pointer drag right after a pinch still works — no stuck pinch state').not.toBe(afterDrag1);
});

test('BACKLOG #32: a second finger touching down MID-DRAG cancels the drag cleanly (real onDragEnd) and switches to pinch — never a corrupted double-write', async ({ page }) => {
    await setupOp(page, 'pinchtest_mid', 'Pinch Mid Drag');
    const handle = page.locator('#userVizContainer .fc-handle-move').first();
    const hb = await handle.boundingBox();
    const hcx = hb.x + hb.width / 2, hcy = hb.y + hb.height / 2;
    const beforeScale = await scaleOf(page);

    await page.evaluate(({ hcx, hcy }) => {
        const svg = document.querySelector('#userVizContainer svg.feature-canvas');
        const fire = (type, id, x, y) => svg.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType: 'touch', bubbles: true, cancelable: true, isPrimary: id === 1 }));
        fire('pointerdown', 1, hcx, hcy);
        fire('pointermove', 1, hcx + 15, hcy + 10);   // a drag genuinely starts
        const box = svg.getBoundingClientRect();
        const farx = box.x + box.width - 40, fary = box.y + 40;
        fire('pointerdown', 2, farx, fary);           // a second finger arrives mid-drag
        for (let i = 1; i <= 4; i++) { fire('pointermove', 1, hcx + 15 - i * 5, hcy + 10); fire('pointermove', 2, farx + i * 5, fary); }
        fire('pointerup', 1, hcx, hcy);
        fire('pointerup', 2, farx + 20, fary);
    }, { hcx, hcy });

    const afterScale = await scaleOf(page);
    expect(afterScale, 'the pinch that started mid-drag still changed the zoom (the cancel did not swallow it)').not.toBe(beforeScale);

    // and a fresh single-pointer drag right after still works — the cancel+handoff left no stuck state.
    const handle2 = page.locator('#userVizContainer .fc-handle-move').first();
    const hb2 = await handle2.boundingBox();
    const beforeFreshPx = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="px"]').value);
    await page.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb2.x + hb2.width / 2 + 40, hb2.y + hb2.height / 2 + 20, { steps: 5 });
    await page.mouse.up();
    const afterFreshPx = await page.evaluate(() => document.querySelector('#wiz_user_form [data-param="px"]').value);
    expect(afterFreshPx, 'a fresh drag after the mid-drag cancel still writes the field').not.toBe(beforeFreshPx);
});
