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
 *   opts.createVarStore seed controller params (#632/#1078/…) so "read from controller" feeds resolve
 */
import { GcodeExecutionEngine } from './GcodeExecutionEngine.js';

export function traceToolpath(text, opts = {}) {
    const eng = new GcodeExecutionEngine({
        autoAnswer: true,                 // hands-free: virtual sensors/probes satisfy so loops terminate
        stock: opts.stock || null,
        createVarStore: opts.createVarStore || null,
    });
    return eng.trace(String(text || ''));
}
