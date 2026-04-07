/**
 * DDCS Studio - Alignment Wizard
 * Generates G-code for fence/axis alignment verification
 *
 * PURPOSE:
 *   Measures angular misalignment of a fence or edge relative to a machine axis.
 *   - "checkAxis" = the axis the fence runs ALONG (e.g. X → fence goes left-right)
 *   - "probeAxis" = the perpendicular axis the probe moves in to touch the fence
 *   Operator positions probe at point A along the fence, macro records fence contact
 *   position. Operator jogs to point B along the fence, macro records again.
 *   Delta = contact_B - contact_A (how much fence wanders in probeAxis over the span)
 *   Span  = machine coord at B - machine coord at A (along checkAxis)
 *   Angle = ATAN(delta / span) → misalignment in degrees
 *
 * Probe result codes (DDCS M350):
 *   2=SUCCESS — check !=2 for failure (NOT ==1)
 *
 * Probe trigger positions (machine coords):
 *   #1925=X  #1926=Y  #1927=Z
 */

export class AlignmentWizard {
    constructor() {}

    generate(params) {
        const {
            checkAxis,  // 'X' or 'Y' — axis the fence runs along
            probeDir,   // 'pos' or 'neg' — direction probe moves to touch fence
            safeZ,      // safe Z LIFT amount (relative, mm above current Z)
            tolerance,  // mm — comment only for operator reference
            dist,       // max probe distance
            retract,    // retract distance
            f_fast,     // fast feedrate
            f_slow,     // slow feedrate
            port,       // probe input port
            level,      // probe level (0 or 1)
            qStop       // stop mode (0 or 1)
        } = params;

        const _safeZ    = Number(safeZ)    || 10;
        const _dist     = Number(dist)     || 20;
        const _retract  = Number(retract)  || 2;
        const _f_fast   = Number(f_fast)   || 200;
        const _f_slow   = Number(f_slow)   || 20;
        const _port     = Number(port)     || 0;
        const _level    = Number(level)    || 0;
        const _qStop    = Number(qStop)    || 0;

        // probeAxis is perpendicular to checkAxis
        const probeAxis  = checkAxis === 'X' ? 'Y' : 'X';
        const axisStatus = probeAxis === 'X' ? '#1920' : '#1921';
        const axisResult = probeAxis === 'X' ? '#1925' : '#1926';

        // Machine coordinate variable for checkAxis (to compute span automatically)
        // #880=X, #881=Y, #882=Z machine positions
        const coordVar   = checkAxis === 'X' ? '#880' : '#881';

        const dirSign     = probeDir === 'pos' ? '+' : '-';
        const retractSign = probeDir === 'pos' ? '-' : '+';

        let gcode = '';
        gcode += this.generateHeader(checkAxis, probeAxis, dirSign, tolerance, _f_fast, _f_slow, _dist, _retract, _safeZ);
        gcode += this.generateMotionVariables(_dist, _retract, _f_fast, _f_slow, _port, _safeZ);

        // ===== POINT A =====
        gcode += `( ===== POINT A: First probe along ${checkAxis} fence ===== )\n`;
        gcode += `( Position probe at point A along the fence, at probing height )\n`;
        gcode += `#1505=1 ( Press Enter when in position at point A )\n\n`;

        // Capture checkAxis machine coordinate at A
        gcode += `#70=${coordVar} ( Record point A ${checkAxis} machine coord )\n\n`;

        // Probe in G91 incremental
        gcode += `G91 ( Incremental mode )\n\n`;
        gcode += this.generateTwoPassProbe(probeAxis, dirSign, retractSign, axisStatus, axisResult, '#50', _level, _qStop);

        // Lift Z safely (in G91 incremental) before user jogs to point B
        gcode += `G0 Z#19 ( Lift ${_safeZ}mm to clear workpiece for jogging )\n\n`;
        gcode += `G90 ( Absolute mode )\n\n`;

        // ===== POINT B =====
        gcode += `( ===== POINT B: Second probe along ${checkAxis} fence ===== )\n`;
        gcode += `( Jog along the ${checkAxis} fence to point B — keep same Y/Z position )\n`;
        gcode += `#1505=1 ( Press Enter when in position at point B )\n\n`;

        // Capture checkAxis machine coordinate at B and compute span
        gcode += `#71=${coordVar} ( Record point B ${checkAxis} machine coord )\n`;
        gcode += `#72=[#71-#70]  ( Span = B - A along ${checkAxis} )\n\n`;

        // Descend back to probing height (G91 — move DOWN by same safeZ lift amount)
        gcode += `G91 ( Incremental mode )\n`;
        gcode += `G0 Z#20 ( Descend back to probe height )\n\n`;

        gcode += this.generateTwoPassProbe(probeAxis, dirSign, retractSign, axisStatus, axisResult, '#51', _level, _qStop);

        gcode += `G90 ( Absolute mode )\n\n`;

        // ===== COMPUTE RESULTS =====
        gcode += `( ===== COMPUTE ALIGNMENT ===== )\n`;
        gcode += `#52=[#51-#50]         ( Delta: fence wander in ${probeAxis} from A to B )\n`;
        gcode += `#53=ABS[#72]          ( Absolute span along ${checkAxis} )\n`;
        // Guard against zero span to avoid division by zero
        gcode += `IF #53==0 GOTO1       ( Abort if A and B are at same position )\n`;
        gcode += `#54=ATAN[#52/#53]     ( Misalignment angle in degrees )\n\n`;

        // Lift Z before displaying results
        gcode += `G0 Z#19 ( Lift to safe height before display )\n\n`;
        gcode += `G90 ( Absolute mode )\n\n`;

        // Single result dialog showing all three values using #1510-#1512 format vars
        gcode += `( ===== RESULTS ===== )\n`;
        gcode += `#1510=#52 ( Delta: fence wander in probe axis )\n`;
        gcode += `#1511=#53 ( Span: absolute distance along check axis )\n`;
        gcode += `#1512=#54 ( Angle: misalignment in degrees )\n`;
        gcode += `#1505=-5000(Drift=%.3fmm Span=%.1fmm Angle=%.3fdeg)\n`;
        gcode += `IF #1505==1 GOTO2\n\n`;

        gcode += this.generateFooter();
        return gcode;
    }

    // Two-pass probe: fast → retract → slow → save → retract
    generateTwoPassProbe(probeAxis, dirSign, retractSign, axisStatus, axisResult, resultVar, level, qStop) {
        const probeVar   = dirSign   === '+' ? '#8' : '#7';
        const retractVar = retractSign === '+' ? '#10' : '#9';
        let c = '';
        c += `( Fast probe toward fence )\n`;
        c += `G31 ${probeAxis}${probeVar} F#3 P#5 L${level} Q${qStop}\n`;
        c += `IF ${axisStatus}!=2 GOTO1\n`;
        c += `G0 ${probeAxis}${retractVar} ( Retract )\n\n`;
        c += `( Slow probe for precision )\n`;
        c += `G31 ${probeAxis}${probeVar} F#4 P#5 L${level} Q${qStop}\n`;
        c += `IF ${axisStatus}!=2 GOTO1\n`;
        c += `${resultVar}=${axisResult} ( Save contact position - machine coord )\n`;
        c += `G0 ${probeAxis}${retractVar} ( Retract from fence )\n\n`;
        return c;
    }

    generateHeader(checkAxis, probeAxis, dirSign, tolerance, f_fast, f_slow, dist, retract, safeZ) {
        const dirLabel = dirSign === '+' ? 'pos' : 'neg';
        let h = `( Alignment | Fence along: ${checkAxis} | Probe: ${probeAxis} ${dirLabel} )\n`;
        h += `( Misalignment = contact_B - contact_A over the span along ${checkAxis} )\n`;
        h += `( Tolerance: ${tolerance}mm | SafeZ: ${safeZ}mm | Fast: ${f_fast} | Slow: ${f_slow} )\n\n`;
        return h;
    }

    generateMotionVariables(dist, retract, f_fast, f_slow, port, safeZ) {
        let v = `( Motion Variables )\n`;
        v += `#1=${dist}    ( Max probe distance )\n`;
        v += `#2=${retract} ( Retract distance )\n`;
        v += `#3=${f_fast}  ( Fast feedrate )\n`;
        v += `#4=${f_slow}  ( Slow feedrate )\n`;
        v += `#5=${port}    ( Probe port )\n\n`;
        v += `( Pre-calculated motion values )\n`;
        v += `#7=[0-#1]  ( Negative max probe )\n`;
        v += `#8=#1      ( Positive max probe )\n`;
        v += `#9=[0-#2]  ( Negative retract )\n`;
        v += `#10=#2     ( Positive retract )\n`;
        v += `#19=${safeZ}      ( Safe Z lift distance — positive )\n`;
        v += `#20=[0-${safeZ}] ( Safe Z descend distance — negative )\n\n`;
        v += `( Result storage )\n`;
        v += `#50=0 ( Point A ${dist}mm probe contact )\n`;
        v += `#51=0 ( Point B probe contact )\n`;
        v += `#52=0 ( Delta: B - A wander )\n`;
        v += `#53=0 ( Span absolute value )\n`;
        v += `#54=0 ( Misalignment angle degrees )\n`;
        v += `#70=0 ( Point A checkAxis machine coord )\n`;
        v += `#71=0 ( Point B checkAxis machine coord )\n`;
        v += `#72=0 ( Span signed: B - A )\n\n`;
        return v;
    }

    generateFooter() {
        let f = `GOTO2\n\n`;
        f += `N1\n`;
        f += `G90\n`;
        f += `#1505=1 ( Probe failed or zero span - check position )\n\n`;
        f += `N2\nM30\n`;
        return f;
    }
}
