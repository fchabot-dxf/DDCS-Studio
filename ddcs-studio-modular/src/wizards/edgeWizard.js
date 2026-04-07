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
 */

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
        gcode += `G91 ( Incremental mode )\n\n`;

        // Probe the edge
        gcode += `( Probe ${axis} ${dirSign === '+' ? 'pos' : 'neg'} )\n`;
        gcode += this.generateTwoPassProbe(axis, dirSign, retractSign, axisStatus, axisResult, '#50', level, qStop);

        // Write edge position to WCS
        gcode += `( Write to WCS )\n`;
        gcode += `#[#70+${axisOffset}]=#50 ( Set ${wcsLabel} ${axis} to edge )\n\n`;

        if (syncA) {
            const s = slave || '3';
            gcode += `( Dual Gantry Sync )\n`;
            gcode += `#74=[#70+${s}] ( Base WCS + Slave Offset )\n`;
            gcode += `#[#74]=#883 ( Write sync result to slave offset )\n\n`;
        }

        gcode += this.generateFooter();
        return gcode;
    }

    generateTwoPassProbe(axis, dirSign, retractSign, axisStatus, axisResult, resultVar, level, qStop) {
        const probeVar   = dirSign   === '+' ? '#8' : '#7';
        const retractVar = retractSign === '+' ? '#10' : '#9';
        let c = '';
        c += `G31 ${axis}${probeVar} F#3 P#5 L${level} Q${qStop} ( Fast probe )\n`;
        c += `IF ${axisStatus}!=2 GOTO1\n`;
        c += `G0 ${axis}${retractVar} ( Retract )\n`;
        c += `G31 ${axis}${probeVar} F#4 P#5 L${level} Q${qStop} ( Slow probe )\n`;
        c += `IF ${axisStatus}!=2 GOTO1\n`;
        c += `${resultVar}=${axisResult} ( Save edge position )\n`;
        c += `G0 ${axis}${retractVar} ( Retract from wall )\n\n`;
        return c;
    }

    generateWCSCode(wcs) {
        let wcsCode = '', wcsLabel = '';
        if (wcs === 'active') {
            wcsCode  = `( Read Active WCS )\n`;
            wcsCode += `#71=#578 ( Active WCS index: 1=G54 2=G55 etc )\n`;
            wcsCode += `#72=[#71-1] ( Zero-based index )\n`;
            wcsCode += `#70=[805+[#72*5]] ( Base WCS address )\n\n`;
            wcsLabel = 'Active WCS';
        } else {
            const wcsMap = { 'G54': 805, 'G55': 810, 'G56': 815, 'G57': 820, 'G58': 825, 'G59': 830 };
            wcsCode  = `( Target: ${wcs} )\n`;
            wcsCode += `#70=${wcsMap[wcs]} ( Base WCS address )\n\n`;
            wcsLabel = wcs;
        }
        return { wcsCode, wcsLabel };
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
        return `( Confirm Start )\n#1505=1 ( Press Enter to probe ${axis} ${dirLabel} )\n\n`;
    }

    generateFooter() {
        let f = `G90 ( Back to absolute )\n`;
        f += `#1505=-5000 ( Edge found )\n`;
        f += `GOTO2\n\n`;
        f += `N1\n`;
        f += `G90\n`;
        f += `#1505=1 ( Probe failed - no contact )\n\n`;
        f += `N2\nM30\n`;
        return f;
    }
}
