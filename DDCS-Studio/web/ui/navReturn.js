/**
 * ui/navReturn.js — central back-navigation ("return path").
 *
 * Many screens deep-link elsewhere and want the user dropped back where they came from when they're done — e.g.
 * the Setup checklist sends you into Settings / the Stock popover, and closing those should land you back in the
 * checklist. Rather than each destination hard-coding "reopen the checklist", the SOURCE registers how to get
 * back to itself, and the destination returns to it on an explicit, user-initiated close.
 *
 * Contract:
 *   - The SOURCE calls `const tok = pushReturn(label, reopenFn)` BEFORE navigating away, and hands `tok` to the
 *     destination (via its open() options).
 *   - The destination keeps `tok` for its session. On a user CLOSE (✕ / Done / Esc / scrim) it calls
 *     `popReturn(tok)` — which runs `reopenFn` only if `tok` is still the live entry. If the destination instead
 *     navigates onward (or is replaced by a fresh open), it calls `dropReturn(tok)` so the path doesn't leak.
 *
 * Why token-matched (not a bare stack): a destination can only ever fire the CURRENTLY live return, so a flag
 * left over from an abandoned flow can never reopen the wrong screen. Depth-1 today (one live return), which is
 * all the current flows need; swap `_live` for an array to nest without changing the call sites.
 */
let _live = null;   // { id, label, fn } — the single live return target, or null
let _seq = 0;

/** Register "how to get back to me". Returns an opaque token the destination passes back to popReturn/dropReturn. */
export function pushReturn(label, fn) {
    _live = { id: ++_seq, label, fn };
    return _live.id;
}

/** If `token` is the live return, clear it and run its reopen fn. Returns true if it fired. */
export function popReturn(token) {
    if (_live && _live.id === token) {
        const fn = _live.fn;
        _live = null;
        try { fn(); } catch (_) { /* a broken reopener must not wedge the close */ }
        return true;
    }
    return false;
}

/** Discard `token` if it's the live return, without running it (the user navigated onward instead of back). */
export function dropReturn(token) {
    if (_live && _live.id === token) _live = null;
}

/** Inspect the live return (label only) — for debugging / "where will Back go?". */
export function activeReturn() {
    return _live ? { label: _live.label } : null;
}

// Debug handle: `window.ddcsNavReturn.activeReturn()` to see the live return target.
if (typeof window !== 'undefined') window.ddcsNavReturn = { activeReturn, pushReturn, popReturn, dropReturn };
