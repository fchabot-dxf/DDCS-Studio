/**
 * DDCS Studio - Corner Wizard
 * Generates G-code for corner probing operations
 *
 * Probe result codes (DDCS M350):
 *   #1920=X  #1921=Y  #1922=Z
 *   0=no probe, 1=initializing, 2=SUCCESS, 3=neg limit, 4=pos limit
 *   → Always check !=2 for failure (NOT ==1)
 *
 * Probe trigger positions (machine coords):
 *   #1925=X  #1926=Y  #1927=Z
 */

export class CornerWizard {
    constructor() {}

    toNum(v, def = 0) {
        if (v === undefined || v === null) return def;
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    }

    generate(params) {
        const {
            corner, probeZ, syncA, slave, probeSeq, wcs,
            dist, retract, f_fast, f_slow, port, level, qStop,
            safeZ, travelDist, scanDepth, radius
        } = params;

        const _scanDepth   = this.toNum(scanDepth, 5);
        const _dist       = this.toNum(dist, 500);
        const _retract    = this.toNum(retract, 5);
        const _f_fast     = this.toNum(f_fast, 200);
        const _f_slow     = this.toNum(f_slow, 50);
        const _port       = this.toNum(port, 3);
        const _level      = this.toNum(level, 0);
        const _qStop      = this.toNum(qStop, 1);
        const _safeZ      = this.toNum(safeZ, 10);
        const _travelDist = this.toNum(travelDist, 50);
        const _radius     = this.toNum(radius, 2.0);

        // Mapping for Outside Corner (Boss):
        // FL (Front-Left):  Probes X+ and Y+ (moves towards corner from bottom-left)
        // FR (Front-Right): Probes X- and Y+ (moves towards corner from bottom-right)
        // BL (Back-Left):   Probes X+ and Y- (moves towards corner from top-left)
        // BR (Back-Right):  Probes X- and Y- (moves towards corner from top-right)
        let xDir, yDir;
        if      (corner === 'FL') { xDir = '+'; yDir = '+'; }
        else if (corner === 'FR') { xDir = '-'; yDir = '+'; }
        else if (corner === 'BL') { xDir = '+'; yDir = '-'; }
        else if (corner === 'BR') { xDir = '-'; yDir = '-'; }

        // WCS variable setup — split calculation to avoid nested bracket parse errors
        let wcsCode = '';
        let wcsLabel = '';
        if (wcs === 'active') {
            wcsCode += `( Read Active WCS )\n`;
            wcsCode += `#71=#578 ( Active WCS index: 1=G54 2=G55 etc )\n`;
            wcsCode += `#72=[#71-1] ( Zero-based index )\n`;
            wcsCode += `#70=[805+[#72*5]] ( Base WCS address )\n\n`;
            wcsLabel = 'Active WCS';
        } else {
            const wcsMap = { 'G54': 805, 'G55': 810, 'G56': 815, 'G57': 820, 'G58': 825, 'G59': 830 };
            wcsCode += `( Target: ${wcs} )\n`;
            wcsCode += `#70=${wcsMap[wcs]} ( Base WCS address )\n\n`;
            wcsLabel = wcs;
        }

        let gcode = '';
        gcode += this.generateHeader(corner, xDir, yDir, probeZ, wcsLabel, _dist, _retract, _travelDist, _f_fast, _f_slow, _safeZ, _scanDepth);
        gcode += this.generateMotionVariables(_dist, _retract, _f_fast, _f_slow, _port, _radius);
        gcode += this.generatePrecalcMotionVariables(_safeZ, _travelDist, _scanDepth);
        gcode += wcsCode;
        gcode += this.generateConfirmStart(corner, probeZ);
        gcode += `G91 ( INCREMENTAL MODE )\n\n`;

        const firstAxis      = probeSeq === 'YX' ? 'Y' : 'X';
        const firstAxisDir   = probeSeq === 'YX' ? yDir : xDir;
        // Escape move after Z probe: move OPPOSITE of the probe direction to get off the part
        const firstTravelVar = firstAxisDir === '+' ? '#16' : '#15';

        let step = 1;
        if (probeZ) {
            gcode += this.generateZProbe(step, _level, _qStop, wcsLabel, firstAxis, firstTravelVar, _travelDist);
            step++;
        }

        if (probeSeq === 'YX') {
            gcode += this.generateYXSequence(step, xDir, yDir, probeZ, _level, _qStop, _travelDist, wcsLabel);
        } else {
            gcode += this.generateXYSequence(step, xDir, yDir, probeZ, _level, _qStop, _travelDist, wcsLabel);
        }

        if (syncA) {
            const s = slave || '3';
            gcode += `( Dual Gantry Sync )\n`;
            gcode += `G90 ( Absolute for sync move )\n`;
            gcode += `G1 A0 F#3 ( Square A axis )\n`;
            gcode += `G91 ( Back to incremental )\n`;
            gcode += `#74=[#70+${s}] ( Base WCS + Slave Offset )\n`;
            gcode += `#[#74]=#883 ( Sync A offset with Y )\n\n`;
        }

        gcode += this.generateFooter(corner);
        return gcode;
    }

    generateHeader(corner, xDir, yDir, probeZ, wcsLabel, dist, retract, travelDist, f_fast, f_slow, safeZ, scanDepth) {
        const dirLabel = d => d === '+' ? 'pos' : 'neg';
        let h = `( Corner | ${corner} OUTSIDE | X ${dirLabel(xDir)} Y ${dirLabel(yDir)}`;
        if (probeZ) h += ` + Z Surface`;
        h += ` | ${wcsLabel} )\n`;
        h += `( Probe dist: ${dist}mm | Retract: ${retract}mm | Travel: ${travelDist}mm )\n`;
        h += `( Fast: ${f_fast} | Slow: ${f_slow} | SafeZ: ${safeZ}mm | ScanDepth: ${scanDepth}mm )\n\n`;
        return h;
    }

    generateMotionVariables(dist, retract, f_fast, f_slow, port, radius) {
        let v = `( === CONFIGURATION === )\n`;
        v += `#1=${dist}    ( Max probe distance )\n`;
        v += `#2=${retract} ( Retract distance )\n`;
        v += `#3=${f_fast}  ( Fast feedrate )\n`;
        v += `#4=${f_slow}  ( Slow feedrate )\n`;
        v += `#5=${port}    ( Probe port )\n`;
        v += `#6=${radius}   ( Probe stylus radius )\n\n`;
        return v;
    }

    generatePrecalcMotionVariables(safeZ, travelDist, scanDepth = 5) {
        const plungeDepth = parseInt(safeZ) + parseInt(scanDepth);
        const td = parseInt(travelDist) || 0;
        let v = `( === CALCULATED MOTIONS === )\n`;
        v += `#7=[0-#1]  ( Negative max probe )\n`;
        v += `#8=#1      ( Positive max probe )\n`;
        v += `#9=[0-#2]  ( Negative retract )\n`;
        v += `#10=#2     ( Positive retract )\n`;
        v += (td > 0)
            ? `#15=${td}      ( Positive travel )\n#16=[0-${td}] ( Negative travel )\n`
            : `#15=0 ( Travel not used )\n#16=0 ( Travel not used )\n`;
        v += `#17=${plungeDepth}  ( Plunge depth = safeZ + scanDepth )\n`;
        v += `#18=[0-#17] ( Negative plunge )\n`;
        v += `#19=${safeZ}      ( Safe Z retract distance )\n\n`;
        return v;
    }

    generateConfirmStart(corner, probeZ) {
        const verb = probeZ ? 'Hover OVER the' : 'Hover OUTSIDE the';
        return `( Confirm Start )\n#1505=1 ( ${verb} ${corner} corner material. Press Enter )\n\n`;
    }

    generateZProbe(step, level, qStop, wcsLabel, firstAxis, firstTravelVar, travelDist) {
        let c = `( Step ${step}: Z Surface Probe )\n`;
        c += `G31 Z#7 F#3 P#5 L${level} Q${qStop} ( Fast probe down )\n`;
        c += `IF #1922==0 GOTO1\n`;
        c += `G0 Z#10 ( Retract up )\n`;
        c += `G31 Z#7 F#4 P#5 L${level} Q${qStop} ( Slow probe )\n`;
        c += `IF #1922==0 GOTO1\n`;
        c += `#73=[#70+2] ( WCS Z Address )\n`;
        c += `#[#73]=#1927 ( Save ${wcsLabel} Z offset - machine coord )\n`;
        c += `G0 Z#19 ( Retract to safe Z )\n`;
        if (firstAxis && firstTravelVar) {
            c += `G0 ${firstAxis}${firstTravelVar} ( Travel ${travelDist}mm toward first wall )\n`;
        }
        c += `\n`;
        return c;
    }

    generateYXSequence(step, xDir, yDir, probeZ, level, qStop, travelDist, wcsLabel) {
        const yProbe   = yDir === '+' ? '#8' : '#7';
        const yRetract = yDir === '+' ? '#9' : '#10';
        const xProbe   = xDir === '+' ? '#8' : '#7';
        const xRetract = xDir === '+' ? '#9' : '#10';
        const yTravel  = yDir === '+' ? '#15' : '#16';
        const xTravelOpp = xDir === '+' ? '#16' : '#15';

        // Radius compensation logic (Boss):
        // If probing positive (+Y), trigger is center. Wall is at center + radius.
        // If probing negative (-Y), trigger is center. Wall is at center - radius.
        const yCompOp = yDir === '+' ? '+' : '-';
        const xCompOp = xDir === '+' ? '+' : '-';

        let c = '';

        // Step: Y Probe
        c += `( Step ${step}: Y Probe )\n`;
        c += `G0 Z#18 ( Plunge to scan depth )\n`;
        c += `G31 Y${yProbe} F#3 P#5 L${level} Q${qStop} ( Fast probe Y )\n`;
        c += `IF #1921==0 GOTO1\n`;
        c += `G0 Y${yRetract} ( Retract from Y wall )\n\n`;
        c += `G31 Y${yProbe} F#4 P#5 L${level} Q${qStop} ( Slow probe Y )\n`;
        c += `IF #1921==0 GOTO1\n\n`;
        c += `( Apply Y WCS with Radius Comp )\n`;
        c += `#101=[#1926 ${yCompOp} #6] ( Trigger Pos ${yCompOp} Radius )\n`;
        c += `#73=[#70+1] ( WCS Y Address )\n`;
        c += `#[#73]=#101 ( Save to ${wcsLabel} Y )\n\n`;
        c += `G0 Y${yRetract} ( Retract from Y wall )\n`;
        c += `G0 Z#17 ( SAFELY retract exact plunge distance )\n\n`;
        step++;

        // Step: Travel toward X wall
        c += `( Step ${step}: Travel past corner and set up for X )\n`;
        c += `G0 Y${yTravel} X${xTravelOpp} ( Move Y past edge, X far off side )\n`;
        c += `G0 Z#18 ( Plunge to scan depth )\n\n`;
        step++;

        // Step: X Probe
        c += `( Step ${step}: X Probe )\n`;
        c += `G31 X${xProbe} F#3 P#5 L${level} Q${qStop} ( Fast probe X )\n`;
        c += `IF #1920==0 GOTO1\n`;
        c += `G0 X${xRetract} ( Retract from X wall )\n\n`;
        c += `G31 X${xProbe} F#4 P#5 L${level} Q${qStop} ( Slow probe X )\n`;
        c += `IF #1920==0 GOTO1\n\n`;
        c += `( Apply X WCS with Radius Comp )\n`;
        c += `#102=[#1925 ${xCompOp} #6] ( Trigger Pos ${xCompOp} Radius )\n`;
        c += `#[#70]=#102 ( Save to ${wcsLabel} X )\n\n`;
        c += `G0 X${xRetract} ( Retract from X wall )\n`;
        c += `G0 Z#17 ( SAFELY retract exact plunge distance )\n\n`;

        return c;
    }

    generateXYSequence(step, xDir, yDir, probeZ, level, qStop, travelDist, wcsLabel) {
        const xProbe   = xDir === '+' ? '#8' : '#7';
        const xRetract = xDir === '+' ? '#9' : '#10';
        const yProbe   = yDir === '+' ? '#8' : '#7';
        const yRetract = yDir === '+' ? '#9' : '#10';
        const xTravel  = xDir === '+' ? '#15' : '#16';
        const yTravelOpp = yDir === '+' ? '#16' : '#15';

        // Radius compensation logic (Boss):
        const xCompOp = xDir === '+' ? '+' : '-';
        const yCompOp = yDir === '+' ? '+' : '-';

        let c = '';

        // Step: X Probe
        c += `( Step ${step}: X Probe )\n`;
        c += `G0 Z#18 ( Plunge to scan depth )\n`;
        c += `G31 X${xProbe} F#3 P#5 L${level} Q${qStop} ( Fast probe X )\n`;
        c += `IF #1920==0 GOTO1\n`;
        c += `G0 X${xRetract} ( Retract from X wall )\n\n`;
        c += `G31 X${xProbe} F#4 P#5 L${level} Q${qStop} ( Slow probe X )\n`;
        c += `IF #1920==0 GOTO1\n\n`;
        c += `( Apply X WCS with Radius Comp )\n`;
        c += `#102=[#1925 ${xCompOp} #6] ( Trigger Pos ${xCompOp} Radius )\n`;
        c += `#[#70]=#102 ( Save to ${wcsLabel} X )\n\n`;
        c += `G0 X${xRetract} ( Retract from X wall )\n`;
        c += `G0 Z#17 ( SAFELY retract exact plunge distance )\n\n`;
        step++;

        // Step: Travel toward Y wall
        c += `( Step ${step}: Travel past corner and set up for Y )\n`;
        c += `G0 X${xTravel} Y${yTravelOpp} ( Move X past edge, Y far off side )\n`;
        c += `G0 Z#18 ( Plunge to scan depth )\n\n`;
        step++;

        // Step: Y Probe
        c += `( Step ${step}: Y Probe )\n`;
        c += `G31 Y${yProbe} F#3 P#5 L${level} Q${qStop} ( Fast probe Y )\n`;
        c += `IF #1921==0 GOTO1\n`;
        c += `G0 Y${yRetract} ( Retract from Y wall )\n\n`;
        c += `G31 Y${yProbe} F#4 P#5 L${level} Q${qStop} ( Slow probe Y )\n`;
        c += `IF #1921==0 GOTO1\n\n`;
        c += `( Apply Y WCS with Radius Comp )\n`;
        c += `#101=[#1926 ${yCompOp} #6] ( Trigger Pos ${yCompOp} Radius )\n`;
        c += `#73=[#70+1] ( WCS Y Address )\n`;
        c += `#[#73]=#101 ( Save to ${wcsLabel} Y )\n\n`;
        c += `G0 Y${yRetract} ( Retract from Y wall )\n`;
        c += `G0 Z#17 ( SAFELY retract exact plunge distance )\n\n`;

        return c;
    }

    generateFooter(corner) {
        let f = `G90 ( Back to absolute )\n`;
        f += `#1505=-5000 ( Corner ${corner} found )\n`;
        f += `GOTO2\n\n`;
        f += `( === ERROR HANDLER === )\n`;
        f += `N1\n`;
        f += `G91 G0 Z#17 ( Safe Z on failure )\n`;
        f += `G90\n`;
        f += `#1505=1 ( ERROR: Probe failed to trigger )\n\n`;
        f += `N2\nM30\n`;
        return f;
    }
}
