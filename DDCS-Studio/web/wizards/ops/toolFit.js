/**
 * wizards/ops/toolFit.js — CAN THE TOOL FIT THE FEATURE? One declaration, four surfaces (t1444, user-ruled).
 *
 * ── THE DEFECT, IN THE USER'S OWN WORDS ──────────────────────────────────────────────────────────────────────────
 * *"if we set a slot or pocket to .25in and have a .5 tool it shouldnt trace anything and notice user"* — and it did
 * neither. `slotPath` opened with `width = Math.max(tool, num(p.width, tool))`, so a 6.35mm slot asked of a 12.7mm
 * tool silently became a **12.7mm slot**: a clean program, a confident preview, and a channel twice the width that was
 * typed. That is this project's gate-1 defect (clean G-code that cuts a different part) sitting in a shipped wizard,
 * and the clamp is what made it invisible — the wrong number was repaired into a plausible one before anything could
 * notice it was wrong.
 *
 * ── THE RULE, AS RULED ───────────────────────────────────────────────────────────────────────────────────────────
 *   STRICTLY SMALLER than the tool   → REFUSE, on every surface. Nothing traced, no motion emitted, the operator told.
 *                                      Anything such a cut could produce is OVERSIZE BY CONSTRUCTION, so there is no
 *                                      "best effort" worth making: the honest output is no output plus the reason.
 *   EXACTLY EQUAL                    → ALLOWED, exactly as shipped (a slot's single centreline pass, a pocket's centre
 *                                      plunge). It is the normal way to cut a tool-width feature and nothing about it
 *                                      is approximate, so refusing it would be a second wrong answer.
 *   LARGER                           → the wizard's ordinary multi-pass walk. Unchanged.
 *
 * ── WHY A DECLARATION AND NOT A GUARD PER WIZARD ─────────────────────────────────────────────────────────────────
 * The question "does this tool fit" is asked by FOUR consumers that must agree: the emit (refuse), the preview (say
 * why), the CAM pack (refuse at build rather than at the machine) and the twin's derived guards. Four hand-rolled
 * comparisons is precisely how two of them come to disagree about where "equal" sits — and an off-by-one-epsilon
 * disagreement here is the difference between cutting a tool-width slot and refusing it. So the boundary is ONE
 * expression, and the SENTENCE the operator reads is built beside it, from the same two numbers.
 *
 * ⚠ THE EPSILON IS PART OF THE RULING, not a detail. "Exactly equal is fine" has to survive float arithmetic: a
 * 6.35mm slot and a 0.25in tool that arrived through a unit conversion are equal in intent and may differ in the
 * fifteenth decimal. The tolerance is a MICRON — far below any machine's resolution and far above float noise — so
 * equal-in-intent reads as equal, and a genuinely smaller feature (which is at minimum a rounding step away) still
 * refuses.
 */
import { num, r3 } from './util.js';

/** A micron. Below any machine's resolution, above float noise — see the ruling note above. */
export const FIT_EPS = 0.001;

/** Does this tool STRICTLY exceed what the feature can hold? (Equal is not too large — the user's ruling.) */
export function toolTooLarge(maxToolDia, toolDia) {
    return num(toolDia, 0) > num(maxToolDia, 0) + FIT_EPS;
}

/**
 * The operator's sentence when the tool cannot fit, or '' when it can.
 *
 * The wording is the user's own — *"the 12.7mm tool cannot fit the 6.35mm slot"* — and it leads with the CONSEQUENCE
 * ("No toolpath") because that is the thing the operator is looking at and failing to explain. `feature` is the noun
 * the wizard calls its own hole in the world ('slot', 'pocket'), so one sentence serves every consumer.
 */
export function toolFitRefusal(maxToolDia, toolDia, feature) {
    return toolTooLarge(maxToolDia, toolDia)
        ? `No toolpath — the ${r3(num(toolDia, 0))}mm tool cannot fit the ${r3(num(maxToolDia, 0))}mm ${feature}`
        : '';
}

/**
 * THE REGISTER THE FAMILY REFUSES THROUGH. `#1505` is the controller's error flag and the whole parametric family
 * already writes it (`surfaceraster`'s zero-stepover and collapsed-inset guards, `wallfinish`'s, the skim frame read).
 * It is named here rather than re-typed because the ENGINE now reads it back — an executed `#1505` write is what tells
 * a preview it is looking at a refusal and not at an empty program — so the emitters and the detector have to mean the
 * same register by construction, not by two files happening to agree.
 */
export const REFUSE_VAR = 1505;

/**
 * A refusal, in the family's emitted form: set the error flag, carry the reason as the line's own comment.
 *
 * ⚠ IT EMITS NO MOTION AND THAT IS THE ENTIRE POINT. The alternative shape — emit the path and let a runtime guard
 * jump over it — is what the surfacing atom does for a condition only the MACHINE can evaluate (a dialled stepover).
 * This condition is known at BUILD time, so a program carrying the unreachable path would put a wrong toolpath in the
 * file and in every preview that draws it, guarded by a branch no reader can see. Nothing is safer for being present
 * and skipped.
 */
export function refusalLines(why) {
    return [`#${REFUSE_VAR}=1   ;ERROR: ${why}`];
}
