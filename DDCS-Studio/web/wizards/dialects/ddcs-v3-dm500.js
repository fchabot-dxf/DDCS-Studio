/**
 * wizards/dialects/ddcs-v3-dm500.js — DDCS V3 / DM500 dialect.
 *
 * STRUCTURALLY different from Expert: move-until-input probing (M101/G01/M102, NO G31), #864-866 DRO, G92 WCS,
 * dwell in SECONDS, and WORD IF operators (EQ/LT/GT — no `!=`). Verified against bridge/controllers/dm500/install/
 * (probe.nc, defprobe.nc, slib.nc, safez.nc, gotoz.nc — garbled comments ignored) + DDCS-Studio/web/data/default_vars_v3.js.
 */
const AX = { X: 0, Y: 1, Z: 2, A: 3 };
const OP = { '==': 'EQ', '!=': 'NE', '<': 'LT', '>': 'GT', '<=': 'LE', '>=': 'GE' };   // NE not actually in the dump — see notes

export const dialect = {
    id: 'ddcs-v3-dm500', name: 'DDCS V3 / DM500',
    programModel: 'inline', probeModel: 'move-until-input', dwellUnits: 's',
    vars: { dro: 864, probeStatus: null, probeTrig: 864, wcsBase: 804, wcsStride: 4, activeWcs: 455, toolTable: 1430, ax: AX },

    // move-until-input: arm (M101) → feed move → disarm (M102). probe.nc:23-25.
    probeMove: (axis, dist, { feed = 100 } = {}) => ['M101', `G91 G01 ${axis}${dist} F${feed}`, 'M102'],
    probeStatus: () => [],                                   // implicit — motion halts on input; no status var
    probeRead: (axis, varName) => [`${varName}=#${864 + AX[axis]}`],    // capture machine DRO at contact (probe.nc:4-6)
    readMachine: (axis, varName) => [`${varName}=#${864 + AX[axis]}`],  // DRO X#864/Y#865/Z#866/A#867
    machineMove: (axis, ref) => [`G53 ${axis}${ref}`],      // G53 gated by config #395; dump safe-Z is M98 P101 — TO CONFIRM
    setWorkOffset: (wcsExpr, axis, value) => [`G90 G92 ${axis}${value}`],   // G92 zeroing (defprobe.nc); G10 not used
    readActiveWcs: (varName) => [`${varName}=#455`],        // #455/#516 select coord system
    distMode: (mode) => (mode === 'inc' ? 'G91' : 'G90'),
    dwell: (sec) => [`G04 P${sec}`],                        // P = SECONDS (probe.nc, slib.nc G82 P#9)
    endProgram: () => ['M30'],                              // m30.nc empty → controller default
    ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${OP[op] || op}${rhs} GOTO${label}`],   // word ops; see notes re !=
    goto: (label) => [`GOTO${label}`],
    label: (n) => [`N${n}`],
    spindle: (dir, rpm) => [`${dir === 'ccw' ? 'M4' : 'M3'} S${rpm}`],
    spindleOff: () => ['M5'],
    coolant: (on) => [on ? 'M8' : 'M9'],
    hmiPrompt: () => [],   // no scripted operator prompt (pause hook = a Z-lift only)
    hmiToast: () => [],
    hmiInput: () => [],

    notes: 'STRUCTURALLY different: move-until-input probing (M101/G01/M102, no G31), #864-866 DRO, G92 WCS, dwell in '
        + 'SECONDS, WORD IF operators (EQ/LT/GT — `!=`/`NE` NOT in the dump; mapped to NE best-effort, verify before use). '
        + 'machineMove G53 gated by config #395 (dump safe-Z = M98 P101 subprogram) — TO CONFIRM. HMI absent. '
        + 'Verified vs bridge/controllers/dm500/install.',
};
