/**
 * wizards/ops/pointHandle.js — the POINT-HANDLE GUI block (t2521, BACKLOG #71's second gesture — the mill
 * family's own POSITION handle: a corner/edge/probe-start "pos" dot).
 *
 * Same shape as `length_handle` (its own header has the full account, including the t2525 fix): `fx`/`fy` are
 * MUST-MATCH PICKERS naming EXISTING params two "Op Param" `formfield` blocks elsewhere in the stack already
 * bind — `handleBindingsFromStack`/`attach()` merges this handle's anchor onto each real binding, so dragging
 * reaches emit for real. Nests inside `feature_canvas`'s own mouth, fixed literal anchor (ax/ay).
 *
 * WHERE IT DIFFERS FROM LENGTH: this gesture already had ONE render-side branch
 * (`anchor.kind === 'point'`, panelTypes.js), reached today only by `layoutwidget` (nested in `param_group`,
 * always anchored at {0,0} — its own `frame` field selects a coordinate FRAME, never a literal offset). Rather
 * than declare a second, parallel anchor kind, this block reuses that SAME branch: `layoutSpecFromOp`'s own
 * `pos()` helper already took an `(ax, ay)` pair, just always called with none — extended (this turn) to read
 * an optional `anchor.ax`/`anchor.ay`/`anchor.label` off the group, defaulting to `(0, 0, 'pos')` so
 * `layoutwidget`'s own existing behaviour is byte-identical. TWO bound params (fx/fy), not one — matching the
 * gesture's own two-field shape, same as `layoutwidget`'s.
 *
 * t2677 (BACKLOG #71/#72's own Phase 2 board, proposal (c)) — `relToRow`, EXTENDING the already-shipped
 * `cross_aim_handle` precedent (t2583) to this block's own kind: names an EXISTING declared `simstart` row
 * (must-match picker, `RELTO_TARGET_FIELDS` in bridge.js) whose LIVE position this handle anchors to instead
 * of the fixed literal `ax`/`ay` — the SAME `resolveRelToIndex`/`markerWorldOf` resolution the role-tagged
 * fallback branch and `cross_aim_handle` already use, ONE implementation reached through TWO entrances
 * (panelTypes.js's `anchor.kind==='point'` branch), never a second, parallel resolver. Empty (default) =
 * byte-identical to before — a fixed literal anchor, unchanged.
 *
 * t2679 (Phase 2 board, proposal (a), owner-designed authoring face — SUPERSEDES an earlier value-SOCKET +
 * `form_variable` REPORTER-BLOCK design, built and then shelved mid-turn: the owner's own words, "authoring
 * should be as natural as possible — not literal world names, a SEARCH BOX for allowed values in the input
 * itself") — `ax`/`ay` stay plain FIELDS, now a SEARCHABLE VALUE field (`field_anchor_value`,
 * `anchorValueField.js` — its own header carries the full design). Type a number, it commits as a number
 * (unchanged from before); type letters, it searches this def's own bound FORM PARAMS (shown by their own
 * form LABEL) plus this def's own preview MARKERS (this block's own `relToRow` field's identical candidate
 * pool) and commits ONLY from that list. Resolved at render time by `panelTypes.js`'s own
 * `markerAnchorCoord`/`resolveAnchorCoord` (anchorSources.js) — `userOps.js`'s `handleBindingsFromStack`
 * keeps ax/ay RAW (a number or a name string) all the way through, same "raw at derive" doctrine either way.
 */
export const pointHandleBlock = {
    type: 'point_handle', label: 'point handle', category: 'Wizard Layout', kind: 'point_handle',
    help: 'A draggable 2D POINT handle on the feature canvas, at a fixed anchor (ax, ay) — type a number for a literal, or search for an existing form param/marker to follow its live value — or, with `relToRow` set, anchor the WHOLE handle to an EXISTING declared sim-start row\'s own LIVE position instead. `fx`/`fy` must each name an EXISTING "Op Param" form field elsewhere in the stack — dragging writes them for real (it reaches the emitted G-code).',
    defaults: { fx: 'px', fy: 'py', x: '40', y: '60', ax: 0, ay: 0, relToRow: '', label: 'pos' },
    fields: ['fx', 'fy', 'x', 'y', 'ax', 'ay', 'relToRow', 'label'],
    emit: () => [],   // metadata only — the BLOCK produces no G-code itself; the params it names (once resolved) do, via the merged real bindings
};
