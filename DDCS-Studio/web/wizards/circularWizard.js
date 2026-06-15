/**
 * DDCS Studio - Circular (bore / boss) Wizard — centre AND diameter of a round feature + out-of-round.
 *
 * REWRITTEN AS A BLOCK STACK: `circularStack(params)` from granular, dialect-aware atoms (Comment / Set# /
 * Confirm / Distance / Probe / Probe Check / Probe Read / Read Machine / Machine Move / Set WCS Offset / Move
 * / Message / If Goto / Goto / Label / End Program). Native across posts: probe form, status-check folding,
 * trigger read, G53 form and the WCS write all come from the active dialect.
 *
 *   bore (inside):  probe +X,-X across the hole, re-centre X (G53), probe +Y,-Y at the X centre.
 *   boss (outside): probe each face from outside; reposition pauses between faces; re-centre X between pairs.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { srcVal, srcNote } from './probeBlocks.js';

export function circularStack(params = {}) {
    const inside = (params.featureType === 'boss') ? false : true;
    const level = num(params.level, 0), dist = num(params.dist, 20), retract = num(params.retract, 2);
    const safeZ = num(params.safeZ, 10), fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
    const src = params.sources || {};
    const wcs = params.wcs || 'active', wcsLabel = wcs === 'active' ? 'Active WCS' : wcs;
    const wcsArg = wcs === 'active' ? '#578' : String(parseInt(String(wcs).replace('G', ''), 10) - 53);

    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const IF = (l, o, r, g) => { const b = newBlock('ifgoto'); b.params = { lhs: l, op: o, rhs: r, goto: g }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const DM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; S.push(b); };
    const CF = (msg, cancel) => { const b = newBlock('confirm'); b.params = { msg, cancel }; S.push(b); };
    const PR = (axis, to, feed) => { const b = newBlock('probe'); b.params = { axis, to, feed, port: '#5', level }; S.push(b); };
    const CK = (axis, goto) => { const b = newBlock('probecheck'); b.params = { axis, goto }; S.push(b); };
    const RD = (axis, v) => { const b = newBlock('proberead'); b.params = { axis, var: v }; S.push(b); };
    const RM = (axis, v) => { const b = newBlock('readmachine'); b.params = { axis, var: v }; S.push(b); };
    const MM = (axis, to) => { const b = newBlock('machinemove'); b.params = { axis, to }; S.push(b); };
    const SWO = (axis, value) => { const b = newBlock('setworkoffset'); b.params = { wcs: wcsArg, axis, value }; S.push(b); };
    const MV = (axis, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [axis.toLowerCase()]: v }; S.push(b); };
    const MSG = (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));

    // Two-pass probe of one wall/face, saving the trigger into resultVar.
    const pp = (axis, plus, resultVar) => {
        const pv = plus ? '#8' : '#7', rv = plus ? '#9' : '#10';
        PR(axis, pv, '#3'); CK(axis, 1); MV(axis, rv);
        PR(axis, pv, '#4'); CK(axis, 1); RD(axis, resultVar); MV(axis, rv);
    };
    // Retract, optional re-centre (at safe Z), operator reposition, restore probe height.
    const reposition = (msg, recentre) => {
        RM('Z', '#57'); MV('Z', '#17');
        if (recentre) MM(recentre.axis, recentre.value);
        C(`REPOSITION: ${msg}`);
        CF('Press Enter when repositioned - ESC=cancel', 2);
        MM('Z', '#57'); DM('inc');
    };

    C(`Circular ${inside ? 'Bore (inside)' : 'Boss (outside)'} | centre + diameter | ${wcsLabel}`);
    C('Two-pass probe, X then Y, re-centred so Y is a true diameter');
    C(`Max probe ${dist}mm | Retract ${retract}mm | Safe Z ${safeZ}mm | Fast ${fFast} | Slow ${fSlow}`);
    C('Motion Variables');
    A('#1', dist, 'Max probe distance');
    A('#2', srcVal(src.retract, retract), srcNote(src.retract, 'Retract distance'));
    A('#3', srcVal(src.fastFeed, fFast), srcNote(src.fastFeed, 'Fast feedrate'));
    A('#4', fSlow, 'Slow feedrate');
    A('#5', srcVal(src.port, port), srcNote(src.port, 'Probe port'));
    A('#7', '[0-#1]', 'Negative max probe'); A('#8', '#1', 'Positive max probe');
    A('#9', '[0-#2]', 'Negative retract'); A('#10', '#2', 'Positive retract');
    A('#17', Math.round(safeZ), 'Safe Z distance');

    C('Confirm Start');
    CF('Press Enter to probe - ESC=cancel', 2);
    DM('inc');

    if (inside) {
        C('=== X axis: probe both walls across the bore ===');
        C('Probe +X wall'); pp('X', true, '#51');
        C('Probe -X wall (crosses the bore)'); pp('X', false, '#52');
        A('#53', '[#51+#52]/2', 'X centre');
        C('Re-centre in X so the Y touch is a true diameter, not a chord');
        MM('X', '#53'); DM('inc');
        C('=== Y axis: probe both walls at the X centre ===');
        C('Probe +Y wall'); pp('Y', true, '#54');
        C('Probe -Y wall (crosses the bore)'); pp('Y', false, '#55');
        A('#56', '[#54+#55]/2', 'Y centre');
    } else {
        C('=== X axis: probe each side from outside ===');
        C('Probe +X face (approach from +X)'); pp('X', false, '#51');
        reposition('move clear, around to the -X side of the boss');
        C('Probe -X face (approach from -X)'); pp('X', true, '#52');
        A('#53', '[#51+#52]/2', 'X centre');
        C('Re-centre in X at SAFE Z (boss centre is solid - never cross it at depth)');
        reposition('move clear, around to the +Y side of the boss', { axis: 'X', value: '#53' });
        C('Probe +Y face (approach from +Y)'); pp('Y', false, '#54');
        reposition('move clear, around to the -Y side of the boss');
        C('Probe -Y face (approach from -Y)'); pp('Y', true, '#55');
        A('#56', '[#54+#55]/2', 'Y centre');
    }

    C('Diameters + roundness');
    A('#58', '[#51-#52]', 'X diameter'); A('#59', '[#54-#55]', 'Y diameter');
    A('#60', '[#58+#59]/2', 'Mean diameter'); A('#61', '[#58-#59]', 'Out-of-round (X dia - Y dia)');
    C('Final retract'); MV('Z', '#17');
    C('Write centre to WCS');
    SWO('X', '#53'); SWO('Y', '#56');

    DM('abs');
    MSG('Centre #53/#56 - mean dia #60 - round #61');
    GO(2);
    LB(1); DM('inc'); MV('Z', '#17'); DM('abs'); A('#1505', '1', 'Probe failed - no contact');
    LB(2); END();
    return S;
}

export class CircularWizard {
    generate(params) {
        recordOp('circular', params);
        return emitMapped(circularStack(params)).text;
    }

    /** Preview spindle start (3D stock frame): bore → centre just below top; boss → outside +X. */
    inferStart(params, stock) {
        const n = (v, d) => num(v, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const cx = sx / 2, cy = sy / 2, probeZ = -Math.min(5, sz * 0.5);
        if ((params.featureType || 'bore') === 'boss') {
            const outset = Math.max(6, Math.min(n(params.dist, 20) * 0.6, 15));
            return { x: -outset, y: cy, z: probeZ };
        }
        return { x: cx, y: cy, z: probeZ };
    }
}
