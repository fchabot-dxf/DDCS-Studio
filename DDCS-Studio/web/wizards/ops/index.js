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
import { contourFillBlock } from './contourfill.js';   // the FLAT contour twin atom (region-pill→flat reframe)
import { pocketFillBlock, pocketWallBlock } from './pocketfill.js';   // the FLAT pocket twin atoms (region-pill→flat reframe: fill clearing + wall finish)
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
import { formFieldBlock } from './formField.js';
import { layoutWidgetBlock } from './layoutWidget.js';
import { variableBlock } from './variable.js';
import { paramBlock } from './param.js';
import { regionPickBlock } from './regionpick.js';
import { coordListBlock } from './coordlist.js';
import { mathBlock } from './math.js';
import { machineMoveBlock, endProgramBlock, mcodeBlock, rawBlock } from './macro.js';
import { progStartBlock, progEndBlock } from './program.js';
import { labelBlock, gotoBlock, ifGotoBlock } from './flow.js';
import { probeReadBlock, probeCheckBlock, readMachineBlock, probeGuardBlock, toolOffsetBlock } from './measure.js';
import { setWorkOffsetBlock } from './setworkoffset.js';
import { wcsBaseIntoBlock, wcsWriteBlock } from './wcsIndirect.js';   // F1/E1 — the probe-family WCS-write (Expert #[#70]/#73 indirect / other posts G92)
import { wcsZeroBlock } from './wcszero.js';   // t475 — WCS zero-at-current, dialect-aware at emit (M350 register / rs274·grbl G10 L20 / v41·dm500 G92)
import { assignBlock } from './assign.js';
import { radiuscompBlock } from './radiuscomp.js';
import { pauseBlock, messageBlock, askNumberBlock, confirmBlock, hmilineBlock, hmiConfirmBlock } from './hmi.js';
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
    lineBlock, slotBlock, boreBlock, drillBlock, contourBlock, contourFillBlock, pocketFillBlock, pocketWallBlock, drillCycleBlock, cancelCycleBlock,  // Toolpaths (feature presets + contour/profile [contour=region-socket for pocket-wall; contourfill/pocketfill/pocketwall=flat for the twins] + native canned cycles G81-85/G80)
    arrayBlock, helixBlock, fillZigzagBlock, fillConcentricBlock, fillTextBlock, stepoverBlock, surfaceFillBlock, stepdownBlock, placeOnStockBlock, rotateBlock,    // Transforms (stamp/sweep + lateral fills [zigzag/concentric/text] + depth-pass wrappers + place-on-stock + rotate/align)
    spindleBlock, feedBlock, feedModeBlock, dwellBlock, coolantBlock, toolBlock,   // Spindle & Feed (spindle/feed/coolant/tool/dwell + G94/95 feed mode)
    wcsBlock, distModeBlock, planeBlock, setWorkOffsetBlock, wcsBaseIntoBlock, wcsWriteBlock, wcsZeroBlock, toolOffsetBlock,   // Coordinates (WCS select + dist-mode + G17-19 plane + work-offset/probe-family base+indirect-write/WCS-zero-at-current/tool-table write)
    progStartBlock, progEndBlock, endProgramBlock,             // Program (framing + end)
    probeReadBlock, readMachineBlock, probeGuardBlock, radiuscompBlock,         // Probing (probe/DRO capture + G31 stop/limit guard + stylus-radius comp)
    countBlock, ifBlock, compareBlock, probeCheckBlock, ifGotoBlock, labelBlock, gotoBlock, callBlock, returnBlock, stopBlock, pauseBlock, confirmBlock, askNumberBlock, hmilineBlock, hmiConfirmBlock, cornerConfigBlock, guardBlock,   // Control (loop/cond/bool + probe-branch + if-goto + label/goto + M98/M99 subprogram + M0/M1 stop + pause/confirm/input + probe #1505 note + spaced confirm gate + corner-macro config + when-guard fork container)
    mathBlock,                                                 // Math (reporter — drags into value sockets)
    setBlock, assignBlock, variableBlock,                      // Variables (compile-time Set + runtime Set # + reporter)
    mcodeBlock, rawBlock, outPinBlock, waitInputBlock,         // Signals (raw M-code/G-code escape + digital I/O M62-66)
    paramBlock, regionPickBlock, coordListBlock, panelBlock, layoutBlock, simBlock, simStartBlock, formFieldBlock, layoutWidgetBlock, userRootBlock, paramGroupBlock, sectionBlock, ...STRUCT_CTL_BLOCKS, // Wizard UI (GUI param knob + region-pick + coordinate-list + panel-type + preview-rig + per-pass sim-start declarations + FORM value-field blocks + LAYOUT-2D widget blocks + titled concern-section + structural-control blocks)
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
