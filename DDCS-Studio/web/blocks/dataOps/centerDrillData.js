/**
 * blocks/dataOps/centerDrillData.js — CENTRE DRILLING as a DATA-OP TWIN (t1275).
 *
 * The last of the four, and the shortest, because by now there is nothing left to invent: registration, bindings by
 * macro-var identity, the declared half-profile layout, the `.wiz` round trip, axis gating — all inherited.
 *
 * ITS IDENTITY IS STRAIGHT-OR-PECK, and unlike parting's it changes the PROGRAM: a peck is a loop with a full retract
 * in it. The macro carries both arms and picks by the peck value, so choosing "Straight" is the same as saying the
 * step is zero — one behaviour, two ways to ask for it, rather than two code paths that could disagree.
 */
import { centerDrillStack, CDRILL_DEFAULTS, CDRILL_VARS, DRILL_KINDS } from '../../wizards/lathe/centerDrill.js';
import { userOpFromStack } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { appendToolSel } from '../../wizards/ops/toolsel.js';
import { LATHE_GROUP } from './facingData.js';
import { withLatheScene } from '../../viz/latheScene.js';   // t1281 — the bar, in the 3D scene

export const CDRILL_DATA_OPTYPE = 'user_lathe_centerdrill';

export const CDRILL_BINDING_SPECS = [
    { param: 'depth', match: { type: 'assign', var: CDRILL_VARS.depth }, key: 'value', type: 'number',
      label: 'Depth', help: 'How deep the hole goes, measured from the workpiece face. A positive number — the macro works out that the hole runs into the part.',
      section: 'GEOMETRY', units: 'mm', default: CDRILL_DEFAULTS.depth },
    { param: 'peck', match: { type: 'assign', var: CDRILL_VARS.peck }, key: 'value', type: 'number',
      label: 'Peck', help: 'How far the drill advances between FULL retracts. 0 = one plunge. On a lathe the swarf has nowhere to go but back down the flute, so the retract is all the way out.',
      section: 'GEOMETRY', units: 'mm', default: CDRILL_DEFAULTS.peck },
    { param: 'feed', match: { type: 'assign', var: CDRILL_VARS.feed }, key: 'value', type: 'number',
      label: 'Feed', section: 'TOOL & CUT', units: 'mm/min', default: CDRILL_DEFAULTS.feed },
    { param: 'toolNum', match: { type: 'toolsel' }, key: 'toolNum', type: 'number',
      label: 'Tool', help: 'The tool-library number this op runs. Unset = no declared tool.', section: 'TOOL & CUT' },
];

export const CDRILL_STRUCT_BINDINGS = [
    { param: 'kind', type: 'enum', widget: 'segmented', default: CDRILL_DEFAULTS.kind, label: 'Drill', section: 'IDENTITY',
      help: `${DRILL_KINDS.straight.why} / ${DRILL_KINDS.peck.why}`,
      widgetConfig: { options: [[DRILL_KINDS.straight.label, 'straight'], [DRILL_KINDS.peck.label, 'peck']] } },
];

function cdrillDataStack(p = CDRILL_DEFAULTS) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'layout', params: { kind: 'lathe_profile' } },
            { type: 'param_group', params: { group: 'Centre Drill' }, children: [] },
        ],
        children: appendToolSel(centerDrillStack(p)),
    }];
}

export const CDRILL_BINDINGS = deriveBindingsFor(cdrillDataStack(CDRILL_DEFAULTS), CDRILL_BINDING_SPECS);

/** STRAIGHT means "no step". Rather than a second arm that could drift, the identity writes the peck it implies. */
export function applyStraightPeck(stack, resolved) {
    if ((resolved && resolved.kind) !== 'straight') return stack;
    const walk = (bs) => (bs || []).forEach((b) => {
        if (b.type === 'assign' && b.params && b.params.var === CDRILL_VARS.peck) {
            b.params.value = '0';
            b.params.note = 'straight — one plunge, so there is no step';
        }
        if (b.children) walk(b.children);
        if (b.uiChildren) walk(b.uiChildren);
    });
    walk(stack);
    return stack;
}

export function centerDrillDataDef() {
    const def = withLatheScene(userOpFromStack(
        'lathe_centerdrill', 'Centre Drill (lathe)', cdrillDataStack(CDRILL_DEFAULTS),
        [...CDRILL_BINDINGS, ...CDRILL_STRUCT_BINDINGS], 'form3d+2d', null, LATHE_GROUP,
    ), CDRILL_DEFAULTS);
    def.postInstantiate = (stack, resolved) => applyStraightPeck(stack, resolved);
    return def;
}
