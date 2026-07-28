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
