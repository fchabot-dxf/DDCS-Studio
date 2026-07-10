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
    vars: { dro: 1500, wcsWork: 1506, probeStatus: null, probeTrig: 1500, wcsBase: 1512, wcsStride: 6, activeWcs: null, toolTable: 1560, atc: null, ax: AX },   // atc null: the #1300/#1330 ATC firmware tables are unmapped on V4.1 (the dump shows them as generic "system parameter area")
    caps: { vars: true, flow: 'goto', probeStatusCheck: false, hmi: false, toolTable: true, probePort: false, atc: false,
        wcsAuto: false, wcsFixed: false, wcsSync: false },   // t477 — WCS via #1506-1509 (ACTIVE work registers, no per-WCS index → number gated); no active-WCS var; no slave-sync

    // G91 G31 Z-1000 L#682 Q1 K0 F#106  (probe-float.nc, live). L#682 = probe-selector config param; no P-port word.
    probeMove: (axis, dist, { feed = 100 } = {}) => [`G31 ${axis}${dist} L#682 Q1 K0 F${feed}`],
    probeStatus: () => [],                                   // no status var — success read from post-probe DRO #1502 (probe-fix.nc)
    probeRead: (axis, varName) => [`${varName}=#${1500 + AX[axis]}`],   // post-probe machine pos #1500+ax (probe-fix.nc: #108=#1502)
    probeTrigVar: (axis) => `#${1500 + AX[axis]}`,   // trigger register per axis — post-probe machine pos #1500/#1501/#1502 (no #1925 here)
    // t638 — DECLARED probe-miss scratch register. V4.1 has NO probe status var, so a MISS is caught by a POST-PROBE DRO
    // COMPARE: probestart captures the pre-probe DRO here, probecheck tests whether the axis reached the full commanded travel
    // (= no contact). #190 is verified FREE — outside Studio's emitted #1-74/#101/#102/#578 AND the V4.1 firmware macro locals
    // (executable macros write #0-148 + #490-536; read #101-148) — a general-purpose macro var, not a system #1400+/#1500+ reg.
    missScratch: '#190',
    readMachine: (axis, varName) => [`${varName}=#${1500 + AX[axis]}`], // DRO X#1500/Y#1501/Z#1502/A#1503 (safez.nc)
    machineMove: (axis, ref) => [`G0 G53 ${axis}${ref}`],   // CONFIRMED live: probe-fix.nc "G0G53Z#102" (G0 + G53)
    // CONFIRMED live (probe-vertex.nc): zero at the probed point with G90 G92 <axis><WORK value> — a work coord,
    // NOT a machine coord like Expert's register write. ("zero here" macros zeroz/zeroxy write #1506-1509 directly.)
    setWorkOffset: (wcsExpr, axis, value) => [`G90 G92 ${axis}${value}`],
    // WCS ZERO-AT-CURRENT (t477) — write the active WORK registers to 0 (PERSISTENT), GROUNDED in V4.1's OWN macros:
    // zeroxy.nc = `#1506=0 #1507=0`, zeroall.nc adds `#1508=0 #1509=0` (X/Y/Z/A = #1506+off). NOT G92 (that's a temporary
    // offset). ACTIVE-WCS-ONLY: #1506-1509 are the active work registers, no per-WCS index (activeWcs is null) → the WCS
    // number + auto + sync are GATED off in the form (post-gating). A persistent, dump-grounded correctness fix.
    wcsZeroAtCurrent: (p = {}) => {
        const axes = [];
        if (p.axisX) axes.push(0); if (p.axisY) axes.push(1); if (p.axisZ) axes.push(2);
        if (!axes.length) return ['( WCS zero: no axes selected )'];
        return ['( WCS zero at current - V4.1 work registers )', ...axes.map((o) => `#${1506 + o}=0`)];
    },
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

    // recognize(line): parse inverse of the V4.1-specific emit (probe G31…L#682, tight IF…GOTO, G90 G92 WCS,
    // #1500+ DRO reads). No status/HMI vars here (those fold to nothing on V4.1). Probe-read and read-machine
    // share #1500+ax, so both decode to proberead (V4.1 conflates them) — byte-identical either way.
    recognize(line) {
        const AXR = ['X', 'Y', 'Z', 'A'];
        const nos = (s) => (/[#[]/.test(s) ? s : (Number.isFinite(Number(s)) ? Number(s) : s));
        let m;
        if ((m = line.match(/^G31 ([XYZA])(\S+) L#682 Q1 K0 F(\S+)$/))) return { type: 'probe', params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]) } };
        if ((m = line.match(/^IF (.+?)(==|!=|<=|>=|<|>)(.+?)GOTO(\d+)$/))) return { type: 'ifgoto', params: { lhs: m[1], op: m[2], rhs: m[3], goto: +m[4] } };
        if ((m = line.match(/^GOTO(\d+)$/))) return { type: 'goto', params: { n: +m[1] } };
        if ((m = line.match(/^N(\d+)$/))) return { type: 'label', params: { n: +m[1] } };
        if ((m = line.match(/^G90 G92 ([XYZA])(.+)$/))) return { type: 'setworkoffset', params: { wcs: '#578', axis: m[1], value: m[2] } };
        if ((m = line.match(/^(#\d+)=#(\d+)$/))) { const ax = +m[2] - 1500; if (ax >= 0 && ax <= 3) return { type: 'proberead', params: { axis: AXR[ax], var: m[1] } }; }
        return null;
    },

    notes: '≈Expert FORM, vars at #1500+ (DRO #1500-1503, workpiece #1506-1509, WCS base #1512 stride 6). Zero via '
        + 'G92 with a WORK coord (or direct #1506-1509 write), NOT the indirect #[805+] write. No probe status var '
        + '(result = post-probe DRO #1502). Machine move = G0 G53. ifGoto has NO space before GOTO. HMI via '
        + 'MarcoDialog *.rc — TO CONFIRM. CONFIRMED live on \\\\10.0.0.50\\SYSDISK (2026-06-13).',
};
