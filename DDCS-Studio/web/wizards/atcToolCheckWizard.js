/**
 * DDCS Studio - ATC Tool Breakage / Length Re-check Wizard
 * A quick tap on the fixed tool setter that ABORTS if the tool is broken, missing,
 * or the wrong length. Re-measures with the SAME convention as the Tool Length
 * wizard (length = MachineZ trigger − block height; tool table #[1430 + T-1]) and
 * compares to the stored value; deviation beyond ± tolerance → fault.
 *
 * A broken tool is shorter → it triggers lower → measured length differs; a missing
 * tool never triggers (probe status #1922 != 2). Run it after a change, mid-program,
 * or before a finishing pass. Setter on probe port #5 (IN02 on this machine).
 */
import { w, G, M, N, Z, F, P, L, Q, set, line, comment } from './words.js';
import { ifGoto, goto } from './dialect.js';
import { toNum as toNumShared, srcVal, srcNote } from './probeBlocks.js';

export class AtcToolCheckWizard {
    constructor() {}

    generate(params) {
        const blockHeight = toNumShared(params.blockHeight, 50);
        const safeZ = toNumShared(params.safeZ, 10);
        const maxDist = toNumShared(params.maxDist, 200);
        const retract = toNumShared(params.retract, 3);
        const f_fast = toNumShared(params.f_fast, 300);
        const f_slow = toNumShared(params.f_slow, 50);
        const port = toNumShared(params.port, 2);
        const level = toNumShared(params.level, 0);
        const qStop = toNumShared(params.qStop, 1);
        const tol = toNumShared(params.tolerance, 0.5);
        const src = params.sources || {};   // controller-resident fields (PROBE-CONFIG-SOURCE.md)
        const levelOut = src.setterLevel ? src.setterLevel.ctrl : level;

        let g = '';
        g += `( ATC | Tool Breakage / Length Re-check )\n`;
        g += `( Tolerance +/-${tol}mm | Block ${blockHeight}mm | Safe Z ${safeZ}mm | Fast ${f_fast} | Slow ${f_slow} )\n`;
        g += `( Aborts if the tool is broken, missing, or the wrong length. Compares to tool table 1430+T-1. )\n\n`;

        g += `( === CONFIGURATION === )\n`;
        g += `#1=${maxDist}   ( Max search distance )\n#2=${retract}   ( Retract )\n`;
        g += `#3=${f_fast}   ( Fast approach )\n#4=${f_slow}   ( Slow touch )\n#5=${srcVal(src.setterPort, port)}   ( ${srcNote(src.setterPort, 'Setter port')} )\n`;
        g += `#6=${srcVal(src.blockHeight, blockHeight)}   ( ${srcNote(src.blockHeight, 'Tool setter block height')} )\n#19=${safeZ}   ( Safe Z )\n`;
        g += `#20=${tol}   ( Tolerance )\n#21=[0-#20]   ( Negative tolerance )\n`;
        g += `#7=[0-#1]   ( Negative plunge )\n#10=#2   ( Positive retract )\n\n`;

        g += `( Confirm Start )\n`;
        g += line([set('#1505', '1')], 'Hover tool over the setter. Press Enter - ESC=cancel') + '\n';
        g += ifGoto('#1505', '==', '0', 2) + '\n\n';

        g += line([G(91)], 'Incremental mode') + '\n\n';
        g += comment('Fast probe down') + '\n';
        g += line([G(31), Z('#7'), F('#3'), P('#5'), L(levelOut), Q(qStop)], 'Fast plunge') + '\n';
        g += ifGoto('#1922', '!=', '2', 1) + '\n';
        g += line([G(0), Z('#10')], 'Retract up') + '\n\n';
        g += comment('Slow precision touch') + '\n';
        g += line([G(31), Z('#7'), F('#4'), P('#5'), L(levelOut), Q(qStop)], 'Slow probe') + '\n';
        g += ifGoto('#1922', '!=', '2', 1) + '\n\n';

        g += line([G(90)], 'Absolute mode') + '\n\n';
        g += comment('Measure + compare to the stored tool length') + '\n';
        g += line([set('#51', '#1927')], 'Machine Z trigger') + '\n';
        g += line([set('#52', '[#51-#6]')], 'Measured length = MachineZ - block height') + '\n';
        g += line([set('#53', '#1300')], 'Current tool number') + '\n';
        g += ifGoto('#53', '<', '1', 3) + '\n';
        g += line([set('#54', '[1430+#53-1]')], 'Tool table address') + '\n';
        g += line([set('#55', '#[#54]')], 'Expected stored length') + '\n';
        g += line([set('#56', '[#52-#55]')], 'Deviation') + '\n';
        g += ifGoto('#56', '>', '#20', 4) + '\n';
        g += ifGoto('#56', '<', '#21', 4) + '\n\n';

        g += comment('Tool OK') + '\n';
        g += line([G(0), Z('#19')], 'Retract to safe Z') + '\n';
        g += line([set('#1505', '-5000')], 'Tool OK - length deviation #56 mm') + '\n';
        g += goto(2) + '\n\n';

        g += comment('=== FAULT HANDLERS ===') + '\n';
        g += line([N(1)]) + '\n' + line([G(90)]) + '\n';
        g += line([set('#1505', '1')], 'FAULT: no contact - tool broken or missing') + '\n';
        g += goto(2) + '\n\n';
        g += line([N(3)]) + '\n' + line([G(90)]) + '\n';
        g += line([set('#1505', '1')], 'ERROR: no tool number set - check #1300') + '\n';
        g += goto(2) + '\n\n';
        g += line([N(4)]) + '\n' + line([G(90)]) + '\n';
        g += line([G(0), Z('#19')], 'Retract to safe Z') + '\n';
        g += line([set('#1505', '1')], 'FAULT: length off by #56 mm - broken or wrong tool') + '\n';
        g += goto(2) + '\n\n';
        g += line([N(2)]) + '\n' + line([M(30)]) + '\n';
        return g;
    }
}
