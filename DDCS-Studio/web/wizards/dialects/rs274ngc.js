/**
 * wizards/dialects/rs274ngc.js — RS274NGC family: grblHAL + LinuxCNC (ONE binding covers both).
 *
 * The closest of any target to DDCS's own idiom (in-program #vars + flow + a probe + trigger params), and
 * free/open ⇒ the best distribution target (MACHINE-PRIMITIVES-MAP.md §8). grblHAL literally COPIED LinuxCNC:
 * its #5061 param is tagged `// LinuxCNC` in ngc_params.c, so one dialect is real shared code (not a lookalike).
 * Mirrors the ddcs-expert-m350.js anchor shape. Verified against:
 *   bridge/controllers/grbl/assets/grblHAL-core-src/  (ngc_params.c, ngc_flowctrl.c, ngc_expr.c, gcode.c)
 *   bridge/controllers/linuxcnc/assets/linuxcnc-src/nc_files/  (gridprobe.ngc, macros/lathe/probe-hole.ngc)
 * file:line citations inline. THE KEY STRUCTURAL DIFFERENCE: flow is STRUCTURED O-WORDS, not IF…GOTO (see notes).
 */
import { stripCommentParens } from '../ops/comment.js';   // t2291 (BACKLOG #22) — hmiToast's msg is user-typed operator-message text; ONE declared "safe inside ( )" rule, not a hand-rolled one here

const AX = { X: 0, Y: 1, Z: 2, A: 3 };

// GOTO-to-label SKIPS the guarded body; the equivalent O-word `if` RUNS its body — so ifGoto maps to an
// `o<n> if` opened under the NEGATED condition, closed by label()'s `o<n> endif`. Words per ngc_expr.c:122.
const NEG = { '==': 'ne', '!=': 'eq', '<': 'ge', '>': 'le', '<=': 'gt', '>=': 'lt' };

export const dialect = {
    id: 'rs274ngc', name: 'RS274NGC (LinuxCNC)',   // grblHAL shares these forms but is its own post (grblhal.js)
    programModel: 'inline', probeModel: 'g38', dwellUnits: 's',
    // All confirmed in grblHAL ngc_params.c (each tagged `// LinuxCNC`): probeTrig #5061-69 (:301),
    // probeStatus #5070 (:302), activeWcs #5220 (:308), wcsBase #5221 stride 20 (:309 + :258 "/20"),
    // dro #5420-28 current-position (:321), toolTable #5401-09 active-tool offsets (:320-321, #5400=tool# :319).
    vars: { dro: 5420, probeStatus: 5070, probeTrig: 5061, wcsBase: 5221, wcsStride: 20, activeWcs: 5220, toolTable: 5401, ax: AX },
    caps: { vars: true, flow: 'oword', probeStatusCheck: false, hmi: false, toolTable: true, probePort: false,
        helicalArc: true,   // t1472 — SPEC-attested, not inferred: RS274/NGC defines helical motion as G2/G3 with the axis perpendicular to the selected plane
        wcsAuto: false, wcsFixed: true, wcsSync: false },   // t475 — WCS via G10 L20 P<n> (fixed WCS targetable); auto gated (M350-only ruling); no slave-sync

    // G38.2 Z-10 F100  (probe-hole.ngc:22 "G91 G38.2 X#1000"; gridprobe.ngc:35 "G38.2Z#8"). G38.2 ALARMs on
    // no-contact (host/controller catches) ⇒ probeStatus folds away, like Centroid's M115. `port`/`level` unused.
    probeMove: (axis, dist, { feed = 100 } = {}) => [`G38.2 ${axis}${dist} F${feed}`],
    probeStatus: () => [],   // [] — G38.2 alarms on no-contact; success param #5070 exists but no in-program GOTO branch
    // #50=#5061  (probe-hole.ngc:19 "#1001=#5061", :31 "#1005=#5062"). Trigger-position block #5061+axis (ngc_params.c:301)
    probeRead: (axis, varName) => [`${varName}=#${5061 + AX[axis]}`],
    probeTrigVar: (axis) => `#${5061 + AX[axis]}`,   // trigger register per axis — #5061-5069 (ngc_params.c:301)
    // #50=#5420  (ngc_params.c:321 work_position #5420-28). Current position in the active frame.
    readMachine: (axis, varName) => [`${varName}=#${5420 + AX[axis]}`],
    machineMove: (axis, ref) => [`G53 G0 ${axis}${ref}`],   // machine-frame rapid; ref may be a literal or #var (gcode.c:65 G53 non-modal)
    // G10 L20 P1 X<val>  (sets WCS P so current pos = val). wcsExpr = active-WCS index 1..9. Standard RS274NGC
    // (LinuxCNC §G10; grblHAL gcode.c G10 modal :74). The clean DDCS-#[805+] equivalent.
    setWorkOffset: (wcsExpr, axis, value) => [`G10 L20 P${wcsExpr} ${axis}${value}`],
    // WCS ZERO-AT-CURRENT (t475) — G10 L20 P<n> <axes>0 sets WCS n so the CURRENT position reads 0 (no DRO read; the
    // controller computes the offset). Standard RS274NGC (LinuxCNC §G10). Fixed WCS → P1-6; auto is GATED off (post-gating,
    // M350-only per the ruling) — P0 (the active WCS) is the fallback. sync is M350-only (gated). A CORRECTNESS fix vs the old M350-hardcoded #805.
    wcsZeroAtCurrent: (p = {}) => {
        const axes = [p.axisX && 'X', p.axisY && 'Y', p.axisZ && 'Z'].filter(Boolean);
        if (!axes.length) return ['( WCS zero: no axes selected )'];
        const n = String(p.sys) === '0' ? 0 : (parseInt(p.sys, 10) - 53);   // resolveParams coerces '0'→0 → normalize
        return ['( WCS zero at current - G10 L20 )', `G10 L20 P${n} ${axes.map((a) => a + '0').join(' ')}`];
    },
    readActiveWcs: (varName) => [`${varName}=#5220`],   // #5220 = active coord-system number 1=G54… (ngc_params.c:308)
    distMode: (mode) => (mode === 'inc' ? 'G91' : 'G90'),
    dwell: (sec) => [`G4 P${sec}`],   // P = SECONDS in RS274NGC (gridprobe/LinuxCNC dwell)
    endProgram: () => ['M30'],        // M30 (M2 also ends; .ngc files use M2, e.g. gridprobe.ngc:45)
    // FLOW IS STRUCTURED O-WORDS, NOT GOTO (grblHAL ngc_flowctrl.c:45-56 If/ElseIf/Else/EndIf/While/EndWhile/Sub).
    // ifGoto/label render a skip-block: `o<n> if [cond-negated]` … `o<n> endif`. goto() has no clean 1-line form.
    ifGoto: (lhs, op, rhs, label) => [`o${label} if [${lhs} ${NEG[op]} ${rhs}]`],
    goto: () => [],                   // [] — an unconditional GOTO has no single-line O-word equivalent (restructure: else/endif or M2)
    label: (n) => [`o${n} endif`],    // closes the o<n> if-block opened by the matching ifGoto
    spindle: (dir, rpm) => [`${dir === 'ccw' ? 'M4' : 'M3'} S${rpm}`],
    spindleOff: () => ['M5'],
    coolant: (on) => [on ? 'M8' : 'M9'],   // flood M8 / off M9 (mist M7 also standard)
    hmiPrompt: (msg) => [`(MSG,${msg})`, 'M0'],   // operator confirm = on-screen message + M0 program pause (resume on Cycle Start); no cancel signal
    hmiToast: (msg) => [`(MSG,${stripCommentParens(msg)})`],   // operator-message comment (probe-hole.ngc:84 uses (debug,…)). t2291 (BACKLOG #22) — msg is user-typed operator-message text; a `)` in it would close the comment early
    hmiInput: () => [],    // [] — no blocking numeric input in stream mode

    // recognize(line): parse inverse of the RS274NGC-specific emit. Flow is STRUCTURED O-WORDS: ifGoto emits
    // `o<n> if [cond NEGATED]` and label emits `o<n> endif`, so the inverse un-negates the word operator (INV).
    // Probe = G38.2; WCS = G10 L20; message = (MSG,…) — which looks like a comment, hence recognize runs first.
    recognize(line) {
        const AXR = ['X', 'Y', 'Z', 'A'];
        const nos = (s) => (/[#[]/.test(s) ? s : (Number.isFinite(Number(s)) ? Number(s) : s));
        const INV = { ne: '==', eq: '!=', ge: '<', le: '>', gt: '<=', lt: '>=' };   // inverse of NEG above
        let m;
        if ((m = line.match(/^G38\.2 ([XYZA])(\S+) F(\S+)$/))) return { type: 'probe', params: { axis: m[1], to: nos(m[2]), feed: nos(m[3]) } };
        if ((m = line.match(/^o(\d+) if \[(.+?) (eq|ne|lt|gt|le|ge) (.+?)\]$/))) return { type: 'ifgoto', params: { lhs: m[2], op: INV[m[3]], rhs: m[4], goto: +m[1] } };
        if ((m = line.match(/^o(\d+) endif$/))) return { type: 'label', params: { n: +m[1] } };
        if ((m = line.match(/^G10 L20 P(\S+) ([XYZA])(.+)$/))) return { type: 'setworkoffset', params: { wcs: nos(m[1]), axis: m[2], value: m[3] } };
        if ((m = line.match(/^\(MSG,(.*)\)$/))) return { type: 'message', params: { text: m[1] } };
        if ((m = line.match(/^(#\d+)=#(\d+)$/))) {
            const sys = +m[2];
            let ax = sys - 5061; if (ax >= 0 && ax <= 3) return { type: 'proberead', params: { axis: AXR[ax], var: m[1] } };
            ax = sys - 5420; if (ax >= 0 && ax <= 3) return { type: 'readmachine', params: { axis: AXR[ax], var: m[1] } };
        }
        return null;
    },

    notes: 'RS274NGC family — grblHAL + LinuxCNC under ONE binding (grblHAL copied LinuxCNC: #5061 is tagged '
        + '"// LinuxCNC" in ngc_params.c). Cleanest ~1:1 with DDCS concepts and free/open ⇒ best distribution target. '
        + 'THE KEY DIFFERENCE: flow is STRUCTURED O-WORDS (o<n> if/elseif/else/endif, while/endwhile, sub/endsub/call) '
        + 'with WORD operators (eq ne lt gt le ge, ngc_expr.c:122) — NOT IF…GOTO. So ifGoto/label here render a '
        + 'skip-block (ifGoto → "o<n> if [neg-cond]", label → "o<n> endif"); this models the common forward-skip '
        + 'idiom only — back-jump loops must be authored as o<n> while, and goto() returns [] (no 1-line equivalent). '
        + 'A fully general RS274NGC port wants a structured-flow emitter, not the GOTO line-emitter (cf. SCHEMA note on '
        + 'script dialects). Probing: G38.2 ALARMs on no-contact ⇒ probeStatus folds to [] (like Centroid). WCS via '
        + 'G10 L20 (the clean DDCS-#[805+] equivalent). Dwell P = seconds. No blocking HMI in stream mode ⇒ '
        + 'hmiPrompt/hmiInput [] , hmiToast → (MSG,…). Caveat: grblHAL full O-word flow runs only for macros on '
        + 'SD/littlefs (stream mode limited); LinuxCNC has no such limit. Digital I/O (M62-65 / M66) is out of the '
        + 'SCHEMA core surface but available. Verified vs grblHAL-core-src (ngc_params/flowctrl/expr/gcode.c) + '
        + 'linuxcnc nc_files (gridprobe.ngc, probe-hole.ngc).',
};
