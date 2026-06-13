/**
 * wizards/drillWizard.js — hole-pattern generator (the first Mill-group op).
 *
 * A pattern (grid / circle / rectangle / line) computes an XY list in WORK coordinates; each hole is
 * made by one of two methods:
 *   - peck    : plunge straight down (drill bit, or center-cutting end mill). Hole Ø = tool Ø.
 *   - helical : spiral down with an end mill — Hole Ø ≥ tool Ø, set by the helix radius. Linearised
 *               into G1 segments so it runs on any DDCS (no helical-arc / canned-cycle assumption).
 *
 * Everything is computed in Studio and emitted as flat G0/G1 in the active WCS, wrapped by the shared
 * spindle-start header + end-of-program footer. No #vars / IF / GOTO — fully reviewable.
 */
import { headerBlock, footerBlock } from './cuttingBlocks.js';

function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Pattern → XY list (work coords). Exported so the 2D layout canvas draws the same geometry. */
export function patternPoints(p) {
    const pts = [];
    const type = p.pattern || 'grid';
    if (type === 'circle') {
        const cx = num(p.cx, 0), cy = num(p.cy, 0), R = num(p.dia, 50) / 2;
        const n = Math.max(1, Math.round(num(p.count, 6))), a0 = num(p.startAngle, 0) * Math.PI / 180;
        for (let k = 0; k < n; k++) { const a = a0 + k * 2 * Math.PI / n; pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }); }
    } else if (type === 'line') {
        const n = Math.max(1, Math.round(num(p.count, 3))), s = num(p.spacing, 20), a = num(p.angle, 0) * Math.PI / 180;
        const x0 = num(p.x0, 0), y0 = num(p.y0, 0);
        for (let k = 0; k < n; k++) pts.push({ x: x0 + k * s * Math.cos(a), y: y0 + k * s * Math.sin(a) });
    } else if (type === 'rect') {
        // Holes around a rectangle perimeter: nx along width (incl. corners), ny along height.
        const w = num(p.w, 100), h = num(p.h, 80), x0 = num(p.x0, 0), y0 = num(p.y0, 0);
        const nx = Math.max(2, Math.round(num(p.nx, 2))), ny = Math.max(2, Math.round(num(p.ny, 2)));
        const seen = new Set(), add = (x, y) => { const k = r3(x) + ',' + r3(y); if (!seen.has(k)) { seen.add(k); pts.push({ x, y }); } };
        for (let i = 0; i < nx; i++) { const x = x0 + (w * i) / (nx - 1); add(x, y0); add(x, y0 + h); }
        for (let j = 0; j < ny; j++) { const y = y0 + (h * j) / (ny - 1); add(x0, y); add(x0 + w, y); }
    } else { // grid
        const cols = Math.max(1, Math.round(num(p.cols, 3))), rows = Math.max(1, Math.round(num(p.rows, 3)));
        const dx = num(p.dx, 20), dy = num(p.dy, 20), x0 = num(p.x0, 0), y0 = num(p.y0, 0);
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) pts.push({ x: x0 + i * dx, y: y0 + j * dy });
    }
    return pts.map(pt => ({ x: r3(pt.x), y: r3(pt.y) }));
}

/** Peck drill at a point: plunge in `peck` steps, full retract to clearance each step (G83-style). */
function peckDrill(pt, p) {
    const clr = num(p.clearance, 5), depth = num(p.depth, 5), feed = num(p.feed, 100);
    const q = Math.max(0.1, num(p.peck, depth));
    const L = [`G0 X${pt.x} Y${pt.y}`];
    let d = 0;
    while (d < depth - 1e-6) {
        d = Math.min(d + q, depth);
        L.push(`G1 Z${r3(-d)} F${feed}`);
        L.push(`G0 Z${clr}`);
    }
    return L;
}

/** Bore a hole (Ø ≥ tool) with an end mill: ring-step down — plunge `pitch`, full circle, repeat —
 *  then a finishing pass. Uses planar G3 arcs (confirmed on the Expert/4.1 dumps), no helical-arc
 *  or canned-cycle assumption. If hole Ø ≤ tool Ø it falls back to a straight plunge. */
function helicalBore(pt, p) {
    const clr = num(p.clearance, 5), depth = num(p.depth, 5), feed = num(p.feed, 100);
    const r = (num(p.holeDia, 12) - num(p.toolDia, 6)) / 2, pitch = Math.max(0.05, num(p.pitch, 0.5));
    const cx = pt.x, cy = pt.y;
    if (r <= 0.01) return [`G0 X${cx} Y${cy}`, `G0 Z${clr}`, `G1 Z${r3(-depth)} F${feed}`, `G0 Z${clr}`];  // hole ≤ tool → plunge
    const L = [`G0 X${r3(cx + r)} Y${cy}   ( bore radius )`, `G0 Z${clr}`];
    const arc = `G3 X${r3(cx + r)} Y${cy} I${r3(-r)} J0`;   // full CCW circle back to start
    let z = 0;
    while (z < depth - 1e-6) {
        z = Math.min(z + pitch, depth);
        L.push(`G1 Z${r3(-z)} F${feed}`, `${arc} F${feed}   ( full circle )`);
    }
    L.push(`${arc}   ( finish pass )`, `G0 Z${clr}`);
    return L;
}

export class DrillWizard {
    generate(params) {
        const pts = patternPoints(params);
        // Suppress holes by their 1-based number (the numbers shown in the preview / comments) —
        // e.g. skip "5" for a grid centre, or a hole that lands on a clamp.
        const skip = new Set(String(params.skip || '').split(/[ ,]+/).map(s => parseInt(s, 10)).filter(n => n > 0));
        const kept = pts.filter((_, i) => !skip.has(i + 1)).length;
        const helical = params.method === 'helical';
        const L = [
            `( Hole pattern - ${params.pattern || 'grid'} - DDCS Studio )`,
            `( ${kept} of ${pts.length} holes | ${helical ? 'helical bore' : 'peck drill'} | depth ${num(params.depth, 5)} mm )`,
            ...headerBlock(params),
            `G0 Z${num(params.clearance, 5)}   ( clearance )`,
        ];
        pts.forEach((pt, i) => {
            const n = i + 1;
            if (skip.has(n)) { L.push(`( hole ${n}/${pts.length} - skipped )`); return; }
            L.push(`( hole ${n}/${pts.length} )`);
            L.push(...(helical ? helicalBore(pt, params) : peckDrill(pt, params)));
        });
        L.push(...footerBlock(params));
        return L.join('\n');
    }

    /** Preview/sim start hint (work frame): origin; the pattern is drawn from there. */
    inferStart() { return { x: 0, y: 0, z: num(arguments[0] && arguments[0].clearance, 5) }; }
}
