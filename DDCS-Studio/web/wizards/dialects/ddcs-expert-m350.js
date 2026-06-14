/**
 * wizards/dialects/ddcs-expert-m350.js — DDCS Expert M350 dialect (the REFERENCE ANCHOR).
 *
 * Every form below is verified against the captured dump under bridge/controllers/expert-m350/
 * (tools/appcode/{words,snippets}.nc + assets/capture/.../SYSDISK/slib-*.nc + CNCDISK/*.nc). See SCHEMA.md
 * for the contract; other dialects mirror this exact shape. file:line citations inline where non-obvious.
 */
const AX = { X: 0, Y: 1, Z: 2, A: 3 };

export const dialect = {
    id: 'ddcs-expert-m350', name: 'DDCS Expert M350',
    programModel: 'inline', probeModel: 'g31', dwellUnits: 'ms',
    vars: { dro: 880, probeStatus: 1920, probeTrig: 1925, wcsBase: 805, wcsStride: 5, activeWcs: 578, toolTable: 1430, ax: AX },

    // G31 Z-10 F100 P3 L0 Q1   (snippets.nc:9 · words.nc:6 "G31 Z#7 F#3 P#5 L0 Q1")
    probeMove: (axis, dist, { feed = 100, port = 3, level = 0 } = {}) => [`G31 ${axis}${dist} F${feed} P${port} L${level} Q1`],
    // IF #1922!=2 GOTO1   (3D PROBE G55.nc:29 · snippets.nc:10). status block #1920+axis; "!=2" = did NOT trigger
    probeStatus: (axis, label) => [`IF #${1920 + AX[axis]}!=2 GOTO${label}`],
    // #50=#1927   (words.nc:12). trigger-position block #1925+axis
    probeRead: (axis, varName) => [`${varName}=#${1925 + AX[axis]}`],
    // #57=#882   (SAVE_WCS_XY_AUTO.nc:16). machine-DRO block #880+axis
    readMachine: (axis, varName) => [`${varName}=#${880 + AX[axis]}`],
    // G53 Z#99   (snippets.nc:4). NO G0 prefix; ref MUST be a #var on M350 (a literal fails)
    machineMove: (axis, ref) => [`G53 ${axis}${ref}`],
    // #[805+[idx-1]*5+ax]=value   (SAVE_WCS_XY_AUTO.nc:21-26). base 805, stride 5; X=base,Y=+1,Z=+2,A=+3
    setWorkOffset: (wcsExpr, axis, value) => [`#[805+[${wcsExpr}-1]*5+${AX[axis]}]=${value}`],
    readActiveWcs: (varName) => [`${varName}=#578`],   // #578 = active WCS index 1=G54… (COPY_WCS.nc:15)
    distMode: (mode) => (mode === 'inc' ? 'G91' : 'G90'),
    dwell: (sec) => [`G04 P${Math.round(sec * 1000)}`],   // P = ms (slib-g.nc:691 "G04 P100 //100ms")
    endProgram: () => ['M30'],   // universal end; no M2/M02 in any capture
    ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${op}${rhs} GOTO${label}`],   // symbolic ops ==/!=/<=; GOTO no space
    goto: (label) => [`GOTO${label}`],
    label: (n) => [`N${n}`],
    spindle: (dir, rpm) => [`${dir === 'ccw' ? 'M4' : 'M3'} S${rpm}`],   // M3.nc / M4.nc
    spindleOff: () => ['M5'],
    coolant: (on) => [on ? 'M8' : 'M9'],   // flood M8 / off M9 (mist M7 not present in dump)
    hmiPrompt: (msg) => [`#1505=1(${msg})`],      // blocking OK/Cancel; ESC sets #1505=0
    hmiToast: (msg) => [`#1505=-5000(${msg})`],   // display-only banner
    hmiInput: (varName, prompt) => [`#2070=${String(varName).replace('#', '')}(${prompt})`],   // blocking numeric input

    notes: 'In-program Macro-B-INSPIRED dialect (real Fanuc Macro B does NOT run on M350). G53 needs a #var '
        + '(no literal, no G0). WCS via direct #[805+] indirect write, stride 5 (G10 L20 also works on this firmware '
        + 'but house style is the indirect write). Dwell P=ms. WHILE/DO/END also exist (word ops, bracketed). '
        + 'Verified vs bridge/controllers/expert-m350 — appcode/snippets.nc, SYSDISK/slib-*.nc, CNCDISK captures.',
};
