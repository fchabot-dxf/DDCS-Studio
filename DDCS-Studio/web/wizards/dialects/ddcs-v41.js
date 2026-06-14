/**
 * wizards/dialects/ddcs-v41.js — DDCS V4.1 dialect.
 *
 * ⚠ UNVERIFIED ON HARDWARE — dump-derived best-effort. We have no V4.1 to test on; trust nothing here until it
 * runs on a real V4.1. Only DDCS Expert M350 is hardware-testable for us (see ddcs-expert-m350.js).
 *
 * ≈ Expert M350 in FORM; differs in VARIABLE NUMBERS (runtime state at #1500+). Read from the V4.1 firmware
 * macros under bridge/controllers/v4.1/assets/firmware/.../ddcsv4/ + the var map default_vars_v41.js.
 */
const AX = { X: 0, Y: 1, Z: 2, A: 3 };

export const dialect = {
    id: 'ddcs-v41', name: 'DDCS V4.1',
    programModel: 'inline', probeModel: 'g31', dwellUnits: 'ms',
    vars: { dro: 1500, probeStatus: null, probeTrig: 1500, wcsBase: 1512, wcsStride: 6, activeWcs: null, toolTable: 1561, ax: AX },

    // G31 Z-1000 L#682 Q1 K0 F#106  (probe-fix.nc:10). L#682 = probe-selector config param; no P-port word.
    probeMove: (axis, dist, { feed = 100 } = {}) => [`G31 ${axis}${dist} L#682 Q1 K0 F${feed}`],
    probeStatus: () => [],                                   // no status var — success read from post-probe DRO #1502 (TO CONFIRM)
    probeRead: (axis, varName) => [`${varName}=#${1500 + AX[axis]}`],   // post-probe machine pos (probe-fix.nc:11)
    readMachine: (axis, varName) => [`${varName}=#${1500 + AX[axis]}`], // DRO X#1500/Y#1501/Z#1502/A#1503
    machineMove: (axis, ref) => [`G53 ${axis}${ref}`],      // probe-fix.nc:6 "G0 G53 Z#102"
    // V4.1 macros zero with G92 (probe-float.nc:7) — but value is a WORK coord (at the point), NOT a machine
    // coord like Expert's register write. Cross-profile value semantics unresolved → VERIFY on hardware.
    setWorkOffset: (wcsExpr, axis, value) => [`G90 G92 ${axis}${value}   ( set datum - VERIFY on hardware )`],
    readActiveWcs: () => [],                                 // TO CONFIRM
    distMode: (mode) => (mode === 'inc' ? 'G91' : 'G90'),
    dwell: (sec) => [`G04 P${Math.round(sec * 1000)}`],     // ms (firmware G04P1000)
    endProgram: () => ['M30'],
    ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${op}${rhs}GOTO${label}`],  // NO space before GOTO (probe-h.nc:7)
    goto: (label) => [`GOTO${label}`],
    label: (n) => [`N${n}`],
    spindle: (dir, rpm) => [`${dir === 'ccw' ? 'M4' : 'M3'} S${rpm}`],
    spindleOff: () => ['M5'],
    coolant: (on) => [on ? 'M8' : 'M9'],
    hmiPrompt: () => [],   // TO CONFIRM — V4.1 uses MarcoDialog "*.rc", #1505 unconfirmed
    hmiToast: () => [],
    hmiInput: () => [],

    notes: '≈Expert FORM, vars at #1500+ (DRO #1500-1503, WCS base #1512 stride 6, tool table #1561). WCS via G92, '
        + 'not the indirect #[805+] write. No probe status/trigger var (result = post-probe DRO #1502). ifGoto has NO '
        + 'space before GOTO. HMI via MarcoDialog .rc — TO CONFIRM. Verified vs bridge/controllers/v4.1 firmware macros.',
};
