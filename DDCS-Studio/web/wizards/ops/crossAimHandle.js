/**
 * wizards/ops/crossAimHandle.js — the CROSS-AIM-HANDLE GUI block (t2583, BACKLOG #61's t2571 assessment, the
 * SECOND and last of its two sized gestures — canvasWidgets.js's own `crossAim` gesture: a hands-free in-axis
 * traverse TARGET, e.g. middle's own wall1→wall2 cross-over handle, ONE drag re-derives a single distance field).
 *
 * Same shape as `diag_aim_handle` (its own header has the full account, including the t2525 fix and the two
 * `anchorSources.js` primitives both gestures share): `field` is a MUST-MATCH PICKER naming an EXISTING param
 * an "Op Param" `formfield` elsewhere in the stack already binds — `handleBindingsFromStack`/`attach()` merges
 * this handle's anchor onto that real binding, so dragging reaches emit for real. `axisField`/`signField` are
 * the SAME read-only-companion doctrine `diag_aim_handle`'s own axisField/signField established: they name
 * EXISTING enum params read for their CURRENT VALUE only, never themselves written by this block, but still
 * must-match/fail-visibly. `axisField` picks which physical axis the traverse distance runs along ('X'/'Y');
 * `signField`+`signPosValue`+`signWhenPos` pick which wall face the traverse starts from (default: `signField`'s
 * value === 'pos' → +1/wall-at-0, else −1/wall-at-span — middle's own `dir1` convention exactly, expressible for
 * ANY future two-valued enum; note the OPPOSITE default sign of diagAim's own dir2 convention, matching each
 * gesture's own real-world usage rather than sharing a signWhenPos default arbitrarily).
 *
 * WHERE THIS GENUINELY DIFFERS (t2571's own assessment; this is its build — the harder half it flagged): beyond
 * diagAim's own two primitives (stock-relative span via `resolveAnchorCoord`'s `stockW`/`stockH` tokens, sign
 * via `resolveEnumSign`), canvasWidgets.js's own `crossAim` gesture needs `lineAt` — the LIVE world position of
 * ANOTHER declared pass along the PERPENDICULAR axis (the probe line the traverse target rides). t2571 traced
 * this to the SAME mechanism `relTo` already provides for `point`-kind handles (`resolveRelToIndex`+
 * `panelStarts`, wired via `formfield`'s own `relToRow` field) — this block carries the identical `relToRow`
 * (an EXISTING sim-start row id, e.g. 'wall1'), naming a declared pass rather than inventing a new reference
 * shape, and `panelTypes.js`'s new `anchor.kind==='crossAim'` branch reads the named pass's own live world
 * position off `panelStarts` (the SAME per-pass source the `point` relTo branch and the 3D marker both read) —
 * an EXTENSION of `relTo` to a non-point gesture, not a parallel mechanism. Middle's own hardcoded crossAim
 * decl-building further down `panelTypes.js` (untouched) is this block's own built-in twin, same relationship
 * diag_aim_handle has to Middle's own hardcoded diagAim.
 */
export const crossAimHandleBlock = {
    type: 'cross_aim_handle', label: 'cross aim handle', category: 'Wizard Layout', kind: 'cross_aim_handle',
    help: 'A draggable IN-AXIS TRAVERSE-TARGET handle on the feature canvas: one drag re-derives a single distance field, riding a wall-face-relative line at a stock-relative rest position by default. `field` must name an EXISTING "Op Param" form field elsewhere in the stack — dragging writes it for real (it reaches the emitted G-code). `axisField` must name an EXISTING enum param whose value is "X" or "Y" (which physical axis the traverse runs along). `signField` must name an EXISTING enum param whose CURRENT value picks the starting wall face — read-only, never written by this block. `relToRow` names an EXISTING declared sim-start row (e.g. "wall1") whose live position the handle rides perpendicular to — leave empty for a stock-centred default.',
    defaults: {
        field: 'cross', axisField: 'axis', signField: 'dir',
        signPosValue: 'pos', signWhenPos: '1', relToRow: '', label: '↔',
    },
    fields: ['field', 'axisField', 'signField', 'signPosValue', 'signWhenPos', 'relToRow', 'label'],
    emit: () => [],   // metadata only — the BLOCK produces no G-code itself; the param it names (once resolved) does, via the merged real binding
};
