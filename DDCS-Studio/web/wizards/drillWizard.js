/**
 * wizards/drillWizard.js — hole-pattern generator (the first Mill-group op).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `drillStack(params)` → [ Array{ Drill | Bore } ]
 * — an Array container (patternPoints) stamping a hole leaf (peck Drill, or helical Bore) at each point, with
 * `skip` omitting holes by 1-based number. The wizard form and the Blocks view are two editors of this one
 * stack; the pattern kernel (patternPoints) lives in ops/ and is shared. The hole KERNELS are gone as of t1391 —
 * `peckDrill` / `helicalBore` unrolled their loops in JS and baked every Z; `holecycle` walks the same shapes at RUN time.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { patternPoints } from './ops/index.js';
import { num } from './ops/util.js';

// Re-export so views (drillView) keep importing the pattern geometry from here.
export { patternPoints };

// t1728 (gameplan step 1) — cycleForMethod/drillStack MOVED to stacks/drillWizard.js (the twin's own builder
// dependency, kept importable+re-exported here unchanged for every other existing caller — pure move, no
// signature change). methodRampForCycle stays HERE, unmoved — it has no dataOps consumer (opSession.js's
// Blocks-tab param-reconcile is its only caller), so severing the twin's dependency doesn't need it to move.
import { cycleForMethod, drillStack } from './stacks/drillWizard.js';
export { cycleForMethod, drillStack };

/**
 * THE INVERSE, declared HERE beside its forward pair rather than hand-rolled at the one place that needs it (t1387).
 *
 * The block→form reverse-sync has to answer the opposite question: this stack says `cycle`, so what did the FORM say?
 * Before the switch it read the answer off the block TYPE (a `bore` leaf meant helical), and the fold removed that
 * signal — the two knobs are one now. Writing the mapping out again inside the reconciler would be a second copy of a
 * two-way correspondence, which is exactly the thing that drifts: someone adds a fourth cycle, updates the forward
 * table, and the form silently stops round-tripping. One pair, one place.
 *
 * It returns the WIZARD's vocabulary (`method` + `ramp`), because that is what the form's fields hold.
 */
export const methodRampForCycle = (cycle) => (cycle === 'bore-helix' ? { method: 'helical', ramp: 'helix' }
    : cycle === 'bore-step' ? { method: 'helical', ramp: 'step' }
        : { method: 'peck', ramp: 'step' });

export class DrillWizard {
    generate(params) {
        recordOp('drill', params);   // let the Blocks tab open this op as its stack
        return emitMapped(drillStack(params), activeDialectOpts()).text;   // placement is baked into the stack (drillStack)
    }

    /** Preview/sim start hint (work frame): origin; the pattern is drawn from there. */
    inferStart() { return { x: 0, y: 0, z: num(arguments[0] && arguments[0].clearance, 5) }; }
}
