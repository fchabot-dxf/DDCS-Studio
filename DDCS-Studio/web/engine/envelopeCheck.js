// PRE-FLIGHT ENVELOPE CHECK (t838) — the safety story's THIRD layer: Studio warns BEFORE motion (the controller's soft
// limit faults AT motion; the switch is physics). It traces the program in the MACHINE frame and reports every point that
// would leave the declared travel envelope, as LINE + AXIS + OVERSHOOT ("line 142 exceeds Z+ by 3mm").
//
// DECLARE-NEVER-INFER / ONE FRAME: this is a THIN consumer of what the sim already computes — it never builds a second
// frame implementation. It reuses:
//   - traceToolpath()  (engine/trace.js)      — THE one line-numbered program trace every preview uses (each segment
//                                                carries `line` = the 0-based source line; work/part frame).
//   - wcsOffsetAt()    (viz/sceneFrame.js)    — THE one work→machine map: machine = work + wcsOffset (the declared WCS row).
//   - axisSpan()       (engine/limitSwitches.js) — THE one signed-travel → {lo,hi} envelope per axis.
// The declared-placement predicate is the sim's OWN (createPreviewPanel.g53ApproxForViz): a non-empty WCS table.
//
// HONESTY: placement UNDECLARED (no WCS table) → we cannot map to the machine frame → amber "cannot verify" (NEVER a
// false green, never a guess). PROBE moves (G31) stop trip-dependently at an unknown point → their segments are NOT
// hard-checked; they are COUNTED and NAMED as unchecked. The surrounding deterministic moves (rapids, feeds, the
// machine-frame safe-Z retracts) ARE checked.

import { traceToolpath } from './trace.js';
import { axisSpan } from './limitSwitches.js';
import { wcsOffsetAt } from '../viz/sceneFrame.js';

const EPS = 0.01;   // mm — below this an "overshoot" is trace/float noise, not a real breach worth warning about

// The sim's own declared-placement predicate (createPreviewPanel g53ApproxForViz) — ONE source, never re-derived here.
export function placementDeclared(machine) {
    return !!(machine && machine.wcs && Array.isArray(machine.wcs.table) && machine.wcs.table.length > 0);
}

// { status, violations, uncheckedProbes, reason }.
//   status: 'green' (fits) | 'amber' (cannot verify — why in `reason`) | 'red' (violations.length breaches)
//   violations: [{ line (1-based, for display), axis ('X+'|'X-'|'Y+'|'Y-'|'Z+'|'Z-'), overshoot (mm past the edge) }]
//   uncheckedProbes: count of trip-dependent probe segments skipped (named in the tooltip)
export function checkEnvelope(program, settings) {
    const machine = settings && settings.machine;
    const s = settings || {};
    if (!machine) return { status: 'amber', reason: 'no machine envelope configured (Settings → Machine)', violations: [], uncheckedProbes: 0 };
    if (!placementDeclared(machine)) {
        return { status: 'amber', reason: 'placement not declared — no WCS table pulled/entered, so the program cannot be mapped into the machine frame to verify', violations: [], uncheckedProbes: 0 };
    }

    const wo = wcsOffsetAt(machine, (machine.wcs && machine.wcs.active) || 1) || { x: 0, y: 0, z: 0 };
    let trace;
    try { trace = traceToolpath(program || '', { wcsOffset: wo }); } catch (_) { trace = null; }
    const segments = (trace && trace.segments) || [];

    // The declared envelope per axis, in MACHINE coords (signed travel → {lo,hi}).
    const spans = { x: axisSpan(machine.x), y: axisSpan(machine.y), z: axisSpan(machine.z) };

    // Dedup key line|axis → keep the WORST overshoot (a line can breach the same edge on both endpoints / many passes).
    const worst = new Map();
    let uncheckedProbes = 0;

    const testPoint = (workPt, line) => {
        for (const ax of ['x', 'y', 'z']) {
            const mach = (workPt[ax] || 0) + (wo[ax] || 0);   // work coords are already mm-scaled → machine = work + wcsOffset
            const { lo, hi } = spans[ax];
            let over = 0, edge = '';
            if (mach > hi + EPS) { over = mach - hi; edge = ax.toUpperCase() + '+'; }
            else if (mach < lo - EPS) { over = lo - mach; edge = ax.toUpperCase() + '-'; }
            if (!edge) continue;
            const key = line + '|' + edge;
            const prev = worst.get(key);
            if (!prev || over > prev.overshoot) worst.set(key, { line: (line | 0) + 1, axis: edge, overshoot: over });
        }
    };

    for (const seg of segments) {
        if (seg.probe || seg.type === 'probe') { uncheckedProbes++; continue; }   // G31 stops trip-dependently → not statically checkable
        const line = seg.line != null ? seg.line : 0;
        testPoint({ x: seg.x1, y: seg.y1, z: seg.z1 }, line);   // both endpoints — the extreme of a straight/chord segment is at a vertex
        testPoint({ x: seg.x2, y: seg.y2, z: seg.z2 }, line);
    }

    const violations = Array.from(worst.values()).sort((a, b) => a.line - b.line || (b.overshoot - a.overshoot));
    const status = violations.length ? 'red' : 'green';
    return { status, violations, uncheckedProbes, reason: '' };
}
