/**
 * DDCS Studio - Middle Wizard — find the centre of a pocket (inside) or boss (outside).
 *
 * REWRITTEN AS A BLOCK STACK: `middleStack(params)` builds the probe macro from atoms (Comment / Set# /
 * Probe / If Goto / Move / Machine Move / Distance / Label / Goto / End Program) and `generate()` emits it.
 * A snippet (its own confirm + N1/N2 error handler + M30). Two-pass probe each wall, average to the centre;
 * 2-axis repeats on the perpendicular axis (in the chosen secondary direction) after a reposition.
 *
 * DDCS M350: status #1920/#1921 (2=SUCCESS), trigger pos #1925/#1926, stop #1905/#1906, limit #1915/#1916.
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';

const AX = {
    X: { stop: '#1905', limit: '#1915', status: '#1920', result: '#1925', off: 0 },
    Y: { stop: '#1906', limit: '#1916', status: '#1921', result: '#1926', off: 1 },
};
const WCS_BASE = { G54: 805, G55: 810, G56: 815, G57: 820, G58: 825, G59: 830 };
const sgn = (plus) => (plus ? 'pos' : 'neg');

/** Middle params → its probe-macro block stack. The one source of truth for both displays. */
export function middleStack(params = {}) {
    const featureType = params.featureType === 'boss' ? 'boss' : 'pocket';
    const approach = params.approach === 'manual' ? 'manual' : 'auto';   // hands-free cycle vs operator-jogged repositions
    const axis = params.axis === 'Y' ? 'Y' : 'X';
    const dir1Plus = (params.dir1 || 'pos') === 'pos';
    const twoAxis = !!params.twoAxis || !!params.findBoth;
    const second = axis === 'X' ? 'Y' : 'X';
    const resolvedDir2 = (typeof params.dir2 === 'string') ? params.dir2 : (dir1Plus ? 'neg' : 'pos');
    const dir2Plus = resolvedDir2 === 'pos';
    const wcs = params.wcs || 'active', wcsLabel = wcs === 'active' ? 'Active WCS' : wcs;
    const dist = num(params.dist, 20), retract = num(params.retract, 2), safeZ = num(params.safeZ, 10);
    const clearOver = num(params.clearOver, 15);   // boss AUTO: how high to lift before crossing over the part
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);

    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const IF = (l, o, r, g) => { const b = newBlock('ifgoto'); b.params = { lhs: l, op: o, rhs: r, goto: g }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const MM = (ax, ref) => { const b = newBlock('machinemove'); b.params = { axis: ax, to: ref }; S.push(b); };
    const MV = (ax, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [ax.toLowerCase()]: v }; S.push(b); };
    const DM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; S.push(b); };
    const PR = (ax, to, feed) => { const b = newBlock('probe'); b.params = { axis: ax, to, feed, port: '#5', level: 0 }; S.push(b); };
    const CK = (ax, g) => { const b = newBlock('probecheck'); b.params = { axis: ax, goto: g }; S.push(b); };   // folds where there's no status var
    const END = () => S.push(newBlock('endprogram'));

    const twoPass = (ax, plus, resultVar) => {
        const av = AX[ax], pv = plus ? '#8' : '#7', rv = plus ? '#9' : '#10', lim = plus ? '2' : '1';
        A(av.stop, '0'); A(av.limit, lim);
        PR(ax, pv, '#3'); CK(ax, 1); MV(ax, rv);
        PR(ax, pv, '#4'); CK(ax, 1); A(resultVar, av.result); MV(ax, rv);
    };
    const reposition = () => { A('#57', '#882'); MV('Z', '#17'); A('#1505', '1', 'Press Enter when repositioned'); IF('#1505', '==', '0', 2); MM('Z', '#57'); };
    // Boss, AUTO: clear over the feature to the far side, hands-free. Uses the max probe distance #1 as the
    // over-estimate of the feature width (the operator already sets it >= the feature for the probes to reach),
    // so traversing #1+retract past the first face lands beyond the second; then drop back to probe height.
    const traverseOver = (ax, firstPlus) => { MV('Z', '#18'); MV(ax, firstPlus ? '[#1+#2]' : '[0-#1-#2]'); MV('Z', '[0-#18]'); };
    const between = (ax, firstPlus) => {
        // The two opposite walls. POCKET probes both from the centre (no move). BOSS needs the 2nd face from the
        // far side: MANUAL pauses for the operator to jog over; AUTO traverses over hands-free.
        if (featureType !== 'boss') { if (approach === 'manual') reposition(); return; }
        if (approach === 'manual') reposition(); else traverseOver(ax, firstPlus);
    };
    const seq = (ax, firstPlus, base) => {
        twoPass(ax, firstPlus, `#${base}`);
        between(ax, firstPlus);
        twoPass(ax, !firstPlus, `#${base + 1}`);
        A(`#${base + 2}`, `[#${base}+#${base + 1}]/2`);     // centre = midpoint of the two walls
    };

    A('#1', dist, 'Max probe distance'); A('#2', retract, 'Retract distance');
    A('#3', fFast, 'Fast feedrate'); A('#4', fSlow, 'Slow feedrate'); A('#5', port, 'Probe port');
    A('#51', 0, 'Wall 1 pos'); A('#52', 0, 'Wall 2 pos'); A('#53', 0, 'Center pos');
    A('#54', 0, 'Wall 3 pos'); A('#55', 0, 'Wall 4 pos'); A('#56', 0, 'Center pos 2');
    A('#7', '[0-#1]', 'Negative max probe'); A('#8', '#1', 'Positive max probe');
    A('#9', '[0-#2]', 'Negative retract'); A('#10', '#2', 'Positive retract'); A('#17', safeZ, 'Safe Z retract');
    A('#18', clearOver, 'Traverse-over clearance (boss auto: lift this high to clear the part before crossing)');
    if (wcs === 'active') { A('#71', '#578', 'Active WCS index: 1=G54 2=G55 etc'); A('#72', '[#71-1]', 'Zero-based index'); A('#70', '[805+[#72*5]]', 'Base WCS address'); }
    else A('#70', WCS_BASE[wcs]);
    A('#1505', '1', 'Press Enter to probe - ESC=cancel'); IF('#1505', '==', '0', 2); DM('inc');

    seq(axis, dir1Plus, 51);
    if (twoAxis) {
        reposition();
        C(`2axis_${axis === 'X' ? 'XtoY' : 'YtoX'}_${resolvedDir2}`);
        seq(second, dir2Plus, 54);
        MV('Z', '#17');
        // #53 = centre of the PRIMARY axis, #56 = centre of the SECONDARY — write each to ITS axis's WCS offset
        // (not hardcoded X=0/Y=1, which swapped them when the primary axis was Y).
        A(`#[#70+${AX[axis].off}]`, '#53'); A(`#[#70+${AX[second].off}]`, '#56');
    } else {
        MV('Z', '#17');
        A(`#[#70+${AX[axis].off}]`, '#53');
    }
    if (params.syncA && (axis === 'Y' || twoAxis)) { const s = params.slave || '3'; A('#74', `[#70+${s}]`); A('#[#74]', '#883'); }

    DM('abs'); A('#1505', '-5000'); GO(2);
    LB(1); DM('inc'); MV('Z', '#17'); DM('abs'); A('#1505', '1'); LB(2); END();
    return S;
}

export class MiddleWizard {
    generate(params) {
        recordOp('middle', params);   // let the Blocks tab open this op as its stack
        return emitMapped(middleStack(params)).text;
    }

    /** Preview/sim start hint (stock frame): pocket → centre inside the cavity; boss → just outside the first wall. */
    inferStart(params, stock) {
        const n = (v, d) => num(v, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const cx = sx / 2, cy = sy / 2, probeZ = -Math.min(5, sz * 0.5);
        if ((params.featureType || 'pocket') !== 'boss') return { x: cx, y: cy, z: probeZ };
        const outset = Math.max(6, Math.min(n(params.dist, 20) * 0.6, 15));
        const pos = (params.dir1 || 'pos') === 'pos';
        return ((params.axis || 'X') === 'X')
            ? { x: pos ? -outset : sx + outset, y: cy, z: probeZ }
            : { x: cx, y: pos ? -outset : sy + outset, z: probeZ };
    }
}
