/**
 * wizards/ops/rectHandle.js — the RECT-HANDLE GUI block (t2521, BACKLOG #71's third gesture — a 2D SIZE
 * corner: W×H from a fixed anchor, the mill family's own drill-pattern/pocket/text-box sizing handle).
 *
 * Same shape as `length_handle`/`point_handle` (their own headers have the full account, including the t2525
 * fix): `field`/`fieldH` are MUST-MATCH PICKERS naming EXISTING params two "Op Param" `formfield` blocks
 * elsewhere in the stack already bind — `handleBindingsFromStack`/`attach()` merges this handle's anchor onto
 * each real binding, so dragging reaches emit for real. Nests inside `feature_canvas`'s own mouth, fixed
 * literal anchor (ax/ay).
 *
 * WHERE IT GENUINELY DIFFERS — this is the one the dispatch named as the real risk, and it was real: `rect`
 * is the first gesture here that drives TWO params from ONE handle (`field` for W, `fieldH` for H), which
 * means it needed `layoutSpecFromOp`'s own t2495 `valueField` routing: when BOTH axes are declared active on
 * one handle, nothing about the declaration alone says which one the handle's own displayed NUMBER reflects
 * (the existing convention only resolves this "by construction" when just ONE of field/fieldH is set at all —
 * see canvasWidgets.js's own t2495 comment). So this block carries an explicit `valueField` dropdown
 * ('field'/'fieldH') alongside `sx`/`sy` (the per-axis divisor — 1 = literal, matching this pilot) and
 * `minw`/`maxw`/`minh`/`maxh` (t2489's own symmetric clamp pair, per axis). A NEW `anchor.kind === 'rect'`
 * branch in `layoutSpecFromOp` was required (unlike point, which reused an existing one) — `rect` had no prior
 * declared-anchor authoring path at all; every existing rect handle in the app is built the OLDER way, from
 * role-tagged bindings (byRole.x/y/w/h) or hand-rolled JS, neither of which this block's own anchor shape fits.
 *
 * t2679 (Phase 2 board, proposal (a), owner-designed authoring face — SUPERSEDES an earlier value-SOCKET +
 * `form_variable` REPORTER-BLOCK design, built and then shelved mid-turn) — `ax`/`ay` are the SAME
 * SEARCHABLE VALUE field as `point_handle`'s own (`field_anchor_value`, see its header for the full design):
 * type a number for a literal, or search this def's own bound form params/preview markers and commit only
 * from that list. `cornerParam` is DIFFERENT in kind, UNCHANGED across the whole redesign: a plain
 * MUST-MATCH PICKER (`field_picker`, not `field_anchor_value`), naming a param whose LIVE value is a
 * datum-corner code (the same 'nn'/'pp'/… vocabulary stockAttach/pathDatum already use) — when set,
 * `panelTypes.js`'s own `anchor.kind==='rect'` branch calls `placement.js`'s `cornerAnchorOf` each render to
 * override ax/ay/sx/sy live, so the handle tracks the wizard's own selected datum corner instead of a fixed
 * anchor. Empty (default) = byte-identical to before.
 *
 * t2681 — THE FACE, made readable (`point_handle.js`'s own header carries the general account; this is the
 * bigger of the two — 15 fields, the owner's own named example of the problem). Three tiers, each checked
 * against the REAL code, not guessed:
 *   - ALWAYS HIDDEN, no reveal path — `value`/`valueH`: same vestigial-snapshot story as point_handle's own
 *     `x`/`y` (`handleBindingsFromStack` never reads them; `handleBindingsToBlocks` only ever WRITES them, on
 *     regeneration). `sx`/`sy`/`valueField`: the owner's own explicit list ("internal wiring the author
 *     should never see") — confirmed each defaults to a genuinely non-empty value ('1'/'1'/'field'), so
 *     `enablers`' own "hidden while empty" mechanism can't apply to them the way it does below; kept OUT of
 *     `enablers` on purpose rather than force-fit.
 *   - ENABLER (hidden until set, revealed via "Block options…" OR once authored — `formField.js`'s own
 *     help/limits/units precedent, exact same mechanism) — `minw`/`maxw`/`minh`/`maxh`: each DEFAULTS TO THE
 *     EMPTY STRING already (t2489's own symmetric clamp pair), a genuine fit for "hidden while empty."
 *     `cornerParam`: also empty by default, and unlike the clamps it's a real FEATURE (datum-corner
 *     tracking) a person may deliberately reach for — not permanently hidden, just hidden until used.
 *   - ALWAYS SHOWN — `field`/`fieldH` (the two writes), `ax`/`ay` (the anchor, primary regardless of
 *     `cornerParam`), `label`.
 * `dynamic: ['cornerParam']` activates the mechanism (`fieldsFor`'s own returned set doesn't branch on it —
 * the enablers layer handles cornerParam's own reveal-on-set independently); a genuine second driver wasn't
 * needed once the clamp pair moved to `enablers`.
 * `labels` use the owner's own SETTLED read/write vocabulary (amendment to t2681, mid-turn — the same pair
 * `point_handle.js`'s own labels reuse, never a third synonym): `field`/`fieldH` → "writes w"/"writes h" (the
 * two params dragging WRITES), `ax`/`ay` → "reads x"/"reads y" (the searchable field READS its value from
 * wherever it's pointed), `cornerParam` → "corner from", `minw`/`maxw`/`minh`/`maxh` → "min/max width/height",
 * `label` → "name".
 */
export const rectHandleBlock = {
    type: 'rect_handle', label: 'rect handle', category: 'Wizard Layout', kind: 'rect_handle',
    help: 'A draggable 2D SIZE (W×H) handle on the feature canvas, from a fixed anchor (ax, ay) — type a number for a literal, or search for an existing form param/marker to follow its live value — or, with `cornerParam` set, tracking an existing datum-corner param\'s own live selection instead. `field`/`fieldH` must each name an EXISTING "Op Param" form field elsewhere in the stack — dragging writes them for real (it reaches the emitted G-code). valueField picks which one the handle’s own displayed number reflects.',
    dynamic: ['cornerParam'],
    defaults: { field: 'w', fieldH: 'h', value: '40', valueH: '30', ax: 0, ay: 0, sx: '1', sy: '1', minw: '', maxw: '', minh: '', maxh: '', valueField: 'field', cornerParam: '', label: 'W×H' },
    allFields: ['field', 'fieldH', 'value', 'valueH', 'ax', 'ay', 'sx', 'sy', 'minw', 'maxw', 'minh', 'maxh', 'valueField', 'cornerParam', 'label'],
    labels: { field: 'writes w', fieldH: 'writes h', ax: 'reads x', ay: 'reads y', cornerParam: 'corner from', minw: 'min width', maxw: 'max width', minh: 'min height', maxh: 'max height', label: 'name' },
    enablers: [
        { label: 'width clamp (min/max)', fields: ['minw', 'maxw'] },
        { label: 'height clamp (min/max)', fields: ['minh', 'maxh'] },
        { label: 'track a datum corner', fields: ['cornerParam'] },
    ],
    fieldsFor() {
        return ['field', 'fieldH', 'ax', 'ay', 'minw', 'maxw', 'minh', 'maxh', 'cornerParam', 'label'];
    },
    emit: () => [],   // metadata only — the BLOCK produces no G-code itself; the params it names (once resolved) do, via the merged real bindings
};
