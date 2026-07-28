/**
 * blocks/dataOps/odTurnData.js — OD TURNING as a DATA-OP TWIN (t1273). The lathe family's second citizen, and the
 * first one that INHERITS rather than proves: the registration path, the identity-derived bindings and the `.wiz`
 * round trip all came from the facing pilot unchanged.
 *
 * THE IDENTITY IS REAL HERE. Facing had none, so its form led with geometry; an OD turn is either STRAIGHT or a
 * TAPER, and that choice decides what the rest of the fields mean — so it sits at the top, where an op-defining
 * field belongs.
 *
 * ── WHY `endDiameter` IS AN EXPRESSION ON A STRAIGHT TURN ────────────────────────────────────────────────────────
 * A straight turn is the case where the far end equals the face end. Rather than copy the target diameter into the
 * far-end socket — a second number that drifts the moment someone edits one of them — a straight turn writes the
 * REFERENCE: `#133 = #132`. The macro then says out loud "the far end is the target", the operator changing the
 * target at the machine keeps it straight, and there is exactly one place a straight turn's diameter lives.
 */
import { odTurnStack, OD_DEFAULTS, OD_VARS, OD_KINDS, odKind } from '../../wizards/lathe/odTurn.js';
import { userOpFromStack } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // the declared tool marker — UNSET → emits nothing
import { LATHE_GROUP } from './facingData.js';

export const OD_DATA_OPTYPE = 'user_lathe_odturn';

/**
 * THE VALUE SOCKETS — each field matched to its block by WHAT THAT BLOCK IS ("the assign whose var is #132"), never
 * by an index. Every one targets the macro's config header, so the form and the operator at the machine edit the
 * same numbers.
 *
 * They bind the DIAMETER sockets, not the radius ones. That is the point of the header carrying both: a field
 * labelled Ø must be bound to a socket that holds a diameter, or the form↔block round trip halves the part.
 */
export const OD_BINDING_SPECS = [
    { param: 'targetDiameter', match: { type: 'assign', var: OD_VARS.dTarget }, key: 'value', type: 'number',
      label: 'Target Ø', help: 'The finished diameter at the face end — as it is written on the drawing. The controller works out the radius.',
      section: 'GEOMETRY', units: 'mm', default: OD_DEFAULTS.targetDiameter },
    // …no `default`: the socket HOLDS the straight turn's reference (#132), and a spec with no default is socketHeld,
    // so an untouched field leaves that expression alone instead of stamping a literal over it. `when` shows the field
    // only on a taper — the number has no meaning on a straight turn, and a DECLARED gate travels in the file.
    { param: 'endDiameter', match: { type: 'assign', var: OD_VARS.dEnd }, key: 'value', type: 'number',
      label: 'Far-end Ø', help: 'The diameter at the deep end of the taper. A straight turn has no far-end diameter of its own — it follows the target.',
      section: 'GEOMETRY', units: 'mm', when: { param: 'kind', is: 'taper' } },
    { param: 'depth', match: { type: 'assign', var: OD_VARS.depth }, key: 'value', type: 'number',
      label: 'Length', help: 'How far along the bar the turn runs, from the finished face toward the chuck.',
      section: 'GEOMETRY', units: 'mm', default: OD_DEFAULTS.depth },
    { param: 'doc', match: { type: 'assign', var: OD_VARS.doc }, key: 'value', type: 'number',
      label: 'Depth per pass', help: 'How much RADIUS each roughing pass takes off. Where the material does not divide evenly, the light pass falls first — through the skin.',
      section: 'GEOMETRY', units: 'mm', default: OD_DEFAULTS.doc },
    { param: 'finish', match: { type: 'assign', var: OD_VARS.finish }, key: 'value', type: 'number',
      label: 'Finish allowance', help: 'How much RADIUS the roughing passes leave for the finishing pass. Same terms as the depth of cut.',
      section: 'GEOMETRY', units: 'mm', default: OD_DEFAULTS.finish },
    { param: 'feed', match: { type: 'assign', var: OD_VARS.feed }, key: 'value', type: 'number',
      label: 'Roughing feed', section: 'TOOL & CUT', units: 'mm/min', default: OD_DEFAULTS.feed },
    { param: 'feedFinish', match: { type: 'assign', var: OD_VARS.feedFinish }, key: 'value', type: 'number',
      label: 'Finishing feed', help: 'The finishing pass gets its own feed — on a lathe that is the surface finish knob.',
      section: 'TOOL & CUT', units: 'mm/min', default: OD_DEFAULTS.feedFinish },
    { param: 'toolNum', match: { type: 'toolsel' }, key: 'toolNum', type: 'number',
      label: 'Tool', help: 'The tool-library number this op runs. Unset = no declared tool, and the program says nothing about tool changes.',
      section: 'TOOL & CUT' },
];

/** THE IDENTITY — a form control with no socket of its own: it decides what the far-end diameter MEANS. */
export const OD_STRUCT_BINDINGS = [
    { param: 'kind', type: 'enum', widget: 'segmented', default: OD_DEFAULTS.kind, label: 'Turn', section: 'IDENTITY',
      help: `${OD_KINDS.straight.why} / ${OD_KINDS.taper.why}`,
      widgetConfig: { options: [[OD_KINDS.straight.label, 'straight'], [OD_KINDS.taper.label, 'taper']] } },
];

/** The wrapped template: the UI declarations, then the macro itself as the executable children. */
function odDataStack(p = OD_DEFAULTS) {
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            // form2d: the form on the left, the half-profile canvas on the right — the pilot's layout
            { type: 'panel', params: { panel: 'form2d' } },
            { type: 'layout', params: { kind: 'lathe_profile' } },   // the half-profile, not the mill's XY stock
            { type: 'param_group', params: { group: 'OD Turn' }, children: [] },
        ],
        children: appendToolSel(odTurnStack(p)),
    }];
}

export const OD_BINDINGS = deriveBindingsFor(odDataStack(OD_DEFAULTS), OD_BINDING_SPECS);

/**
 * A STRAIGHT turn's far-end diameter is not a copy of the target — it IS the target. Writing the reference keeps one
 * source and makes the macro say so; a taper leaves the typed number alone.
 */
export function applyStraightEnd(stack, resolved) {
    if (odKind(resolved && resolved.kind) === 'taper') return stack;
    const walk = (blocks) => (blocks || []).forEach((b) => {
        if (b.type === 'assign' && b.params && b.params.var === OD_VARS.dEnd) {
            b.params.value = OD_VARS.dTarget;
            b.params.note = 'far-end DIAMETER — the target itself, so a straight turn stays straight';
        }
        if (b.children) walk(b.children);
        if (b.uiChildren) walk(b.uiChildren);
    });
    walk(stack);
    return stack;
}

/** The twin, ready for registerUserOp — a Lathe-group op with a 2D panel and no rotary/machine sim claims. */
export function odTurnDataDef() {
    const def = userOpFromStack(
        'lathe_odturn',
        'OD Turn (lathe)',
        odDataStack(OD_DEFAULTS),
        [...OD_BINDINGS, ...OD_STRUCT_BINDINGS],
        'form2d',
        null,
        LATHE_GROUP,
    );
    // …no `bindingSpecs` re-derive: this template carries NO guards, so no prune shifts the indices and the frozen
    // bindings stay correct. (Setting it anyway cost the `.wiz` round trip its identity — bindingSpecs is not part of
    // the wizard file format, so an exported copy came back missing it.)
    def.postInstantiate = (stack, resolved) => applyStraightEnd(stack, resolved);
    return def;
}
