/**
 * wizards/ops/radialHandle.js — the RADIAL-HANDLE GUI block (t2521, BACKLOG #71's fourth gesture this turn —
 * a POLAR Ø/pitch handle about a fixed centre, the mill family's own drill-ring/hole-diameter handle).
 *
 * Same self-contained shape as `length_handle`/`point_handle`/`rect_handle` (their own headers have the full
 * account): carries its own bound param name + default, nests inside `feature_canvas`'s own mouth, emits
 * nothing. ONE bound param (like length), not two — this pilot builds the RADIUS-ONLY variant (a diameter/
 * pitch drag at a FIXED bearing — the drill-ring/hole-Ø shape canvasWidgets.js's own header names explicitly),
 * not the fused Ø+angle or angle-only variants the same gesture also supports (`fieldA`/`lockA` — genuinely
 * separate authoring surfaces, out of this pilot's scope).
 *
 * WHERE IT DIFFERS: needed a NEW `anchor.kind === 'radial'` render branch (no prior declared-anchor path, same
 * as rect). The one real translation this block's own reader has to do that the others don't: the gesture's
 * own `place()` wants a WORLD RADIUS (`r`) and a RADIANS angle (`a`), while the declared field this block
 * writes holds a DIAMETER-scaled value (`rScale`, e.g. 2 = Ø from a radius) at a FIXED bearing in DEGREES
 * (`a`, the block's own field, matching this codebase's own degrees convention elsewhere) — so the reader
 * divides by `rScale` and converts degrees→radians before building the decl, the inverse of what the gesture's
 * own `drag()` does when it writes the field back.
 */
export const radialHandleBlock = {
    type: 'radial_handle', label: 'radial handle', category: 'Wizard Layout', kind: 'radial_handle',
    help: 'A draggable Ø/pitch (radius-only) handle on the feature canvas, bound to one param, at a fixed centre (cx, cy) and bearing (a, degrees). rScale (2 = diameter from a radius) matches canvasWidgets.js\'s own convention. Nests inside a feature canvas block. Emits nothing (sim/form-only).',
    defaults: { field: 'dia', value: '20', cx: '0', cy: '0', a: '0', rScale: '2', minR: '', maxR: '', label: 'Ø' },
    fields: ['field', 'value', 'cx', 'cy', 'a', 'rScale', 'minR', 'maxR', 'label'],
    emit: () => [],   // metadata only — produces no G-code (read at register/save → a socket-less radial binding)
};
