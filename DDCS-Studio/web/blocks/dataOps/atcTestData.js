/**
 * blocks/dataOps/atcTestData.js — the ATC COMMISSIONING TEST built-in as a pure DATA definition (E1, t558; on the E0
 * superset 826f23f).
 *
 * atc_test is a MODE-FORKED, SETTINGS-HEAVY op: the form picks the MODE (drawbar cycle | pocket dry-run); the POCKETS arm
 * UNROLLS one visit-arm per taught magazine pocket (settings.atc.magazine, sliced by first/count), and the DRAWBAR arm is a
 * counted GOTO loop whose release/lock/sensor M-codes are the DECLARED ATC I/O (Settings → ATC I/O). So the twin can't be a
 * static value-swap — like homing it UNROLLS the mode arm at instantiation, RECOMPOSED from the CURRENT settings (never a
 * frozen snapshot — the ATC live-settings lesson), via the ONE shared builder (atcTestStack).
 *
 *   • the E0 superset (atcTestStack{superset:true}) carries BOTH mode arms GUARDED by `mode` — the re-authorable TEMPLATE
 *     (drives the Blocks structure + the E0 prune gate + the schema).
 *   • deriveGuards injects the EFFECTIVE `mode` so pruneGuards collapses the template to the chosen arm.
 *   • postInstantiate UNROLLS/RECOMPOSES the arm from the CURRENT settings via atcTestStack (the ONE source) — the M2 in-place
 *     transform (t550 ruling): value-swap each arm's settings/param-derived lines by ROLE, KEEP the user's edits. A pocket
 *     ADDED/REMOVED (or the descend toggle) → that arm is taken WHOLESALE from the fresh (the documented structure gap, like
 *     homing's unset-span skip). No-edit → byte-identical to atcTestStack.
 *
 * NOT registered/opened in-place yet (E2). The magazine (pocket XYZ + tool#) + the drawbar/sensor M-codes live in settings
 * (Tool table + ATC I/O), read at emit — the op stores only the FORM (mode + cycles/dwell + first/count/zClear/descend).
 */
import { atcTestStack, atcTestEffectiveMode } from '../../wizards/stacks/atcTestWizard.js';
import { userOpFromStack } from '../userOps.js';

export const ATC_TEST_DATA_OPTYPE = 'user_atc_test_data';

/** Author defaults — MIRROR the run-form fields (the twin-default rule): the atc_test panel's own default values (drawbar,
 *  10 cycles, 500 ms, first 1, 8 pockets, Z-clear 0, no descend). NOT the num() fallbacks (count's fallback is mag.length —
 *  the FORM shows 8). The magazine is NOT a form field — it is live settings, read + unrolled at instantiation. */
export const ATC_TEST_DEFAULTS = { mode: 'drawbar', cycles: 10, dwellMs: 500, first: 1, count: 8, zClear: 0, descend: false };

/** A representative TEMPLATE magazine so the E0 superset's pockets arm is a real 2-pocket unroll (the Blocks/schema display).
 *  A template constant — NEVER a frozen user snapshot: postInstantiate recomposes the arm from the LIVE settings.atc.magazine. */
const TEMPLATE_MAGAZINE = [{ tool: 1, x: 100, y: 50, z: -20 }, { tool: 2, x: 150, y: 50, z: -20 }];

/** The op params (the run-form): the MODE selector + the drawbar scalars + the pockets scalars. All FORM fields (no value
 *  socket — the recompose bakes every value from the CURRENT settings via atcTestStack, exactly like homing's seek values). */
export const ATC_TEST_STRUCT_BINDINGS = [
    { param: 'mode', type: 'enum', widget: 'segmented', default: ATC_TEST_DEFAULTS.mode, label: 'Test', help: 'Drawbar cycle test = cycle the release/lock N times + verify the sensors; Pocket dry-run = visit each taught magazine pocket at clearance Z.', section: 'TEST', widgetConfig: { options: [['Drawbar cycle', 'drawbar'], ['Pocket dry-run', 'pockets']] } },
    { param: 'cycles', type: 'number', default: ATC_TEST_DEFAULTS.cycles, label: 'Cycles', help: 'How many release/lock cycles the drawbar test runs.', section: 'DRAWBAR' },
    { param: 'dwellMs', type: 'number', default: ATC_TEST_DEFAULTS.dwellMs, label: 'Dwell (ms)', help: 'Settle time after each release / lock, before the sensor wait.', section: 'DRAWBAR' },
    { param: 'first', type: 'number', default: ATC_TEST_DEFAULTS.first, label: 'First pocket', help: 'The first magazine pocket the dry-run visits.', section: 'POCKETS' },
    { param: 'count', type: 'number', default: ATC_TEST_DEFAULTS.count, label: 'Pockets', help: 'How many pockets (from the first) the dry-run visits.', section: 'POCKETS' },
    { param: 'zClear', type: 'number', default: ATC_TEST_DEFAULTS.zClear, label: 'Z clearance (mach)', help: 'The MACHINE Z the tool retracts to between pockets.', section: 'POCKETS' },
    { param: 'descend', type: 'bool', default: ATC_TEST_DEFAULTS.descend, label: 'Descend to pocket Z', help: 'Also descend to each pocket’s taught Z at the stop (a full-height alignment check), then retract.', section: 'POCKETS' },
];

/** The wrapped `user_root` template — the E0 superset (both mode arms guarded), machine-frame sim (ATC = G53): FORCE the
 *  envelope + render the tool in RAW machine coords (toolMachine, like homing — atc_test is a G53 machine op, not a local
 *  probe) + the ATC magazine tiles (WITH_MAGAZINE). The pockets arm is seeded with a sample magazine so the Blocks view shows
 *  real visit-arms; instantiation recomposes it from the live magazine. */
export function atcTestDataStack(params = ATC_TEST_DEFAULTS) {
    const exec = atcTestStack({ ...params, magazine: (params.magazine || TEMPLATE_MAGAZINE) }, { superset: true });
    return [{
        type: 'user_root', params: {},
        uiChildren: [
            // t2257 (BACKLOG 20) — 'panel' removed (inert + id-collided with sim's own layout2d pane — see
            // atcChangeData.js's own comment for the full reasoning); layout2d: false tells 'sim' to skip
            // building the pane ATC never had content for.
            { type: 'sim', params: { rotary: false, magazine: true, toolMachine: true, layout2d: false } },   // t646 — machine implied by toolMachine (opSimContext: tmf ⟹ forceMachine); no dead machine key

            { type: 'param_group', params: { group: 'ATC Test' }, children: [] },
        ],
        children: exec,
    }];
}

/** The DERIVED guard key — the EFFECTIVE mode, so pruneGuards collapses the superset to the chosen arm (an unset mode →
 *  'drawbar', the concrete default). ONE source with the concrete build (atcTestEffectiveMode). */
export function atcTestDeriveGuards(p) { return { mode: atcTestEffectiveMode(p) }; }

/** CURRENT settings the recompose reads — the LIVE magazine (never a frozen snapshot; the drawbar/sensor codes are read
 *  inside atcTestStack from settings.outputs/inputs). */
function liveMagazine() {
    const s = (typeof window !== 'undefined' && window.ddcsGetSettings) ? (window.ddcsGetSettings() || {}) : {};
    return (s.atc && Array.isArray(s.atc.magazine)) ? s.atc.magazine : [];
}

const POCKET_HEAD = /^Pocket \d+/;   // the per-pocket visit-arm delimiter (the "Pocket N — T#" head comment)

// The settings/param-derived ROLE of a line within its arm (stable across a value change) — used to VALUE-SWAP it from the
// fresh emit while leaving everything else (the user's edits, the constant moves/messages) untouched. null = keep as-is.
function derivedRole(b) {
    if (!b || !b.params) return null;
    if (b.type === 'comment') return POCKET_HEAD.test(b.params.text || '') ? '__PHEAD' : null;   // the pocket head (tool#/number); a plain comment = a user edit → keep
    if (b.type === 'assign') return 'A:' + (b.params.note || b.params.var || '');
    if (b.type === 'mcode') return 'M:' + (b.params.note || b.params.code || '');
    if (b.type === 'confirm') return '__CONFIRM';
    if (b.type === 'dwell') return '__DWELL';
    return null;
}
function swapVal(dst, src) {
    if (!dst || !src || !dst.params || !src.params || dst.type !== src.type) return;
    if (dst.type === 'comment') dst.params.text = src.params.text;
    else if (dst.type === 'assign') dst.params.value = src.params.value;
    else if (dst.type === 'mcode') dst.params.code = src.params.code;
    else if (dst.type === 'confirm') dst.params.msg = src.params.msg;
    else if (dst.type === 'dwell') dst.params.sec = src.params.sec;
}

// Split a mode body into { header, arms[], tail } on the arm HEAD / TAIL delimiters (mode-specific). Positional arms (pocket
// index / the single drawbar loop body) — mirrors homing's partitionArms (keyed by axis there).
function partition(kids, isHead, isTail) {
    let first = kids.findIndex(isHead);
    let tail = kids.findIndex(isTail);
    if (tail < 0) tail = kids.length;
    if (first < 0) first = tail;
    const arms = []; let cur = null;
    for (const b of kids.slice(first, tail)) {
        if (isHead(b)) { cur = []; arms.push(cur); }
        if (cur) cur.push(b);
    }
    return { header: kids.slice(0, first), arms, tail: kids.slice(tail) };
}

// The arm SHAPE (its derived-role multiset, dwell count aside) — a swap is safe only when stored + fresh MATCH; a descend
// toggle / a new pocket changes it → that arm is taken wholesale from the fresh (the documented structure-toggle gap).
function armShape(arm) {
    return arm.map(derivedRole).filter((r) => r && r !== '__DWELL').sort().join('|') + '#' + arm.filter((b) => derivedRole(b) === '__DWELL').length;
}
// Value-swap the stored arm's derived lines from the fresh arm (by role; dwells by occurrence) — the M2 in-place transform:
// the settings/param values TRACK, the user's non-derived edits (comments, extra moves) STAY where they are.
function swapRegion(sArm, fArm) {
    const fByRole = new Map(); const fDwell = [];
    for (const b of fArm) { const r = derivedRole(b); if (r === '__DWELL') fDwell.push(b); else if (r) fByRole.set(r, b); }
    let di = 0;
    for (const b of sArm) {
        const r = derivedRole(b);
        if (r === '__DWELL') { if (fDwell[di]) swapVal(b, fDwell[di]); di++; }
        else if (r && fByRole.has(r)) swapVal(b, fByRole.get(r));
    }
}

/**
 * The M2 EMIT RECOMPOSE (t550 ruling) — operate on the OP'S OWN STORED body, never regenerate arms in a way that discards a
 * Blocks edit. FRESH (the ONE source) supplies the header + tail (rebuilt boilerplate) + the per-arm values; each stored arm
 * is value-swapped IN PLACE (edits survive) and new/toggled arms are taken wholesale. No-edit → byte-identical to atcTestStack.
 */
function recompose(kids, freshBody, isHead, isTail) {
    const sp = partition(kids, isHead, isTail);
    const fp = partition(freshBody, isHead, isTail);
    const newArms = [];
    for (let i = 0; i < fp.arms.length; i++) {
        const fArm = fp.arms[i], sArm = sp.arms[i];
        if (!sArm || armShape(sArm) !== armShape(fArm)) { newArms.push(...fArm); continue; }   // new pocket / descend toggle → fresh wholesale (gap)
        swapRegion(sArm, fArm);
        newArms.push(...sArm);
    }
    return [...fp.header, ...newArms, ...fp.tail];
}

function applyAtcTestRecompose(stack, resolved) {
    const root = (Array.isArray(stack) ? stack : []).find((b) => b && b.type === 'user_root');
    if (!root || !Array.isArray(root.children)) return stack;
    const mode = atcTestEffectiveMode(resolved);
    const freshBody = atcTestStack({ ...resolved, magazine: liveMagazine() }, {});   // the ONE source (live magazine + live ATC-I/O codes)
    const [isHead, isTail] = (mode === 'pockets')
        ? [(b) => b && b.type === 'comment' && POCKET_HEAD.test((b.params && b.params.text) || ''),
           (b) => b && ((b.type === 'comment' && /^Complete\b/.test((b.params && b.params.text) || '')) || (b.type === 'label' && Number(b.params && b.params.n) === 999) || b.type === 'endprogram')]
        : [(b) => b && b.type === 'label' && Number(b.params && b.params.n) === 10,
           (b) => b && b.type === 'ifgoto'];
    root.children = recompose(root.children, freshBody, isHead, isTail);
    return stack;
}

/** Build the atc-test-as-data def — the E0 superset template + deriveGuards (the mode) + the unroll/recompose in
 *  postInstantiate. Byte-identical to atcTestStack across the mode × magazine-size × drawbar-count sweep. NO opensAs yet (E2). */
export function atcTestDataDef() {
    const def = userOpFromStack('atc_test_data', 'ATC Test (data)', atcTestDataStack(ATC_TEST_DEFAULTS), [...ATC_TEST_STRUCT_BINDINGS], 'form3d', { forceMachine: true, showMagazine: true, toolMachineFrame: true }, 'atc_datawiz');
    def.deriveGuards = atcTestDeriveGuards;
    def.postInstantiate = (stack, resolved) => applyAtcTestRecompose(stack, resolved);
    return def;
}
