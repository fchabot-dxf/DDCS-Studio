/**
 * engine/trace.js — the ONE toolpath source for every preview (2D + 3D, in all three preview hosts).
 *
 * traceToolpath(text) runs the program through the execution engine's synchronous trace (engine.trace):
 * it resolves #vars, follows IF/GOTO loops, auto-detects probes, and linearizes arcs — so the drawn route
 * is exactly the path the engine takes (option B). This replaces the old static parsers (parseGcode /
 * toolpath2d's regex), which could not resolve a #var coordinate (`G0 Z#18`) — the whole point for probe/
 * parametric macros. Returns { segments, bounds, stats } (same shape parseGcode returned, so it's drop-in).
 *
 *   opts.stock          stock box → probe G31 stops at the surface (else it auto-detects at full travel)
 *   opts.start          operator start in stock coords → probes test from the real tool position (incremental
 *                       probe macros otherwise trace from the origin, on the stock face, and the first probe
 *                       clamps to zero length). The route stays origin-relative; the viz offsets it by the start.
 *   opts.wcsOffset      work origin in MACHINE coords (machine coord of part-zero) → G53 machine-frame moves
 *                       draw in the part/WCS frame instead of raw machine coords. Default = origin (no-op).
 *   opts.createVarStore seed controller params (#632/#1078/…) so "read from controller" feeds resolve
 *   opts.captureVars    array of #var numbers → the returned result gets `.vars = {n: value}` (RESOLVED after the
 *                       trace). Used by the ATC station highlight to read the taught G53 station params (#1320-1326).
 */
import { GcodeExecutionEngine } from './GcodeExecutionEngine.js';

export function traceToolpath(text, opts = {}) {
    const eng = new GcodeExecutionEngine({
        autoAnswer: true,                 // hands-free: virtual sensors/probes satisfy so loops terminate
        stock: opts.stock || null,
        stockOffset: opts.start || null,
        wcsOffset: opts.wcsOffset || null,   // work origin in MACHINE coords → G53 moves draw in the part frame
        g53ApproxZ: opts.g53ApproxZ != null ? opts.g53ApproxZ : null,   // t826 — undeclared placement: render machine-frame G53 Z retracts at this work-frame Z (margin above the work origin)
        initialPos: opts.initialPos || null,   // t540 — seed the tool's START position (homing: the draggable machine-frame Start)
        continuous: opts.continuous || false,   // t570 — an AUTO-traverse op (alignment) is ONE continuous path from the seat (no per-pass origin reset)
        createVarStore: opts.createVarStore || null,
    });
    eng._passStarts = opts.passStarts || null;   // Part 1: per-pass starts → the probe collision fires from each pass's start ②
    const result = eng.trace(String(text || ''));
    // t937 — DECLARE-ON-THE-SEGMENT: when the caller supplies the block map (line → owning block-id ancestry, from the live
    // projection), stamp each segment with its owning block TYPES. A consumer (the through-stock pre-flight; later the 2D/3D
    // legends) can then scope by DECLARED intent — a clearance traverse (clearlift/safetraverse/…) vs a probe approach —
    // instead of inferring from move class (both are G0 rapids → indistinguishable). Purely additive; no map → unchanged.
    if (opts.blockMap && Array.isArray(result.segments)) {
        const typesOf = (src) => (Array.isArray(src) ? src.map((id) => String(id).replace(/[0-9]+$/, '')) : []);
        for (const seg of result.segments) if (seg && seg.line != null) seg.blockTypes = typesOf(opts.blockMap[seg.line]);
    }
    if (Array.isArray(opts.captureVars)) {   // opt-in: read resolved #vars (e.g. the ATC station #1320-1326) before disposing
        result.vars = {};
        for (const n of opts.captureVars) result.vars[n] = Number(eng.vars.get(n)) || 0;
    }
    eng.dispose();   // transient per-call engine — detach its io_change bridge listener so it doesn't leak
    return result;
}
