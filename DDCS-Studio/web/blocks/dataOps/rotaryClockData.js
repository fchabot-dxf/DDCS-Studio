/**
 * blocks/dataOps/rotaryClockData.js — the ROTARY CLOCK built-in as a pure DATA definition (rotary port phase C, E1).
 *
 * Mirrors rotaryCenterData (t413). rotaryClockStack(params, {superset:true}) (E0, a1f1112) carries the ONE block-shape fork
 * action(set|report|rotate) GUARDED; instantiate/pruneGuards collapses to the concrete shape, then the value bindings
 * re-inject the scalars → byte-identical to the built-in across the structural + scalar sweep.
 *
 * 7 VALUE bindings by #var IDENTITY: #1 dist / #2 retract / #3 f_fast / #4 f_slow / #5 port / #6 SPAN / #17 safeZ. The
 * Clock's #6 is the Y SPAN between the two flat touches (NOT a radius — distinct from the Centreline #6 stylus radius); the
 * flat is FLAT so there is no radius comp. #58 (the A rotation to the reference) is a COMPUTED expr [0-#53-refTerm] off the
 * touches — NOT a knob (like the Centreline computed #11/#12) → left concrete, value-swapped by applyReferenceWcs. 1 STRUCT
 * binding drives the guard: action.
 *
 * THE VALUE-SWAPS (reference / wcs / safeZFrame + the interpolated header + the action-dependent message) are NOT structural
 * → RECOMPOSED from the resolved params in postInstantiate (the rotaryCenterData applyHeaderComments/applyDatumWcs/
 * applySafeZFrame precedent): the summary comments + the final message (action), the A-datum offset formula's refTerm + the
 * WCS arg on the A work-offset writes (reference/wcs), and the final PARK block (safeZFrame). Plus the #2/#3/#5 source-chips.
 *
 * THE A-AXIS ATOMS (novel — the FIRST A-axis emit any twin makes): RM('A'), SWO('A'), MV('A',#58). They are CONCRETE atoms
 * (kept by prune, untouched by the value bindings which only match `assign` #vars), so they pass through BYTE-IDENTICAL — the
 * A-datum value-swaps (refTerm/wcs) are the only A-axis text the recompose touches. NOT seeded / opensAs yet (E4).
 */
import { rotaryClockStack, rotaryClockHeaderComments } from '../../wizards/stacks/rotaryClockWizard.js';
import { userOpFromStack, flattenBlocks } from '../userOps.js';
import { srcVal, srcNote } from '../../wizards/probeBlocks.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { pruneGuards } from '../whenGuard.js';
import { opSimStarts } from '../../viz/opSimStarts.js';   // E2 — reuse BUILT_IN.rotary_clock's single sim-start via the registry, so the twin preview matches the built-in

/** Author defaults — match rotaryClockStack's own num() fallbacks + the structural default shape (set A0 / top / active / relative). */
export const ROTARY_CLOCK_DEFAULTS = {
    action: 'set', reference: 'top', wcs: 'active',
    dist: 30, retract: 2, f_fast: 200, f_slow: 50, port: 3, span: 20, safeZ: 10, level: 0,
    clkAx: '', clkAy: '',   // t530 — SIM-ONLY point-A position (fractions of stock); empty → the centre-straddling default. The emit never uses A's absolute pos (the operator jogs there); B = A + span (#6), and dragging B writes #6.
};

/** The bindable scalars → the `assign` macro var each writes (by identity). #2/#3/#5 are ALSO source-chip vars. #6 is the
 *  Y SPAN between the two flat touches (the Clock's #6 is a span, NOT a radius — a flat cancels any comp). */
// t1756 — MACHINE VARIABLES ROLL OUT, probe family. All 7 are the same magnitude-into-assign shape corner already
// proved eligible.
export const ROTARY_CLOCK_BINDING_SPECS = [
    { param: 'dist',    type: 'number', tokenEligible: true, default: ROTARY_CLOCK_DEFAULTS.dist,    label: 'Max Probe Dist', help: 'How far the stylus travels toward the flat before it gives up.', section: 'TOOL & CUT', match: { type: 'assign', var: '#1' },  key: 'value' },
    { param: 'retract', type: 'number', tokenEligible: true, default: ROTARY_CLOCK_DEFAULTS.retract, label: 'Retract',        help: 'How far the probe backs off after the first touch, before the slow re-approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#2' },  key: 'value' },
    { param: 'f_fast',  type: 'number', tokenEligible: true, default: ROTARY_CLOCK_DEFAULTS.f_fast,  label: 'Fast Feed',      help: 'Feed rate (mm/min) for the initial fast approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#3' },  key: 'value' },
    { param: 'f_slow',  type: 'number', tokenEligible: true, default: ROTARY_CLOCK_DEFAULTS.f_slow,  label: 'Slow Feed',      help: 'Feed rate (mm/min) for the precise second touch.', section: 'TOOL & CUT', match: { type: 'assign', var: '#4' },  key: 'value' },
    { param: 'port',    type: 'number', tokenEligible: true, default: ROTARY_CLOCK_DEFAULTS.port,    label: 'Port',           help: 'The controller input port the probe signal is wired to (the G31 P word).', section: 'TOOL & CUT', match: { type: 'assign', var: '#5' },  key: 'value' },
    { param: 'span',    type: 'number', tokenEligible: true, default: ROTARY_CLOCK_DEFAULTS.span,    label: 'Y Span',         help: 'The Y distance between the two Z-down touches across the flat — the tilt is atan(dZ / span).', section: 'GEOMETRY', match: { type: 'assign', var: '#6' },  key: 'value' },
    { param: 'safeZ',   type: 'number', tokenEligible: true, default: ROTARY_CLOCK_DEFAULTS.safeZ,   label: 'Safe Z',         help: 'The clearance height the probe lifts to between touches / for the final park.', section: 'GEOMETRY', match: { type: 'assign', var: '#17' }, key: 'value' },
];

// t1756 — NOT eligible: a 3-way categorical branch-selector guarding which arm of rotaryClockStack's superset
// survives prune (Set vs Report vs Rotate build genuinely different atom sequences — Rotate SPINS THE PART) —
// the identical shape corner's own axis/order analogues are.
/** STRUCTURAL toggle — drives the guard prune (NO value socket). action(set|report|rotate). */
export const ROTARY_CLOCK_STRUCT_BINDINGS = [
    { param: 'action', type: 'enum', tokenRefusal: 'Set A0 / Report / Rotate build genuinely different atom sequences (Rotate spins the part; Report leaves A untouched) — not a value inside one; it can\'t be resolved until the program is already built.', default: ROTARY_CLOCK_DEFAULTS.action, label: 'Action', help: 'Set A0 (datum without moving the part), Report (measure the tilt only, leave A unchanged), or Rotate (spin the flat to the reference, then zero A there — SPINS THE PART).', section: 'GEOMETRY', widgetConfig: { options: [['Set A0', 'set'], ['Report only', 'report'], ['Rotate to 0', 'rotate']] } },
];

// t1756 — neither is eligible despite carrying no guard: applyReferenceWcs (postInstantiate, below) COMPARES each
// value in JS to pick which literal (refTerm '-90' vs '', wcsArg) gets written into the A work-offset/rotation —
// the identical "categorical choice of WHICH content lands, not a number inside it" shape rotaryCenterData's own
// datum/wcs (and corner's clearMode, t1704) already carry this same reasoning for.
/** VALUE-SWAP form controls — NOT structural (no guard, no #var socket): they drive the postInstantiate RECOMPOSE. */
export const ROTARY_CLOCK_VALUESWAP_BINDINGS = [
    { param: 'reference',  type: 'enum', tokenRefusal: 'Picks which reference-angle term gets folded into the A-datum formula (a different embedded expression, not a number inside one) — it can\'t be resolved until the program is already built.', default: ROTARY_CLOCK_DEFAULTS.reference,  label: 'Reference',    help: 'Which orientation reads A0: the flat facing top (+Z) or the +Y side (3 o clock).', section: 'GEOMETRY', widgetConfig: { options: [['Top (+Z)', 'top'], ['+Y side', 'side']] } },
    { param: 'wcs',        type: 'enum', tokenRefusal: 'Selects which work-coordinate register the A datum is written to — this changes which G-code gets built, not a number inside it.', default: ROTARY_CLOCK_DEFAULTS.wcs,        label: 'WCS',          help: 'Which work-coordinate register to store the A datum into.', section: 'GEOMETRY', widgetConfig: { options: [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']] } },
];

export const ROTARY_CLOCK_DATA_OPTYPE = 'user_rotary_clock_data';

/** The wrapped `user_root` template — the superset (all action arms), byte-transparent wrap (mirror rotaryCenterDataStack).
 *  panel form3d+2d + sim {rotary:true, machine:true} — the Clock is a rotary op → declares the rig (opSimContext ROTARY_RIG). */
export function rotaryClockDataStack(params = ROTARY_CLOCK_DEFAULTS) {
    const exec = rotaryClockStack(params, { superset: true });
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'sim', params: { rotary: true, machine: false, magazine: false, probeWcs: true } },   // t714 — the 4th-axis RIG frames the bar (rotary:true); no forceMachine envelope (machine:true was latent-dead)
            { type: 'param_group', params: { group: 'Rotary Clock' }, children: [] },
        ],
        children: exec,
    }];
}

/** Value bindings DERIVED over a canonical-pruned stack (no optional/when-gated binding — all 7 scalars are LINEAR, present
 *  under any action). EMIT re-derives BY IDENTITY over the actual pruned stack each build (via def.bindingSpecs). */
function canonicalPrunedStack() { const c = JSON.parse(JSON.stringify(rotaryClockDataStack(ROTARY_CLOCK_DEFAULTS))); pruneGuards(c, ROTARY_CLOCK_DEFAULTS); return c; }
export const ROTARY_CLOCK_BINDINGS = deriveBindingsFor(canonicalPrunedStack(), ROTARY_CLOCK_BINDING_SPECS);

// ── postInstantiate — the value-swaps + source-chips, recomposed from the resolved params (E0 superset UNCHANGED) ──

/** RECOMPOSE the interpolated SUMMARY comments (top1/top3 + the set/rotate action-arm comments) AND the final action-dependent
 *  MESSAGE from resolved params — match the frozen DEFAULT text, replace with the resolved. (bindings only touch #N VALUES.) */
function applyHeaderComments(stack, resolved) {
    const d = rotaryClockHeaderComments(ROTARY_CLOCK_DEFAULTS);
    const r = rotaryClockHeaderComments(resolved || {});
    const map = ['top1', 'top3', 'setArm', 'rotateArm', 'msg'].map((k) => [d[k], r[k]]).filter(([a, b]) => a !== b);
    if (!map.length) return stack;
    for (const b of flattenBlocks(stack)) {
        if (!b || !b.params || (b.type !== 'comment' && b.type !== 'message')) continue;   // comment texts + the final message block
        for (const [dt, rt] of map) if (b.params.text === dt) { b.params.text = rt; break; }
    }
    return stack;
}

/** RECOMPOSE the reference + wcs VALUE-swaps on the A work-offset writes: the WCS arg (wcs → #578 / Gnn−53) on every SWO, the
 *  refTerm on the SET-arm A offset formula ([#54-#53±90]), and the refTerm on the ROTATE-arm #58 rotation ([0-#53±90]). */
function applyReferenceWcs(stack, resolved) {
    const p = resolved || {};
    const wcs = p.wcs || 'active';
    const wcsArg = wcs === 'active' ? '#578' : String(parseInt(String(wcs).replace('G', ''), 10) - 53);
    const refTerm = p.reference === 'side' ? '-90' : '';   // matches rotaryClockStack: refAngle 90 → `-90`, else ''
    for (const b of flattenBlocks(stack)) {
        if (!b || !b.params) continue;
        if (b.type === 'setworkoffset') {
            b.params.wcs = wcsArg;                                                                    // wcs value-swap (all A SWO)
            if (b.params.axis === 'A' && /#54-#53/.test(String(b.params.value))) b.params.value = `[#54-#53${refTerm}]`;   // SET-arm A datum: refTerm swap
        } else if (b.type === 'assign' && b.params.var === '#58') {
            b.params.value = `[0-#53${refTerm}]`;                                                     // ROTATE-arm rotation: refTerm swap
        }
    }
    return stack;
}

// SOURCE-CHIPS (corner/atc/centreline precedent): on Expert, rewrite #2 (retract) / #3 (fastFeed) / #5 (port) to the register.
const PROBE_SRC_VARS = { port: '#5', fastFeed: '#3', retract: '#2' };
function applyProbeSources(stack) {
    const resolve = (typeof window !== 'undefined' && window.ddcsResolveProbeSources) ? window.ddcsResolveProbeSources : null;
    const sources = resolve ? resolve(['port', 'fastFeed', 'retract']) : {};
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

/** Build the rotary-clock-as-data def — bindingSpecs (re-derive by #var identity) + the action guard + the value-swap
 *  recompose + source-chips in postInstantiate. Byte-identical to rotaryClockStack on all scalars + the structural sweep + both profiles. */
export function rotaryClockDataDef() {
    const SRC_BY_PARAM = { port: 'port', f_fast: 'fastFeed', retract: 'retract' };
    const valueBindings = ROTARY_CLOCK_BINDINGS.map((b) => (SRC_BY_PARAM[b.param] ? { ...b, sourceField: SRC_BY_PARAM[b.param] } : b));
    const bindings = [...valueBindings, ...ROTARY_CLOCK_STRUCT_BINDINGS, ...ROTARY_CLOCK_VALUESWAP_BINDINGS];
    const def = userOpFromStack('rotary_clock_data', 'Rotary Clock (data)', rotaryClockDataStack(ROTARY_CLOCK_DEFAULTS), bindings, 'form3d+2d', { forceMachine: true }, 'probe_datawiz');
    def.bindingSpecs = ROTARY_CLOCK_BINDING_SPECS;   // re-derive value-socket indices BY IDENTITY over the PRUNED stack every build
    def.postInstantiate = (stack, resolved) => applyProbeSources(applyReferenceWcs(applyHeaderComments(stack, resolved), resolved), resolved);   // t951 park-sweep — applySafeZFrame retired (the built-in now parks via safeRetractNode; no move→machinemove swap)
    // E2 — the SINGLE PREVIEW-START provider: reuse BUILT_IN.rotary_clock (opSimStarts.js) VERBATIM via the sim registry
    // (registerUserOp → setUserSimStarts), NOT the builder → sim-only, emit BYTE-IDENTICAL. ONE start (the clock steps +Y
    // for the 2nd touch, it does not reposition). NO def.simStock: the clock datums off a FLAT on a rectangular BOX (the
    // built-in restoreBoxStock intent) — NOT a round bar like the Centreline — so the global box stock is correct; the rig
    // renders 4-jaw on the box, inherited FREE via the declared sim{rotary:true} + the generic userOpView rig wiring (E5).
    def.simStartsProvider = (params, stock) => opSimStarts('rotary_clock', params, stock);
    // t530 — TWO draggable Layout handles (the human): marker A = the start position (writes clkAx/clkAy — sim-only), marker
    // B = A + span, its Y-drag writes the #6 SPAN (a `relSpanFrom` marker: span = B.y − A.y). ADDITIVE — the #6 field stays
    // the ONE source (drag B OR type #6, both edit it); emit BYTE-IDENTICAL (A's pos never emits; #6 is unchanged as a param).
    def.simStartParams = [{ x: 'clkAx', y: 'clkAy' }, { y: 'span', relSpanFrom: 0 }];
    return def;
}
