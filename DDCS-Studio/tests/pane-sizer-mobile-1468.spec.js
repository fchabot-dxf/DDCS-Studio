import { test, expect } from '@playwright/test';

/**
 * t1468 (USER DEFECT, live deploy) — "dragging the feature preview's bottom handle just opens grey".
 *
 * ── THE SEAM, DIAGNOSED BEFORE ANYTHING WAS CHANGED ─────────────────────────────────────────────────────────────
 * Not a re-render bug: THE DRAG WROTE A HEIGHT NOTHING DOWNSTREAM CONSUMED. The bottom sizer resizes `.wiz-visual`.
 * Desktop's panes FLEX inside that height, so the canvases follow for free. The mobile stack cannot flex (the modal
 * is height:auto), so its pane bodies carried an explicit CSS height — and that height was the CONSTANT 400px.
 * Measured at 412px before the fix:
 *
 *     drag DOWN   visual 492 → 716     both pane bodies stayed at exactly 200. 240px of bare panel = THE GREY.
 *     drag UP     visual 492 → 286     bodies still 400 total, so the panes OVERFLOWED the block they live in and
 *                                      covered the handle: elementFromPoint stopped returning the sizer, and the
 *                                      gesture could not be undone. The same root, pointing the other way.
 *
 * The fix makes the stacked total a VARIABLE (`--viz-stack-h`) filled in by the one place that writes the visual's
 * height, with the old 400px as its never-dragged default.
 *
 * ── AND THESE TESTS ASSERT THE SYMPTOM, NOT THE ARITHMETIC ──────────────────────────────────────────────────────
 * The canvas must GENUINELY GROW AND REPAINT: the assert is the canvas's own BITMAP height (the number that only
 * moves when something re-rendered into it) plus a HIT TEST in the band that used to be grey — the pixel a finger
 * would land on has to be inside a preview, not inside the panel behind it.
 */

// t2545 (BACKLOG #71/#72, the section migration) — switched from surfacing to POCKET, same reasoning as
// pane-sizer-1353.spec.js's own header comment: `.wiz-visual` (and its stacked-height mechanism this file
// tests) only exists for a FLAT-rendered op; surfacing is now genuinely tree-rendered (mirroring drill), so
// it is no longer a valid subject for this mechanism, which is otherwise unchanged.
//
// t2627 — SWAPPED AGAIN, same reasoning as pane-sizer-1353.spec.js's own t2627 update: pocket migrated onto
// the declared group_box tree this turn. `user_corner_data` is the last remaining genuinely classic-rendered
// op among the 32 registered twins (confirmed: no `split_horizontal`/`split_vertical` in cornerData.js), with
// a real `form3d+2d` panel — a stable subject as long as it stays the deferred pilot.
const openTwin = async (page) => {
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('user_corner_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(700);
};

const boot = async (page, w, h) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('http://localhost:3211');
    await page.evaluate(() => { try { localStorage.removeItem('ddcs_visual_height'); } catch (_) { /* */ } });
    await page.reload();
    await openTwin(page);
};

const probe = (page) => page.evaluate(() => {
    const visual = document.querySelector('#wiz_user .wiz-visual');
    const sizer = document.querySelector('#wiz_user .viz-pane-sizer');
    const bodies = [...document.querySelectorAll('#wiz_user [data-viz-pane] > .wiz-pane-body')];
    const vb = visual.getBoundingClientRect(), sb = sizer.getBoundingClientRect();
    const overlay = document.querySelector('#wiz_user canvas.fc-anim-overlay');
    // the hit test: a point just inside the block's bottom edge, on the sizer's own column
    const cx = sb.left + sb.width / 2;
    const probeY = Math.round(vb.bottom - 12);
    const hit = document.elementFromPoint(cx, probeY);
    const sizerHit = document.elementFromPoint(cx, sb.top + sb.height / 2);
    return {
        visualH: Math.round(vb.height),
        bodies: bodies.map((b) => Math.round(b.getBoundingClientRect().height)),
        bodiesTotal: Math.round(bodies.reduce((a, b) => a + b.getBoundingClientRect().height, 0)),
        canvasBitmapH: overlay ? overlay.height : null,
        // what a finger landing near the bottom edge actually touches
        hitInsidePreview: !!(hit && hit.closest && (hit.closest('.wiz-pane-body') || hit.closest('.viz-pane-sizer'))),
        hitTag: hit ? (hit.className && hit.className.baseVal !== undefined ? hit.tagName : hit.tagName + '.' + String(hit.className).split(' ')[0]) : null,
        sizerReachable: !!(sizerHit && sizerHit.closest && sizerHit.closest('.viz-pane-sizer')),
        stackVar: visual.style.getPropertyValue('--viz-stack-h') || null,
    };
});

const dragSizer = async (page, dy) => {
    const box = await page.locator('#wiz_user .viz-pane-sizer').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + dy, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(450);
};

test('PHONE 412px — a DOWN-drag genuinely grows the preview and repaints it; no grey band opens', async ({ page }) => {
    await boot(page, 412, 900);
    await dragSizer(page, -200);            // shrink first so the down-drag has somewhere to go
    const before = await probe(page);
    await page.screenshot({ path: 'scratchpad/t1468-phone-before.png' });

    await dragSizer(page, 200);
    const after = await probe(page);
    await page.screenshot({ path: 'scratchpad/t1468-phone-after.png' });

    expect(after.visualH, 'the block grew').toBeGreaterThan(before.visualH + 100);
    // ⚠ THE DEFECT ITSELF: this was 400 → 400 while the block went 492 → 716.
    expect(after.bodiesTotal, 'the PANE BODIES grew with it — the height is consumed, not just written')
        .toBeGreaterThan(before.bodiesTotal + 100);
    // and the canvas re-rendered INTO the new size: a bitmap only changes when something drew.
    expect(after.canvasBitmapH, 'the feature canvas repainted at the new size').toBeGreaterThan(before.canvasBitmapH + 50);
    // no grey: the band a finger reaches at the bottom edge is preview, not the panel behind it.
    expect(after.hitInsidePreview, `a point 12px inside the block's bottom edge must be a preview, not bare panel `
        + `(got ${after.hitTag})`).toBe(true);
    expect(after.stackVar, 'the stacked total is filled in, not left at its 400px default').toBeTruthy();
});

test('PHONE 412px — an UP-drag keeps the handle grabbable, so the gesture can be undone', async ({ page }) => {
    await boot(page, 412, 900);
    await dragSizer(page, -240);
    const g = await probe(page);
    // BEFORE THE FIX the panes kept their pinned 400 and overflowed the shrunken block, covering the sizer.
    expect(g.sizerReachable, 'the sizer is still what a pointer at its centre hits').toBe(true);
    expect(g.bodiesTotal, 'the bodies shrank with the block instead of overflowing it').toBeLessThanOrEqual(g.visualH);
});

test('DESKTOP 1400px — unchanged: the panes already flexed, and still do', async ({ page }) => {
    await boot(page, 1400, 1000);
    await dragSizer(page, -200);
    const before = await probe(page);
    await dragSizer(page, 200);
    const after = await probe(page);
    await page.screenshot({ path: 'scratchpad/t1468-desktop-after.png' });

    expect(after.visualH).toBeGreaterThan(before.visualH + 100);
    expect(after.bodiesTotal, 'desktop grew its bodies before this fix and still does').toBeGreaterThan(before.bodiesTotal + 100);
    expect(after.canvasBitmapH).toBeGreaterThan(before.canvasBitmapH + 50);
    expect(after.hitInsidePreview).toBe(true);
});
