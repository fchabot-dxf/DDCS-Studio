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
import { opSimStarts } from '../viz/opSimStarts.js';       // t957 — the DECLARED per-pass operator start (the sim's own derivation) → the pre-flight trace stops probes at the real walls, not the naive datum

const EPS = 0.01;   // mm — below this an "overshoot" is trace/float noise, not a real breach worth warning about

// t937 B2b-3 — the CLEARANCE-TRAVERSE owning-block types (the mode-governed lift + the between-walls cross). A traced segment
// owned by one of these is a PLANNED clearance traverse that must clear the stock; a probe APPROACH is owned by a probe block,
// so it is excluded BY CONSTRUCTION — never a geometry heuristic. clearlift/safehop/saferetract = the lift; safetraverse = the cross.
const TRAVERSE_BLOCKS = new Set(['clearlift', 'safehop', 'saferetract', 'safetraverse']);

// t947 — THE DEAD-SPINDLE GUARD: a raw-text scan (no trace / machine / block-map needed) — the PRIMARY spindle-safety
// guarantee that makes Option C's default impossible to slip past (a zeroed Head, a new op that forgets to opt in, a
// refactor). A program that COMMANDS a cut — a G1/G2/G3 FEED move — with NO preceding spindle-on (M3/M4) would plunge and
// cut with a DEAD spindle. Flag the FIRST such feed move. Comments are stripped first so a `( … M3 … )` / `( G1 … )` note
// never counts. PROBE programs use G0 rapids + G31 (no G1/G2/G3 feed cut), so this NEVER fires on a probe — the heuristic
// EXCLUDES probes by construction, with no block-types (simpler than the through-stock class). Returns [] or one violation.
function spindleGuard(program) {
    const lines = String(program).split('\n');
    let commanded = false;   // an M3/M4 has turned the spindle on somewhere above
    for (let i = 0; i < lines.length; i++) {
        const code = lines[i].replace(/\([^)]*\)/g, ' ').toUpperCase();   // drop ( comments ) so a commented M3/G1 doesn't count
        if (/\bM0*[34]\b/.test(code)) { commanded = true; continue; }      // M3 / M4 (M03/M04) — spindle on
        if (!commanded && /\bG0*[123]\b/.test(code)) return [{ line: i + 1, kind: 'no-spindle' }];   // a feed cut (G1/G2/G3, not G0) before any spindle-on
    }
    return [];
}

// The sim's own declared-placement predicate (createPreviewPanel g53ApproxForViz) — ONE source, never re-derived here.
export function placementDeclared(machine) {
    return !!(machine && machine.wcs && Array.isArray(machine.wcs.table) && machine.wcs.table.length > 0);
}

// { status, violations, uncheckedProbes, reason, softLimitsEnforced }.
//   status: 'green' (fits) | 'amber' (cannot verify — why in `reason`) | 'red' (violations.length breaches)
//   violations: [{ line (1-based, for display), axis ('X+'|'X-'|'Y+'|'Y-'|'Z+'|'Z-'), overshoot (mm past the edge), kind:'soft-limit' }]
//   uncheckedProbes: count of trip-dependent probe segments skipped (named in the tooltip)
//   softLimitsEnforced: t973 — the controller's soft-limit enable state (false = UNGUARDED breach / crash risk · true = self-protected · null = unknown)
export function checkEnvelope(program, settings) {
    const machine = settings && settings.machine;
    const s = settings || {};
    // t973 — the controller's soft-limit ENABLE state: the ONE source for the enable-state severity + the badge note (folds
    // the old preflightBadge.softLimitNote, which re-read settings). softLimitsPulled is captured at pull: false → the machine
    // will NOT stop itself at the envelope (a breach is UNGUARDED — a hard-stop crash risk); true → self-protected; undefined
    // (never pulled) → unknown. This NEVER downgrades or clears a breach — it only escalates the wording. Threaded onto every
    // return so the consumers read it instead of re-deriving from settings.
    const softLimitsEnforced = machine && machine.softLimitsPulled === false ? false
        : machine && machine.softLimitsPulled === true ? true : null;
    // t947 — the dead-spindle guard runs FIRST + UNCONDITIONALLY (independent of the machine envelope / placement) so it
    // fires even when the envelope can't be verified (amber) or on a raw .nc with no WCS table. A dead-spindle is a definite,
    // text-verifiable breach → it PROMOTES an otherwise-amber verdict to RED (which gates the send). Empty → byte-identical.
    const spindleViol = spindleGuard(program || '');
    const promote = (amber) => spindleViol.length ? { status: 'red', violations: spindleViol.slice(), uncheckedProbes: 0, reason: '', softLimitsEnforced } : amber;
    if (!machine) return promote({ status: 'amber', reason: 'no machine envelope configured (Settings → Machine)', violations: [], uncheckedProbes: 0, softLimitsEnforced });
    if (!placementDeclared(machine)) {
        return promote({ status: 'amber', reason: 'placement not declared — no WCS table pulled/entered, so the program cannot be mapped into the machine frame to verify', violations: [], uncheckedProbes: 0, softLimitsEnforced });
    }

    const wo = wcsOffsetAt(machine, (machine.wcs && machine.wcs.active) || 1) || { x: 0, y: 0, z: 0 };
    let trace;
    try { trace = traceToolpath(program || '', { wcsOffset: wo }); } catch (_) { trace = null; }
    const segments = (trace && trace.segments) || [];

    // The declared envelope per axis, in MACHINE coords → {lo,hi}. t994 — prefer the PULLED per-end ASYMMETRIC soft-limit
    // box (machine-confirmed real, FINDINGS V5: the Expert soft limits are per-end #161-168, can be OFFSET/tighter than the
    // symmetric span — e.g. xMin −5 / xMax 295 — and use ±9999 as a per-end 'no-limit' SENTINEL even with #655=1). The old
    // symmetric axisSpan(travel) UNDER-flags a tighter/offset real box → a FALSE GREEN (fits the check, the machine halts).
    // softLimitBox present → the real min/max per axis (±9999 → UNBOUNDED, no over-travel flag on that end); absent (no pull)
    // → fall back to axisSpan(travel), byte-identical for unpulled configs.
    const box = machine.softLimitBox, SENT = 9999;
    const softSpan = (mn, mx) => ({ lo: (mn == null || mn <= -SENT + 0.5) ? -Infinity : mn, hi: (mx == null || mx >= SENT - 0.5) ? Infinity : mx });
    const spans = box
        ? { x: softSpan(box.xMin, box.xMax), y: softSpan(box.yMin, box.yMax), z: softSpan(box.zMin, box.zMax) }
        : { x: axisSpan(machine.x), y: axisSpan(machine.y), z: axisSpan(machine.z) };

    // Dedup key line|axis → keep the WORST overshoot (a line can breach the same edge on both endpoints / many passes).
    const worst = new Map();
    let uncheckedProbes = 0;

    // t1323 (USER SCARE) — THE ANCHOR QUESTION, asked before any point is judged. A program with no absolute move never
    // says WHERE it starts: it is a walk from wherever the operator jogged to. The trace anchors such a walk at the work
    // origin because it must draw it SOMEWHERE — and the check then measured that arbitrary anchor against the machine
    // box and painted a column of red 'over' badges on a perfectly correct skim program. The anchor was the proxy; the
    // hazard is whether the SWEEP FITS THE TRAVEL AT ALL.
    // The predicate is DECLARED, not sniffed: stats.absolute is the engine's own "the program established an absolute
    // position (a G90 move, a homing, and deliberately NOT a bare G53 excursion) → the path is start-INDEPENDENT". One
    // source, the same flag the preview uses to decide whether moving the operator start drags the path.
    const anchored = !!(trace && trace.stats && trace.stats.absolute);

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
            if (!prev || over > prev.overshoot) worst.set(key, { line: (line | 0) + 1, axis: edge, overshoot: over, kind: 'soft-limit' });
        }
    };

    // THE EXTENT — the bounding box of the walk itself, in mm per axis. A DIFFERENCE, so the unknown anchor cancels out:
    // this number is true no matter where the operator started. Probe segments are INCLUDED here (unlike the per-point
    // test, where their trip-dependent end cannot be judged) because an under-stated clearance is the dangerous
    // direction — the note must never promise the program needs less room than it does.
    const ext = { x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity] };
    const grow = (p) => { for (const ax of ['x', 'y', 'z']) { const v = p[ax] || 0; if (v < ext[ax][0]) ext[ax][0] = v; if (v > ext[ax][1]) ext[ax][1] = v; } };

    for (const seg of segments) {
        grow({ x: seg.x1, y: seg.y1, z: seg.z1 });
        grow({ x: seg.x2, y: seg.y2, z: seg.z2 });
        if (seg.probe || seg.type === 'probe') { uncheckedProbes++; continue; }   // G31 stops trip-dependently → not statically checkable
        if (!anchored) continue;   // t1323 — an unknown anchor makes a per-POINT verdict meaningless; the extent below is the honest one
        const line = seg.line != null ? seg.line : 0;
        testPoint({ x: seg.x1, y: seg.y1, z: seg.z1 }, line);   // both endpoints — the extreme of a straight/chord segment is at a vertex
        testPoint({ x: seg.x2, y: seg.y2, z: seg.z2 }, line);
    }

    const extent = segments.length
        ? { x: Math.max(0, ext.x[1] - ext.x[0]), y: Math.max(0, ext.y[1] - ext.y[0]), z: Math.max(0, ext.z[1] - ext.z[0]) }
        : null;

    // t1323 — THE RELATIVE VERDICT: extent vs the envelope SPAN, per axis. Red ONLY when the sweep cannot fit the travel
    // ANYWHERE — that is a fact about the program, true at every start, and it belongs to the whole program rather than to
    // any one line (line: null; the per-line annotator skips it and the popover states it once). If every axis fits, the
    // program is fine from SOME start and the honest output is a single calm clearance note — never a column of alarms.
    const extentViol = [];
    if (!anchored && extent) {
        for (const ax of ['x', 'y', 'z']) {
            const { lo, hi } = spans[ax];
            const span = hi - lo;                     // an unbounded end (the ±9999 no-limit sentinel) → Infinity → never flagged
            if (!(extent[ax] > span + EPS)) continue;
            extentViol.push({ line: null, axis: ax.toUpperCase(), kind: 'travel-extent', needed: extent[ax], span, overshoot: extent[ax] - span });
        }
    }

    const violations = extentViol.concat(Array.from(worst.values()).sort((a, b) => a.line - b.line || (b.overshoot - a.overshoot)));

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
        // t957 B2b-3 Option B — reproduce the FAITHFUL per-pass operator start (the crux that blocked twice). Call the
        // DECLARED opSimStarts(opType, params, stock) for every block-program op (the SAME start-derivation the sim uses —
        // blocksApp.blkStartHints), assembled in program order → passStarts, threaded WITH the real wcsOffset. So the probes
        // stop at the real walls (not the naive datum inside the boss) and the clearance traverses carry real geometry — the
        // t955 spike proved this frames the Plane/Hop plows EXACTLY (a datum fallback keeps it working off a block program).
        let passStarts = null;
        try {
            const prog = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
            const hints = [];
            for (const b of prog) { if (b && b.type === 'op' && b.opType) { const h = opSimStarts(b.opType, b.params || {}, stk); if (Array.isArray(h) && h.length) hints.push(...h); } }
            passStarts = hints.length ? hints : null;
        } catch (_) { passStarts = null; }
        const dxy = datumXY(stk);
        const start = passStarts ? passStarts[0] : { x: dxy.x, y: dxy.y, z: Number(stk.z) || 0 };
        let t2;
        try { t2 = traceToolpath(program || '', { wcsOffset: wo, stock: stk, start, passStarts, blockMap }); } catch (_) { t2 = null; }
        const seen = new Set();
        const top = stockBox.max.z;
        for (const seg of ((t2 && t2.segments) || [])) {
            if (seg.probe || seg.type === 'probe') continue;   // a probe move itself is not a traverse
            if (!Array.isArray(seg.blockTypes) || !seg.blockTypes.some((t) => TRAVERSE_BLOCKS.has(t))) continue;   // scope to DECLARED traverses
            // t957 TIGHTEN — a real plow is a HORIZONTAL cross BELOW the stock top; both guards err ONLY toward more plows,
            // never fewer (no false-negative). (1) exclude a PURE-VERTICAL lift/drop (no XY extent → it retracts along a wall,
            // it cannot plow across the stock); a horizontal OR diagonal cross is still tested. (2) require SOME of the segment
            // strictly below the stock top by a TINY float epsilon (EPS — a float-equality guard, NOT a clearance margin): a
            // Max lift-to-margin cross sits at/above the top → excluded, while any dip below the top is still tested.
            const seglen = Math.hypot((seg.x2 || 0) - (seg.x1 || 0), (seg.y2 || 0) - (seg.y1 || 0));
            if (seglen < EPS) continue;                                          // (1) pure vertical lift/drop → not a cross
            if (Math.min(seg.z1 || 0, seg.z2 || 0) >= top - EPS) continue;       // (2) entirely at/above the stock top → not a plow
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

    // t947 — the dead-spindle violation leads (most severe: a stopped-spindle cut); envelope + through-stock follow, both
    // UNCHANGED. When spindleViol is empty this is byte-identical to before (concat of [] is a no-op).
    const all = spindleViol.concat(violations).concat(stockViol);
    const status = all.length ? 'red' : 'green';
    // t1323 — anchor + extent ride the result so the UI can WORD the clearance note from one source instead of re-tracing.
    // anchor: 'absolute' = the program says where it is (today's per-line truth) · 'relative' = a walk from an unknown start.
    return { status, violations: all, uncheckedProbes, reason: '', softLimitsEnforced, anchor: segments.length ? (anchored ? 'absolute' : 'relative') : null, extent };
}
