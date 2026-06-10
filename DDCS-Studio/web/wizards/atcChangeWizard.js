/**
 * DDCS Studio - Manual Tool Change (park + operator prompt)
 *
 * The DDCS Expert M350 on the Ultimate Bee has NO pneumatic drawbar / clamp-sensor I/O
 * (controller dump: bridge/controllers/expert-m350/FINDINGS.md). A "tool change" here is MANUAL:
 * stop the spindle, park the head clear of the work, prompt the operator to swap the tool by hand,
 * and wait for them to acknowledge. No digital output/input M-codes are involved — emitting them
 * (the old M10/M11/M31/M33 drawbar dance) was fiction for this machine.
 */
import { G, M, X, Y, Z, set, line } from './words.js';

export class AtcChangeWizard {
    constructor() {}

    toNum(v, def = 0) {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : def;
    }

    generate(params) {
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
}
