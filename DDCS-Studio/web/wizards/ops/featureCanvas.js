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
 * ownership"). This block itself still emits NOTHING (a metadata-only container, unchanged) — but a nested
 * handle's own DECLARED TARGET (a param an "Op Param" `formfield` elsewhere in the stack already binds to a
 * real atom socket) can and does reach G-code once dragged: t2525 (BACKLOG #71) merges the handle's anchor
 * onto that real binding rather than declaring a parallel, socket-less one — see `handleBindingsFromStack`/
 * `mergeHandleAnchors` (userOps.js), which reads a handle ONLY inside its own feature_canvas node's children,
 * never a bare stack-wide scan.
 */
export const featureCanvasBlock = {
    type: 'feature_canvas', label: 'feature canvas', category: 'Wizard Previews', kind: 'panel', mouth: 'DO',   // t161 — an explicit metadata kind (like section/param_group/structctl) so devMode.isAtom excludes it from the knob kit; kind stays 'panel' (t2515 — not part of the rename, see its own header note); t2517 — mouth added for length_handle (and future handle blocks) to nest in
    // t2643 (BACKLOG #71/#72) — was 'form3d' (3D-only, panelTypes.js's own mode:'3d' — NO 2D canvas at all), a
    // dead default: this block is documented as "Symmetric with preview3d — the 3D-only half of the same
    // split" (this file's own header), i.e. feature_canvas's OWN purpose is the 2D-capable side, and every
    // handle block (length_handle/point_handle/rect_handle/…) draws on the 2D FeatureCanvas SVG this panel mode
    // alone provides. Measured (t2641/t2643), not assumed: 31 of 32 shipped `feature_canvas` node declarations
    // across dataOps + real-UI test fixtures explicitly set 'form2d'; a stray one (a test fixture, not a
    // shipped op) sets 'form3d'; NONE rely on the block's own bare default. Now actually wired to apply on a
    // fresh drag too — see bridge.js's own jsonDef() dropdown-field fix, same turn.
    defaults: { panel: 'form2d' },
    fields: ['panel'],
    emit: () => [],   // metadata only — produces no G-code
};
