/**
 * wizards/tapWizard.js — TAPPING (thread a hole). The wizard's only implementation is `tapStack(params)` — a single Tap
 * leaf placed on the stock, framed by the standard program start/end. The pitch-locked feed is DERIVED in the Tap atom
 * (F = RPM × pitch), so the form's shown feed can never drift from the emit. The floating-holder cycle runs on every DDCS
 * post; the rigid (G84-style) variant is gated upstream on a declared encoder/servo spindle + the Expert post.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
// t1728 (gameplan step 1) — tapStack MOVED to stacks/tapWizard.js (the twin's own builder dependency, kept
// importable+re-exported here unchanged for every other existing caller — pure move, no signature change).
import { tapStack } from './stacks/tapWizard.js';
export { tapStack };

export class TapWizard {
    generate(params) {
        recordOp('tap', params);
        return emitMapped(tapStack(params), activeDialectOpts()).text;
    }
    inferStart() { return { x: 0, y: 0, z: num(arguments[0] && arguments[0].clearance, 5) }; }
}
