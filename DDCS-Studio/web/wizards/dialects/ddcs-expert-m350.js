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

    // recognize(line): the PARSE INVERSE of the dialect-specific emit above (the rest is decoded by the shared
    // core parser). Returns { type, params } or null. Probe/status/DRO reads are syntactically just `#x=#sys`
    // / `IF #status!=2 GOTO` — distinguished ONLY by this controller's magic var numbers (vars above), so these
    // must be tried before the generic assign/ifgoto. Mirrors the verified emit forms 1:1 (round-trips).
    recognize(line) {
        const AXR = ['X', 'Y', 'Z', 'A'];
        const nos = (s) => (/[#[]/.test(s) ? s : (Number.isFinite(Number(s)) ? Number(s) : s));   // number, else #var/[expr]
        let m;
        // probe cycle: G31 <axis><to> F<feed> P<port> L<level> Q1  (before the core G31/move-probe)
        if ((m = line.match(/^G31 ([XYZA])(\S+) F(\S+) P(\S+) L(\d+) Q1$/))) return { type: 'probe', params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]), port: nos(m[4]), level: +m[5] } };
        // probe-trigger check: IF #1920+ax != 2 GOTO n  (probeStatus) — before the generic ifgoto
        if ((m = line.match(/^IF #(\d+)!=2 GOTO(\d+)$/))) {
            const ax = +m[1] - 1920; if (ax >= 0 && ax <= 3) return { type: 'probecheck', params: { axis: AXR[ax], goto: +m[2] } };
        }
        if ((m = line.match(/^IF (.+?)(==|!=|<=|>=|<|>)(.+?) GOTO(\d+)$/))) return { type: 'ifgoto', params: { lhs: m[1], op: m[2], rhs: m[3], goto: +m[4] } };
        if ((m = line.match(/^GOTO(\d+)$/))) return { type: 'goto', params: { n: +m[1] } };
        if ((m = line.match(/^N(\d+)$/))) return { type: 'label', params: { n: +m[1] } };
        // set WCS offset: indirect #[805+[wcs-1]*5+ax]=value
        if ((m = line.match(/^#\[805\+\[(.+?)-1\]\*5\+(\d+)\]=(.+)$/))) { const ax = +m[2]; if (ax >= 0 && ax <= 3) return { type: 'setworkoffset', params: { wcs: m[1], axis: AXR[ax], value: m[3] } }; }
        // HMI: message (#1505=-5000(text)) / ask-number (#2070=<var>(prompt)) — before the generic #x=#sys reads
        if ((m = line.match(/^#1505=-5000\((.*)\)$/))) return { type: 'message', params: { text: m[1] } };
        if ((m = line.match(/^#2070=([^(]+)\((.*)\)$/))) return { type: 'asknumber', params: { var: '#' + m[1].trim(), prompt: m[2] } };
        // probe trigger-position read (#var=#1925+ax) / machine-DRO read (#var=#880+ax) — before generic assign
        if ((m = line.match(/^(#\d+)=#(\d+)$/))) {
            const sys = +m[2];
            let ax = sys - 1925; if (ax >= 0 && ax <= 3) return { type: 'proberead', params: { axis: AXR[ax], var: m[1] } };
            ax = sys - 880; if (ax >= 0 && ax <= 3) return { type: 'readmachine', params: { axis: AXR[ax], var: m[1] } };
        }
        return null;
    },

    notes: 'In-program Macro-B-INSPIRED dialect (real Fanuc Macro B does NOT run on M350). G53 needs a #var '
        + '(no literal, no G0). WCS via direct #[805+] indirect write, stride 5 (G10 L20 also works on this firmware '
        + 'but house style is the indirect write). Dwell P=ms. WHILE/DO/END also exist (word ops, bracketed). '
        + 'Verified vs bridge/controllers/expert-m350 — appcode/snippets.nc, SYSDISK/slib-*.nc, CNCDISK captures.',
};
