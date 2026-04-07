/**
 * DDCS Studio - Middle Wizard
 * Generates G-code for finding center of pockets or bosses
 *
 * Probe result codes (DDCS M350):
 *   #1920=X  #1921=Y  #1922=Z
 *   0=no probe, 1=initializing, 2=SUCCESS, 3=neg limit, 4=pos limit
 *   → Always check !=2 for failure (NOT ==1)
 *
 * Probe trigger positions (machine coords):
 *   #1925=X  #1926=Y  #1927=Z
 */

export class MiddleWizard {
    constructor() {}

    generate(params) {
        const {
            featureType, axis, dir1, dir2, twoAxis, syncA, slave,
            wcs, dist, retract, safeZ, clearance,
            f_fast, f_slow, port, level, qStop, findBoth
        } = params;

        const axisStatus = axis === 'X' ? '#1920' : '#1921';
        const axisResult = axis === 'X' ? '#1925' : '#1926';
        const axisOffset = axis === 'X' ? 0 : 1;

        const dir1Sign = dir1 === 'pos' ? '+' : '-';
        // dir2 is the opposite direction for single-axis; for 2-axis it is the secondary-axis first direction
        const resolvedDir2 = (typeof dir2 === 'string') ? dir2 : (dir1 === 'pos' ? 'neg' : 'pos');
        const dir2Sign = resolvedDir2 === 'pos' ? '+' : '-';

        const doTwoAxis = !!twoAxis || !!findBoth;
        const secondAxis = doTwoAxis ? (axis === 'X' ? 'Y' : 'X') : null;

        const { wcsCode, wcsLabel } = this.generateWCSCode(wcs);
        const typeLabel = featureType === 'pocket' ? 'Pocket (Inside)' : 'Boss (Outside)';

        let gcode = '';
        gcode += this.generateHeader(axis, typeLabel, wcsLabel, dir1Sign, dir2Sign, dist, retract, f_fast, f_slow, doTwoAxis);
        if (doTwoAxis) gcode += `( 2-Axis mode: ${axis} then ${secondAxis} )\n`;

        gcode += this.generateMotionVariables(dist, retract, f_fast, f_slow, port, clearance, safeZ);
        gcode += this.generatePrecalcMotionVariables(safeZ);
        gcode += wcsCode;
        gcode += this.generateConfirmStart();
        gcode += `G91 ( Incremental mode )\n\n`;

        // --- Primary axis sequence ---
        if (featureType === 'pocket') {
            gcode += this.generatePocketSequence(axis, dir1Sign, dir2Sign, axisStatus, axisResult, level, qStop, 51);
        } else {
            gcode += this.generateBossSequence(axis, dir1Sign, axisStatus, axisResult, level, qStop, 51);
        }

        // Center calculation for primary axis: (#51 + #52) / 2 → #53
        gcode += this.generateCenterCalculation(51, 52, 53);

        if (doTwoAxis) {
            // Safe Z and user reposition before secondary axis
            gcode += `#57=#882 ( Save current Z machine position )\n`;
            gcode += `G0 Z#17 ( Retract to safe Z )\n\n`;
            gcode += `( Reposition for secondary axis )\n`;
            gcode += `#1505=1 ( Press Enter when repositioned )\n\n`;
            gcode += `G53 G0 Z#57 ( Restore Z to saved height )\n\n`;

            const secAxisStatus = secondAxis === 'X' ? '#1920' : '#1921';
            const secAxisResult = secondAxis === 'X' ? '#1925' : '#1926';
            // Secondary axis probes in dir2Sign direction first, then opposite
            const secDir1Sign = dir2Sign;
            const secDir2Sign = dir2Sign === '+' ? '-' : '+';

            const axisDirKey = axis === 'X' ? 'XtoY' : 'YtoX';
            gcode += `( 2axis_${axisDirKey}_${resolvedDir2} )\n\n`;

            if (featureType === 'pocket') {
                gcode += this.generatePocketSequence(secondAxis, secDir1Sign, secDir2Sign, secAxisStatus, secAxisResult, level, qStop, 54);
            } else {
                gcode += this.generateBossSequence(secondAxis, secDir1Sign, secAxisStatus, secAxisResult, level, qStop, 54);
            }

            // Center calculation for secondary axis: (#54 + #55) / 2 → #56
            gcode += this.generateCenterCalculation(54, 55, 56);

            // Final retract
            gcode += this.generateFinalRetract();

            // Write both axes to WCS
            gcode += this.generateWCSWrite(wcsLabel, 'X', 0, '#53');
            gcode += this.generateWCSWrite(wcsLabel, 'Y', 1, '#56');
        } else {
            gcode += this.generateFinalRetract();
            gcode += this.generateWCSWrite(wcsLabel, axis, axisOffset, '#53');
        }

        if (syncA && (axis === 'Y' || doTwoAxis)) {
            const s = slave || '3';
            gcode += `( Dual Gantry Sync )\n`;
            gcode += `#74=[#70+${s}] ( Base WCS + Slave Offset )\n`;
            gcode += `#[#74]=#883 ( Write A machine pos to WCS slave offset )\n\n`;
        }

        gcode += this.generateFooter(doTwoAxis ? '#53 / #56' : '#53');
        return gcode;
    }

    // Two-pass probe helper: fast → retract → slow → save
    generateTwoPassProbe(axis, dirSign, axisStatus, axisResult, resultVar, level, qStop) {
        const probeVar   = dirSign === '+' ? '#8' : '#7';
        const retractVar = dirSign === '+' ? '#9' : '#10'; // away from wall
        let c = '';
        c += `G31 ${axis}${probeVar} F#3 P#5 L${level} Q${qStop} ( Fast probe )\n`;
        c += `IF ${axisStatus}!=2 GOTO1\n`;
        c += `G0 ${axis}${retractVar} ( Retract )\n`;
        c += `G31 ${axis}${probeVar} F#4 P#5 L${level} Q${qStop} ( Slow probe )\n`;
        c += `IF ${axisStatus}!=2 GOTO1\n`;
        c += `${resultVar}=${axisResult} ( Save edge )\n`;
        c += `G0 ${axis}${retractVar} ( Retract from wall )\n\n`;
        return c;
    }

    generatePocketSequence(axis, dir1Sign, dir2Sign, axisStatus, axisResult, level, qStop, resultBase) {
        const firstEdge  = `#${resultBase}`;
        const secondEdge = `#${resultBase + 1}`;
        // Opposite probe direction (toward far wall from center)
        const oppSign    = dir2Sign;

        let c = `( === POCKET: Probe from center toward each wall === )\n\n`;

        // Probe dir1 wall
        c += `( Probe ${dir1Sign === '+' ? 'pos' : 'neg'} ${axis} wall )\n`;
        c += this.generateTwoPassProbe(axis, dir1Sign, axisStatus, axisResult, firstEdge, level, qStop);

        // Probe opposite wall (dir2Sign)
        c += `( Probe ${oppSign === '+' ? 'pos' : 'neg'} ${axis} wall )\n`;
        c += this.generateTwoPassProbe(axis, oppSign, axisStatus, axisResult, secondEdge, level, qStop);

        return c;
    }

    generateBossSequence(axis, dir1Sign, axisStatus, axisResult, level, qStop, resultBase) {
        const firstEdge  = `#${resultBase}`;
        const secondEdge = `#${resultBase + 1}`;
        // Boss always probes second edge from opposite side (requires repositioning)
        const oppSign    = dir1Sign === '+' ? '-' : '+';

        let c = `( === BOSS: Probe from outside each side === )\n\n`;

        // Probe first side
        c += `( Probe ${dir1Sign === '+' ? 'pos' : 'neg'} ${axis} side )\n`;
        c += this.generateTwoPassProbe(axis, dir1Sign, axisStatus, axisResult, firstEdge, level, qStop);

        // Retract to safe Z and wait for user reposition
        c += `#57=#882 ( Save current Z machine position )\n`;
        c += `G0 Z#17 ( Retract to safe Z )\n\n`;
        c += `( MANUAL REPOSITION - move to opposite side of boss )\n`;
        c += `#1505=1 ( Press Enter when repositioned )\n\n`;
        c += `G53 G0 Z#57 ( Restore to saved probe height )\n\n`;

        // Probe opposite side
        c += `( Probe ${oppSign === '+' ? 'pos' : 'neg'} ${axis} side )\n`;
        c += this.generateTwoPassProbe(axis, oppSign, axisStatus, axisResult, secondEdge, level, qStop);

        return c;
    }

    generateCenterCalculation(edgeA, edgeB, center) {
        return `( Calculate Center )\n#${center}=[#${edgeA}+#${edgeB}]/2 ( Average of two edges )\n\n`;
    }

    generateWCSWrite(wcsLabel, axis, axisOffset, valueVar) {
        return `( Write ${axis} to WCS )\n#[#70+${axisOffset}]=${valueVar} ( Set ${wcsLabel} ${axis} to center )\n\n`;
    }

    generateFinalRetract() {
        return `( Final retract )\nG0 Z#17 ( Retract to safe Z )\n\n`;
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

    generateHeader(axis, typeLabel, wcsLabel, dir1Sign, dir2Sign, dist, retract, f_fast, f_slow, doTwoAxis) {
        const s = d => d === '+' ? 'pos' : 'neg';
        const secondAxis = axis === 'X' ? 'Y' : 'X';
        const axisLabel = doTwoAxis
            ? `${axis} ${s(dir1Sign)} + ${secondAxis} ${s(dir2Sign)}`
            : `${axis} ${s(dir1Sign)}`;
        let h = `( Middle | ${axisLabel} | ${wcsLabel} )\n`;
        h += `( DDCS M350 - Two-pass probe )\n`;
        h += `( First: ${axis} ${s(dir1Sign)}, Second: ${axis} ${s(dir2Sign)} )\n`;
        h += `( Distance: ${dist}mm | Retract: ${retract}mm | Fast: ${f_fast} | Slow: ${f_slow} )\n\n`;
        return h;
    }

    generateMotionVariables(dist, retract, f_fast, f_slow, port, clearance, safeZ) {
        let v = `( Motion Variables )\n`;
        v += `#1=${dist}           ( Max probe distance )\n`;
        v += `#2=${retract}        ( Retract distance )\n`;
        v += `#3=${f_fast}         ( Fast feedrate )\n`;
        v += `#4=${f_slow}         ( Slow feedrate )\n`;
        v += `#5=${port}           ( Probe port )\n`;
        v += `#6=${clearance || 2} ( Clearance distance )\n`;
        v += `( Result storage )\n`;
        v += `#51=0 ( Primary axis edge 1 )\n`;
        v += `#52=0 ( Primary axis edge 2 )\n`;
        v += `#53=0 ( Primary axis center )\n`;
        v += `#54=0 ( Secondary axis edge 1 )\n`;
        v += `#55=0 ( Secondary axis edge 2 )\n`;
        v += `#56=0 ( Secondary axis center )\n\n`;
        return v;
    }

    generatePrecalcMotionVariables(safeZ) {
        const sz = parseInt(safeZ) || 0;
        let v = `( Pre-calculated motion values )\n`;
        v += `#7=[0-#1]    ( Negative max probe )\n`;
        v += `#8=#1        ( Positive max probe )\n`;
        v += `#9=[0-#2]   ( Negative retract )\n`;
        v += `#10=#2       ( Positive retract )\n`;
        v += `#13=#6       ( Positive clearance )\n`;
        v += `#14=[0-#6]   ( Negative clearance )\n`;
        v += `#17=${sz}    ( Safe Z distance )\n\n`;
        return v;
    }

    generateConfirmStart() {
        return `( Confirm Start )\n#1505=1 ( Press Enter to probe )\n\n`;
    }

    generateFooter(centerLabel = '#53') {
        let f = `G90 ( Back to absolute )\n`;
        f += `#1505=-5000 ( Center found at ${centerLabel} )\n`;
        f += `GOTO2\n\n`;
        f += `N1\n`;
        f += `G90\n`;
        f += `#1505=1 ( Probe failed - no contact )\n\n`;
        f += `N2\nM30\n`;
        return f;
    }
}
