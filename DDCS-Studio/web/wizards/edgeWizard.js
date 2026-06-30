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
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { probeSurfaceStack } from './ops/probeSurface.js';   // the shared probe primitive (edge composes it — t125 inc1)

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
    const dist = num(params.dist, 15), retract = num(params.retract, 2), radius = num(params.radius, 2);
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
    const level = num(params.level, 0);
    const probeVar = plus ? '#8' : '#7', retractVar = plus ? '#9' : '#10', limitVal = plus ? '2' : '1';
    const compOp = plus ? '+' : '-';   // edge is at trigger ± stylus radius (toward the probe direction)

    const S = [];
    const C = (text) => { const b = newBlock('comment'); b.params = { text }; S.push(b); };
    const A = (v, value, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(value), note: note || '' }; S.push(b); };
    const DM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; S.push(b); };
    const IF = (lhs, op, rhs, goto) => { const b = newBlock('ifgoto'); b.params = { lhs, op, rhs, goto }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const END = () => { S.push(newBlock('endprogram')); };
    
    C('Motion Variables');
    A('#1', dist, 'Max probe distance'); A('#2', retract, 'Retract distance');
    A('#3', fFast, 'Fast feedrate'); A('#4', fSlow, 'Slow feedrate'); A('#5', port, 'Probe port');
    A('#6', radius, 'Probe stylus radius');
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
    // PROBE-SURFACE BLOCK (t125 inc1): compose the shared probe primitive instead of hand-rolling the G31 sequence.
    // It bundles the stylus-radius comp (#50=[#1925±#6]) as a DECLARED toggleable property + emits the @DDCS surface
    // marker. Functional G-code is BYTE-IDENTICAL to the old hand-rolled touch (the marker is an additive comment).
    S.push(...probeSurfaceStack({
        axis, dir: compOp, comment: `Probe ${axis} ${dir}`,
        stopVar: av.stop, limitVar: av.limit, limitVal,
        probeVar, retractVar, feedFast: '#3', feedSlow: '#4', port: '#5', level,
        twoPass: true, raw: av.result, result: '#50', radius: '#6', compEnable: true,
        compNote: 'Edge = trigger +/- stylus radius',
    }));
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

    /** Preview/sim start hint (stock frame): park clear of the wall being probed, perpendicular axis at centre —
     *  the single-wall version of the Middle/Corner inferStart, so the probe approaches the face from open space.
     *  dir pos probes +axis (hits the near/0 face from outside); dir neg probes −axis (hits the far face). */
    inferStart(params, stock) {
        const n = (v, d) => num(v, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const cx = sx / 2, cy = sy / 2, probeZ = -Math.min(5, sz * 0.5);
        const outset = Math.max(6, Math.min(n(params.dist, 15) * 0.6, 15));
        const pos = (params.dir || 'pos') !== 'neg';
        return ((params.axis || 'X') === 'X')
            ? { x: pos ? -outset : sx + outset, y: cy, z: probeZ }
            : { x: cx, y: pos ? -outset : sy + outset, z: probeZ };
    }

    /** Per-pass start hints (the panel seeds the draggable ① marker from these). Edge is ONE pass → one start, so the
     *  marker count stays in lockstep with the macro (a single probe-surface touch). TRAVEL-START inc1: the start IS the
     *  source — dragging the marker derives the reach (#1) GUI-side (see edgeView.tieEdgeDist). */
    inferStarts(params, stock) { return [this.inferStart(params, stock)]; }
}
