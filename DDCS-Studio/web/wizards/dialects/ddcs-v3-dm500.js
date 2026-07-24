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
    vars: { dro: 864, probeStatus: null, probeTrig: 864, wcsBase: 804, wcsStride: 4, activeWcs: 455, toolTable: 1430, atc: null, ax: AX },   // atc null: no confirmed tool-changer firmware model on the DM500
    caps: { vars: true, flow: 'goto', probeStatusCheck: false, hmi: false, toolTable: true, probePort: false, atc: false,
        wcsAuto: false, wcsFixed: false, wcsSync: false },   // t479 — WCS via G92 (grounded, defprobe.nc): active-frame-driven, WCS-agnostic → the number is GATED; auto M350-only; no slave-sync

    // move-until-input: arm (M101) → feed move → disarm (M102). probe.nc:23-25.
    probeMove: (axis, dist, { feed = 100 } = {}) => ['M101', `G91 G01 ${axis}${dist} F${feed}`, 'M102'],
    probeStatus: () => [],                                   // implicit — motion halts on input; no status var
    probeRead: (axis, varName) => [`${varName}=#${864 + AX[axis]}`],    // capture machine DRO at contact (probe.nc:4-6)
    probeTrigVar: (axis) => `#${864 + AX[axis]}`,   // trigger register per axis — DRO at contact #864/#865/#866 (no #1925 here)
    // t638 — DECLARED probe-miss scratch register. DM500 move-until-input has NO status var + does NOT alarm on no-input (the
    // G01 completes to full travel), so a MISS is caught by a POST-PROBE DRO COMPARE (probe.nc grounds #864-866 as the DRO).
    // #190 is verified FREE — outside Studio's #1-74/#101/#102/#578 AND the DM500 firmware macro locals (executable macros write
    // #1-33/#104-108/#402-404) — a general-purpose macro var, not a system reg.
    missScratch: '#190',
    // t1085 — the low macro vars THIS POST injects: the miss scratch #190 (above) and the work-frame clearance #17 its
    // safeRetract degrade reads (:41,:45). Aggregated by data/universalScratch.js.
    scratch: [[17, 17], [190, 190]],
    readMachine: (axis, varName) => [`${varName}=#${864 + AX[axis]}`],  // DRO X#864/Y#865/Z#866/A#867
    machineMove: (axis, ref) => [`G53 ${axis}${ref}`],      // G53 gated by config #395; dump safe-Z is M98 P101 — TO CONFIRM
    // safeRetract (t822) — CONSERVATIVE degrade. Direct G53 is NOT dump-grounded on DM500 (no factory macro LINE emits
    // G53; machine frame is reached only via M98 P100/P101 subprograms, and #395 is a setting NAME not usage). So DEGRADE
    // to an ABSOLUTE WORK-FRAME clearance (G90 G0 Z<safe-Z>) — an absolute move KILLS the compounding crash vector even
    // without G53 — plus an honest comment. DM500-direct-G53-confirm is on the user-gated list (do NOT ride M98 P101: a
    // factory park may move XY, and a mid-program behavior change is worse than an honest work-frame retract).
    safeRetract: function ({ workClear = '#17' } = {}) {
        // The degrade is an ABSOLUTE work-frame clearance (no G53) — already mode-safe, self-asserting G90. t856 leaves it
        // untouched: wrapMachineFrame(saferetract.js) sees the G90 already present (hasAbs) and does NOT double it; in a G91
        // body it only appends the G91 restore after.
        return ['( Safe-Z retract - machine G53 not grounded on DM500; absolute work-frame clearance )', this.distMode('abs'), `G0 Z${workClear}`];
    },
    // DM500 macros zero with G92 (defprobe.nc:21) — value is a WORK coord (plate thickness), NOT a machine coord
    // like Expert's register write. t644 (F4 datum fix): `value` is the MACHINE coord that should become work-0 (what Expert
    // writes to its offset register); G92 takes a WORK value for the CURRENT position, so emit `[#dro - value]` (the offset
    // lands = value → the touched face reads work-0; the live DRO #dro=#864+ax cancels out). Grounded in defprobe.nc's G92-at-contact.
    setWorkOffset: (wcsExpr, axis, value) => [`G90 G92 ${axis}[#${864 + AX[axis]}-${value}]`],
    // WCS ZERO-AT-CURRENT (t479) — TRANSCRIBED from DM500's OWN dump form: set the current position as datum via G92,
    // GROUNDED in defprobe.nc (`G90 G92 X#2000/2+#2001` &c. — the datum-set is G92). For a NO-PROBE zero-at-current the
    // offset is 0 → `G90 G92 <axes>0`. NOT #804 (that register is DECLARED but NO dump WRITES it — register-name ≠
    // macro-usage; we don't ship a guessed register). The #400-series in probe.nc (#402=#400 · #403=1 auto-set-coord flag ·
    // #404=-#870) is a PROBE-COUPLED auto-datum (it precedes the `G91G01Z#575` probe move; the datum is set ON TOUCH) — a
    // DIFFERENT, probed flow, so it is NOT part of this no-probe zero-at-current. G92 is ACTIVE-frame-driven (WCS-agnostic)
    // → the WCS number is gated off (wcsFixed false). ⚠ VERIFY on hardware.
    wcsZeroAtCurrent: (p = {}) => {
        const axes = [p.axisX && 'X', p.axisY && 'Y', p.axisZ && 'Z'].filter(Boolean);
        if (!axes.length) return ['( WCS zero: no axes selected )'];
        return ['( WCS zero at current - DM500 G92 datum - VERIFY on hardware )', `G90 G92 ${axes.map((a) => a + '0').join(' ')}`];
    },
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
        if ((m = line.match(/^G90 G92 ([XYZA])(.+)$/))) {
            const wr = m[2].match(new RegExp('^\\[#' + (864 + AX[m[1]]) + '-(.+)\\]$'));   // t644 — strip the [#dro-value] datum wrapper so value round-trips
            return { type: 'setworkoffset', params: { wcs: '#578', axis: m[1], value: wr ? wr[1] : m[2] } };
        }
        if ((m = line.match(/^(#\d+)=#(\d+)$/))) { const ax = +m[2] - 864; if (ax >= 0 && ax <= 3) return { type: 'proberead', params: { axis: AXR[ax], var: m[1] } }; }
        return null;
    },

    notes: 'STRUCTURALLY different: move-until-input probing (M101/G01/M102, no G31), #864-866 DRO, G92 WCS, dwell in '
        + 'SECONDS, WORD IF operators (EQ/LT/GT — `!=`/`NE` NOT in the dump; mapped to NE best-effort, verify before use). '
        + 'machineMove G53 gated by config #395 (dump safe-Z = M98 P101 subprogram) — TO CONFIRM. HMI absent. '
        + 'Verified vs bridge/controllers/dm500/install.',
};
