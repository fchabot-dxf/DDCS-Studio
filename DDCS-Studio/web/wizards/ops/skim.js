/**
 * wizards/ops/skim.js — SKIM Z-mode: a wrapper that runs the wrapped op WHOLE-OP RELATIVE (G91) from the jog start.
 *
 * The "current position = Z0" facing workflow: jog to a corner, touch the surface, face from there — NO WCS datum.
 * The wrapped body (an opening clearance lift + the cutting passes) is emitted ABSOLUTE, then blockEmitter (kind
 * 'skim') prepends the clearance, runs relativizeProgram (every X/Y/Z → a delta from the jog origin 0,0,0), and
 * wraps the result in G91 … G90. The machine-frame G53 safe-Z retract stays OUTSIDE this wrap (it's in the program
 * footer — absolute machine coords, always valid regardless of the jog). See data/rotateProgram.relativizeProgram.
 */
export const skimBlock = {
    type: 'skim', label: 'Skim (relative)', kind: 'skim', category: 'Program',
    defaults: { clearance: 5 },
    fields: ['clearance'],
};
