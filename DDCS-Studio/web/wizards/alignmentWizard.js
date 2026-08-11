/**
 * DDCS Studio - Alignment Wizard — measure angular misalignment of a fence/edge vs a machine axis.
 *
 * REWRITTEN AS A BLOCK STACK: `alignmentStack(params)` builds the macro from GRANULAR, dialect-aware atoms
 * (Comment / Set# / Confirm / Distance / Read Machine / Probe / Probe Check / Probe Read / Move / Message /
 * If Goto / Goto / Label / End Program). Because every controller-specific line goes through an atom, the SAME
 * stack emits natively for Expert M350 / V4.1 / DM500 (probe form, status check folding, DRO var, HMI prompt
 * all swap per active post). Form and Blocks view are two editors of this one stack.
 *
 * PURPOSE: probe the fence at point A, operator jogs along the fence to point B, probe again. Misalignment
 * angle = ATAN(delta / span), where delta = contactB − contactA (probe axis), span = machine coord B − A
 * (check axis). On controllers with no scripted HMI (V4.1/DM500) the Confirm gates fold away — the operator
 * just positions the tool between runs.
 *
 * DDCS M350: status #1920/#1921 (2=SUCCESS), trigger pos #1925/#1926, DRO #880/#881 (check-axis machine coord).
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { opSimStarts } from '../viz/opSimStarts.js';
// t1728 (gameplan step 1) — alignmentHeaderComments/alignmentStack MOVED to stacks/alignmentWizard.js (the twin's own
// builder dependency, kept importable+re-exported here unchanged for every other existing caller — pure move).
import { alignmentHeaderComments, alignmentStack } from './stacks/alignmentWizard.js';
export { alignmentHeaderComments, alignmentStack };

export class AlignmentWizard {
    constructor() {}

    generate(params) {
        recordOp('alignment', params);   // let the Blocks tab open this op as its stack
        return emitMapped(alignmentStack(params), activeDialectOpts()).text;
    }

    /** Preview start (first probe, point A). */
    inferStart(params, stock) {
        return this.inferStarts(params, stock)[0];
    }

    // Per-pass preview starts → the shared sim-start registry (viz/opSimStarts.js, BUILT_IN.alignment). Moved verbatim.
    inferStarts(params, stock) { return opSimStarts('alignment', params, stock); }
}
