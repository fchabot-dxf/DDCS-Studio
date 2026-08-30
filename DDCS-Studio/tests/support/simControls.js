/**
 * tests/support/simControls.js — t1792 (Addition 8, screenshot baselines), extended at t1794 (baseline hygiene).
 *
 * Both the modal's and the pane's 3D/2D visualization panels auto-play AND loop by default (`.pp-run.on` +
 * `.pp-loop.on` on open) — confirmed live: three successive screenshots of a freshly-opened corner wizard were
 * never byte-identical, and the DRO readout (echoed into BOTH the 3D overlay and the bottom Layout-2D pane)
 * visibly advanced between shots (Y -34.200 → -24.993 → ...). `.pp-run`'s own title says "click to stop and
 * reset to the start" — clicking it while running does exactly that.
 */

/** Click the panel's own Run/Stop toggle (while running, this stops AND resets to the start) inside `scope`.
 *  Returns true if it stopped a running sim, false if none ever started within `timeout`.
 *
 *  t2419 (BACKLOG #56) — WHY THIS POLLS instead of checking once. The original was a single `.pp-run.on`
 *  lookup, which encodes an assumption that is false under load: that the panel is ALREADY PLAYING by the
 *  time we look. The panels auto-play ON MOUNT (header above) — so when a contended worker is slow, the
 *  helper looks a beat too early, finds no `.on`, returns false, and does NOTHING. The sim then starts and
 *  repaints straight through the caller's next click, which is precisely the actionability flake
 *  `open-as-modal-1625.spec.js`'s "A REAL OPEN AFTER A PREVIEW…" showed on four consecutive full-suite runs
 *  while passing 3/3 in isolation every time. Isolation is exactly the condition where the one-shot check
 *  happens to be right, which is why the bug hid: the test was correct about WHAT to do and wrong about WHEN.
 *
 *  ⚠ COST: nil in the common case — the sim IS playing, the first poll clicks it and returns immediately.
 *  The wait is only paid where no sim ever plays, and it is bounded. Do not raise the default casually:
 *  every caller pays it in that case, and a long tail here is a slow suite, not a safer one. */
export async function stopLiveSim(page, scope, { timeout = 2000 } = {}) {
    const deadline = Date.now() + timeout;
    for (;;) {
        const stopped = await page.evaluate((sel) => {
            const root = document.querySelector(sel);
            const btn = root && root.querySelector('.pp-run.on');
            if (btn) { btn.click(); return true; }
            return false;
        }, scope);
        if (stopped) return true;
        if (Date.now() >= deadline) return false;
        await page.waitForTimeout(100);
    }
}

/** t1794 — a real INSERT fires `showRoundTripToastOnce()` (wizardManager.js:72), the shared transient toast
 *  (`ui/gateway/util.js:20-24`: `document.body.append(t); setTimeout(() => t.remove(), 3200)`). It landed
 *  INSIDE the pane baseline (a fresh test page has never set the `ddcs_seen_blocks_roundtrip` localStorage
 *  flag, so the ONE-TIME toast fires every run) — a 3.2s-lifetime, page-body-level element with no relation to
 *  the baselined region's own content, so its remaining lifetime at screenshot time (not its presence) is what
 *  made the diff timing-dependent on a slower machine. Removes it OUTRIGHT (not a wait past 3200ms — that only
 *  trades a fast flake for a slow one) so no toast can ever be in frame regardless of how long the action
 *  before it took. Generic by class (`.toast`), not scoped to the round-trip one specifically, since `toast()`
 *  is the app's ONE shared transient-message mechanism — this clears whichever toast, if any, is showing. */
export async function dismissToasts(page) {
    await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
}
