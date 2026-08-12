/**
 * DDCS Studio - Rotary Centreline Wizard (4th-axis setup) — A-axis centreline + radius of a cylinder on a
 * horizontal 4th axis. Sets Y0 on the centreline, Z0 on the centreline OR the OD top.
 *
 * REWRITTEN AS A BLOCK STACK: `rotaryCenterStack(params)` from granular, dialect-aware atoms. Native across
 * posts: probe form, status-check folding, the Y/Z DRO reads (Read Machine), the WCS writes (Set WCS Offset)
 * and the confirm/reposition gates all come from the active dialect.
 *
 *   known — enter the blank diameter; probe top + ±Y. Yc = midpoint of flanks; Zc = top − R. 3 touches.
 *   fit   — no diameter: probe 3 points on the Y-Z circle and solve centre + R. ADVANCED — verify on machine.
 */
// t1728 (gameplan step 1) — rotaryCenterHeaderComments/rotaryCenterStack MOVED to stacks/rotaryCenterWizard.js (the twin's
// own builder dependency, kept importable+re-exported here unchanged for every other existing caller — pure move).
// t1730 (gameplan step 2, Tier B) — RotaryCenterWizard (the legacy screen class) DELETED alongside its sole
// consumer, views/rotaryCenterView.js (retired — see WORK-LOG t1730). Only the builder this file re-exports
// is still live.
import { rotaryCenterHeaderComments, rotaryCenterStack } from './stacks/rotaryCenterWizard.js';
export { rotaryCenterHeaderComments, rotaryCenterStack };
