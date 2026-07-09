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
import { homingStack, homeAxisBlocks } from '../../wizards/homingWizard.js';
import { userOpFromStack, flattenBlocks } from '../userOps.js';

const ALL_AXES = ['x', 'y', 'z', 'a', 'b'];
const AX_IDX = { x: 0, y: 1, z: 2, a: 3, b: 4 };
const AX_LABEL = { x: 'X', y: 'Y', z: 'Z', a: 'A', b: 'B' };
const ARM_HEAD = /^Home ([XYZAB])\b/;   // the per-axis arm delimiter (the "Home <L> — …" head comment)
const AX_FROM_LABEL = { X: 'x', Y: 'y', Z: 'z', A: 'a', B: 'b' };

/** The E0 superset template is built with a DEFAULT machine (real spans) so every arm is a real seek to VALUE-SWAP; the twin
 *  op stores only the axis selection, so this is a template constant (never a frozen user snapshot — recomposed from settings). */
const TEMPLATE_MACHINE = { x: 300, y: 300, z: -120 };

/** Author defaults — mirror the run-form (the twin-default rule): the safe Z,X,Y home order + soft-limit re-enable ON. */
export const HOMING_DEFAULTS = { axes: ['z', 'x', 'y'], softLimits: true, machine: TEMPLATE_MACHINE };

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

// The per-axis arms of a homing op-container's children, keyed by axis, in template order. Splits on the "Home <L>" head.
function partitionArms(kids) {
    let first = kids.findIndex((b) => b && b.type === 'comment' && ARM_HEAD.test((b.params && b.params.text) || ''));
    let tail = kids.findIndex((b) => b && ((b.type === 'comment' && /Re-enable soft limits|HOMING COMPLETE/.test((b.params && b.params.text) || '')) || b.type === 'endprogram'));
    if (tail < 0) tail = kids.length;
    if (first < 0) first = tail;
    const arms = {}; let cur = null;
    for (const b of kids.slice(first, tail)) {
        const m = b && b.type === 'comment' && ARM_HEAD.exec((b.params && b.params.text) || '');
        if (m) { cur = AX_FROM_LABEL[m[1]]; arms[cur] = arms[cur] || []; }
        if (cur) arms[cur].push(b);
    }
    return { header: kids.slice(0, first), arms, tail: kids.slice(tail) };
}
// The settings-independent ROLE of a comment/raw block — its trailing "( … )" note (or __HEAD for the "Home <L> …" comment).
function blockRole(b) {
    if (!b || !b.params || (b.type !== 'raw' && b.type !== 'comment')) return null;
    const t = String(b.params.text || '');
    if (ARM_HEAD.test(t)) return '__HEAD';
    const m = /\(([^()]*)\)\s*$/.exec(t);
    return m ? m[1].trim() : null;
}

/**
 * The M2 EMIT RECOMPOSE (t550 ruling) — operate on the OP'S OWN STORED STACK, never regenerate arms in a way that discards
 * a Blocks edit. UNROLL (reorder the stored arms into the op's run-order) + VALUE-SWAP each arm's SETTINGS-derived lines
 * (seek dist / direction / feeds — matched by their role-note, recomputed from the CURRENT settings via the ONE shared
 * homeAxisBlocks) IN PLACE — so a user's added/edited atom (a comment, a beep) SURVIVES while the seek values track live
 * settings. An arm whose SHAPE changed vs the fresh (an unset span → a SKIP; a newly-ticked axis) is taken WHOLESALE from
 * the fresh (the documented structure-toggle gap, like opEdits' pure-deletion gap). No-edit → byte-identical to homingStack.
 */
function applyHomingRecompose(stack, resolved) {
    const st = currentSettings();
    const order = (Array.isArray(resolved.axes) ? resolved.axes : []).filter((a) => AX_IDX[a] != null);
    const opBlk = flattenBlocks(stack).find((b) => b && b.type === 'op' && b.opType === 'homing');
    if (!opBlk || !Array.isArray(opBlk.children)) return stack;
    // the FRESH emit (the ONE source) → its header + tail (rebuilt, machine-generated) + the per-axis arms for the swap
    const fresh = homingStack({ axes: order, config: st.config, machine: st.machine, limits: st.limits, softLimits: resolved.softLimits !== false }, {});
    const freshOp = flattenBlocks(fresh).find((b) => b && b.type === 'op' && b.opType === 'homing');
    const fp = partitionArms((freshOp && freshOp.children) || []);
    const sp = partitionArms(opBlk.children);
    const newArms = [];
    for (const ax of order) {
        const fArm = fp.arms[ax] || [], sArm = sp.arms[ax];
        const fRoles = fArm.map(blockRole).filter((r) => r != null);
        const freshIsSkip = /SKIPPED/.test(String((fArm[0] && fArm[0].params && fArm[0].params.text) || ''));
        const sRoleSet = sArm ? new Set(sArm.map(blockRole).filter((r) => r != null)) : new Set();
        const shapeStable = sArm && !freshIsSkip && fRoles.every((r) => sRoleSet.has(r));
        if (!shapeStable) { newArms.push(...fArm); continue; }   // structure toggled / new axis → the fresh arm wholesale (gap)
        const fmap = new Map();
        for (const b of fArm) { const r = blockRole(b); if (r != null) fmap.set(r, b.params.text); }
        for (const b of sArm) {   // walk the STORED arm: value-swap a settings-derived line, KEEP everything else (edits)
            const r = blockRole(b);
            if (r != null && fmap.has(r) && b.params) b.params.text = fmap.get(r);
            newArms.push(b);
        }
    }
    opBlk.children = [...fp.header, ...newArms, ...fp.tail];
    return stack;
}

/** Build the homing-as-data def — the E0 superset template + deriveGuards (the _run ticks) + the unroll/recompose in
 *  postInstantiate. Byte-identical to homingStack across the axis-selection × run-ORDER × settings sweep. NO opensAs yet (E2). */
export function homingDataDef() {
    const def = userOpFromStack('homing_data', 'Homing (data)', homingDataStack(HOMING_DEFAULTS), [...HOMING_STRUCT_BINDINGS], 'form3d+2d', { forceMachine: true }, 'setup_datawiz');
    def.deriveGuards = homingDeriveGuards;
    def.postInstantiate = (stack, resolved) => applyHomingRecompose(stack, resolved);
    return def;
}
