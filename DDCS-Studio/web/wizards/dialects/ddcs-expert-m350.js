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
    vars: { dro: 880, probeStatus: 1920, probeTrig: 1925, wcsBase: 805, wcsStride: 5, activeWcs: 578, toolTable: 1430,
        // ATC tool-changer firmware tables. currentTool/capacity/pockets live in SYSDISK/camsetting (#1000-1499,
        // slot = var-1000 — boundary-confirmed by the captured sentinels) so the gateway can READ them over SMB;
        // targetTool #1504 is a runtime var (M6 Txx). Param meanings from default_vars.js (#1300/#1330/#1350/#1370).
        atc: { currentTool: 1300, capacity: 1301, targetTool: 1504, pocketX: 1330, pocketY: 1350, pocketZ: 1370 }, ax: AX },
    caps: { vars: true, flow: 'goto', probeStatusCheck: true, hmi: true, toolTable: true, probePort: true, inputRead: true, atc: true },   // the fullest profile (inputRead = generic live-input poll #[1520+N], slib O10300; atc = full pick&place model)

    // G31 Z-10 F100 P3 L0 Q1   (snippets.nc:9 · words.nc:6 "G31 Z#7 F#3 P#5 L0 Q1")
    probeMove: (axis, dist, { feed = 100, port = 3, level = 0 } = {}) => [`G31 ${axis}${dist} F${feed} P${port} L${level} Q1`],
    // IF #1922!=2 GOTO1   (3D PROBE G55.nc:29 · snippets.nc:10). status block #1920+axis; "!=2" = did NOT trigger
    probeStatus: (axis, label) => [`IF #${1920 + AX[axis]}!=2 GOTO${label}`],
    // #50=#1927   (words.nc:12). trigger-position block #1925+axis
    probeRead: (axis, varName) => [`${varName}=#${1925 + AX[axis]}`],
    probeTrigVar: (axis) => `#${1925 + AX[axis]}`,   // the trigger register per axis (for an inline read, e.g. radius-comp) — #1925/#1926/#1927
    // #57=#882   (SAVE_WCS_XY_AUTO.nc:16). machine-DRO block #880+axis
    readMachine: (axis, varName) => [`${varName}=#${880 + AX[axis]}`],
    // probeGuard({stopVar, limitVar, limitVal}) — the G31 stop-mode / limit-protection preamble (#1905=0 stop, #1915=<v> limit
    // protect; 3D PROBE macros). Expert's G31 consumes them; posts whose probe form doesn't (V4.1's L#682 G31, DM500's
    // move-until-input) have NO probeGuard → the probeguard atom folds to []. Byte-identical to the old raw stop/limit assigns.
    probeGuard: (p = {}) => { const o = []; if (p.stopVar) o.push(`${p.stopVar}=0 ( Stop mode: decelerate )`); if (p.limitVar) o.push(`${p.limitVar}=${p.limitVal ?? ''} ( Limit protect )`); return o; },
    // G53 Z#99   (snippets.nc:4). NO G0 prefix; ref MUST be a #var on M350 (a literal fails)
    machineMove: (axis, ref) => [`G53 ${axis}${ref}`],
    // #[805+[idx-1]*5+ax]=value   (SAVE_WCS_XY_AUTO.nc:21-26). base 805, stride 5; X=base,Y=+1,Z=+2,A=+3
    setWorkOffset: (wcsExpr, axis, value) => [`#[805+[${wcsExpr}-1]*5+${AX[axis]}]=${value}`],
    // wcsBaseInto(wcs) — the WCS-table BASE-address compute into #70, the dump-grounded INDIRECT idiom shared by the probe
    // wizards (SAVE_WCS_XY_AUTO.nc: read #578 → base #70; a fixed G54..G59 uses the literal base). Non-Expert posts use G92
    // (no base) so their wcsbaseinto atom emits []. Byte-identical to corner/edge/middle's old literal base-compute.
    wcsBaseInto: (wcs, opts = {}) => {
        const bare = !!(opts && opts.bare);   // middle omits the annotation comments + the fixed-#70 note (same idiom, terser)
        if (wcs === 'active') {
            const rows = ['#71=#578 ( Active WCS index: 1=G54 2=G55 etc )', '#72=[#71-1] ( Zero-based index )', '#70=[805+[#72*5]] ( Base WCS address )'];
            return bare ? rows : ['( Read Active WCS )', ...rows];
        }
        const base = 805 + (parseInt(String(wcs).replace('G', ''), 10) - 54) * 5;
        return bare ? [`#70=${base}`] : [`( Target: ${wcs} )`, `#70=${base} ( Base WCS address )`];
    },
    // wcsWriteIndirect({offset, addrVar, value, note, addrNote}) — write `value` to the WCS slot #70+offset via the INDIRECT
    // form (SAVE_WCS_XY_AUTO.nc:21-26). offset 0 → the base itself `#[#70]=v`; offset>0 → compute the address into addrVar
    // (#73/#74) then `#[addrVar]=v`. Notes are paren-stripped like the assign/comp lines. This is the byte-exact partner of
    // wcsBaseInto — setWorkOffset's INLINE form can't reproduce it (same reason wcsZeroAtCurrent is dedicated; probe twins depend on it).
    wcsWriteIndirect: ({ offset, addrVar, value, note, addrNote, direct }) => {
        const n = (s) => String(s ?? '').replace(/[()]/g, '').trim();
        const wr = (tgt, v, nt) => (n(nt) ? `${tgt}=${v} ( ${n(nt)} )` : `${tgt}=${v}`);
        // DIRECT mode (edge/middle): write the nested address inline `#[#70+off]=v` (no #73 temp) — a distinct dump idiom.
        if (direct) return [wr(`#[#70+${Number(offset) || 0}]`, value, note)];
        if (!Number(offset)) return [wr('#[#70]', value, note)];
        return [wr(addrVar, `[#70+${offset}]`, addrNote), wr(`#[${addrVar}]`, value, note)];
    },
    // WCS ZERO-AT-CURRENT (t475) — zero the selected WCS axes = the current DRO. M350: DIRECT #805+ register writes (NO
    // G10). Dump-grounded: SAVE_WCS_XY_AUTO.nc / COPY_WCS.nc use the INTERMEDIATE-VAR indirect form (#N=805+[#..-1]*5 then
    // #[#N]), NOT setWorkOffset's inline form — so this is a dedicated atom (setWorkOffset can't reproduce it byte-identical,
    // and can't change: the probe twins depend on it). BYTE-IDENTICAL to the pre-restructure wcsStack (its own golden).
    wcsZeroAtCurrent: (p = {}) => {
        const sys = String(p.sys), slave = String(p.slave), auto = sys === '0', axes = [];   // resolveParams coerces '0'→0/'3'→3 → normalize
        if (p.axisX) axes.push(0); if (p.axisY) axes.push(1); if (p.axisZ) axes.push(2);
        const so = slave === '3' ? 3 : 4, sLabel = slave === '3' ? 'A' : 'B';
        const L = ['( WCS | Direct register writes )', '( M350 Ready - G10 not used )'];
        if (auto) {
            L.push('( Auto-detect active WCS from #578 )', '#150=#578', '#151=805+[#150-1]*5', '( Zero selected axes )');
            axes.forEach((o) => L.push(`#[#151+${o}]=#${880 + o}`));
            if (p.sync) L.push(`( Dual Gantry Sync - Slave ${sLabel} )`, `#152=[#151+${so}] ( Base WCS + Slave Offset )`, `#[#152]=#88${slave}`);
        } else {
            const base = 805 + (parseInt(sys, 10) - 54) * 5;
            L.push(`( Fixed WCS: G${sys} - Base address #${base} )`, '( Zero selected axes )');
            axes.forEach((o) => L.push(`#${base + o}=#${880 + o}`));
            if (p.sync) L.push(`( Dual Gantry Sync - Slave ${sLabel} )`, `#${base + so}=#88${slave}`);
        }
        return L;
    },
    // #578 = active WCS index 1=G54… (COPY_WCS.nc:15). ⚠️ STALE after an in-program G-word WCS switch: a
    // G54..G59 changes the modal frame but does NOT update #578 (CONFIRMED on machine 2026-06-19, DIAG_g53setup.nc).
    // So #578 reflects the panel/variable selector, not a mid-program G-word. Only read it when no in-program
    // G54..G59 has run since (our emitted stacks set WCS via this index, so they're consistent); don't trust it to
    // recover a frame the operator's own code switched with a bare G-word.
    readActiveWcs: (varName) => [`${varName}=#578`],
    distMode: (mode) => (mode === 'inc' ? 'G91' : 'G90'),
    dwell: (sec) => [`G04 P${Math.round(sec * 1000)}`],   // P is ALWAYS ms — integer-ms emit (on-machine 2026-06-23: G04 P3000 ≈ 3 s; G04 P3.0 = INSTANT, so a decimal P is NOT seconds, it truncates to ~ms. "decimal = seconds" is a myth here; G04 P1.0 ≈ 1 ms, not 1 s)
    endProgram: () => ['M30'],   // universal end; no M2/M02 in any capture
    ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${op}${rhs} GOTO${label}`],   // symbolic ops ==/!=/<=; GOTO no space
    goto: (label) => [`GOTO${label}`],
    label: (n) => [`N${n}`],
    // Wait until input N (0-based: pin 0 = IN01 = #1520) reaches level L (0/1): poll #[1520+N] in a
    // WHILE..DO1..END1 with a 10 ms dwell — the verbatim factory sensor-wait idiom (slib-m.nc O10300:
    // `WHILE [#[1520+#4-1] != #6] DO1 / G04 P10 / END1`). P = ms (slib-g.nc:691). No timeout: the poll waits indefinitely.
    waitInput: (n, level) => [`WHILE [#[1520+${n}] != ${level}] DO1   ( wait input ${n} = ${level} )`, 'G04 P10', 'END1'],
    spindle: (dir, rpm) => [`${dir === 'ccw' ? 'M4' : 'M3'} S${rpm}`],   // M3.nc / M4.nc
    spindleOff: () => ['M5'],
    coolant: (on) => [on ? 'M8' : 'M9'],   // flood M8 / off M9 (mist M7 not present in dump)
    hmiPrompt: (msg) => [`#1505=1(${msg})`],      // blocking OK/Cancel; ESC sets #1505=0
    hmiCancelVar: '#1505',                        // the prompt's cancel signal — ESC sets it to 0 (confirmBlock bails on it)
    hmiToast: (msg) => [`#1505=-5000(${msg})`],   // display-only banner
    hmiInput: (varName, prompt) => [`#2070=${String(varName).replace('#', '')}(${prompt})`],   // blocking numeric input
    // hmiLine — a bare #1505 note write in the WIZARD's spaced assign form `#1505=<v> ( <note> )` (v=1 prompt / -5000 banner /
    // 1 error). This is the corner-family probe-message form (byte-identical to its old `assign` block); posts WITHOUT scripted
    // HMI (V4.1/DM500/…) have no hmiLine, so the hmiline atom degrades it to a plain comment (the instruction survives, no #1505).
    hmiLine: (value, note) => { const n = String(note ?? '').replace(/[()]/g, '').trim(); return [n ? `#1505=${value} ( ${n} )` : `#1505=${value}`]; },

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
        // generic digital output toggle: M50/M52/… = on, M51/M53/… = off (slib O10050+, write #1552+; pins 0-20)
        if ((m = line.match(/^M0*(\d+)$/))) { const mc = +m[1]; if (mc >= 50 && mc <= 91) return { type: 'outpin', params: { pin: (mc - 50) >> 1, state: (mc - 50) % 2 === 0 ? 'on' : 'off' } }; }
        return null;
    },

    notes: 'In-program Macro-B-INSPIRED dialect (real Fanuc Macro B does NOT run on M350). G53 needs a #var '
        + '(no literal, no G0). WCS via direct #[805+] indirect write, stride 5. ⚠️ NEVER emit G10 L20/L2 with axis '
        + 'words: V1 on-machine (2026-06-19) proved G10 L20 P6 X25 writes NO offset and the X word executes as a '
        + 'G90/G01 MOVE (Mach X 5→73.286) — broken AND dangerous. Direct register write is the only safe WCS set. '
        + 'Dwell P=ms. WHILE/DO/END also exist (word ops, bracketed). '
        + 'Verified vs bridge/controllers/expert-m350 — appcode/snippets.nc, SYSDISK/slib-*.nc, CNCDISK captures.',
};
