/**
 * DDCS Studio - Circular (bore / boss) Wizard
 * Finds the centre AND diameter of a ROUND feature, and flags out-of-round.
 *
 * Why this isn't the Middle wizard: a circle is only as wide as its diameter at
 * its own centreline. So after the X pair we re-centre in X (G53 X#53) before the
 * Y pair — otherwise the Y touch is a chord, not the diameter. Middle (rectangular)
 * has straight walls and doesn't need that.
 *
 *   bore (inside):  probe +X, -X across the hole, re-centre X, probe +Y, -Y.
 *   boss (outside): probe each face from outside; reposition pauses between faces
 *                   (the stylus can't cross the boss), re-centre X between pairs.
 *
 * Probe status #1920/#1921/#1922 → always check !=2 for failure. Trigger machine
 * coords #1925/#1926/#1927. Result vars (local, no priming): #51..#62.
 */
import { w, G, M, N, X, Y, Z, F, P, L, Q, set, line, comment } from './words.js';
import { ifGoto, goto, g53, wcsBase } from './dialect.js';
import { twoPassProbe, toNum as toNumShared, srcVal, srcNote } from './probeBlocks.js';

export class CircularWizard {
    constructor() {}

    /** Preview spindle start (3D stock frame): bore → centre just below top; boss → outside +X. */
    inferStart(params, stock) {
        const n = (v, d) => toNumShared(v, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const cx = sx / 2, cy = sy / 2;
        const probeZ = -Math.min(5, sz * 0.5);
        if ((params.featureType || 'bore') === 'boss') {
            const outset = Math.max(6, Math.min(n(params.dist, 20) * 0.6, 15));
            return { x: -outset, y: cy, z: probeZ };
        }
        return { x: cx, y: cy, z: probeZ };
    }

    generate(params) {
        const featureType = params.featureType === 'boss' ? 'boss' : 'bore';
        const level = toNumShared(params.level, 0);
        const qStop = toNumShared(params.qStop, 1);
        const dist = toNumShared(params.dist, 20);
        const retract = toNumShared(params.retract, 2);
        const safeZ = toNumShared(params.safeZ, 10);
        const f_fast = toNumShared(params.f_fast, 200);
        const f_slow = toNumShared(params.f_slow, 50);
        const port = toNumShared(params.port, 3);
        const src = params.sources || {};   // controller-resident fields (PROBE-CONFIG-SOURCE.md)
        const levelOut = src.level ? src.level.ctrl : level;

        const { code: wcsCode, label: wcsLabel } = wcsBase(params.wcs || 'active');
        const inside = featureType === 'bore';

        let g = '';
        g += `( Circular ${inside ? 'Bore (inside)' : 'Boss (outside)'} | centre + diameter | ${wcsLabel} )\n`;
        g += `( DDCS M350 - two-pass probe, X then Y, re-centred so Y is a true diameter )\n`;
        g += `( Max probe ${dist}mm | Retract ${retract}mm | Safe Z ${safeZ}mm | Fast ${f_fast} | Slow ${f_slow} )\n\n`;

        g += `( Motion Variables )\n`;
        g += `#1=${dist}   ( Max probe distance )\n`;
        g += `#2=${srcVal(src.retract, retract)}   ( ${srcNote(src.retract, 'Retract distance')} )\n`;
        g += `#3=${srcVal(src.fastFeed, f_fast)}   ( ${srcNote(src.fastFeed, 'Fast feedrate')} )\n`;
        g += `#4=${f_slow}   ( Slow feedrate )\n`;
        g += `#5=${srcVal(src.port, port)}   ( ${srcNote(src.port, 'Probe port')} )\n`;
        g += `( Result storage )\n`;
        g += `#51=0 ( +X edge )\n#52=0 ( -X edge )\n#53=0 ( X centre )\n`;
        g += `#54=0 ( +Y edge )\n#55=0 ( -Y edge )\n#56=0 ( Y centre )\n`;
        g += `#58=0 ( X diameter )\n#59=0 ( Y diameter )\n#60=0 ( mean diameter )\n#61=0 ( out-of-round )\n\n`;

        g += `( Pre-calculated motion values )\n`;
        g += `#7=[0-#1]   ( Negative max probe )\n`;
        g += `#8=#1   ( Positive max probe )\n`;
        g += `#9=[0-#2]   ( Negative retract )\n`;
        g += `#10=#2   ( Positive retract )\n`;
        g += `#17=${parseInt(safeZ, 10) || 0}   ( Safe Z distance )\n\n`;

        g += wcsCode;

        g += comment('Confirm Start') + '\n'
            + line([set('#1505', '1')], 'Press Enter to probe - ESC=cancel') + '\n'
            + ifGoto('#1505', '==', '0', 2) + '\n\n';

        g += line([G(91)], 'Incremental mode') + '\n\n';

        const pp = (axis, dirSign, resultVar, save) => twoPassProbe({
            axis, dirSign, resultVar, level: levelOut, qStop, comments: { save },
        });

        if (inside) {
            // --- BORE: probe across the hole, no repositioning ---
            g += comment('=== X axis: probe both walls across the bore ===') + '\n\n';
            g += comment('Probe +X wall') + '\n' + pp('X', '+', '#51', 'Save +X edge');
            g += comment('Probe -X wall (crosses the bore)') + '\n' + pp('X', '-', '#52', 'Save -X edge');
            g += comment('X centre') + '\n' + line([set('#53', '[#51+#52]/2')], 'Midpoint of X walls') + '\n\n';
            g += comment('Re-centre in X so the Y touch is a true diameter, not a chord') + '\n';
            g += g53('X', '#53', 'Move to bore X centre (machine coord)') + '\n';
            g += line([G(91)], 'Back to incremental') + '\n\n';
            g += comment('=== Y axis: probe both walls at the X centre ===') + '\n\n';
            g += comment('Probe +Y wall') + '\n' + pp('Y', '+', '#54', 'Save +Y edge');
            g += comment('Probe -Y wall (crosses the bore)') + '\n' + pp('Y', '-', '#55', 'Save -Y edge');
            g += comment('Y centre') + '\n' + line([set('#56', '[#54+#55]/2')], 'Midpoint of Y walls') + '\n\n';
        } else {
            // --- BOSS: probe each face from outside; reposition between faces ---
            g += comment('=== X axis: probe each side from outside ===') + '\n\n';
            g += comment('Probe +X face (approach from +X)') + '\n' + pp('X', '-', '#51', 'Save +X edge');
            g += this.reposition('move clear, around to the -X side of the boss');
            g += comment('Probe -X face (approach from -X)') + '\n' + pp('X', '+', '#52', 'Save -X edge');
            g += comment('X centre') + '\n' + line([set('#53', '[#51+#52]/2')], 'Midpoint of X faces') + '\n\n';
            g += comment('Re-centre in X at SAFE Z (the boss centre is solid - never cross it at depth)') + '\n';
            g += this.reposition('move clear, around to the +Y side of the boss',
                { axis: 'X', value: '#53', note: 'Re-centre to boss X centre (at safe Z, above the boss)' });
            g += comment('Probe +Y face (approach from +Y)') + '\n' + pp('Y', '-', '#54', 'Save +Y edge');
            g += this.reposition('move clear, around to the -Y side of the boss');
            g += comment('Probe -Y face (approach from -Y)') + '\n' + pp('Y', '+', '#55', 'Save -Y edge');
            g += comment('Y centre') + '\n' + line([set('#56', '[#54+#55]/2')], 'Midpoint of Y faces') + '\n\n';
        }

        g += comment('Diameters + roundness') + '\n';
        g += line([set('#58', '[#51-#52]')], 'X diameter') + '\n';
        g += line([set('#59', '[#54-#55]')], 'Y diameter') + '\n';
        g += line([set('#60', '[#58+#59]/2')], 'Mean diameter') + '\n';
        g += line([set('#61', '[#58-#59]')], 'Out-of-round (X dia - Y dia)') + '\n\n';

        g += comment('Final retract') + '\n' + line([G(0), Z('#17')], 'Retract to safe Z') + '\n\n';

        g += comment('Write centre to WCS') + '\n';
        g += line([set('#[#70+0]', '#53')], `Set ${wcsLabel} X to centre`) + '\n';
        g += line([set('#[#70+1]', '#56')], `Set ${wcsLabel} Y to centre`) + '\n\n';

        // Footer
        g += line([G(90)], 'Back to absolute') + '\n';
        g += line([set('#1505', '-5000')], 'Centre #53/#56 - mean dia #60 - round #61') + '\n';
        g += goto(2) + '\n\n';
        g += line([N(1)]) + '\n';
        g += line([G(91), G(0), Z('#17')], 'Safe Z on failure') + '\n';
        g += line([G(90)]) + '\n';
        g += line([set('#1505', '1')], 'Probe failed - no contact') + '\n\n';
        g += line([N(2)]) + '\n' + line([M(30)]) + '\n';
        return g;
    }

    /**
     * Retract to safe Z and wait for the operator to reposition around the boss.
     * Optional `recentre` ({axis,value,note}) runs an absolute re-centre move while at
     * SAFE Z — never at probe depth, where it would drive the stylus through the boss.
     */
    reposition(msg, recentre = null) {
        let c = line([set('#57', '#882')], 'Save current Z machine position') + '\n';
        c += line([G(0), Z('#17')], 'Retract to safe Z') + '\n\n';
        if (recentre) c += g53(recentre.axis, recentre.value, recentre.note) + '\n';
        c += comment(`REPOSITION: ${msg}`) + '\n';
        c += line([set('#1505', '1')], 'Press Enter when repositioned - ESC=cancel') + '\n';
        c += ifGoto('#1505', '==', '0', 2) + '\n';
        c += g53('Z', '#57', 'Restore to saved probe height') + '\n';
        c += line([G(91)], 'Back to incremental') + '\n\n';
        return c;
    }
}
