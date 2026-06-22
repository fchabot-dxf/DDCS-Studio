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
import { slotBlock, slotPath } from './slot.js';
import { wallBlock } from './wall.js';
import { regionBlock } from './region.js';
import { stepoverBlock, fillStrategy } from './stepover.js';
import { fillZigzagBlock, fillConcentricBlock } from './fill.js';
import { fillTextBlock } from './fillText.js';
import { stepdownBlock } from './stepdown.js';
import { placeOnStockBlock } from './placeOnStock.js';
import { rotateBlock } from './rotate.js';
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
import { machineMoveBlock, endProgramBlock, mcodeBlock, rawBlock } from './macro.js';
import { progStartBlock, progEndBlock } from './program.js';
import { labelBlock, gotoBlock, ifGotoBlock } from './flow.js';
import { probeReadBlock, probeCheckBlock, readMachineBlock, toolOffsetBlock } from './measure.js';
import { setWorkOffsetBlock } from './setworkoffset.js';
import { assignBlock } from './assign.js';
import { pauseBlock, messageBlock, askNumberBlock, confirmBlock } from './hmi.js';
import { cornerConfigBlock } from './corner_config.js';
import { pathModeBlock, drillCycleBlock, cancelCycleBlock, outPinBlock, waitInputBlock } from './cnc.js';
import { stopBlock, planeBlock, feedModeBlock, homeBlock, callBlock, returnBlock } from './more.js';
import { evalExpr } from './expr.js';

/** Palette: granular atoms (Move, Machine) + feature presets (Ops) + modifiers + control/variables/markup. */
export const PALETTE = [
    regionBlock,                                               // Shapes (boundary → fills/walls via a region socket)
    moveBlock, arcBlock, probeBlock, machineMoveBlock, homeBlock,   // Move (+ G53 machine-coord move + G28 home)
    spindleBlock, feedBlock, feedModeBlock, dwellBlock, coolantBlock, toolBlock, wcsBlock, distModeBlock, planeBlock, pathModeBlock,   // Machine modal state (+ G94/95 feed mode, G17-19 plane)
    progStartBlock, progEndBlock, endProgramBlock, mcodeBlock, rawBlock, probeReadBlock, readMachineBlock, toolOffsetBlock, setWorkOffsetBlock, outPinBlock, waitInputBlock,   // Machine (framing, end, raw, probe/DRO capture, tool-table/WCS write, digital I/O M62-66)
    lineBlock, slotBlock, boreBlock, drillBlock, wallBlock, drillCycleBlock, cancelCycleBlock,  // Ops (feature presets + wall finish + native canned cycles G81-85/G80)
    arrayBlock, helixBlock, fillZigzagBlock, fillConcentricBlock, fillTextBlock, stepoverBlock, stepdownBlock, placeOnStockBlock, rotateBlock,    // Modify (stamp/sweep + lateral fills [zigzag/concentric/text] + depth-pass wrappers + place-on-stock + rotate/align)
    countBlock, ifBlock, compareBlock, probeCheckBlock, ifGotoBlock, labelBlock, gotoBlock, callBlock, returnBlock, stopBlock, pauseBlock, confirmBlock, askNumberBlock,   // Control (loop/cond/bool + probe-branch + if-goto + label/goto + M98/M99 subprogram + M0/M1 stop + pause/confirm/input)
    mathBlock,                                                 // Math (reporter — drags into value sockets)
    setBlock, assignBlock, variableBlock,                      // Variables (compile-time Set + runtime Set # + reporter)
    commentBlock, messageBlock,                                // Mark Up (comment + on-screen operator message)
    cornerConfigBlock,                                         // Universal Corner Macro config (emits #30 and #31)
];

// Re-categorise the former overloaded 'Machine' bucket (~20 blocks) into granular, semantic groups. Palette
// grouping only (the block's emit/behaviour is unchanged); mutating the shared def's category is read solely by
// the toolbox builder. pathMode (G64/G61) moves to Move (it's a motion mode).
const RECAT = {
    spindle: 'Cutting', feed: 'Cutting', dwell: 'Cutting', coolant: 'Cutting', tool: 'Cutting',
    wcs: 'Coordinates', distmode: 'Coordinates', setworkoffset: 'Coordinates', tooloffset: 'Coordinates',
    progstart: 'Program', progend: 'Program', endprogram: 'Program',
    proberead: 'Probing', readmachine: 'Probing',
    mcode: 'Signals', raw: 'Signals', outpin: 'Signals', waitinput: 'Signals',
    pathmode: 'Move',
};
PALETTE.forEach((d) => { if (RECAT[d.type]) d.category = RECAT[d.type]; });

/** Canonical palette-grouping order (the toolbox category order). Categories with no blocks don't render.
 *  Geometry/toolpath → machine setup/state → probing → logic → low-level signals → annotation. */
export const CATEGORIES = ['Shapes', 'Move', 'Ops', 'Modify', 'Cutting', 'Coordinates', 'Program', 'Probing', 'Control', 'Math', 'Variables', 'Signals', 'Mark Up'];

/** type → definition, for emit dispatch and field lookup. (Reporters — Variable/Math — are in PALETTE too;
 *  dragging one drops it into a value socket rather than onto the canvas.) */
export const BLOCKS = Object.fromEntries(PALETTE.map((d) => [d.type, d]));

// Kernels + expression evaluator re-exported for STUDIO presets / direct callers.
export { peckDrill, helicalBore, lineCut, slotPath, fillStrategy, patternPoints, helixPoints, evalExpr };
export { depthLevels } from '../clearing.js';   // StepDown's level list, used by the emit fold
