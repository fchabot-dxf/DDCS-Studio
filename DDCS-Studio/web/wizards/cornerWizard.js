/**
 * DDCS Studio - Corner Wizard — find an OUTSIDE corner (boss): probe two walls, set the WCS X & Y (+ optional Z).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `cornerStack(params)` — a snippet of
 * Comment / Set# / Probe / If Goto / Move / Distance / Label / Goto / Raw / End Program atoms. Form and Blocks
 * view are two editors of the same stack. Same probe logic as the old string builder: optional Z-surface probe,
 * then the two walls in the chosen order (XY/YX) with radius compensation, an N1/N2 error handler, and M30.
 *
 * Functional port (NOT byte-identical to the old generator, same as the edge/middle ports): the atom emitter
 * drops per-line inline comments + blank separators, fixes Q to Q1 (the probe atom's form), and splits the
 * combined `G91 G0 Z#17` into `G91` + `G0 Z#17`. Verified vs the captured old output — probe sequence, #var
 * math, WCS writes and control flow match — and against the M350 ground truth (see ddcs-ground-truth memory).
 *
 * DDCS M350: status #1920/#1921/#1922 (2=SUCCESS, check !=2), trigger pos #1925/#1926/#1927.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { toNum as toNumShared } from './probeBlocks.js';
// t1728 (gameplan step 1) — dirsOf/cornerReposOffsets/cornerHeaderComments/cornerStack MOVED to stacks/cornerWizard.js
// (the twin's own builder dependency, kept importable+re-exported here unchanged for every other existing caller —
// pure move, no signature change).
import { dirsOf, cornerReposOffsets, cornerHeaderComments, cornerStack } from './stacks/cornerWizard.js';
export { dirsOf, cornerReposOffsets, cornerHeaderComments, cornerStack };

export class CornerWizard {
    constructor() {}

    toNum(v, def = 0) {
        return toNumShared(v, def);
    }

    generate(params) {
        recordOp('corner', params);   // let the Blocks tab open this op as its stack
        return emitMapped(cornerStack(params), activeDialectOpts()).text;
    }

    /**
     * Infer where the spindle should START for this corner/config, in the 3D-preview stock frame
     * (stock spans X[0..x] Y[0..y], top at Z=0). The macro is incremental, so this start positions the
     * whole probe path at the chosen corner. Uses the SAME corner→direction convention as cornerStack():
     *   - Z-first ("hover OVER the corner material") → just INSIDE the corner, above the top.
     *   - otherwise ("hover OUTSIDE the corner")     → just OUTSIDE the corner, within probe reach.
     * Purely a preview/sim hint — never written to the G-code, never touches the WCS.
     */
    inferStart(params, stock) {
        const n = (v, d) => this.toNum(v, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80);
        const corner = params.corner || 'FL';
        const zFirst = !!(params.probeZ || params.probeZFirst);
        const seq = params.probeSeq || 'YX';
        const safeZ = n(params.safeZ, 10), radius = n(params.radius, 2);
        const scanDepth = n(params.scanDepth, 5);
        const travel = n(params.travelDist, 50), dist = n(params.dist, 500);
        // corner XY in the stock frame + the probe direction (matches FL=X+Y+ … BR=X−Y−)
        const cornerXY = { FL: [0, 0], FR: [sx, 0], BL: [0, sy], BR: [sx, sy] }[corner] || [0, 0];
        const dir      = { FL: [1, 1], FR: [-1, 1], BL: [1, -1], BR: [-1, -1] }[corner] || [1, 1];
        // The FIRST-probed wall is approached from the open space IN FRONT of it (outside). The OTHER axis
        // sits JUST INSIDE the stock extent near the corner, so the first probe's ray actually crosses the
        // wall (else it runs off the end and never clamps); the macro's travel move then sets up the 2nd wall.
        const overMat  = radius + 5;                                       // Z-first: hover over the material
        const inFront  = Math.max(8, Math.min(travel, dist * 0.3));        // first wall: open space in front
        const nearEdge = Math.min(20, travel * 0.8);                       // perp axis: ~20 mm inside the edge (< travel for the reposition)
        const firstIsX = (seq !== 'YX');                                   // YX → Y first, else X first
        const kFor = (isX) => zFirst ? overMat : ((isX === firstIsX) ? -inFront : nearEdge);
        // Z-TRUST (t107) — under probeZFirst OFF there's NO auto plunge (the operator's jog IS the probe height), so the
        // sim start must sit AT wall height (−scanDepth, below the top-at-0), not hovering at safeZ ABOVE the top (where a
        // horizontal wall probe would fire over the stock + miss). Z-first hovers OVER the material (safeZ) then measures Z down.
        const z = zFirst ? safeZ : -scanDepth;
        return { x: cornerXY[0] + dir[0] * kFor(true), y: cornerXY[1] + dir[1] * kFor(false), z };
    }
}
