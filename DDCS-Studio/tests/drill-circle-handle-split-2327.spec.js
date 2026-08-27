import { test, expect } from '@playwright/test';

/**
 * t2327 PART 2 (BACKLOG #33, user-decided design, user-reported live) — the drill circle pattern's Ø handle
 * used to be ONE fused `radial` gesture (`field:'dia'` AND `fieldA:'startAngle'` on the same declaration,
 * `drillView.js`'s own `ring` decl and `drillData.js`'s own `dr_ring`): `canvasWidgets.js`'s `radial.drag`
 * writes BOTH off one drag (the angle from `atan2` of the raw cursor bearing, the radius from raw distance
 * from centre), so moving the handle in ANY direction rotated every hole about the centre — reported live as
 * "the diameter marker moves the position." It also violated the standing rule that handles are independent.
 *
 * THE DECIDED FIX (not a guard — the drag math itself was wrong): split the one fused declaration into two.
 * Hole #1 (the pattern's OWN orientation) IS the angle handle now — an angle-only `radial` (`fieldA` alone,
 * the SAME shape `canvasWidgets.js` already supported for `fillText.js`'s `txt_rot`, just newly reused here).
 * The Ø handle keeps `field`+`rScale` but drops `fieldA` entirely, and locks its own bearing 90° off hole #1
 * (`lockA` — new, canvasWidgets.js — projects the drag onto that fixed arm instead of raw hypot distance, so
 * a sideways nudge changes the radius ~0 rather than jumping): it can no longer write an angle even if you
 * try. Both `drillView.js` (the classic, currently-shipping wizard) and `drillData.js` (the not-yet-flipped
 * data twin) shared the exact same fused shape and got the exact same fix — the underlying mechanism is
 * `canvasWidgets.js`'s ONE shared `radial` gesture, not two independent implementations.
 *
 * NOT fixed this turn (explicitly out of scope, reported instead): `drillView.js`'s `end` handle and
 * `drillData.js`'s own `dr_line` (the LINE pattern's pitch/angle handle) share the identical fused shape —
 * the decided design generalizes ("the rotate handle is the thing the param positions" — a line's own end
 * point, mirroring hole #1 here) but building that case is deferred to a later turn. `fillText.js`'s own
 * `txt_rot` does NOT share the defect — it was already angle-only (no `field`/`rScale`), the exact shape this
 * fix reuses.
 */

const boot = async (page) => {
    await page.goto('http://localhost:3211');
    await page.waitForFunction(() => !!window.ddcsGetBlockProgram, null, { timeout: 20000 });
    await page.waitForFunction(() => window.ddcsStudio && window.ddcsStudio.wizardManager, null, { timeout: 20000 });
};

test('classic drill wizard: dragging Ø writes dia only, dragging hole #1 writes startAngle only', async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);

    const setup = await page.evaluate(async () => {
        const mgr = window.ddcsStudio.wizardManager;
        mgr.open('drill');
        await new Promise((res) => setTimeout(res, 500));
        const sel = document.querySelector('[data-param="pattern"], #d_pattern');
        if (sel) { sel.value = 'circle'; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
        await new Promise((res) => setTimeout(res, 500));
        const svg = document.querySelector('#userVizContainer svg, #drillLayoutCanvas');
        const rotHandle = svg ? svg.querySelector('[data-hid="rot"]') : null;
        const ringHandle = svg ? svg.querySelector('[data-hid="ring"]') : null;
        return {
            rotFound: !!rotHandle,
            ringFound: !!ringHandle,
            ringTag: ringHandle ? ringHandle.tagName : null,
            armCount: svg ? svg.querySelectorAll('line.fc-guide').length : 0,
        };
    });
    expect(setup.rotFound, 'the angle-only "rot" handle (hole #1) exists').toBe(true);
    expect(setup.ringFound, 'the Ø handle exists').toBe(true);
    expect(setup.ringTag, 'the Ø handle renders as a diamond (polygon), never a circle — circles are holes').toBe('polygon');
    expect(setup.armCount, 'a dotted arm guide connects the centre to the Ø handle').toBeGreaterThan(0);

    const readParams = () => page.evaluate(() => ({
        dia: document.querySelector('#d_dia, [data-param="dia"]')?.value,
        angle: document.querySelector('#d_startAngle, [data-param="startAngle"]')?.value,
    }));
    const dragHandle = async (selector, dx, dy) => {
        const box = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, selector);
        if (!box) return false;
        await page.mouse.move(box.x, box.y);
        await page.mouse.down();
        await page.mouse.move(box.x + dx, box.y + dy, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        return true;
    };

    const before = await readParams();
    const ringDragged = await dragHandle('[data-hid="ring"]', 15, 10);
    const afterRing = await readParams();
    expect(ringDragged, 'the Ø drag registered').toBe(true);
    expect(afterRing.dia, 'dragging Ø changes dia').not.toBe(before.dia);
    expect(afterRing.angle, 'dragging Ø leaves startAngle untouched').toBe(before.angle);

    const rotDragged = await dragHandle('[data-hid="rot"]', -20, 25);
    const afterRot = await readParams();
    expect(rotDragged, 'the hole #1 drag registered').toBe(true);
    expect(afterRot.angle, 'dragging hole #1 changes startAngle').not.toBe(afterRing.angle);
    expect(afterRot.dia, 'dragging hole #1 leaves dia untouched').toBe(afterRing.dia);
});

test('canvasWidgets.js radial gesture: lockA projects onto the fixed arm, ignoring perpendicular motion', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(async () => {
        const { CANVAS_GESTURES } = await import('/viz/canvasWidgets.js');
        const d = { cx: 0, cy: 0, r: 25, a: 0, field: 'dia', rScale: 2, minR: 0, lockA: true };   // arm along +X (a=0)
        const alongArm = CANVAS_GESTURES.radial.drag(d, { x: 40, y: 0 });      // pure +X motion — full effect
        const perp = CANVAS_GESTURES.radial.drag(d, { x: 0, y: 40 });         // pure +Y motion — perpendicular to the arm
        const unlocked = CANVAS_GESTURES.radial.drag({ ...d, lockA: false }, { x: 0, y: 40 });   // same point, WITHOUT the lock
        return { alongArm, perp, unlocked };
    });
    expect(r.alongArm.dia, 'motion along the arm drives the full radius').toBeGreaterThan(70);
    expect(Math.abs(r.perp.dia), 'motion perpendicular to a locked arm drives ~0 radius change').toBeLessThan(0.01);
    expect(r.unlocked.dia, 'the SAME perpendicular motion WITHOUT lockA uses raw distance (unchanged existing behavior)').toBeGreaterThan(70);
});
