/**
 * wizards/pocketWizard.js — pocket clearing generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `pocketStack(params)`. The walk is the tool-CENTRE
 * boundary (inset by the tool radius) so the FINISHED pocket matches the size you type. Strategy raster → parallel
 * rows + a Wall finish; spiral → concentric rings (which reach the wall). A pocket smaller than the tool falls back
 * to a single centre plunge (peck). Form and Blocks view are two editors of this one stack.
 *
 * ── THE SHAPE IT BUILDS, AND WHY THERE ARE TWO OF THEM (t1406 · t1433) ────────────────────────────────────────────
 * ELIGIBLE (rect, big enough, no rest tool, a bridged direction/descent — `pocketRidesRaster`):
 *     Place'clear'{ surfaceraster }   [ + Place'wall'{ wallfinish } on raster ]
 *   two parametric atoms, each ALONE in its own place so the placement is absorbed as params rather than painted
 *   onto macro text (t1349's shear). Each owns its own depth loop; there is no StepDown on this arm at all.
 * REFUSED (everything else):
 *     Place'clear'{ StepDown{ pocketfill [+ pocketwall] [+ REST] } }
 *   the literal transcript, byte-identical to what it has always emitted, which is what makes the boundary testable.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
// t1728 (gameplan step 1) — pocketBBox/pocketTooSmall/pocketMaxToolDia/pocketToolRefuses/pocketToolRefusal/
// pocketDrillCentre/pocketRasterStrategy/pocketRasterGap/pocketRidesRaster/pocketStack MOVED to stacks/pocketWizard.js
// (the twin's own builder dependency, kept importable+re-exported here unchanged for every other existing caller —
// pure move, no signature change). regionParamsFromDesc stays HERE, unmoved — it has zero callers anywhere in the
// app (not even internally), so severing the twin's dependency doesn't need it to move.
import {
    pocketBBox, pocketTooSmall, pocketMaxToolDia, pocketToolRefuses, pocketToolRefusal,
    pocketDrillCentre, pocketRasterStrategy, pocketRasterGap, pocketRidesRaster, pocketStack,
} from './stacks/pocketWizard.js';
export {
    pocketBBox, pocketTooSmall, pocketMaxToolDia, pocketToolRefuses, pocketToolRefusal,
    pocketDrillCentre, pocketRasterStrategy, pocketRasterGap, pocketRidesRaster, pocketStack,
};

/** A region DESCRIPTOR → region-block params (the inverse of regionDesc): rect = corner+size, circle/polygon =
 *  centre + Ø (polygon keeps its sides), ellipse = centre + the two diameters. */
export function regionParamsFromDesc(rg) {
    if (rg.kind === 'circle') return { shape: 'circle', x: rg.cx, y: rg.cy, w: 2 * rg.r };
    if (rg.kind === 'polygon') return { shape: 'polygon', x: rg.cx, y: rg.cy, w: 2 * rg.r, sides: rg.sides };
    if (rg.kind === 'ellipse') return { shape: 'ellipse', x: rg.cx, y: rg.cy, w: 2 * rg.rx, h: 2 * rg.ry };
    return { shape: 'rect', x: rg.x, y: rg.y, w: rg.w, h: rg.h };
}

export class PocketWizard {
    generate(params) {
        recordOp('pocket', params);   // let the Blocks tab open this op as its stack
        return emitMapped(pocketStack(params), activeDialectOpts()).text;
    }
}
