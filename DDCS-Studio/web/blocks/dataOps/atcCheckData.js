/**
 * blocks/dataOps/atcCheckData.js — the ATC TOOL BREAKAGE / LENGTH RE-CHECK built-in as a pure DATA definition (t411).
 *
 * INHERITS the light-ATC-port recipe from atcLengthData.js EXACTLY (same static shape, same profile): 8 scalar bindings by
 * macro-var IDENTITY (#1 maxDist / #2 retract / #3 f_fast / #4 f_slow / #5 port / #6 blockHeight / #19 safeZ / #20 tolerance),
 * + the two source-touches (the interpolated SUMMARY header RECOMPOSED from resolved params via the shared
 * atcToolCheckHeaderComments; the #5/#6 source-chips re-applied via srcVal/srcNote on Expert). `level` baked. Static shape →
 * no superset; no sim-starts. (Only difference vs Tool Length: +tolerance #20 + a SINGLE interpolated header line.)
 */
import { atcToolCheckStack } from '../../wizards/stacks/atcToolCheckWizard.js';
import { userOpFromStack, flattenBlocks } from '../userOps.js';
import { srcVal, srcNote } from '../../wizards/probeBlocks.js';
import { deriveBindingsFor } from './deriveBindings.js';

/** Author defaults — match atcToolCheckStack's own num() fallbacks so the seeded template == the true default stack. */
export const ATC_CHECK_DEFAULTS = { blockHeight: 50, safeZ: 10, maxDist: 100, retract: 3, f_fast: 300, f_slow: 50, port: 2, level: 0, tolerance: 0.5 };

/** The bindable scalars → the `assign` macro var each writes. #5 (port) + #6 (blockHeight) are ALSO source-chip vars. level baked. */
// t1890 — every field here feeds the SAME macro, whose whole purpose is READING a stored tool-table length back for
// comparison (atcToolCheckWizard.js reads `#[toolBase+tool-1]`); gated uniformly on `_toolTableOk` (see atcLengthData's
// own note — true for every DDCS variant + rs274ngc/centroid, false only for grbl's confirmed variable-less firmware).
const TT_GATE = { param: '_toolTableOk', is: false, tip: 'This controller has no in-program tool-length table to check against.' };
export const ATC_CHECK_BINDING_SPECS = [
    { param: 'maxDist',     type: 'number', default: ATC_CHECK_DEFAULTS.maxDist,     label: 'Max Plunge',  help: 'How far the tool searches down toward the setter before it gives up.', section: 'TOOL & CUT', match: { type: 'assign', var: '#1' },  key: 'value', gate: TT_GATE },
    { param: 'retract',     type: 'number', default: ATC_CHECK_DEFAULTS.retract,     label: 'Retract',     help: 'How far the tool backs off after the first touch, before the slow re-approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#2' },  key: 'value', gate: TT_GATE },
    { param: 'f_fast',      type: 'number', default: ATC_CHECK_DEFAULTS.f_fast,      label: 'Fast Feed',   help: 'Feed rate (mm/min) for the initial fast approach to the setter.', section: 'TOOL & CUT', match: { type: 'assign', var: '#3' },  key: 'value', gate: TT_GATE },
    { param: 'f_slow',      type: 'number', default: ATC_CHECK_DEFAULTS.f_slow,      label: 'Slow Feed',   help: 'Feed rate (mm/min) for the precise second touch.', section: 'TOOL & CUT', match: { type: 'assign', var: '#4' },  key: 'value', gate: TT_GATE },
    { param: 'port',        type: 'number', default: ATC_CHECK_DEFAULTS.port,        label: 'Setter Port', help: 'The controller input port the tool-setter signal is wired to (the G31 P word).', section: 'TOOL & CUT', match: { type: 'assign', var: '#5' },  key: 'value', gate: TT_GATE },
    { param: 'blockHeight', type: 'number', default: ATC_CHECK_DEFAULTS.blockHeight, label: 'Setter Block Height', help: 'The height of the fixed tool-setter block — subtracted from the machine Z at touch to give the measured tool length.', section: 'GEOMETRY', match: { type: 'assign', var: '#6' },  key: 'value', gate: TT_GATE },
    { param: 'safeZ',       type: 'number', default: ATC_CHECK_DEFAULTS.safeZ,       label: 'Safe Z',      help: 'The machine Z to retract to after the touch.', section: 'GEOMETRY', match: { type: 'assign', var: '#19' }, key: 'value', gate: TT_GATE },
    // t2383 — SECTION MISMATCH, fixed: the shell (index.html:900-907) declares ONE real input field —
    // `tolerance`, under its own "TOLERANCE" section — everything else here (maxDist/retract/f_fast/f_slow/
    // port/blockHeight/safeZ) has no shell-visible field at all (edited via Settings → ATC/Probes instead,
    // per the shell's own settings-hint text) and keeps its existing GEOMETRY/TOOL & CUT grouping as the
    // closest reasonable home, unchanged — no shell mandate exists for them either way.
    { param: 'tolerance',   type: 'number', default: ATC_CHECK_DEFAULTS.tolerance,   label: 'Tolerance',   help: 'The tool FAILS if the measured length deviates from the stored value by more than ± this (mm).', section: 'TOLERANCE', match: { type: 'assign', var: '#20' }, key: 'value', gate: TT_GATE },
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
            // t2257 (BACKLOG 20) — 'panel' removed (inert + id-collided with sim's own layout2d pane — see
            // atcChangeData.js's own comment for the full reasoning); layout2d: false tells 'sim' to skip
            // building the pane ATC never had content for.
            { type: 'sim', params: { rotary: false, machine: true, magazine: false, layout2d: false } },
            // t2269 (wizards-as-data E2 measurement, PILOT) — the top-of-form instructional paragraph.
            // atc_check's own static shell (index.html:901) uses .settings-hint (style: 'plain') — the SAME
            // ATC-family class all 6 ATC shells share, genuinely different in rendered result from the
            // majority .wiz-usage 'callout' style the 8 non-ATC shells use (see formWidgets.js's own
            // 'usage_text' branch comment) — text copied verbatim from the shell, not paraphrased.
            { type: 'usage_text', params: { style: 'plain', text: 'A quick tap on the tool setter that <b>aborts if the tool is broken, missing, or the wrong length</b>. Re-measures and compares to the stored tool-length table (1430+T-1). Setter pin/level from <b>Settings → Probes</b>; block height, feeds, safe Z, max distance from <b>Settings → ATC</b>.' } },
            { type: 'param_group', params: { group: 'Tool Check' }, children: [] },
            // t2263 (wizards-as-data E2 measurement, PILOT) — the ONE node type formWidgets.js's traverse()
            // was missing: a live code preview. atc_check's own static shell (index.html:908-911) uses the
            // STANDARD label+tag pair every non-ATC-Table built-in shares — see formWidgets.js's own
            // 'code_preview' branch comment for the full survey of the 15 hardcoded blocks this generalizes.
            { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
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

// FULL RECOMPOSE (t1894, replacing the old header-only patch — mirrors atcLengthData.js's own note + atcTableData.js's
// `applyAtcTableRecompose` precedent): the frozen-template model means a STRUCTURAL dialect difference — atcToolCheckWizard
// .js's own `hasCurrentTool` branch (t1894, the register-refusal fix) — can never surface via a #N-value-only patch; the
// twin's `def.template` freezes ONE branch's lines forever, from whichever dialect was active at registration. Confirmed
// live (WORK-LOG t1894). Fixed by rebuilding the whole body from `atcToolCheckStack(resolved)` fresh on every
// instantiation — byte-identical BY CONSTRUCTION, not by text-patch, so structural differences propagate correctly.
function applyAtcCheckRecompose(stack, resolved) {
    const root = (Array.isArray(stack) ? stack : []).find((b) => b && b.type === 'user_root');
    if (!root) return stack;
    root.children = atcToolCheckStack(resolved);
    return stack;
}

/** Build the tool-check-as-data def — the atcLengthData recipe (bindingSpecs + full recompose + source-chips). */
export function atcCheckDataDef() {
    const SRC_BY_PARAM = { port: 'setterPort', blockHeight: 'blockHeight' };
    const bindings = ATC_CHECK_BINDINGS.map((b) => (SRC_BY_PARAM[b.param] ? { ...b, sourceField: SRC_BY_PARAM[b.param] } : b));
    const def = userOpFromStack('atc_check_data', 'Tool Check (data)', atcCheckDataStack(ATC_CHECK_DEFAULTS), bindings, 'form3d', { forceMachine: true }, 'atc_datawiz');
    def.bindingSpecs = ATC_CHECK_BINDING_SPECS;
    def.postInstantiate = (stack, resolved) => applyProbeSources(applyAtcCheckRecompose(stack, resolved));
    return def;
}
