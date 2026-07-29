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

/** The wrapped template: the UI declarations, then the macro itself as the executable children. */
function facingDataStack(p = FACING_DEFAULTS) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            // t1281 — form3d+2d: the 3D BAR and the half-profile, both. It was form2d, which is why a lathe
            // wizard had no 3D pane at all — the op could not show the bar because it never declared a place to.
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'layout', params: { kind: 'lathe_profile' } },   // t1273 — the half-profile, not the mill's XY stock
            {
                type: 'param_group',
                // …not "identity": facing HAS no identity fields, and a group named for something that does not
                // exist would be worse than no group. The first thing a turner needs to say is what to remove.
                params: { group: 'Facing' },
                children: [],
            },
        ],
        children: facingStack(p),
    }];
}

export const FACING_BINDINGS = deriveBindingsFor(facingDataStack(FACING_DEFAULTS), FACING_BINDING_SPECS);

/** The twin, ready for registerUserOp — a Lathe-group op with a 2D panel and no rotary/machine sim claims. */
export function facingDataDef() {
    return withLatheScene(userOpFromStack(
        'lathe_facing',
        'Facing (lathe)',
        facingDataStack(FACING_DEFAULTS),
        FACING_BINDINGS,
        'form3d+2d',
        null,
        LATHE_GROUP,
    ), FACING_DEFAULTS);
}
