/**
 * wizards/dialects/grbl.js — standard grbl 1.1 (streamed, host owns the logic).
 *
 * grbl is NOT a macro controller: per bridge/controllers/grbl/FINDINGS.md it has NO `#variables`, NO
 * `IF/GOTO/WHILE`, NO `M98/M99` subroutines, NO canned cycles. Logic lives in the HOST that streams G-code and
 * reads `[PRB:…]` / status reports. So grbl is a CUTTING target here: the geometry wizards (surfacing/pocket/
 * slot/drill/text) emit clean, runnable grbl; the probe/ATC wizards' on-controller flow can't run on grbl
 * (their IF/GOTO/var forms fold to nothing — probing is a host state machine: stream G38.2, read [PRB:…], G10 L20).
 *
 * Supported set (grbl 1.1, FINDINGS.md): G0-3, G4 P<sec>, G17-19, G20/21, G54-59, G53, G90/91, G91.1, G38.2-5,
 * G43.1/G49, G10 L2/L20; M0 M1 M2 M30 M3 M4 M5 M7 M8 M9. `g53NeedsVar:false` → G53 takes a literal (cuttingBlocks).
 * grblHAL (with SD O-word flow) is the `rs274ngc` post instead; this is plain grbl.
 */
const AX = { X: 0, Y: 1, Z: 2, A: 3 };

export const dialect = {
    id: 'grbl', name: 'grbl 1.1',
    programModel: 'streamed', probeModel: 'g38', dwellUnits: 's',
    g53NeedsVar: false,   // grbl G53 takes a literal coord directly (no #var staging — grbl has no #vars)
    vars: { dro: null, probeStatus: null, probeTrig: null, wcsBase: null, wcsStride: null, activeWcs: null, toolTable: null, ax: AX },
    caps: { vars: false, flow: 'none', probeStatusCheck: false, hmi: false, toolTable: false, probePort: false,
        wcsAuto: false, wcsFixed: true, wcsSync: false },   // t475 — WCS via G10 L20 P<n>; auto gated (no active-WCS var); no slave-sync (host-streamed — a WCS macro is best-effort)

    probeMove: (axis, dist, { feed = 100 } = {}) => [`G38.2 ${axis}${dist} F${feed}`],   // result pushed as [PRB:…] over serial
    probeStatus: () => [],          // [] — no in-program status var (host reads [PRB:…:1/0])
    probeRead: () => [],            // [] — no #vars; host captures the probe report
    readMachine: () => [],          // [] — no #vars; host reads the status report (<…|MPos:…>)
    machineMove: (axis, ref) => [`G53 G0 ${axis}${ref}`],   // machine-frame rapid (literal coord; G90 + G0 on the block)
    setWorkOffset: (wcsExpr, axis, value) => [`G10 L20 P${wcsExpr} ${axis}${value}`],   // grbl 1.1 supports G10 L2/L20
    // WCS ZERO-AT-CURRENT (t475) — G10 L20 P<n> <axes>0 (grbl 1.1). BEST-EFFORT + FLAG: grbl is HOST-STREAMED (caps.vars
    // false, readMachine []) — the host normally sends G10 L20 LIVE, so a WCS-zero MACRO may be a non-goal (a broader
    // porting question). Auto is GATED off (no active-WCS var); sync M350-only (gated). Emitting the correct inline G10 anyway.
    wcsZeroAtCurrent: (p = {}) => {
        const axes = [p.axisX && 'X', p.axisY && 'Y', p.axisZ && 'Z'].filter(Boolean);
        if (!axes.length) return ['( WCS zero: no axes selected )'];
        const n = String(p.sys) === '0' ? 0 : (parseInt(p.sys, 10) - 53);   // resolveParams coerces '0'→0 → normalize
        return ['( WCS zero at current - G10 L20 )', `G10 L20 P${n} ${axes.map((a) => a + '0').join(' ')}`];
    },
    readActiveWcs: () => [],        // [] — no #vars
    distMode: (mode) => (mode === 'inc' ? 'G91' : 'G90'),
    dwell: (sec) => [`G4 P${sec}`], // P = seconds
    endProgram: () => ['M30'],      // grbl supports M2 / M30
    ifGoto: () => [],               // [] — no flow control in the part program (host state machine)
    goto: () => [],                 // [] — none
    label: () => [],                // [] — none
    spindle: (dir, rpm) => [`${dir === 'ccw' ? 'M4' : 'M3'} S${rpm}`],
    spindleOff: () => ['M5'],
    coolant: (on) => [on ? 'M8' : 'M9'],   // flood M8 / off M9 (mist M7 also supported)
    hmiPrompt: () => [],            // [] — no blocking prompt (host UI)
    hmiToast: (msg) => [`(${msg})`],   // grbl ignores ( ) comments; host may surface them
    hmiInput: () => [],

    // recognize(line): grbl-specific emit is just probe / WCS / message (no #var or flow lines to fold back).
    recognize(line) {
        const nos = (s) => (Number.isFinite(Number(s)) ? Number(s) : s);
        let m;
        if ((m = line.match(/^G38\.2 ([XYZA])(\S+) F(\S+)$/))) return { type: 'probe', params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]) } };
        if ((m = line.match(/^G10 L20 P(\S+) ([XYZA])(.+)$/))) return { type: 'setworkoffset', params: { wcs: nos(m[1]), axis: m[2], value: m[3] } };
        if ((m = line.match(/^\((MSG,)?(.*)\)$/))) return { type: 'message', params: { text: m[2] } };
        return null;
    },

    notes: 'Standard grbl 1.1 — streamed, host owns the logic. NO #vars / IF-GOTO / WHILE / subroutines / canned '
        + 'cycles (FINDINGS.md). A CUTTING target: geometry wizards emit clean grbl; probe/ATC on-controller flow '
        + 'folds to nothing (probing is host-side: stream G38.2, read [PRB:…], issue G10 L20). G53 takes a literal '
        + '(g53NeedsVar:false). grblHAL SD O-word flow = the rs274ngc post instead. Verified vs bridge/controllers/grbl.',
};
