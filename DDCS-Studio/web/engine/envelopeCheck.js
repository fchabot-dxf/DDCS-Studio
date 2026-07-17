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
import { datumXY, stockWorkAABB } from './workpiece.js';   // t937 — datum-derived probe start + the work-frame stock AABB (the through-stock class)
import { rayBox } from './probeGeometry.js';               // t937 — the shared segment-vs-box test (a true MID-SEGMENT plow, not the endpoint test)

const EPS = 0.01;   // mm — below this an "overshoot" is trace/float noise, not a real breach worth warning about

// t937 B2b-3 — the CLEARANCE-TRAVERSE owning-block types (the mode-governed lift + the between-walls cross). A traced segment
// owned by one of these is a PLANNED clearance traverse that must clear the stock; a probe APPROACH is owned by a probe block,
// so it is excluded BY CONSTRUCTION — never a geometry heuristic. clearlift/safehop/saferetract = the lift; safetraverse = the cross.
const TRAVERSE_BLOCKS = new Set(['clearlift', 'safehop', 'saferetract', 'safetraverse']);

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

    // t937 B2b-3 — THROUGH-STOCK, added ALONGSIDE (the envelope trace + loop + violations above are UNTOUCHED, byte-identical).
    // A SEPARATE, stock-aware trace (the envelope trace stays deliberately stock-blind so its result can't shift): probe G31s
    // now stop at the surface (opts.stock) so the between-walls #vars are real. Each segment is stamped with its owning
    // block-type from the LIVE projection's block map — but ONLY when that map ALIGNS with this exact program (a hand-edited
    // editor or a raw-text caller yields no map → the class simply doesn't run, never a false-positive). We then flag any
    // CLEARANCE-TRAVERSE segment whose straight path plows through the declared stock box, via a true MID-SEGMENT rayBox (a
    // rapid can sit clear at BOTH endpoints yet cross the middle — the envelope's endpoint test would miss it). Probe
    // approaches are excluded by construction (owning block is a probe). The start is a datum-derived best-effort — the
    // fidelity that matters (the probe stopping at the surface) rides opts.stock, which IS settings.stock exactly.
    const stockViol = [];
    let blockMap = null;
    try { const p = (typeof window !== 'undefined' && window.ddcsGetProjection) ? window.ddcsGetProjection() : null; if (p && p.text === program) blockMap = p.map || null; } catch (_) { blockMap = null; }
    const stk = (s.stock && s.stock.show) ? s.stock : null;   // the SAME stock the AABB + the trace use (mirrors the preview's stockForViz show-gate)
    const stockBox = (blockMap && stk) ? stockWorkAABB(stk) : null;
    if (stockBox) {
        const dxy = datumXY(stk);
        const start = { x: dxy.x, y: dxy.y, z: Number(stk.z) || 0 };
        let t2;
        try { t2 = traceToolpath(program || '', { wcsOffset: wo, stock: stk, start, blockMap }); } catch (_) { t2 = null; }
        const seen = new Set();
        for (const seg of ((t2 && t2.segments) || [])) {
            if (seg.probe || seg.type === 'probe') continue;   // a probe move itself is not a traverse
            if (!Array.isArray(seg.blockTypes) || !seg.blockTypes.some((t) => TRAVERSE_BLOCKS.has(t))) continue;   // scope to DECLARED traverses
            const rb = rayBox({ x: seg.x1, y: seg.y1, z: seg.z1 }, { x: seg.x2, y: seg.y2, z: seg.z2 }, stockBox.min, stockBox.max);
            if (!rb.hit) continue;
            const enter = Math.max(rb.tEnter, 0), exit = Math.min(rb.tExit, 1);
            if (exit <= enter + EPS) continue;   // some of the SEGMENT (t in [0,1]) must lie inside the box → a real mid-segment plow
            const line = seg.line != null ? seg.line : 0;
            if (seen.has(line)) continue;
            seen.add(line);
            stockViol.push({ line: (line | 0) + 1, kind: 'through-stock' });
        }
        stockViol.sort((a, b) => a.line - b.line);
    }

    const all = violations.concat(stockViol);   // envelope entries stay FIRST + UNCHANGED → byte-identical whenever stockViol is empty
    const status = all.length ? 'red' : 'green';
    return { status, violations: all, uncheckedProbes, reason: '' };
}
