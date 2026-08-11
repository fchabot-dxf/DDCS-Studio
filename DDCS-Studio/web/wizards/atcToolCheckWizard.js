/**
 * DDCS Studio - ATC Tool Breakage / Length Re-check Wizard — quick tap on the fixed setter that ABORTS if
 * the tool is broken, missing, or the wrong length (deviation beyond ± tolerance vs the stored value).
 *
 * REWRITTEN AS A BLOCK STACK: `atcToolCheckStack(params)` from granular atoms. Native across posts: probe
 * form, Z trigger read, the tool-table base, status-check folding and the confirm gate all come from the dialect.
 * Re-measures with the same convention as the Tool Length wizard (length = MachineZ − block height).
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
// t1728 (gameplan step 1) — atcToolCheckHeaderComments/atcToolCheckStack MOVED to stacks/atcToolCheckWizard.js (the twin's
// own builder dependency, kept importable+re-exported here unchanged for every other existing caller — pure move).
import { atcToolCheckHeaderComments, atcToolCheckStack } from './stacks/atcToolCheckWizard.js';
export { atcToolCheckHeaderComments, atcToolCheckStack };

export class AtcToolCheckWizard {
    generate(params) {
        recordOp('atc_check', params);
        return emitMapped(atcToolCheckStack(params), activeDialectOpts()).text;
    }
}
