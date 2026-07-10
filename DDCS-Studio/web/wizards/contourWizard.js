/**
 * wizards/contourWizard.js — profile / contour cut generator (Mill group).
 *
 * A CONTOUR traces a region's boundary OFFSET to a side (outside / inside / on) by the tool radius, stepping down
 * to depth. Implemented as a block stack (its single source of truth): [ StepDown{ Contour(region, side, tool) } ]
 * wrapped in PlaceOnStock. Unlike Pocket, the Region IS the TRUE profile boundary (not pre-inset) — the Contour
 * atom applies the side offset itself, so the FINISHED edge matches the size you type. Form and Blocks view are
 * two editors of this one stack.
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { makeStart, makeEnd, makePlace } from '../blocks/programFraming.js';
import { num } from './ops/util.js';
import { regionDesc } from './ops/region.js';
import { contourRegion } from './ops/contour.js';
import { contourFillBlock } from './ops/contourfill.js';   // the FLAT twin atom — contourStack emits it (byte-identical to the old region-socket contour)

/** The OFFSET toolpath footprint on the stock (the side-offset contour's bounds) — shared by the stack (for
 *  PlaceOnStock's snapshot) and the 2D view, so 2D and 3D place identically. */
export function contourBBox(params = {}) {
    const region = regionParams(params);
    const rg = contourRegion({ region: regionDesc(region), side: params.side || 'outside', tool: num(params.toolDia, 6) });
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const ring of (rg.contour || [])) for (const p of ring) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    return Number.isFinite(minX) ? { minX, maxX, minY, maxY } : { minX: 0, maxX: 0, minY: 0, maxY: 0 };
}

/** The TRUE profile region (rect = corner+size, circle/polygon = centre±R, ellipse = centre±(rx,ry)) — NOT inset
 *  (the Contour atom offsets it by the side). */
function regionParams(params = {}) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0), shape = params.shape || 'rect';
    if (shape === 'circle') return { shape: 'circle', x: ox, y: oy, w: num(params.dia, 50) };
    if (shape === 'polygon') return { shape: 'polygon', x: ox, y: oy, w: num(params.dia, 50), sides: num(params.sides, 6) };
    if (shape === 'ellipse') return { shape: 'ellipse', x: ox, y: oy, w: num(params.w, 80), h: num(params.h, 60) };
    return { shape: 'rect', x: ox, y: oy, w: num(params.w, 80), h: num(params.h, 60) };
}

/** The FLAT contourfill geometry params (shape + all 4 dims present; the atom picks w×h vs dia+sides by shape). Mirrors
 *  regionParams by VALUE so regionDesc(regionFromFlat(this)) == regionDesc(regionParams(params)) → emit byte-identical. */
function contourFlatParams(params = {}) {
    return {
        shape: params.shape || 'rect', x: num(params.originX, 0), y: num(params.originY, 0),
        w: num(params.w, 80), h: num(params.h, 60), dia: num(params.dia, 50), sides: num(params.sides, 6),
    };
}

/** Contour params → its block stack. The one source of truth for both displays. The geometry rides a FLAT `contourfill`
 *  atom (the region-pill→flat reframe) instead of a nested Region SOCKET — so the twin binds each dim positionally —
 *  and emits BYTE-IDENTICAL (contourfill rebuilds the same region descriptor + reuses the same emit kernels). */
export function contourStack(params = {}) {
    const feed = num(params.feed, 400), plunge = num(params.plunge, 200), clearance = num(params.clearance, 5);
    const depth = num(params.depth, 4), stepdown = num(params.stepdown, 1.5);
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing

    const contour = newBlock('contourfill');
    contour.params = { ...contourFlatParams(params), side: params.side || 'outside', tool: num(params.toolDia, 6), z: 'z', feed, plunge, clearance };
    const down = newBlock('stepdown');
    down.params = { to: depth, by: stepdown };
    down.children = [contour];

    return [makeStart(params), wcs, makePlace(params, contourBBox(params), down), makeEnd(params)];
}

export class ContourWizard {
    generate(params) {
        recordOp('contour', params);   // let the Blocks tab open this op as its stack
        return emitMapped(contourStack(params), activeDialectOpts()).text;
    }
}
