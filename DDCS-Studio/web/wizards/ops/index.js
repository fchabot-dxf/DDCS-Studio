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
// t1391 — `drill` AND `bore` RETIRED here, and this closes the drill arc. Both were the LITERAL kernels: a JS loop that
// unrolled the peck ladder / the ring-step walk and baked every Z at build time. `holecycle` replaced them with a body the
// controller walks at run time, which is what made total depth (#81) and the bite (#82) knobs an operator can turn on the
// pendant mid-program — the capability opToSlot recorded as impossible precisely BECAUSE of these two loops.
//
// The deletion waited for its premise to be true. t1389's ownership test (re-run AT the deletion, not inherited) found
// POCKET still building a `drill` for its too-small fallback, so t1391 act 1 moved that tenant onto holecycle first; only
// then were both atoms pure leaves. Their two specs retired with them: `peck-drill` and `bore-glow-cap`, both subsumed by
// holecycle's own 48 bridges plus its asserted no-runaway property (a loop that is EMITTED cannot explode the way an
// unrolled one could, which is why bore's runaway cap has no successor).
//
// THE BRIDGES DO NOT LOSE THEIR REFERENCE: the kernels live on, frozen, at tests/support/served/literalHoleReference.js
// (served only to tests). That was landed in the SAME act as the switch precisely so this deletion could not make 48
// equivalence tests silently compare the new path against itself. History in git; reasoning in the t1391 WORK-LOG.
// t1383 — `holepeck` RETIRED here (t1379's peck-only cycle). It was fully superseded by `holecycle` and a pure leaf: only
// this registry imported it, no builder reached it, and holecycle never did. Its 8 bridges retired WITH it because
// holecycle's own 48 strictly subsume them (same criterion, same literal side, peck plus two bore cycles plus all five
// patterns). Retiring it is also what dissolves the deliberate #81-#87 band overlap the two declared while both were
// pre-consumer. History in git; the reasoning in the t1383 WORK-LOG.
import { holeCycleBlock } from './holecycle.js';   // t1381 — the FOLDED drill family: pattern x cycle, one body
import { tapBlock } from './tap.js';   // t776 — the TAP primitive (floating-holder pitch-locked cycle + a gated rigid variant)
import { lineBlock, lineCut } from './line.js';
import { slotBlock, slotPath } from './slot.js';
import { contourBlock } from './contour.js';
import { contourFillBlock } from './contourfill.js';   // the FLAT contour twin atom (region-pill→flat reframe)
import { pocketFillBlock, pocketWallBlock } from './pocketfill.js';   // the FLAT pocket twin atoms (region-pill→flat reframe: fill clearing + wall finish)
import { pocketRestBlock } from './restmachining.js';   // t871 — REST MACHINING: the corner-sliver clear with a smaller 2nd tool
import { regionBlock } from './region.js';
import { stepoverBlock, fillStrategy } from './stepover.js';
import { surfaceFillBlock } from './surfaceFill.js';
import { surfaceRasterBlock } from './surfaceraster.js';   // t1359 — the PARAMETRIC surfacing atom; surfacingStack emits through it now
import { wallFinishBlock } from './wallfinish.js';   // t1433 — the PARAMETRIC wall-finish atom (the raster pocket's finish ring; band #11-#14)
import { fillZigzagBlock, fillConcentricBlock } from './fill.js';
import { fillTextBlock } from './fillText.js';
import { stepdownBlock } from './stepdown.js';
import { placeOnStockBlock } from './placeOnStock.js';
import { rotateBlock } from './rotate.js';
import { skimBlock } from './skim.js';
import { entryBlock } from './entry.js';   // t726 P2b — the mill ENTRY-POINT fold (declared opening waypoint)
import { toolSelBlock } from './toolsel.js';   // t768 P1a — the declared TOOL-SELECTION marker (which tool the op runs; emits nothing, drives the sim cutter)
import { xformBlock, setupBlock, flipBlock } from './transform.js';   // t736 — the DECLARED program-level ROTATION (flat sibling marker, applied once at emit); t879 — the two-sided SETUP boundary + FLIP sibling
import { probeBlock } from './probe.js';
import { userRootBlock, paramGroupBlock, sectionBlock, opUnitBlock } from './userRoot.js';
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
import { featureCanvasBlock } from './featureCanvas.js';   // t2515 — renamed from panel.js/panelBlock, see its own header
import { codePreviewBlock } from './codePreview.js';   // t2263 — the code-preview GUI block (wizards-as-data E2 measurement)
import { usageTextBlock } from './usageText.js';   // t2269 — the usage-text GUI block (wizards-as-data E2 measurement)
import { pathAnchorBlock } from './pathAnchor.js';   // t2271 — the path-anchor picker GUI block (wizards-as-data E2 measurement)
import { layoutBlock, splitHorizontalBlock, splitVerticalBlock } from './layout.js';
import { gridContainerBlock } from './gridContainer.js';
import { tabGroupBlock, tabPageBlock } from './tabGroup.js';
import { groupBoxBlock } from './groupBox.js';
import { formDropdownBlock, formCheckboxBlock, formSegmentedBlock, formDiagramBlock, formActionBtnBlock } from './formControls.js';
import { shapeRectBlock, shapeCircleBlock, shapeLineBlock, shapeMarkerBlock } from './vizBlocks.js';   // t1627 — the four 2D shape primitives (Wizard Shapes); t1734 — sim3dBoxBlock/codePreviewPanelBlock deleted (dead containers); t2507 — layout2dCanvasBlock deleted too (wired but never useful — see vizBlocks.js's own header)
import { cornerGridPickerBlock, regionPickFieldBlock, toolLibraryPickerBlock, threadPresetPickerBlock, declaredIoPickerBlock, sliderFieldBlock, stepperFieldBlock } from './specializedPickers.js';
import { simBlock } from './sim.js';
import { preview3dBlock } from './preview3d.js';   // t2511 — the 3D-only half of the sim/panel split, see its own header
import { simStartBlock } from './simStart.js';
import { formFieldBlock } from './formField.js';
import { camTableBlock, camFieldBlock } from './camField.js';   // block-native-params S1 — the pendant-field family (metadata, emits [])
import { paramFieldBlock } from './paramField.js';   // block-native-params S5.1 — the FORM-face row (metadata, emits [])
import { paramTableBlock } from './paramTable.js';   // t2543 — materializeParamGroup's OWN target, separate from param_group (BACKLOG #71 owner ruling)
import { fieldRefBlock } from './fieldRef.js';   // t2299 — a presentation-tree PLACEMENT reference, deliberately not formfield/param_field (see its own header)
import { layoutWidgetBlock } from './layoutWidget.js';
import { lengthHandleBlock } from './lengthHandle.js';   // t2517 — BACKLOG #71 pilot: the length canvas-gesture, block-authorable, nests in feature_canvas's mouth
import { pointHandleBlock } from './pointHandle.js';   // t2521 — BACKLOG #71: the point canvas-gesture, same template as length_handle
import { rectHandleBlock } from './rectHandle.js';   // t2521 — BACKLOG #71: the rect canvas-gesture, a new anchor.kind branch (two-field, t2495 valueField routing)
import { radialHandleBlock } from './radialHandle.js';   // t2521 — BACKLOG #71: the radial canvas-gesture (radius-only variant), a new anchor.kind branch
import { scaleHandleBlock } from './scaleHandle.js';   // t2533 — BACKLOG #71: the scaleX canvas-gesture, a new anchor.kind branch (a second read-only baseField picker)
import { shearHandleBlock } from './shearHandle.js';   // t2533 — BACKLOG #71: the shear canvas-gesture, same second-read-only-picker shape as scale_handle
import { projLengthHandleBlock } from './projLengthHandle.js';   // t2533 — BACKLOG #71: the projLength canvas-gesture, same template as length_handle (off self-derives from value/scale)
import { probeVectorHandleBlock } from './probeVectorHandle.js';   // t2557 — BACKLOG #71's last gesture: the probeVector canvas-gesture (axis+dir enum writes, plus a distance), the FIRST handle to write non-numeric values through setFields/_writeParam
import { diagAimHandleBlock } from './diagAimHandle.js';   // t2573 — BACKLOG #61's t2571 assessment, built: the diagAim canvas-gesture, the first consumer of anchorSources.js's stock-anchor + enum-sign primitives
import { crossAimHandleBlock } from './crossAimHandle.js';   // t2583 — BACKLOG #61's t2571 assessment, the second and last sized gesture: the crossAim canvas-gesture, extending relTo (via formfield's own relToRow shape) to a non-point gesture's lineAt
import { variableBlock } from './variable.js';
import { paramBlock } from './param.js';
import { regionPickBlock } from './regionpick.js';
import { coordListBlock } from './coordlist.js';
import { mathBlock } from './math.js';
import { machineMoveBlock, endProgramBlock, mcodeBlock, rawBlock } from './macro.js';
import { safeRetractBlock, safeTraverseBlock, safeHopBlock, clearLiftBlock } from './saferetract.js';   // t822 — the shared machine-frame SAFE-HEIGHT retract; t901 — the safetraverse BUNDLE atom (lift+travel+return); t913 — the clearance-HOP atom (capped relative lift); t931 — the CLEARLIFT folding atom (max/hop/plane on value params)
import { progStartBlock, progEndBlock } from './program.js';
import { labelBlock, gotoBlock, ifGotoBlock } from './flow.js';
import { probeReadBlock, probeCheckBlock, probeStartBlock, readMachineBlock, probeGuardBlock, toolOffsetBlock } from './measure.js';
import { setWorkOffsetBlock } from './setworkoffset.js';
import { wcsBaseIntoBlock, wcsWriteBlock } from './wcsIndirect.js';   // F1/E1 — the probe-family WCS-write (Expert #[#70]/#73 indirect / other posts G92)
import { wcsZeroBlock } from './wcszero.js';   // t475 — WCS zero-at-current, dialect-aware at emit (M350 register / rs274·grbl G10 L20 / v41·dm500 G92)
import { assignBlock } from './assign.js';
import { radiuscompBlock } from './radiuscomp.js';
import { pauseBlock, messageBlock, askNumberBlock, confirmBlock, hmilineBlock, hmiConfirmBlock, hmiStatusBlock, hmiBeepBlock, pauseConfirmBlock } from './hmi.js';
import { cornerConfigBlock } from './corner_config.js';
import { pathModeBlock, drillCycleBlock, cancelCycleBlock, outPinBlock, waitInputBlock } from './cnc.js';
import { stopBlock, planeBlock, feedModeBlock, homeBlock, callBlock, returnBlock } from './more.js';
import { guardBlock } from './guard.js';   // ② B4 M2: transparent when-guard container (pruneGuards collapses forks at build)
import { evalExpr } from './expr.js';

/** Palette: granular atoms + feature presets + modifiers + control/data/signals/authoring. Grouped by the block's
 *  own `category` (the single source of truth — the toolbox buckets by it; array order is just within-group order). */
export const PALETTE = [
    regionBlock,                                               // Shapes (boundary → fills/walls via a region socket)
    moveBlock, arcBlock, probeBlock, machineMoveBlock, safeRetractBlock, safeTraverseBlock, safeHopBlock, clearLiftBlock, homeBlock, pathModeBlock,   // Move (+ G53 machine-coord move + machine-frame safe-Z retract + safetraverse bundle + clearance-hop + clearlift folding atom + G28 home + G64/G61 path mode)
    lineBlock, slotBlock, holeCycleBlock, tapBlock, contourBlock, contourFillBlock, pocketFillBlock, pocketWallBlock, pocketRestBlock, drillCycleBlock, cancelCycleBlock,  // Toolpaths (feature presets + tap + contour/profile [contour=region-socket for pocket-wall; contourfill/pocketfill/pocketwall=flat for the twins] + native canned cycles G81-85/G80)
    arrayBlock, helixBlock, fillZigzagBlock, fillConcentricBlock, fillTextBlock, stepoverBlock, surfaceFillBlock, surfaceRasterBlock, wallFinishBlock, stepdownBlock, placeOnStockBlock, rotateBlock, skimBlock, entryBlock, toolSelBlock, xformBlock, setupBlock, flipBlock,    // Transforms (stamp/sweep + lateral fills [zigzag/concentric/text] + depth-pass wrappers + place-on-stock + rotate/align + skim relative Z-mode + entry-point + tool-select marker + declared program rotation + two-sided setup boundary + flip sibling)
    spindleBlock, feedBlock, feedModeBlock, dwellBlock, coolantBlock, toolBlock,   // Spindle & Feed (spindle/feed/coolant/tool/dwell + G94/95 feed mode)
    wcsBlock, distModeBlock, planeBlock, setWorkOffsetBlock, wcsBaseIntoBlock, wcsWriteBlock, wcsZeroBlock, toolOffsetBlock,   // Coordinates (WCS select + dist-mode + G17-19 plane + work-offset/probe-family base+indirect-write/WCS-zero-at-current/tool-table write)
    progStartBlock, progEndBlock, endProgramBlock,             // Program (framing + end)
    probeReadBlock, readMachineBlock, probeStartBlock, probeGuardBlock, radiuscompBlock,         // Probing (probe/DRO capture + pre-probe DRO capture for the miss-check + G31 stop/limit guard + stylus-radius comp)
    countBlock, ifBlock, compareBlock, probeCheckBlock, ifGotoBlock, labelBlock, gotoBlock, callBlock, returnBlock, stopBlock, pauseBlock, confirmBlock, pauseConfirmBlock, askNumberBlock, hmilineBlock, hmiConfirmBlock, hmiStatusBlock, hmiBeepBlock, cornerConfigBlock, guardBlock,   // Control (loop/cond/bool + probe-branch + if-goto + label/goto + M98/M99 subprogram + M0/M1 stop + pause/confirm/pause-confirm/input + probe #1505 note + spaced confirm gate + comm status-bar/beep idioms + corner-macro config + when-guard fork container)
    mathBlock,                                                 // Math (reporter — drags into value sockets)
    setBlock, assignBlock, variableBlock,                      // Variables (compile-time Set + runtime Set # + reporter)
    mcodeBlock, rawBlock, outPinBlock, waitInputBlock,         // Signals (raw M-code/G-code escape + digital I/O M62-66)
    paramBlock, regionPickBlock, coordListBlock, featureCanvasBlock, codePreviewBlock, userRootBlock, usageTextBlock, pathAnchorBlock, layoutBlock, splitHorizontalBlock, splitVerticalBlock, gridContainerBlock, tabGroupBlock, tabPageBlock, groupBoxBlock, formDropdownBlock, formCheckboxBlock, formSegmentedBlock, formDiagramBlock, formActionBtnBlock, shapeRectBlock, shapeCircleBlock, shapeLineBlock, shapeMarkerBlock, cornerGridPickerBlock, regionPickFieldBlock, toolLibraryPickerBlock, threadPresetPickerBlock, declaredIoPickerBlock, sliderFieldBlock, stepperFieldBlock, simBlock, preview3dBlock, simStartBlock, formFieldBlock, layoutWidgetBlock, lengthHandleBlock, pointHandleBlock, rectHandleBlock, radialHandleBlock, scaleHandleBlock, shearHandleBlock, projLengthHandleBlock, probeVectorHandleBlock, diagAimHandleBlock, crossAimHandleBlock, sectionBlock, opUnitBlock, // Wizard UI (GUI param knob + region-pick + coordinate-list + feature-canvas + layout-splitters + grid/tab/card containers + dropdown/toggle/segmented controls + SVG diagrams + region/tool/thread/IO pickers + slider/stepper inputs + preview-rig + per-pass sim-start declarations + FORM value-field blocks + LAYOUT-2D widget blocks + length-handle block + titled concern-section + declared sub-unit boundary + structural-control blocks; t2507 — the LAYOUT-2D preview box (layout2dCanvasBlock) deleted, wired but never useful; t2511 — preview3dBlock: the 3D-only half of the sim/panel split, pilot on surfacing; t2515 — panelBlock renamed featureCanvasBlock, type 'panel' -> 'feature_canvas', see featureCanvas.js's own header; t2517 — lengthHandleBlock: BACKLOG #71 pilot, nests in feature_canvas's own mouth; t2521 — pointHandleBlock/rectHandleBlock/radialHandleBlock: BACKLOG #71's second, third and fourth gestures)
    paramGroupBlock, paramFieldBlock, fieldRefBlock, paramTableBlock,   // Wizard Form (block-native-params S5.1 — the FORM-field container + row; metadata, emits []) + t2299 placement reference + t2543 materialize's own separate target
    // t2661 (closing t2639's gap 6) — moved from ABOVE param_group/formfield/param_table's own position: all
    // eight are 'Wizard Inputs' too (structCtl.js's own category tag), but corner/middle-specific — a person
    // authoring ANY OTHER wizard used to scroll past them before reaching the generic, broadly-useful blocks.
    // PURE REORDER (array position only, same mechanism/precedent as t2653's user_root move) — no new
    // category, no new chrome, category/colour unchanged.
    ...STRUCT_CTL_BLOCKS,   // Structural Controls (corner/middle-specific guard drivers — narrow, moved last within Wizard Inputs)
    camTableBlock, camFieldBlock,                              // CAM Pendant (block-native-params S1 — the pendant-field container + row; metadata, emits [])
    commentBlock, messageBlock,                                // Mark Up (comment + on-screen operator message)
];

/** Canonical palette-grouping order (the toolbox category order). Categories with no blocks don't render. Each
 *  block declares its own `category` (the single source of truth — no remap); this list is just the display order.
 *  Geometry → toolpaths → patterns → machine state/setup → probing → logic/data → low-level signals → authoring. */
export const CATEGORIES = ['Shapes', 'Move', 'Toolpaths', 'Transforms', 'Spindle & Feed', 'Coordinates', 'Program', 'Probing', 'Control', 'Math', 'Variables', 'Signals', 'Wizard Inputs', 'Wizard Layout', 'Wizard Previews', 'Wizard Shapes', 'CAM Pendant', 'Mark Up'];

/** type → definition, for emit dispatch and field lookup. (Reporters — Variable/Math — are in PALETTE too;
 *  dragging one drops it into a value socket rather than onto the canvas.) */
export const BLOCKS = Object.fromEntries(PALETTE.map((d) => [d.type, d]));

// Kernels + expression evaluator re-exported for STUDIO presets / direct callers.
// t1391 — `peckDrill` and `helicalBore` are GONE from this list with their modules. Their reachability was checked the
// same way the blocks' was: nothing in web/ imported either name from here (only prose comments named them), so the
// re-export was the last thing keeping them addressable.
export { lineCut, slotPath, fillStrategy, patternPoints, helixPoints, evalExpr };
export { depthLevels } from '../clearing.js';   // StepDown's level list, used by the emit fold
