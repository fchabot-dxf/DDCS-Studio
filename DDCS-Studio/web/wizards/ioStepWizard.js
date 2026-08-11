/**
 * wizards/ioStepWizard.js — the GROUPED I/O-step wizard (Setup/IO increment 2): ONE wizard, a MODE picker
 * (output / input / dwell), replacing the three quick-insert atoms (outPinBlock / waitInputBlock / dwellBlock).
 *
 * WHY grouped: Set Output, Wait Input and Dwell are one family of "machine-step" ops. A single wizard with a mode
 * picker is friendlier than three near-identical entries, and lets Output/Input reference the user's DECLARED I/O
 * BY NAME (settings.outputs / settings.inputs) — pick "Coolant" and emit its declared on/off M-code; pick a declared
 * input and poll its pin — instead of a bare pin number. A RAW-PIN fallback stays for pins not yet declared.
 */
import { resolveActivePost, getCaps } from './dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
// t1728 (gameplan step 1) — IO_SENT/resolveOutput/resolveInput/resolveIoParams/ioStepStack MOVED to
// stacks/ioStepWizard.js (the twin's own builder dependency, kept importable+re-exported here unchanged for every
// other existing caller — pure move, no signature change). This wizard has no legacy screen (no class was ever
// defined here — Setup/IO grouped straight into the twin), so nothing else in this file needed to change shape.
import { IO_SENT, resolveOutput, resolveInput, resolveIoParams, ioStepStack } from './stacks/ioStepWizard.js';
export { IO_SENT, resolveOutput, resolveInput, resolveIoParams, ioStepStack };

const getDialect = () => { try { return resolveActivePost(getActiveProfile().id); } catch (_) { return null; } };

/** The concrete emit for the quick-insert / preview: resolve the declared I/O, then build. */
export function ioStepStackResolved(params = {}, opts = {}) { return ioStepStack(resolveIoParams(params), opts); }

/** Is Wait-Input available on the active post? (Expert generic poll or an RS274/oword M66 post.) UI uses this to grey. */
export function ioInputSupported() {
    const d = getDialect(); if (!d) return false;
    const caps = getCaps(d.id) || {};
    return !!(caps.flow === 'oword' || caps.inputRead);   // RS274/grblHAL M66, or DDCS Expert generic poll (matches the waitinput atom gate)
}

/** The Wait-Input EDGE options for the active post — DIALECT-AWARE. RS274/grblHAL (oword M66 L1-L4) support all four edges;
 *  a DDCS post reads a LEVEL not an edge (cnc.js waitInput: high/rise→1, fall/low→0), so it shows HIGH/LOW only. Returns
 *  { options, alias } — the alias maps a stored rise→high / fall→low for the HIGHLIGHT only (the value + emit are unchanged;
 *  on a DDCS post rise≡high and fall≡low, so a hidden rise/fall still emits correctly per the existing atom mapping). */
export function ioEdgeOptions() {
    const d = getDialect(); const caps = (d && getCaps(d.id)) || {};
    if (caps.flow === 'oword') return { options: [['Rise', 'rise'], ['Fall', 'fall'], ['High', 'high'], ['Low', 'low']] };
    return { options: [['High', 'high'], ['Low', 'low']], alias: { rise: 'high', fall: 'low' } };
}
