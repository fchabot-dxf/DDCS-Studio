/**
 * tests/support/simControls.js — t1792 (Addition 8, screenshot baselines).
 *
 * Both the modal's and the pane's 3D/2D visualization panels auto-play AND loop by default (`.pp-run.on` +
 * `.pp-loop.on` on open) — confirmed live: three successive screenshots of a freshly-opened corner wizard were
 * never byte-identical, and the DRO readout (echoed into BOTH the 3D overlay and the bottom Layout-2D pane)
 * visibly advanced between shots (Y -34.200 → -24.993 → ...). `.pp-run`'s own title says "click to stop and
 * reset to the start" — clicking it while running does exactly that.
 */

/** Click the panel's own Run/Stop toggle (while running, this stops AND resets to the start) inside `scope`,
 *  if a running one exists. No-op (returns false) if the panel isn't currently playing. */
export async function stopLiveSim(page, scope) {
    return page.evaluate((sel) => {
        const root = document.querySelector(sel);
        const btn = root && root.querySelector('.pp-run.on');
        if (btn) { btn.click(); return true; }
        return false;
    }, scope);
}
