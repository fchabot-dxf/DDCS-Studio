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
 *     `popReturn(tok)` — which runs `reopenFn` only if `tok` is still the TOP of the stack. If the destination
 *     instead navigates onward (or is replaced by a fresh open), it calls `dropReturn(tok)` so the path doesn't leak.
 *
 * t2192 — A REAL STACK, not a bare depth-1 slot: this file's own header used to say "swap `_live` for an array to
 * nest without changing the call sites" when a real nested flow arrived, and one has (Settings → the wizard/project
 * manager → Settings again, no depth limit, a cycle is just more entries). Token-matched still holds, generalised:
 * a destination can only ever fire the return CURRENTLY ON TOP, so a stale token from an abandoned flow further
 * down the stack can never fire out of turn or reopen the wrong screen. Every existing call site (openHomingSetup,
 * openAtcSetup, the Setup checklist, …) is unchanged — they still only ever push/pop the one level relative to
 * themselves, which is exactly a depth-1 stack.
 */
const _stack = [];   // [{ id, label, fn }, …] — top of stack (last element) is the one that can fire next
let _seq = 0;

/** Register "how to get back to me". Returns an opaque token the destination passes back to popReturn/dropReturn. */
export function pushReturn(label, fn) {
    const entry = { id: ++_seq, label, fn };
    _stack.push(entry);
    return entry.id;
}

/** If `token` is the TOP of the stack, pop it and run its reopen fn. Returns true if it fired. */
export function popReturn(token) {
    const top = _stack[_stack.length - 1];
    if (top && top.id === token) {
        _stack.pop();
        try { top.fn(); } catch (_) { /* a broken reopener must not wedge the close */ }
        return true;
    }
    return false;
}

/** Discard `token` if it's the top of the stack, without running it (the user navigated onward instead of back). */
export function dropReturn(token) {
    const top = _stack[_stack.length - 1];
    if (top && top.id === token) _stack.pop();
}

/** Inspect the live (topmost) return (label only) — for debugging / "where will Back go?". */
export function activeReturn() {
    const top = _stack[_stack.length - 1];
    return top ? { label: top.label } : null;
}

// Debug handle: `window.ddcsNavReturn.activeReturn()` to see the live return target.
if (typeof window !== 'undefined') window.ddcsNavReturn = { activeReturn, pushReturn, popReturn, dropReturn };
