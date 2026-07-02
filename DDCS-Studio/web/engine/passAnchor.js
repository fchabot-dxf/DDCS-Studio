/**
 * drawAnchorFor — resolve a pass's ROUTE / sim-collision DRAW-ANCHOR from the per-pass starts array (t94).
 *
 * A per-pass start row carries its MARKER position {x,y,z} — where the draggable sprite/handle sits. For corner's
 * reposition passes that marker is the probe-FIRE NET ENDPOINT (wall_N = wall_{N-1} + cross). But the ROUTE, and the
 * sim's probe-vs-stock collision origin `O`, must emanate from where that pass's PROGRAMMED move BEGINS. For an AUTO
 * reposition pass the connecting dog-leg emits INCREMENTALLY after the `reposition:` pos-reset, so the pass draws from
 * the PREVIOUS pass's start (the re-park point); using the net-endpoint marker as the origin double-counts the +cross
 * (the disconnect + the sim firing at the wrong point). The provider DECLARES `anchorsAtPrev` on exactly those rows.
 *
 * Every OTHER pass — pass 0, a MANUAL jog (no programmed dog-leg; the operator re-parks at its own marker and the jog
 * line bridges), and any NON-CORNER op (no flag at all) — anchors at its OWN marker. That is the FALLBACK, and it MUST
 * stay byte-for-byte as today: this helper is the single place the fallback lives so no consumer can get it wrong (an
 * unconditional `row.anchor` at any of the 3 read sites would feed non-corner ops undefined → NaN = an all-ops regression).
 *
 * Resolved LIVE from the CURRENT `starts` array (not a frozen snapshot) so dragging marker[N-1] re-drags pass-N's route.
 * PREVIEW/SIM only — never emitted (byte-parity untouched).
 *
 * @returns the anchor row (`starts[pass-1]` when flagged, else `starts[pass]`), or the row's own value / undefined so
 *   the caller's existing `|| _stockOffset` / `|| stockPin()` / `|| {0,0,0}` fallback still applies.
 */
export function drawAnchorFor(starts, pass) {
    const row = starts && starts[pass];
    if (!row) return row;   // absent pass → let the caller's own fallback take over
    return (row.anchorsAtPrev && pass > 0 && starts[pass - 1]) ? starts[pass - 1] : row;
}
