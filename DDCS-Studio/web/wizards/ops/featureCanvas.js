/**
 * wizards/ops/featureCanvas.js — the FEATURE CANVAS GUI block (t2515 — renamed from `panel`, owner ruling, hard
 * rename no alias: this string meant three things at once — the block's own type, the field on it whose value is
 * form3d/form3d+2d, and the layout-node type that renders the 2D feature canvas — see BACKLOG #72's own
 * authorability sweep, which named it a cheap rename, not a real duplicate). Declares a custom wizard's panel
 * layout (form / form3d / form2d) right in the stack. Emits NOTHING — it's metadata read at SAVE time
 * (devMode → def.panel, UNCHANGED — that field name stays `panel`, only the block/node TYPE moved). Pairs with
 * the `param` block: together they're the visible "form" section of a custom wizard (the GUI-blocks authoring
 * layer). Symmetric with `preview3d` (wizards/ops/preview3d.js, t2511) — the 3D-only half of the same split.
 *
 * t2517 (BACKLOG #71) — given a MOUTH: a handle (`length_handle`, wizards/ops/lengthHandle.js) belongs to a
 * SPECIFIC canvas — it writes one param and renders in one place — so it nests INSIDE this block's own
 * children, structural containment rather than a flat type-filter (owner ruling: "that is not symmetry, it is
 * ownership"). Still emits NOTHING: a handle block emits nothing either, so the mouth's own children never
 * reach G-code regardless of what's nested in it — see `handleBindingsFromStack` (userOps.js), which reads
 * ONLY inside a feature_canvas node's own children, never a bare stack-wide scan.
 */
export const featureCanvasBlock = {
    type: 'feature_canvas', label: 'feature canvas', category: 'Wizard Previews', kind: 'panel', mouth: 'DO',   // t161 — an explicit metadata kind (like section/param_group/structctl) so devMode.isAtom excludes it from the knob kit; kind stays 'panel' (t2515 — not part of the rename, see its own header note); t2517 — mouth added for length_handle (and future handle blocks) to nest in
    defaults: { panel: 'form3d' },
    fields: ['panel'],
    emit: () => [],   // metadata only — produces no G-code
};
