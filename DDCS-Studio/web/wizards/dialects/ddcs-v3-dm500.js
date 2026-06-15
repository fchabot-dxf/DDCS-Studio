/**
 * wizards/dialects/ddcs-v3-dm500.js — DDCS V3 / DM500 dialect.
 *
 * ✅ FORMS DUMP-CONFIRMED vs bridge/controllers/dm500/install/ (probe.nc + defprobe.nc, 2026-06-13): the probe
 * pair M101/G91 G01/M102, the #864-866 DRO read, the G90 G92 work-coord zero, and G04 P<seconds> dwell all match
 * the install macros verbatim. ⚠ NOT hardware-tested (we own no DM500) — only DDCS Expert M350 is hardware-testable
 * for us (see ddcs-expert-m350.js). The one form NOT in the dump is machineMove (G53): the stock macros retract via
 * M98 P101 / work-frame G90 G0, never G53 — so that line is best-effort, flagged TO CONFIRM below.
 *
 * STRUCTURALLY different from Expert: move-until-input probing (M101/G01/M102, NO G31), #864-866 DRO, G92 WCS,
 * dwell in SECONDS, WORD IF operators (EQ/LT/GT — no `!=`). Read from bridge/controllers/dm500/install/
 * (probe.nc, defprobe.nc, slib.nc — garbled comments ignored) + DDCS-Studio/web/data/default_vars_v3.js.
 */
const AX = { X: 0, Y: 1, Z: 2, A: 3 };
const OP = { '==': 'EQ', '!=': 'NE', '<': 'LT', '>': 'GT', '<=': 'LE', '>=': 'GE' };   // NE not actually in the dump — see notes

export const dialect = {
    id: 'ddcs-v3-dm500', name: 'DDCS V3 / DM500',
    programModel: 'inline', probeModel: 'move-until-input', dwellUnits: 's',
    vars: { dro: 864, probeStatus: null, probeTrig: 864, wcsBase: 804, wcsStride: 4, activeWcs: 455, toolTable: 1430, ax: AX },
    caps: { vars: true, flow: 'goto', probeStatusCheck: false, hmi: false, toolTable: true, probePort: false },   // M101/G01/M102 halts on the probe input

    // move-until-input: arm (M101) → feed move → disarm (M102). probe.nc:23-25.
    probeMove: (axis, dist, { feed = 100 } = {}) => ['M101', `G91 G01 ${axis}${dist} F${feed}`, 'M102'],
    probeStatus: () => [],                                   // implicit — motion halts on input; no status var
    probeRead: (axis, varName) => [`${varName}=#${864 + AX[axis]}`],    // capture machine DRO at contact (probe.nc:4-6)
    readMachine: (axis, varName) => [`${varName}=#${864 + AX[axis]}`],  // DRO X#864/Y#865/Z#866/A#867
    machineMove: (axis, ref) => [`G53 ${axis}${ref}`],      // G53 gated by config #395; dump safe-Z is M98 P101 — TO CONFIRM
    // DM500 macros zero with G92 (defprobe.nc:21) — value is a WORK coord (plate thickness), NOT a machine coord
    // like Expert's register write. Cross-profile value semantics unresolved → VERIFY on hardware.
    setWorkOffset: (wcsExpr, axis, value) => [`G90 G92 ${axis}${value}   ( set datum - VERIFY on hardware )`],
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

    // recognize(line): parse inverse of the DM500-specific emit (WORD IF ops, #864+ DRO, G92 WCS). The
    // move-until-input probe (M101 / G91 G01 … / M102) is a 3-line op the per-line parser can't fold back yet,
    // so its lines stay verbatim (raw) — lossless round-trip; proper decode needs parser look-ahead (TODO).
    recognize(line) {
        const AXR = ['X', 'Y', 'Z', 'A'];
        const OPI = { EQ: '==', NE: '!=', LT: '<', GT: '>', LE: '<=', GE: '>=' };
        let m;
        if (/^M10[12]$/.test(line) || /^G91 G01 [XYZA]\S* F\S+$/.test(line)) return { type: 'raw', params: { text: line } };   // probe triplet → verbatim
        if ((m = line.match(/^IF (.+?)(EQ|NE|LT|GT|LE|GE)(.+?) GOTO(\d+)$/))) return { type: 'ifgoto', params: { lhs: m[1], op: OPI[m[2]], rhs: m[3], goto: +m[4] } };
        if ((m = line.match(/^GOTO(\d+)$/))) return { type: 'goto', params: { n: +m[1] } };
        if ((m = line.match(/^N(\d+)$/))) return { type: 'label', params: { n: +m[1] } };
        if ((m = line.match(/^G90 G92 ([XYZA])(.+)$/))) return { type: 'setworkoffset', params: { wcs: '#578', axis: m[1], value: m[2] } };
        if ((m = line.match(/^(#\d+)=#(\d+)$/))) { const ax = +m[2] - 864; if (ax >= 0 && ax <= 3) return { type: 'proberead', params: { axis: AXR[ax], var: m[1] } }; }
        return null;
    },

    notes: 'STRUCTURALLY different: move-until-input probing (M101/G01/M102, no G31), #864-866 DRO, G92 WCS, dwell in '
        + 'SECONDS, WORD IF operators (EQ/LT/GT — `!=`/`NE` NOT in the dump; mapped to NE best-effort, verify before use). '
        + 'machineMove G53 gated by config #395 (dump safe-Z = M98 P101 subprogram) — TO CONFIRM. HMI absent. '
        + 'Verified vs bridge/controllers/dm500/install.',
};
