/**
 * blocks/dataOps/alignmentData.js — the ALIGNMENT built-in as a pure DATA definition (the LAST probe fan-out port, E1+E2).
 *
 * Mirrors rotaryClockData. alignmentStack(params, {superset:true}) (E0, 9b531e3) carries the checkAxis(X|Y) × probeDir
 * (pos|neg) forks GUARDED (4 arms); instantiate/pruneGuards collapses to the concrete shape, then the value bindings
 * re-inject the scalars → byte-identical to the built-in across the structural + scalar sweep.
 *
 * 6 VALUE bindings by #var IDENTITY: #1 dist / #2 retract / #3 f_fast / #4 f_slow / #5 port / #19 safeZ (bindable via the
 * E0 F2 restructure — #20=[0-#19] tracks it). NO #6 (alignment has no radius/span). 2 STRUCT bindings drive the 4-arm
 * guards: checkAxis + probeDir (the pervasive axis-letter + probe-var swaps — guarded, not recomposed).
 *
 * THE VALUE-SWAPS: safeZFrame (the park block) + the SCALAR/tolerance header comment. F3: tolerance is DISPLAY-ONLY — no
 * #var, it lives only in the header comment → recomposed from the param (NOT bound). The checkAxis/probeDir comments are
 * guard-handled (the surviving arm is already correct), so only the axis/dir-INDEPENDENT scalar line needs recompose. Plus
 * the #2/#3/#5 source-chips (Expert registers). NO wcs (a measurement — no work-offset write). NOT seeded / opensAs yet (E3).
 */
import { alignmentStack, alignmentHeaderComments } from '../../wizards/alignmentWizard.js';
import { userOpFromStack, flattenBlocks } from '../userOps.js';
import { srcVal, srcNote } from '../../wizards/probeBlocks.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { pruneGuards } from '../whenGuard.js';
import { opSimStarts } from '../../viz/opSimStarts.js';   // E2 — reuse the EXISTING BUILT_IN.alignment (2 starts A/B) via the sim registry, so the twin preview matches the built-in
import { getWorkpiece } from '../../engine/workpiece.js';   // t510 Fork 2 — the op instance's stock (outer block) → the AUTO travel coords
import { alignPointsXY, alignEffectiveTravel } from '../../wizards/ops/alignPoints.js';   // t510 — the ONE source of the points + the effective travel mode

/** Author defaults — match alignmentStack's own num() fallbacks + the structural default shape (X fence / pos probe / relative). */
export const ALIGNMENT_DEFAULTS = {
    checkAxis: 'X', probeDir: 'pos', safeZFrame: 'relative', travel: 'auto',
    dist: 20, retract: 2, f_fast: 200, f_slow: 20, port: 0, safeZ: 10, tolerance: 0, level: 0,
};

/** The bindable scalars → the `assign` macro var each writes (by identity). #2/#3/#5 are ALSO source-chip vars. safeZ→#19
 *  is bindable via the E0 F2 restructure (#20=[0-#19] references it, so the ±safeZ pair tracks one source). */
export const ALIGNMENT_BINDING_SPECS = [
    { param: 'dist',    type: 'number', default: ALIGNMENT_DEFAULTS.dist,    label: 'Max Probe Dist', help: 'How far the stylus travels toward the fence before it gives up.', section: 'TOOL & CUT', match: { type: 'assign', var: '#1' },  key: 'value' },
    { param: 'retract', type: 'number', default: ALIGNMENT_DEFAULTS.retract, label: 'Retract',        help: 'How far the probe backs off after the first touch, before the slow re-approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#2' },  key: 'value' },
    { param: 'f_fast',  type: 'number', default: ALIGNMENT_DEFAULTS.f_fast,  label: 'Fast Feed',      help: 'Feed rate (mm/min) for the initial fast approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#3' },  key: 'value' },
    { param: 'f_slow',  type: 'number', default: ALIGNMENT_DEFAULTS.f_slow,  label: 'Slow Feed',      help: 'Feed rate (mm/min) for the precise second touch.', section: 'TOOL & CUT', match: { type: 'assign', var: '#4' },  key: 'value' },
    { param: 'port',    type: 'number', default: ALIGNMENT_DEFAULTS.port,    label: 'Port',           help: 'The controller input port the probe signal is wired to (the G31 P word).', section: 'TOOL & CUT', match: { type: 'assign', var: '#5' },  key: 'value' },
    { param: 'safeZ',   type: 'number', default: ALIGNMENT_DEFAULTS.safeZ,   label: 'Safe Z',         help: 'The clearance height the probe lifts to between the two fence touches / for the final park.', section: 'GEOMETRY', match: { type: 'assign', var: '#19' }, key: 'value' },
];

/** STRUCTURAL toggles — drive the 4-arm guards (NO value socket). checkAxis(X|Y fence) + probeDir(pos|neg). */
export const ALIGNMENT_STRUCT_BINDINGS = [
    // t510 Fork 2 — the TRAVEL mode (guards the auto/manual arms). AUTO rapids to the 2 declared handle positions (safe-Z
    // travel), then probes — no jog, no Confirm. MANUAL = jog to each + Confirm (the handles are HINTS). AUTO needs a stock:
    // the segmented AUTO option greys with no stock (gateAuto → data-op-gated, tooltip); the effective mode falls back to MANUAL.
    { param: 'travel',    type: 'enum', widget: 'segmented', default: ALIGNMENT_DEFAULTS.travel,    label: 'Travel',     help: 'AUTO: the wizard rapids to the two probe-point handles (needs a stock) and probes each. MANUAL: you jog to each point + Confirm (the handles are preview hints).', section: 'GEOMETRY', widgetConfig: { options: [['Auto', 'auto'], ['Manual', 'manual']], gateAuto: true } },
    { param: 'checkAxis', type: 'enum', widget: 'segmented', default: ALIGNMENT_DEFAULTS.checkAxis, label: 'Fence Axis', help: 'The machine axis the fence runs ALONG (the probe moves in the perpendicular axis).', section: 'GEOMETRY', widgetConfig: { options: [['X', 'X'], ['Y', 'Y']] } },
    { param: 'probeDir',  type: 'enum', widget: 'segmented', default: ALIGNMENT_DEFAULTS.probeDir,  label: 'Probe Dir',  help: 'Which way the probe approaches the fence: positive (+) or negative (−) along the perpendicular axis.', section: 'GEOMETRY', widgetConfig: { options: [['+', 'pos'], ['−', 'neg']] } },
];

/** VALUE-SWAP form controls — NOT structural (no guard, no #var socket): they drive the postInstantiate RECOMPOSE.
 *  tolerance is F3 DISPLAY-ONLY — a number field that recomposes ONLY the header comment (the macro never enforces it). */
export const ALIGNMENT_VALUESWAP_BINDINGS = [
    { param: 'safeZFrame', type: 'enum', default: ALIGNMENT_DEFAULTS.safeZFrame, label: 'Safe-Z Frame', help: 'Relative: safe Z is a clearance lift. Machine: safe Z is an absolute machine height, parked via G53.', section: 'GEOMETRY', widgetConfig: { options: [['Relative', 'relative'], ['Machine (G53)', 'machine']] } },
    { param: 'tolerance',  type: 'number', default: ALIGNMENT_DEFAULTS.tolerance, label: 'Tolerance', help: 'Informational only: the acceptable misalignment (mm), shown in the header comment. The macro measures the angle; it does not enforce a tolerance.', section: 'GEOMETRY' },
];

export const ALIGNMENT_DATA_OPTYPE = 'user_alignment_data';

/** The wrapped `user_root` template — the superset (all 4 arms), byte-transparent wrap (mirror middle/rotaryClockDataStack).
 *  panel form3d+2d + sim {machine:true} — a fence probe on the DEFAULT BOX (NO rig, NO simStock; the edge/middle pattern). */
export function alignmentDataStack(params = ALIGNMENT_DEFAULTS) {
    const exec = alignmentStack(params, { superset: true });
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'sim', params: { rotary: false, machine: true, magazine: false } },
            { type: 'param_group', params: { group: 'Alignment' }, children: [] },
        ],
        children: exec,
    }];
}

/** Value bindings DERIVED over a canonical-pruned stack (no optional/when-gated binding — all 6 scalars are present under any
 *  checkAxis/probeDir arm). EMIT re-derives BY IDENTITY over the actual pruned stack each build (via def.bindingSpecs). */
function canonicalPrunedStack() { const c = JSON.parse(JSON.stringify(alignmentDataStack(ALIGNMENT_DEFAULTS))); pruneGuards(c, ALIGNMENT_DEFAULTS); return c; }
export const ALIGNMENT_BINDINGS = deriveBindingsFor(canonicalPrunedStack(), ALIGNMENT_BINDING_SPECS);

// ── postInstantiate — the value-swaps + source-chips, recomposed from the resolved params (E0 superset UNCHANGED) ──

/** RECOMPOSE the SCALAR/tolerance header comment (top3) from resolved params — match the frozen DEFAULT text, replace with
 *  the resolved. The checkAxis/probeDir comments are guard-handled (the pruned arm is already correct), so ONLY this line. */
function applyHeaderComments(stack, resolved) {
    const d = alignmentHeaderComments(ALIGNMENT_DEFAULTS);
    const r = alignmentHeaderComments(resolved || {});
    if (d.top3 === r.top3) return stack;
    for (const b of flattenBlocks(stack)) {
        if (b && b.type === 'comment' && b.params && b.params.text === d.top3) { b.params.text = r.top3; break; }
    }
    return stack;
}

/** RECOMPOSE the final PARK block for the safeZFrame value-swap: relative → the rapid `move` (seed default); machine → the
 *  `machinemove` (G53). Alignment has NO 'Final retract' comment anchor → find the park as the block right AFTER the #54 ATAN
 *  assign (the only such assign; the earlier MV Z#19 lift is disambiguated by this anchor). Parks at #19 (rotaryData precedent). */
function applySafeZFrame(stack, resolved) {
    if (!resolved || resolved.safeZFrame !== 'machine') return stack;   // relative = the seed → unchanged (byte-identical)
    const flat = flattenBlocks(stack);
    const ai = flat.findIndex((b) => b && b.type === 'assign' && b.params && b.params.var === '#54' && /ATAN/.test(String(b.params.value)));
    if (ai < 0) return stack;
    const park = flat[ai + 1];
    if (park && park.type === 'move') { park.type = 'machinemove'; park.params = { axis: 'Z', to: '#19' }; }
    return stack;
}

// t510 Fork 2 — RECOMPOSE the AUTO travel-move coords from the OP'S STOCK × the fraction params (the ONE source). The
// superset's AUTO arm carries PLACEHOLDER (0,0) MV X/Y moves (built no-stock, prune keeps them when the effective travel is
// AUTO); when a usable stock exists, rewrite the numeric X/Y move params IN ORDER [A.x,B.x] / [A.y,B.y] from alignPointsXY —
// so the TWIN emits AUTO BYTE-IDENTICAL to alignmentStack AUTO. MANUAL (no stock / manual chosen) → no travelTo moves → no-op.
const r3align = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
function applyAlignAutoTravel(stack, resolved) {
    const stock = (getWorkpiece() || {}).outer || null;
    if (alignEffectiveTravel(resolved || {}, stock) !== 'auto') return stack;   // MANUAL — no AUTO moves to bind (byte-identical)
    const [A, B] = alignPointsXY(resolved || {}, stock);
    const xs = [A.x, B.x], ys = [A.y, B.y];
    let xi = 0, yi = 0;   // the only NUMERIC x/y moves are the 2 travelTo points (twoPass/park moves are #var); rewrite in order
    for (const b of flattenBlocks(stack)) {
        if (!b || b.type !== 'move' || !b.params) continue;
        if (typeof b.params.x === 'number' && xi < xs.length) b.params.x = r3align(xs[xi++]);
        if (typeof b.params.y === 'number' && yi < ys.length) b.params.y = r3align(ys[yi++]);
    }
    return stack;
}

// SOURCE-CHIPS (corner/atc/rotary precedent): on Expert, rewrite #2 (retract) / #3 (fastFeed) / #5 (port) to the register.
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

/** Build the alignment-as-data def — bindingSpecs (re-derive by #var identity) + the checkAxis×probeDir guards + the
 *  value-swap recompose + source-chips in postInstantiate + the existing BUILT_IN.alignment sim-starts (E2). Byte-identical
 *  to alignmentStack on all scalars + the structural sweep + both profiles. */
export function alignmentDataDef() {
    const SRC_BY_PARAM = { port: 'port', f_fast: 'fastFeed', retract: 'retract' };
    const valueBindings = ALIGNMENT_BINDINGS.map((b) => (SRC_BY_PARAM[b.param] ? { ...b, sourceField: SRC_BY_PARAM[b.param] } : b));
    const bindings = [...valueBindings, ...ALIGNMENT_STRUCT_BINDINGS, ...ALIGNMENT_VALUESWAP_BINDINGS];
    const def = userOpFromStack('alignment_data', 'Alignment (data)', alignmentDataStack(ALIGNMENT_DEFAULTS), bindings, 'form3d+2d', { forceMachine: true }, 'probe_datawiz');
    def.bindingSpecs = ALIGNMENT_BINDING_SPECS;   // re-derive value-socket indices BY IDENTITY over the PRUNED stack every build
    // t510 Fork 2 — inject the EFFECTIVE travel (auto only with a usable stock; else manual) into the prune params, so the
    // superset collapses to the right travel arm even when the user picked AUTO but no stock exists (→ MANUAL, E1/E3 safe).
    def.deriveGuards = (p) => ({ travel: alignEffectiveTravel(p, (getWorkpiece() || {}).outer || null) });
    def.postInstantiate = (stack, resolved) => applyProbeSources(applyAlignAutoTravel(applySafeZFrame(applyHeaderComments(stack, resolved), resolved), resolved));
    // E2 — the per-pass PREVIEW-START provider: reuse the EXISTING BUILT_IN.alignment (opSimStarts.js) VERBATIM via the sim
    // registry (registerUserOp → setUserSimStarts), NOT the builder → sim-only, emit BYTE-IDENTICAL. 2 starts (A/B along the
    // fence). NO def.simStock: alignment probes a fence on the DEFAULT BOX (no round bar) — the global box stock is correct.
    def.simStartsProvider = (params, stock) => opSimStarts('alignment', params, stock);
    // t508 Fork 1 — the DECLARED marker→param binding: each per-pass sim-start marker DRAGS the ONE source (the fraction
    // params). Marker 0 (point A) → params.ax/ay, marker 1 (point B) → params.bx/by, as FRACTIONS of the stock. The generic
    // in-place canvas (userOpView) reads this to make BOTH markers draggable → writes the fractions → re-read by opSimStarts +
    // the emit + round-trip. Declared here (not hardcoded in the view); a generic seam, scoped to alignment for now.
    def.simStartParams = [{ x: 'ax', y: 'ay' }, { x: 'bx', y: 'by' }];
    return def;
}
