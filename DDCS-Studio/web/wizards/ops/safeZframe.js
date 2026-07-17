/**
 * wizards/ops/safeZframe.js — the DECLARED safe-Z FRAME primitive (SPATIAL-MODEL-SPEC.md §A).
 *
 * safe-Z lives in essentially every wizard; the FRAME (how the safe-Z VALUE is interpreted for a retract/park move) is ONE
 * declared concept all wizards SHARE — declared once, read by every consumer, so the sim and the macro never disagree.
 *   relative — DEFAULT (status quo): a clearance distance above the surface → the rapid incremental lift. The USER owns the
 *              number (a clearance). BYTE-IDENTICAL to today's macro.
 *   machine  — the safe-Z VALUE *is* an absolute machine Z (clear everything at one known height — clamps, tall fixtures);
 *              park there via G53 (the DDCS-correct machine-coord move, dialect.machineMove → ground-truth-confirmed:
 *              Expert `G53 Z#var`, V4.1 `G0 G53 Z#var`). The height stays a value the user sets, not a profile push.
 *   wcs      — future (absolute in the work frame); the field will admit it, the conversion is built when someone needs it.
 *
 * SCOPE (inc 1): the FINAL retract / PARK only — a single lift with no drop-back. Inter-move traverses STAYED relative (a
 * machine lift between points breaks the symmetric −value drop-back). t897 lands that follow-up where a traverse ALREADY
 * machine-lifts (corner wall1->wall2, middle reposition): saveMachineZNode records the pre-lift Z, the paired
 * safeZParkBlock(..., { ret: true }) returns to it — so the drop is honest by construction (returns to the probe depth,
 * not lift+old-relative-drop = an arbitrary Z). t909 B2 lands the UNIFICATION: middle's trans-axis traverse joins that
 * same honest machine-margin pairing via the DECLARED clearance mode (clearTraverseParams, `max` default) — it no longer
 * hops +#18 relative. Middle's traverse-OVER (in-axis, #18) stays relative (a same-axis cross at the probe Z).
 *
 * It's an EMIT declaration (changes real G-code) → relative MUST stay byte-identical; machine emits the confirmed G53, never
 * invented. The block is the existing `move` / `machinemove` atom, so it round-trips through gcodeToStack as-is.
 */
import { newBlock } from '../../blocks/blockEmitter.js';
import { distModeBlock } from './distmode.js';
import { SAVE_PROBE_Z_MARK, RETURN_PROBE_Z_MARK } from '../../data/simMarkers.js';

// ── MACHINE-FRAME SAFE-Z MARGIN (t822) — the DECLARED safety policy for the SYSTEM safe-height retract ────────────────
// Distinct from the per-wizard safe-Z VALUE above (a user clearance, frame-toggleable). This is the machine-frame margin
// BELOW HOME the ERROR-HANDLER retracts fall to — always machine-frame (G53), never toggled: on a probe MISS the tool is at
// an UNKNOWN Z, so an incremental lift COMPOUNDS into the top switch (the crash the user hit). Home Z0 = the TOP (machine.z
// travels negative), so the margin is POSITIVE mm below home → a NEGATIVE machine Z. USER-OWNED (settings.machine.safeZMargin).
export const SAFEZ_MARGIN_DEFAULT = 5;   // mm below machine home (Z0 = top) — the policy default when unset
// #520 — the Expert persistent uservar that holds the margin on the controller (boot macro seeds it; emit reads G53 Z#520).
// Grounded CLEAN in the M350 dump (macro-free across SYSDISK/appcode/verify; only a FINDINGS persistence test ever touched it,
// which PROVES it is a live persistent slot). Documented in data/varMap.js RESERVED. Per-post: V4.1/grbl/… bake the literal.
export const SAFEZ_MARGIN_REG_EXPERT = '#520';
export const SAFEZ_GUARD_LABEL = 91;   // the unset-guard's forward-jump label — unused by any wizard (they use 1-10, 500, 999)

/** The declared machine-frame safe-Z margin as a NEGATIVE machine Z (a value below home), read from the live machine
 *  settings with the policy default as the floor. Pure-ish: falls back to the default off-window (tests boot the app,
 *  so the default config's safeZMargin=SAFEZ_MARGIN_DEFAULT flows through → byte-goldens use -SAFEZ_MARGIN_DEFAULT). */
export function safeZMarginNeg() {
    let mm = SAFEZ_MARGIN_DEFAULT;
    try {
        const g = (typeof window !== 'undefined') && window.ddcsGetSettings && window.ddcsGetSettings();
        const v = g && g.machine && g.machine.safeZMargin;
        if (v != null && Number.isFinite(Number(v))) mm = Math.abs(Number(v));
    } catch (_) { /* off-window → the default */ }
    return -mm;
}

/** The shared `saferetract` block node for a wizard's error-handler retract — ONE source so corner (the pilot) and
 *  all the twins that inherit it build the SAME block. Resolves the declared margin now (valid-by-construction).
 *  workClear = the wizard's own safe-Z clearance var (the DM500 work-frame degrade target); default the corner-family #17.
 *  restore (t856) — the DECLARED dist mode the SURROUNDING body is in ('inc' for a G91 probe body). The emit forces G90
 *  before the machine-frame G53 (a G53 under G91 could move INCREMENTALLY on the controller — the factory ALWAYS sets G90
 *  first) and restores G91 after when restore==='inc'. Omit in a G90 body (the explicit G90 is then a harmless no-op). */
export function safeRetractNode({ workClear = '#17', restore } = {}) {
    const b = newBlock('saferetract');
    b.params = { margin: safeZMarginNeg(), workClear, label: SAFEZ_GUARD_LABEL };
    if (restore != null) b.params.restore = restore;
    return b;
}

/** t897 — SAVE the live machine Z into `varRef` (a `readmachine` block → Expert `#varRef=#882`) so a following
 *  machine-frame G53 safe-height LIFT can RETURN the tool to THIS exact Z (the inter-move traverse the file scope note
 *  above deferred). Carries the DECLARED sim SAVE marker (a trailing comment) so the sim records the scene-Z HERE and
 *  the paired `safeZParkBlock('machine', varRef, restore, { ret: true })` return restores it EXACTLY — bypassing the
 *  undeclared-placement G53 approximation. Pairs 1:1 with that return (LIFO; an unpaired final save is a harmless
 *  scratch). The register is a WRITE to `varRef` (a free scratch — #95 in the corner/middle family), never read back
 *  by the macro (the controller's own G53 uses it; the sim uses the recorded scene-Z). */
export function saveMachineZNode(varRef = '#95') {
    const b = newBlock('readmachine');
    b.params = { axis: 'Z', var: varRef, mark: SAVE_PROBE_Z_MARK };
    return b;
}

/** t856/t858 — MODE-EXPLICIT machine-frame wrap. A G53 is machine-ABSOLUTE only under G90 (the factory pattern: G90G00 →
 *  G53 on every dump; ZERO factory G53-in-G91). MODE-EXPLICIT means NO ambient-mode inference: EVERY safe-height G53
 *  emits its OWN G90 immediately before it, so it is correct under ANY control flow (t858 — the probe-MISS error handler
 *  is reached by a GOTO from INSIDE the G91 region; the success-path G90 is jumped over, so a textual "G90 body" read was
 *  wrong). So ALWAYS force G90 first (unless the core already asserts it — the DM500 degrade self-asserts G90, no double);
 *  restore G91 AFTER only where the body continues incremental (restore==='inc'); the error handler needs no restore
 *  (M30/N2 follows). ONE source for the saferetract + safeZParkBlock(machine) emits. */
export function wrapMachineFrame(dialect, core, restore) {
    const out = [];
    const g90 = distModeBlock.emit({ dist: 'abs' })[0];
    // comment-proof G90 detection: strip ( ... ) comments, then word-match — a NOTE mentioning G90 must never suppress the wrap
    const hasAbs = core.some((ln) => /(^|\s)G90(\s|$)/.test(String(ln).replace(/\([^)]*\)/g, '')));
    core.forEach(ln => {
        if (!hasAbs && /(^|\s)G53(\s|$)/.test(ln)) out.push(g90);
        out.push(ln);
    });
    if (restore === 'inc' || restore === 'G91') out.push(distModeBlock.emit({ dist: 'inc' })[0]);   // restore G91 only where the body continues incremental
    return out;
}

export const SAFEZ_FRAMES = ['relative', 'machine'];
/** Normalise a frame value (default `relative`; anything unknown → `relative`, so an absent/garbage field is the status quo). */
export const safeZFrameOf = (v) => (v === 'machine' ? 'machine' : 'relative');

// ── t909 B2 — the DECLARED CLEARANCE MODE for a PLANNED traverse's lift/drop ──────────────────────────────────────────
// ONE source both wizards read, so corner's per-wall margin lift and middle's trans-axis hop become the SAME chosen
// clearance — the user's "not the same in both". Until t909 the three traverse mechanisms had DIVERGED (corner→#520
// machine margin, middle trans-axis→+#18 relative hop, park→safeZframe); byte-identity FROZE the divergence. The mode
// unifies them. SCOPE: the mode governs PLANNED traverses ONLY; miss-path error handlers + final parks stay ALWAYS the
// machine margin (lost = max caution — see safeRetractNode, unchanged). 'max' (default) = the #520 machine margin + the
// honest save/return pairing (safeTraverseStack machineLift + returnZ) — higher than any boss, limit-proof, and the
// drop-back is honest BY CONSTRUCTION (returns to the saved probe Z, never lift-to-margin + relative-drop = arbitrary Z).
export const CLEAR_MODES = ['max', 'hop', 'plane'];
/** Normalise a clearance mode (default `max`; unknown/absent → `max`, the safe default). B2b admits `hop`/`plane`. */
export const clearModeOf = (v) => (CLEAR_MODES.includes(v) ? v : 'max');

/** t913 B2b-1 — SAVE the pre-lift Z (saveMachineZNode) then a CAPPED clearance HOP. The `safehop` atom folds per post:
 *  Expert emits the IF/GOTO cap (lift to min(saved+hop, margin)); posts with no real flow-skip (grbl/rs274/centroid)
 *  degrade to a plain relative hop + an honest uncapped comment. The paired G53 return to `saveVar` (emitDrop) nets it back.
 *  Labels are placeholders — uniquifySafeRetractLabels (blockEmitter) rewrites them unique per program before the fold. */
export function safeHopNode({ hopDist = 15, saveVar = '#95' } = {}) {
    const b = newBlock('safehop');
    b.params = { hopDist, saveVar, margin: safeZMarginNeg(), guardLabel: 82, capLabel: 83, restore: 'inc' };
    return b;
}

/** t913 B2b-1 — the CLEARANCE-PLANE lift: a WORK-FRAME absolute move to `planeZ` (G90 G0 Z<planeZ>), then restore G91 for
 *  the incremental XY re-centre that follows. UNIVERSAL — every post emits a G90 absolute Z move (no register, no flow), so
 *  no dialect method is needed. The paired G53 return to the SAVED machine Z (emitDrop) brings the tool back to the probe
 *  depth. ⚠ WCS-Z CAVEAT: `planeZ` is a WORK Z — if this traverse runs BEFORE the WCS Z datum is set, the plane references an
 *  unset/old WCS-Z. The B2b-2 not-below-stock-top FLOOR + its tooltip surface this to the user; the pre-flight through-stock
 *  class (B2b-3) is the runtime guardrail. */
export function planeLiftNodes(planeZ) {
    const abs = newBlock('distmode'); abs.params = { dist: 'abs' };            // G90 — work-frame absolute for the plane move
    const mv = newBlock('move'); mv.params = { mode: 'rapid', z: String(planeZ) };   // G0 Z<planeZ>  (universal; no register)
    const inc = newBlock('distmode'); inc.params = { dist: 'inc' };            // G91 — restore incremental for the XY re-centre
    return [abs, mv, inc];
}

/** t929 B2b-2c — the CLEARANCE-MODE LIFT node(s) for an OUT-OF-BAND lift (a lift NOT inside safeTraverseStack — corner's
 *  per-wall retreat builds the lift itself, then a separate repoTraverse returns). Returns the lift block(s) for the mode:
 *  `max` → the #520 machine-margin retract (BYTE-IDENTICAL to a direct safeRetractNode({restore}) — so a Max default is
 *  byte-identical); `hop` → the capped hop (safeHopNode, restore baked 'inc'); `plane` → the absolute work-Z plane
 *  (planeLiftNodes). The CALLER saves the pre-lift Z (saveMachineZNode) before this and returns via safeZParkBlock ret. ONE
 *  declared source, mirroring safeTraverseStack's doLift semantics. (`restore` applies to the `max` path; hop/plane bake their own.) */
export function clearLiftNodes(mode = 'max', { hopDist = 15, planeZ = 10, saveVar = '#95', restore } = {}) {
    if (mode === 'hop') return [safeHopNode({ hopDist, saveVar })];
    if (mode === 'plane') return planeLiftNodes(planeZ);
    return [safeRetractNode(restore != null ? { restore } : {})];   // 'max' — the machine margin (byte-identical to today)
}

/** The safeTraverseStack lift/drop params for a declared clearance MODE. `saveVar` = the free scratch that records the
 *  pre-lift Z for the honest return (#95 in the corner/middle family). `max` = the #520 machine margin (t826/t897);
 *  `hop` = a relative lift CAPPED at the margin (safeHopNode); `plane` = a declared absolute work-Z plane (planeLiftNodes).
 *  All three share the SAME honest per-post return (returnZ → G53 Z#95). The mode governs a PLANNED traverse only; miss-path
 *  handlers + final parks stay the machine margin (safeRetractNode, unchanged). `hopDist`/`planeZ` come from the wizard form. */
export function clearTraverseParams(mode = 'max', { saveVar = '#95', hopDist, planeZ } = {}) {
    if (mode === 'hop') return { lift: true, clearMode: 'hop', hopDist, drop: true, returnZ: saveVar };
    if (mode === 'plane') return { lift: true, clearMode: 'plane', planeZ, drop: true, returnZ: saveVar };
    // 'max' (default) — lift to the machine margin (safeRetractNode #520) + return to the saved Z. lift/drop are presence
    // GATES here (the value is the margin / the saved Z, resolved inside safeTraverseStack). BYTE-IDENTICAL to B2a.
    return { lift: true, machineLift: true, drop: true, returnZ: saveVar };
}

/**
 * The safe-Z PARK block for a frame, parking at the macro var `varRef` (e.g. `#17`):
 *   relative → the rapid lift `move` atom (G0 Z#var in the active dist mode) — IDENTICAL to a plain MV('Z', varRef).
 *   machine  → the `machinemove` atom → the dialect's G53 machine-coord move to the absolute Z (varRef must be a #var).
 */
export function safeZParkBlock(frame, varRef, restore, opts = {}) {
    // t856 — the machine-frame park is a safe-height G53; carry the surrounding dist mode so its emit forces G90 (and
    // restores G91 for an incremental body). The relative 'move' frame is a plain G0 Z (no G53) — no wrap needed.
    // t858 — ALWAYS flag the machine park so its G53 gets an explicit G90 (default 'abs' = G90 only; 'inc' also restores
    // G91 for a body that continues incremental). No ambient inference — jump-proof on every path.
    // t897 — opts.ret marks this machine park as the RETURN half of a saveMachineZNode pairing (a DECLARED sim marker on
    // its G53 line so the sim restores the recorded scene-Z exactly). Unset → byte-identical to every existing caller.
    if (safeZFrameOf(frame) === 'machine') { const b = newBlock('machinemove'); b.params = { axis: 'Z', to: varRef, restore: restore || 'abs' }; if (opts.ret) b.params.mark = RETURN_PROBE_Z_MARK; return b; }
    const b = newBlock('move'); b.params = { mode: 'rapid', z: varRef };
    return b;
}
