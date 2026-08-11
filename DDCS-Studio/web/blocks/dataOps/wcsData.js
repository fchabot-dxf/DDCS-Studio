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

// wcsStack(DEFAULTS) = [wcszero]; pre-order flatten under the wrap: user_root(0) panel(1) sim(2) param_group(3) wcszero(4).
const WRAP = 4;
// t1704 — WCS is the "trivial ideal" case for token eligibility: wcsStack (wizards/wcsWizard.js) is a ONE-LINE
// function that copies every param straight into the single wcszero atom's params object — zero JS arithmetic,
// zero branching, at the wizard layer. All 6 are `tokenEligible`. (None render as a typed field today — every one
// is a dropdown/checkbox — so none currently OFFER a token-entry gesture regardless; see the scope note above.)
const WCS_EXEC_BINDINGS = [
    { param: 'sys', tokenEligible: true, blockIndex: 0, key: 'sys', type: 'enum', default: WCS_DEFAULTS.sys, widget: 'dropdown', widgetConfig: { options: SYS_OPTIONS }, label: 'WCS System', help: 'Active WCS (Auto) zeroes whichever WCS is loaded; G54-G59 target a specific register (posts that can\'t are gated).', section: 'GEOMETRY' },
    { param: 'axisX', tokenEligible: true, blockIndex: 0, key: 'axisX', type: 'bool', default: WCS_DEFAULTS.axisX, label: 'Zero X', section: 'GEOMETRY' },
    { param: 'axisY', tokenEligible: true, blockIndex: 0, key: 'axisY', type: 'bool', default: WCS_DEFAULTS.axisY, label: 'Zero Y', section: 'GEOMETRY' },
    { param: 'axisZ', tokenEligible: true, blockIndex: 0, key: 'axisZ', type: 'bool', default: WCS_DEFAULTS.axisZ, label: 'Zero Z', section: 'GEOMETRY' },
    { param: 'sync', tokenEligible: true, blockIndex: 0, key: 'sync', type: 'bool', default: WCS_DEFAULTS.sync, label: 'Sync A Axis (Dual Gantry)', section: 'OPTIONS' },
    { param: 'slave', tokenEligible: true, blockIndex: 0, key: 'slave', type: 'enum', default: WCS_DEFAULTS.slave, widget: 'dropdown', widgetConfig: { options: SLAVE_OPTIONS }, label: 'Slave', section: 'OPTIONS' },
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
            { type: 'panel', params: { panel: 'form' } },   // form-only: WCS is a register-write macro (no motion / no preview)
            { type: 'sim', params: { rotary: false, machine: false, magazine: false } },
            { type: 'param_group', params: { group: 'WCS' }, children: [] },
        ],
        children: exec,
    }];
    return userOpFromStack('wcs_data', 'WCS (data)', stack, WCS_BINDINGS, 'form');
}
