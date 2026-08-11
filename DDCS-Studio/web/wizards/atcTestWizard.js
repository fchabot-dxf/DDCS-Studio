/**
 * DDCS Studio - ATC Commissioning Test Wizard (drawbar cycle / pocket dry-run).
 *
 * REWRITTEN AS A BLOCK STACK: `atcTestStack(params)` from granular atoms (Comment / Set# / Spindle / Coolant /
 * Machine Move / M-Code / Dwell / Confirm / Message / If Goto / Goto / Label / End Program). G53 moves + dwell
 * units render per post, so the same stack is native across posts.
 *
 * DRAWBAR mode — cycle the drawbar N times (M154/M155) and verify the sensors (M301/M302) every cycle.
 * POCKETS mode — visit every magazine pocket at clearance height (tables #1330/#1350/#1370) for a visual check.
 * Both run in the Studio simulator (Run + Auto sensors) before the first powered test.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
// t1728 (gameplan step 1) — atcTestStack/atcTestEffectiveMode MOVED to stacks/atcTestWizard.js (the twin's own builder
// dependency, kept importable+re-exported here unchanged for every other existing caller — pure move).
import { atcTestStack, atcTestEffectiveMode } from './stacks/atcTestWizard.js';
export { atcTestStack, atcTestEffectiveMode };

export class AtcTestWizard {
    generate(params) {
        recordOp('atc_test', params);
        return emitMapped(atcTestStack(params), activeDialectOpts()).text;
    }
}
