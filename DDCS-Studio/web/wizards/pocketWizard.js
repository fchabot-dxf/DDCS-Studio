/**
 * wizards/pocketWizard.js — pocket clearing generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `pocketStack(params)` →
 * [ StepDown{ StepOver(Region) [+ Wall(Region)] } ]. The Region is the tool-CENTRE boundary (inset by the
 * tool radius) so the FINISHED pocket matches the size you type. Strategy raster → parallel rows + a Wall
 * finish; spiral → concentric rings (which reach the wall). A pocket smaller than the tool falls back to a
 * single centre plunge (peck). Form and Blocks view are two editors of this one stack.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { makeStart, makeEnd, makePlace } from '../blocks/programFraming.js';
import { num } from './ops/util.js';
import { regionDesc } from './ops/region.js';
import { offsetRegion } from './ops/contour.js';

/** The TRUE pocket region (rect = corner+size, circle/polygon = centre±R, ellipse = centre±(rx,ry)) — the size you
 *  type, before insetting. Shape-centred at (originX, originY) except rect (its corner). */
function trueRegionParams(params = {}) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0), shape = params.shape || 'rect';
    if (shape === 'circle') return { shape: 'circle', x: ox, y: oy, w: num(params.dia, 50) };
    if (shape === 'polygon') return { shape: 'polygon', x: ox, y: oy, w: num(params.dia, 50), sides: num(params.sides, 6) };
    if (shape === 'ellipse') return { shape: 'ellipse', x: ox, y: oy, w: num(params.w, 80), h: num(params.h, 60) };
    return { shape: 'rect', x: ox, y: oy, w: num(params.w, 80), h: num(params.h, 60) };
}

/** A region DESCRIPTOR → region-block params (the inverse of regionDesc): rect = corner+size, circle/polygon =
 *  centre + Ø (polygon keeps its sides), ellipse = centre + the two diameters. */
export function regionParamsFromDesc(rg) {
    if (rg.kind === 'circle') return { shape: 'circle', x: rg.cx, y: rg.cy, w: 2 * rg.r };
    if (rg.kind === 'polygon') return { shape: 'polygon', x: rg.cx, y: rg.cy, w: 2 * rg.r, sides: rg.sides };
    if (rg.kind === 'ellipse') return { shape: 'ellipse', x: rg.cx, y: rg.cy, w: 2 * rg.rx, h: 2 * rg.ry };
    return { shape: 'rect', x: rg.x, y: rg.y, w: rg.w, h: rg.h };
}

/** The pocket's outer footprint on the stock (rect = corner+size, circle/polygon = centre±R, ellipse = centre±(rx,ry))
 *  — shared by the stack (for PlaceOnStock's snapshot) and the 2D view, so 2D and 3D place identically. */
export function pocketBBox(params = {}) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0), shape = params.shape || 'rect';
    if (shape === 'circle' || shape === 'polygon') {
        const R = num(params.dia, 50) / 2;
        return { minX: ox - R, maxX: ox + R, minY: oy - R, maxY: oy + R };
    }
    if (shape === 'ellipse') {
        const rx = num(params.w, 80) / 2, ry = num(params.h, 60) / 2;
        return { minX: ox - rx, maxX: ox + rx, minY: oy - ry, maxY: oy + ry };
    }
    const w = num(params.w, 80), h = num(params.h, 60);
    return { minX: ox, maxX: ox + w, minY: oy, maxY: oy + h };
}

/** Would insetting the TRUE region by `inset` leave a degenerate (≤0) pocket → too small for the tool to clear?
 *  Checked on the unclamped geometry (offsetRegion floors radii at 0.01, which would hide it). */
function insetTooSmall(rg, inset) {
    if (rg.kind === 'circle') return rg.r - inset <= 0;
    if (rg.kind === 'polygon') return rg.r - inset / Math.cos(Math.PI / rg.sides) <= 0;
    if (rg.kind === 'ellipse') return rg.rx - inset <= 0 || rg.ry - inset <= 0;
    return rg.w - 2 * inset <= 0 || rg.h - 2 * inset <= 0;
}

/** Pocket params → its block stack. The one source of truth for both displays. */
export function pocketStack(params = {}) {
    const shape = params.shape || 'rect';
    const tool = Math.max(0.1, num(params.toolDia, 6)), r = tool / 2;
    const so = Math.max(0.2, tool * num(params.stepoverPct, 40) / 100);
    const clr = num(params.clearance, 5), feed = num(params.feed, 600), plunge = num(params.plunge, 150);
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    const raster = (params.strategy || 'spiral') === 'raster';
    const depth = num(params.depth, 4), by = num(params.stepdown, 1.5);
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing

    // tool-centre region, inset by the tool radius MINUS the wall offset (signed): +offset = bigger pocket (cut
    // oversize), −offset = smaller pocket (leave stock). offset 0 = exact typed size. + too-small detection.
    // CLEANEST for all 4 shapes: build the TRUE region descriptor, inset it with offsetRegion(-inset) (which knows
    // each shape's edge-offset, incl. the polygon cos(π/n) term), then map the result back to region-block params.
    const off = num(params.wallOffset, 0), inset = r - off;
    const trueDesc = regionDesc(trueRegionParams(params));
    const cx = trueDesc.kind === 'rect' ? trueDesc.x + trueDesc.w / 2 : trueDesc.cx;
    const cy = trueDesc.kind === 'rect' ? trueDesc.y + trueDesc.h / 2 : trueDesc.cy;
    const tooSmall = insetTooSmall(trueDesc, inset);
    const region = newBlock('region');
    region.params = regionParamsFromDesc(offsetRegion(trueDesc, -inset));

    if (tooSmall) {   // pocket smaller than the tool → a single centre plunge, pecking to depth
        const hole = newBlock('drill');
        hole.params = { x: cx, y: cy, depth, peck: by, feed: plunge, clearance: clr };
        return [makeStart(params), wcs, makePlace(params, pocketBBox(params), hole), makeEnd(params)];
    }

    const over = newBlock('stepover');
    over.params = { region, stepover: so, strategy: raster ? 'parallel' : 'concentric', direction: 'bothways', z: 'z', feed, plunge, clearance: clr };
    const down = newBlock('stepdown');
    down.params = { to: depth, by };
    down.children = [over];
    if (raster) {   // raster leaves the wall un-finished → a Contour finish pass (arc for circles, polygon for rect)
        const wall = newBlock('contour');   // side 'on': the region is already inset, so this is the inside finish
        wall.params = { region, side: 'on', tool, z: 'z', feed, plunge, clearance: clr };
        down.children.push(wall);
    }
    return [makeStart(params), wcs, makePlace(params, pocketBBox(params), down), makeEnd(params)];
}

export class PocketWizard {
    generate(params) {
        recordOp('pocket', params);   // let the Blocks tab open this op as its stack
        return emitMapped(pocketStack(params)).text;
    }
}
