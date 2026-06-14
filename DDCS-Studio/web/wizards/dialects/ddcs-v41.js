/**
 * wizards/dialects/ddcs-v41.js — DDCS V4.1 dialect.
 *
 * ✅ CONFIRMED against the LIVE V4.1 (read-only over SMB, \\10.0.0.50\SYSDISK, 2026-06-13): probe form, the
 * #1500-1503 machine-position vars, probe-result #1502, G0 G53 machine moves, and G92 zeroing all match the
 * controller's own macros (probe-float/fix/vertex.nc, safez.nc, zero*.nc). Tool-table/HMI details still partial.
 *
 * ≈ Expert M350 in FORM; differs in VARIABLE NUMBERS (runtime state at #1500+).
 */
const AX = { X: 0, Y: 1, Z: 2, A: 3 };

export const dialect = {
    id: 'ddcs-v41', name: 'DDCS V4.1',
    programModel: 'inline', probeModel: 'g31', dwellUnits: 'ms',
    // dro = machine pos #1500-1503; wcsWork = workpiece pos #1506-1509 (what zero*.nc writes); toolTable #1560/#764.
    vars: { dro: 1500, wcsWork: 1506, probeStatus: null, probeTrig: 1500, wcsBase: 1512, wcsStride: 6, activeWcs: null, toolTable: 1560, ax: AX },

    // G91 G31 Z-1000 L#682 Q1 K0 F#106  (probe-float.nc, live). L#682 = probe-selector config param; no P-port word.
    probeMove: (axis, dist, { feed = 100 } = {}) => [`G31 ${axis}${dist} L#682 Q1 K0 F${feed}`],
    probeStatus: () => [],                                   // no status var — success read from post-probe DRO #1502 (probe-fix.nc)
    probeRead: (axis, varName) => [`${varName}=#${1500 + AX[axis]}`],   // post-probe machine pos #1500+ax (probe-fix.nc: #108=#1502)
    readMachine: (axis, varName) => [`${varName}=#${1500 + AX[axis]}`], // DRO X#1500/Y#1501/Z#1502/A#1503 (safez.nc)
    machineMove: (axis, ref) => [`G0 G53 ${axis}${ref}`],   // CONFIRMED live: probe-fix.nc "G0G53Z#102" (G0 + G53)
    // CONFIRMED live (probe-vertex.nc): zero at the probed point with G90 G92 <axis><WORK value> — a work coord,
    // NOT a machine coord like Expert's register write. ("zero here" macros zeroz/zeroxy write #1506-1509 directly.)
    setWorkOffset: (wcsExpr, axis, value) => [`G90 G92 ${axis}${value}`],
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

    notes: '≈Expert FORM, vars at #1500+ (DRO #1500-1503, workpiece #1506-1509, WCS base #1512 stride 6). Zero via '
        + 'G92 with a WORK coord (or direct #1506-1509 write), NOT the indirect #[805+] write. No probe status var '
        + '(result = post-probe DRO #1502). Machine move = G0 G53. ifGoto has NO space before GOTO. HMI via '
        + 'MarcoDialog *.rc — TO CONFIRM. CONFIRMED live on \\\\10.0.0.50\\SYSDISK (2026-06-13).',
};
