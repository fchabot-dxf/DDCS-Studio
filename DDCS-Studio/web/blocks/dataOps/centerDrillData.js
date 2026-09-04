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
import { userOpFromStack, childrenOf } from '../userOps.js';
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

/** STRAIGHT means "no step". Rather than a second arm that could drift, the identity writes the peck it implies. */
export function applyStraightPeck(stack, resolved) {
    if ((resolved && resolved.kind) !== 'straight') return stack;
    // t2339 — childrenOf, not a bare (bs||[]): `b.children`/`b.uiChildren` can be the mouth-keyed object a
    // split_horizontal/split_vertical node takes, not just a plain array (t2337's roundtrip-1319 finding).
    const walk = (bs) => childrenOf(bs).forEach((b) => {
        if (b.type === 'assign' && b.params && b.params.var === CDRILL_VARS.peck) {
            b.params.value = '0';
            b.params.note = 'straight — one plunge, so there is no step';
        }
        walk(b.children);
        walk(b.uiChildren);
    });
    walk(stack);
    return stack;
}

export function centerDrillDataDef() {
    // t2617 (BACKLOG #71/#72, the sixth axis) — same minimal pattern as facingData.js's own t2607 pilot: no
    // bootstrap/final split needed (all specs already `match`-based by identity — the tree only needs `.param`
    // strings for field_ref, not a derived blockIndex). Sections declared IDENTITY/GEOMETRY/TOOL & CUT from the
    // start — the canonical SECTION_RANK order (t2613/t2617 found and fixed three EARLIER migrations that
    // guessed wrong and shipped out of band; `tests/section-order-parity-2617.spec.js` now catches this class
    // for every op, including this one, going forward).
    const fieldRefsOf = (specs) => specs.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const allSpecs = [...CDRILL_BINDING_SPECS, ...CDRILL_STRUCT_BINDINGS];
    const bySection = (name) => allSpecs.filter((b) => b.section === name);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'Centre Drill' },
                    children: [
                        { type: 'group_box', params: { title: 'IDENTITY' }, children: fieldRefsOf(bySection('IDENTITY')) },
                        { type: 'group_box', params: { title: 'GEOMETRY' }, children: fieldRefsOf(bySection('GEOMETRY')) },
                        { type: 'group_box', params: { title: 'TOOL & CUT' }, children: fieldRefsOf(bySection('TOOL & CUT')) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                // t1281-class — form3d+2d: the 3D bar and the half-profile. preview3d+feature_canvas as ADJACENT
                // RIGHT-pane siblings (Phase 1 step 2, t2511's own adjacency-merge shape). `layout{kind:
                // 'lathe_profile'}` stays alongside: consumed by layoutSpecFromOp via def.layout (self-healed at
                // registration), NOT rendered by the tree (formWidgets.js's own `layout` branch, t2607, treats
                // it as metadata-only).
                RIGHT: [
                    { type: 'preview3d', params: {} },
                    { type: 'feature_canvas', params: { panel: 'form3d+2d' } },
                    { type: 'layout', params: { kind: 'lathe_profile' } },
                ],
            },
        }],
        children: appendToolSel(centerDrillStack(CDRILL_DEFAULTS)),
    }];
    // t2617 — deriveBindingsFor ONLY the value-socket specs (they carry `match`); CDRILL_STRUCT_BINDINGS.kind
    // has none (a structural toggle, consumed by postInstantiate's own JS, not resolved to a blockIndex) —
    // concatenated unchanged, same pattern edge/wcs's own STRUCT_BINDINGS arrays already use.
    const bindings = [...deriveBindingsFor(stack, CDRILL_BINDING_SPECS), ...CDRILL_STRUCT_BINDINGS];
    const def = withLatheScene(userOpFromStack(
        'lathe_centerdrill', 'Centre Drill (lathe)', stack,
        bindings, 'form3d+2d', null, LATHE_GROUP,
    ), CDRILL_DEFAULTS, 'centredrill');   // …a bit on the centreline, not an insert on a holder — t1722: matches LATHE_TOOL_KINDS.centredrill's declared id (data/latheTools.js), not a second, American-spelled identity
    def.postInstantiate = (stack, resolved) => applyStraightPeck(stack, resolved);
    return def;
}
