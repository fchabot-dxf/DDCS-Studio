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
// t1728 (gameplan step 1) — edgeStack MOVED to stacks/edgeWizard.js (the twin's own builder dependency, kept
// importable+re-exported here unchanged for every other existing caller — pure move, no signature change).
// t1730 (gameplan step 2, Tier B) — EdgeWizard (the legacy screen class) DELETED alongside its sole consumer,
// views/edgeView.js (retired — see WORK-LOG t1730). Only the builder this file re-exports is still live.
import { edgeStack } from './stacks/edgeWizard.js';
export { edgeStack };
