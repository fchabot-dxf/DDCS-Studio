/**
 * DDCS Studio - Rotary Clock Wizard (A0 to a feature) — datum the rotary axis off a FLAT.
 *
 * REWRITTEN AS A BLOCK STACK: `rotaryClockStack(params)` from granular, dialect-aware atoms. Native across
 * posts: probe form, status-check folding, the A-axis DRO read (Read Machine), the A work-offset write (Set
 * WCS Offset) and the confirm gate all come from the active dialect.
 *
 * Method (horizontal 4th axis, spin around X): probe down at point A, step +Y by the span, probe down at B.
 * tilt phi = ATAN[(Zb-Za)/span]. Datum A so the level orientation reads A0 (set / report / rotate).
 */
// t1728 (gameplan step 1) — rotaryClockHeaderComments/rotaryClockStack MOVED to stacks/rotaryClockWizard.js (the twin's
// own builder dependency, kept importable+re-exported here unchanged for every other existing caller — pure move).
// t1730 (gameplan step 2, Tier B) — RotaryClockWizard (the legacy screen class) DELETED alongside its sole
// consumer, views/rotaryClockView.js (retired — see WORK-LOG t1730). Only the builder this file re-exports
// is still live.
import { rotaryClockHeaderComments, rotaryClockStack } from './stacks/rotaryClockWizard.js';
export { rotaryClockHeaderComments, rotaryClockStack };
