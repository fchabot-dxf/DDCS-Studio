/**
 * wizards/ops/paramTable.js — the MATERIALIZED param_field CONTAINER (t2543, BACKLOG #71 — the owner's own
 * SEPARATE SLOT ruling). Direct sibling of `cam_table` (`camField.js`), built the SAME way for the SAME reason:
 * `param_group.children` used to be shared by TWO incompatible owners — `renderUiTree`'s own transparent
 * form-layout branch (t1605, "a param_group IS its rows") and `materializeParamGroup`'s own flat
 * `param_field` canvas-materialization target (S5.3). A twin declaring `group_box`/`field_ref` nodes in
 * `param_group.children` (the authorability-sweep migration, BACKLOG #72) made materialize's own idempotency
 * guard (`children.length > 0` ⇒ "already materialized") false-positive — non-empty no longer meant
 * "contains real param_field records." Tightening the guard to check for a REAL `param_field` descendant only
 * moved the failure: `materializeParamGroup` would then OVERWRITE the declared group_box structure outright
 * the instant it ran (t2531's own traced, reverted attempt — see WORK-LOG).
 *
 * THE RULING: separate the slot, not teach the second consumer to tolerate the first. `param_table` is
 * `materializeParamGroup`'s OWN target now — found by TYPE (`flattenBlocks(...).find(b => b.type ===
 * 'param_table')`), exactly like `cam_table`, never by inspecting a shared array's own contents. A twin's own
 * `param_group` node stays whatever the author declared (empty, or group_box/field_ref) — materialize never
 * looks at it, never touches it, cannot collide with it by construction. `param_table` itself is a canvas-only
 * concern — like `cam_table`, it carries no `renderUiTree` branch (see `ui/formWidgets.js`'s own explicit
 * no-op case) because nothing about it is ever meant to become a FORM row via the tree path; its own children
 * (`param_field` rows) are read directly by `paramFieldsFromStack`, the same reader that already existed.
 */
export const paramTableBlock = {
    type: 'param_table', label: 'Materialized Form Fields', category: 'Wizard Inputs', kind: 'param_table', mouth: 'DO',
    help: 'The materialized set of form-field declarations for this wizard\'s own value bindings — one row per bindable param, auto-generated the first time this wizard is opened to customize. Metadata only — emits no G-code. Not meant to be hand-authored into; it exists so the Blocks canvas has real, editable blocks for each field.',
    defaults: { group: 'Settings' },
    fields: ['group'],
    emit: () => [],   // metadata only — NOT transparent-passthrough (its children are param_field declarations, not atoms) → byte-identical, exactly like cam_table/formfield
};
