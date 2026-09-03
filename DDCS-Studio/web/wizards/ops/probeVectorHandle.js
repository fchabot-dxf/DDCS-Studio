/**
 * wizards/ops/probeVectorHandle.js — the PROBE-VECTOR-HANDLE GUI block (t2557, BACKLOG #71's last unevaluated
 * gesture — a one-wall probe: an AXIS-ALIGNED reach from a fixed anchor, writing an axis enum + a dir enum +
 * a numeric distance from ONE drag. Matches `edgeData.js`'s own axis/dir/dist field shape.)
 *
 * Same shape as `length_handle`/`rect_handle` (their own headers have the full account, including the t2525
 * fix): `field`/`fieldAxis`/`fieldDir` are MUST-MATCH PICKERS naming EXISTING params three "Op Param"
 * `formfield` blocks elsewhere in the stack already bind — `handleBindingsFromStack`/`attach()` merges this
 * handle's anchor onto each real binding, so dragging reaches emit for real. Nests inside `feature_canvas`'s
 * own mouth, fixed literal anchor (cx/cy — the probe's own start point).
 *
 * WHERE IT GENUINELY DIFFERS: this is the FIRST handle whose drag writes non-numeric values — `fieldAxis`
 * ('X'/'Y') and `fieldDir` ('pos'/'neg') are ENUM STRINGS, not numbers (`field`/dist is the only number).
 * canvasWidgets.js's own probeVector gesture (t?? — declared, never wired until now) already flagged this in
 * its own comment; `panelTypes.js`'s `_writeParam` used to round EVERY write via `r3()` unconditionally,
 * which would have silently corrupted axis/dir to an unmatched `<select>` value — fixed as its own change
 * (t2557 pt1) before this block was wired on top of it.
 */
export const probeVectorHandleBlock = {
    type: 'probe_vector_handle', label: 'probe vector handle', category: 'Wizard Layout', kind: 'probe_vector_handle',
    help: 'A draggable AXIS-ALIGNED probe-reach handle on the feature canvas, from a fixed anchor (cx, cy) — one drag writes an axis enum (X/Y), a dir enum (pos/neg), and a numeric distance. `field`/`fieldAxis`/`fieldDir` must each name an EXISTING "Op Param" form field elsewhere in the stack — dragging writes them for real (it reaches the emitted G-code).',
    defaults: { field: 'dist', fieldAxis: 'axis', fieldDir: 'dir', value: '20', cx: '0', cy: '0', minR: '', maxR: '', label: 'probe' },
    fields: ['field', 'fieldAxis', 'fieldDir', 'value', 'cx', 'cy', 'minR', 'maxR', 'label'],
    emit: () => [],   // metadata only — the BLOCK produces no G-code itself; the params it names (once resolved) do, via the merged real bindings
};
