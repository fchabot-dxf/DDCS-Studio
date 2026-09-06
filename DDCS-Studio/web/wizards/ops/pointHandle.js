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
 *
 * t2681 — THE FACE, made readable (the owner: search approved, but "field fx fy x y ax ay relToRow label" is
 * a wall of engineer names). Same `dynamic`/`fieldsFor`/`labels` precedent `formField.js` already established
 * (its own header has the full account): `allFields` declares every field the block CARRIES (unchanged data
 * model, round-trip unaffected); `fieldsFor` returns only what a person authoring actually needs to SEE.
 *   - `x`/`y` are ALWAYS excluded — read directly off `handleBindingsFromStack` (userOps.js): it never reads
 *     `p.x`/`p.y` at all. They exist ONLY as a display snapshot `handleBindingsToBlocks`'s own REVERSE
 *     direction writes when regenerating a block from live bindings (mirrors `length_handle`'s own `value`
 *     field) — editing them is a silent no-op, so per the dispatch's own "never authored, drop from the
 *     face" rule they are gone from the visible face entirely (still present in the data model — a round-
 *     trip through save/load still carries whatever value they hold).
 *   - `ax`/`ay` are a REAL mode split on `relToRow` (the `dynamic` driver): `panelTypes.js`'s own declared
 *     `anchor.kind==='point'` branch reads `relToRow` FIRST and, if it resolves, `continue`s WITHOUT EVER
 *     TOUCHING `ax`/`ay` — they are genuinely inert, not merely redundant, the instant `relToRow` is set. So
 *     `fieldsFor` shows ax/ay ONLY while `relToRow` is empty; `relToRow` itself always stays visible (it is
 *     the mode SWITCH — hiding it would remove the only way to turn relative-anchoring on).
 * `labels` (t2385, face-only — storage keys unchanged) use the owner's own SETTLED read/write vocabulary
 * (amendment to t2681, mid-turn — the words a person sees ARE how they learn the model, so the SAME pair
 * every future value-following field should reuse, never a third synonym): `fx`/`fy` → "writes x"/"writes y"
 * (the two params dragging WRITES), `ax`/`ay` → "reads x"/"reads y" (the searchable field READS its value
 * from wherever it's pointed — a literal, a form param, or a marker), `relToRow` → "relative to", `label` →
 * "name".
 */
export const pointHandleBlock = {
    type: 'point_handle', label: 'point handle', category: 'Wizard Layout', kind: 'point_handle',
    help: 'A draggable 2D POINT handle on the feature canvas, at a fixed anchor (ax, ay) — type a number for a literal, or search for an existing form param/marker to follow its live value — or, with `relToRow` set, anchor the WHOLE handle to an EXISTING declared sim-start row\'s own LIVE position instead. `fx`/`fy` must each name an EXISTING "Op Param" form field elsewhere in the stack — dragging writes them for real (it reaches the emitted G-code).',
    dynamic: ['relToRow'],
    defaults: { fx: 'px', fy: 'py', x: '40', y: '60', ax: 0, ay: 0, relToRow: '', label: 'pos' },
    allFields: ['fx', 'fy', 'x', 'y', 'ax', 'ay', 'relToRow', 'label'],
    labels: { fx: 'writes x', fy: 'writes y', ax: 'reads x', ay: 'reads y', relToRow: 'relative to', label: 'name' },
    fieldsFor(p) {
        const f = ['fx', 'fy'];
        if (!((p && p.relToRow) || '')) f.push('ax', 'ay');   // inert once relToRow resolves (panelTypes.js never reads them) — hide
        f.push('relToRow', 'label');
        return f;
    },
    emit: () => [],   // metadata only — the BLOCK produces no G-code itself; the params it names (once resolved) do, via the merged real bindings
};
