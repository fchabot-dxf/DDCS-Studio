/**
 * DDCS Studio - Middle Wizard — find the centre of a pocket (inside) or boss (outside).
 *
 * REWRITTEN AS A BLOCK STACK: `middleStack(params)` builds the probe macro from atoms (Comment / Set# /
 * Probe / If Goto / Move / Machine Move / Distance / Label / Goto / End Program) and `generate()` emits it.
 * A snippet (its own confirm + N1/N2 error handler + M30). Two-pass probe each wall, average to the centre;
 * 2-axis repeats on the perpendicular axis (in the chosen secondary direction) after a reposition.
 *
 * ── SUPERSET (E0, t371) ──────────────────────────────────────────────────────────────────────────────────
 * `middleStack(params, { superset:true })` seeds the data-TWIN as an ALL-ARMS-PRESENT template: every
 * STRUCTURAL fork (featureType / inAxis / transAxis / twoAxis / circular / probeZ / wcs / syncA) emits BOTH
 * arms, each wrapped in a `guard` block, so instantiate()/pruneGuards collapses it to either concrete shape.
 * Superset OFF (the built-in wizard + every existing caller/test) is BYTE-IDENTICAL to today. The same
 * cornerStack pattern (② B4 M2): a structural toggle becomes a re-authorable prune-selected branch of pure
 * DATA, not JS-locked structure. NOTE: axis / dir1 / dir2 and the numeric scalars are VALUE/order swaps, not
 * structural forks — they stay baked here and become bindings in E1 (the data-op + the feature-read slice).
 *
 * DDCS M350: status #1920/#1921 (2=SUCCESS), trigger pos #1925/#1926, stop #1905/#1906, limit #1915/#1916.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { opSimStarts } from '../viz/opSimStarts.js';
// t1728 (gameplan step 1) — middleAxes/middleStack MOVED to stacks/middleWizard.js (the twin's own builder
// dependency, kept importable+re-exported here unchanged for every other existing caller — pure move, no
// signature change). middleAxes has the widest fan-out in the registry (viz/*, ops/panelTypes.js,
// circularWizard.js, views/middleView.js all read it through THIS path); none of them need to change.
import { middleAxes, middleStack } from './stacks/middleWizard.js';
export { middleAxes, middleStack };

export class MiddleWizard {
    generate(params) {
        recordOp('middle', params);   // let the Blocks tab open this op as its stack
        return emitMapped(middleStack(params), activeDialectOpts()).text;
    }

    /**
     * Per-pass preview starts — ONE per parser pass (each REPOSITION: in the macro starts a new pass, so the
     * counts here MUST mirror the reposition() calls in middleStack, else extra markers fall back to the origin).
     *   pocket            → 1 pass: probe both walls from the centre (no reposition).
     *   boss single-axis  → manual: 2 (wall1, wall2); auto: 1 (traverses over hands-free).
     *   boss two-axis     → manual: 4 (X w1/w2, Y w1/w2); auto: 2 (one per axis, with the between-axes reposition).
     */
    // Per-pass preview starts → the shared sim-start registry (viz/opSimStarts.js, BUILT_IN.middle). Moved verbatim; one
    // home for the per-pass inference + the wizard-maker seam (declare, never infer).
    inferStarts(params, stock) { return opSimStarts('middle', params, stock); }

    /** Preview/sim start hint = the first pass's start. */
    inferStart(params, stock) {
        return this.inferStarts(params, stock)[0];
    }
}
