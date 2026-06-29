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
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { travelOwn, travelOpp } from './probeBlocks.js';
import { opSimStarts } from '../viz/opSimStarts.js';

const AX = {
    X: { stop: '#1905', limit: '#1915', status: '#1920', result: '#1925', off: 0 },
    Y: { stop: '#1906', limit: '#1916', status: '#1921', result: '#1926', off: 1 },
};
const WCS_BASE = { G54: 805, G55: 810, G56: 815, G57: 820, G58: 825, G59: 830 };
const sgn = (plus) => (plus ? 'pos' : 'neg');

/** Middle params → its probe-macro block stack. The one source of truth for both displays. */
export function middleStack(params = {}) {
    const featureType = params.featureType === 'boss' ? 'boss' : 'pocket';
    const approach = params.approach === 'manual' ? 'manual' : 'auto';   // LEGACY single toggle — the per-traverse default (back-compat)
    const oneMode = (v) => (v === 'manual' || v === 'auto') ? v : approach;
    const inAxis = oneMode(params.inAxis);        // INC3: wall1→wall2 WITHIN an axis — auto cross-over (#19/#20) vs manual jog
    const transAxis = oneMode(params.transAxis);   // INC3: X→Y BETWEEN axes — auto diagonal traverse (#21) vs manual jog
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
    // Boss-AUTO probe-both: the in-axis wall1→wall2 cross-over — the straight TRAVERSE that spans the feature, SEPARATE
    // per axis (non-square boss). DECOUPLED from MAX PROBE: max-probe (#1) is the probe REACH (how far G31 searches);
    // the cross-over is the TRAVERSE DISTANCE (how far to move across) — different things. It can't be computed before
    // the probe (wall 2 is unknown), so it's USER-SET: a clean declared number ≈ feature width + 2×approach. Default 80
    // (a moderate feature ~50 + 2×15 approach); the user tunes it to span THEIR feature. (Was [#1+#2] — that conflated
    // reach with traverse and overshot when max-probe >> the feature.) String type → a raw expression still round-trips.
    const crossX = (params.crossX === '' || params.crossX == null) ? '80' : String(params.crossX);
    const crossY = (params.crossY === '' || params.crossY == null) ? '80' : String(params.crossY);
    // INC3: the TRANS-axis (X→Y) auto-traverse distance — a raw diagonal probe-move to the perpendicular walls. Default
    // 50 (a SANE fixed value, like the corner's travelDist) — NOT [#19+#20]/2 (≈ max-probe), which scaled with the probe
    // distance and overshot FAR off-stock when max-probe >> the feature. EDITABLE (the human tunes it so the 2nd-axis
    // probe reaches ②); the direction is verified-correct for all dir1/dir2 — only this magnitude was wrong. #21.
    const diagTravel = (params.diagTravel === '' || params.diagTravel == null) ? '50' : String(params.diagTravel);
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);

    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const IF = (l, o, r, g) => { const b = newBlock('ifgoto'); b.params = { lhs: l, op: o, rhs: r, goto: g }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const MM = (ax, ref) => { const b = newBlock('machinemove'); b.params = { axis: ax, to: ref }; S.push(b); };
    const MV = (ax, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [ax.toLowerCase()]: v }; S.push(b); };
    const MOVE = (props) => { const b = newBlock('move'); b.params = { mode: 'rapid', ...props }; S.push(b); };   // 2-axis rapid (trans-axis diagonal)
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
    const traverseOver = (ax, firstPlus) => { const cv = ax === 'X' ? '#19' : '#20'; MV('Z', '#18'); MV(ax, firstPlus ? cv : `[0-${cv}]`); MV('Z', '[0-#18]'); };
    // INC3: BOSS trans-axis AUTO traverse — hands-free move from the primary-axis walls across to the perpendicular
    // (secondary-axis) walls: lift, a 2-axis diagonal step of #21 (Diag travel) toward the secondary first wall, drop.
    // Emits "REPOSITION:" so the parser counts a NEW pass (the 2nd start ②). Signs follow dir1/dir2; the human tunes #21.
    const transTraverse = () => {
        // The lateral travel is the CONNECTING move (lift → diagonal → drop) and MUST come BEFORE the REPOSITION
        // comment so it belongs to the PRIOR (primary-axis) pass — the trace anchors the NEXT pass to ②, so a move
        // emitted AFTER the REPOSITION would draw FROM ② and push the 2nd probe away. Then REPOSITION marks the Y pass.
        // PRIMARY axis: the AUTO in-axis cross-over (#19/#20) flings the tool FAR past centre (in +dir1), so a fixed travel
        // can't come back — it's WHY the old `travelOwn` X leg went the WRONG WAY (further out) for X-first. Re-centre to the
        // MEASURED centre #53 instead: the tool sits at wall-2 (#52) + the last retract (seq runs twoPass(!dir1Plus) last →
        // its rv = #10 / #9), so the incremental step to centre = #53 − #52 − rv. This heads to ②'s primary coord regardless
        // of axis ORDER (X-first or Y-first — #51-53 are always the PRIMARY axis's). MANUAL in-axis has no cross-over fling
        // and a different per-pass frame, so keep its directional travel there. SECONDARY axis: travel OUT to ② by the
        // Diag-travel #21 (the one distance the macro can't measure before it probes that axis — the user tunes it).
        const lastRetract = dir1Plus ? '#10' : '#9';          // seq runs twoPass(!dir1Plus) last → its retract is #10 (+) / #9 (−)
        const pmove = inAxis === 'auto' ? `[#53-#52-${lastRetract}]` : travelOwn(dir1Plus, '#21', '[0-#21]');
        const smove = travelOpp(dir2Plus, '#21', '[0-#21]');  // secondary axis: out toward ② (opposite its first probe dir)
        MV('Z', '#18');                                  // lift clear of the boss
        MOVE({ [axis.toLowerCase()]: pmove, [second.toLowerCase()]: smove });   // re-centre the primary + travel out to ②
        MV('Z', '[0-#18]');                              // back to probe height
        C('REPOSITION: auto-traverse to the perpendicular walls');   // mark the Y pass (anchored to ②); no operator wait
        DM('inc');
    };
    const between = (ax, firstPlus) => {
        // The two opposite walls. POCKET probes both from the centre (no move - manual is N/A, never reposition).
        // BOSS needs the 2nd face from the far side: the IN-AXIS toggle — MANUAL pauses for the operator to jog over,
        // AUTO traverses over hands-free (#19/#20 cross-over).
        if (featureType !== 'boss') return;
        if (inAxis === 'manual') reposition('jog clear, around to the opposite wall'); else traverseOver(ax, firstPlus);
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
    // #19/#20 = the IN-axis cross-over (traverseOver — used ONLY when the in-axis is auto); #21 = the TRANS-axis Diag travel
    // (transTraverse). Each assigned only when its own auto-traverse is active, so pocket/manual macros stay unchanged.
    // (#21 no longer references #19/#20 — it's a fixed default — and the trans-axis re-centres to #53, so the cross-over no
    // longer needs to be assigned for the trans-axis's sake.)
    if (featureType === 'boss' && inAxis === 'auto') {
        A('#19', crossX, 'X cross-over: in-axis traverse, wall 1 across to wall 2 (user-set to span the feature, default 80)');
        A('#20', crossY, 'Y cross-over: in-axis traverse, wall 1 across to wall 2 (user-set to span the feature, default 80)');
    }
    if (featureType === 'boss' && transAxis === 'auto' && twoAxis) {
        A('#21', diagTravel, 'Diag travel: X→Y trans-axis auto-traverse distance (default 50; tune so the 2nd-axis probe reaches ②)');
    }
    if (wcs === 'active') { A('#71', '#578', 'Active WCS index: 1=G54 2=G55 etc'); A('#72', '[#71-1]', 'Zero-based index'); A('#70', '[805+[#72*5]]', 'Base WCS address'); }
    else A('#70', WCS_BASE[wcs]);
    A('#1505', '1', 'Press Enter to probe - ESC=cancel'); IF('#1505', '==', '0', 2); DM('inc');

    seq(axis, dir1Plus, 51);
    if (twoAxis) {
        // Between axes: a BOSS moves the probe to the perpendicular walls (a pocket stays at the centre — no reposition).
        // The TRANS-axis toggle: MANUAL pauses for the operator to jog (INC4 simulates it); AUTO traverses there
        // hands-free via the Diag-travel (#21). Either way it's a REPOSITION pass → the 2nd start ② appears.
        if (featureType === 'boss') { if (transAxis === 'manual') reposition('jog clear, around to the perpendicular walls'); else transTraverse(); }
        // CIRCULAR + 2-axis: re-centre to the found PRIMARY-axis centre (#53, machine frame) before probing the
        // perpendicular axis, so the secondary touches cross the true diameter instead of an off-centre chord.
        if (circular) MM(axis, '#53');
        C(`2axis_${axis === 'X' ? 'XtoY' : 'YtoX'}_${resolvedDir2}`);
        seq(second, dir2Plus, 54);
        MV('Z', '#17');
        // #53 = centre of the PRIMARY axis, #56 = centre of the SECONDARY — write each to ITS axis's WCS offset
        // (not hardcoded X=0/Y=1, which swapped them when the primary axis was Y).
        A(`#[#70+${AX[axis].off}]`, '#53'); A(`#[#70+${AX[second].off}]`, '#56');
        // CLEAN END RETRACT: park back OVER the feature centre. The probes leave the tool OFFSET at the last wall (the net
        // incremental XY drift), so without this it ends Z-lifted but beside the feature — and the 3D spindle (which follows
        // the engine) rests there too. Return to the MEASURED centre (#53/#56, machine frame — WCS-independent, the same
        // re-centre the circular path uses); Z is already at safe (#17) above, so crossing back is clear.
        MM(axis, '#53'); MM(second, '#56');
    } else {
        MV('Z', '#17');
        A(`#[#70+${AX[axis].off}]`, '#53');
        MM(axis, '#53');   // single-axis: same end-offset fix — centre the PROBED axis back over the feature (Z already safe)
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
    // Per-pass preview starts → the shared sim-start registry (viz/opSimStarts.js, BUILT_IN.middle). Moved verbatim; one
    // home for the per-pass inference + the wizard-maker seam (declare, never infer).
    inferStarts(params, stock) { return opSimStarts('middle', params, stock); }

    /** Preview/sim start hint = the first pass's start. */
    inferStart(params, stock) {
        return this.inferStarts(params, stock)[0];
    }
}
