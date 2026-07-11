/**
 * blocks/dataOps/rotaryCenterData.js — the ROTARY CENTRELINE built-in as a pure DATA definition (rotary port E1, t413).
 *
 * Mirrors middleData/cornerData. rotaryCenterStack(params, {superset:true}) (E0, c2bfe6e) carries the method(known|fit) +
 * approach(auto|guided) block-shape forks GUARDED; instantiate/pruneGuards collapses to the concrete shape, then the value
 * bindings re-inject the scalars → byte-identical to the built-in across the structural + scalar sweep.
 *
 * 8 VALUE bindings by #var IDENTITY: #1 dist / #2 retract / #3 f_fast / #4 f_slow / #5 port / #6 radius / #17 safeZ + the
 * #57 diameter socket (E0 dissolve) — #57 is OPTIONAL (known-only; deriveBindings skips it when the fit arm is pruned). The
 * #11/#12 flank-geometry sockets are CONSTANT expressions ([#55+#2+#6] / [#17+#55]) that reference the other #vars → they
 * recompute for free, NOT bound. 2 STRUCT bindings drive the guards: method + approach.
 *
 * THE VALUE-SWAPS (datum / wcs / safeZFrame + the interpolated header) are NOT structural — a frozen superset can't respond
 * to them via prune (E0's per-combo build hid this). Per the port plan they stay value-swaps, RECOMPOSED from the resolved
 * params in postInstantiate (the cornerData applyHeaderComments precedent, extended): the 3 summary comments (method/datum/
 * wcs/scalars), the Z work-offset value (datum → #50/#56), the WCS arg on the offset writes (wcs), and the final PARK block
 * (safeZFrame → move|machinemove). Plus the #2/#3/#5 source-chips (Expert registers). So the twin is byte-identical to the
 * built-in on ALL scalars, ALL 112 structural combos, and BOTH profiles — with E0 (the banked superset) UNCHANGED. FIT
 * ADVANCED banner stays (Studio-original, machine-unvalidated). NOT seeded / opensAs yet (E2/E4).
 */
import { rotaryCenterStack, rotaryCenterHeaderComments } from '../../wizards/rotaryCenterWizard.js';
import { userOpFromStack, flattenBlocks } from '../userOps.js';
import { srcVal, srcNote } from '../../wizards/probeBlocks.js';
import { deriveBindingsFor } from './deriveBindings.js';
import { pruneGuards } from '../whenGuard.js';   // derive the value bindings over a CANONICAL-pruned stack (the #57 diameter socket is known-only in the superset)
import { opSimStarts } from '../../viz/opSimStarts.js';   // E2 — reuse BUILT_IN.rotary_center's per-pass sim-starts (known=1 pass, fit=3) via the registry, so emit stays byte-identical
import { num } from '../../wizards/ops/util.js';
import { rotaryAxisOf } from '../../engine/probeGeometry.js';   // E3 — which Cartesian axis the round bar lies along (the rotary axis)

/** Author defaults — match rotaryCenterStack's own num() fallbacks + the structural default shape (known / auto / centreline / active / relative). */
export const ROTARY_CENTER_DEFAULTS = {
    method: 'known', approach: 'auto', datum: 'center', wcs: 'active', safeZFrame: 'relative',
    dist: 30, retract: 2, f_fast: 200, f_slow: 50, port: 3, radius: 2, safeZ: 15, diameter: 76.2, level: 0,
};

/** The bindable scalars → the `assign` macro var each writes (by identity). #2/#3/#5 are ALSO source-chip vars. #57
 *  (diameter) is OPTIONAL — present only in the KNOWN arm (deriveBindings optional-skips it when fit is pruned). */
export const ROTARY_CENTER_BINDING_SPECS = [
    { param: 'dist',     type: 'number', default: ROTARY_CENTER_DEFAULTS.dist,     label: 'Max Probe Dist', help: 'How far the stylus travels toward each surface before it gives up.', section: 'TOOL & CUT', match: { type: 'assign', var: '#1' },  key: 'value' },
    { param: 'retract',  type: 'number', default: ROTARY_CENTER_DEFAULTS.retract,  label: 'Retract',        help: 'How far the probe backs off after the first touch, before the slow re-approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#2' },  key: 'value' },
    { param: 'f_fast',   type: 'number', default: ROTARY_CENTER_DEFAULTS.f_fast,   label: 'Fast Feed',      help: 'Feed rate (mm/min) for the initial fast approach.', section: 'TOOL & CUT', match: { type: 'assign', var: '#3' },  key: 'value' },
    { param: 'f_slow',   type: 'number', default: ROTARY_CENTER_DEFAULTS.f_slow,   label: 'Slow Feed',      help: 'Feed rate (mm/min) for the precise second touch.', section: 'TOOL & CUT', match: { type: 'assign', var: '#4' },  key: 'value' },
    { param: 'port',     type: 'number', default: ROTARY_CENTER_DEFAULTS.port,     label: 'Port',           help: 'The controller input port the probe signal is wired to (the G31 P word).', section: 'TOOL & CUT', match: { type: 'assign', var: '#5' },  key: 'value' },
    { param: 'radius',   type: 'number', default: ROTARY_CENTER_DEFAULTS.radius,   label: 'Stylus Radius',  help: 'The probe stylus tip radius (mm) — the OD comp for both methods.', section: 'TOOL & CUT', match: { type: 'assign', var: '#6' },  key: 'value' },
    { param: 'safeZ',    type: 'number', default: ROTARY_CENTER_DEFAULTS.safeZ,    label: 'Safe Z',         help: 'The clearance height the probe lifts to between flanks / for the final park.', section: 'GEOMETRY', match: { type: 'assign', var: '#17' }, key: 'value' },
    { param: 'diameter', type: 'number', default: ROTARY_CENTER_DEFAULTS.diameter, optional: true, when: { param: 'method', is: 'known' }, label: 'Known Diameter', help: 'The known bar diameter (mm). R = diameter/2; the centreline Z = top − R. Known method only.', section: 'GEOMETRY', match: { type: 'assign', var: '#57' }, key: 'value' },
];

/** STRUCTURAL toggles — drive the guard prune (NO value socket). method(known|fit) + approach(auto|guided). */
export const ROTARY_CENTER_STRUCT_BINDINGS = [
    { param: 'method',   type: 'enum', default: ROTARY_CENTER_DEFAULTS.method,   label: 'Method',         help: 'Known diameter (probe the top + two flanks) or 3-point Fit (probe 3 points, solve the circle — ADVANCED, verify on machine).', section: 'GEOMETRY', widgetConfig: { options: [['Known diameter', 'known'], ['3-point fit (advanced)', 'fit']] } },
    { param: 'approach', type: 'enum', widget: 'segmented', default: ROTARY_CENTER_DEFAULTS.approach, label: 'Flank Approach', help: 'Known method: Auto runs the flank cycle hands-free; Guided pauses at each flank for you to verify / fine-jog.', section: 'GEOMETRY', widgetConfig: { options: [['Auto', 'auto'], ['Guided', 'guided']] } },
];

/** VALUE-SWAP form controls — NOT structural (no guard, no #var socket): they drive the postInstantiate RECOMPOSE. */
export const ROTARY_CENTER_VALUESWAP_BINDINGS = [
    { param: 'datum',      type: 'enum', default: ROTARY_CENTER_DEFAULTS.datum,      label: 'Z0 Datum',     help: 'Set Z0 at the centreline (the bar axis) or the OD top.', section: 'GEOMETRY', widgetConfig: { options: [['Centreline', 'center'], ['OD top', 'top']] } },
    { param: 'wcs',        type: 'enum', default: ROTARY_CENTER_DEFAULTS.wcs,        label: 'WCS',          help: 'Which work-coordinate register to store the found centre into.', section: 'GEOMETRY', widgetConfig: { options: [['Active', 'active'], ['G54', 'G54'], ['G55', 'G55'], ['G56', 'G56'], ['G57', 'G57'], ['G58', 'G58'], ['G59', 'G59']] } },
    { param: 'safeZFrame', type: 'enum', default: ROTARY_CENTER_DEFAULTS.safeZFrame, label: 'Safe-Z Frame', help: 'Relative: safe Z is a clearance lift. Machine: safe Z is an absolute machine height, parked via G53.', section: 'GEOMETRY', widgetConfig: { options: [['Relative', 'relative'], ['Machine (G53)', 'machine']] } },
];

export const ROTARY_CENTER_DATA_OPTYPE = 'user_rotary_center_data';

/** The wrapped `user_root` template — the superset (all guard arms), byte-transparent wrap (mirror middleDataStack).
 *  panel form3d+2d + sim {rotary:true, machine:true} — rotary declares the rig (opSimContext ROTARY_RIG). */
export function rotaryCenterDataStack(params = ROTARY_CENTER_DEFAULTS) {
    const exec = rotaryCenterStack(params, { superset: true });
    return [{
        type: 'user_root',
        params: {},
        uiChildren: [
            { type: 'panel', params: { panel: 'form3d+2d' } },
            { type: 'sim', params: { rotary: true, machine: false, magazine: false } },   // t714 — the 4th-axis RIG frames the bar (rotary:true); no forceMachine envelope (machine:true was latent-dead)
            { type: 'param_group', params: { group: 'Rotary Centreline' }, children: [] },
        ],
        children: exec,
    }];
}

/** Value bindings DERIVED over a CANONICAL-pruned stack where the #57 diameter socket is present (method='known'). EMIT
 *  re-derives BY IDENTITY over the actual pruned stack each build (via def.bindingSpecs), so the frozen indices never desync. */
const CANONICAL_BIND = { ...ROTARY_CENTER_DEFAULTS, method: 'known' };
function canonicalPrunedStack() { const c = JSON.parse(JSON.stringify(rotaryCenterDataStack(ROTARY_CENTER_DEFAULTS))); pruneGuards(c, CANONICAL_BIND); return c; }
export const ROTARY_CENTER_BINDINGS = deriveBindingsFor(canonicalPrunedStack(), ROTARY_CENTER_BINDING_SPECS);

// ── postInstantiate — the value-swaps + source-chips, recomposed from the resolved params (E0 superset UNCHANGED) ──

/** RECOMPOSE the 3 interpolated SUMMARY comments (method/diameter/datum/wcs/scalars) from resolved params — match the frozen
 *  DEFAULT text, replace with the resolved. (bindings only touch #N VALUES, not composed comment text.) */
function applyHeaderComments(stack, resolved) {
    const d = rotaryCenterHeaderComments(ROTARY_CENTER_DEFAULTS);
    const r = rotaryCenterHeaderComments(resolved || {});
    const map = [['top1'], ['top3'], ['knownHeader'], ['writeOrigin']].map(([k]) => [d[k], r[k]]).filter(([a, b]) => a !== b);
    if (!map.length) return stack;
    for (const b of flattenBlocks(stack)) {
        if (!b || b.type !== 'comment' || !b.params) continue;
        for (const [dt, rt] of map) if (b.params.text === dt) { b.params.text = rt; break; }
    }
    return stack;
}

/** RECOMPOSE the datum + wcs VALUE-swaps on the work-offset writes: the WCS arg (wcs → #578 / Gnn−53) on every SWO, and the
 *  Z offset value (datum → OD top #50 / centreline #56). The Y offset (#54) is datum-independent. */
function applyDatumWcs(stack, resolved) {
    const p = resolved || {};
    const wcs = p.wcs || 'active';
    const wcsArg = wcs === 'active' ? '#578' : String(parseInt(String(wcs).replace('G', ''), 10) - 53);
    const zVal = p.datum === 'top' ? '#50' : '#56';
    for (const b of flattenBlocks(stack)) {
        if (!b || b.type !== 'setworkoffset' || !b.params) continue;
        b.params.wcs = wcsArg;
        if (b.params.axis === 'Z') b.params.value = zVal;
    }
    return stack;
}

/** RECOMPOSE the final PARK block for the safeZFrame value-swap: relative → the rapid `move` (seed default); machine → the
 *  `machinemove` (G53). Find the park by its 'Final retract' comment anchor + swap the block in place. */
function applySafeZFrame(stack, resolved) {
    if (!resolved || resolved.safeZFrame !== 'machine') return stack;   // relative = the seed → unchanged (byte-identical)
    const flat = flattenBlocks(stack);
    const ci = flat.findIndex((b) => b && b.type === 'comment' && b.params && b.params.text === 'Final retract');
    if (ci < 0) return stack;
    const park = flat[ci + 1];
    if (park && park.type === 'move') { park.type = 'machinemove'; park.params = { axis: 'Z', to: '#17' }; }
    return stack;
}

// SOURCE-CHIPS (corner/atc precedent): on Expert, rewrite #2 (retract) / #3 (fastFeed) / #5 (port) to the controller register.
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

/** Build the rotary-centreline-as-data def — bindingSpecs (re-derive by #var identity) + the structural guards + the
 *  value-swap recompose + source-chips in postInstantiate. Byte-identical to rotaryCenterStack on all scalars + 112 combos + both profiles. */
export function rotaryCenterDataDef() {
    const SRC_BY_PARAM = { port: 'port', f_fast: 'fastFeed', retract: 'retract' };
    const valueBindings = ROTARY_CENTER_BINDINGS.map((b) => (SRC_BY_PARAM[b.param] ? { ...b, sourceField: SRC_BY_PARAM[b.param] } : b));
    const bindings = [...valueBindings, ...ROTARY_CENTER_STRUCT_BINDINGS, ...ROTARY_CENTER_VALUESWAP_BINDINGS];
    const def = userOpFromStack('rotary_center_data', 'Rotary Centreline (data)', rotaryCenterDataStack(ROTARY_CENTER_DEFAULTS), bindings, 'form3d+2d', { forceMachine: true }, 'probe_datawiz');
    def.bindingSpecs = ROTARY_CENTER_BINDING_SPECS;   // re-derive value-socket indices BY IDENTITY over the PRUNED stack every build
    def.postInstantiate = (stack, resolved) => applyProbeSources(applySafeZFrame(applyDatumWcs(applyHeaderComments(stack, resolved), resolved), resolved));
    // E2 — the per-pass PREVIEW-START provider: reuse BUILT_IN.rotary_center (opSimStarts.js:86) VERBATIM via the sim registry
    // (registerUserOp → setUserSimStarts), NOT the builder → sim-only, emit BYTE-IDENTICAL. KNOWN = 1 pass (top); FIT = 3 (top + 2 flanks).
    def.simStartsProvider = (params, stock) => opSimStarts('rotary_center', params, stock);
    // E3 — the ROUND-BAR sim read (retire activateCylinderStock for the TWIN path; F3 pre-ruled): DERIVE a round-bar preview
    // stock from #57 (the bar Ø — the USER's clean control, dont-declare-away-user-responsibility) WITHOUT mutating the global
    // settings.stock. Registered via setUserSimStock → userOpView feeds it to the preview (viz + engine + sim-starts). Sim-only
    // → emit BYTE-IDENTICAL. Mirrors activateCylinderStock's cross-square, but the Ø comes from #57 (not the max cross dim).
    def.simStock = (params, stock) => {
        const cur = stock || {};
        const dia = num(params && params.diameter, ROTARY_CENTER_DEFAULTS.diameter);   // #57
        let axis = 'x'; try { axis = rotaryAxisOf((typeof window !== 'undefined' && window.ddcsGetSettings && window.ddcsGetSettings().motors)) || 'x'; } catch (_) { /* default X */ }
        const cross = axis === 'x' ? ['y', 'z'] : axis === 'y' ? ['x', 'z'] : ['x', 'y'];
        const dims = { x: num(cur.x, 150), y: num(cur.y, 76.2), z: num(cur.z, 76.2) };
        dims[cross[0]] = dia; dims[cross[1]] = dia;   // the cross-section = the bar Ø (barRadius = diameter/2)
        return { ...cur, ...dims, diameter: dia, shape: 'cylinder', datum: 'nnp', pin: 'origin', show: true };
    };
    return def;
}
