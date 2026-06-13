/**
 * DDCS Studio - ATC Commissioning Test Wizard
 *
 * The two checks a machinist runs when building/commissioning a tool changer,
 * BEFORE trusting an automatic change with a real tool:
 *
 *   DRAWBAR mode — cycle the drawbar N times (M154 release / M155 lock) and
 *   verify both sensors answer every cycle (M301 drawbar-released, M302 drawbar-clamped).
 *   A sticky pneumatic or misadjusted sensor shows up as a hang on the exact
 *   wait — visible live on the Studio I/O panel, and on the machine.
 *
 *   POCKETS mode — visit every magazine pocket at clearance height using the
 *   controller's own pocket tables (#1330+/X #1350+/Y #1370+/Z) and pause at
 *   each for a visual alignment check. Optional descend to pocket Z per stop.
 *   No drawbar action, run with NO tool in the spindle.
 *
 * Both run unmodified in the Studio simulator (Run + Auto sensors) so the
 * logic can be proven before the first powered test.
 */
import { G, M, N, X, Y, Z, P, set, line, comment } from './words.js';
import { ifGoto, goto, g53 } from './dialect.js';
import { toNum as toNumShared } from './probeBlocks.js';

export class AtcTestWizard {
    constructor() {}

    toNum(v, def = 0) {
        return toNumShared(v, def);
    }

    generate(params) {
        return (params.mode === 'pockets') ? this.generatePockets(params) : this.generateDrawbar(params);
    }

    // ------------------------------------------------------------------
    // DRAWBAR: cycle release/lock N times, sensors verified every cycle
    // ------------------------------------------------------------------
    generateDrawbar(params) {
        const _cycles = Math.max(1, this.toNum(params.cycles, 10));
        const _dwell  = Math.max(0, this.toNum(params.dwellMs, 500));

        let gcode = '';
        gcode += `( ATC | Drawbar Cycle Test - commissioning )\n`;
        gcode += `( ${_cycles} release/lock cycles - sensors M301/M302 verified each cycle )\n`;
        gcode += `( NO tool in the spindle. A hang on a wait = that sensor/valve needs adjusting )\n\n`;

        gcode += `( === CONFIGURATION === )\n`;
        gcode += `#100=1    ( Cycle counter )\n`;
        gcode += `#101=${_cycles}    ( Cycles )\n`;
        gcode += `#102=${_dwell}    ( Dwell between actions, ms )\n\n`;

        gcode += line([M(5), M(9)], 'Spindle & coolant off') + '\n';
        gcode += line([M(300)], 'Wait: spindle-stopped sensor') + '\n\n';

        gcode += line([N(10)], 'CYCLE START') + '\n';
        gcode += line([set('#1510', '#100')], 'Message arg') + '\n';
        gcode += line([set('#1505', '-5000')], 'Cycle %.0f: RELEASE') + '\n';
        gcode += line([M(154)], 'Drawbar RELEASE') + '\n';
        gcode += line([M(301)], 'Wait: drawbar-released sensor') + '\n';
        gcode += line([G(4), P('#102')], 'Dwell') + '\n';
        gcode += line([set('#1505', '-5000')], 'Cycle %.0f: LOCK') + '\n';
        gcode += line([M(155)], 'Drawbar LOCK') + '\n';
        gcode += line([M(302)], 'Wait: tool-locked sensor') + '\n';
        gcode += line([G(4), P('#102')], 'Dwell') + '\n';
        gcode += line([set('#100', '[#100+1]')], 'Next cycle') + '\n';
        gcode += ifGoto('#100', '<=', '#101', 10) + '\n\n';

        gcode += `( Complete - drawbar left LOCKED )\n`;
        gcode += line([set('#1510', '#101')], 'Message arg') + '\n';
        gcode += line([set('#1505', '-5000')], 'Drawbar test complete: %.0f cycles OK') + '\n';
        gcode += line([M(30)]) + '\n';

        return gcode;
    }

    // ------------------------------------------------------------------
    // POCKETS: dry-run over every pocket position for alignment checks
    // ------------------------------------------------------------------
    generatePockets(params) {
        const _first   = Math.max(1, this.toNum(params.first, 1));
        const _count   = Math.max(1, this.toNum(params.count, 8));
        const _zClear  = this.toNum(params.zClear, 0);
        const descend  = params.descend === true;

        let gcode = '';
        gcode += `( ATC | Pocket Dry-Run - commissioning )\n`;
        gcode += `( Visits pockets ${_first}..${_first + _count - 1} from tables #1330/#1350/#1370 )\n`;
        gcode += `( NO tool in spindle, NO drawbar action - visual alignment check at each stop )\n\n`;

        gcode += `( === CONFIGURATION === )\n`;
        gcode += `#100=${_first}    ( First pocket )\n`;
        gcode += `#101=${_first + _count - 1}    ( Last pocket )\n`;
        gcode += `#102=${_zClear}    ( Z clearance height - MACHINE coords )\n\n`;

        gcode += line([M(5), M(9)], 'Spindle & coolant off') + '\n';
        gcode += g53('Z', '#102', 'Retract to clearance') + '\n\n';

        gcode += line([N(10)], 'NEXT POCKET') + '\n';
        gcode += line([set('#105', '[1330+#100-1]')], 'Pocket X table address') + '\n';
        gcode += line([set('#106', '[1350+#100-1]')], 'Pocket Y table address') + '\n';
        gcode += line([set('#110', '#[#105]')], 'Pocket X') + '\n';
        gcode += line([set('#111', '#[#106]')], 'Pocket Y') + '\n';
        gcode += line([G(53), X('#110'), Y('#111')], 'Over the pocket') + '\n';
        if (descend) {
            gcode += line([set('#107', '[1370+#100-1]')], 'Pocket Z table address') + '\n';
            gcode += line([set('#112', '#[#107]')], 'Pocket Z') + '\n';
            gcode += g53('Z', '#112', 'Descend to pocket height') + '\n';
        }
        gcode += line([set('#1510', '#100')], 'Message arg') + '\n';
        gcode += line([set('#1505', '1')], 'Pocket %.0f - verify alignment. Enter = next') + '\n';
        if (descend) {
            gcode += g53('Z', '#102', 'Back to clearance') + '\n';
        }
        gcode += line([set('#100', '[#100+1]')], 'Next pocket') + '\n';
        gcode += ifGoto('#100', '<=', '#101', 10) + '\n\n';

        gcode += `( Complete )\n`;
        gcode += line([set('#1505', '-5000')], 'Pocket dry-run complete') + '\n';
        gcode += line([M(30)]) + '\n';

        return gcode;
    }
}
