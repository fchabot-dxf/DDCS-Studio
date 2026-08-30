import { test, expect } from '@playwright/test';

/**
 * t2417 (BACKLOG #51 REOPENED + RETARGETED) — the Blocks tab's Blockly canvas: two fingers ZOOM (pinch already
 * worked — `zoom.pinch` defaults to `wheel || controls`, both live) but do NOT pan. One-finger pan/drag was
 * already correct and explicitly out of scope ("pan with one finger is working and fine, i just want also 2
 * finger" — owner). The job is additive: while two fingers are down, the midpoint's travel should translate the
 * view at the same time the spread scales it.
 *
 * ⚠ ESTABLISHED LIVE, not assumed, before writing a line of gesture code (per the dispatch's own instruction to
 * check configuration first): the vendored Blockly's `Gesture.prototype.handlePinch`
 * (node_modules/blockly/blockly_compressed.js) computes ONLY a scale ratio from the two cached touch points'
 * distance and calls `workspace.zoom(x, y, amount)` — there is no translation call anywhere in it, and no
 * config key changes that. This is a genuine gap in the vendored build, not a missing flag — "possibly one
 * line" (the dispatch's own hope) turned out not to be the case.
 *
 * THE FIX (`web/blocks/blocksApp.js`, `twoFingerPan`): purely additive, mirroring the file's own pre-existing
 * `middlePan` (`ws.scroll(origin + delta)`). Confirmed live that Blockly's 2-touch branch
 * (`Gesture.prototype.handleTouchMove` → `handlePinch`) calls `preventDefault()` only, never
 * `stopPropagation()`, so a passive listener here on the same touch stream never fights it for control.
 *
 * ⛔ WHAT THIS SUITE CAN AND CANNOT PROVE, stated plainly rather than papered over (the dispatch's own explicit
 * instruction: "if you cannot drive a genuine two-finger gesture convincingly, say so plainly"): this harness
 * has no real multi-touch. These tests drive OUR OWN additive mechanism directly via synthetic `TouchEvent`s
 * (`touches`/`changedTouches`) and prove it computes and applies the correct pan delta, and that it never fires
 * for a single touch. What they CANNOT prove is Blockly's own pinch-zoom firing SIMULTANEOUSLY from the exact
 * same physical gesture — established by reading the compressed source that Blockly's own multi-touch gesture
 * recognition runs off POINTER events (`pointerdown`/`pointermove` on `document`, tracked by `pointerId` inside
 * its own `Gesture` lifecycle), not the legacy `TouchEvent`/`touches[]` API these tests use to drive OUR code.
 * A real touchscreen browser dispatches BOTH event families for the same physical touch (standard, well-
 * established behavior), so the two mechanisms should compose correctly on a real device — but that specific
 * composition could not be driven in this harness, and is flagged here as an owner device-check rather than a
 * claimed pass.
 */
test.use({ viewport: { width: 1400, height: 1000 } });

async function bootBlocks(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.ddcsStudio && window.showApp);
  await page.evaluate(() => window.showApp('blocks'));
  await page.waitForFunction(() => window.__blkws);
  await page.waitForTimeout(300);
}

const mkTouch = (id, x, y, target) => `new Touch({ identifier: ${id}, target, clientX: ${x}, clientY: ${y}, pageX: ${x}, pageY: ${y} })`;

test('two fingers translating in parallel (no spread change) pan the workspace by exactly the midpoint delta', async ({ page }) => {
  await bootBlocks(page);
  const r = await page.evaluate(() => {
    const ws = window.__blkws;
    const host = document.querySelector('.blocklySvg').closest('div.injectionDiv');
    const mk = (id, x, y) => new Touch({ identifier: id, target: host, clientX: x, clientY: y, pageX: x, pageY: y });
    const before = { x: ws.scrollX, y: ws.scrollY };
    const s0 = mk(1, 500, 500), s1 = mk(2, 700, 500);
    host.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [s0, s1], changedTouches: [s0, s1] }));
    // both fingers move +50x, +60y — a pure pan (distance between them is unchanged, so no zoom is implied)
    const m0 = mk(1, 550, 560), m1 = mk(2, 750, 560);
    host.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [m0, m1], changedTouches: [m0, m1] }));
    const after = { x: ws.scrollX, y: ws.scrollY };
    return { before, after };
  });
  expect(r.after.x - r.before.x, 'scrollX moved by exactly the midpoint\'s horizontal travel').toBe(50);
  expect(r.after.y - r.before.y, 'scrollY moved by exactly the midpoint\'s vertical travel').toBe(60);
});

test('a single touch never triggers the two-finger pan code (one-finger path stays untouched)', async ({ page }) => {
  await bootBlocks(page);
  const r = await page.evaluate(() => {
    const ws = window.__blkws;
    const host = document.querySelector('.blocklySvg').closest('div.injectionDiv');
    const mk = (id, x, y) => new Touch({ identifier: id, target: host, clientX: x, clientY: y, pageX: x, pageY: y });
    const before = { x: ws.scrollX, y: ws.scrollY };
    const s0 = mk(1, 500, 500);
    host.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [s0], changedTouches: [s0] }));
    const m0 = mk(1, 700, 700);
    host.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [m0], changedTouches: [m0] }));
    const after = { x: ws.scrollX, y: ws.scrollY };
    return { before, after };
  });
  expect(r.after, 'the touches.length===2 gate excludes a single touch entirely — no scroll change').toEqual(r.before);
});

test('re-baselines when a third finger joins or one of two lifts, instead of jumping', async ({ page }) => {
  await bootBlocks(page);
  const r = await page.evaluate(() => {
    const ws = window.__blkws;
    const host = document.querySelector('.blocklySvg').closest('div.injectionDiv');
    const mk = (id, x, y) => new Touch({ identifier: id, target: host, clientX: x, clientY: y, pageX: x, pageY: y });
    const before = { x: ws.scrollX, y: ws.scrollY };
    // two fingers down, pan by (50,60)
    let a = mk(1, 500, 500), b = mk(2, 700, 500);
    host.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [a, b], changedTouches: [a, b] }));
    a = mk(1, 550, 560); b = mk(2, 750, 560);
    host.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [a, b], changedTouches: [a, b] }));
    const afterFirstPan = { x: ws.scrollX, y: ws.scrollY };
    // a third finger joins — three touches is not the tracked gesture, no crash, no further pan from this move
    const c = mk(3, 900, 900);
    host.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [a, b, c], changedTouches: [c] }));
    // back to two (finger 2 lifted, 1 and 3 remain) — should RE-BASELINE at this new pair's current position,
    // not jump by the distance between finger 2's old spot and finger 3's spot
    host.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [a, c], changedTouches: [b] }));
    const afterRebaseline = { x: ws.scrollX, y: ws.scrollY };
    // now move the surviving pair by a further (10, 5) — only THIS delta should apply
    const a2 = mk(1, 560, 565), c2 = mk(3, 910, 905);
    host.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [a2, c2], changedTouches: [a2, c2] }));
    const afterSecondPan = { x: ws.scrollX, y: ws.scrollY };
    return { before, afterFirstPan, afterRebaseline, afterSecondPan };
  });
  expect(r.afterFirstPan.x - r.before.x).toBe(50);
  expect(r.afterFirstPan.y - r.before.y).toBe(60);
  expect(r.afterRebaseline, 'gaining/losing a finger re-baselines silently — no jump').toEqual(r.afterFirstPan);
  expect(r.afterSecondPan.x - r.afterRebaseline.x, 'only the new pair\'s own delta applies after re-baselining').toBe(10);
  expect(r.afterSecondPan.y - r.afterRebaseline.y).toBe(5);
});
