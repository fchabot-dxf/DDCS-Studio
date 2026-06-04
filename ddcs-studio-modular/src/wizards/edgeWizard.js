/**
 * DDCS Studio - Edge Wizard
 * Generates G-code for single edge probing — probe one wall, set WCS axis to that position.
 * For finding center between two edges, use the Middle Wizard instead.
 *
 * Probe result codes (DDCS M350):
 *   #1920=X  #1921=Y  #1922=Z
 *   0=no probe, 1=initializing, 2=SUCCESS, 3=neg limit, 4=pos limit
 *   → Always check !=2 for failure (NOT ==1)
 *
 * Probe trigger positions (machine coords):
 *   #1925=X  #1926=Y  #1927=Z
 *
 * G-code construct lines are emitted through the words.js "post"; static
 * declaration/header/WCS-read blocks remain literal (see middleWizard.js note).
 */
import { w, G, M, N, F, P, L, Q, set, line, comment } from './words.js';
import { ifGoto, goto, wcsBase } from './dialect.js';

export class EdgeWizard {
    constructor() {}

    generate(params) {
        const {
            axis, dir, wcs,
            dist, retract, clearance,
            syncA, slave,
            f_fast, f_slow, port, level, qStop
        } = params;

        const axisStatus = axis === 'X' ? '#1920' : '#1921';
        const axisResult = axis === 'X' ? '#1925' : '#1926';
        const axisOffset = axis === 'X' ? 0 : 1;

        const dirSign     = dir === 'pos' ? '+' : '-';
        const retractSign = dir === 'pos' ? '-' : '+'; // away from wall

        const { wcsCode, wcsLabel } = this.generateWCSCode(wcs);
        const retractVar = retractSign === '+' ? '#10' : '#9';

        let gcode = '';
        gcode += this.generateHeader(axis, dirSign, wcsLabel, dist, retract, f_fast, f_slow);
        gcode += this.generateMotionVariables(dist, retract, f_fast, f_slow, port);
        gcode += this.generatePrecalcMotionVariables();
        gcode += wcsCode;
        gcode += this.generateConfirmStart(axis, dirSign);
        gcode += line([G(91)], 'Incremental mode') + '\n\n';

        // Probe the edge
        gcode += comment(`Probe ${axis} ${dirSign === '+' ? 'pos' : 'neg'}`) + '\n';
        gcode += this.generateTwoPassProbe(axis, dirSign, retractSign, axisStatus, axisResult, '#50', level, qStop);

        // Write edge position to WCS
        gcode += comment('Write to WCS') + '\n';
        gcode += line([set(`#[#70+${axisOffset}]`, '#50')], `Set ${wcsLabel} ${axis} to edge`) + '\n\n';

        if (syncA) {
            const s = slave || '3';
            gcode += comment('Dual Gantry Sync') + '\n';
            gcode += line([set('#74', `[#70+${s}]`)], 'Base WCS + Slave Offset') + '\n';
            gcode += line([set('#[#74]', '#883')], 'Write sync result to slave offset') + '\n\n';
        }

        gcode += this.generateFooter();
        return gcode;
    }

    generateTwoPassProbe(axis, dirSign, retractSign, axisStatus, axisResult, resultVar, level, qStop) {
        const probeVar   = dirSign   === '+' ? '#8' : '#7';
        const retractVar = retractSign === '+' ? '#10' : '#9';
        // Probe safety: decelerate-stop + enable limit protection in the probe direction
        const stopVar  = axis === 'X' ? '#1905' : '#1906';
        const limitVar = axis === 'X' ? '#1915' : '#1916';
        let c = '';
        c += line([set(stopVar, '0')], 'Stop mode: decelerate') + '\n';
        c += line([set(limitVar, dirSign === '+' ? '2' : '1')], `Limit protect: ${dirSign === '+' ? 'positive' : 'negative'}`) + '\n';
        c += line([G(31), w(axis, probeVar), F('#3'), P('#5'), L(level), Q(qStop)], 'Fast probe') + '\n';
        c += ifGoto(axisStatus, '!=', '2', 1) + '\n';
        c += line([G(0), w(axis, retractVar)], 'Retract') + '\n';
        c += line([G(31), w(axis, probeVar), F('#4'), P('#5'), L(level), Q(qStop)], 'Slow probe') + '\n';
        c += ifGoto(axisStatus, '!=', '2', 1) + '\n';
        c += line([set(resultVar, axisResult)], 'Save edge position') + '\n';
        c += line([G(0), w(axis, retractVar)], 'Retract from wall') + '\n\n';
        return c;
    }

    generateWCSCode(wcs) {
        const { code, label } = wcsBase(wcs);
        return { wcsCode: code, wcsLabel: label };
    }

    generateHeader(axis, dirSign, wcsLabel, dist, retract, f_fast, f_slow) {
        const dirLabel = dirSign === '+' ? 'pos' : 'neg';
        let h = `( Edge | ${axis} ${dirLabel} | ${wcsLabel} )\n`;
        h += `( DDCS M350 - Single edge probe )\n`;
        h += `( Distance: ${dist}mm | Retract: ${retract}mm | Fast: ${f_fast} | Slow: ${f_slow} )\n\n`;
        return h;
    }

    generateMotionVariables(dist, retract, f_fast, f_slow, port) {
        let v = `( Motion Variables )\n`;
        v += `#1=${dist}     ( Max probe distance )\n`;
        v += `#2=${retract}  ( Retract distance )\n`;
        v += `#3=${f_fast}   ( Fast feedrate )\n`;
        v += `#4=${f_slow}   ( Slow feedrate )\n`;
        v += `#5=${port}     ( Probe port )\n`;
        v += `( Result storage )\n`;
        v += `#50=0 ( Edge contact position )\n\n`;
        return v;
    }

    generatePrecalcMotionVariables() {
        let v = `( Pre-calculated motion values )\n`;
        v += `#7=[0-#1]  ( Negative max probe )\n`;
        v += `#8=#1      ( Positive max probe )\n`;
        v += `#9=[0-#2]  ( Negative retract )\n`;
        v += `#10=#2     ( Positive retract )\n\n`;
        return v;
    }

    generateConfirmStart(axis, dirSign) {
        const dirLabel = dirSign === '+' ? 'pos' : 'neg';
        return comment('Confirm Start') + '\n'
            + line([set('#1505', '1')], `Press Enter to probe ${axis} ${dirLabel} - ESC=cancel`) + '\n'
            + ifGoto('#1505', '==', '0', 2) + '\n\n';
    }

    generateFooter() {
        let f = line([G(90)], 'Back to absolute') + '\n';
        f += line([set('#1505', '-5000')], 'Edge found') + '\n';
        f += goto(2) + '\n\n';
        f += line([N(1)]) + '\n';
        f += line([G(90)]) + '\n';
        f += line([set('#1505', '1')], 'Probe failed - no contact') + '\n\n';
        f += line([N(2)]) + '\n' + line([M(30)]) + '\n';
        return f;
    }
}
