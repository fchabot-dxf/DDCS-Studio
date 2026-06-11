/**
 * DDCS Studio - Tool Change Wizard (Manual park / Automatic ATC)
 *
 * MANUAL mode (default, matches the studio Ultimate Bee — no ATC I/O assigned,
 * bridge/controllers/expert-m350/FINDINGS.md): stop the spindle, park the head,
 * prompt the operator to swap the tool by hand.
 *
 * AUTO mode generates a T.nc-style automatic change in the REAL DDCS Expert ATC
 * dialect (decoded from the controller's own variable map):
 *   - target tool   #1504 (stored by M6 Txx), current tool #1300, capacity #1301
 *   - pocket tables #1330+(X) #1350+(Y) #1370+(Z) — per-tool machine coords
 *   - drawbar       M154 (release) / M155 (lock) — output port = param #1250
 *   - sensor waits  M300 (spindle stopped) M302 (locked) M303 (open) M304 (closed)
 *   - dust cover    M305 / M306 (optional)
 * NOTE for the machinist: the sensor/port params (#1120-#1199, #1250-52) and the
 * pocket tables must be configured on the controller; verify the first run with
 * no tool in the spindle and a hand on the e-stop. The macro simulates end-to-end
 * in Studio (Run with Auto sensors, or hand-drive the I/O panel).
 */
import { G, M, N, X, Y, Z, set, line, comment } from './words.js';
import { ifGoto, goto, g53 } from './dialect.js';
import { toNum as toNumShared } from './probeBlocks.js';

export class AtcChangeWizard {
    constructor() {}

    toNum(v, def = 0) {
        return toNumShared(v, def);
    }

    generate(params) {
        return (params.mode === 'auto') ? this.generateAuto(params) : this.generateManual(params);
    }

    // ------------------------------------------------------------------
    // MANUAL: park + operator prompt (no ATC hardware involved)
    // ------------------------------------------------------------------
    generateManual(params) {
        const _x = this.toNum(params.x, 100);
        const _y = this.toNum(params.y, 100);
        const _z = this.toNum(params.z, 0);

        let gcode = '';
        gcode += `( ATC | Manual Tool Change )\n`;
        gcode += `( Park: X${_x} Y${_y} Z${_z} - operator swaps the tool by hand )\n\n`;

        gcode += `( === CONFIGURATION === )\n`;
        gcode += `#1=${_x}    ( Park X )\n`;
        gcode += `#2=${_y}    ( Park Y )\n`;
        gcode += `#3=${_z}    ( Park Z )\n\n`;

        gcode += `( Stop spindle and coolant )\n`;
        gcode += line([M(5), M(9)], 'Stop spindle & coolant') + '\n';
        gcode += line([set('#1155', '#880 + 0')], 'Save Tool Change X - washed for DDCS priming') + '\n';
        gcode += line([set('#1156', '#881 + 0')], 'Save Tool Change Y - washed for DDCS priming') + '\n\n';

        gcode += `( Park clear of the work - safe Z first, then XY )\n`;
        gcode += line([G(53), Z('#3')], 'Retract Z to park') + '\n';
        gcode += line([G(53), X('#1'), Y('#2')], 'Move to XY park') + '\n\n';

        gcode += `( Manual swap - blocking prompt; operator loosens collet, swaps tool, retightens )\n`;
        gcode += line([set('#1505', '1')], 'Swap tool by hand, then press Enter') + '\n\n';

        gcode += `( Complete )\n`;
        gcode += line([set('#1505', '-5000')], 'Tool change complete') + '\n';
        gcode += line([M(30)]) + '\n';

        return gcode;
    }

    // ------------------------------------------------------------------
    // AUTO: T.nc-style pick & place using the controller's own ATC model
    // ------------------------------------------------------------------
    generateAuto(params) {
        const _zClear   = this.toNum(params.zClear, 0);     // G53 Z change/clearance height
        const _capacity = this.toNum(params.capacity, 8);   // magazine pockets
        const _fixedT   = this.toNum(params.fixedT, 0);     // >0 = test a specific tool number
        const useM300   = params.waitSpindle !== false;     // wait for spindle-stopped sensor
        const useCover  = params.dustCover === true;        // M305/M306 dust cover
        const confirm   = params.confirm === true;          // blocking prompt before moving

        const target = _fixedT > 0 ? String(_fixedT) : '#1504';

        let gcode = '';
        gcode += `( ATC | Automatic Tool Change - T.nc style )\n`;
        gcode += `( Drawbar M154/M155 + sensor waits M302/M303 - pockets from tables #1330/#1350/#1370 )\n`;
        gcode += _fixedT > 0
            ? `( TEST MODE: fixed target tool T${_fixedT} )\n`
            : `( Target tool from #1504 - set by M6 Txx; save as T.nc to hook the controller's M6 )\n`;
        gcode += `( VERIFY FIRST RUN with no tool in spindle + hand on e-stop )\n\n`;

        gcode += `( === CONFIGURATION === )\n`;
        gcode += `#100=${target}    ( Target tool )\n`;
        gcode += `#101=#1300    ( Current tool in spindle, 0 = empty )\n`;
        gcode += `#102=${_zClear}    ( Z change height - MACHINE coords )\n`;
        gcode += `#103=${_capacity}    ( Magazine capacity - keep equal to param #1301 )\n\n`;

        gcode += `( === VALIDATE === )\n`;
        gcode += ifGoto('#100', '<', '1', 910) + '\n';
        gcode += ifGoto('#100', '>', '#103', 910) + '\n';
        gcode += ifGoto('#100', '==', '#101', 900) + '\n\n';

        if (confirm) {
            gcode += line([set('#1510', '#100')], 'Show target tool') + '\n';
            gcode += line([set('#1505', '1')], 'Change to tool %.0f? Press Enter') + '\n\n';
        }

        gcode += `( === SPINDLE OFF + RETRACT === )\n`;
        gcode += line([M(5), M(9)], 'Stop spindle & coolant') + '\n';
        if (useM300) gcode += line([M(300)], 'Wait: spindle-stopped sensor') + '\n';
        if (useCover) gcode += line([M(305)], 'Dust cover OPEN') + '\n';
        gcode += g53('Z', '#102', 'Retract to change height') + '\n\n';

        gcode += `( === PUT AWAY CURRENT TOOL - skipped if spindle is empty === )\n`;
        gcode += ifGoto('#101', '<', '1', 20) + '\n';
        gcode += line([set('#105', '[1330+#101-1]')], 'Old pocket X table address') + '\n';
        gcode += line([set('#106', '[1350+#101-1]')], 'Old pocket Y table address') + '\n';
        gcode += line([set('#107', '[1370+#101-1]')], 'Old pocket Z table address') + '\n';
        gcode += line([set('#110', '#[#105]')], 'Old pocket X') + '\n';
        gcode += line([set('#111', '#[#106]')], 'Old pocket Y') + '\n';
        gcode += line([set('#112', '#[#107]')], 'Old pocket Z') + '\n';
        gcode += line([G(53), X('#110'), Y('#111')], 'Over the old pocket') + '\n';
        gcode += g53('Z', '#112', 'Down: seat tool in pocket') + '\n';
        gcode += line([M(154)], 'Drawbar RELEASE') + '\n';
        gcode += line([M(303)], 'Wait: tool-open sensor') + '\n';
        gcode += line([set('#1300', '0')], 'Spindle now empty') + '\n';
        gcode += g53('Z', '#102', 'Retract clear of the pocket') + '\n\n';

        gcode += line([N(20)], 'PICK UP NEW TOOL') + '\n';
        gcode += line([set('#105', '[1330+#100-1]')], 'New pocket X table address') + '\n';
        gcode += line([set('#106', '[1350+#100-1]')], 'New pocket Y table address') + '\n';
        gcode += line([set('#107', '[1370+#100-1]')], 'New pocket Z table address') + '\n';
        gcode += line([set('#110', '#[#105]')], 'New pocket X') + '\n';
        gcode += line([set('#111', '#[#106]')], 'New pocket Y') + '\n';
        gcode += line([set('#112', '#[#107]')], 'New pocket Z') + '\n';
        gcode += line([G(53), X('#110'), Y('#111')], 'Over the new pocket') + '\n';
        gcode += line([M(154)], 'Collet OPEN before descending') + '\n';
        gcode += line([M(303)], 'Wait: tool-open sensor') + '\n';
        gcode += g53('Z', '#112', 'Down over the tool shank') + '\n';
        gcode += line([M(155)], 'Drawbar LOCK') + '\n';
        gcode += line([M(302)], 'Wait: tool-locked sensor') + '\n';
        gcode += g53('Z', '#102', 'Retract with the new tool') + '\n';
        if (useCover) gcode += line([M(306)], 'Dust cover CLOSE') + '\n';
        gcode += line([set('#1300', '#100')], 'Current tool = target') + '\n';
        gcode += line([set('#1510', '#100')], 'Message arg') + '\n';
        gcode += line([set('#1505', '-5000')], 'Tool change complete: T%.0f') + '\n';
        gcode += goto(999) + '\n\n';

        gcode += comment('=== HANDLERS ===') + '\n';
        gcode += line([N(900)]) + '\n';
        gcode += line([set('#1505', '-5000')], 'Tool already in spindle - nothing to do') + '\n';
        gcode += goto(999) + '\n\n';
        gcode += line([N(910)]) + '\n';
        gcode += line([set('#1510', '#100')], 'Message arg') + '\n';
        gcode += line([set('#1505', '1')], 'ERROR: invalid target tool %.0f - check M6 T / capacity') + '\n\n';
        gcode += line([N(999)]) + '\n';
        gcode += line([M(30)]) + '\n';

        return gcode;
    }
}
