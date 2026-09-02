/**
 * wizards/ops/featureCanvas.js — the FEATURE CANVAS GUI block (t2515 — renamed from `panel`, owner ruling, hard
 * rename no alias: this string meant three things at once — the block's own type, the field on it whose value is
 * form3d/form3d+2d, and the layout-node type that renders the 2D feature canvas — see BACKLOG #72's own
 * authorability sweep, which named it a cheap rename, not a real duplicate). Declares a custom wizard's panel
 * layout (form / form3d / form2d) right in the stack. Emits NOTHING — it's metadata read at SAVE time
 * (devMode → def.panel, UNCHANGED — that field name stays `panel`, only the block/node TYPE moved). Pairs with
 * the `param` block: together they're the visible "form" section of a custom wizard (the GUI-blocks authoring
 * layer). Symmetric with `preview3d` (wizards/ops/preview3d.js, t2511) — the 3D-only half of the same split.
 */
export const featureCanvasBlock = {
    type: 'feature_canvas', label: 'feature canvas', category: 'Wizard Previews', kind: 'panel',   // t161 — an explicit metadata kind (like section/param_group/structctl) so devMode.isAtom excludes it from the knob kit; kind stays 'panel' (t2515 — not part of the rename, see its own header note)
    defaults: { panel: 'form3d' },
    fields: ['panel'],
    emit: () => [],   // metadata only — produces no G-code
};
