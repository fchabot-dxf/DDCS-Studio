/**
 * blocks/dataOps/edgeData.js — the EDGE built-in expressed as a pure DATA definition (FAN-OUT port #1, E1 EMIT).
 *
 * Edge is a strict SUBSET of corner (one wall = a LINE datum, one WCS register; NO safeTraverse / reposition / safe-Z /
 * probeZFirst superset / fan-out). It INHERITS all the corner-hardened machinery: userOpFromStack, deriveBindings (by
 * macro-var IDENTITY), bindingSpecs (re-derive at build), the guard/prune superset, and the emitEquivalence byte-test.
 *
 * The 6 SCALAR bindings (#1..#6) are DECLARED by identity (var), never hand-counted. The 3 STRUCTURAL params (axis / dir /
 * wcs) drive the edgeStack superset guards: axis×dir forks the confirm+probe region (per-combo vars/sign + KIND-B prompt),
 * axis×wcs forks the WCS write (address offset + target label), and a 7-way wcs fork the base-address blocks. instantiate()
 * prunes to the concrete shape. RADIUS-COMP = TRUE-WALL-FACE (direction-driven ±, byte-identical to the built-in edge; the
 * outside-fence datum-offset is a separate optional future param on the shared radiuscomp primitive, not a bespoke edge flip).
 *
 * Template SEEDED from edgeStack(EDGE_DEFAULTS, {superset:true}); the BINDINGS are derived + proven byte-identical to the
 * built-in edge (across axis/dir/wcs + a scalar sweep) by tests/edge-data-emit.spec.js. SCOPE (E1) = EMIT only — no view/
 * panel (E3), no sim-starts (E2), no in-place swap (E4).
 */
import { edgeStack } from '../../wizards/stacks/edgeWizard.js';
import { userOpFromStack, childrenOf } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { pruneGuards } from '../whenGuard.js';   // derive EDGE_BINDINGS over a CANONICAL-pruned stack (the superset guards duplicate nothing bound — #1..#6 are outside the guards — but keep the corner-identical shape)
import { makeProvider } from '../../viz/opSimStarts.js';   // E2 — the declared 'edge' anchor → the per-pass preview marker (mirror corner's provider)
import { srcVal, srcNote } from '../../wizards/probeBlocks.js';   // the SAME source functions the built-in uses (controller register over the literal on an Expert profile)

/** Author defaults — match edgeStack's num() fallbacks + the built-in Edge field defaults. Structural axis/dir/wcs baked at
 *  the default shape (X / pos / active-WCS). level is BAKED (the same deliberate frontier as corner). */
export const EDGE_DEFAULTS = {
    axis: 'X', dir: 'pos', wcs: 'active',
    dist: 15, retract: 2, f_fast: 200, f_slow: 50, port: 3, radius: 2, level: 0,
};

/** The 6 bindable scalars → the `assign` macro var each writes. DECLARED by identity (var), NOT position — deriveBindings
 *  re-finds the flat index, so a template edit can never desync them. (level is BAKED — no live socket, like corner.) */
// t1756 — MACHINE VARIABLES ROLL OUT, probe family. Edge's 6 scalars are the SAME shape as corner's own #1-#6
// (a plain magnitude read into a G31 probe atom's value socket, no JS arithmetic/branch/count) — corner already
// proved this shape eligible, so the same 6 params get the same declaration here, not re-litigated.
export const EDGE_BINDING_SPECS = [
    { param: 'dist',    type: 'number', tokenEligible: true, default: EDGE_DEFAULTS.dist,    label: 'Max Probe Dist', help: 'How far the stylus travels toward the wall before it gives up — larger than the gap to the wall, smaller than the next obstacle.', section: 'TOOL & CUT', match: { type: 'assign', var: '#1' }, key: 'value' },
    { param: 'retract', type: 'number', tokenEligible: true, default: EDGE_DEFAULTS.retract, label: 'Retract',        help: 'How far the probe backs off the wall after the first touch, before the slow, accurate re-approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#2' }, key: 'value' },
    { param: 'f_fast',  type: 'number', tokenEligible: true, default: EDGE_DEFAULTS.f_fast,  label: 'Fast Feed',      help: 'Feed rate (mm/min) for the initial fast approach to the wall, before the touch.', section: 'TOOL & CUT', match: { type: 'assign', var: '#3' }, key: 'value' },
    { param: 'f_slow',  type: 'number', tokenEligible: true, default: EDGE_DEFAULTS.f_slow,  label: 'Slow Feed',      help: 'Feed rate (mm/min) for the precise second touch — slower gives a more accurate trigger point.', section: 'TOOL & CUT', match: { type: 'assign', var: '#4' }, key: 'value' },
    { param: 'port',    type: 'number', tokenEligible: true, default: EDGE_DEFAULTS.port,    label: 'Port',           help: 'The controller input port the probe signal is wired to (the G31 P word).', section: 'TOOL & CUT', match: { type: 'assign', var: '#5' }, key: 'value',
        gate: { param: '_probePortOk', is: false, tip: 'This controller\'s own probe move has no port number to set — V4.1 selects it in firmware (a fixed L#682), DM500 probes via move-until-input (no G31 at all). The field is inert here.' } },
    { param: 'radius',  type: 'number', tokenEligible: true, default: EDGE_DEFAULTS.radius,  label: 'Stylus Radius',  help: 'The probe stylus tip radius (mm) — applied to the wall touch to give the true wall coordinate.', section: 'TOOL & CUT', match: { type: 'assign', var: '#6' }, key: 'value' },
];

/** The STRUCTURAL toggle bindings — params that drive the guard prune (NO value socket → no blockIndex/match). axis×dir
 *  reshapes the confirm+probe region (per-combo vars/sign); axis×wcs the WCS write; wcs the base address.
 *  t1756 — none of the three are token-eligible or deferrable: each is a CATEGORICAL branch-selector (picks which
 *  guarded arm of edgeStack's superset survives prune, or which G-code the base-address block resolves to), the
 *  identical shape corner's own axis/dir/wcs analogues (`corner`/`probeSeq`/`wcs`) were already found to be. */
export const EDGE_STRUCT_BINDINGS = [
    { param: 'axis', type: 'enum', tokenRefusal: 'Which axis the wall faces picks a different guarded fork of the program (its own confirm+probe region, per-combo sign) — not a value inside one; it can\'t be resolved until the program is already built.', default: EDGE_DEFAULTS.axis, label: 'Axis', help: 'Which axis the wall faces — X (a wall you approach along X) or Y.', section: 'IDENTITY', widgetConfig: { options: [['X', 'X'], ['Y', 'Y']] } },
    { param: 'dir', type: 'enum', tokenRefusal: 'Which way the stylus travels to reach the wall picks a different guarded fork (per-combo vars/sign) — not a value inside one; it can\'t be resolved until the program is already built.', default: EDGE_DEFAULTS.dir, label: 'Direction', help: 'Which way the stylus travels to reach the wall — Positive (toward +axis) or Negative.', section: 'IDENTITY', widgetConfig: { options: [['Positive', 'pos'], ['Negative', 'neg']] } },
    { param: 'wcs', type: 'enum', tokenRefusal: 'Selects which work-coordinate register the found edge is written to — this changes which G-code gets built, not a number inside it.', default: EDGE_DEFAULTS.wcs, label: 'WCS', help: 'Which work-coordinate register to store the found edge into — Active uses the currently-selected WCS; G54..G59 write that specific register.', section: 'GEOMETRY', widgetConfig: { options: [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']] } },
];

export const EDGE_DATA_OPTYPE = 'user_edge_data';

/** E2 — the edge SIM-START: ONE 'edge'-anchor pass (mirror corner's declaration; edge datum = a LINE / one wall → ONE anchor
 *  pass, vs corner's multi-pass POINT). The declared 'edge' anchor CENTRES the perpendicular axis + parks ±outset off the
 *  probed wall at wall height (plane:'probe') — byte-faithful to the built-in EdgeWizard.inferStart. Sim-only (emits nothing).
 *  The anchor's axis/side are static in the row (like corner's frac default); the provider re-points them to the LIVE axis/dir
 *  (the same per-param adjust corner's provider does for a non-FL corner). side 'pos'→−outset / 'neg'→far+outset = inferStart. */
export const EDGE_SIM_STARTS = [{ id: 'edge', anchor: 'edge', axis: 'X', side: 'pos', out: '@outset', plane: 'probe' }];
export function edgeSimStartsProvider(params, stock) {
    const p = params || {};
    const axis = p.axis === 'Y' ? 'Y' : 'X';
    const side = p.dir === 'neg' ? 'neg' : 'pos';
    return makeProvider(EDGE_SIM_STARTS.map((r) => ({ ...r, axis, side })))(p, stock);
}

/** The wrapped `user_root` template for a param set. The superset (edgeStack {superset:true}) carries every axis/dir/wcs
 *  arm guarded; instantiate() prunes to the concrete shape. Byte-transparent wrap (user_root emits its children in order). */
export function edgeDataStack(params = EDGE_DEFAULTS) {
    const exec = edgeStack(params, { superset: true });
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            // t2301 (BACKLOG 20) — 'panel' removed: inert + id-collided with sim's own layout2d pane (see
            // drillData.js's own t2301 comment for the full mechanism, first fixed for ATC at t2257).
            { type: 'sim', params: { rotary: false, machine: false, magazine: false, probeWcs: true } },   // t714 — edge is a PART-frame probe (no forceMachine); machine:true was latent-dead (see cornerData/opSimContext)
            { type: 'param_group', params: { group: 'Edge' }, children: [] },
        ],
        children: exec,
    }];
}

/** Bindings for the value sockets — DERIVED (not hand-counted) over a CANONICAL-pruned stack (X / pos / active → exactly 1×
 *  each socket). EMIT re-derives BY IDENTITY over the actual PRUNED stack each build (via def.bindingSpecs).
 *  ⚠ KEPT ALIVE (t2599): `tests/edge-data-emit.spec.js` imports `EDGE_BINDINGS` directly for its own "every scalar
 *  binding derived a blockIndex" wiring check — a real external consumer, unlike rotary_clock's own now-orphaned
 *  equivalent (removed at t2599). `edgeDataDef()` below no longer USES this constant for its own actual bindings
 *  (re-derived fresh against the tree-shaped stack instead, per the bore/t2595 stale-bindings finding) but the
 *  export itself stays, computed exactly as before, so that external test keeps working unmodified. */
const CANONICAL_BIND = { ...EDGE_DEFAULTS, axis: 'X', dir: 'pos', wcs: 'active' };
function canonicalPrunedStack() { const c = JSON.parse(JSON.stringify(edgeDataStack(EDGE_DEFAULTS))); pruneGuards(c, CANONICAL_BIND); return c; }
export const EDGE_BINDINGS = deriveBindingsFor(canonicalPrunedStack(), EDGE_BINDING_SPECS);

// t2599 (BACKLOG #71/#72, Phase 1 step 1) — mirrors rotaryClockFieldGroups'/alignmentFieldGroups' own header: the
// ordered/grouped field lists this def's own uiChildren tree AND its flat bindings array both need, computed
// ONCE, called TWICE (bootstrap stack for tree order, final stack for the bindings actually shipped). Unlike
// alignment/rotaryClock (2 sections), edge has THREE declared sections (TOOL & CUT, IDENTITY, GEOMETRY) — the
// pre-t2599 flat array order was TOOL & CUT (6 value bindings) then IDENTITY (axis, dir) then GEOMETRY (wcs), so
// the tree below declares three group_box nodes in that same order, not the usual identity-first convention —
// faithful reproduction of the existing flat render, not a fresh opinion on section order.
function prunedFrom(stack) { const c = JSON.parse(JSON.stringify(stack)); pruneGuards(c, CANONICAL_BIND); return c; }
function edgeFieldGroups(stack) {
    const derived = deriveBindingsFor(prunedFrom(stack), EDGE_BINDING_SPECS);   // all 6 are TOOL & CUT
    return {
        TOOL_CUT: derived,
        IDENTITY: EDGE_STRUCT_BINDINGS.filter((b) => b.section === 'IDENTITY'),
        GEOMETRY: EDGE_STRUCT_BINDINGS.filter((b) => b.section === 'GEOMETRY'),
    };
}

// SOURCE-CHIPS — when the user opts a probe field to 'ctrl' (a profile with a native register, e.g. Expert), emit the
// CONTROLLER register instead of the literal — EXACT parity with the built-in edge's srcVal/srcNote. Applied POST-emit
// (the template is fixed at def-creation). STUDIO-sourced (the default) or a non-native profile → byte-IDENTICAL.
const PROBE_SRC_VARS = { port: '#5', fastFeed: '#3', retract: '#2' };
function applyProbeSources(stack) {
    const resolve = (typeof window !== 'undefined' && window.ddcsResolveProbeSources) ? window.ddcsResolveProbeSources : null;
    const sources = resolve ? resolve(['port', 'fastFeed', 'retract']) : {};
    if (!sources || !Object.keys(sources).length) return stack;
    // t2339 — childrenOf (not a bare for-of): `blocks` can be the mouth-keyed object a split_horizontal/
    // split_vertical node's own `.children` takes, not just a plain array (t2337's roundtrip-1319 finding).
    const walk = (blocks) => { for (const b of childrenOf(blocks)) { if (b && b.type === 'assign' && b.params) { for (const f in PROBE_SRC_VARS) { if (b.params.var === PROBE_SRC_VARS[f] && sources[f]) { b.params.value = String(srcVal(sources[f], b.params.value)); b.params.note = srcNote(sources[f], b.params.note); } } } if (b) { walk(b.children); walk(b.uiChildren); } } };
    walk(stack);
    return stack;
}

/** Build the edge-as-data def — same userOpFromStack pattern as corner/drill/slot, PLUS `bindingSpecs` (instantiate
 *  re-derives the value sockets by identity over the pruned superset) + the structural axis/dir/wcs toggles. */
export function edgeDataDef() {
    // t2599 (Phase 1 step 1) — a bootstrap stack (same `children`, no tree yet) just to read the ordered/grouped
    // param names edgeFieldGroups derives; re-derived again below against the real, final stack.
    const bootstrapStack = [{ type: 'user_root', params: {}, uiChildren: [], children: edgeStack(EDGE_DEFAULTS, { superset: true }) }];
    const g0 = edgeFieldGroups(bootstrapStack);
    const fieldRefsOf = (group) => group.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            // t2599 (Phase 1 step 1) — wrapped in split_horizontal so hasTreeLayout() (userOpView.js) routes this
            // twin onto renderUiTree, the SAME mechanism drill/surfacing/bore/rotaryClock/alignment already use.
            // Edge has NO classic shell (`wiz_edge` — RETIRED at t1730, index.html:347) — so, like those, there
            // is no shell usage_text to reproduce verbatim; adapted from this file's own header description.
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'Edge' },
                    children: [
                        { type: 'usage_text', params: { text: 'Probes one wall (a LINE datum, one axis) and writes the found position to a work-coordinate register — a strict subset of Corner (no safe-traverse/reposition/fan-out). Set which axis the wall faces, which way the stylus approaches, and which WCS receives the result.' } },
                        { type: 'group_box', params: { title: 'TOOL & CUT' }, children: fieldRefsOf(g0.TOOL_CUT) },
                        { type: 'group_box', params: { title: 'IDENTITY' }, children: fieldRefsOf(g0.IDENTITY) },
                        { type: 'group_box', params: { title: 'GEOMETRY' }, children: fieldRefsOf(g0.GEOMETRY) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                // t2599 (Phase 1 step 2) — preview3d + feature_canvas as ADJACENT RIGHT-pane siblings, the SAME
                // adjacency-merge shape drill/surfacing/bore/rotaryClock/alignment already ship (t2511) —
                // byte-identical DOM to the old combined `sim` node per t2511's own proof. Params unchanged.
                RIGHT: [
                    { type: 'preview3d', params: { rotary: false, machine: false, magazine: false, probeWcs: true } },
                    { type: 'feature_canvas', params: { panel: 'form3d+2d' } },
                ],
            },
        }],
        children: edgeStack(EDGE_DEFAULTS, { superset: true }),
    }];
    // t2599 — re-derived over the FINAL, real stack (the same computation g0 already used), so the flat binding
    // array below and the declared tree can never disagree — mirrors boreFieldGroups' own two-call pattern.
    const gFinal = edgeFieldGroups(stack);
    const SRC_BY_PARAM = { port: 'port', f_fast: 'fastFeed', retract: 'retract' };
    const toolCut = gFinal.TOOL_CUT.map((b) => (SRC_BY_PARAM[b.param] ? { ...b, sourceField: SRC_BY_PARAM[b.param] } : b));
    const bindings = [...toolCut, ...gFinal.IDENTITY, ...gFinal.GEOMETRY];
    // t339 E4 — NO '*_datawiz' group: the edge twin is opened IN-PLACE from the built-in Edge's Probe slot (opensAs), and its
    // own menu entry is hidden (wizardLibrary drops opensAs targets), so it never lands in a separate Data Wiz dropdown.
    const def = userOpFromStack('edge_data', 'Edge (data)', stack, bindings, 'form3d+2d', { forceMachine: true });
    def.bindingSpecs = EDGE_BINDING_SPECS;   // re-derive value-socket indices BY IDENTITY over the PRUNED stack every build
    def.postInstantiate = applyProbeSources;   // source-chips (byte-identical when studio-sourced)
    def.simStartsProvider = edgeSimStartsProvider;   // E2 — the ONE edge-anchor preview marker (sim-only; re-points to the live axis/dir)
    return def;
}
