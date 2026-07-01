/**
 * wizards/ops/contourFill.js — CONTOUR FILL: flat, data-portable profile/contour primitive (kind:'leaf').
 *
 * Like `surfacefill` for surfacing, this is the dedicated flat-geometry atom for contour cutting.
 * NO Region reporter socket — all geometry is flat scalar fields that map to clean (blockIndex,key) data-def
 * bindings. Reuses the existing contour tracing machinery from contour.js / clearing.js.
 *
 * The atom traces a region boundary OFFSET to a side (outside / inside / on) by the tool radius, stepping
 * to the current cut Z (set by an enclosing StepDown). Unlike Pocket, the region IS the TRUE profile boundary
 * (not pre-inset) — the side offset is applied here, so the FINISHED edge matches the size you type.
 *
 * Shape conventions:
 *   rect:     corner at (x,y), size w×h
 *   circle:   centre at (x,y), diameter = dia
 *   polygon:  centre at (x,y), circum-diameter = dia, sides = sides
 *   ellipse:  centre at (x,y), diameters w (X) × h (Y)
 */
import { num, r3 } from './util.js';
import { contourLevel } from '../clearing.js';
import { pointsBBox } from './placement.js';
import { contourRegion, sideOffset } from './contour.js';
import { regionDesc } from './region.js';

/** Build a region descriptor from the flat contourfill params (shape + geometry). Circle/polygon use `dia` as
 *  the diameter, centre at (x,y); ellipse uses w/h as diameters; rect uses corner (x,y) + w×h. */
function contourRegionFromParams(p) {
    const shape = p.shape || 'rect';
    if (shape === 'circle') {
        const d = num(p.dia, 50);
        return regionDesc({ shape: 'circle', x: num(p.x, 0), y: num(p.y, 0), w: d, h: d });
    }
    if (shape === 'polygon') {
        const d = num(p.dia, 50);
        return regionDesc({ shape: 'polygon', x: num(p.x, 0), y: num(p.y, 0), w: d, sides: num(p.sides, 6) });
    }
    if (shape === 'ellipse') {
        return regionDesc({ shape: 'ellipse', x: num(p.x, 0), y: num(p.y, 0), w: num(p.w, 80), h: num(p.h, 60) });
    }
    return regionDesc({ shape: 'rect', x: num(p.x, 0), y: num(p.y, 0), w: num(p.w, 80), h: num(p.h, 60) });
}

/** The offset toolpath region (region + side offset applied via contourRegion) — matches emitted G-code. */
function offsetToolpath(p) {
    const rg = contourRegionFromParams(p);
    return contourRegion({ region: rg, side: p.side || 'outside', tool: num(p.tool, 6) });
}

/** Compute the bbox of the offset toolpath — used by placeOnStock's liveExtent. */
function contourFillExtent(p) {
    const rg = offsetToolpath(p);
    const pts = (rg.contour || []).flat();
    return pts.length ? pointsBBox(pts) : { minX: 0, minY: 0, maxX: 1, maxY: 1 };
}

/** Crisp circular contour: rapid to the rim, plunge, one full G3 circle, retract. */
function circleTrace(rg, z, clr, feed, plunge) {
    const x = r3(rg.cx + rg.r), y = r3(rg.cy);
    return [`G0 Z${r3(clr)}`, `G0 X${x} Y${y}`, `G1 Z${r3(z)} F${plunge}`, `G3 X${x} Y${y} I${r3(-rg.r)} J0 F${feed}   ( contour )`];
}

export const contourFillBlock = {
    type: 'contourfill', label: 'Contour Fill', kind: 'leaf', category: 'Toolpaths',
    defaults: {
        shape: 'rect', x: 0, y: 0, w: 80, h: 60, dia: 50, sides: 6,
        side: 'outside', tool: 6, z: 'z', feed: 400, plunge: 200, clearance: 5,
    },
    // All flat scalar fields (no region reporter) — shape controls which geometry fields are live:
    //   rect:     x, y, w, h
    //   circle:   x, y, dia
    //   polygon:  x, y, dia, sides
    //   ellipse:  x, y, w, h
    fields: ['shape', 'x', 'y', 'w', 'h', 'dia', 'sides', 'side', 'tool', 'z', 'feed', 'plunge', 'clearance'],
    emit: (p) => {
        const rg = offsetToolpath(p);
        const z = num(p.z, 0), clr = num(p.clearance, 5), feed = num(p.feed, 400), plunge = num(p.plunge, 200);
        // Circle gets a crisp G3 arc; all other shapes trace the (offset) polygon contour
        if ((p.shape || 'rect') === 'circle' && rg.kind === 'circle') {
            return circleTrace(rg, z, clr, feed, plunge);
        }
        return contourLevel(rg.contour || [], { z, clr, feed, plunge });
    },
    extent: (p) => contourFillExtent(p),
};
