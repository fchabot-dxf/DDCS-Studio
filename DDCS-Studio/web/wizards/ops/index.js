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
import { probeBlock } from './probe.js';
import { arrayBlock, patternPoints } from './array.js';
import { helixBlock, helixPoints } from './helix.js';
import { countBlock } from './count.js';
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
    lineBlock, boreBlock, drillBlock,                          // Ops (feature presets)
    arrayBlock, helixBlock,                                    // Modify
    countBlock, setBlock, commentBlock,                        // Control / Variables / Mark Up
];

/** Canonical palette-grouping order (the 2-level sidebar rail). Categories with no blocks yet don't render.
 *  Shapes/Move/Machine are the granular CNC layers (Move/Machine have no Tinkercad analog — see BLOCKS-TAB.md). */
export const CATEGORIES = ['Shapes', 'Move', 'Machine', 'Ops', 'Modify', 'Control', 'Math', 'Variables', 'Mark Up'];

/** Reporter (value) blocks: rounded pills that plug into value sockets. In BLOCKS for emit/resolve now;
 *  surfaced in the palette once the value-socket UI lands. */
const REPORTERS = [variableBlock, mathBlock];

/** type → definition, for emit dispatch and field lookup (includes reporters, which aren't in PALETTE yet). */
export const BLOCKS = Object.fromEntries([...PALETTE, ...REPORTERS].map((d) => [d.type, d]));

// Kernels + expression evaluator re-exported for STUDIO presets / direct callers.
export { peckDrill, helicalBore, lineCut, patternPoints, helixPoints, evalExpr };
