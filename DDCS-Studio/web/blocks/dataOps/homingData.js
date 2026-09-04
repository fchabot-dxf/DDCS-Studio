/**
 * blocks/dataOps/homingData.js — the HOMING built-in as a pure DATA definition (E1, t548; on the E0 superset 9205ce2).
 *
 * Homing is a DYNAMIC-SHAPE, SETTINGS-HEAVY op: the run-form picks WHICH axes home + in what ORDER (default Z,X,Y — NOT
 * canonical, user-reorderable in Homing Setup); the per-axis SEEK is derived from settings.machine (span → seek distance) +
 * settings.limits (the declared <edge>Home → direction), and an UNSET span turns the whole arm into a SKIP comment
 * (structure-changing). So the twin can't be a static value-swap: it UNROLLS the ordered arms at instantiation, RECOMPOSED
 * from the CURRENT settings (never a frozen snapshot — the ATC live-settings lesson), via the ONE shared per-axis builder.
 *
 *   • the E0 superset (homingStack{superset:true}) carries every axis GUARDED by its _run<AX> tick — the per-axis-canonical
 *     TEMPLATE (drives the Blocks structure + the E0 prune gate + the schema).
 *   • deriveGuards injects the _run ticks from the op's `axes` so prune collapses the template to the selection.
 *   • postInstantiate UNROLLS: rebuild the emit in the op's run-ORDER, reading CURRENT settings — via homingStack, the ONE
 *     source (header + ordered arms + tail). Byte-identical to homingStack; the emit tracks live machine/limits changes.
 *
 * NOT registered/opened in-place yet (E2). The per-axis config (feeds/backoff/slave) lives in settings.homing.axes (Homing
 * Setup), read at emit — the op stores only the axis SELECTION + order (`axes`) + the soft-limit re-enable flag.
 */
import { homingStack, homingUnsetAxes } from '../../wizards/stacks/homingWizard.js';
import { userOpFromStack } from '../userOps.js';

const ALL_AXES = ['x', 'y', 'z', 'a', 'b'];
const AX_IDX = { x: 0, y: 1, z: 2, a: 3, b: 4 };
const AX_LABEL = { x: 'X', y: 'Y', z: 'Z', a: 'A', b: 'B' };

/** The E0 superset template is built with a DEFAULT machine (real spans) so every arm is a real seek to VALUE-SWAP; the twin
 *  op stores only the axis selection, so this is a template constant (never a frozen user snapshot — recomposed from settings). */
const TEMPLATE_MACHINE = { x: 300, y: 300, z: -120 };

/** Author defaults — mirror the run-form (the twin-default rule): home Z/X/Y (the safe fndzero order comes from settings) +
 *  soft-limit re-enable ON. The RUN-FORM is per-axis boolean ticks (run_<ax>); the ORDER + per-axis config live in settings. */
export const HOMING_DEFAULTS = { run_z: true, run_x: true, run_y: true, run_a: false, run_b: false, softLimits: true, machine: TEMPLATE_MACHINE };

export const HOMING_DATA_OPTYPE = 'user_homing_data';

/** The op params (the run-form): a per-axis RUN TICK (boolean checkbox) + the soft-limit re-enable flag. The execution ORDER
 *  + per-axis feeds/back-off/declared-home come from settings (Homing Setup) — read at emit, so the twin tracks live config. */
// t1704 — Homing has ZERO token-eligible params, and it's a DIFFERENT kind of "no" than corner's structural
// toggles: it's not just that these 6 booleans pick a branch — it's that NO NUMBER a token could ever replace
// lives on this op's params at all. The real numbers (seek feeds, back-off, declared home switch) live in global
// settings.homing, read live at emit (homeAxisBlocks) — never bound to the op. Each tick here gates whether that
// axis's entire multi-atom, multi-line sequence is emitted at all (homingWizard.js's per-axis homeAxisBlocks
// calls) — the canonical "a controller can't dynamically change how many G-code lines exist" case.
export const HOMING_STRUCT_BINDINGS = [
    { param: 'run_z', type: 'bool', tokenRefusal: 'Turns the whole Z homing sequence on or off — changes how many lines the program contains, not a value inside one.', default: HOMING_DEFAULTS.run_z, label: 'Home Z', help: 'Home the Z axis this run.', section: 'GEOMETRY' },
    { param: 'run_x', type: 'bool', tokenRefusal: 'Turns the whole X homing sequence on or off — changes how many lines the program contains.', default: HOMING_DEFAULTS.run_x, label: 'Home X', help: 'Home the X axis this run.', section: 'GEOMETRY' },
    { param: 'run_y', type: 'bool', tokenRefusal: 'Turns the whole Y homing sequence on or off — changes how many lines the program contains.', default: HOMING_DEFAULTS.run_y, label: 'Home Y', help: 'Home the Y axis this run.', section: 'GEOMETRY' },
    { param: 'run_a', type: 'bool', tokenRefusal: 'Turns the whole A homing sequence on or off — changes how many lines the program contains.', default: HOMING_DEFAULTS.run_a, label: 'Home A', help: 'Home the A (rotary) axis — set current position as home (no seek).', section: 'GEOMETRY' },
    { param: 'run_b', type: 'bool', tokenRefusal: 'Turns the whole B homing sequence on or off — changes how many lines the program contains.', default: HOMING_DEFAULTS.run_b, label: 'Home B', help: 'Home the B (rotary) axis — set current position as home (no seek).', section: 'GEOMETRY' },
    { param: 'softLimits', type: 'bool', tokenRefusal: 'Turns the soft-limit re-enable step on or off — adds or removes lines from the program.', default: HOMING_DEFAULTS.softLimits, label: 'Re-enable soft limits', help: 'Re-enable #655 (soft limits) after homing.', section: 'GEOMETRY' },
    // t554 — the 'Homing Setup…' button (an `action` widget; contributes no param) opens the setup modal (order + per-axis config).
    { param: '_setup', type: 'bool', widget: 'action', action: 'homingSetup', default: false, label: 'Homing Setup…', help: 'Open Homing Setup: the per-axis order, feeds, back-off + the declared home switch.', section: 'GEOMETRY' },
];

// t2601 (BACKLOG #71/#72, Phase 1 step 1) — `homingDataStack()` (the old flat-render `user_root` wrapper: uiChildren
// [sim, param_group], children: homingStack(params,{superset:true})) is REMOVED here — `homingDataDef()` below now
// builds its own tree-shaped stack inline, and grepping the whole repo found no other caller (product code or
// test) invoking this function by name; WORK-LOG's own t1838/t1842/t1844 entries reference it historically by
// name but that is documentation of a past state, not a live dependency. The SHAPE those entries call
// "LOAD-BEARING" — `children` built via `homingStack(params,{superset:true})`, carrying the internal id-less
// `{type:'op',opType:'homing'}` fragment `applyHomingRecompose`/`findOpInStack`'s own `user_root` opacity
// boundary (t1958/t1964) depend on — is UNCHANGED: `homingDataDef()`'s own new `stack` still builds `children`
// via the exact same `homingStack(HOMING_DEFAULTS, { superset: true })` expression, only `uiChildren` differs.

/** The ORDERED axis selection from params — an explicit `axes` list (tests/round-trip) OR the run-ticks sorted by the
 *  settings home ORDER (the run-form path). Order-independent for the guards; ordered for the emit unroll. */
function axesOf(p, config) {
    if (Array.isArray(p.axes)) return p.axes.filter((a) => AX_IDX[a] != null);
    const cfg = config || {};
    return ALL_AXES.filter((ax) => !!p['run_' + ax]).sort((a, b) => (Number((cfg[a] || {}).order) || 9) - (Number((cfg[b] || {}).order) || 9));
}

/** The DERIVED guard keys — the _run<AX> ticks from the op's selection (list OR run-ticks), so pruneGuards collapses the
 *  template to the selection. Order-INDEPENDENT (the guards only gate presence; the emit unroll handles the run-order). */
export function homingDeriveGuards(p) {
    const sel = Array.isArray(p.axes) ? p.axes : ALL_AXES.filter((a) => !!p['run_' + a]);
    const o = {};
    for (const a of ALL_AXES) o['_run' + a.toUpperCase()] = sel.includes(a);
    return o;
}

/** CURRENT settings the emit reads (config/machine/limits) — LIVE, never a frozen snapshot (the ATC live-settings lesson). */
function currentSettings() {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings) ? window.ddcsGetSettings() : {};
    return { config: ((s.homing || {}).axes) || {}, machine: s.machine || {}, limits: s.limits || {} };
}

/** The mid-envelope machine-frame START anchor (t540) — the draggable Start the homing sim runs FROM. From settings.machine
 *  (never emitted). The in-place preview passes this as the start; the panel seeds it as the engine initialPos (machineFrameTool). */
export function homingMidStart() {
    const m = currentSettings().machine || {};
    return { x: (Number(m.x) || 0) / 2, y: (Number(m.y) || 0) / 2, z: (Number(m.z) || 0) / 2 };
}

/**
 * THE M2 EMIT RECOMPOSE — FULL RECOMPOSE (t1898, REPLACING the t550 stored-stack arm-preserving unroll). t1896's
 * census found `homingWizard.js` carries an EXPLICIT, deliberate refusal for non-Expert dialects (`:168-173`,
 * "we do NOT emit a guessed homing sequence for V4.1/DM500") that the OLD recompose silently defeated: its own
 * `shapeStable` check (`fRoles.every(...)` on an EMPTY array) was VACUOUSLY TRUE whenever the live dialect's
 * `fresh` build had no per-axis arms at all (the non-Expert refusal path returns a BARE array, no `op` wrapper —
 * `homingWizard.js:172`'s `return S;`, never reaching the `[{type:'op',...}]` wrap at `:200`) — so a template
 * frozen under Expert kept walking its OWN stored Expert arms through unchanged, confirmed LIVE (WORK-LOG t1896)
 * to emit Expert's verbatim seek sequence under V4.1, zero refusal text. FIXED the same way t1894 fixed
 * atc_length/atc_check: `root.children` is rebuilt from `homingStack(...)` fresh on every instantiation — the
 * SAME function every other emit path uses — so the twin is byte-identical BY CONSTRUCTION, on every dialect,
 * always. This SUPERSEDES the t550 ruling: a Blocks-tab edit to an individual homing arm (e.g. an inserted
 * comment) no longer survives a settings/dialect recompose — the SAME per-arm "preserve an edit, value-swap the
 * rest" machinery that made that possible is exactly what let the refusal go silently unheeded. Named trade-off,
 * not an oversight — see WORK-LOG t1898 for the reasoning and `homing-data-emit.spec.js`'s own updated E2 test.
 */
function applyHomingRecompose(stack, resolved) {
    const st = currentSettings();
    const order = axesOf(resolved, st.config);
    const root = (Array.isArray(stack) ? stack : []).find((b) => b && b.type === 'user_root');
    if (!root) return stack;
    root.children = homingStack({ axes: order, config: st.config, machine: st.machine, limits: st.limits, softLimits: resolved.softLimits !== false }, {});
    return stack;
}

/** Build the homing-as-data def — the E0 superset template + deriveGuards (the _run ticks) + the unroll/recompose in
 *  postInstantiate. Byte-identical to homingStack across the axis-selection × run-ORDER × settings sweep. NO opensAs yet (E2). */
export function homingDataDef() {
    // t2601 (BACKLOG #71/#72, Phase 1 step 1) — no value bindings at all (every param is a plain bool toggle, no
    // blockIndex/match to derive), so there is no bootstrap/final two-phase derive needed here — the SIMPLEST
    // migration in this arc. ONE group_box (GEOMETRY, the only section HOMING_STRUCT_BINDINGS declares).
    const fieldRefsOf = (group) => group.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            // t2601 (Phase 1 step 1) — wrapped in split_horizontal so hasTreeLayout() (userOpView.js) routes this
            // twin onto renderUiTree, the SAME mechanism drill/surfacing/bore/rotaryClock/alignment/edge/middle/
            // rotaryCenter already use. Homing has NO classic shell (`wiz_homing` — RETIRED at t1730,
            // index.html:1263) — so, like those, there is no shell usage_text to reproduce verbatim; adapted
            // from this file's own header description.
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'Homing' },
                    children: [
                        { type: 'usage_text', params: { text: 'Homes the selected axes and (optionally) re-enables soft limits afterward. The run order and per-axis feeds/back-off/declared-home switch live in Homing Setup, not here — this op stores only which axes run this pass.' } },
                        { type: 'group_box', params: { title: 'GEOMETRY' }, children: fieldRefsOf(HOMING_STRUCT_BINDINGS) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                // t2601 (Phase 1 step 2) — preview3d + feature_canvas as ADJACENT RIGHT-pane siblings, the SAME
                // adjacency-merge shape drill/surfacing/bore/rotaryClock/alignment/edge/middle/rotaryCenter
                // already ship (t2511) — byte-identical DOM to the old combined `sim` node per t2511's own
                // proof. Params unchanged (toolMachine — the live tool renders in RAW machine coords).
                RIGHT: [
                    { type: 'preview3d', params: { rotary: false, magazine: false, toolMachine: true } },
                    { type: 'feature_canvas', params: { panel: 'form3d+2d' } },
                ],
            },
        }],
        children: homingStack(HOMING_DEFAULTS, { superset: true }),
    }];
    const def = userOpFromStack('homing_data', 'Homing (data)', stack, [...HOMING_STRUCT_BINDINGS], 'form3d+2d', { forceMachine: true }, 'setup_datawiz');
    def.deriveGuards = homingDeriveGuards;
    def.postInstantiate = (stack, resolved) => applyHomingRecompose(stack, resolved);
    // t552 — the draggable machine-frame START anchor (mid-envelope): the in-place preview passes starts[0] as the start,
    // seeded as the engine initialPos (machineFrameTool), so the homing sim runs FROM it (t540). Sim-only, never emitted.
    def.simStartsProvider = () => [homingMidStart()];
    // t554 — the in-place unset-travel HINT (the t540 behaviour): a run-axis whose machine envelope travel is unset is SKIPPED;
    // surface it in the panel status. Read live from settings (config/machine) via the ordered selection.
    def.statusHint = (params) => {
        const st = currentSettings();
        const unset = homingUnsetAxes({ axes: axesOf(params || {}, st.config), machine: st.machine, config: st.config });
        return unset.length ? `  ⚠ Set ${unset.join(' / ')} travel in Machine settings — ${unset.length > 1 ? 'those axes are' : 'that axis is'} skipped (no envelope).` : '';
    };
    return def;
}
