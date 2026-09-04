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
import { userOpFromStack, registerLiveDefault } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { appendToolSel } from '../../wizards/ops/toolsel.js';   // the declared tool marker — UNSET → emits nothing
import { LATHE_GROUP } from './facingData.js';
import { withLatheScene } from '../../viz/latheScene.js';   // t1281 — the bar, in the 3D scene

export const OD_DATA_OPTYPE = 'user_lathe_odturn';

/**
 * THE VALUE SOCKETS — each field matched to its block by WHAT THAT BLOCK IS ("the assign whose var is #132"), never
 * by an index. Every one targets the macro's config header, so the form and the operator at the machine edit the
 * same numbers.
 *
 * They bind the DIAMETER sockets, not the radius ones. That is the point of the header carrying both: a field
 * labelled Ø must be bound to a socket that holds a diameter, or the form↔block round trip halves the part.
 */
/**
 * t1315 (advisor ruling) — THE BAR THE PROGRAM IS WRITTEN FOR, on the form where the operator can see it.
 *
 * The stock modal declares the bar in the chuck; this field PREFILLS from it, and the emit follows the FIELD as it
 * always has. So a Ø45 typed in the modal is visible here and lands in #131 — the G-code moves only through a number
 * a person can read. An op-level edit still wins for that op instance, and the baked default is what a workspace
 * with no declared bar falls back to.
 */
export const WORKSPACE_BAR_KEY = 'workspaceBarDiameter';
const workspaceBarDiameter = () => {
    try {
        const st = (typeof window !== 'undefined' && window.ddcsGetSettings) ? window.ddcsGetSettings().stock : null;
        if (st && st.shape === 'cylinder' && st.axis === 'z' && st.origin === 'finished-face' && Number(st.diameter) > 0) return Number(st.diameter);
    } catch (_) { /* no workspace stock — the baked default below is the answer */ }
    return OD_DEFAULTS.barDiameter;
};

registerLiveDefault(WORKSPACE_BAR_KEY, workspaceBarDiameter);   // …the fact belongs to whoever knows it

export const OD_BINDING_SPECS = [
    // …the bar this program is written for. Bound to the header socket that already holds it (#131), so the number
    // on the form and the number in the macro are the same one.
    { param: 'barDiameter', match: { type: 'assign', var: OD_VARS.dBar }, key: 'value', type: 'number',
      label: 'Bar Ø (stock)', section: 'GEOMETRY', default: OD_DEFAULTS.barDiameter, defaultLive: WORKSPACE_BAR_KEY,
      help: 'The stock in the chuck. Prefilled from the workspace stock; type here to override it for this op alone.' },
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

/**
 * t1293 — THE TWIN DELEGATES TO THE ONE STACK BUILDER. This is the blocker the advisor's probe found, and the root is
 * worth stating plainly: a data twin's template is a SNAPSHOT, built once from the defaults. t1291's taper fix is a
 * BUILD-TIME branch inside `odTurnStack`, so the snapshot froze the STRAIGHT arm — and picking Taper in the UI only
 * wrote values into that straight structure. My asserts passed because they called the stack builder directly; the
 * app resolves the twin, and the twin still emitted the pre-fix gouge.
 *
 * (Facing's zero-DOC fix verified through its twin for the opposite reason: that branch runs on the CONTROLLER, so it
 * is present in every snapshot whatever the default was. A build-time branch cannot survive being snapshotted; a
 * runtime one cannot help but.)
 *
 * So the macro is REGENERATED from the resolved params — the same thing polygon turning already does, and the same
 * reason: when a parameter changes the SHAPE of the program rather than a number in it, the program has to be rebuilt
 * rather than patched. One emit source, and the duplicate cannot drift because there is no duplicate.
 */
export function rebuildOdTurn(stack, resolved) {
    const p = resolved || {};
    const num = (k) => (Number(p[k]) > 0 || Number(p[k]) === 0 ? Number(p[k]) : OD_DEFAULTS[k]);
    const built = odTurnStack({
        ...OD_DEFAULTS,
        kind: odKind(p.kind),
        targetDiameter: num('targetDiameter'),
        // an UNSET far end means "follows the target" — the straight turn's reference, resolved to a number here
        endDiameter: (Number(p.endDiameter) > 0) ? Number(p.endDiameter) : num('targetDiameter'),
        depth: num('depth'),
        doc: num('doc'),
        finish: num('finish'),
        feed: num('feed'),
        feedFinish: num('feedFinish'),
        // t1315 — …AND THE BAR. The rebuild regenerates the whole macro, so a param it does not carry is a param the
        // substitution cannot keep: the bar field wrote #131 and this wrote it straight back to the baked default.
        // (Found by asserting the chain end to end rather than at the binding.)
        barDiameter: num('barDiameter'),
    });
    const root = Array.isArray(stack) && stack[0] ? stack[0] : null;
    if (!root) return stack;
    const keep = (root.children || []).filter((b) => b && b.type === 'toolsel');   // the declared tool marker rides along
    root.children = [...built, ...keep];
    return stack;
}

/**
 * t1305 — `applyStraightEnd` IS GONE, and its absence is the point. It existed to patch the far-end socket back to
 * the one-source reference (`#133=#132`) after instantiate() baked a concrete number into a snapshot. The macro now
 * decides straight-vs-taper at RUN TIME, so the builder writes that reference itself for a straight turn and the
 * patcher could only ever disagree with it — which it had already started doing, in its note text.
 */

/** The twin, ready for registerUserOp — a Lathe-group op with a 2D panel and no rotary/machine sim claims. */
export function odTurnDataDef() {
    // t2617 (BACKLOG #71/#72, the sixth axis) — same minimal pattern as facingData.js/centerDrillData.js.
    // Sections declared IDENTITY/GEOMETRY/TOOL & CUT from the start (canonical SECTION_RANK order).
    const fieldRefsOf = (specs) => specs.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const allSpecs = [...OD_BINDING_SPECS, ...OD_STRUCT_BINDINGS];
    const bySection = (name) => allSpecs.filter((b) => b.section === name);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'OD Turn' },
                    children: [
                        { type: 'group_box', params: { title: 'IDENTITY' }, children: fieldRefsOf(bySection('IDENTITY')) },
                        { type: 'group_box', params: { title: 'GEOMETRY' }, children: fieldRefsOf(bySection('GEOMETRY')) },
                        { type: 'group_box', params: { title: 'TOOL & CUT' }, children: fieldRefsOf(bySection('TOOL & CUT')) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                RIGHT: [
                    { type: 'preview3d', params: {} },
                    { type: 'feature_canvas', params: { panel: 'form3d+2d' } },
                    { type: 'layout', params: { kind: 'lathe_profile' } },   // the half-profile, not the mill's XY stock
                ],
            },
        }],
        children: appendToolSel(odTurnStack(OD_DEFAULTS)),
    }];
    const bindings = [...deriveBindingsFor(stack, OD_BINDING_SPECS), ...OD_STRUCT_BINDINGS];
    const def = withLatheScene(userOpFromStack(
        'lathe_odturn',
        'OD Turn (lathe)',
        stack,
        bindings,
        'form3d+2d',
        null,
        LATHE_GROUP,
    ), OD_DEFAULTS);
    // …no `bindingSpecs` re-derive: this template carries NO guards, so no prune shifts the indices and the frozen
    // bindings stay correct. (Setting it anyway cost the `.wiz` round trip its identity — bindingSpecs is not part of
    // the wizard file format, so an exported copy came back missing it.)
    // REGENERATE FIRST (the shape follows kind), THEN the straight-end reference — order matters: the rebuild emits a
    def.postInstantiate = (stack, resolved) => rebuildOdTurn(stack, resolved);
    return def;
}
