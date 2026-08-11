/**
 * blocks/dataOps/atcCheckData.js — the ATC TOOL BREAKAGE / LENGTH RE-CHECK built-in as a pure DATA definition (t411).
 *
 * INHERITS the light-ATC-port recipe from atcLengthData.js EXACTLY (same static shape, same profile): 8 scalar bindings by
 * macro-var IDENTITY (#1 maxDist / #2 retract / #3 f_fast / #4 f_slow / #5 port / #6 blockHeight / #19 safeZ / #20 tolerance),
 * + the two source-touches (the interpolated SUMMARY header RECOMPOSED from resolved params via the shared
 * atcToolCheckHeaderComments; the #5/#6 source-chips re-applied via srcVal/srcNote on Expert). `level` baked. Static shape →
 * no superset; no sim-starts. (Only difference vs Tool Length: +tolerance #20 + a SINGLE interpolated header line.)
 */
import { atcToolCheckStack, atcToolCheckHeaderComments } from '../../wizards/stacks/atcToolCheckWizard.js';
import { userOpFromStack, flattenBlocks } from '../userOps.js';
import { srcVal, srcNote } from '../../wizards/probeBlocks.js';
import { deriveBindingsFor } from './deriveBindings.js';

/** Author defaults — match atcToolCheckStack's own num() fallbacks so the seeded template == the true default stack. */
export const ATC_CHECK_DEFAULTS = { blockHeight: 50, safeZ: 10, maxDist: 100, retract: 3, f_fast: 300, f_slow: 50, port: 2, level: 0, tolerance: 0.5 };

/** The bindable scalars → the `assign` macro var each writes. #5 (port) + #6 (blockHeight) are ALSO source-chip vars. level baked. */
export const ATC_CHECK_BINDING_SPECS = [
    { param: 'maxDist',     type: 'number', default: ATC_CHECK_DEFAULTS.maxDist,     label: 'Max Plunge',  help: 'How far the tool searches down toward the setter before it gives up.', section: 'TOOL & CUT', match: { type: 'assign', var: '#1' },  key: 'value' },
    { param: 'retract',     type: 'number', default: ATC_CHECK_DEFAULTS.retract,     label: 'Retract',     help: 'How far the tool backs off after the first touch, before the slow re-approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#2' },  key: 'value' },
    { param: 'f_fast',      type: 'number', default: ATC_CHECK_DEFAULTS.f_fast,      label: 'Fast Feed',   help: 'Feed rate (mm/min) for the initial fast approach to the setter.', section: 'TOOL & CUT', match: { type: 'assign', var: '#3' },  key: 'value' },
    { param: 'f_slow',      type: 'number', default: ATC_CHECK_DEFAULTS.f_slow,      label: 'Slow Feed',   help: 'Feed rate (mm/min) for the precise second touch.', section: 'TOOL & CUT', match: { type: 'assign', var: '#4' },  key: 'value' },
    { param: 'port',        type: 'number', default: ATC_CHECK_DEFAULTS.port,        label: 'Setter Port', help: 'The controller input port the tool-setter signal is wired to (the G31 P word).', section: 'TOOL & CUT', match: { type: 'assign', var: '#5' },  key: 'value' },
    { param: 'blockHeight', type: 'number', default: ATC_CHECK_DEFAULTS.blockHeight, label: 'Setter Block Height', help: 'The height of the fixed tool-setter block — subtracted from the machine Z at touch to give the measured tool length.', section: 'GEOMETRY', match: { type: 'assign', var: '#6' },  key: 'value' },
    { param: 'safeZ',       type: 'number', default: ATC_CHECK_DEFAULTS.safeZ,       label: 'Safe Z',      help: 'The machine Z to retract to after the touch.', section: 'GEOMETRY', match: { type: 'assign', var: '#19' }, key: 'value' },
    { param: 'tolerance',   type: 'number', default: ATC_CHECK_DEFAULTS.tolerance,   label: 'Tolerance',   help: 'The tool FAILS if the measured length deviates from the stored value by more than ± this (mm).', section: 'GEOMETRY', match: { type: 'assign', var: '#20' }, key: 'value' },
];

export const ATC_CHECK_DATA_OPTYPE = 'user_atc_check_data';

/** The wrapped `user_root` template. Static shape → the template IS atcToolCheckStack(defaults). panel form3d + sim
 *  forceMachine — the built-in atcCheckView is twoPane with a 3D machine preview (preview3D + previewMachine). */
export function atcCheckDataStack(params = ATC_CHECK_DEFAULTS) {
    const exec = atcToolCheckStack(params);
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d' } },
            { type: 'sim', params: { rotary: false, machine: true, magazine: false } },
            { type: 'param_group', params: { group: 'Tool Check' }, children: [] },
        ],
        children: exec,
    }];
}

export const ATC_CHECK_BINDINGS = deriveBindingsFor(atcCheckDataStack(ATC_CHECK_DEFAULTS), ATC_CHECK_BINDING_SPECS);

// SOURCE-CHIPS (the atcLength/corner precedent): on Expert, rewrite #5 (setterPort) + #6 (blockHeight) to the controller
// register via the SAME srcVal/srcNote the built-in uses. Studio / no native register → resolve returns {} → byte-identical.
const PROBE_SRC_VARS = { setterPort: '#5', blockHeight: '#6' };
function applyProbeSources(stack) {
    const resolve = (typeof window !== 'undefined' && window.ddcsResolveProbeSources) ? window.ddcsResolveProbeSources : null;
    const sources = resolve ? resolve(['setterPort', 'blockHeight']) : {};
    if (!sources || !Object.keys(sources).length) return stack;   // studio / non-Expert → unchanged (byte-identical)
    for (const b of flattenBlocks(stack)) {
        if (!b || b.type !== 'assign' || !b.params) continue;
        for (const field in PROBE_SRC_VARS) {
            if (b.params.var === PROBE_SRC_VARS[field] && sources[field]) {
                b.params.value = String(srcVal(sources[field], b.params.value));
                b.params.note = srcNote(sources[field], b.params.note);
            }
        }
    }
    return stack;
}

// HEADER RECOMPOSE (the atcLength precedent): recompose the frozen SUMMARY comment from the RESOLVED params via the SAME
// atcToolCheckHeaderComments format → twin==built-in byte-identical for ALL scalars. Match by the frozen default text.
function applyHeaderComments(stack, resolved) {
    const [d1] = atcToolCheckHeaderComments(ATC_CHECK_DEFAULTS);
    const [r1] = atcToolCheckHeaderComments(resolved || {});
    if (d1 === r1) return stack;   // scalars at defaults → nothing to rewrite (byte-identical)
    for (const b of flattenBlocks(stack)) {
        if (b && b.type === 'comment' && b.params && b.params.text === d1) b.params.text = r1;
    }
    return stack;
}

/** Build the tool-check-as-data def — the atcLengthData recipe (bindingSpecs + header recompose + source-chips). */
export function atcCheckDataDef() {
    const SRC_BY_PARAM = { port: 'setterPort', blockHeight: 'blockHeight' };
    const bindings = ATC_CHECK_BINDINGS.map((b) => (SRC_BY_PARAM[b.param] ? { ...b, sourceField: SRC_BY_PARAM[b.param] } : b));
    const def = userOpFromStack('atc_check_data', 'Tool Check (data)', atcCheckDataStack(ATC_CHECK_DEFAULTS), bindings, 'form3d', { forceMachine: true }, 'atc_datawiz');
    def.bindingSpecs = ATC_CHECK_BINDING_SPECS;
    def.postInstantiate = (stack, resolved) => applyHeaderComments(applyProbeSources(stack), resolved);
    return def;
}
