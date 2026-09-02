/**
 * wizards/ops/preview3d.js — the 3D-PREVIEW-ONLY GUI block (t2511, BACKLOG #61 arc).
 *
 * `sim` (wizards/ops/sim.js) has always done two jobs at once: DECLARE the 3D-scene preview intent (rotary rig /
 * machine frame / ATC magazine / probe-for-WCS — read by `simIntentFromStack`, def.sim) AND, via formWidgets.js's
 * own `node.type==='sim'` branch, BUILD the combined 3D+2D visualization box. The owner asked for these split:
 * a wizard should be able to declare its 3D preview and its 2D feature canvas as two INDEPENDENT blocks,
 * placeable separately in the `uiChildren` tree, the same way `feature_canvas` (2D-only,
 * wizards/ops/featureCanvas.js — t2515: renamed from `panel`) already stands alone. This block is the 3D-only
 * half of that split — same fields as `sim` (this IS its replacement, not a second thing beside it: a migrated
 * op declares `preview3d` instead of `sim`, not both — see `simIntentFromStack`'s own comment for why it
 * recognises both types), paired with `feature_canvas` as the visible authoring layer for the box.
 *
 * Emits NOTHING: it's metadata read at SAVE time (devMode -> def.sim, via simIntentFromStack) and at RENDER
 * time (formWidgets.js's own `traverse()`, which builds the box — combined with an ADJACENT `feature_canvas`
 * node when one follows/precedes it in the same uiChildren list, standalone otherwise — see that file's own header
 * comment on the `preview3d` branch for the exact adjacency rule and why it exists).
 */
export const preview3dBlock = {
    type: 'preview3d', label: '3D preview', category: 'Wizard Previews',
    // Same four fields sim.js has always carried — see that file's own comment for what each one means.
    defaults: { rotary: false, machine: false, magazine: false, probeWcs: false },
    fields: ['rotary', 'machine', 'magazine', 'probeWcs'],
    emit: () => [],   // metadata only — produces no G-code
};
