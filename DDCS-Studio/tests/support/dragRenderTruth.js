import { expect } from '@playwright/test';

/**
 * tests/support/dragRenderTruth.js — t2461 (BACKLOG #61, ARC A "Preview as data" — the GATE, built first per
 * the roadmap's own condition). Promotes `web/debug/featProbe.js`'s own pattern — and the ad-hoc measurement
 * code `tests/commit-on-release-2429.spec.js` (t2429/t2447) already proved working — from one spec's private
 * inline code into a REUSABLE harness any preview spec can call, mirroring `blocks/dataOps/equivalence.js`'s
 * own shape (one small module, a clear contract, no DOM inside the module itself — the DOM read happens via
 * `page.evaluate` with a self-contained function, same convention `drawingCheck.js` already established).
 *
 * WHAT THIS PROVES, precisely (established from the FIVE real defects the owner found this week, not from a
 * general theory of previews — the dispatch's own instruction): a drag-handle's REAL RENDERED position
 * (`getBoundingClientRect()`, not a data attribute or "did render() fire" proxy) must (a) track the pointer
 * substantially during the drag, and (b) still be near where the drag visually left it once the pointer is
 * released — never snap back toward the start. This is EXACTLY the two-defect class already fixed and covered
 * ad-hoc in `commit-on-release-2429.spec.js`: "the drag not following the finger" (t2447's own move-kind
 * undershoot — a 256px drag settling ~35px away) and "the value reverting on release" (a deferred commit's own
 * one render landing against stale/refit geometry). See that file's own header for the full defect history.
 *
 * WHAT THIS DOES **NOT** COVER (named plainly, not implied) — a different, SMALLER primitive is needed for
 * each, deliberately NOT built this turn (BACKLOG #61 sizes both separately):
 *   - "the missing pane sizer" — an ELEMENT-ABSENCE bug (an expected affordance never renders at all). This
 *     harness assumes the element exists to measure; it cannot assert something is present that isn't. Needs a
 *     declared affordance-manifest + a presence check.
 *   - "the pane sizing from the window instead of itself" — a container-query-vs-viewport-query CSS bug on a
 *     pane's OWN dimensions, not a drag-handle's position. Needs a computed-style/dimension assertion under a
 *     resized-host harness. Arguably not preview-specific at all.
 *   - "the flyout landing in a corner" — philosophically the same "assert real rendered geometry" family, but
 *     mechanically a STATIC position-relative-to-trigger claim (no drag gesture involved), not this primitive.
 *     Not acceptance-tested this turn: no specific fix commit for it was located to genuinely revert-and-prove
 *     against (the acceptance-test discipline below refuses to claim coverage it hasn't shown red on a real
 *     bug) — named as a real gap in the harness's own scope, not silently folded in.
 */

/** Self-contained (no outer closure) — passed to `page.evaluate` as a function reference, same convention
 *  `drawingCheck.js`'s own `sampleCanvas` uses. Reads a feature-canvas handle's REAL screen-space center,
 *  keyed by its stable `data-hid` (the same identity `featProbe.js` re-queries by every frame, since a cached
 *  reference goes stale the instant `render()` replaces the DOM node it points at). */
export const readHandleRect = (hid) => {
    const el = document.querySelector(`.fc-handle[data-hid="${hid}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
};

/** The handle's real rendered center, right now. Returns null if the handle isn't in the DOM. */
export async function handleScreenPos(page, hid) {
    return page.evaluate(readHandleRect, hid);
}

/**
 * Drag a feature-canvas handle by a real pointer delta, sampling its REAL rendered position before, mid-drag,
 * and after release/settle. Uses `page.mouse` (real synthetic pointer events, not a programmatic field write —
 * the whole point is to exercise the SAME gesture path a human drag takes).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} hid                 the handle's `data-hid`
 * @param {object} opts
 * @param {number} opts.dx             total horizontal pointer delta (px)
 * @param {number} opts.dy             total vertical pointer delta (px)
 * @param {number} [opts.steps=10]     number of intermediate mouse-move frames
 * @param {number} [opts.frameDelayMs=16]  wait between frames (one paint tick)
 * @param {number} [opts.settleMs=400] the MINIMUM wait after pointer-up before sampling the "after" position —
 *                                     long enough to catch a POST-release snap-back (t2447's own bug lands
 *                                     exactly here, one render after `active` goes null). t2667 (BACKLOG #57's
 *                                     own scaling-budget class, root-caused): a FIXED sleep races real wall-
 *                                     clock render completion — fine uncontended, but under the full suite's
 *                                     real 4-worker contention the paint the sleep was timed for can still be
 *                                     mid-flight when it ends, sampling a transient position instead of the
 *                                     settled one (the recurring `sf-pos-snapback` load-flake, clean in every
 *                                     isolated run this session and many prior ones). Now POLLS the handle's
 *                                     own rect until two consecutive samples agree (settled), instead of
 *                                     trusting the clock — waits exactly as long as the render actually takes,
 *                                     never less (still catches a real snap-back, which settles at the WRONG
 *                                     place, not never), never blocked by contention eating a fixed budget.
 * @returns {{before:{x,y}, mid:{x,y}, after:{x,y}}}  real screen positions; throws if the handle never appears
 */
export async function dragHandleRenderTruth(page, hid, { dx, dy, steps = 10, frameDelayMs = 16, settleMs = 400 } = {}) {
    const handle = page.locator(`.fc-handle[data-hid="${hid}"]`);
    await handle.waitFor({ state: 'visible', timeout: 5000 });
    const before = await handleScreenPos(page, hid);
    if (!before) throw new Error(`dragHandleRenderTruth: handle "${hid}" has no rendered rect`);

    await page.mouse.move(before.x, before.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
        await page.mouse.move(before.x + (dx * i) / steps, before.y + (dy * i) / steps, { steps: 2 });
        await page.waitForTimeout(frameDelayMs);
    }
    const mid = await handleScreenPos(page, hid);
    await page.mouse.up();
    await page.waitForTimeout(settleMs);   // the minimum settle every existing call already tunes per-gesture
    const after = await settledHandleScreenPos(page, hid);

    return { before, mid, after };
}

/** t2667 — poll `handleScreenPos` until two consecutive samples (50ms apart) report the SAME position (≤0.5px),
 *  or `ceilingMs` elapses (a genuinely-stuck/never-settling render, itself worth surfacing rather than hidden
 *  behind an infinite wait). Ceiling generous on purpose (4s): this only extends the wait when contention
 *  actually starves the render, and a real defect that never settles still fails the SAME assertion afterward
 *  — polling longer costs nothing but wall-clock, it can never turn a genuine bug green. */
async function settledHandleScreenPos(page, hid, ceilingMs = 4000) {
    const pollMs = 50;
    let prev = await handleScreenPos(page, hid);
    const deadline = Date.now() + ceilingMs;
    while (Date.now() < deadline) {
        await page.waitForTimeout(pollMs);
        const cur = await handleScreenPos(page, hid);
        if (prev && cur && Math.hypot(cur.x - prev.x, cur.y - prev.y) <= 0.5) return cur;
        prev = cur;
    }
    return prev;
}

/**
 * THE GATE ASSERTION. Given the three sampled positions from `dragHandleRenderTruth`, assert the render was
 * FAITHFUL to the drag: the handle moved substantially while dragging (catches "drag not following the
 * finger"), and its post-release position did not snap back toward the start (catches "value reverting on
 * release" — the visual correlate; pair with a model-value check when the op's committed param is known, see
 * `assertModelMatchesRender` below).
 *
 * @param {{before,mid,after}} positions  from dragHandleRenderTruth
 * @param {object} [opts]
 * @param {number} [opts.minTrackedPx=40]    the handle must have moved at least this far from `before` by `mid`
 * @param {number} [opts.maxSnapbackPx=5]    `after` must be within this many px of `mid` MINUS this tolerance
 *                                           (mirrors commit-on-release-2429.spec.js's own proven tolerance,
 *                                           `movedAfter > movedMid - 5`) — a real snap-back fails this loudly;
 *                                           ordinary settle jitter (sub-pixel) does not.
 * @param {string} [opts.label='drag']       included in every assertion message
 */
export function assertDragRenderFaithful({ before, mid, after }, { minTrackedPx = 40, maxSnapbackPx = 5, label = 'drag' } = {}) {
    const movedMid = Math.hypot(mid.x - before.x, mid.y - before.y);
    const movedAfter = Math.hypot(after.x - before.x, after.y - before.y);
    expect(movedMid, `${label}: the handle must track the pointer substantially during the drag (moved ${movedMid.toFixed(1)}px, wanted ≥${minTrackedPx}px) — "the drag not following the finger"`).toBeGreaterThan(minTrackedPx);
    expect(movedAfter, `${label}: post-release position (moved ${movedAfter.toFixed(1)}px from start) must not snap back from mid-drag (${movedMid.toFixed(1)}px) — "the value reverting on release"`).toBeGreaterThan(movedMid - maxSnapbackPx);
}
