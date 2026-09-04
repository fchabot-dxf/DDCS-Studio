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
import { atcLengthStack } from '../../wizards/stacks/atcLengthWizard.js';
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
// t2383 — SURVEYED, NOT CHANGED: the shell (index.html:870-888) has NO input fields for any of these seven
// at all — just a settings-hint pointing to Settings → ATC/Probes and a "⚙ ATC Settings…" button. Every one
// of these params is edited via that Settings modal, never inline here — so there is no shell field grouping
// to reproduce for this wizard (unlike atc_check, which has exactly one real shell field — see that file's
// own t2383 note). The existing GEOMETRY/TOOL & CUT split (already canonical, already complete) stands as
// the reasonable status quo, not a mismatch to fix.
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

// t2603 (BACKLOG #71/#72, Phase 1 step 1) — mirrors atcCheckFieldGroups' own header: the ordered/grouped field
// lists this def's own uiChildren tree AND its flat bindings array both need, computed ONCE, called TWICE
// (bootstrap stack for tree order, final stack for the bindings actually shipped). Static shape (no superset/
// guards) — derive directly, no prune wrapper needed. TWO sections (TOOL & CUT, GEOMETRY), both contiguous.
function atcLengthFieldGroups(stack) {
    const derived = deriveBindingsFor(stack, ATC_LENGTH_BINDING_SPECS);
    return {
        TOOL_CUT: derived.filter((b) => b.section === 'TOOL & CUT'),
        GEOMETRY: derived.filter((b) => b.section === 'GEOMETRY'),
    };
}

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

// FULL RECOMPOSE (t1894, replacing the old header-only patch — the atcTableData.js precedent, `applyAtcTableRecompose`):
// t1890/t1892/t1894 found the frozen-template model (`def.template` captured ONCE, at registration, under whichever
// dialect happened to be active then) means a STRUCTURAL difference between dialects — atcLengthWizard.js's own
// `hasCurrentTool` branch (t1894, the register-refusal fix) — can NEVER show up in the live twin form via a mere
// #N-value patch: the frozen template only ever has ONE branch's LINES baked in, forever, regardless of which
// dialect is active when a user later opens the wizard. Confirmed live: a value-only patch left the twin ALWAYS
// showing the branch frozen at registration time, never reacting to a real profile switch. The header-only patch
// this replaces had the SAME latent gap — invisible only because both branches happened to produce identical
// header TEXT, unlike the register lines, which don't). FIXED by rebuilding the WHOLE body from `atcLengthStack
// (resolved)` fresh on every instantiation — the SAME function the built-in and every emit path already use,
// so the twin is byte-identical BY CONSTRUCTION (a call, not a text-patch), and structural dialect differences
// (the refusal branch) now propagate correctly. Source-chips still apply AFTER (recompose seeds #5/#6 literal).
function applyAtcLengthRecompose(stack, resolved) {
    const root = (Array.isArray(stack) ? stack : []).find((b) => b && b.type === 'user_root');
    if (!root) return stack;
    root.children = atcLengthStack(resolved);
    return stack;
}

/** Build the tool-length-as-data def — userOpFromStack + bindingSpecs (re-derive by #var identity) + a full
 *  recompose + source-chips in postInstantiate, so the twin is byte-identical to atcLengthStack BY CONSTRUCTION,
 *  on ALL scalars, BOTH profiles, AND every dialect (t1894 — the recompose is what makes THAT last one true). */
export function atcLengthDataDef() {
    // t2603 (Phase 1 step 1) — a bootstrap stack (same `children`, no tree yet) just to read the ordered/
    // grouped param names atcLengthFieldGroups derives; re-derived again below against the real, final stack.
    const bootstrapStack = [{ type: 'user_root', params: {}, uiChildren: [], children: atcLengthStack(ATC_LENGTH_DEFAULTS) }];
    const g0 = atcLengthFieldGroups(bootstrapStack);
    const fieldRefsOf = (group) => group.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            // t2603 (Phase 1 step 1) — wrapped in split_horizontal so hasTreeLayout() (userOpView.js) routes
            // this twin onto renderUiTree, the SAME mechanism drill/surfacing/bore/.../atc_check already use.
            // Unlike atc_check, this op's own classic shell (`#wiz_atc_length`, index.html:894) has NO real
            // input fields at all (per this file's own t2383 note — just a settings-hint + a button) — so
            // there is no shell usage_text to reproduce verbatim; written fresh, matching every other twin's
            // own quality bar.
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'Tool Length' },
                    children: [
                        { type: 'usage_text', params: { text: 'Touches off the tool setter to write the current tool\'s length into the tool-length table. Setter pin/level, block height, feeds, safe Z, and max distance all live in Settings → ATC / Probes, not here.' } },
                        { type: 'group_box', params: { title: 'TOOL & CUT' }, children: fieldRefsOf(g0.TOOL_CUT) },
                        { type: 'group_box', params: { title: 'GEOMETRY' }, children: fieldRefsOf(g0.GEOMETRY) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                // t2603 (Phase 1 step 2) — panel='form3d' (no 2D pane). preview3d declared ALONE — the SAME
                // shape BACKLOG #77 found broken and t2603 fixed. Verified via atc_table's own row-diff first;
                // this op shares the identical mechanism, not re-verified from scratch.
                RIGHT: [
                    { type: 'preview3d', params: { rotary: false, machine: true, magazine: false } },
                ],
            },
        }],
        children: atcLengthStack(ATC_LENGTH_DEFAULTS),
    }];
    // t2603 — re-derived over the FINAL, real stack (the same computation g0 already used), so the flat binding
    // array below and the declared tree can never disagree — mirrors boreFieldGroups' own two-call pattern.
    const gFinal = atcLengthFieldGroups(stack);
    // tag the source-chip bindings so the form greys them when 'ctrl'-sourced (the value then comes from the register).
    const SRC_BY_PARAM = { port: 'setterPort', blockHeight: 'blockHeight' };
    const toolCut = gFinal.TOOL_CUT.map((b) => (SRC_BY_PARAM[b.param] ? { ...b, sourceField: SRC_BY_PARAM[b.param] } : b));
    const geometry = gFinal.GEOMETRY.map((b) => (SRC_BY_PARAM[b.param] ? { ...b, sourceField: SRC_BY_PARAM[b.param] } : b));
    const bindings = [...toolCut, ...geometry];
    const def = userOpFromStack('atc_length_data', 'Tool Length (data)', stack, bindings, 'form3d', { forceMachine: true }, 'atc_datawiz');
    def.bindingSpecs = ATC_LENGTH_BINDING_SPECS;   // re-derive value-socket indices BY IDENTITY every build
    def.postInstantiate = (stack, resolved) => applyProbeSources(applyAtcLengthRecompose(stack, resolved));
    return def;
}
