/**
 * DDCS Studio - Alignment Wizard — measure angular misalignment of a fence/edge vs a machine axis.
 *
 * REWRITTEN AS A BLOCK STACK: `alignmentStack(params)` builds the macro from GRANULAR, dialect-aware atoms
 * (Comment / Set# / Confirm / Distance / Read Machine / Probe / Probe Check / Probe Read / Move / Message /
 * If Goto / Goto / Label / End Program). Because every controller-specific line goes through an atom, the SAME
 * stack emits natively for Expert M350 / V4.1 / DM500 (probe form, status check folding, DRO var, HMI prompt
 * all swap per active post). Form and Blocks view are two editors of this one stack.
 *
 * PURPOSE: probe the fence at point A, operator jogs along the fence to point B, probe again. Misalignment
 * angle = ATAN(delta / span), where delta = contactB − contactA (probe axis), span = machine coord B − A
 * (check axis). On controllers with no scripted HMI (V4.1/DM500) the Confirm gates fold away — the operator
 * just positions the tool between runs.
 *
 * DDCS M350: status #1920/#1921 (2=SUCCESS), trigger pos #1925/#1926, DRO #880/#881 (check-axis machine coord).
 */
import { newBlock, emitMapped } from '../blocks/blockModel.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { srcVal, srcNote } from './probeBlocks.js';

/** Alignment params → its block stack. The one source of truth for both displays, native across posts. */
export function alignmentStack(params = {}) {
    const checkAxis = params.checkAxis === 'Y' ? 'Y' : 'X';   // axis the fence runs along
    const probeAxis = checkAxis === 'X' ? 'Y' : 'X';          // perpendicular axis the probe moves in
    const dir = params.probeDir === 'neg' ? 'neg' : 'pos', plus = dir === 'pos';
    const dirLabel = plus ? 'pos' : 'neg';
    const safeZ = num(params.safeZ, 10), dist = num(params.dist, 20), retract = num(params.retract, 2);
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 20), port = num(params.port, 0);
    const tolerance = num(params.tolerance, 0);
    const src = params.sources || {};
    const probeVar = plus ? '#8' : '#7', retractVar = plus ? '#9' : '#10';   // retract OPPOSITE the probe direction

    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const IF = (l, o, r, g) => { const b = newBlock('ifgoto'); b.params = { lhs: l, op: o, rhs: r, goto: g }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const DM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; S.push(b); };
    const CF = (msg, cancel) => { const b = newBlock('confirm'); b.params = { msg, cancel }; S.push(b); };
    const RM = (axis, v) => { const b = newBlock('readmachine'); b.params = { axis, var: v }; S.push(b); };
    const PR = (axis, to, feed) => { const b = newBlock('probe'); b.params = { axis, to, feed, port: '#5', level: num(params.level, 0) }; S.push(b); };
    const CK = (axis, goto) => { const b = newBlock('probecheck'); b.params = { axis, goto }; S.push(b); };
    const RD = (axis, v) => { const b = newBlock('proberead'); b.params = { axis, var: v }; S.push(b); };
    const MV = (axis, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [axis.toLowerCase()]: v }; S.push(b); };
    const MSG = (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));

    // Two-pass probe of the fence (fast → check → retract → slow → check → read → retract), all granular atoms.
    const twoPass = (resultVar) => {
        PR(probeAxis, probeVar, '#3'); CK(probeAxis, 1); MV(probeAxis, retractVar);
        PR(probeAxis, probeVar, '#4'); CK(probeAxis, 1);
        RD(probeAxis, resultVar); MV(probeAxis, retractVar);
    };

    // ── Header ──
    C(`Alignment | Fence along: ${checkAxis} | Probe: ${probeAxis} ${dirLabel}`);
    C(`Misalignment = contact_B - contact_A over the span along ${checkAxis}`);
    C(`Tolerance: ${tolerance}mm | SafeZ: ${safeZ}mm | Fast: ${fFast} | Slow: ${fSlow}`);

    // ── Motion variables ──
    C('Motion Variables');
    A('#1', dist, 'Max probe distance');
    A('#2', srcVal(src.retract, retract), srcNote(src.retract, 'Retract distance'));
    A('#3', srcVal(src.fastFeed, fFast), srcNote(src.fastFeed, 'Fast feedrate'));
    A('#4', fSlow, 'Slow feedrate');
    A('#5', srcVal(src.port, port), srcNote(src.port, 'Probe port'));
    C('Pre-calculated motion values');
    A('#7', '[0-#1]', 'Negative max probe'); A('#8', '#1', 'Positive max probe');
    A('#9', '[0-#2]', 'Negative retract'); A('#10', '#2', 'Positive retract');
    A('#19', safeZ, 'Safe Z lift distance - positive'); A('#20', `[0-${safeZ}]`, 'Safe Z descend distance - negative');
    C('Result storage');
    A('#50', 0, 'Point A probe contact'); A('#51', 0, 'Point B probe contact');
    A('#52', 0, 'Delta: B - A wander'); A('#53', 0, 'Span absolute value'); A('#54', 0, 'Misalignment angle degrees');
    A('#70', 0, 'Point A checkAxis machine coord'); A('#71', 0, 'Point B checkAxis machine coord'); A('#72', 0, 'Span signed: B - A');

    // ── Point A ──
    C(`===== POINT A: First probe along ${checkAxis} fence =====`);
    C('Position probe at point A along the fence, at probing height');
    CF('Press Enter when in position at point A - ESC=cancel', 2);
    RM(checkAxis, '#70');                          // record check-axis machine coord (dialect DRO var)
    DM('inc');
    twoPass('#50');
    MV('Z', '#19');                               // lift to clear the workpiece for jogging
    DM('abs');

    // ── Point B ──
    C(`===== POINT B: Second probe along ${checkAxis} fence =====`);
    C(`REPOSITION: jog to point B along the ${checkAxis} fence - keep same Y/Z`);
    CF('Press Enter when in position at point B - ESC=cancel', 2);
    RM(checkAxis, '#71');
    A('#72', '[#71-#70]', `Span = B - A along ${checkAxis}`);
    DM('inc'); MV('Z', '#20');                    // descend back to probe height
    twoPass('#51');
    DM('abs');

    // ── Compute alignment ──
    C('===== COMPUTE ALIGNMENT =====');
    A('#52', '[#51-#50]', `Delta: fence wander in ${probeAxis} from A to B`);
    A('#53', 'ABS[#72]', `Absolute span along ${checkAxis}`);
    IF('#53', '==', '0', 1);                      // abort if A and B are at the same position (zero span)
    A('#54', 'ATAN[#52]/[#53]', 'Misalignment angle (deg) = atan2(delta, span) — two-operand atan[a]/[b] form');
    MV('Z', '#19'); DM('abs');

    // ── Results ──
    C('===== RESULTS =====');
    A('#1510', '#52', 'Delta: fence wander in probe axis');
    A('#1511', '#53', 'Span: absolute distance along check axis');
    A('#1512', '#54', 'Angle: misalignment in degrees');
    MSG('Drift=#1510mm Span=#1511mm Angle=#1512deg');   // #vars (DDCS substitutes them); printf %.3f isn't — hmiToast on Expert, comment on V4.1/DM500

    // ── Footer + error handler ──
    GO(2);
    LB(1); DM('abs'); A('#1505', '1', 'Probe failed or zero span - check position');
    LB(2); END();
    return S;
}

export class AlignmentWizard {
    constructor() {}

    generate(params) {
        recordOp('alignment', params);   // let the Blocks tab open this op as its stack
        return emitMapped(alignmentStack(params)).text;
    }

    /** Preview start (first probe, point A). */
    inferStart(params, stock) {
        return this.inferStarts(params, stock)[0];
    }

    /**
     * Per-pass preview starts: the alignment macro probes point A, repositions (jog to B along the fence), then
     * probes point B → 2 passes. Spread the two starts ALONG the fence (the checkAxis) so both markers are placed
     * at DISTINCT points (else both probes start at the same spot). Probe height = the stock top in the preview.
     */
    inferStarts(params, stock) {
        const n = (v, d) => num(v, d);
        const sx = n(stock && stock.x, 150), sy = n(stock && stock.y, 100), sz = n(stock && stock.z, 25);
        const checkAxis = (params && params.checkAxis) === 'Y' ? 'Y' : 'X';   // fence runs along this
        const z = Math.min(5, sz * 0.5);                                      // just above the top
        if (checkAxis === 'X') {
            // Fence along X → A and B differ in X (spread along X), near the +Y edge; probe moves in Y.
            return [{ x: sx * 0.3, y: sy * 0.85, z }, { x: sx * 0.7, y: sy * 0.85, z }];
        }
        // Fence along Y → A and B differ in Y; probe moves in X.
        return [{ x: sx * 0.85, y: sy * 0.3, z }, { x: sx * 0.85, y: sy * 0.7, z }];
    }
}
