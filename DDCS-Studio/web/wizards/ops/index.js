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
import { evalExpr } from './expr.js';

/** Palette order: features, the move atom, the modifiers, then control + variables. */
export const PALETTE = [lineBlock, boreBlock, drillBlock, probeBlock, arrayBlock, helixBlock, countBlock, setBlock];

/** Canonical palette-grouping order. Categories with no blocks yet simply don't render. */
export const CATEGORIES = ['Ops', 'Modify', 'Control', 'Math', 'Variables'];

/** type → definition, for emit dispatch and field lookup. */
export const BLOCKS = Object.fromEntries(PALETTE.map((d) => [d.type, d]));

// Kernels + expression evaluator re-exported for STUDIO presets / direct callers.
export { peckDrill, helicalBore, lineCut, patternPoints, helixPoints, evalExpr };
