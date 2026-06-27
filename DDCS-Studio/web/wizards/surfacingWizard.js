/**
 * wizards/surfacingWizard.js — face / surfacing generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard has ONE implementation — `surfacingStack(params)` builds the
 * primitive stack and `generate()` emits it. The STUDIO form and the Blocks view are two editors of that
 * same stack, so the G-code is identical by construction (no parallel converter). Surfacing = StepDown{
 * StepOver(Region) } with NO radius inset (the area is the tool-CENTRE sweep, so the tool overhangs the edge
 * and faces the whole top) and no wall pass. Rect only; raster → parallel rows, else concentric rings.
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { recordOp } from '../blocks/opRecord.js';
import { makeStart, makeEnd, makePlace } from '../blocks/programFraming.js';
import { num } from './ops/util.js';

/** The faced area's footprint on the stock — shared by the stack (PlaceOnStock snapshot) + the 2D view. */
export function surfacingBBox(params = {}) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    return { minX: ox, maxX: ox + num(params.w, 100), minY: oy, maxY: oy + num(params.h, 80) };
}

/** Surfacing params → [ StepDown{ StepOver(Region) } ]. The one source of truth for both displays. */
export function surfacingStack(params = {}) {
    const tool = Math.max(0.1, num(params.toolDia, 12));
    const so = Math.max(0.2, tool * num(params.stepoverPct, 60) / 100);
    const clr = num(params.clearance, 5), feed = num(params.feed, 800), plunge = num(params.plunge, 200);
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    const raster = (params.strategy || 'raster') === 'raster';

    const fill = newBlock('surfacefill');
    fill.params = { shape: 'rect', x: ox, y: oy, w: num(params.w, 100), h: num(params.h, 80), stepover: so, strategy: raster ? 'parallel' : 'concentric', direction: 'bothways', z: 'z', feed, plunge, clearance: clr };

    const down = newBlock('stepdown');
    down.params = { to: num(params.depth, 0.5), by: num(params.stepdown, 0.5) };
    down.children = [fill];
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing
    return [makeStart(params), wcs, makePlace(params, surfacingBBox(params), down), makeEnd(params)];   // Start … WCS … placed op … End
}

export class SurfacingWizard {
    generate(params) {
        recordOp('surfacing', params);   // let the Blocks tab open this op as its stack
        const w = num(params.w, 100), h = num(params.h, 80);
        // Emit THROUGH the block stack — the same stack the Blocks tab renders/edits.
        const stack = (w <= 0 || h <= 0) ? [makeStart(params), makeEnd(params)] : surfacingStack(params);
        return emitMapped(stack).text;
    }
}
