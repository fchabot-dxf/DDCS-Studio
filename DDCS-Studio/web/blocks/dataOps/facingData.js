/**
 * blocks/dataOps/facingData.js — FACING as a DATA-OP TWIN (t1271). The lathe family's first citizen.
 *
 * The pilot's registration step: facingStack() is the recipe, this makes it a real op — a wizard on the bar, a form,
 * a block stack you can open and edit, and a `.wiz` you can hand to another turner. It registers through the SAME
 * federated user layer every ported built-in uses, so it inherits the live form↔blocks round-trip for free.
 *
 * BINDINGS ARE DERIVED BY IDENTITY, never hand-counted. Each form field points at its block by WHAT THAT BLOCK IS —
 * "the assign whose var is #112" — not by an index into the stack. Index-counting is how a binding silently drifts
 * one block sideways when a comment is added; deriveBindings resolves the match and throws if it is not exactly one,
 * so an authoring mistake is a build error rather than a wrong number in a form.
 *
 * THE FORM IS IDENTITY-FIRST, and facing's honest answer is that it has ALMOST NO IDENTITY. A facing pass is a
 * facing pass: there is no corner to choose, no direction, no order. Inventing a toggle to fill the identity section
 * would be ceremony, so the form leads straight into the geometry — what to remove, and how fast to remove it.
 */
import { facingStack, FACING_DEFAULTS, FACING_VARS } from '../../wizards/lathe/facing.js';
import { userOpFromStack } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { withLatheScene } from '../../viz/latheScene.js';   // t1281 — the bar, in the 3D scene

export const FACING_DATA_OPTYPE = 'user_lathe_facing';
export const LATHE_GROUP = 'lathe';

/**
 * THE BINDING SPECS — each form field matched to the block it drives, by identity.
 *
 * Every one targets an `assign` in the macro's #var CONFIG HEADER, which is the point of that header existing: the
 * form edits the same variables the operator can edit at the machine. Change a value here and the header changes;
 * change it on the controller and the program still runs. One set of numbers, two ways in.
 */
export const FACING_BINDING_SPECS = [
    { param: 'allowance', match: { type: 'assign', var: FACING_VARS.allowance }, key: 'value', type: 'number',
      label: 'Material to remove', section: 'GEOMETRY', default: FACING_DEFAULTS.allowance,
      help: 'Total stock to take off the face (mm), measured along Z from where the face is now. The op makes as many passes as it needs to remove this much at the depth per pass below.' },
    { param: 'doc', match: { type: 'assign', var: FACING_VARS.doc }, key: 'value', type: 'number',
      label: 'Depth per pass', section: 'GEOMETRY', default: FACING_DEFAULTS.doc,
      help: 'How deep each facing pass cuts (mm). Smaller is gentler on the tool and the finish; the last pass is clamped so the total never overshoots the material to remove.' },
    { param: 'xStart', match: { type: 'assign', var: FACING_VARS.xStart }, key: 'value', type: 'number',
      label: 'Start X (radius + clearance)', section: 'GEOMETRY', default: 12,
      help: 'Where each pass begins in X — the bar RADIUS plus a little clearance (mm), not the diameter. Start outside the material so the tool enters air, never the corner of the stock.' },
    { param: 'feed', match: { type: 'assign', var: FACING_VARS.feed }, key: 'value', type: 'number',
      label: 'Feed', section: 'TOOL & CUT', default: FACING_DEFAULTS.feed },
];

/** The twin, ready for registerUserOp — a Lathe-group op with a 2D panel and no rotary/machine sim claims. */
export function facingDataDef() {
    // t2607 (BACKLOG #71/#72, Phase 1, the sixth axis' pilot) — no bootstrap/final split needed (static shape,
    // all 4 specs already `match:{type:'assign',var}` by identity — the tree only needs `.param` strings to
    // build field_refs, not a derived blockIndex), mirroring wcsData.js's own t2605 minimal pattern. Bindings
    // are still re-derived fresh against the real, final stack below (t2595's own finding).
    const fieldRefsOf = (specs) => specs.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const bySection = (name) => FACING_BINDING_SPECS.filter((b) => b.section === name);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            // t2607 — wrapped in split_horizontal so hasTreeLayout() (userOpView.js) routes this twin onto
            // renderUiTree, the SAME mechanism edge/corner/drill/... already use. Facing has no classic shell
            // (it was born a data-op twin, t1271) — no shell usage_text to reproduce verbatim.
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    // …not "identity": facing HAS no identity fields, and a group named for something that does
                    // not exist would be worse than no group. The first thing a turner needs to say is what to
                    // remove.
                    params: { group: 'Facing' },
                    children: [
                        { type: 'group_box', params: { title: 'GEOMETRY' }, children: fieldRefsOf(bySection('GEOMETRY')) },
                        { type: 'group_box', params: { title: 'TOOL & CUT' }, children: fieldRefsOf(bySection('TOOL & CUT')) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                // t1281 — form3d+2d: the 3D BAR and the half-profile, both. It was form2d, which is why a lathe
                // wizard had no 3D pane at all — the op could not show the bar because it never declared a place
                // to. t2607 — preview3d+feature_canvas as ADJACENT RIGHT-pane siblings (Phase 1 step 2, the SAME
                // adjacency-merge shape every prior migrated op ships, t2511) — byte-identical DOM to the old
                // combined `sim` node. `layout{kind:'lathe_profile'}` stays alongside: consumed by
                // layoutSpecFromOp via `def.layout` (self-healed at registration, panelTypes.js:296's own
                // `latheLayoutSpec` short-circuit) — NOT rendered by the tree (formWidgets.js's own `layout`
                // branch, t2607, treats it as metadata-only, exactly like a shape_* declaration).
                RIGHT: [
                    { type: 'preview3d', params: {} },
                    { type: 'feature_canvas', params: { panel: 'form3d+2d' } },
                    { type: 'layout', params: { kind: 'lathe_profile' } },
                ],
            },
        }],
        children: facingStack(FACING_DEFAULTS),
    }];
    const bindings = deriveBindingsFor(stack, FACING_BINDING_SPECS);
    return withLatheScene(userOpFromStack(
        'lathe_facing',
        'Facing (lathe)',
        stack,
        bindings,
        'form3d+2d',
        null,
        LATHE_GROUP,
    ), FACING_DEFAULTS);
}
