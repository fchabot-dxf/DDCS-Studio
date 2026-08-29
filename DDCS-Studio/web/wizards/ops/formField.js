/**
 * wizards/ops/formField.js — the FORM value-field GUI block (composable-authoring PILOT 1).
 *
 * The blocks-native twin of a BINDING_SPEC row (blocks/dataOps/deriveBindings.js): each block declares ONE wizard
 * FORM field bound to a macro var — the composable form. It lives in the `user_root` PRESENTATION mouth alongside
 * `panel`/`sim`/`simstart`/`param_group`, and EMITS NOTHING: it's metadata read at register/save time by
 * userOps.bindingsFromStack → def.bindingSpecs (the socket link is by BLOCK IDENTITY — match/key — NOT a param-name
 * join — deriveBindings re-finds the flat index over the pruned stack). The reverse (bindingsToBlocks) renders a
 * hand-written spec set AS these blocks so a ported wizard is authorable/re-authorable.
 *
 * ── t1640 — TWO DECLARED bind MODES, not one hardcoded shape ──────────────────────────────────────────────────
 * `bindMode` picks HOW the field's value socket is identified: 'assign' (today's only shape, unchanged) targets an
 * `assign` block by its macro var (`matchvar` + `key`, byte-identical default); 'opparam' targets an ORDINARY op
 * atom's own param directly (`atomType` + `key`) — the shape `deriveBindings.matches()` already supported with zero
 * engine changes (every shipped twin binding a real op atom uses exactly `match:{type:atomType},key:param`, e.g.
 * surfacingData.js's `w`/`h`/`toolDia` bind `match:{type:'surfaceraster'}`) but which the formfield authoring UI had
 * no way to reach — a form built over an op's own param (not a macro var) derived ZERO bindings. `atomType` is a
 * free-text field, matching `matchvar`'s existing precedent (neither is a live dropdown of the surrounding stack;
 * a typo in either is caught the same way — t1636's formfieldMatchReport, at save time, loudly, by name). No new
 * disambiguation mechanism for two atoms of the same type: `match:{type}` alone already requires EXACTLY one hit
 * (deriveBindings throws else), which is the correct authoring error today — rule-of-three says build an index/nth
 * picker if a THIRD real case ever needs two same-type atoms disambiguated, not speculatively here.
 *
 * The fields ARE the deriveBindings spec vocabulary: param · widget · label · default (dflt; empty = socket-held, the
 * template's baked expression holds) · the bind mode + its socket link (assign: matchvar #N; opparam: atomType) + key ·
 * the value type · section/help · optional · readonly(+hint) · an optional when-gate · widget config (dropdown
 * options, or number min/max/step/units). `dynamic: ['bindMode', 'widget']` (ddcs_dynfields) shows only the active
 * mode's socket field + the chosen widget's config, so the block stays readable. A DECLARATION, never inferred — the
 * composable substrate that lifts isMaintainedAsData (a spec authored as blocks round-trips losslessly).
 *
 * ── t2133 — "not a form field" + the canvas-drag TRIPLE + the two REUSED gate mechanisms ────────────────────────
 * Five more attributes DECLARE what CORNER_BINDING_SPECS (and its siblings) already carry in hand-written JS, closing
 * the exact gap that made the 2026-08-04 Corner port drop the drag handles (see cornerData.js's own CORNER_BINDING_SPECS
 * for the worked example this mirrors field-for-field):
 *   - `formHidden` — this socket is bound but NOT a visible form row (it lives on the canvas / drives a drag handle only).
 *   - `group` / `role` — canvas-layout grouping: siblings sharing a `group` compose into ONE draggable handle, each
 *     member's `role` ('x'/'y'/…) picks which axis/facet it drives. Read by panelTypes.layoutSpecFromOp (b.group/b.role),
 *     unchanged — these fields just let a spec reach it as a block instead of only as hand-written JS.
 *   - `relToRow` — an INCREMENTAL socket: the handle anchors to the op's declared sim-start row named here (e.g.
 *     'wall1'), and a drag writes the delta, not an absolute world coord. Empty = no relTo (an absolute point, or no
 *     canvas handle at all if `group`/`role` are also empty). Serializes deriveBindings' `relTo:{row}` shape (the only
 *     shape ever used) as ONE text field — the same "declare the candidate shape, not a generic object" call guard.js
 *     made for `when` (whentype) rather than inventing a nested-object field kind.
 *   - `gate` / `optionGate` — REUSE, not reinvent: these are NOT new gate mechanisms (BACKLOG.md's "GATE
 *     CONSOLIDATION" inventory is exactly why — eight already exist). Both ride as a JSON blob in one text field,
 *     mirroring `bindingsFromStack`'s/`bindingsToBlocks`'s own t1880/t961-era round-trip (userOps.js), which already
 *     read/write `gate`/`optionGate` on the SPEC — only the block-side field to carry them onto the canvas was
 *     missing. `gate` greys the row (userOpView.js's data-gate loop; `gate.clearWhenOff` opts a checkbox into
 *     auto-clear); `optionGate` greys one `<option>` (data-option-gate loop). `when` (whenparam/whenis, above) HIDES
 *     a row outright — a different mechanism, already on this block, left untouched.
 */
export const formFieldBlock = {
    type: 'formfield', label: 'form field', category: 'Wizard Inputs', kind: 'formfield',
    help: 'A wizard FORM field bound to a value socket (the composable BINDING_SPEC): Assign Var targets a macro-var assign block, Op Param targets an ordinary op atom\'s own param. Lives in the Presentation mouth, emits nothing; the form + emit read it. Default empty = the template socket holds (an expression default).',
    dynamic: ['bindMode', 'widget'],
    defaults: {
        param: 'value', widget: 'number', label: '', dflt: '',
        bindMode: 'assign', matchvar: '#1', atomType: '', key: 'value', type: 'number',
        section: '', help: '', optional: false, readonly: false, readonlyhint: '',
        whenparam: '', whenis: '',
        options: '', nmin: '', nmax: '', nstep: '', units: '',
        // t1613 — the DERIVED/WRITES sockets (the same two slots the shipped `passes` field declares): `derived` is
        // an expr over the form's params; `writes` is one-or-more "param = expr" lines fired on a user gesture.
        derived: '', writes: '',
        // t2133 — NOT a visible form field (canvas/drag-only) + the group/role/relTo drag-handle triple.
        formHidden: false, group: '', role: '', relToRow: '',
        // t2133 — the two REUSED gate mechanisms (grey-a-row, grey-an-option), each a JSON blob; see the header note.
        gate: '', optionGate: '',
    },
    allFields: ['param', 'widget', 'label', 'dflt', 'bindMode', 'matchvar', 'atomType', 'key', 'type', 'section', 'help', 'optional', 'readonly', 'readonlyhint', 'whenparam', 'whenis', 'options', 'nmin', 'nmax', 'nstep', 'units', 'derived', 'writes', 'formHidden', 'group', 'role', 'relToRow', 'gate', 'optionGate'],
    // t2385 (BACKLOG #42 piece 1) — the same per-def label map param_field's own block gained, for the same two
    // storage-key families both blocks share (see paramField.js's own header comment for the full account).
    labels: { dflt: 'default', nmin: 'min', nmax: 'max', nstep: 'step' },
    fieldsFor(p) {
        const w = (p && p.widget) || 'number';
        const mode = (p && p.bindMode) || 'assign';
        const f = ['param', 'widget', 'label', 'dflt', 'bindMode', mode === 'opparam' ? 'atomType' : 'matchvar', 'key', 'type', 'section', 'help', 'optional', 'readonly', 'readonlyhint', 'whenparam', 'whenis', 'derived', 'writes', 'formHidden', 'group', 'role', 'relToRow', 'gate', 'optionGate'];
        if (w === 'dropdown' || w === 'segmented') f.push('options');
        else if (w === 'number' || w === 'slider') f.push('nmin', 'nmax', 'nstep', 'units');
        return f;
    },
    selects: { bindMode: [['Assign Var', 'assign'], ['Op Param', 'opparam']] },
    emit: () => [],   // metadata only — produces no G-code (read at register/save → def.bindingSpecs → the form + emit)
};
