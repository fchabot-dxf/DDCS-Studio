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
import { contourBlock } from './contour.js';
import { regionBlock } from './region.js';
import { stepoverBlock, fillStrategy } from './stepover.js';
import { surfaceFillBlock } from './surfaceFill.js';
import { fillZigzagBlock, fillConcentricBlock } from './fill.js';
import { fillTextBlock } from './fillText.js';
import { stepdownBlock } from './stepdown.js';
import { placeOnStockBlock } from './placeOnStock.js';
import { rotateBlock } from './rotate.js';
import { probeBlock } from './probe.js';
import { userRootBlock, paramGroupBlock, sectionBlock } from './userRoot.js';
import { STRUCT_CTL_BLOCKS } from './structCtl.js';   // t154 — structural-control blocks, generated from CORNER_STRUCT_BINDINGS
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
import { panelBlock } from './panel.js';
import { layoutBlock } from './layout.js';
import { simBlock } from './sim.js';
import { simStartBlock } from './simStart.js';
import { variableBlock } from './variable.js';
import { paramBlock } from './param.js';
import { regionPickBlock } from './regionpick.js';
import { coordListBlock } from './coordlist.js';
import { mathBlock } from './math.js';
import { machineMoveBlock, endProgramBlock, mcodeBlock, rawBlock } from './macro.js';
import { progStartBlock, progEndBlock } from './program.js';
import { labelBlock, gotoBlock, ifGotoBlock } from './flow.js';
import { probeReadBlock, probeCheckBlock, readMachineBlock, toolOffsetBlock } from './measure.js';
import { setWorkOffsetBlock } from './setworkoffset.js';
import { assignBlock } from './assign.js';
import { radiuscompBlock } from './radiuscomp.js';
import { pauseBlock, messageBlock, askNumberBlock, confirmBlock } from './hmi.js';
import { cornerConfigBlock } from './corner_config.js';
import { pathModeBlock, drillCycleBlock, cancelCycleBlock, outPinBlock, waitInputBlock } from './cnc.js';
import { stopBlock, planeBlock, feedModeBlock, homeBlock, callBlock, returnBlock } from './more.js';
import { guardBlock } from './guard.js';   // ② B4 M2: transparent when-guard container (pruneGuards collapses forks at build)
import { evalExpr } from './expr.js';

/** Palette: granular atoms + feature presets + modifiers + control/data/signals/authoring. Grouped by the block's
 *  own `category` (the single source of truth — the toolbox buckets by it; array order is just within-group order). */
export const PALETTE = [
    regionBlock,                                               // Shapes (boundary → fills/walls via a region socket)
    moveBlock, arcBlock, probeBlock, machineMoveBlock, homeBlock, pathModeBlock,   // Move (+ G53 machine-coord move + G28 home + G64/G61 path mode)
    lineBlock, slotBlock, boreBlock, drillBlock, contourBlock, drillCycleBlock, cancelCycleBlock,  // Toolpaths (feature presets + contour/profile [+ pocket-wall finish] + native canned cycles G81-85/G80)
    arrayBlock, helixBlock, fillZigzagBlock, fillConcentricBlock, fillTextBlock, stepoverBlock, surfaceFillBlock, stepdownBlock, placeOnStockBlock, rotateBlock,    // Transforms (stamp/sweep + lateral fills [zigzag/concentric/text] + depth-pass wrappers + place-on-stock + rotate/align)
    spindleBlock, feedBlock, feedModeBlock, dwellBlock, coolantBlock, toolBlock,   // Spindle & Feed (spindle/feed/coolant/tool/dwell + G94/95 feed mode)
    wcsBlock, distModeBlock, planeBlock, setWorkOffsetBlock, toolOffsetBlock,   // Coordinates (WCS + dist-mode + G17-19 plane + work-offset/tool-table write)
    progStartBlock, progEndBlock, endProgramBlock,             // Program (framing + end)
    probeReadBlock, readMachineBlock, radiuscompBlock,         // Probing (probe/DRO capture + stylus-radius comp)
    countBlock, ifBlock, compareBlock, probeCheckBlock, ifGotoBlock, labelBlock, gotoBlock, callBlock, returnBlock, stopBlock, pauseBlock, confirmBlock, askNumberBlock, cornerConfigBlock, guardBlock,   // Control (loop/cond/bool + probe-branch + if-goto + label/goto + M98/M99 subprogram + M0/M1 stop + pause/confirm/input + corner-macro config + when-guard fork container)
    mathBlock,                                                 // Math (reporter — drags into value sockets)
    setBlock, assignBlock, variableBlock,                      // Variables (compile-time Set + runtime Set # + reporter)
    mcodeBlock, rawBlock, outPinBlock, waitInputBlock,         // Signals (raw M-code/G-code escape + digital I/O M62-66)
    paramBlock, regionPickBlock, coordListBlock, panelBlock, layoutBlock, simBlock, simStartBlock, userRootBlock, paramGroupBlock, sectionBlock, ...STRUCT_CTL_BLOCKS, // Wizard UI (GUI param knob + region-pick + coordinate-list + panel-type + preview-rig + per-pass sim-start declarations + titled concern-section + structural-control blocks)
    commentBlock, messageBlock,                                // Mark Up (comment + on-screen operator message)
];

/** Canonical palette-grouping order (the toolbox category order). Categories with no blocks don't render. Each
 *  block declares its own `category` (the single source of truth — no remap); this list is just the display order.
 *  Geometry → toolpaths → patterns → machine state/setup → probing → logic/data → low-level signals → authoring. */
export const CATEGORIES = ['Shapes', 'Move', 'Toolpaths', 'Transforms', 'Spindle & Feed', 'Coordinates', 'Program', 'Probing', 'Control', 'Math', 'Variables', 'Signals', 'Wizard UI', 'Mark Up'];

/** type → definition, for emit dispatch and field lookup. (Reporters — Variable/Math — are in PALETTE too;
 *  dragging one drops it into a value socket rather than onto the canvas.) */
export const BLOCKS = Object.fromEntries(PALETTE.map((d) => [d.type, d]));

// Kernels + expression evaluator re-exported for STUDIO presets / direct callers.
export { peckDrill, helicalBore, lineCut, slotPath, fillStrategy, patternPoints, helixPoints, evalExpr };
export { depthLevels } from '../clearing.js';   // StepDown's level list, used by the emit fold
