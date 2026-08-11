/**
 * wizards/stacks/contourWizard.js — profile / contour cut generator (Mill group).
 *
 * A CONTOUR traces a region's boundary OFFSET to a side (outside / inside / on) by the tool radius, stepping down
 * to depth. Implemented as a block stack (its single source of truth): [ StepDown{ Contour(region, side, tool) } ]
 * wrapped in PlaceOnStock. Unlike Pocket, the Region IS the TRUE profile boundary (not pre-inset) — the Contour
 * atom applies the side offset itself, so the FINISHED edge matches the size you type. Form and Blocks view are
 * two editors of this one stack.
 */
import { newBlock } from '../../blocks/blockEmitter.js';
import { makeStart, makeEnd, makePlace } from '../../blocks/programFraming.js';
import { num } from '../ops/util.js';
import { contourBBox } from '../contourWizard.js';   // contourBBox stays SCREEN-side (shared with contourView.js) — imported back here for the builder's own use

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
    const feed = num(params.feed, 2000), plunge = num(params.plunge, 200), clearance = num(params.clearance, 5);
    const depth = num(params.depth, 4), stepdown = num(params.stepdown, 1.5);
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing

    const contour = newBlock('contourfill');
    contour.params = { ...contourFlatParams(params), side: params.side || 'outside', tool: num(params.toolDia, 6),
        entry: params.entry || 'plunge', rampAngle: num(params.rampAngle, 3), by: 'by',   // t842 — depth entry (by from the StepDown scope for prevZ)
        z: 'z', feed, plunge, clearance };
    const down = newBlock('stepdown');
    down.params = { to: depth, by: stepdown, confirmEvery: num(params.confirmEvery, 0) };   // t1031 — confirmEvery pause (0 = off → byte-identical)
    down.children = [contour];

    return [makeStart(params), wcs, makePlace(params, contourBBox(params), down), makeEnd(params)];
}
