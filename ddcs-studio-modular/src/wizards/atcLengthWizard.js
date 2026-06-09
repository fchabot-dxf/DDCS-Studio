/**
 * DDCS Studio - ATC Tool Length Setter Wizard
 * Generates G-code for touching off a tool on a fixed tool setter block
 * and calculating the length offset into the H register.
 */
import { w, G, M, N, Z, F, P, L, Q, set, line, comment } from './words.js';
import { ifGoto, goto } from './dialect.js';

export class AtcLengthWizard {
    constructor() {}

    toNum(v, def = 0) {
        if (v === undefined || v === null) return def;
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    }

    generate(params) {
        const _blockHeight = this.toNum(params.blockHeight, 50.0);
        const _safeZ       = this.toNum(params.safeZ, 10.0);
        const _maxDist     = this.toNum(params.maxDist, 200);
        const _retract     = this.toNum(params.retract, 3);
        const _f_fast      = this.toNum(params.f_fast, 300);
        const _f_slow      = this.toNum(params.f_slow, 50);
        const _port        = this.toNum(params.port, 4);
        const _level       = this.toNum(params.level, 0);
        const _qStop       = this.toNum(params.qStop, 1);

        let gcode = '';
        gcode += `( ATC | Tool Length Setter )\n`;
        gcode += `( Block Height: ${_blockHeight}mm | Safe Z: ${_safeZ}mm )\n`;
        gcode += `( Fast: ${_f_fast} | Slow: ${_f_slow} | Max Plunge: ${_maxDist}mm )\n\n`;

        gcode += `( === CONFIGURATION === )\n`;
        gcode += `#1=${_maxDist}    ( Max search distance )\n`;
        gcode += `#2=${_retract}    ( Retract distance )\n`;
        gcode += `#3=${_f_fast}   ( Fast approach feedrate )\n`;
        gcode += `#4=${_f_slow}    ( Slow precision touch feedrate )\n`;
        gcode += `#5=${_port}      ( Probe port )\n`;
        gcode += `#6=${_blockHeight}   ( Tool setter block height )\n`;
        gcode += `#19=${_safeZ}    ( Safe Z height )\n\n`;

        gcode += `( === CALCULATED MOTIONS === )\n`;
        gcode += `#7=[0-#1]  ( Negative plunge )\n`;
        gcode += `#10=#2     ( Positive retract )\n\n`;

        gcode += `( Confirm Start )\n#1505=1 ( Hover tool above setter. Press Enter )\n\n`;

        gcode += line([G(91)], 'INCREMENTAL MODE') + '\n\n';

        gcode += comment('Step 1: Fast Probe Down') + '\n';
        gcode += line([G(31), Z('#7'), F('#3'), P('#5'), L(_level), Q(_qStop)], 'Fast plunge') + '\n';
        gcode += ifGoto('#1922', '==', '0', 1) + '\n';
        
        gcode += line([G(0), Z('#10')], 'Retract up') + '\n\n';
        
        gcode += comment('Step 2: Slow Precision Touch') + '\n';
        gcode += line([G(31), Z('#7'), F('#4'), P('#5'), L(_level), Q(_qStop)], 'Slow probe') + '\n';
        gcode += ifGoto('#1922', '==', '0', 1) + '\n\n';

        gcode += line([G(90)], 'Absolute mode') + '\n\n';

        gcode += comment('Calculate and Store Tool Length Offset') + '\n';
        gcode += line([set('#101', '#1927')], 'Read Machine Z trigger pos') + '\n';
        gcode += line([set('#102', '[#101 - #6]')], 'Length = MachineZ - BlockHeight') + '\n';
        gcode += line([set('#574', '#102')], 'Save to Current Tool H Offset') + '\n\n';

        gcode += line([G(0), Z('#19')], 'Retract to safe Z') + '\n';
        
        gcode += line([set('#1505', '-5000')], 'Tool length successfully saved') + '\n';
        gcode += goto(2) + '\n\n';

        gcode += comment('=== ERROR HANDLER ===') + '\n';
        gcode += line([N(1)]) + '\n';
        gcode += line([G(90)]) + '\n';
        gcode += line([set('#1505', '1')], 'ERROR: Tool Setter missed') + '\n\n';
        gcode += line([N(2)]) + '\n' + line([M(30)]) + '\n';

        return gcode;
    }
}
