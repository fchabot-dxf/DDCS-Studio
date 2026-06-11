/**
 * DDCS Studio - ATC Spindle Warm-up Wizard
 * Generates G-code for a multi-stage spindle warmup sequence.
 */
import { w, G, M, N, S, P, set, line, comment } from './words.js';
import { ifGoto, goto } from './dialect.js';
import { toNum as toNumShared } from './probeBlocks.js';

export class AtcWarmupWizard {
    constructor() {}

    toNum(v, def = 0) {
        return toNumShared(v, def);
    }

    generate(params) {
        const _rpm1 = this.toNum(params.rpm1, 6000);
        const _time1 = this.toNum(params.time1, 30);
        const _rpm2 = this.toNum(params.rpm2, 12000);
        const _time2 = this.toNum(params.time2, 30);

        let gcode = '';
        gcode += `( ATC | Spindle Warm-up )\n`;
        gcode += `( Stage 1: ${_rpm1} RPM for ${_time1}s )\n`;
        gcode += `( Stage 2: ${_rpm2} RPM for ${_time2}s )\n\n`;

        gcode += `( === CONFIGURATION === )\n`;
        gcode += `#140=${_rpm1}     ( Stage 1 RPM )\n`;
        gcode += `#141=${_time1 * 1000}    ( Stage 1 Duration: ${_time1} s in ms - DDCS G4 P is ms )\n`;
        gcode += `#142=${_rpm2}    ( Stage 2 RPM )\n`;
        gcode += `#143=${_time2 * 1000}    ( Stage 2 Duration: ${_time2} s in ms )\n\n`;

        gcode += `( Single confirmation )\n`;
        gcode += line([set('#1505', '1')], 'Warm up spindle? Press Enter') + '\n';
        gcode += ifGoto('#1505', '==', '0', 999) + '\n\n';

        gcode += `( Initialize - stop spindle if running )\n`;
        gcode += line([M(5), M(9)], 'Stop spindle & coolant') + '\n\n';

        gcode += `( === WARMUP SEQUENCE === )\n`;
        gcode += line([set('#1510', '#140')], 'Display RPM') + '\n';
        gcode += line([set('#1505', '-5000')], 'Starting at %.0f RPM...') + '\n';
        gcode += line([M(3), S('#140')], 'Start Stage 1') + '\n';
        gcode += line([G(4), P('#141')], 'Wait Stage 1') + '\n\n';

        gcode += line([set('#1510', '#142')], 'Display RPM') + '\n';
        gcode += line([set('#1505', '-5000')], 'Ramping to %.0f RPM...') + '\n';
        gcode += line([M(3), S('#142')], 'Start Stage 2') + '\n';
        gcode += line([G(4), P('#143')], 'Wait Stage 2') + '\n\n';

        gcode += `( Stop )\n`;
        gcode += line([M(5)], 'Stop Spindle') + '\n\n';

        gcode += `( Complete )\n`;
        gcode += line([set('#1505', '-5000')], 'Warmup complete - Spindle ready!') + '\n\n';

        gcode += `( Normal end )\n`;
        gcode += line([N(999)]) + '\n';
        gcode += line([M(30)]) + '\n';

        return gcode;
    }
}
