// TIME ESTIMATE (t844) — total + per-op runtime from the sim's OWN move+feed knowledge. It READS the engine trace (the
// exact segments the preview animates) and applies the SAME rate model GcodeExecutionEngine playback uses: a move takes
// distance / rate, where rate = the machine rapid rate for a G0 rapid, else the programmed feed (feed ≤ 0 → 600, the
// engine's own fallback). Dwells (G4 P, ms) and tool changes (M6) come from the engine's OWN trace stats — never a second
// parser. HONEST: acceleration/deceleration is NOT modeled, so a real job runs LONGER than this on segment-dense code; the
// number is labelled "estimated" and rounded (no fake precision).

import { traceToolpath } from './trace.js';

export const RAPID_RATE_DEFAULT = 6000;      // mm/min — matches the engine's constructor rapidRate default
export const TOOLCHANGE_SEC_DEFAULT = 15;    // s per M6 — an honest allowance (declared in settings.machine.toolChangeSec)

// Seconds for one traced move — IDENTICAL rate model to the playback (dist/rate; the feed≤0 → 600 fallback).
export function moveSeconds(seg, rapidRate) {
    const d = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1, seg.z2 - seg.z1);
    const rate = seg.rapid ? rapidRate : (seg.feed > 0 ? seg.feed : 600);
    return rate > 0 ? d / rate * 60 : 0;
}

// estimateProgram(program, { rapidRate, toolChangeSec, wcsOffset }) →
//   { seconds, moveSec, dwellSec, tcSec, perLine } — perLine: Map(0-based source line → seconds on that line) for the per-op split.
export function estimateProgram(program, opts = {}) {
    const rapidRate = opts.rapidRate > 0 ? opts.rapidRate : RAPID_RATE_DEFAULT;
    const tcEach = opts.toolChangeSec >= 0 ? opts.toolChangeSec : TOOLCHANGE_SEC_DEFAULT;
    let trace;
    try { trace = traceToolpath(program || '', { wcsOffset: opts.wcsOffset }); } catch (_) { trace = null; }
    const segs = (trace && trace.segments) || [];
    const st = (trace && trace.stats) || {};
    let moveSec = 0;
    const perLine = new Map();
    for (const s of segs) {
        const sec = moveSeconds(s, rapidRate);
        moveSec += sec;
        if (s.line != null) perLine.set(s.line, (perLine.get(s.line) || 0) + sec);
    }
    const dwellSec = (st.dwellMs || 0) / 1000;
    const tcSec = (st.toolChanges || 0) * tcEach;
    return { seconds: moveSec + dwellSec + tcSec, moveSec, dwellSec, tcSec, perLine };
}

// Sum the per-line seconds over a set of 0-based source lines (an op's line span) → the per-op estimate.
export function secondsForLines(perLine, lines) {
    let s = 0;
    for (const ln of (lines || [])) s += perLine.get(ln) || 0;
    return s;
}

// Human label with sensible rounding (no fake precision). <90s → "s"; <60min → "min"; else "h m".
export function fmtDuration(sec) {
    if (!(sec > 0)) return '0 s';
    if (sec < 90) return `${Math.round(sec)} s`;
    const m = sec / 60;
    if (m < 60) return `${Math.round(m)} min`;
    const h = Math.floor(m / 60), rem = Math.round(m % 60);
    return rem ? `${h} h ${rem} min` : `${h} h`;
}
