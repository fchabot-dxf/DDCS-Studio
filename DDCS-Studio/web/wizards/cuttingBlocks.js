/**
 * wizards/cuttingBlocks.js — shared building blocks for the Mill (cutting) generators.
 *
 * headerBlock = absolute mode + spindle start (from the Head / spindle settings).
 * footerBlock = the configured end-of-program routine (M5 / M9 / G53 retract / park / M30).
 *
 * Both take plain objects (spindle, endProgram) so the generators stay pure and unit-testable;
 * the view passes them in from window.ddcsGetSettings(). The dialect-dependent bits (spin-up dwell
 * units, the G53 retract/park form) route through the active dialect so each controller gets its
 * real syntax — Expert `G53Z#v`, V4.1 `G0 G53 Z#v`, DM500 dwell in seconds, etc. Verified vs the
 * controller dumps (bridge/controllers/*). G53 retract uses a variable per the DDCS rule that G53
 * can't take a hardcoded constant. Callers without a dialect (the STUDIO wizards) default to Expert.
 */
import { DEFAULT_DIALECT } from './dialects/index.js';
function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }

/** Program header: absolute mode + spindle on. `rpm` (e.g. from the picked tool) overrides the
 *  Head's default RPM when given; otherwise the Head's defaultRpm is used. */
export function headerBlock({ spindle, rpm, dialect } = {}) {
    const d = dialect || DEFAULT_DIALECT;
    const L = ['G90   ( absolute )'];
    const r = num(rpm, 0) > 0 ? num(rpm, 0) : num(spindle && spindle.defaultRpm, 0);
    if (r > 0) {
        L.push(`${spindle && spindle.dir === 'ccw' ? 'M4' : 'M3'} S${r}   ( spindle on )`);
        const up = num(spindle && spindle.spinUp, 0);   // seconds; the dialect emits P in its own units
        if (up > 0) { const dw = d.dwell(up); dw[dw.length - 1] += '   ( spin-up dwell )'; L.push(...dw); }
    }
    return L;
}

/** Program footer: the configured end-of-program routine. */
export function footerBlock({ endProgram, dialect } = {}) {
    const ep = endProgram || {};
    const d = dialect || DEFAULT_DIALECT;
    const L = [];
    if (ep.spindleOff !== false) L.push('M5   ( spindle off )');
    if (ep.coolantOff !== false) L.push('M9   ( coolant off )');
    // G53 retract/park: DDCS needs the target in a #var (a literal fails on M350); grbl has no #vars and takes
    // a literal directly (dialect.g53NeedsVar === false). LinuxCNC/grblHAL accept either — they keep the #var form.
    const litG53 = d.g53NeedsVar === false;
    if (ep.retract !== false) {
        if (litG53) {
            const mv = d.machineMove('Z', num(ep.retractZ, 0)); mv[mv.length - 1] += '   ( retract )';
            L.push(...mv);
        } else {
            L.push(`#101 = ${num(ep.retractZ, 0)}   ( safe Z - G53 needs a variable )`);
            const mv = d.machineMove('Z', '#101'); mv[mv.length - 1] += '   ( retract )';
            L.push(...mv);
        }
    }
    if (ep.park === true) {
        if (litG53) {
            const mx = d.machineMove('X', num(ep.parkX, 0)), my = d.machineMove('Y', num(ep.parkY, 0));
            my[my.length - 1] += '   ( park )';
            L.push(...mx, ...my);
        } else {
            L.push(`#102 = ${num(ep.parkX, 0)}   ( park X - G53 needs a variable )`);
            L.push(`#103 = ${num(ep.parkY, 0)}   ( park Y - G53 needs a variable )`);   // one assignment per line (M350 rejects two)
            const mx = d.machineMove('X', '#102'), my = d.machineMove('Y', '#103');
            my[my.length - 1] += '   ( park )';
            L.push(...mx, ...my);
        }
    }
    L.push(ep.end === 'M2' ? 'M2' : 'M30');
    return L;
}
