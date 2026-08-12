/**
 * DDCS Studio - Middle Wizard — find the centre of a pocket (inside) or boss (outside).
 *
 * REWRITTEN AS A BLOCK STACK: `middleStack(params)` builds the probe macro from atoms (Comment / Set# /
 * Probe / If Goto / Move / Machine Move / Distance / Label / Goto / End Program) and `generate()` emits it.
 * A snippet (its own confirm + N1/N2 error handler + M30). Two-pass probe each wall, average to the centre;
 * 2-axis repeats on the perpendicular axis (in the chosen secondary direction) after a reposition.
 *
 * ── SUPERSET (E0, t371) ──────────────────────────────────────────────────────────────────────────────────
 * `middleStack(params, { superset:true })` seeds the data-TWIN as an ALL-ARMS-PRESENT template: every
 * STRUCTURAL fork (featureType / inAxis / transAxis / twoAxis / circular / probeZ / wcs / syncA) emits BOTH
 * arms, each wrapped in a `guard` block, so instantiate()/pruneGuards collapses it to either concrete shape.
 * Superset OFF (the built-in wizard + every existing caller/test) is BYTE-IDENTICAL to today. The same
 * cornerStack pattern (② B4 M2): a structural toggle becomes a re-authorable prune-selected branch of pure
 * DATA, not JS-locked structure. NOTE: axis / dir1 / dir2 and the numeric scalars are VALUE/order swaps, not
 * structural forks — they stay baked here and become bindings in E1 (the data-op + the feature-read slice).
 *
 * DDCS M350: status #1920/#1921 (2=SUCCESS), trigger pos #1925/#1926, stop #1905/#1906, limit #1915/#1916.
 */
// t1728 (gameplan step 1) — middleAxes/middleStack MOVED to stacks/middleWizard.js (the twin's own builder
// dependency, kept importable+re-exported here unchanged for every other existing caller — pure move, no
// signature change). middleAxes fans out to viz/middleVizUtils.js, viz/opSimStarts.js, wizards/ops/panelTypes.js.
// t1730 (gameplan step 2, Tier B) — MiddleWizard (the legacy screen class) DELETED alongside its sole
// consumer, views/middleView.js (retired — see WORK-LOG t1730); circularWizard.js (a second class-level
// consumer) was ALSO deleted in the same act (Tier A — no twin, no reachable UI path). Only the builders this
// file re-exports are still live.
import { middleAxes, middleStack } from './stacks/middleWizard.js';
export { middleAxes, middleStack };
