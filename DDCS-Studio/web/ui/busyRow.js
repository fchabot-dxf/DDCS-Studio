/**
 * ui/busyRow.js — "this one is opening" (t1257, user live report: clicking a workspace lags with no feedback).
 *
 * THE RULE: a click that starts an async open shows feedback ON THE THING CLICKED, immediately. Not a global overlay
 * (which says "the app is busy" when only one row is), not a spinner on instant actions (which teaches people that
 * the app is slow when it is not) — a glyph on the row you pressed, for exactly as long as the wait is real.
 *
 * IT ALSO DISABLES THE ROW, which is the half that is easy to forget: a row with no busy state invites a second click,
 * and two opens of the same workspace race each other through restore. The busy state IS the guard.
 *
 * The glyph deliberately survives until the surface goes away. A workspace open ends in `location.reload()`, so
 * clearing the glyph on completion would leave a dead gap — spinner stops, nothing happens, page reloads a beat later.
 * `busyRow` clears only on a failure path (a named refusal is the feedback then) or when the caller says so.
 *
 * ── THE ONE EXCEPTION, ruled by the user (t1283) ────────────────────────────────────────────────────────────────
 * A WORKSPACE OPEN gets a CENTRED overlay as well. The no-global-overlay stance above is about honesty — an overlay
 * that says "the app is busy" while only one row is would be a lie. On a workspace open it is not a lie: the open
 * ends in `location.reload()`, so the whole app really is going away, and a centred glyph is both the truthful
 * signal and the thing that bridges the gap until the new page paints.
 *
 * The row state STAYS — it is the double-click guard, and that guard is load-bearing (two opens of one workspace
 * race each other through restore). What changes is where the person LOOKS: the centre, where they already are.
 *
 * LIBRARY IMPORTS KEEP THE ROW GLYPH and get no overlay: those finish on the same screen, so a global overlay there
 * would claim a busyness the app does not have. The distinction is not the wait, it is whether the app survives it.
 */
const BUSY = 'is-busy';

/**
 * Mark `el` busy and run `fn`. Returns whatever `fn` returns.
 * @param {HTMLElement} el   the row/card that was clicked
 * @param {() => Promise<any>} fn  the async open
 * @param {{keepOnSuccess?: boolean}} [opts]  keepOnSuccess (default true) leaves the glyph up on success, because a
 *   successful open usually replaces the page; a false here is for opens that stay on the same screen.
 */
export async function busyRow(el, fn, { keepOnSuccess = true } = {}) {
    if (!el) return fn();
    if (el.classList.contains(BUSY)) return undefined;   // already opening: a second click is not a second open
    setBusy(el, true);
    try {
        const r = await fn();
        if (!keepOnSuccess || r === false) setBusy(el, false);   // r === false: the open was declined/aborted, screen stays
        return r;
    } catch (e) {
        setBusy(el, false);   // a failure shows a named refusal — the glyph must not sit on top of it
        throw e;
    }
}

/** The busy state itself: a class the stylesheet draws the glyph from, plus the real interaction guards. */
export function setBusy(el, on) {
    if (!el) return;
    el.classList.toggle(BUSY, !!on);
    if (on) {
        el.setAttribute('aria-busy', 'true');
        el.style.pointerEvents = 'none';
    } else {
        el.removeAttribute('aria-busy');
        el.style.pointerEvents = '';
    }
}

export const isBusy = (el) => !!(el && el.classList.contains(BUSY));

/**
 * THE CENTRED OVERLAY for an open that ends the page. Shown for as long as the app has left to live — it is never
 * cleared on success, because success here means the page reloads out from under it.
 * @param {string} label  what is being opened, in the user's words
 * @returns {() => void} a dismiss, for the failure path (where a named refusal becomes the feedback instead)
 */
export function busyOverlay(label) {
    if (typeof document === 'undefined') return () => {};
    const prev = document.getElementById('ddcs-busy-overlay');
    if (prev) prev.remove();
    const el = document.createElement('div');
    el.id = 'ddcs-busy-overlay';
    el.className = 'ddcs-busy-overlay';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `<div class="ddcs-busy-card"><div class="ddcs-busy-spin" aria-hidden="true"></div><div class="ddcs-busy-text"></div></div>`;
    el.querySelector('.ddcs-busy-text').textContent = label ? `Opening ${label}…` : 'Opening…';
    document.body.appendChild(el);
    return () => { try { el.remove(); } catch (_) {} };
}
