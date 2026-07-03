/**
 * passAnchorFor / drawAnchorFor — resolve a pass's ROUTE / sim-collision DRAW-ANCHOR (t94 · t107 machine-faithful).
 *
 * A per-pass start row carries its MARKER position {x,y,z} — where the draggable sprite/handle sits. For corner's
 * reposition passes that marker is the probe-FIRE NET ENDPOINT (wall_N). But the ROUTE, and the sim's probe-vs-stock
 * collision origin `O`, must emanate from where that pass's PROGRAMMED move BEGINS. For an AUTO reposition pass the
 * connecting dog-leg emits INCREMENTALLY after the `reposition:` pos-reset. The provider DECLARES `anchorsAtPrev` on
 * exactly those rows.
 *
 *   • t94 (drawAnchorFor / ends absent): the flagged pass anchors at the PREVIOUS pass's START marker `starts[pass-1]`
 *     (the re-park point). This CLOSED the gross +cross double-count (the marker was correct, the route drew +cross past
 *     it). But the START marker is the wall-1 probe START — the dog-leg still visibly emanated one probe-distance short
 *     of where the tool ACTUALLY ends (post probe+retract+lift).
 *   • t107 (passAnchorFor, ends present): the flagged pass anchors at the RUNTIME END of the previous pass —
 *     `ends[pass-1]`, the collision-clamped world position the trace/engine actually reaches after probe+retract+lift
 *     (incl the Z-trust lift jogged_Z+#19). So the dog-leg draws FROM where the tool is, ENDS on the (relocated)
 *     marker, and the probe fires there — route-anchor, marker, and #1925-1927 all read this ONE value (coherent by
 *     construction). `ends` comes from the trace (GcodeExecutionEngine publishes it); when it's absent or the entry is
 *     not yet computed, this DEGRADES to the t94 static-start behavior (so non-corner ops + the pre-trace pass are
 *     byte-identical).
 *
 * Every OTHER pass — pass 0, a MANUAL jog (no programmed dog-leg), any NON-CORNER op (no flag) — anchors at its OWN
 * marker. That FALLBACK MUST stay byte-for-byte as today: this helper is the single place it lives so no consumer can
 * get it wrong (an unconditional `row.anchor` at a read site would feed non-corner ops undefined → NaN = an all-ops
 * regression). Resolved LIVE from the CURRENT arrays. PREVIEW/SIM only — never emitted (byte-parity untouched).
 *
 * @param ends  per-pass runtime world-END positions (from the trace), or null/absent → t94 static-start behavior.
 * @returns the anchor {x,y,z} row, or the row's own value / undefined so the caller's existing `|| _stockOffset` /
 *   `|| stockPin()` / `|| {0,0,0}` fallback still applies.
 */
export function passAnchorFor(starts, ends, pass) {
    const row = starts && starts[pass];
    if (!row) return row;   // absent pass → let the caller's own fallback take over
    if (row.anchorsAtPrev && pass > 0) {
        const end = ends && ends[pass - 1];
        if (end) return end;                             // t107 — runtime END of the previous pass (machine-faithful)
        if (starts[pass - 1]) return starts[pass - 1];   // t94 fallback — static previous START (ends not yet computed)
    }
    return row;   // self (pass 0 / manual / non-corner)
}

// t94 shape — no runtime ends → the static-start behavior, byte-identical to before t107 (one source: passAnchorFor).
export function drawAnchorFor(starts, pass) {
    return passAnchorFor(starts, null, pass);
}
