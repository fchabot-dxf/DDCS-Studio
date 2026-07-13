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
 * SCOPE (inc 1): the FINAL retract / PARK only — a single lift with no drop-back. Inter-move traverses STAY relative (a
 * machine lift between points breaks the symmetric −value drop-back + is wasteful) — that's a deferred follow-up.
 *
 * It's an EMIT declaration (changes real G-code) → relative MUST stay byte-identical; machine emits the confirmed G53, never
 * invented. The block is the existing `move` / `machinemove` atom, so it round-trips through gcodeToStack as-is.
 */
import { newBlock } from '../../blocks/blockEmitter.js';

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
 *  workClear = the wizard's own safe-Z clearance var (the DM500 work-frame degrade target); default the corner-family #17. */
export function safeRetractNode({ workClear = '#17' } = {}) {
    const b = newBlock('saferetract');
    b.params = { margin: safeZMarginNeg(), workClear, label: SAFEZ_GUARD_LABEL };
    return b;
}

export const SAFEZ_FRAMES = ['relative', 'machine'];
/** Normalise a frame value (default `relative`; anything unknown → `relative`, so an absent/garbage field is the status quo). */
export const safeZFrameOf = (v) => (v === 'machine' ? 'machine' : 'relative');

/**
 * The safe-Z PARK block for a frame, parking at the macro var `varRef` (e.g. `#17`):
 *   relative → the rapid lift `move` atom (G0 Z#var in the active dist mode) — IDENTICAL to a plain MV('Z', varRef).
 *   machine  → the `machinemove` atom → the dialect's G53 machine-coord move to the absolute Z (varRef must be a #var).
 */
export function safeZParkBlock(frame, varRef) {
    if (safeZFrameOf(frame) === 'machine') { const b = newBlock('machinemove'); b.params = { axis: 'Z', to: varRef }; return b; }
    const b = newBlock('move'); b.params = { mode: 'rapid', z: varRef };
    return b;
}
