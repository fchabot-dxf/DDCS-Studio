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

export const WCS_DEFAULTS = { sys: '0', axisX: true, axisY: true, axisZ: false, sync: false, slave: '3' };

const SYS_OPTIONS = [['Active WCS (Auto)', '0'], ['G54', '54'], ['G55', '55'], ['G56', '56'], ['G57', '57'], ['G58', '58'], ['G59', '59']];
const SLAVE_OPTIONS = [['A', '3'], ['B', '4']];

// wcsStack(DEFAULTS) = [wcszero]; pre-order flatten under the wrap: user_root(0) sim(1) param_group(2) wcszero(3).
// t2301 — WRAP dropped from 4 to 3 ('panel' removed from uiChildren, BACKLOG 20). This is the EXACT hazard
// t2257 caught the hard way on atcWarmupData.js (a hardcoded WRAP left stale after panel's removal broke
// every binding); caught here BEFORE committing, not after, by reading this file's own comment before editing.
const WRAP = 3;
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
// CONTEXT (axisX/axisY/axisZ), WCS (sys), OPTIONS (sync/slave) — but this array declared only two
// (`GEOMETRY` covering sys+axisX/Y/Z, `OPTIONS` unchanged) and in the WRONG field order (sys first; the
// shell puts the axis checkboxes first). Reordered + resectioned to match exactly — same mechanism as
// t2375's contour fix (array position, not just the `section:` string, drives formWidgets.js's own
// rendered grouping — see contourData.js's own header comment above CONTOUR_EXEC_BINDINGS for the full
// account). `GEOMETRY`/`TOOL & CUT`/`IDENTITY` are SECTION_RANK's own canonical whitelist, unrelated to
// this shell's own real section names — using them here would have been the SAME class of bug the mill
// family had (a hardcoded-whitelist-shaped name standing in for the shell's own).
const WCS_EXEC_BINDINGS = [
    // FEATURE CONTEXT
    { param: 'axisX', tokenEligible: true, blockIndex: 0, key: 'axisX', type: 'bool', default: WCS_DEFAULTS.axisX, label: 'Zero X', section: 'FEATURE CONTEXT' },
    { param: 'axisY', tokenEligible: true, blockIndex: 0, key: 'axisY', type: 'bool', default: WCS_DEFAULTS.axisY, label: 'Zero Y', section: 'FEATURE CONTEXT' },
    { param: 'axisZ', tokenEligible: true, blockIndex: 0, key: 'axisZ', type: 'bool', default: WCS_DEFAULTS.axisZ, label: 'Zero Z', section: 'FEATURE CONTEXT' },
    // WCS
    { param: 'sys', tokenEligible: true, blockIndex: 0, key: 'sys', type: 'enum', default: WCS_DEFAULTS.sys, widget: 'dropdown', widgetConfig: { options: SYS_OPTIONS }, label: 'WCS System', help: 'Active WCS (Auto) zeroes whichever WCS is loaded; G54-G59 target a specific register (posts that can\'t are gated).', section: 'WCS', gate: WCS_PICKER_GATE },
    // OPTIONS
    { param: 'sync', tokenEligible: true, blockIndex: 0, key: 'sync', type: 'bool', default: WCS_DEFAULTS.sync, label: 'Sync A Axis (Dual Gantry)', section: 'OPTIONS', gate: WCS_SYNC_GATE },
    { param: 'slave', tokenEligible: true, blockIndex: 0, key: 'slave', type: 'enum', default: WCS_DEFAULTS.slave, widget: 'dropdown', widgetConfig: { options: SLAVE_OPTIONS }, label: 'Slave', section: 'OPTIONS', gate: WCS_SYNC_GATE },
];
export const WCS_BINDINGS = WCS_EXEC_BINDINGS.map((b) => ({ ...b, blockIndex: b.blockIndex + WRAP }));

export const WCS_DATA_OPTYPE = 'user_wcs_data';

/** Build the wcs-as-data def — a static-shape twin (positional bindings; no superset) over the dialect-aware wcszero atom. */
export function wcsDataDef() {
    const exec = wcsStack(WCS_DEFAULTS);   // [wcszero]
    const stack = [{
        type: 'user_root',
        params: {},
        uiChildren: [
            // t2301 (BACKLOG 20) — 'panel' removed: the SAME id-collision fix as drillData.js's own comment
            // (its sim/panel branches share DOM ids), first established for ATC at t2257. layout2d:false ADDED
            // here (unlike drill/pocket): the removed panel's OWN comment already named this op's own 2D pane
            // as permanently empty ("form-only: WCS is a register-write macro — no motion / no preview") — the
            // exact reason ATC's own sim declarations carry layout2d:false, not a new judgment call.
            { type: 'sim', params: { rotary: false, machine: false, magazine: false, layout2d: false } },
            { type: 'param_group', params: { group: 'WCS' }, children: [] },
        ],
        children: exec,
    }];
    return userOpFromStack('wcs_data', 'WCS (data)', stack, WCS_BINDINGS, 'form');
}
