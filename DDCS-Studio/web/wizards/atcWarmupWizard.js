/**
 * DDCS Studio - ATC Spindle Warm-up Wizard — staged spindle warmup.
 *
 * REWRITTEN AS A BLOCK STACK: `atcWarmupStack(params)` builds from granular atoms (Comment / Confirm /
 * Spindle / Coolant / Dwell / Message / Label / End Program). Native across posts for free: the Dwell units
 * (ms on Expert/V4.1, seconds on DM500) and the Confirm gate (folds where there's no scripted HMI) come from
 * the active dialect. Form and Blocks view are two editors of this one stack.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
// t1728 (gameplan step 1) — atcWarmupStack MOVED to stacks/atcWarmupWizard.js (the twin's own builder dependency, kept
// importable+re-exported here unchanged for every other existing caller — pure move).
import { atcWarmupStack } from './stacks/atcWarmupWizard.js';
export { atcWarmupStack };

export class AtcWarmupWizard {
    generate(params) {
        recordOp('atc_warmup', params);
        return emitMapped(atcWarmupStack(params), activeDialectOpts()).text;
    }
}
