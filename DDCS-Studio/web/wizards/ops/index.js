/**
 * wizards/ops/index.js — primitive-block REGISTRY (the app's "DNA").
 *
 * Block kinds:
 *   leaf       — a self-contained feature (line, bore, drill, wall): emit(params, dx, dy)
 *   move       — a single motion atom (probe…): emit standalone + step(params, pt) when swept
 *   container  — STAMP modifier (array): replicates a feature at pattern points
 *   path       — SWEEP modifier (helix): runs a move along generated points
 *   depth      — DEPTH wrapper (StepDown): runs its body once per Z level, exposes scope `z`
 *   fill       — LATERAL-pass primitive (StepOver): clears a region; def.lines(p,z) / def.segments(p)
 *   reporter   — a value block (variable/math/compare/region): reduce(params, scope, rc) → value
 *
 * Each def also carries a `category` (Ops / Modify / …) for palette grouping — see CATEGORIES.
 * Compositions: drill = array(bore) [proven byte-identical], helical probe = helix(probe).
 * STUDIO presets are higher-level stacks of these. To add a primitive: ops/<name>.js + register here.
 */
import { drillBlock, peckDrill } from './drill.js';
import { boreBlock, helicalBore } from './bore.js';
import { lineBlock, lineCut } from './line.js';
import { wallBlock } from './wall.js';
import { regionBlock } from './region.js';
import { stepoverBlock, fillStrategy } from './stepover.js';
import { stepdownBlock } from './stepdown.js';
import { probeBlock } from './probe.js';
import { arrayBlock, patternPoints } from './array.js';
import { helixBlock, helixPoints } from './helix.js';
import { countBlock } from './count.js';
import { ifBlock } from './iff.js';
import { compareBlock } from './compare.js';
import { setBlock } from './set.js';
import { moveBlock } from './move.js';
import { arcBlock } from './arc.js';
import { spindleBlock } from './spindle.js';
import { feedBlock } from './feed.js';
import { dwellBlock } from './dwell.js';
import { coolantBlock } from './coolant.js';
import { toolBlock } from './tool.js';
import { wcsBlock } from './wcs.js';
import { distModeBlock } from './distmode.js';
import { commentBlock } from './comment.js';
import { variableBlock } from './variable.js';
import { mathBlock } from './math.js';
import { machineMoveBlock, endProgramBlock, mcodeBlock } from './macro.js';
import { labelBlock, gotoBlock } from './flow.js';
import { probeReadBlock, probeCheckBlock, readMachineBlock } from './measure.js';
import { evalExpr } from './expr.js';

/** Palette: granular atoms (Move, Machine) + feature presets (Ops) + modifiers + control/variables/markup. */
export const PALETTE = [
    regionBlock,                                               // Shapes (boundary → fills/walls via a region socket)
    moveBlock, arcBlock, probeBlock, machineMoveBlock,         // Move (+ G53 machine-coord move)
    spindleBlock, feedBlock, dwellBlock, coolantBlock, toolBlock, wcsBlock, distModeBlock,   // Machine (modal state)
    endProgramBlock, mcodeBlock, probeReadBlock, readMachineBlock,   // Machine (program end, raw M-code, probe/DRO capture)
    lineBlock, boreBlock, drillBlock, wallBlock,              // Ops (feature presets + wall finish)
    arrayBlock, helixBlock, stepoverBlock, stepdownBlock,    // Modify (stamp/sweep + lateral/depth pass wrappers)
    countBlock, ifBlock, compareBlock, probeCheckBlock, labelBlock, gotoBlock,   // Control (loop/cond/bool + probe-branch + label/goto)
    mathBlock,                                                 // Math (reporter — drags into value sockets)
    setBlock, variableBlock,                                   // Variables (statement + reporter)
    commentBlock,                                              // Mark Up
];

/** Canonical palette-grouping order (the 2-level sidebar rail). Categories with no blocks yet don't render.
 *  Shapes/Move/Machine are the granular CNC layers (Move/Machine have no Tinkercad analog — see BLOCKS-TAB.md). */
export const CATEGORIES = ['Shapes', 'Move', 'Machine', 'Ops', 'Modify', 'Control', 'Math', 'Variables', 'Mark Up'];

/** type → definition, for emit dispatch and field lookup. (Reporters — Variable/Math — are in PALETTE too;
 *  dragging one drops it into a value socket rather than onto the canvas.) */
export const BLOCKS = Object.fromEntries(PALETTE.map((d) => [d.type, d]));

// Kernels + expression evaluator re-exported for STUDIO presets / direct callers.
export { peckDrill, helicalBore, lineCut, fillStrategy, patternPoints, helixPoints, evalExpr };
export { depthLevels } from '../clearing.js';   // StepDown's level list, used by the emit fold
