/**
 * blocks/dataOps/wcsData.js — the WCS (work-offset) wizard as a pure DATA definition (E1 EMIT).
 *
 * WCS is a STATIC-shape op: after the t477 restructure, wcsStack is ONE dialect-aware `wcszero` atom whose emit COMPUTES
 * the auto|fixed × axes × sync forks from its value params — so there are NO structural guards (no superset, unlike pocket).
 * The twin is the cheapest kind: frozen POSITIONAL bindings over the single wcszero block (like drill/slot/contour). Emit is
 * DIALECT-AWARE at emit (the atom resolves the active post), so the twin == the built-in wcsStack byte-identical on every
 * dialect — M350 register writes / rs274·grbl G10 L20 / v41 #1506 / dm500 #804 (proven in wcs-in-place.spec).
 */
import { wcsStack } from '../../wizards/stacks/wcsWizard.js';
import { userOpFromStack } from '../userOps.js';
import { deriveBindingsFor } from './deriveBindings.js';

export const WCS_DEFAULTS = { sys: '0', axisX: true, axisY: true, axisZ: false, sync: false, slave: '3' };

const SYS_OPTIONS = [['Active WCS (Auto)', '0'], ['G54', '54'], ['G55', '55'], ['G56', '56'], ['G57', '57'], ['G58', '58'], ['G59', '59']];
const SLAVE_OPTIONS = [['A', '3'], ['B', '4']];

// t2605 (BACKLOG #71/#72 conversion tier) — CONVERTED from a hand-counted `blockIndex: 0` + a `WRAP` constant
// (the EXACT hazard t2257 caught the hard way on atcWarmupData.js — this file's own comment already named it
// as the thing to watch for, before this conversion existed to close it) to identity-based `match:
// {type:'wcszero'}` — the ONE block in the whole exec stack, unambiguous by type alone (unlike atc_warmup, no
// `nth` needed: all 6 bindings target the SAME block, disambiguated by `key`, not by which block).
// t1704 — WCS is the "trivial ideal" case for token eligibility: wcsStack (wizards/wcsWizard.js) is a ONE-LINE
// function that copies every param straight into the single wcszero atom's params object — zero JS arithmetic,
// zero branching, at the wizard layer. All 6 are `tokenEligible`. (None render as a typed field today — every one
// is a dropdown/checkbox — so none currently OFFER a token-entry gesture regardless; see the scope note above.)
// t1906 — `sys` gated whole-field on `_wcsPickerOk` (needs wcsAuto OR wcsFixed; V4.1/DM500 have neither — no
// per-WCS-index register at all, same confirmed fact as readActiveWcs's own named-absence). `sync`/`slave` gated
// on `_wcsSyncOk` (dual-gantry slave sync is an Expert-specific #883/#884 register write, confirmed absence on
// every other post, not encoded ignorance — see userOpView.js's own activePostWcsSync comment).
const WCS_PICKER_GATE = { param: '_wcsPickerOk', is: false, tip: 'This controller has no per-WCS-index register — it zeroes whichever WCS frame is currently active, and can\'t target a specific one.' };
const WCS_SYNC_GATE = { param: '_wcsSyncOk', is: false, tip: 'Dual-gantry slave sync is a DDCS-Expert-specific register write — no equivalent on this controller.' };
// t2381 — SECTION MISMATCH, fixed: the shell (index.html:1196-1237) declares THREE sections — FEATURE
// CONTEXT (axisX/axisY/axisZ), WCS (sys), OPTIONS (sync/slave) — matched exactly (unchanged by this turn).
const WCS_BINDING_SPECS = [
    // FEATURE CONTEXT
    { param: 'axisX', tokenEligible: true, match: { type: 'wcszero' }, key: 'axisX', type: 'bool', default: WCS_DEFAULTS.axisX, label: 'Zero X', section: 'FEATURE CONTEXT' },
    { param: 'axisY', tokenEligible: true, match: { type: 'wcszero' }, key: 'axisY', type: 'bool', default: WCS_DEFAULTS.axisY, label: 'Zero Y', section: 'FEATURE CONTEXT' },
    { param: 'axisZ', tokenEligible: true, match: { type: 'wcszero' }, key: 'axisZ', type: 'bool', default: WCS_DEFAULTS.axisZ, label: 'Zero Z', section: 'FEATURE CONTEXT' },
    // WCS
    { param: 'sys', tokenEligible: true, match: { type: 'wcszero' }, key: 'sys', type: 'enum', default: WCS_DEFAULTS.sys, widget: 'dropdown', widgetConfig: { options: SYS_OPTIONS }, label: 'WCS System', help: 'Active WCS (Auto) zeroes whichever WCS is loaded; G54-G59 target a specific register (posts that can\'t are gated).', section: 'WCS', gate: WCS_PICKER_GATE },
    // OPTIONS
    { param: 'sync', tokenEligible: true, match: { type: 'wcszero' }, key: 'sync', type: 'bool', default: WCS_DEFAULTS.sync, label: 'Sync A Axis (Dual Gantry)', section: 'OPTIONS', gate: WCS_SYNC_GATE },
    { param: 'slave', tokenEligible: true, match: { type: 'wcszero' }, key: 'slave', type: 'enum', default: WCS_DEFAULTS.slave, widget: 'dropdown', widgetConfig: { options: SLAVE_OPTIONS }, label: 'Slave', section: 'OPTIONS', gate: WCS_SYNC_GATE },
];

export const WCS_DATA_OPTYPE = 'user_wcs_data';

/** Build the wcs-as-data def — a static-shape twin (identity bindings; no superset) over the dialect-aware wcszero atom. */
export function wcsDataDef() {
    // t2605 (Phase 1 step 1) — no bootstrap/final split needed (static shape, all 6 specs target the SAME
    // single block by type — the tree only needs `.param` strings to build field_refs, not the derived
    // blockIndex), but the FINAL bindings shipped are still re-derived fresh against the real, final stack
    // (t2595's own finding — a stale derive against a different uiChildren shape would break identically to
    // the blockIndex/WRAP this conversion just removed).
    const fieldRefsOf = (specs) => specs.map((b) => ({ type: 'field_ref', params: { param: b.param } }));
    const bySection = (name) => WCS_BINDING_SPECS.filter((b) => b.section === name);
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [{
            // t2605 (Phase 1 step 1) — wrapped in split_horizontal so hasTreeLayout() (userOpView.js) routes
            // this twin onto renderUiTree. panel='form' (viz:false, per panelTypes.js:45) — the SAME no-viz
            // shape io_step/pause_confirm already proved: no viz-mounting code runs in either render path, so
            // the RIGHT pane is declared empty — matching this file's own pre-existing note that WCS's 2D pane
            // was ALWAYS permanently empty ("a register-write macro — no motion / no preview").
            type: 'split_horizontal', params: { ratio: '360px:*' },
            children: {
                LEFT: [{
                    type: 'param_group',
                    params: { group: 'WCS' },
                    children: [
                        { type: 'usage_text', params: { text: 'Zeroes the selected axes in the target work-coordinate register — Active WCS (whichever is loaded) or a specific G54-G59. Optionally syncs the dual-gantry slave A-axis to match.' } },
                        { type: 'group_box', params: { title: 'FEATURE CONTEXT' }, children: fieldRefsOf(bySection('FEATURE CONTEXT')) },
                        { type: 'group_box', params: { title: 'WCS' }, children: fieldRefsOf(bySection('WCS')) },
                        { type: 'group_box', params: { title: 'OPTIONS' }, children: fieldRefsOf(bySection('OPTIONS')) },
                        { type: 'code_preview', params: { tag: '(DDCS M350 COMPLIANT)' } },
                    ],
                }],
                RIGHT: [],
            },
        }],
        children: wcsStack(WCS_DEFAULTS),
    }];
    const bindings = deriveBindingsFor(stack, WCS_BINDING_SPECS);
    return userOpFromStack('wcs_data', 'WCS (data)', stack, bindings, 'form');
}
