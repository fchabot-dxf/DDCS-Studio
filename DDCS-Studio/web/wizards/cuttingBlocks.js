/**
 * wizards/cuttingBlocks.js — shared building blocks for the Mill (cutting) generators.
 *
 * headerBlock = absolute mode + spindle start (from the Head / spindle settings).
 * footerBlock = the configured end-of-program routine (M5 / M9 / G53 retract / park / M30).
 *
 * Both take plain objects (spindle, endProgram) so the generators stay pure and unit-testable;
 * the view passes them in from window.ddcsGetSettings(). G53 retract uses a variable per the
 * DDCS rule that G53 can't take a hardcoded constant.
 */
function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }

/** Program header: absolute mode + spindle on (if a spindle head is configured). */
export function headerBlock({ spindle } = {}) {
    const L = ['G90   ( absolute )'];
    if (spindle && num(spindle.defaultRpm, 0) > 0) {
        L.push(`${spindle.dir === 'ccw' ? 'M4' : 'M3'} S${num(spindle.defaultRpm, 0)}   ( spindle on )`);
        const up = num(spindle.spinUp, 0);
        if (up > 0) L.push(`G04 P${Math.round(up * 1000)}   ( spin-up dwell, ms )`);
    }
    return L;
}

/** Program footer: the configured end-of-program routine. */
export function footerBlock({ endProgram } = {}) {
    const ep = endProgram || {};
    const L = [];
    if (ep.spindleOff !== false) L.push('M5   ( spindle off )');
    if (ep.coolantOff !== false) L.push('M9   ( coolant off )');
    if (ep.retract !== false) { L.push(`#101 = ${num(ep.retractZ, 0)}   ( safe Z - G53 needs a variable )`); L.push('G53 G0 Z#101   ( retract )'); }
    if (ep.park === true) { L.push(`#102 = ${num(ep.parkX, 0)}  #103 = ${num(ep.parkY, 0)}`); L.push('G53 G0 X#102 Y#103   ( park )'); }
    L.push(ep.end === 'M2' ? 'M2' : 'M30');
    return L;
}
