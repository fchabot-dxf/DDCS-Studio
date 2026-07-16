/**
 * data/simMarkers.js — DECLARED sim round-trip markers (ONE source; a leaf with no imports).
 *
 * A machine-frame G53 safe-height LIFT that must land the tool back at the pre-lift probe depth (an inter-move
 * traverse: lift over an obstacle, cross in XY, drop back to keep probing from the SAME Z) emits a paired
 *   SAVE:    #95=#882 ( @saveProbeZ )      (readmachine — records the live machine Z)
 *   RETURN:  G53 Z#95 ( @returnProbeZ )    (machinemove — G53 back to the saved Z)
 * so the CONTROLLER round-trips exactly. But the SIM's undeclared-placement G53 approximation (g53ApproxZ) would
 * force BOTH the lift AND the return to the same margin, so the return would render at the margin (tool stays
 * high → the next wall's probe misses in the preview). These two markers let the sim DECLARE the pairing (never
 * infer it from register provenance): on the SAVE it records the current scene-Z; on the RETURN it restores that
 * exact scene-Z, bypassing the approximation — correct under BOTH declared and undeclared placement.
 *
 * Written by wizards/ops/safeZframe.js (saveMachineZNode / safeZParkBlock ret) via the readmachine/machinemove
 * emit `mark` param; read sim-side by engine/GcodeExecutionEngine.js off the RAW line (the same pattern as the
 * `REPOSITION:` pass marker). Emitted as WHITESPACE-separated trailing G-code comments, so gcodeToStack's
 * parseLine strips them to a side-channel and the save/return lines still round-trip to readmachine/machinemove.
 * The two tokens are non-overlapping substrings (neither contains the other) so an includes() test can't confuse them.
 */
export const SAVE_PROBE_Z_MARK = '@saveProbeZ';     // on the readmachine SAVE line → the sim records the scene-Z
export const RETURN_PROBE_Z_MARK = '@returnProbeZ'; // on the paired G53 RETURN move → the sim restores the saved scene-Z
