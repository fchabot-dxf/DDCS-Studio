/**
 * blocks/dataOps/atcLengthData.js — the ATC TOOL LENGTH SETTER built-in expressed as a pure DATA definition (t409, the
 * pilot for the light-ATC-port recipe; ATC Tool Check inherits it next).
 *
 * atcLengthStack is single STATIC shape (no guards) — the 7 scalar params map to plain #var sockets (#1 maxDist / #2
 * retract / #3 f_fast / #4 f_slow / #5 port / #6 blockHeight / #19 safeZ). Bindings by macro-var IDENTITY (deriveBindings),
 * like corner/middle. TWO source-touches (the corner precedent, so the twin is byte-identical to the built-in on ALL
 * scalars + BOTH profiles): (a) the interpolated SUMMARY header is RECOMPOSED from resolved params via the shared
 * atcLengthHeaderComments (bindings only touch the #N VALUES, not composed comment text); (b) the #5/#6 source-chips
 * (setterPort/blockHeight → a controller register on Expert) are re-applied POST-instantiate via the SAME srcVal/srcNote
 * the built-in uses. `level` stays baked (a machine constant — the corner/edge/middle convention). Static shape → no
 * bindingSpecs superset (the template IS atcLengthStack(defaults)); no sim-starts (milling/ATC sim renders from the EMIT).
 */
import { atcLengthStack, atcLengthHeaderComments } from '../../wizards/stacks/atcLengthWizard.js';
import { userOpFromStack, flattenBlocks } from '../userOps.js';
import { srcVal, srcNote } from '../../wizards/probeBlocks.js';   // the SAME source functions the built-in uses (controller register over the literal on Expert)
import { deriveBindingsFor } from './deriveBindings.js';

/** Author defaults — match atcLengthStack's own num() fallbacks so the seeded template == the true default stack. */
export const ATC_LENGTH_DEFAULTS = { blockHeight: 50, safeZ: 10, maxDist: 100, retract: 3, f_fast: 300, f_slow: 50, port: 2, level: 0 };

/** The bindable scalars → the `assign` macro var each writes. DECLARED by identity (var). #5 (port) + #6 (blockHeight) are
 *  ALSO source-chip vars: the binding injects the literal, applyProbeSources rewrites it to a register on Expert. level baked. */
// t1890 — every field here feeds the SAME macro, whose whole purpose is a tool-table WRITE (atcLengthWizard.js's
// `TO('#103','#102')`); gated uniformly on `_toolTableOk` (true for every DDCS variant + rs274ngc/centroid, false
// only for grbl — a confirmed structural absence, see userOpView.js's own activePostToolTable comment).
const TT_GATE = { param: '_toolTableOk', is: false, tip: 'This controller has no in-program tool-length table to write to.' };
export const ATC_LENGTH_BINDING_SPECS = [
    { param: 'maxDist',     type: 'number', default: ATC_LENGTH_DEFAULTS.maxDist,     label: 'Max Plunge',  help: 'How far the tool searches down toward the setter before it gives up.', section: 'TOOL & CUT', match: { type: 'assign', var: '#1' },  key: 'value', gate: TT_GATE },
    { param: 'retract',     type: 'number', default: ATC_LENGTH_DEFAULTS.retract,     label: 'Retract',     help: 'How far the tool backs off after the first touch, before the slow, accurate re-approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#2' },  key: 'value', gate: TT_GATE },
    { param: 'f_fast',      type: 'number', default: ATC_LENGTH_DEFAULTS.f_fast,      label: 'Fast Feed',   help: 'Feed rate (mm/min) for the initial fast approach to the setter.', section: 'TOOL & CUT', match: { type: 'assign', var: '#3' },  key: 'value', gate: TT_GATE },
    { param: 'f_slow',      type: 'number', default: ATC_LENGTH_DEFAULTS.f_slow,      label: 'Slow Feed',   help: 'Feed rate (mm/min) for the precise second touch.', section: 'TOOL & CUT', match: { type: 'assign', var: '#4' },  key: 'value', gate: TT_GATE },
    { param: 'port',        type: 'number', default: ATC_LENGTH_DEFAULTS.port,        label: 'Setter Port', help: 'The controller input port the tool-setter signal is wired to (the G31 P word).', section: 'TOOL & CUT', match: { type: 'assign', var: '#5' },  key: 'value', gate: TT_GATE },
    { param: 'blockHeight', type: 'number', default: ATC_LENGTH_DEFAULTS.blockHeight, label: 'Setter Block Height', help: 'The height of the fixed tool-setter block — subtracted from the machine Z at touch to give the true tool length.', section: 'GEOMETRY', match: { type: 'assign', var: '#6' },  key: 'value', gate: TT_GATE },
    { param: 'safeZ',       type: 'number', default: ATC_LENGTH_DEFAULTS.safeZ,       label: 'Safe Z',      help: 'The machine Z to retract to after the touch.', section: 'GEOMETRY', match: { type: 'assign', var: '#19' }, key: 'value', gate: TT_GATE },
];

export const ATC_LENGTH_DATA_OPTYPE = 'user_atc_length_data';

/** The wrapped `user_root` template. Static shape (no superset) → the template IS atcLengthStack(defaults), wrapped byte-
 *  transparently. panel form3d + sim forceMachine — the built-in atcLengthView is twoPane with a 3D machine preview. */
export function atcLengthDataStack(params = ATC_LENGTH_DEFAULTS) {
    const exec = atcLengthStack(params);
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d' } },
            { type: 'sim', params: { rotary: false, machine: true, magazine: false } },
            { type: 'param_group', params: { group: 'Tool Length' }, children: [] },
        ],
        children: exec,
    }];
}

export const ATC_LENGTH_BINDINGS = deriveBindingsFor(atcLengthDataStack(ATC_LENGTH_DEFAULTS), ATC_LENGTH_BINDING_SPECS);

// SOURCE-CHIPS (the corner/edge precedent): on Expert (window.ddcsResolveProbeSources present), rewrite #5 (setterPort) +
// #6 (blockHeight) to the controller register via the SAME srcVal/srcNote the built-in uses. Applied POST-instantiate
// because the template is seeded with NO sources (literal). STUDIO / no native register → resolve returns {} → byte-identical.
const PROBE_SRC_VARS = { setterPort: '#5', blockHeight: '#6' };
function applyProbeSources(stack) {
    const resolve = (typeof window !== 'undefined' && window.ddcsResolveProbeSources) ? window.ddcsResolveProbeSources : null;
    const sources = resolve ? resolve(['setterPort', 'blockHeight']) : {};
    if (!sources || !Object.keys(sources).length) return stack;   // studio / non-Expert → unchanged (byte-identical)
    for (const b of flattenBlocks(stack)) {
        if (!b || b.type !== 'assign' || !b.params) continue;
        for (const field in PROBE_SRC_VARS) {
            if (b.params.var === PROBE_SRC_VARS[field] && sources[field]) {
                b.params.value = String(srcVal(sources[field], b.params.value));   // src.ctrl (the controller register) over the literal
                b.params.note = srcNote(sources[field], b.params.note);            // "<note> - controller PrNNN"
            }
        }
    }
    return stack;
}

// HEADER RECOMPOSE (the cornerData precedent): the static template froze the 2 SUMMARY comments at ATC_LENGTH_DEFAULTS
// (bindings only touch the #N VALUES, not composed comment text). Recompose them from the RESOLVED params via the SAME
// atcLengthHeaderComments format → twin==built-in byte-identical for ALL scalars, not just defaults. Match by the frozen text.
function applyHeaderComments(stack, resolved) {
    const [d1, d2] = atcLengthHeaderComments(ATC_LENGTH_DEFAULTS);
    const [r1, r2] = atcLengthHeaderComments(resolved || {});
    if (d1 === r1 && d2 === r2) return stack;   // scalars at defaults → nothing to rewrite (byte-identical)
    for (const b of flattenBlocks(stack)) {
        if (!b || b.type !== 'comment' || !b.params) continue;
        if (b.params.text === d1) b.params.text = r1;
        else if (b.params.text === d2) b.params.text = r2;
    }
    return stack;
}

/** Build the tool-length-as-data def — userOpFromStack + bindingSpecs (re-derive by #var identity) + the two source-touches
 *  (header recompose + source-chips) in postInstantiate, so the twin is byte-identical to atcLengthStack on ALL scalars + BOTH profiles. */
export function atcLengthDataDef() {
    // tag the source-chip bindings so the form greys them when 'ctrl'-sourced (the value then comes from the register).
    const SRC_BY_PARAM = { port: 'setterPort', blockHeight: 'blockHeight' };
    const bindings = ATC_LENGTH_BINDINGS.map((b) => (SRC_BY_PARAM[b.param] ? { ...b, sourceField: SRC_BY_PARAM[b.param] } : b));
    const def = userOpFromStack('atc_length_data', 'Tool Length (data)', atcLengthDataStack(ATC_LENGTH_DEFAULTS), bindings, 'form3d', { forceMachine: true }, 'atc_datawiz');
    def.bindingSpecs = ATC_LENGTH_BINDING_SPECS;   // re-derive value-socket indices BY IDENTITY every build
    def.postInstantiate = (stack, resolved) => applyHeaderComments(applyProbeSources(stack), resolved);   // header recompose + source-chips (both rewrite from resolved state)
    return def;
}
