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
 *
 * G-code construct lines are emitted through the words.js "post". Padded compute
 * lines and the no-space #1505 popup are kept literal (see middleWizard.js note).
 */
import { w, G, M, N, Z, F, P, L, Q, set, line, comment } from './words.js';
import { ifGoto, goto } from './dialect.js';
import { twoPassProbe, srcVal, srcNote } from './probeBlocks.js';

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
        const _src      = params.sources || {};   // controller-resident fields (PROBE-CONFIG-SOURCE.md)
        const _levelOut = _src.level ? _src.level.ctrl : _level;

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
        gcode += this.generateMotionVariables(_dist, _retract, _f_fast, _f_slow, _port, _safeZ, _src);

        // ===== POINT A =====
        gcode += comment(`===== POINT A: First probe along ${checkAxis} fence =====`) + '\n';
        gcode += comment('Position probe at point A along the fence, at probing height') + '\n';
        gcode += line([set('#1505', '1')], 'Press Enter when in position at point A - ESC=cancel') + '\n';
        gcode += ifGoto('#1505', '==', '0', 2) + '\n\n';

        // Capture checkAxis machine coordinate at A
        gcode += line([set('#70', coordVar)], `Record point A ${checkAxis} machine coord`) + '\n\n';

        // Probe in G91 incremental
        gcode += line([G(91)], 'Incremental mode') + '\n\n';
        gcode += this.generateTwoPassProbe(probeAxis, dirSign, retractSign, axisStatus, axisResult, '#50', _levelOut, _qStop);

        // Lift Z safely (in G91 incremental) before user jogs to point B
        gcode += line([G(0), Z('#19')], `Lift ${_safeZ}mm to clear workpiece for jogging`) + '\n\n';
        gcode += line([G(90)], 'Absolute mode') + '\n\n';

        // ===== POINT B =====
        gcode += comment(`===== POINT B: Second probe along ${checkAxis} fence =====`) + '\n';
        gcode += comment(`REPOSITION: jog to point B along the ${checkAxis} fence — keep same Y/Z`) + '\n';
        gcode += line([set('#1505', '1')], 'Press Enter when in position at point B - ESC=cancel') + '\n';
        gcode += ifGoto('#1505', '==', '0', 2) + '\n\n';

        // Capture checkAxis machine coordinate at B and compute span
        gcode += line([set('#71', coordVar)], `Record point B ${checkAxis} machine coord`) + '\n';
        gcode += `#72=[#71-#70]  ( Span = B - A along ${checkAxis} )\n\n`; // padded compute → literal

        // Descend back to probing height (G91 — move DOWN by same safeZ lift amount)
        gcode += line([G(91)], 'Incremental mode') + '\n';
        gcode += line([G(0), Z('#20')], 'Descend back to probe height') + '\n\n';

        gcode += this.generateTwoPassProbe(probeAxis, dirSign, retractSign, axisStatus, axisResult, '#51', _levelOut, _qStop);

        gcode += line([G(90)], 'Absolute mode') + '\n\n';

        // ===== COMPUTE RESULTS =====
        gcode += comment('===== COMPUTE ALIGNMENT =====') + '\n';
        // Padded compute lines kept literal (hand-aligned comment columns)
        gcode += `#52=[#51-#50]         ( Delta: fence wander in ${probeAxis} from A to B )\n`;
        gcode += `#53=ABS[#72]          ( Absolute span along ${checkAxis} )\n`;
        // Guard against zero span to avoid division by zero
        gcode += `IF #53==0 GOTO1       ( Abort if A and B are at same position )\n`;
        gcode += `#54=ATAN[#52/#53]     ( Misalignment angle in degrees )\n\n`;

        // Lift Z before displaying results
        gcode += line([G(0), Z('#19')], 'Lift to safe height before display') + '\n\n';
        gcode += line([G(90)], 'Absolute mode') + '\n\n';

        // Single result dialog showing all three values using #1510-#1512 format vars
        gcode += comment('===== RESULTS =====') + '\n';
        gcode += line([set('#1510', '#52')], 'Delta: fence wander in probe axis') + '\n';
        gcode += line([set('#1511', '#53')], 'Span: absolute distance along check axis') + '\n';
        gcode += line([set('#1512', '#54')], 'Angle: misalignment in degrees') + '\n';
        gcode += `#1505=-5000(Drift=%.3fmm Span=%.1fmm Angle=%.3fdeg)\n`; // no-space popup → literal
        gcode += ifGoto('#1505', '==', '1', 2) + '\n\n';

        gcode += this.generateFooter();
        return gcode;
    }

    // Two-pass probe: fast → retract → slow → save → retract
    // Two-pass probe: fast → retract → slow → save → retract
    generateTwoPassProbe(probeAxis, dirSign, retractSign, axisStatus, axisResult, resultVar, level, qStop) {
        return twoPassProbe({
            axis: probeAxis, dirSign, resultVar, level, qStop,
            retractVar: retractSign === '+' ? '#10' : '#9',
            comments: {
                fast: 'Fast probe toward fence',
                slow: 'Slow probe for precision',
                finalRetract: 'Retract from fence',
            },
        });
    }

    generateHeader(checkAxis, probeAxis, dirSign, tolerance, f_fast, f_slow, dist, retract, safeZ) {
        const dirLabel = dirSign === '+' ? 'pos' : 'neg';
        let h = `( Alignment | Fence along: ${checkAxis} | Probe: ${probeAxis} ${dirLabel} )\n`;
        h += `( Misalignment = contact_B - contact_A over the span along ${checkAxis} )\n`;
        h += `( Tolerance: ${tolerance}mm | SafeZ: ${safeZ}mm | Fast: ${f_fast} | Slow: ${f_slow} )\n\n`;
        return h;
    }

    generateMotionVariables(dist, retract, f_fast, f_slow, port, safeZ, src = {}) {
        let v = `( Motion Variables )\n`;
        v += `#1=${dist}    ( Max probe distance )\n`;
        v += `#2=${srcVal(src.retract, retract)} ( ${srcNote(src.retract, 'Retract distance')} )\n`;
        v += `#3=${srcVal(src.fastFeed, f_fast)}  ( ${srcNote(src.fastFeed, 'Fast feedrate')} )\n`;
        v += `#4=${f_slow}  ( Slow feedrate )\n`;
        v += `#5=${srcVal(src.port, port)}    ( ${srcNote(src.port, 'Probe port')} )\n\n`;
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
        let f = goto(2) + '\n\n';
        f += line([N(1)]) + '\n';
        f += line([G(90)]) + '\n';
        f += line([set('#1505', '1')], 'Probe failed or zero span - check position') + '\n\n';
        f += line([N(2)]) + '\n' + line([M(30)]) + '\n';
        return f;
    }
}
