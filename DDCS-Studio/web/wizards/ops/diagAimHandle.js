/**
 * wizards/ops/diagAimHandle.js — the DIAG-AIM-HANDLE GUI block (t2573, BACKLOG #61's t2571 assessment, now
 * built — the TRANS-AXIAL DIAGONAL-AIM handle canvasWidgets.js's own `diagAim` gesture drives, e.g. middle's
 * own ② handle: ONE drag re-derives a primary-axis coordinate AND a secondary-axis travel distance).
 *
 * Same shape as the other seven ported gestures (their own headers have the full account, including the t2525
 * fix): `fieldTravel`/`fieldPrimary` are MUST-MATCH PICKERS naming TWO EXISTING params an "Op Param" `formfield`
 * elsewhere in the stack already binds — `handleBindingsFromStack`/`attach()` merges this handle's anchor onto
 * both real bindings, so dragging reaches emit for real. `axisField`/`signField` are a THIRD/FOURTH kind of
 * picker, the SAME read-only-companion doctrine `scale_handle`'s own `baseField` and `shear_handle`'s own
 * `hField` established: they name EXISTING enum params read for their CURRENT VALUE only, never themselves
 * written by this block, but still must-match/fail-visibly (t2525's own doctrine, unchanged).
 *
 * WHERE THIS GENUINELY DIFFERS (t2571's own assessment; this is its build): canvasWidgets.js's own `diagAim`
 * gesture needs a STOCK-RELATIVE resting centre — t2571 traced this to `stock.w`/`stock.h`, already read at
 * this same resolution layer by every other declared anchor kind — and a SIGN driven by an enum param's own
 * current value — t2571 traced this to the identical pattern `probeVector`'s own gesture already bakes in
 * internally. Both are now DECLARED, general primitives (`wizards/ops/anchorSources.js`, t2573): `axisField`
 * names the enum choosing which physical axis is primary ('X'/'Y'); `signField`+`signPosValue`+`signWhenPos`
 * declare the sign convention (default: `signField`'s value === 'pos' → −1, else +1, matching middle's own
 * `dir2` convention exactly, but expressible for ANY future two-valued enum). Neither reads anything a block
 * author cannot see or vary — "a handle names a declared thing," not "a block asks the op" (t2571's own bar).
 */
export const diagAimHandleBlock = {
    type: 'diag_aim_handle', label: 'diag aim handle', category: 'Wizard Layout', kind: 'diag_aim_handle',
    help: 'A draggable TRANS-AXIAL DIAGONAL-AIM handle on the feature canvas: one drag re-derives a primary-axis coordinate and a secondary-axis travel distance, resting at a stock-relative centre by default. `fieldTravel`/`fieldPrimary` must each name an EXISTING "Op Param" form field elsewhere in the stack — dragging writes them for real (it reaches the emitted G-code). `axisField` must name an EXISTING enum param whose value is "X" or "Y" (which physical axis is primary). `signField` must name an EXISTING enum param whose CURRENT value picks the travel sign — read-only, never written by this block.',
    defaults: {
        fieldTravel: 'diagTravel', fieldPrimary: 'diagPrimary', axisField: 'axis',
        signField: 'dir2', signPosValue: 'pos', signWhenPos: '-1', label: '②',
    },
    fields: ['fieldTravel', 'fieldPrimary', 'axisField', 'signField', 'signPosValue', 'signWhenPos', 'label'],
    emit: () => [],   // metadata only — the BLOCK produces no G-code itself; the params it names (once resolved) do, via the merged real bindings
};
