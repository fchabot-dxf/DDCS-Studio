/**
 * DDCS Studio - Rotary Centreline Wizard (4th-axis setup)
 * Finds the rotary (A) axis centreline + radius for a cylinder on a horizontal 4th
 * axis (spin around X → cross-section in the Y-Z plane: probe the top in Z, the
 * flanks in Y). Sets the work origin: Y0 on the centreline, Z0 on the centreline
 * OR the OD top.
 *
 * Two methods (operator's choice):
 *   known — enter the blank diameter; probe top + ±Y. Yc = midpoint of the flanks
 *           (exact at any height); Zc = top − R. 3 touches, robust.
 *   fit   — no diameter: probe 3 operator-placed points on the Y-Z circle and solve
 *           the circle (centre + R). SQRT + bracket math. ADVANCED — verify on the
 *           machine before trusting it.
 *
 * Machine vars: positions #880=X #881=Y #882=Z; probe results X#1925 Y#1926 Z#1927.
 * WCS offsets stride 5: #[#70+1]=Y, #[#70+2]=Z. Results local (#50..#63, no priming).
 */
import { w, G, M, N, X, Y, Z, F, P, L, Q, set, line, comment, raw } from './words.js';
import { ifGoto, goto, g53, wcsBase } from './dialect.js';
import { twoPassProbe, toNum as toNumShared } from './probeBlocks.js';

export class RotaryCenterWizard {
    constructor() {}

    /** Preview start (stock frame): above the cylinder top, centred, ready to probe down. */
    inferStart(params, stock) {
        const n = (v, d) => toNumShared(v, d);
        const sy = n(stock && stock.y, 76), sz = n(stock && stock.z, 76);
        return { x: n(stock && stock.x, 150) / 2, y: sy / 2, z: Math.min(5, sz * 0.5) };
    }

    generate(params) {
        const method = params.method === 'fit' ? 'fit' : 'known';
        const datum = params.datum === 'top' ? 'top' : 'center';
        const level = toNumShared(params.level, 0);
        const qStop = toNumShared(params.qStop, 1);
        const diameter = toNumShared(params.diameter, 76.2);
        const dist = toNumShared(params.dist, 30);
        const retract = toNumShared(params.retract, 2);
        const safeZ = toNumShared(params.safeZ, 15);
        const f_fast = toNumShared(params.f_fast, 200);
        const f_slow = toNumShared(params.f_slow, 50);
        const port = toNumShared(params.port, 3);
        const { code: wcsCode, label: wcsLabel } = wcsBase(params.wcs || 'active');

        let g = '';
        g += `( Rotary centreline | ${method === 'fit' ? '3-point fit' : 'known dia ' + diameter} | Z0 at ${datum === 'top' ? 'OD top' : 'centreline'} | ${wcsLabel} )\n`;
        g += `( Horizontal 4th axis: spin X -> probe top in Z, flanks in Y. Centreline runs along X. )\n`;
        g += `( Max probe ${dist}mm | Retract ${retract}mm | Safe Z ${safeZ}mm | Fast ${f_fast} | Slow ${f_slow} )\n\n`;

        g += `( Motion Variables )\n`;
        g += `#1=${dist}   ( Max probe distance )\n#2=${retract}   ( Retract )\n`;
        g += `#3=${f_fast}   ( Fast feed )\n#4=${f_slow}   ( Slow feed )\n#5=${port}   ( Probe port )\n`;
        g += `( Results: #50 top  #54 Yc  #55 R  #56 Zc )\n`;
        g += `#7=[0-#1]   ( Neg max )\n#8=#1   ( Pos max )\n#9=[0-#2]   ( Neg retract )\n#10=#2   ( Pos retract )\n#17=${parseInt(safeZ, 10) || 0}   ( Safe Z )\n\n`;

        g += wcsCode;
        g += comment('Confirm Start') + '\n'
            + line([set('#1505', '1')], 'Press Enter to probe - ESC=cancel') + '\n'
            + ifGoto('#1505', '==', '0', 2) + '\n\n';
        g += line([G(91)], 'Incremental mode') + '\n\n';

        const pp = (axis, dirSign, resultVar, save) => twoPassProbe({ axis, dirSign, resultVar, level, qStop, comments: { save } });

        if (method === 'known') {
            g += comment('=== Known diameter: top + two flanks ===') + '\n\n';
            g += comment('Probe top (Z down)') + '\n' + pp('Z', '-', '#50', 'Save OD top Z');
            g += comment('Probe +Y flank') + '\n' + pp('Y', '+', '#52', 'Save +Y');
            g += comment('Probe -Y flank') + '\n' + pp('Y', '-', '#53', 'Save -Y');
            g += comment('Centre + radius') + '\n';
            g += line([set('#54', '[#52+#53]/2')], 'Yc = midpoint of flanks') + '\n';
            g += line([set('#55', `${diameter}/2`)], 'R = known diameter / 2') + '\n';
            g += line([set('#56', '[#50-#55]')], 'Zc = top - R') + '\n\n';
        } else {
            g += comment('=== 3-point circle fit (no diameter) === ADVANCED: verify on machine') + '\n\n';
            g += comment('Point 1: top (capture Z trigger + current Y)') + '\n' + pp('Z', '-', '#51', 'P1 Z');
            g += line([set('#52', '#881')], 'P1 Y (machine)') + '\n\n';
            g += this.reposition('move clear to the +Y side of the cylinder');
            g += comment('Point 2: +Y flank (capture Y trigger + current Z)') + '\n' + pp('Y', '+', '#53', 'P2 Y');
            g += line([set('#54', '#882')], 'P2 Z (machine)') + '\n\n';
            g += this.reposition('move clear to the -Y side of the cylinder');
            g += comment('Point 3: -Y flank (capture Y trigger + current Z)') + '\n' + pp('Y', '-', '#55', 'P3 Y');
            g += line([set('#56', '#882')], 'P3 Z (machine)') + '\n\n';
            g += comment('Solve circle through P1(#52,#51) P2(#53,#54) P3(#55,#56) [a=Y b=Z]') + '\n';
            g += line([set('#60', '[#52*#52]+[#51*#51]')], '|P1|^2') + '\n';
            g += line([set('#61', '[#53*#53]+[#54*#54]')], '|P2|^2') + '\n';
            g += line([set('#62', '[#55*#55]+[#56*#56]')], '|P3|^2') + '\n';
            g += line([set('#63', '2*[[#52*[#54-#56]]+[#53*[#56-#51]]+[#55*[#51-#54]]]')], 'd (twice signed area)') + '\n';
            g += line([set('#54', '[[#60*[#54-#56]]+[#61*[#56-#51]]+[#62*[#51-#54]]]/#63')], 'Yc') + '\n';
            g += line([set('#56', '[[#60*[#55-#53]]+[#61*[#52-#55]]+[#62*[#53-#52]]]/#63')], 'Zc') + '\n';
            g += line([set('#55', 'SQRT[[[#52-#54]*[#52-#54]]+[[#51-#56]*[#51-#56]]]')], 'R') + '\n';
            g += line([set('#50', '[#56+#55]')], 'OD top = Zc + R') + '\n\n';
        }

        g += comment('Final retract') + '\n' + line([G(0), Z('#17')], 'Retract to safe Z') + '\n\n';

        const zZero = datum === 'top' ? '#50' : '#56';
        g += comment(`Write work origin (Z0 at ${datum === 'top' ? 'OD top' : 'centreline'})`) + '\n';
        g += line([set('#[#70+1]', '#54')], `Set ${wcsLabel} Y0 to centreline`) + '\n';
        g += line([set('#[#70+2]', zZero)], `Set ${wcsLabel} Z0`) + '\n\n';

        g += line([G(90)], 'Back to absolute') + '\n';
        g += line([set('#1505', '-5000')], 'Centreline Y#54 Z#56 - R#55') + '\n';
        g += goto(2) + '\n\n';
        g += line([N(1)]) + '\n';
        g += line([G(91), G(0), Z('#17')], 'Safe Z on failure') + '\n';
        g += line([G(90)]) + '\n';
        g += line([set('#1505', '1')], 'Probe failed - no contact') + '\n\n';
        g += line([N(2)]) + '\n' + line([M(30)]) + '\n';
        return g;
    }

    reposition(msg) {
        let c = line([set('#57', '#882')], 'Save current Z machine position') + '\n';
        c += line([G(0), Z('#17')], 'Retract to safe Z') + '\n\n';
        c += comment(`REPOSITION: ${msg}`) + '\n';
        c += line([set('#1505', '1')], 'Press Enter when repositioned - ESC=cancel') + '\n';
        c += ifGoto('#1505', '==', '0', 2) + '\n';
        c += g53('Z', '#57', 'Restore to saved probe height') + '\n';
        c += line([G(91)], 'Back to incremental') + '\n\n';
        return c;
    }
}
