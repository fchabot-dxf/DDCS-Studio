/**
 * DDCS Studio - Edge Wizard
 * Probe one wall, set a WCS axis to that position. (For center between two edges, use the Middle Wizard.)
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `edgeStack(params)` — a snippet of
 * Comment / Set# / Probe / IfGoto / Move / Distance / Label / Goto / End Program atoms, emitted bare.
 * Form and Blocks view are two editors of the same stack. The probe macro form (G31 X#8 F#3 P#5 L0 Q1,
 * single-axis G0 X#9) comes straight from the #var-aware Probe/Move atoms.
 *
 * DDCS M350: status #1920/#1921 (2=SUCCESS, check !=2), trigger pos #1925/#1926.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';

const AX = {
    X: { status: '#1920', result: '#1925', stop: '#1905', limit: '#1915', off: 0 },
    Y: { status: '#1921', result: '#1926', stop: '#1906', limit: '#1916', off: 1 },
};
const WCS_BASE = { G54: 805, G55: 810, G56: 815, G57: 820, G58: 825, G59: 830 };

/** Edge params → its probe-macro block stack. The one source of truth for both displays. */
export function edgeStack(params = {}) {
    const axis = params.axis === 'Y' ? 'Y' : 'X', av = AX[axis];
    const dir = params.dir === 'neg' ? 'neg' : 'pos', plus = dir === 'pos';
    const wcs = params.wcs || 'active', wcsLabel = wcs === 'active' ? 'Active WCS' : wcs;
    const dist = num(params.dist, 15), retract = num(params.retract, 2);
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
    const level = num(params.level, 0);
    const probeVar = plus ? '#8' : '#7', retractVar = plus ? '#9' : '#10', limitVal = plus ? '2' : '1';

    const S = [];
    const C = (text) => { const b = newBlock('comment'); b.params = { text }; S.push(b); };
    const A = (v, value, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(value), note: note || '' }; S.push(b); };
    const DM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; S.push(b); };
    const PR = (to, feed) => { const b = newBlock('probe'); b.params = { axis, to, feed, port: '#5', level }; S.push(b); };
    const CK = (goto) => { const b = newBlock('probecheck'); b.params = { axis, goto }; S.push(b); };   // folds where there's no status var
    const IF = (lhs, op, rhs, goto) => { const b = newBlock('ifgoto'); b.params = { lhs, op, rhs, goto }; S.push(b); };
    const MV = (v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [axis.toLowerCase()]: v }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const END = () => { S.push(newBlock('endprogram')); };

    C(`Edge | ${axis} ${dir} | ${wcsLabel}`);
    C('DDCS M350 - Single edge probe');
    C('Motion Variables');
    A('#1', dist, 'Max probe distance'); A('#2', retract, 'Retract distance');
    A('#3', fFast, 'Fast feedrate'); A('#4', fSlow, 'Slow feedrate'); A('#5', port, 'Probe port');
    C('Result storage'); A('#50', 0, 'Edge contact position');
    C('Pre-calculated motion values');
    A('#7', '[0-#1]', 'Negative max probe'); A('#8', '#1', 'Positive max probe');
    A('#9', '[0-#2]', 'Negative retract'); A('#10', '#2', 'Positive retract');
    if (wcs === 'active') {
        C('Read Active WCS');
        A('#71', '#578', 'Active WCS index: 1=G54 2=G55 etc');
        A('#72', '[#71-1]', 'Zero-based index');
        A('#70', '[805+[#72*5]]', 'Base WCS address');
    } else {
        C(`Target: ${wcs}`); A('#70', WCS_BASE[wcs], 'Base WCS address');
    }
    C('Confirm Start');
    A('#1505', 1, `Press Enter to probe ${axis} ${dir} - ESC=cancel`);
    IF('#1505', '==', '0', 2);
    DM('inc');
    C(`Probe ${axis} ${dir}`);
    A(av.stop, '0', 'Stop mode: decelerate');
    A(av.limit, limitVal, `Limit protect: ${plus ? 'positive' : 'negative'}`);
    PR(probeVar, '#3'); CK(1); MV(retractVar);
    PR(probeVar, '#4'); CK(1);
    A('#50', av.result, 'Save edge position'); MV(retractVar);
    C('Write to WCS');
    A(`#[#70+${av.off}]`, '#50', `Set ${wcsLabel} ${axis} to edge`);
    DM('abs'); A('#1505', '-5000', 'Edge found'); GO(2);
    LB(1); DM('abs'); A('#1505', 1, 'Probe failed - no contact');
    LB(2); END();
    return S;
}

export class EdgeWizard {
    generate(params) {
        recordOp('edge', params);   // let the Blocks tab open this op as its stack
        return emitMapped(edgeStack(params)).text;   // a snippet: no Program Start/End blocks
    }
}
