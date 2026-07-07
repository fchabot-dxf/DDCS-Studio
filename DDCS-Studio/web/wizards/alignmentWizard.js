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
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { srcVal, srcNote } from './probeBlocks.js';
import { opSimStarts } from '../viz/opSimStarts.js';
import { safeZParkBlock, safeZFrameOf } from './ops/safeZframe.js';   // SPATIAL-MODEL 1c: the shared safe-Z FRAME primitive

/** The ONE interpolated SCALAR header comment (tolerance/safeZ/feeds) — extracted so the data-op twin's postInstantiate
 *  RECOMPOSES it from resolved params (the checkAxis/probeDir comments are guard-handled; only this scalar line is a value-
 *  swap). F3: tolerance is display-only here (no #var) — it lives ONLY in this comment. Must reproduce the inline text. */
export function alignmentHeaderComments(params = {}) {
    const tolerance = num(params.tolerance, 0), safeZ = num(params.safeZ, 10);
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 20);
    return { top3: `Tolerance: ${tolerance}mm | SafeZ: ${safeZ}mm | Fast: ${fFast} | Slow: ${fSlow}` };
}

/** Alignment params → its block stack. The one source of truth for both displays, native across posts. `opts.superset`
 *  (E0) carries the checkAxis × probeDir arms GUARDED so pruneGuards collapses to a concrete shape (the twin seam). */
export function alignmentStack(params = {}, opts = {}) {
    const checkAxisSel = params.checkAxis === 'Y' ? 'Y' : 'X';   // axis the fence runs along (the concrete selection)
    const plusSel = (params.probeDir === 'neg' ? 'neg' : 'pos') === 'pos';
    const safeZ = num(params.safeZ, 10), dist = num(params.dist, 20), retract = num(params.retract, 2);
    const safeZFrame = safeZFrameOf(params.safeZFrame);   // SPATIAL-MODEL 1c: relative (default) | machine (G53 park)
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 20), port = num(params.port, 0);
    const src = params.sources || {};   // tolerance moved into alignmentHeaderComments (display-only, F3)
    const superset = !!opts.superset;   // E0 — carry checkAxis × probeDir arms guarded; prune collapses to the concrete shape
    const _hdr = alignmentHeaderComments(params);   // the scalar/tolerance header line — ONE format shared with the twin recompose

    const GUARD = (when, kids) => { const g = newBlock('guard'); g.params = { when }; g.children = kids; return g; };

    // The WHOLE probe body for a fence axis + probe direction. checkAxis/probeDir thread the axis LETTER (RM/PR/CK/RD/MV)
    // + the probe VARS (#7/#8, #9/#10) + the interpolated comments (incl. the entangled `Probe: ${probeAxis} ${dirLabel}`)
    // through ~16 atoms — too pervasive to recompose in the twin, so E0 GUARDS both (valid-by-construction: the superset
    // carries all 4 arms, prune keeps one → byte-identical to the concrete build; the twin then binds scalars + recomposes
    // only the axis/dir-INDEPENDENT value-swaps — safeZFrame + the scalar/tolerance header comment).
    const buildBody = (checkAxis, probeAxis, plus) => {
        const b = [];
        const dirLabel = plus ? 'pos' : 'neg';
        const probeVar = plus ? '#8' : '#7', retractVar = plus ? '#9' : '#10';   // retract OPPOSITE the probe direction
        const C = (t) => { const x = newBlock('comment'); x.params = { text: t }; b.push(x); };
        const A = (v, val, note) => { const x = newBlock('assign'); x.params = { var: v, value: String(val), note: note || '' }; b.push(x); };
        const IF = (l, o, r, g) => { const x = newBlock('ifgoto'); x.params = { lhs: l, op: o, rhs: r, goto: g }; b.push(x); };
        const GO = (n) => { const x = newBlock('goto'); x.params = { n }; b.push(x); };
        const LB = (n) => { const x = newBlock('label'); x.params = { n }; b.push(x); };
        const DM = (m) => { const x = newBlock('distmode'); x.params = { dist: m }; b.push(x); };
        const CF = (msg, cancel) => { const x = newBlock('confirm'); x.params = { msg, cancel }; b.push(x); };
        const RM = (axis, v) => { const x = newBlock('readmachine'); x.params = { axis, var: v }; b.push(x); };
        const PR = (axis, to, feed) => { const x = newBlock('probe'); x.params = { axis, to, feed, port: '#5', level: num(params.level, 0) }; b.push(x); };
        const CK = (axis, goto) => { const x = newBlock('probecheck'); x.params = { axis, goto }; b.push(x); };
        const RD = (axis, v) => { const x = newBlock('proberead'); x.params = { axis, var: v }; b.push(x); };
        const MV = (axis, v) => { const x = newBlock('move'); x.params = { mode: 'rapid', [axis.toLowerCase()]: v }; b.push(x); };
        const MSG = (text) => { const x = newBlock('message'); x.params = { text }; b.push(x); };
        const END = () => b.push(newBlock('endprogram'));

        // Two-pass probe of the fence (fast → check → retract → slow → check → read → retract), all granular atoms.
        const twoPass = (resultVar) => {
            PR(probeAxis, probeVar, '#3'); CK(probeAxis, 1); MV(probeAxis, retractVar);
            PR(probeAxis, probeVar, '#4'); CK(probeAxis, 1);
            RD(probeAxis, resultVar); MV(probeAxis, retractVar);
        };

        // ── Header ──
        C(`Alignment | Fence along: ${checkAxis} | Probe: ${probeAxis} ${dirLabel}`);
        C(`Misalignment = contact_B - contact_A over the span along ${checkAxis}`);
        C(_hdr.top3);

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
        // F2 — #20 references the #var (matches the #9=[0-#2] pattern) so the E1 safeZ binding on #19 lands. The emitted VALUE
        // is unchanged ([0-#19] resolves to [0-safeZ]); the emit is NOT byte-identical to the pre-restructure literal [0-safeZ].
        A('#19', safeZ, 'Safe Z lift distance - positive'); A('#20', '[0-#19]', 'Safe Z descend distance - negative');
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
        b.push(safeZParkBlock(safeZFrame, '#19')); DM('abs');   // SPATIAL-MODEL 1c: frame-aware final park (relative byte-identical | machine G53)

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
        return b;
    };

    // Concrete → the selected body; superset → all 4 arms guarded (checkAxis × probeDir), prune collapses to one.
    if (!superset) return buildBody(checkAxisSel, checkAxisSel === 'X' ? 'Y' : 'X', plusSel);
    return [
        GUARD({ param: 'checkAxis', is: 'X' }, [GUARD({ param: 'probeDir', is: 'pos' }, buildBody('X', 'Y', true)), GUARD({ param: 'probeDir', is: 'neg' }, buildBody('X', 'Y', false))]),
        GUARD({ param: 'checkAxis', is: 'Y' }, [GUARD({ param: 'probeDir', is: 'pos' }, buildBody('Y', 'X', true)), GUARD({ param: 'probeDir', is: 'neg' }, buildBody('Y', 'X', false))]),
    ];
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

    // Per-pass preview starts → the shared sim-start registry (viz/opSimStarts.js, BUILT_IN.alignment). Moved verbatim.
    inferStarts(params, stock) { return opSimStarts('alignment', params, stock); }
}
