/**
 * DDCS Studio - ATC Tool Length Setter Wizard — touch a tool on the fixed setter, save the length offset
 * into the controller's tool table.
 *
 * REWRITTEN AS A BLOCK STACK: `atcLengthStack(params)` from granular atoms (Comment / Set# / Confirm /
 * Spindle / Coolant / Distance / Probe / Probe Check / Probe Read / Tool Offset / Move / Message / If Goto /
 * Goto / Label / End Program). Native across posts: the probe form, the Z trigger read, the tool-table base
 * (#1430 Expert/DM500, #1560 V4.1), the status-check folding and the confirm gate all come from the dialect.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
// t1728 (gameplan step 1) — atcLengthHeaderComments/atcLengthStack MOVED to stacks/atcLengthWizard.js (the twin's
// own builder dependency, kept importable+re-exported here unchanged for every other existing caller — pure move).
import { atcLengthHeaderComments, atcLengthStack } from './stacks/atcLengthWizard.js';
export { atcLengthHeaderComments, atcLengthStack };

export class AtcLengthWizard {
    generate(params) {
        recordOp('atc_length', params);
        return emitMapped(atcLengthStack(params), activeDialectOpts()).text;
    }
}
