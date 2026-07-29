/**
 * blocks/dataOps/partingData.js — PARTING / GROOVING as a DATA-OP TWIN (t1275).
 *
 * An inheritor: registration, identity-derived bindings, the layout block and the `.wiz` round trip all came from the
 * pilot and OD unchanged. What is worth stating is the IDENTITY, because it is honest about how little it changes:
 * parting off IS grooving to the centreline. Same plunge, same loop, same retract. The choice changes what the
 * program SAYS it is doing and where the plunge stops by default — and nothing else, because nothing else differs.
 * Inventing a second code path to make the toggle feel weightier would be ceremony.
 */
import { partingStack, PART_DEFAULTS, PART_VARS, PART_KINDS, partKind } from '../../wizards/lathe/parting.js';
import { userOpFromStack } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { appendToolSel } from '../../wizards/ops/toolsel.js';
import { LATHE_GROUP } from './facingData.js';
import { withLatheScene } from '../../viz/latheScene.js';   // t1281 — the bar, in the 3D scene

export const PART_DATA_OPTYPE = 'user_lathe_parting';

/** The value sockets, each matched by WHAT THE BLOCK IS — the macro var it assigns. */
export const PART_BINDING_SPECS = [
    { param: 'zFace', match: { type: 'assign', var: PART_VARS.zFace }, key: 'value', type: 'number',
      label: 'Face at Z', help: 'Where the finished FACE of the feature goes, measured from the workpiece face. The blade’s own width comes off the material side automatically.',
      section: 'GEOMETRY', units: 'mm', default: PART_DEFAULTS.zFace },
    { param: 'floorDiameter', match: { type: 'assign', var: PART_VARS.dFloor }, key: 'value', type: 'number',
      label: 'Stop at Ø', help: 'Grooving: the diameter at the bottom of the slot. Parting: leave 0 to run right through, or a diameter to leave a spigot you snap off.',
      section: 'GEOMETRY', units: 'mm', default: PART_DEFAULTS.targetDiameter },
    { param: 'width', match: { type: 'assign', var: PART_VARS.width }, key: 'value', type: 'number',
      label: 'Blade width', help: 'The kerf. The macro puts the blade this far on the material side of the face you typed, so the finished face lands where the drawing says.',
      section: 'GEOMETRY', units: 'mm', default: PART_DEFAULTS.width },
    { param: 'peck', match: { type: 'assign', var: PART_VARS.peck }, key: 'value', type: 'number',
      label: 'Peck', help: 'How far the blade advances between FULL retracts. 0 = straight in. Parting chips pack the slot; coming out is what clears them.',
      section: 'GEOMETRY', units: 'mm', default: PART_DEFAULTS.peck },
    { param: 'feed', match: { type: 'assign', var: PART_VARS.feed }, key: 'value', type: 'number',
      label: 'Plunge feed', section: 'TOOL & CUT', units: 'mm/min', default: PART_DEFAULTS.feed },
    // t1325 — THE PICKER OFFERS BLADES, AND THE BLADE BRINGS ITS WIDTH. A parting op run with an endmill selected is
    // a mistake the list itself should not allow, and the kerf is the number a turner picks the blade BY — so the
    // width field prefills from the tool instead of being typed twice and drifting. A typed value still wins for this
    // op (the fill runs on PICK, not on every render).
    { param: 'toolNum', match: { type: 'toolsel' }, key: 'toolNum', type: 'number',
      widgetConfig: { toolKinds: ['parting'], fill: { bladeWidth: 'width' } },
      label: 'Tool', help: 'The parting blade this op runs. Picking one fills the blade width below from the tool table.', section: 'TOOL & CUT' },
];

/** THE IDENTITY — where the plunge is meant to stop, said in words. */
export const PART_STRUCT_BINDINGS = [
    { param: 'kind', type: 'enum', widget: 'segmented', default: PART_DEFAULTS.kind, label: 'Cut', section: 'IDENTITY',
      help: `${PART_KINDS.groove.why} / ${PART_KINDS.part.why}`,
      widgetConfig: { options: [[PART_KINDS.groove.label, 'groove'], [PART_KINDS.part.label, 'part']] } },
];

function partDataStack(p = PART_DEFAULTS) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'layout', params: { kind: 'lathe_profile' } },
            { type: 'param_group', params: { group: 'Part / Groove' }, children: [] },
        ],
        children: appendToolSel(partingStack(p)),
    }];
}

export const PART_BINDINGS = deriveBindingsFor(partDataStack(PART_DEFAULTS), PART_BINDING_SPECS);

/** The header says what the operator chose. It is the ONE thing the identity changes, so it had better be right. */
export function applyPartHeader(stack, resolved) {
    const groove = partKind(resolved && resolved.kind) === 'groove';
    const walk = (bs) => (bs || []).forEach((b) => {
        if (b.type === 'comment' && b.params && /GROOVE|PART OFF/.test(String(b.params.text))) {
            b.params.text = groove
                ? 'GROOVE — plunge to a diameter and come out. Every size is a #var below.'
                : 'PART OFF — plunge until the work comes free. Every size is a #var below.';
        }
        if (b.children) walk(b.children);
        if (b.uiChildren) walk(b.uiChildren);
    });
    walk(stack);
    return stack;
}

export function partingDataDef() {
    const def = withLatheScene(userOpFromStack(
        'lathe_parting', 'Part / Groove (lathe)', partDataStack(PART_DEFAULTS),
        [...PART_BINDINGS, ...PART_STRUCT_BINDINGS], 'form3d+2d', null, LATHE_GROUP,
    ), PART_DEFAULTS);
    def.postInstantiate = (stack, resolved) => applyPartHeader(stack, resolved);
    return def;
}
