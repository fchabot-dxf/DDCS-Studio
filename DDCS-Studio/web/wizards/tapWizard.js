/**
 * wizards/tapWizard.js — TAPPING (thread a hole). The wizard's only implementation is `tapStack(params)` — a single Tap
 * leaf placed on the stock, framed by the standard program start/end. The pitch-locked feed is DERIVED in the Tap atom
 * (F = RPM × pitch), so the form's shown feed can never drift from the emit. The floating-holder cycle runs on every DDCS
 * post; the rigid (G84-style) variant is gated upstream on a declared encoder/servo spindle + the Expert post.
 */
// t1728 (gameplan step 1) — tapStack MOVED to stacks/tapWizard.js (the twin's own builder dependency, kept
// importable+re-exported here unchanged for every other existing caller — pure move, no signature change).
// t1730 (gameplan step 2, Tier A) — TapWizard (the legacy screen class) DELETED: zero importers anywhere in
// web/ (no tapView.js ever existed — confirmed at t1728's classification and again here), so nothing reaches
// it. Only the builder this file re-exports is still live.
import { tapStack } from './stacks/tapWizard.js';
export { tapStack };
