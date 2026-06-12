/**
 * DDCS Studio - Rotary Clock Wizard (A0 to a feature)
 * Datums the rotary axis off a FLAT, the standard way: probe the flat at two points
 * across it (in Y), measure its tilt, and set A0 = flat level (facing +Z / top).
 * This is the rotary equivalent of tramming a vise.
 *
 * Method (horizontal 4th axis, spin around X):
 *   probe down (Z-) at point A, retract clear, step +Y by the span, probe down at
 *   point B. tilt phi = ATAN[(Zb - Za)] / span  (degrees). Set the A work offset so
 *   the level orientation reads A0 — WITHOUT physically rotating the part:
 *       #[#70+3] = (current A machine #883) - phi
 *   No centreline needed (tilt is a slope). Reports phi.
 *
 * CONVENTION: phi > 0 means the +Y point is higher. The A sign that "levels" it
 * depends on your rotary's positive direction — verify on the machine and flip the
 * span sign if it datums the wrong way. Probe results Z#1927; A machine #883.
 */
import { w, G, M, N, X, Y, Z, F, P, L, Q, set, line, comment } from './words.js';
import { ifGoto, goto, g53, wcsBase } from './dialect.js';
import { twoPassProbe, toNum as toNumShared } from './probeBlocks.js';

export class RotaryClockWizard {
    constructor() {}

    /** Preview start (stock frame): above the flat near the top, offset to point A (-Y half of span). */
    inferStart(params, stock) {
        const n = (v, d) => toNumShared(v, d);
        const sy = n(stock && stock.y, 76), sz = n(stock && stock.z, 76);
        const span = n(params.span, 20);
        return { x: n(stock && stock.x, 150) / 2, y: sy / 2 - span / 2, z: Math.min(5, sz * 0.5) };
    }

    generate(params) {
        const level = toNumShared(params.level, 0);
        const qStop = toNumShared(params.qStop, 1);
        const span = toNumShared(params.span, 20);
        const dist = toNumShared(params.dist, 30);
        const retract = toNumShared(params.retract, 2);
        const safeZ = toNumShared(params.safeZ, 10);
        const f_fast = toNumShared(params.f_fast, 200);
        const f_slow = toNumShared(params.f_slow, 50);
        const port = toNumShared(params.port, 3);
        const action = ['set', 'report', 'rotate'].includes(params.action) ? params.action : 'set';
        const refAngle = params.reference === 'side' ? 90 : 0;   // top(+Z)=0, +Y side=90
        const refLabel = refAngle ? '+Y side (3 o’clock)' : 'top (+Z)';
        const { code: wcsCode, label: wcsLabel } = wcsBase(params.wcs || 'active');

        const actLabel = action === 'report' ? 'measure only' : action === 'rotate' ? 'rotate to 0' : 'set A0';
        let g = '';
        g += `( Rotary clock | ${actLabel} | ref ${refLabel} | span ${span}mm | ${wcsLabel} )\n`;
        g += `( Indicate a flat: probe two points across it in Y, find tilt, datum A. No centreline needed. )\n`;
        g += `( Max probe ${dist}mm | Retract ${retract}mm | Safe Z ${safeZ}mm | Fast ${f_fast} | Slow ${f_slow} )\n\n`;

        g += `( Motion Variables )\n`;
        g += `#1=${dist}   ( Max probe distance )\n#2=${retract}   ( Retract )\n`;
        g += `#3=${f_fast}   ( Fast feed )\n#4=${f_slow}   ( Slow feed )\n#5=${port}   ( Probe port )\n`;
        g += `#6=${span}   ( Y span between the two flat touches )\n`;
        g += `( Results: #51 Za  #52 Zb  #53 tilt(deg)  #54 A machine )\n`;
        g += `#7=[0-#1]   ( Neg max )\n#8=#1   ( Pos max )\n#9=[0-#2]   ( Neg retract )\n#10=#2   ( Pos retract )\n#17=${parseInt(safeZ, 10) || 0}   ( Safe Z )\n\n`;

        g += wcsCode;
        g += comment('Confirm Start') + '\n'
            + line([set('#1505', '1')], 'Position over the flat, near A0. Enter to probe - ESC=cancel') + '\n'
            + ifGoto('#1505', '==', '0', 2) + '\n\n';
        g += line([G(91)], 'Incremental mode') + '\n\n';

        const ppZ = (resultVar, save) => twoPassProbe({ axis: 'Z', dirSign: '-', resultVar, level, qStop, comments: { save } });

        g += comment('Point A: probe down onto the flat') + '\n' + ppZ('#51', 'Save Za');
        g += line([G(0), Z('#17')], 'Retract clear above the flat') + '\n';
        g += line([G(0), Y('#6')], 'Step across the flat by the span (+Y)') + '\n\n';
        g += comment('Point B: probe down onto the flat') + '\n' + ppZ('#52', 'Save Zb');

        g += comment('Tilt of the flat (degrees) = atan( dZ / span )') + '\n';
        g += line([set('#53', 'ATAN[[#52-#51]]/[#6]')], 'phi = ATAN(Zb-Za / span)') + '\n';
        g += line([set('#54', '#883')], 'Current A machine position') + '\n\n';

        const refTerm = refAngle ? `-${refAngle}` : '';
        if (action === 'report') {
            g += comment('Measure only - A offset left unchanged') + '\n\n';
        } else if (action === 'rotate') {
            g += comment(`Rotate the flat to ${refLabel}, then zero A there - SPINS THE PART (verify direction)`) + '\n';
            g += line([set('#58', `[0-#53${refTerm}]`)], 'Rotation to reach the reference') + '\n';
            g += line([G(91), w('A', '#58')], 'Rotate part to the reference orientation') + '\n';
            g += line([set('#[#70+3]', '#883')], `Set ${wcsLabel} A0 at the reference`) + '\n\n';
        } else { // set
            g += comment(`Set A0 at ${refLabel} without rotating (verify direction on your machine)`) + '\n';
            g += line([set('#[#70+3]', `[#54-#53${refTerm}]`)], `Set ${wcsLabel} A0`) + '\n\n';
        }

        g += comment('Final retract') + '\n' + line([G(0), Z('#17')], 'Retract to safe Z') + '\n\n';

        g += line([G(90)], 'Back to absolute') + '\n';
        g += line([set('#1505', '-5000')], action === 'report' ? 'Flat tilt #53 deg (measured)' : 'Flat tilt #53 deg - A datum set') + '\n';
        g += goto(2) + '\n\n';
        g += line([N(1)]) + '\n';
        g += line([G(91), G(0), Z('#17')], 'Safe Z on failure') + '\n';
        g += line([G(90)]) + '\n';
        g += line([set('#1505', '1')], 'Probe failed - no contact') + '\n\n';
        g += line([N(2)]) + '\n' + line([M(30)]) + '\n';
        return g;
    }
}
