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
import { homingStack } from '../../wizards/homingWizard.js';
import { userOpFromStack } from '../userOps.js';

const ALL_AXES = ['x', 'y', 'z', 'a', 'b'];
const AX_IDX = { x: 0, y: 1, z: 2, a: 3, b: 4 };

/** Author defaults — mirror the run-form (the twin-default rule): the safe Z,X,Y home order + soft-limit re-enable ON. */
export const HOMING_DEFAULTS = { axes: ['z', 'x', 'y'], softLimits: true };

export const HOMING_DATA_OPTYPE = 'user_homing_data';

/** The op params (the run-form): the ORDERED axis selection + the soft-limit re-enable flag. Per-axis config = settings. */
export const HOMING_STRUCT_BINDINGS = [
    { param: 'axes', type: 'list', default: HOMING_DEFAULTS.axes, label: 'Axes', help: 'Which axes to home this run, in execution order (reorder in Homing Setup). The per-axis feeds/back-off + declared home switch come from Homing Setup / the machine config.', section: 'GEOMETRY' },
    { param: 'softLimits', type: 'bool', default: HOMING_DEFAULTS.softLimits, label: 'Re-enable soft limits', help: 'Re-enable #655 (soft limits) after homing.', section: 'GEOMETRY' },
];

/** The wrapped user_root template — the E0 superset (all axes guarded), machine-frame sim (homing is G53). */
export function homingDataStack(params = HOMING_DEFAULTS) {
    const exec = homingStack(params, { superset: true });
    return [{
        type: 'user_root', params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'sim', params: { rotary: false, machine: true, magazine: false } },
            { type: 'param_group', params: { group: 'Homing' }, children: [] },
        ],
        children: exec,
    }];
}

/** The DERIVED guard keys — the _run<AX> ticks from the op's ordered `axes`, so pruneGuards collapses the template to the selection. */
export function homingDeriveGuards(p) {
    const axes = Array.isArray(p.axes) ? p.axes : [];
    const o = {};
    for (const a of ALL_AXES) o['_run' + a.toUpperCase()] = axes.includes(a);
    return o;
}

/** CURRENT settings the emit reads (config/machine/limits) — LIVE, never a frozen snapshot (the ATC live-settings lesson). */
function currentSettings() {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings) ? window.ddcsGetSettings() : {};
    return { config: ((s.homing || {}).axes) || {}, machine: s.machine || {}, limits: s.limits || {} };
}

/** UNROLL + SETTINGS-RECOMPOSE: rebuild the emit in the op's run-ORDER, reading the CURRENT machine/limits, via the ONE shared
 *  builder (homingStack). The unset-span SKIP is structure-changing, so this is a rebuild — not a static value-swap. Byte-
 *  identical to homingStack; the header/tail/arms + order all come from the one source, so the twin can't diverge. */
function applyHomingUnroll(stack, resolved) {
    const axes = (Array.isArray(resolved.axes) ? resolved.axes : []).filter((a) => AX_IDX[a] != null);
    const st = currentSettings();
    return homingStack({ axes, config: st.config, machine: st.machine, limits: st.limits, softLimits: resolved.softLimits !== false }, {});
}

/** Build the homing-as-data def — the E0 superset template + deriveGuards (the _run ticks) + the unroll/recompose in
 *  postInstantiate. Byte-identical to homingStack across the axis-selection × run-ORDER × settings sweep. NO opensAs yet (E2). */
export function homingDataDef() {
    const def = userOpFromStack('homing_data', 'Homing (data)', homingDataStack(HOMING_DEFAULTS), [...HOMING_STRUCT_BINDINGS], 'form3d+2d', { forceMachine: true }, 'setup_datawiz');
    def.deriveGuards = homingDeriveGuards;
    def.postInstantiate = (stack, resolved) => applyHomingUnroll(stack, resolved);
    return def;
}
