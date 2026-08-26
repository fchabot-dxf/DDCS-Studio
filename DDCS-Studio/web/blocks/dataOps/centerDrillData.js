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
    // t1325 — THE PICKER OFFERS CENTRE DRILLS (and plain drills, which do the same job deeper). NOTHING PREFILLS,
    // and that is a fact about this op rather than a gap: the drill sits ON THE CENTRELINE, so no diameter ever
    // reaches the macro — only Z cuts. The tool's Ø is real, and it now reads in the picker's own label, but adding a
    // dia PARAM here purely to receive it would put a socket in the program that the program does not use.
    { param: 'toolNum', match: { type: 'toolsel' }, key: 'toolNum', type: 'number',
      widgetConfig: { toolKinds: ['centredrill', 'drill'] },
      label: 'Tool', help: 'The centre drill this op runs. Its Ø shows in the list; the macro needs no diameter — the drill is on the centreline and only Z cuts.', section: 'TOOL & CUT' },
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
            // t2301 (BACKLOG 20) — 'panel' removed, 'sim' ADDED (this twin never had one): id-collision fix, same
            // as drillData.js's own t2301 comment. Empty params — no existing lathe-cutting-twin precedent to
            // match (mill's rotary/machine/magazine trio doesn't map to a lathe rig; the two lathe PROBE twins
            // that already had sim, odProbeData.js/faceProbeData.js, carry probeWcs:true instead, which doesn't
            // apply here either — this op reads a WCS, it doesn't produce one). The `layout` node below is this
            // twin's OWN real 2D content (the half-profile canvas) — a separate, currently-unwired node type
            // (confirmed: 'layout' has no case in formWidgets.js's traverse() switch, falls to the t1561
            // unwired-placeholder branch), unrelated to sim's own generic layout2d pane either way.
            { type: 'sim', params: {} },
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
    ), CDRILL_DEFAULTS, 'centredrill');   // …a bit on the centreline, not an insert on a holder — t1722: matches LATHE_TOOL_KINDS.centredrill's declared id (data/latheTools.js), not a second, American-spelled identity
    def.postInstantiate = (stack, resolved) => applyStraightPeck(stack, resolved);
    return def;
}
