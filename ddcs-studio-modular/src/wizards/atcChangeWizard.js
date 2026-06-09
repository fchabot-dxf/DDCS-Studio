/**
 * DDCS Studio - ATC Manual Tool Change Park & I/O
 * Generates G-code for parking the spindle, releasing the drawbar, waiting
 * for tool swap sensors, and securing the new tool.
 */
import { w, G, M, N, X, Y, Z, P, set, line, comment } from './words.js';
import { ifGoto, goto } from './dialect.js';

export class AtcChangeWizard {
    constructor() {}

    toNum(v, def = 0) {
        if (v === undefined || v === null) return def;
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    }

    generate(params) {
        const _x = this.toNum(params.x, 100);
        const _y = this.toNum(params.y, 100);
        const _z = this.toNum(params.z, 0);
        const _outPort = this.toNum(params.outPort, 4);
        const _inPort = this.toNum(params.inPort, 5);

        let gcode = '';
        gcode += `( ATC | Manual Tool Change )\n`;
        gcode += `( Park: X${_x} Y${_y} Z${_z} )\n`;
        gcode += `( Drawbar OUT: ${_outPort} | Clamp IN: ${_inPort} )\n\n`;

        gcode += `( === CONFIGURATION === )\n`;
        gcode += `#1=${_x}    ( Park X )\n`;
        gcode += `#2=${_y}    ( Park Y )\n`;
        gcode += `#3=${_z}    ( Park Z )\n`;
        gcode += `#4=${_outPort}    ( Drawbar Output Port )\n`;
        gcode += `#5=${_inPort}    ( Clamp Sensor Input Port )\n\n`;

        gcode += `( Save position and stop spindle )\n`;
        gcode += line([M(5), M(9)], 'Stop spindle & coolant') + '\n';
        gcode += line([set('#1155', '#880')], 'Save Tool Change X') + '\n';
        gcode += line([set('#1156', '#881')], 'Save Tool Change Y') + '\n\n';

        gcode += `( Move to safe Z then park position )\n`;
        gcode += line([G(53), Z('#3')], 'Retract Z to park') + '\n';
        gcode += line([G(53), X('#1'), Y('#2')], 'Move to XY park') + '\n\n';

        gcode += `( Release Tool )\n`;
        gcode += line([M(10), P('#4')], 'Drawbar Release ON') + '\n';
        gcode += line([M(33), P('#5')], 'Wait for Clamp Sensor OFF (Tool Released)') + '\n\n';

        gcode += `( Wait for Operator )\n`;
        gcode += line([set('#1505', '1')], 'Swap Tool. Press Enter to Clamp') + '\n';
        gcode += ifGoto('#1505', '==', '0', 999) + '\n\n';

        gcode += `( Clamp Tool )\n`;
        gcode += line([M(11), P('#4')], 'Drawbar Release OFF (Clamp)') + '\n';
        gcode += line([M(31), P('#5')], 'Wait for Clamp Sensor ON (Tool Secured)') + '\n\n';

        gcode += `( Complete )\n`;
        gcode += line([set('#1505', '-5000')], 'Tool Swap Complete!') + '\n\n';

        gcode += `( Normal end )\n`;
        gcode += line([N(999)]) + '\n';
        gcode += line([M(30)]) + '\n';

        return gcode;
    }
}
