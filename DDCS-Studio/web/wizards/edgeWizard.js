/**
 * DDCS Studio - Edge Wizard
 * Probe one wall, set a WCS axis to that position. (For center between two edges, use the Middle Wizard.)
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `edgeStack(params)` — a snippet of
 * Comment / Set# / Probe / IfGoto / Move / Distance / Label / Goto / End Program atoms, emitted bare.
 * Form and Blocks view are two editors of the same stack. The probe macro form (G31 X#8 F#3 P#5 L0 Q1,
 * single-axis G0 X#9) comes straight from the #var-aware Probe/Move atoms.
 *
 * DDCS M350: status #1920/#1921 (2=SUCCESS, check !=2), trigger pos #1925/#1926.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
// t1728 (gameplan step 1) — edgeStack MOVED to stacks/edgeWizard.js (the twin's own builder dependency, kept
// importable+re-exported here unchanged for every other existing caller — pure move, no signature change).
import { edgeStack } from './stacks/edgeWizard.js';
export { edgeStack };

export class EdgeWizard {
    generate(params) {
        recordOp('edge', params);   // let the Blocks tab open this op as its stack
        return emitMapped(edgeStack(params), activeDialectOpts()).text;   // a snippet: no Program Start/End blocks
    }

    /** Preview/sim start hint (stock frame): park clear of the wall being probed, perpendicular axis at centre —
     *  the single-wall version of the Middle/Corner inferStart, so the probe approaches the face from open space.
     *  dir pos probes +axis (hits the near/0 face from outside); dir neg probes −axis (hits the far face). */
    inferStart(params, stock) {
        const n = (v, d) => num(v, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const cx = sx / 2, cy = sy / 2, probeZ = -Math.min(5, sz * 0.5);
        const outset = Math.max(6, Math.min(n(params.dist, 15) * 0.6, 15));
        const pos = (params.dir || 'pos') !== 'neg';
        return ((params.axis || 'X') === 'X')
            ? { x: pos ? -outset : sx + outset, y: cy, z: probeZ }
            : { x: cx, y: pos ? -outset : sy + outset, z: probeZ };
    }

    /** Per-pass start hints (the panel seeds the draggable ① marker from these). Edge is ONE pass → one start, so the
     *  marker count stays in lockstep with the macro (a single probe-surface touch). TRAVEL-START inc1: the start IS the
     *  source — dragging the marker derives the reach (#1) GUI-side (see edgeView.tieEdgeDist). */
    inferStarts(params, stock) { return [this.inferStart(params, stock)]; }
}
