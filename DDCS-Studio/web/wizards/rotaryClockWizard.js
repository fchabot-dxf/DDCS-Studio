/**
 * DDCS Studio - Rotary Clock Wizard (A0 to a feature) — datum the rotary axis off a FLAT.
 *
 * REWRITTEN AS A BLOCK STACK: `rotaryClockStack(params)` from granular, dialect-aware atoms. Native across
 * posts: probe form, status-check folding, the A-axis DRO read (Read Machine), the A work-offset write (Set
 * WCS Offset) and the confirm gate all come from the active dialect.
 *
 * Method (horizontal 4th axis, spin around X): probe down at point A, step +Y by the span, probe down at B.
 * tilt phi = ATAN[(Zb-Za)/span]. Datum A so the level orientation reads A0 (set / report / rotate).
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { opSimStarts } from '../viz/opSimStarts.js';   // E2 — the shared single-start registry (BUILT_IN.rotary_clock) the built-in + twin both read
// t1728 (gameplan step 1) — rotaryClockHeaderComments/rotaryClockStack MOVED to stacks/rotaryClockWizard.js (the twin's
// own builder dependency, kept importable+re-exported here unchanged for every other existing caller — pure move).
import { rotaryClockHeaderComments, rotaryClockStack } from './stacks/rotaryClockWizard.js';
export { rotaryClockHeaderComments, rotaryClockStack };

export class RotaryClockWizard {
    generate(params) {
        recordOp('rotary_clock', params);
        return emitMapped(rotaryClockStack(params), activeDialectOpts()).text;
    }

    /** Preview start (stock frame): above the flat near the top, offset to point A (-Y half of span). Single pass → the
     *  shared registry (BUILT_IN.rotary_clock) is the ONE source, so the built-in + the data-op twin agree (E2). */
    inferStart(params, stock) { return this.inferStarts(params, stock)[0]; }

    inferStarts(params, stock) { return opSimStarts('rotary_clock', params, stock); }
}
