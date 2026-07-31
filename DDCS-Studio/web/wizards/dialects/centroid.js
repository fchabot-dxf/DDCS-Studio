/**
 * wizards/dialects/centroid.js — Centroid CNC12 (Acorn) dialect.
 *
 * In-program #var/branching like DDCS, but its OWN syntax (IF…THEN…GOTO, M115 probe) — not a shared
 * Macro-B emitter (see MACHINE-PRIMITIVES-MAP.md §9). Mirrors the ddcs-expert-m350.js anchor shape.
 * Verified against bridge/controllers/centroid/ — assets/Centroid_CNC12_Macro_Programming.txt (the macro
 * manual) + corner-probe-FL.mac (our translated probe). file:line citations inline; forms not present in
 * the dump are marked TO CONFIRM (the full system-var list lives in mill operators manual §11.2.16,
 * which is NOT in the captured dump). NOT tested on owned hardware.
 */
const AX = { X: 0, Y: 1, Z: 2, A: 3 };

export const dialect = {
    id: 'centroid', name: 'Centroid CNC12 (Acorn)',
    programModel: 'inline', probeModel: 'move-until-input', dwellUnits: 's',
    // Centroid probes by move-until-input (stop AT contact) and writes WCS with G92/G10 — so it reads NO
    // trigger/status var. The machine-pos / WCS-offset / tool-table system vars are in operators-manual
    // §11.2.16 (not in our dump) ⇒ left null + TO CONFIRM. #4120 req tool / #4203 in-spindle are known.
    vars: { dro: null, probeStatus: null, probeTrig: null, wcsBase: null, wcsStride: null, activeWcs: null, toolTable: null, ax: AX },
    caps: { vars: true, flow: 'goto', probeStatusCheck: false, hmi: true, toolTable: true, probePort: false,
        helicalArc: false },   // M115 probe / M225 msg — TO CONFIRM on hardware. t1472 — helicalArc false for the SAME reason: no captured Centroid arc of either kind, and this dialect is unconfirmed hardware throughout

    // M115 /Z-10 P3 F20  (manual:309 "M115 /Z P3 F20"; corner-probe-FL.mac:38 "M115 /Z[..] P[..] F[..]").
    // Move-until-input: stops AT contact and AUTO-CANCELS WITH AN ERROR if the bound is reached without
    // contact (manual:868-869) — so no-contact protection is built in. `level` is unused on Centroid.
    probeMove: (axis, dist, { feed = 10, port = 3 } = {}) => [`M115 /${axis}${dist} P${port} F${feed}`],
    probeStatus: () => [],   // [] — M115 errors out on no-contact (manual:868); no in-program status read
    probeRead: () => [],     // [] — stops AT contact; define the point with setWorkOffset (G92), no trigger var
    probeTrigVar: () => null, // null — no trigger var; an inline read must degrade honestly
    readMachine: () => [],   // TO CONFIRM — machine-pos system var is in operators manual §11.2.16, not in dump
    // G53 Z.5 / G53 X1  (manual:135-136). Machine-frame move; ref may be a LITERAL or #var (unlike DDCS,
    // which requires a #var). Optional trailing "L<feedrate>" (manual:174 "G53 X1 Y-1 L200").
    machineMove: (axis, ref) => [`G53 ${axis}${ref}`],
    // G92 X<val>  (corner-probe-FL.mac:54 "G92 X[..]"; manual:312 "G92 Z.5"). Sets the ACTIVE WCS so current
    // pos = value — wcsExpr is unused (G92 acts on whatever WCS is active). Alt: G10 P<param> R<val> (manual:692).
    setWorkOffset: (wcsExpr, axis, value) => [`G92 ${axis}${value}`],
    readActiveWcs: () => [], // TO CONFIRM — active-WCS index var is in operators manual §11.2.16, not in dump
    distMode: (mode) => (mode === 'inc' ? 'G91' : 'G90'),
    dwell: (sec) => [`G4 P${sec}`],   // P = SECONDS (manual:495 "G4 P4 ;Wait 4 seconds"; :313 "G4 P .5")
    endProgram: () => ['M30'],        // M30 for a top-level macro; M99 if the .mac is a subprogram (manual:193)
    // IF #100==1 THEN GOTO 200  (manual:451 "IF #50005 THEN GOTO 500"; :626 "IF #150 == 0 THEN GOTO 200").
    // Note THEN, and the space before the label. Verified ops: == (and =), <, > ; '!=','<=','>=' TO CONFIRM.
    ifGoto: (lhs, op, rhs, label) => [`IF ${lhs}${op}${rhs} THEN GOTO ${label}`],
    goto: (label) => [`GOTO ${label}`],   // space after GOTO (manual:453 "GOTO 1000") — unlike DDCS's GOTO1
    label: (n) => [`N${n}`],              // N-block destinations (manual:98 "N1000", :510 "N200")
    spindle: (dir, rpm) => [`${dir === 'ccw' ? 'M4' : 'M3'} S${rpm}`],
    spindleOff: () => ['M5'],             // manual:728 "M5 ;Stop Spindle"
    coolant: (on) => [on ? 'M8' : 'M9'],  // standard flood/off; Acorn-PLC alt is M94/M95 SV_3 (manual:524)
    hmiPrompt: (msg) => [`M225 #0 "${msg}"`],   // M225 #<timer> "msg"; timer 0 = wait for Cycle Start (manual:296-300).
    //                                              TO CONFIRM: dump pre-loads a user var (#100=0, manual:288); #0-as-0 unverified.
    hmiToast: (msg) => [`M225 #0 "${msg}"`],    // Centroid has no non-blocking banner in a .mac — M225 always
    //                                              pauses; a timed display needs a preloaded timer var (see notes).
    hmiInput: (varName, prompt) => [`M224 ${varName} "${prompt}" #0`], // M224 <retvar> "prompt" <?>: dump (manual:514
    //   "M224 #100 \"..\" #105") then reads the FIRST var (#100) as the operator entry; trailing var role TO CONFIRM.

    notes: 'Centroid CNC12 (Acorn): in-program #var/branching like DDCS but a DISTINCT dialect — IF…THEN…GOTO/ELSE '
        + '(note THEN; "GOTO 200" has a space, vs DDCS "GOTO1"), and PROBING is M115/M116 (move-until-input) not G31. '
        + 'M115 stops AT contact and AUTO-ERRORS on no-contact, so probeStatus/probeRead fold to [] (the DDCS '
        + 'fast/slow + IF…GOTO collapses to an M115/M116 pair — LESS code). WCS via G92 (or G10 P R), not an indirect '
        + '#var write. Dwell P = SECONDS (G4 P4). machineMove G53 takes a literal (no #var needed, unlike DDCS). '
        + 'HMI: M225 display (always pauses the macro — no non-blocking toast in a .mac), M224 operator input; the '
        + '#0-as-zero-timer shortcut and M224 var-order are TO CONFIRM (dump pre-allocates a user timer var). '
        + 'NULL vars: machine-pos / active-WCS / WCS-offset / tool-table system vars live in mill operators manual '
        + '§11.2.16, which is NOT in the captured dump ⇒ readMachine/readActiveWcs return [] (TO CONFIRM). '
        + 'Verified vs bridge/controllers/centroid — assets/Centroid_CNC12_Macro_Programming.txt + corner-probe-FL.mac. '
        + 'NOT tested on owned hardware.',
};
