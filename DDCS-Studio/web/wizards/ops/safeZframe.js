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
