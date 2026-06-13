/**
 * wizards/ops/index.js — primitive-block REGISTRY (the app's "DNA").
 *
 * Block kinds:
 *   leaf       — a self-contained feature (line, bore, drill): emit(params, dx, dy)
 *   move       — a single motion atom (probe…): emit standalone + step(params, pt) when swept
 *   container  — STAMP modifier (array): replicates a feature at pattern points
 *   path       — SWEEP modifier (helix): runs a move along generated points
 *
 * Each def also carries a `category` (Ops / Modify / …) for palette grouping — see CATEGORIES.
 * Compositions: drill = array(bore) [proven byte-identical], helical probe = helix(probe).
 * STUDIO presets are higher-level stacks of these. To add a primitive: ops/<name>.js + register here.
 */
import { drillBlock, peckDrill } from './drill.js';
import { boreBlock, helicalBore } from './bore.js';
import { lineBlock, lineCut } from './line.js';
import { zigzagBlock, zigzagFill } from './zigzag.js';
import { concentricBlock, concentricFill } from './concentric.js';
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
import { commentBlock } from './comment.js';
import { variableBlock } from './variable.js';
import { mathBlock } from './math.js';
import { evalExpr } from './expr.js';

/** Palette: granular atoms (Move, Machine) + feature presets (Ops) + modifiers + control/variables/markup. */
export const PALETTE = [
    moveBlock, arcBlock, probeBlock,                            // Move
    spindleBlock, feedBlock, dwellBlock, coolantBlock, toolBlock, wcsBlock,   // Machine
    lineBlock, boreBlock, drillBlock, zigzagBlock, concentricBlock,   // Ops (feature presets + area-clearing fills)
    arrayBlock, helixBlock,                                    // Modify
    countBlock, ifBlock, compareBlock,                        // Control (loop + conditional wrapper + boolean reporter)
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
export { peckDrill, helicalBore, lineCut, zigzagFill, concentricFill, patternPoints, helixPoints, evalExpr };
