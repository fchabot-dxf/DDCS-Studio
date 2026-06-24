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
    const circular = !!params.circular;   // round bore/boss: report the diameter (opposite-touch span) + re-centre between axes
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
    const MSG = (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));

    const twoPass = (ax, plus, resultVar) => {
        const av = AX[ax], pv = plus ? '#8' : '#7', rv = plus ? '#9' : '#10', lim = plus ? '2' : '1';
        A(av.stop, '0'); A(av.limit, lim);
        PR(ax, pv, '#3'); CK(ax, 1); MV(ax, rv);
        PR(ax, pv, '#4'); CK(ax, 1); A(resultVar, av.result); MV(ax, rv);
    };
    const reposition = (msg) => {
        // Lift clear, the operator jogs to the next wall, then drop back the SAME amount — all INCREMENTAL (no G53),
        // so the preview stays start-anchored and fans each pass out to its own marker. The "REPOSITION:" comment is
        // what the parser counts as a new pass (gcodeParser.js). (Was: #57 machine-Z save + G53 restore — that marked
        // the trace absolute and collapsed every pass onto the same marker, so only marker 1 ever appeared.)
        MV('Z', '#17');
        C(`REPOSITION: ${msg || 'jog the probe to the next wall'}`);
        A('#1505', '1', 'Press Enter when repositioned'); IF('#1505', '==', '0', 2);
        MV('Z', '[0-#17]'); DM('inc');
    };
    // Boss, AUTO: clear over the feature to the far side, hands-free. Uses the max probe distance #1 as the
    // over-estimate of the feature width (the operator already sets it >= the feature for the probes to reach),
    // so traversing #1+retract past the first face lands beyond the second; then drop back to probe height.
    const traverseOver = (ax, firstPlus) => { MV('Z', '#18'); MV(ax, firstPlus ? '[#1+#2]' : '[0-#1-#2]'); MV('Z', '[0-#18]'); };
    const between = (ax, firstPlus) => {
        // The two opposite walls. POCKET probes both from the centre (no move - manual is N/A, never reposition).
        // BOSS needs the 2nd face from the far side: MANUAL pauses for the operator to jog over; AUTO traverses
        // over hands-free.
        if (featureType !== 'boss') return;
        if (approach === 'manual') reposition('jog clear, around to the opposite wall'); else traverseOver(ax, firstPlus);
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
        // Between axes: only a BOSS needs the probe physically moved to the perpendicular walls (a pocket stays at
        // the centre — no reposition, matching the manual-pocket fix). Boss pauses for the operator either way.
        if (featureType === 'boss') reposition('jog clear, around to the perpendicular walls');
        // CIRCULAR + 2-axis: re-centre to the found PRIMARY-axis centre (#53, machine frame) before probing the
        // perpendicular axis, so the secondary touches cross the true diameter instead of an off-centre chord.
        if (circular) MM(axis, '#53');
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
    if (circular) {
        // Round feature: the opposite-touch span IS the diameter. #58 = primary-axis Ø; with 2-axis, #59 = the
        // perpendicular Ø and #60 the mean. ABS so the result is direction-agnostic (dir1 pos/neg ordering).
        A('#58', `ABS[#51-#52]`, 'Primary-axis diameter');
        if (twoAxis) {
            A('#59', `ABS[#54-#55]`, 'Secondary-axis diameter'); A('#60', '[#58+#59]/2', 'Mean diameter');
            A('#61', '[#58-#59]', 'Out-of-round (primary dia - secondary dia)');   // roundness metric (same as the Circular wizard)
        }
        MSG(twoAxis ? 'Centre #53/#56 - mean dia #60 - round #61' : 'Centre #53 - dia #58');
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

    /**
     * Per-pass preview starts — ONE per parser pass (each REPOSITION: in the macro starts a new pass, so the
     * counts here MUST mirror the reposition() calls in middleStack, else extra markers fall back to the origin).
     *   pocket            → 1 pass: probe both walls from the centre (no reposition).
     *   boss single-axis  → manual: 2 (wall1, wall2); auto: 1 (traverses over hands-free).
     *   boss two-axis     → manual: 4 (X w1/w2, Y w1/w2); auto: 2 (one per axis, with the between-axes reposition).
     */
    inferStarts(params, stock) {
        const n = (v, d) => num(v, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80), sz = n(stock && stock.z, 20);
        const cx = sx / 2, cy = sy / 2, probeZ = -Math.min(5, sz * 0.5);
        const centre = { x: cx, y: cy, z: probeZ };
        const boss = (params.featureType || 'pocket') === 'boss';
        const twoAxis = !!params.twoAxis || !!params.findBoth;
        const manual = params.approach === 'manual';
        const axis = (params.axis || 'X') === 'Y' ? 'Y' : 'X';
        const second = axis === 'X' ? 'Y' : 'X';
        const dir1Plus = (params.dir1 || 'pos') === 'pos';
        const dir2Plus = (typeof params.dir2 === 'string' ? params.dir2 : (dir1Plus ? 'neg' : 'pos')) === 'pos';
        const outset = Math.max(6, Math.min(n(params.dist, 20) * 0.6, 15));
        const outside = (ax, plus) => ax === 'X'
            ? { x: plus ? -outset : sx + outset, y: cy, z: probeZ }
            : { x: cx, y: plus ? -outset : sy + outset, z: probeZ };

        if (!boss) return [centre];                                  // pocket: always one pass, from the centre
        const prim = [outside(axis, dir1Plus), outside(axis, !dir1Plus)];
        if (!twoAxis) return manual ? prim : [prim[0]];
        const sec = [outside(second, dir2Plus), outside(second, !dir2Plus)];
        return manual ? [...prim, ...sec] : [prim[0], sec[0]];
    }

    /** Preview/sim start hint = the first pass's start. */
    inferStart(params, stock) {
        return this.inferStarts(params, stock)[0];
    }
}
