/**
 * DDCS Studio - Corner Wizard — find an OUTSIDE corner (boss): probe two walls, set the WCS X & Y (+ optional Z).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `cornerStack(params)` — a snippet of
 * Comment / Set# / Probe / If Goto / Move / Distance / Label / Goto / Raw / End Program atoms. Form and Blocks
 * view are two editors of the same stack. Same probe logic as the old string builder: optional Z-surface probe,
 * then the two walls in the chosen order (XY/YX) with radius compensation, an N1/N2 error handler, and M30.
 *
 * Functional port (NOT byte-identical to the old generator, same as the edge/middle ports): the atom emitter
 * drops per-line inline comments + blank separators, fixes Q to Q1 (the probe atom's form), and splits the
 * combined `G91 G0 Z#17` into `G91` + `G0 Z#17`. Verified vs the captured old output — probe sequence, #var
 * math, WCS writes and control flow match — and against the M350 ground truth (see ddcs-ground-truth memory).
 *
 * DDCS M350: status #1920/#1921/#1922 (2=SUCCESS, check !=2), trigger pos #1925/#1926/#1927.
 */
// t1728 (gameplan step 1) — dirsOf/cornerReposOffsets/cornerHeaderComments/cornerStack MOVED to stacks/cornerWizard.js
// (the twin's own builder dependency, kept importable+re-exported here unchanged for every other existing caller —
// pure move, no signature change).
// t1730 (gameplan step 2, Tier A) — CornerWizard (the legacy screen class) DELETED: zero importers anywhere in
// web/ (its View + #wiz_corner panel were retired 2026-07-02, well before this act — see ARCHITECTURE.md TRAP5).
// Only the builders this file re-exports are still live (opBuilders.js's `corner: cornerStack` back-compat entry
// + the twin).
import { dirsOf, cornerReposOffsets, cornerHeaderComments, cornerStack } from './stacks/cornerWizard.js';
export { dirsOf, cornerReposOffsets, cornerHeaderComments, cornerStack };
