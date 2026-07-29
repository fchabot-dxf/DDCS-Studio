import { test, expect } from '@playwright/test';

/**
 * t1353 (USER-LIVE) — "the preview goes grey while I drag the bottom handle".
 *
 * One symptom, two roots, and neither is about grey:
 *   (a) the visual block's ceiling was the CONSTANT VIZH_MAX = 900, blind to the modal it lives in. Measured on a
 *       1000px viewport the host runs 90→890, so a down-drag pushed the block to 990 — a hundred pixels PAST its
 *       host, putting the 2D canvas and the SIZER ITSELF under the CANCEL/INSERT footer. And it PERSISTED, so every
 *       wizard reopened with the handle already buried.
 *   (b) a drag that missed the handle fell through to TEXT SELECTION, and the sweep painted the selection wash
 *       across the form and both canvases. That wash is the "grey".
 *
 * These assert the SYMPTOM, in the real modal, driven the way a user drives it — not the clamp arithmetic.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

const openTwin = async (page) => {
    await page.waitForFunction(() => window.ddcsStudio && window.openWiz);
    await page.evaluate(() => window.openWiz('user_surfacing_data'));
    await page.waitForSelector('#wiz_user_form', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(600);
};

const geom = (page) => page.evaluate(() => {
    const visual = document.querySelector('#wiz_user .wiz-visual');
    const sizer = document.querySelector('#wiz_user .viz-pane-sizer');
    const host = visual && visual.parentElement;
    const vb = visual.getBoundingClientRect(), hb = host.getBoundingClientRect(), sb = sizer.getBoundingClientRect();
    const foot = document.querySelector('#wizardModal .wiz-foot, .wiz-foot');
    const fb = foot && foot.getBoundingClientRect();
    // is the handle actually GRABBABLE where it sits — i.e. is the sizer what the pointer would hit?
    const cx = sb.left + sb.width / 2, cy = sb.top + sb.height / 2;
    const top = document.elementFromPoint(cx, cy);
    let up = 0, down = 0;
    const hits = (y) => { const el = document.elementFromPoint(cx, y); return !!(el && el.closest && el.closest('.viz-pane-sizer')); };
    while (up < 60 && hits(cy - up - 1)) up++;
    while (down < 60 && hits(cy + down + 1)) down++;
    return {
        overflow: Math.round(vb.bottom - hb.bottom),
        sizerReachable: !!(top && top.closest('.viz-pane-sizer')),
        hitTarget: up + down + Math.round(sb.height),
        sizerAboveFooter: fb ? sb.bottom <= fb.top + 1 : true,
        footVisible: fb ? (fb.top >= 0 && fb.bottom <= window.innerHeight && fb.height > 0) : false,
        stored: (() => { try { return localStorage.getItem('ddcs_visual_height'); } catch (_) { return null; } })(),
    };
});

test('a full-length DOWN-DRAG leaves the handle reachable and INSERT/CANCEL visible', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await openTwin(page);

    const box = await page.locator('#wiz_user .viz-pane-sizer').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 600, { steps: 20 });   // far past any sane ceiling
    await page.mouse.up();
    await page.waitForTimeout(400);

    const g = await geom(page);
    // THE BLOCK STAYS INSIDE ITS HOST. Before the fix this was +100: the overflow the host never grew to absorb.
    expect(g.overflow, 'the visual block does not overflow its host').toBeLessThanOrEqual(0);
    // AND THE HANDLE IS STILL THE THING UNDER THE POINTER — the drag can be undone by the same gesture.
    expect(g.sizerReachable, 'the sizer is still what a pointer at its centre hits').toBe(true);
    expect(g.sizerAboveFooter, 'and it has not slid under the CANCEL/INSERT footer').toBe(true);
    expect(g.footVisible, 'the footer is still on screen').toBe(true);
    await expect(page.locator('.wiz-foot button.primary')).toBeVisible();
    await page.screenshot({ path: 'scratchpad/s1353-sizer-after-down.png' });
});

test('a NEAR-MISS drag selects nothing — the visual is a control surface, not prose', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await openTwin(page);
    const box = await page.locator('#wiz_user .viz-pane-sizer').first().boundingBox();
    // press ABOVE the handle (inside the 2D canvas) and sweep left across the form — the reported gesture
    await page.mouse.move(box.x + box.width / 2, box.y - 40);
    await page.mouse.down();
    await page.mouse.move(300, box.y - 320, { steps: 15 });
    await page.mouse.up();
    const sel = await page.evaluate(() => String(window.getSelection ? window.getSelection().toString() : ''));
    expect(sel, `a missed drag selects nothing (got ${JSON.stringify(sel.slice(0, 80))})`).toBe('');
});

test('a PERSISTED oversize heals on open — a stored 900 must not reopen broken', async ({ page }) => {
    await page.goto('http://localhost:3211');
    // exactly what a user who dragged before this fix has sitting in their browser
    await page.evaluate(() => { try { localStorage.setItem('ddcs_visual_height', '900'); } catch (_) { /* */ } });
    await page.reload();
    await openTwin(page);

    const g = await geom(page);
    expect(g.overflow, 'the poisoned height does not overflow the host on reopen').toBeLessThanOrEqual(0);
    expect(g.sizerReachable, 'and the handle is reachable without dragging anything first').toBe(true);
    // THE DAMAGE IS REPAIRED, NOT MERELY SURVIVED: the stored value itself comes down, so the next wizard — and the
    // next session — starts from a height that fits. A clamp alone would leave the 900 in localStorage forever.
    expect(Number(g.stored), 'the stored value itself healed').toBeLessThan(900);
    expect(Number(g.stored), 'to the height the container actually allows').toBeGreaterThan(0);
});

test('the handle keeps a grab target far larger than the 2px line it draws', async ({ page }) => {
    await page.goto('http://localhost:3211');
    await openTwin(page);
    const g = await geom(page);
    // MEASURED, not assumed: the ::before overlay gives ~29px, biased UPWARD because the handle sits flush with the
    // block's bottom edge — there is no room below it to claim, and the realistic miss is from above anyway. Pinned
    // so a future CSS change cannot quietly shrink it back to the 6px the grip actually occupies.
    expect(g.hitTarget, `effective grab height (measured ${g.hitTarget}px)`).toBeGreaterThanOrEqual(24);
});
