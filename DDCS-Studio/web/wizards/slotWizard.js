/**
 * wizards/slotWizard.js — slot milling generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `slotStack(params)` → a single Slot atom,
 * emitted through emitMapped. The Slot atom owns the geometry (slotPath kernel): a widened channel from
 * (ax,ay)→(bx,by) at any angle, width ≥ tool, zig-zag offset passes stepping down. Form and Blocks view are
 * two editors of this one stack.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { makeStart, makeEnd, makePlace } from '../blocks/programFraming.js';
import { num } from './ops/util.js';
import { patternPoints } from './ops/array.js';
import { pointsBBox } from './ops/placement.js';

/** The slot channel's footprint (A↔B widened by the cut width) — used by PlaceOnStock (when you attach to a corner)
 *  + the 2D view. */
export function slotBBox(params = {}) {
    const ax = num(params.ax, 0), ay = num(params.ay, 0), bx = num(params.bx, 60), by = num(params.by, 0);
    const W = Math.max(num(params.toolDia, 6), num(params.width, num(params.toolDia, 6)));
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * (W / 2), py = (dx / len) * (W / 2);   // half-width, perpendicular to the centreline
    const xs = [ax + px, ax - px, bx + px, bx - px], ys = [ay + py, ay - py, by + py, by - py];
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** True when params ask for a repeated slot (a real pattern, not a single slot). */
export function slotPatterned(params = {}) {
    const p = params.pattern || 'single';
    return p !== 'single' && p !== '';
}

/** The array's pattern OFFSETS (origin 0,0 → relative shifts the slot is stamped at). */
export function slotPatternPoints(params = {}) {
    return patternPoints({ ...params, x0: 0, y0: 0, cx: 0, cy: 0 });
}

/** Footprint of the whole slot array = the base slot's bbox spread over the pattern offsets (Minkowski sum of
 *  axis-aligned boxes → add the mins/maxes). Used for PlaceOnStock when the array attaches to a stock corner. */
export function slotArrayBBox(params = {}) {
    const sb = slotBBox(params);
    if (!slotPatterned(params)) return sb;
    const pb = pointsBBox(slotPatternPoints(params));
    if (!pb) return sb;
    return { minX: sb.minX + pb.minX, maxX: sb.maxX + pb.maxX, minY: sb.minY + pb.minY, maxY: sb.maxY + pb.maxY };
}

/** Slot params → [ Program Start, WCS, PlaceOnStock{ Slot | Array{ Slot } }, Program End ]. One source of truth. */
export function slotStack(params = {}) {
    const slot = newBlock('slot');
    slot.params = {
        x0: num(params.ax, 0), y0: num(params.ay, 0), x1: num(params.bx, 60), y1: num(params.by, 0),
        width: num(params.width, num(params.toolDia, 6)), tool: num(params.toolDia, 6),
        stepoverPct: num(params.stepoverPct, 40), depth: num(params.depth, 4), stepdown: num(params.stepdown, 1.5),
        feed: num(params.feed, 600), plunge: num(params.plunge, 150), clearance: num(params.clearance, 5),
    };
    // Repeat the slot in a pattern: wrap it in an Array container (origin 0,0 → offsets), exactly like drill = array(hole).
    let op = slot, bbox = slotBBox(params);
    if (slotPatterned(params)) {
        const arr = newBlock('array');
        arr.params = {
            pattern: params.pattern, x0: 0, y0: 0,
            cols: num(params.cols, 2), rows: num(params.rows, 2), dx: num(params.dx, 40), dy: num(params.dy, 30),
            count: num(params.count, 6), spacing: num(params.spacing, 30), angle: num(params.angle, 0),
            dia: num(params.dia, 80), startAngle: num(params.startAngle, 0),
            w: num(params.w, 100), h: num(params.h, 80), nx: num(params.nx, 3), ny: num(params.ny, 2),
            skip: params.skip || '',
        };
        arr.children = [slot];
        op = arr; bbox = slotArrayBBox(params);
    }
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing
    return [makeStart(params), wcs, makePlace(params, bbox, op), makeEnd(params)];   // opt-in placement
}

export class SlotWizard {
    generate(params) {
        recordOp('slot', params);   // let the Blocks tab open this op as its stack
        return emitMapped(slotStack(params)).text;
    }
}
