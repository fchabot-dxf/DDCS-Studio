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
// t1728 (gameplan step 1) — alignmentHeaderComments/alignmentStack MOVED to stacks/alignmentWizard.js (the twin's own
// builder dependency, kept importable+re-exported here unchanged for every other existing caller — pure move).
// t1730 (gameplan step 2, Tier B) — AlignmentWizard (the legacy screen class) DELETED alongside its sole
// consumer, views/alignmentView.js (retired — see WORK-LOG t1730). Only the builder this file re-exports is
// still live.
import { alignmentHeaderComments, alignmentStack } from './stacks/alignmentWizard.js';
export { alignmentHeaderComments, alignmentStack };
