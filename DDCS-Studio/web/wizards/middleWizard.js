/**
 * DDCS Studio - Middle Wizard — find the centre of a pocket (inside) or boss (outside).
 *
 * REWRITTEN AS A BLOCK STACK: `middleStack(params)` builds the probe macro from atoms (Comment / Set# /
 * Probe / If Goto / Move / Machine Move / Distance / Label / Goto / End Program) and `generate()` emits it.
 * A snippet (its own confirm + N1/N2 error handler + M30). Two-pass probe each wall, average to the centre;
 * 2-axis repeats on the perpendicular axis (in the chosen secondary direction) after a reposition.
 *
 * ── SUPERSET (E0, t371) ──────────────────────────────────────────────────────────────────────────────────
 * `middleStack(params, { superset:true })` seeds the data-TWIN as an ALL-ARMS-PRESENT template: every
 * STRUCTURAL fork (featureType / inAxis / transAxis / twoAxis / circular / probeZ / wcs / syncA) emits BOTH
 * arms, each wrapped in a `guard` block, so instantiate()/pruneGuards collapses it to either concrete shape.
 * Superset OFF (the built-in wizard + every existing caller/test) is BYTE-IDENTICAL to today. The same
 * cornerStack pattern (② B4 M2): a structural toggle becomes a re-authorable prune-selected branch of pure
 * DATA, not JS-locked structure. NOTE: axis / dir1 / dir2 and the numeric scalars are VALUE/order swaps, not
 * structural forks — they stay baked here and become bindings in E1 (the data-op + the feature-read slice).
 *
 * DDCS M350: status #1920/#1921 (2=SUCCESS), trigger pos #1925/#1926, stop #1905/#1906, limit #1915/#1916.
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { probeSurfaceStack, safeTraverseStack } from './ops/probeSurface.js';   // the shared probe + travel primitives (middle composes them — t131 inc1, ① auto/manual travel)
import { safeZParkBlock, safeZFrameOf, safeRetractNode } from './ops/safeZframe.js';   // SPATIAL-MODEL 1c: the shared safe-Z FRAME primitive (+ t822 machine-frame safe-height retract)
import { opSimStarts } from '../viz/opSimStarts.js';

const AX = {
    X: { stop: '#1905', limit: '#1915', status: '#1920', result: '#1925', off: 0 },
    Y: { stop: '#1906', limit: '#1916', status: '#1921', result: '#1926', off: 1 },
    Z: { stop: '#1907', limit: '#1917', status: '#1922', result: '#1927', off: 2 },   // Z-surface (probe-Z-first) — reuses twoPass
};
const WCS_VALUES = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'];
const sgn = (plus) => (plus ? 'pos' : 'neg');

/** Middle params → its probe-macro block stack. The one source of truth for both displays.
 *  `opts.superset` (E0) seeds the TWIN with every structural arm present (each guarded) so pruneGuards can
 *  collapse it to any concrete shape. OFF is byte-identical to today (the built-in + all existing callers). */
export function middleStack(params = {}, opts = {}) {
    const featureType = params.featureType === 'boss' ? 'boss' : 'pocket';
    const approach = params.approach === 'manual' ? 'manual' : 'auto';   // LEGACY single toggle — the per-traverse default (back-compat)
    const oneMode = (v) => (v === 'manual' || v === 'auto') ? v : approach;
    const inAxis = oneMode(params.inAxis);        // INC3: wall1→wall2 WITHIN an axis — auto cross-over (#19/#20) vs manual jog
    const transAxis = oneMode(params.transAxis);   // INC3: X→Y BETWEEN axes — auto traverse (#21) vs manual jog
    const travelShape = params.travelShape === 'diagonal' ? 'diagonal' : 'dogleg';   // t383 (human) — the TRANS-axis AUTO route: dogleg (DEFAULT, routes AROUND the boss like corner) vs a single straight diagonal
    const axis = params.axis === 'Y' ? 'Y' : 'X';
    const dir1Plus = (params.dir1 || 'pos') === 'pos';
    const twoAxis = !!params.twoAxis || !!params.findBoth;
    const circular = !!params.circular;   // round bore/boss: report the diameter (opposite-touch span) + re-centre between axes
    const probeZ = !!params.probeZ;   // probe-Z-first: two-pass the TOP surface + set Z0 BEFORE the XY centre-finding (its own declared sim pass)
    const second = axis === 'X' ? 'Y' : 'X';
    const resolvedDir2 = (typeof params.dir2 === 'string') ? params.dir2 : (dir1Plus ? 'neg' : 'pos');
    const dir2Plus = resolvedDir2 === 'pos';
    const wcs = params.wcs || 'active', wcsLabel = wcs === 'active' ? 'Active WCS' : wcs;
    const dist = num(params.dist, 200), retract = num(params.retract, 2), safeZ = num(params.safeZ, 10);   // MAX PROBE default 200 (t381 — 20 was too small to reach the wall → the probe fired short + retracted → "retract-only")
    const safeZFrame = safeZFrameOf(params.safeZFrame);   // SPATIAL-MODEL 1c: relative (default) | machine (G53 final park)
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
    // B-TRANS fix (b): the diagonal's PRIMARY target — a #21-PEER for the primary axis. Default '#53' = re-centre to the
    // MEASURED centre (value-identical at rest); when the ② marker is placed it becomes ②'s primary coord (drag-derived,
    // like #21 derives the secondary) so the diagonal runs END-OF-X-PROBE → ②'s FULL position. Avoids the (separate-bug)
    // degenerate sim #53 on drag because #52 cancels: pmove = [#22-#52-rv±#6], tool at #52+rv+#6 → lands at #22.
    const diagPrimary = (params.diagPrimary === '' || params.diagPrimary == null) ? '#53' : String(params.diagPrimary);
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
    const radius = num(params.radius, 2);   // stylus tip radius (#6) — for the DIAMETER (∓2r) + Z-surface (−r) comp; the CENTRE (bisect) needs none

    const superset = !!opts.superset;

    const S = [];
    // Returning block factories (return ONE block) — every arm composes these, then a fork helper decides guard-vs-concrete.
    const mkC = (t) => { const b = newBlock('comment'); b.params = { text: t }; return b; };
    const mkA = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; return b; };
    const mkGO = (n) => { const b = newBlock('goto'); b.params = { n }; return b; };
    const mkLB = (n) => { const b = newBlock('label'); b.params = { n }; return b; };
    const mkMM = (ax, ref, restore) => { const b = newBlock('machinemove'); b.params = { axis: ax, to: ref }; if (restore) b.params.restore = restore; return b; };
    const mkMV = (ax, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [ax.toLowerCase()]: v }; return b; };
    const mkMSG = (text) => { const b = newBlock('message'); b.params = { text }; return b; };
    const mkDM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; return b; };
    const mkEND = () => newBlock('endprogram');
    // F1/E3 — the proven profile-aware seams (inherited from corner/edge). Expert byte-identical; V4.1/DM500 fold. Middle's
    // WCS base is the BARE variant (no annotation comments); its WCS writes are DIRECT `#[#70+off]`; the sync is the indirect #883.
    const mkWcsBase = (w) => { const b = newBlock('wcsbaseinto'); b.params = { wcs: w, base: '#70', bare: true }; return b; };
    const mkWcsWrite = (spec) => { const b = newBlock('wcswrite'); b.params = { ...spec }; return b; };
    const wcsArgOf = (w) => (w === 'active' ? '#578' : String(parseInt(String(w).replace('G', ''), 10) - 53));
    const mkHMI = (value, note) => { const b = newBlock('hmiline'); b.params = { value: String(value), note: note || '' }; return b; };
    const mkConfirm = (value, note, cancel) => { const b = newBlock('hmiconfirm'); b.params = { value: String(value), note: note || '', cancel }; return b; };

    // ── SUPERSET fork helpers (E0) — each RETURNS the arm block(s): superset → guarded arms; concrete → the selected arm.
    // The GUARD wraps one fork arm gated by { param, is }; pruneGuards drops the false arms + unwraps the true one at build.
    const GUARD = (when, kids) => { const b = newBlock('guard'); b.params = { when }; b.children = kids; return b; };
    const featBossOnly = (kids) => superset ? [GUARD({ param: 'featureType', is: 'boss' }, kids)] : (featureType === 'boss' ? kids : []);
    const inAxisFork = (autoKids, manualKids) => superset ? [GUARD({ param: 'inAxis', is: 'auto' }, autoKids), GUARD({ param: 'inAxis', is: 'manual' }, manualKids)] : (inAxis === 'manual' ? manualKids : autoKids);
    const inAxisAutoOnly = (kids) => superset ? [GUARD({ param: 'inAxis', is: 'auto' }, kids)] : (inAxis === 'auto' ? kids : []);
    const transAxisFork = (autoKids, manualKids) => superset ? [GUARD({ param: 'transAxis', is: 'auto' }, autoKids), GUARD({ param: 'transAxis', is: 'manual' }, manualKids)] : (transAxis === 'manual' ? manualKids : autoKids);
    const transAxisAutoOnly = (kids) => superset ? [GUARD({ param: 'transAxis', is: 'auto' }, kids)] : (transAxis === 'auto' ? kids : []);
    // travelShape (dogleg|diagonal) is an ENUM fork NESTED inside the trans-axis AUTO arm (the trans-axis DIAGONAL route only).
    const tsPair = (doglegKids, diagKids) => superset ? [GUARD({ param: 'travelShape', is: 'dogleg' }, doglegKids), GUARD({ param: 'travelShape', is: 'diagonal' }, diagKids)] : (travelShape === 'diagonal' ? diagKids : doglegKids);
    const twoAxisFork = (onKids, offKids) => superset ? [GUARD({ param: 'twoAxis', is: true }, onKids), GUARD({ param: 'twoAxis', is: false }, offKids)] : (twoAxis ? onKids : offKids);
    const twoAxisOnly = (kids) => superset ? [GUARD({ param: 'twoAxis', is: true }, kids)] : (twoAxis ? kids : []);
    const circularOnly = (kids) => superset ? [GUARD({ param: 'circular', is: true }, kids)] : (circular ? kids : []);
    const probeZFork = (onKids, offKids) => superset ? [GUARD({ param: 'probeZ', is: true }, onKids), GUARD({ param: 'probeZ', is: false }, offKids)] : (probeZ ? onKids : offKids);
    const probeZOnly = (kids) => superset ? [GUARD({ param: 'probeZ', is: true }, kids)] : (probeZ ? kids : []);
    const wcsLabelOf = (w) => (w === 'active' ? 'Active WCS' : w);
    // wcs is a 7-way enum fork: the base-address block ('active' reads #578 → computes #70; a fixed G54..G59 uses the literal
    // base) PLUS the derived wcsLabel (bleeds into the probeZ Z-save note). Returns fn(w,label) per value.
    const wcsFork = (fn) => superset ? WCS_VALUES.map((w) => GUARD({ param: 'wcs', is: w }, fn(w, wcsLabelOf(w)))) : fn(wcs, wcsLabel);

    // One two-pass wall touch via the shared PROBE-SURFACE BLOCK (t131), comp ON → the TRUE wall (the read becomes
    // `#result=[#trigger±#6]`). The centre bisect cancels the ∓#6 (same centre); the diameter ABS[s1-s2] is true (the old
    // ∓2#6 EVAPORATES); the Z-first comp relocates here from its inline −#6. All VALUE-IDENTICAL. RETURNS one touch.
    const touchR = (ax, plus, resultVar) => {
        const av = AX[ax];
        return probeSurfaceStack({
            axis: ax, dir: plus ? '+' : '-', probeVar: plus ? '#8' : '#7', retractVar: plus ? '#9' : '#10',
            stopVar: av.stop, limitVar: av.limit, limitVal: plus ? '2' : '1',
            feedFast: '#3', feedSlow: '#4', port: '#5', level: 0, twoPass: true,
            raw: av.result, rawAxis: ax, result: resultVar, radius: '#6', compEnable: true,   // rawAxis → trigger folds per post
        });
    };
    // t824/t826 — the retreat-to-clear before the operator jogs was an incremental G0 Z#17 lift (compounds into the top
    // switch from a high start). It now retracts to the DECLARED MACHINE MARGIN (machineLift → safeRetractNode → G53,
    // limit-proof); the sim preview MODELS this mid-program G53 (t826), so each pass stays anchored to its own start marker
    // (the "REPOSITION:" comment still delimits the pass). The jog + the −#17 drop-back (now from the margin) are unchanged.
    const repositionR = (msg) => safeTraverseStack({
        approach: 'manual', lift: '#17', machineLift: true, drop: '[0-#17]',
        comment: `REPOSITION: ${msg || 'jog the probe to the next wall'}`,
    });
    // Boss, AUTO in-axis: clear over the feature to the far side, hands-free (the #19/#20 cross-over spans the feature). RETURNS.
    const traverseOverR = (ax, firstPlus) => { const cv = ax === 'X' ? '#19' : '#20'; return [mkMV('Z', '#18'), mkMV(ax, firstPlus ? cv : `[0-${cv}]`), mkMV('Z', '[0-#18]')]; };
    // Boss, AUTO trans-axis: the X→Y CONNECTING move (lift → re-centre-primary + travel-out-secondary → drop → REPOSITION mark).
    // Routed through the shared safeTraverseStack `mode:'center'` (the pre-declared byte-identical dedup) — middle no longer
    // hand-rolls the diagonal: it assigns #22 (=diagPrimary; #53 re-centre at rest, ②'s primary coord when placed), moves the
    // primary to #22 (the #52/retract/±#6 cancel so it lands exactly on #22) + the secondary out by the Diag-travel #21, then
    // marks the REPOSITION so the trace anchors the NEXT pass to ②. RETURNS. (Value-identical to the old inline; the #22 note
    // now names the real primary axis rather than a hardcoded "X".)
    const transTraverseR = (shape) => safeTraverseStack({
        mode: 'center', axis, second,
        dir1Plus, dir2Plus, diagPrimary, diagTravel: '#21', wall2Var: '#52', radiusVar: '#6',
        lift: '#18', drop: '[0-#18]',
        comment: 'REPOSITION: auto-traverse to the perpendicular walls',
        dogleg: shape === 'dogleg',   // t383 — DOGLEG (default): secondary out first, then re-centre primary; diagonal: one straight move
    });
    // The two opposite walls' BETWEEN move. POCKET probes both from the centre (nothing). BOSS needs the 2nd face from the
    // far side: the IN-AXIS toggle — MANUAL pauses for the operator to jog over, AUTO traverses over hands-free. RETURNS.
    const betweenR = (ax, firstPlus) => featBossOnly(inAxisFork(traverseOverR(ax, firstPlus), repositionR('jog clear, around to the opposite wall')));
    // One axis's two-wall sequence: touch → between → touch → centre-bisect (∓#6 cancels). RETURNS.
    const seqR = (ax, firstPlus, base) => [
        ...touchR(ax, firstPlus, `#${base}`),
        ...betweenR(ax, firstPlus),
        ...touchR(ax, !firstPlus, `#${base + 1}`),
        mkA(`#${base + 2}`, `[#${base}+#${base + 1}]/2`),   // centre = midpoint of the two (now radius-comped) walls — ∓#6 cancels
    ];

    // ── Configuration ──
    S.push(mkA('#1', dist, 'Max probe distance'), mkA('#2', retract, 'Retract distance'));
    S.push(mkA('#3', fFast, 'Fast feedrate'), mkA('#4', fSlow, 'Slow feedrate'), mkA('#5', port, 'Probe port'));
    S.push(mkA('#6', radius, 'Probe stylus radius'));   // declared ONE source for the comp — now EVERY wall touch comps via the block (not just circular/Z)
    S.push(mkA('#51', 0, 'Wall 1 pos'), mkA('#52', 0, 'Wall 2 pos'), mkA('#53', 0, 'Center pos'));
    S.push(mkA('#54', 0, 'Wall 3 pos'), mkA('#55', 0, 'Wall 4 pos'), mkA('#56', 0, 'Center pos 2'));
    S.push(mkA('#7', '[0-#1]', 'Negative max probe'), mkA('#8', '#1', 'Positive max probe'));
    S.push(mkA('#9', '[0-#2]', 'Negative retract'), mkA('#10', '#2', 'Positive retract'), mkA('#17', safeZ, 'Safe Z retract'));
    S.push(mkA('#18', clearOver, 'Traverse-over clearance (boss auto: lift this high to clear the part before crossing)'));
    // #19/#20 = the IN-axis cross-over (traverseOver — boss + inAxis auto ONLY); #21 = the TRANS-axis Diag travel
    // (transTraverse — boss + transAxis auto + twoAxis ONLY). Each present only when its own auto-traverse is active, so
    // pocket/manual macros stay unchanged. (#21 is a fixed default; the trans-axis re-centres to #53, so it no longer needs #19/#20.)
    S.push(...featBossOnly(inAxisAutoOnly([
        mkA('#19', crossX, 'X cross-over: in-axis traverse, wall 1 across to wall 2 (user-set to span the feature, default 80)'),
        mkA('#20', crossY, 'Y cross-over: in-axis traverse, wall 1 across to wall 2 (user-set to span the feature, default 80)'),
    ])));
    S.push(...featBossOnly(transAxisAutoOnly(twoAxisOnly([
        mkA('#21', diagTravel, 'Diag travel: X→Y trans-axis auto-traverse distance (default 50; tune so the 2nd-axis probe reaches ②)'),
    ]))));
    // NOTE: #22 (the diagonal's primary target) is assigned INSIDE transTraverse — AFTER the primary seq measures #53 —
    // because at rest diagPrimary='#53' and #53 is only known post-probe (assigning it here would capture #53's initial 0).
    // ── WCS base address ── 7-way wcs fork via the wcsbaseinto atom (bare: middle omits the comments): Expert 'active' reads
    // #578→#70 / a fixed G54..G59 uses the literal base (byte-identical); posts with no WCS table (V4.1/DM500 G92) emit nothing.
    S.push(...wcsFork((w) => [mkWcsBase(w)]));
    // ── Confirm start ── KIND-B, 2-way: the prompt text forks on probeZ (Hover OVER the top vs Press Enter to probe). The
    // spaced prompt + the ESC IF are ONE hmiconfirm now → off-HMI BOTH fold to a comment (KILLS the live V4.1/DM500 mis-branch:
    // today the ESC `IF #1505==0 GOTO2` emitted with #1505 never set → the probe was SKIPPED). Expert byte-identical.
    S.push(...probeZFork(
        [mkConfirm('1', 'Hover OVER the stock top (Z datum first). Press Enter - ESC=cancel', 2)],
        [mkConfirm('1', 'Press Enter to probe - ESC=cancel', 2)],
    ));
    S.push(mkDM('inc'));

    // PROBE-Z-FIRST (declaration): set the Z datum BEFORE the XY work, REUSING middle's own twoPass (no corner copy / no dup),
    // then REUSE reposition() to move to the first wall. The Z probe is its OWN pass (the "REPOSITION:" reposition emits marks
    // the XY as the next pass) → opSimStarts declares a leading Z-pass start so the sim renders Z-pass → reposition → XY faithfully.
    // The Z-save NOTE carries wcsLabel → forks on wcs (via wcsFork inside the probeZ guard).
    S.push(...probeZOnly([
        mkC('Z Surface - set Z datum first'),
        ...touchR('Z', false, '#57'),                       // two-pass down-probe the top → #57 = the TRUE surface (the block comps it; −#6 relocated here)
        ...wcsFork((w, label) => [mkWcsWrite({ axis: 'Z', wcs: wcsArgOf(w), offset: 2, value: '#57', note: `Save ${label} Z offset`, direct: true })]),   // Z0 write (#57 comped); Expert #[#70+2]=#57 / else G92 Z#57
        ...repositionR('jog clear, to the first wall'),      // Z pass done → reposition to the XY start (existing helper)
    ]));

    S.push(...seqR(axis, dir1Plus, 51));
    // ── Two axes (optional) ── a BOSS moves the probe to the perpendicular walls (a pocket stays at the centre); the TRANS-axis
    // toggle MANUAL jogs / AUTO diagonals there. CIRCULAR re-centres to the found primary centre (#53) first so the secondary
    // touches cross the true diameter. The 2-axis path writes BOTH centres to their axes' WCS offsets; the single-axis writes one.
    const twoAxisOn = [
        ...featBossOnly(transAxisFork(tsPair(transTraverseR('dogleg'), transTraverseR('diagonal')), repositionR('jog clear, around to the perpendicular walls'))),
        ...circularOnly([mkMM(axis, '#53')]),
        mkC(`2axis_${axis === 'X' ? 'XtoY' : 'YtoX'}_${resolvedDir2}`),
        ...seqR(second, dir2Plus, 54),
        safeZParkBlock(safeZFrame, '#17', 'inc'),   // SPATIAL-MODEL 1c: frame-aware final park; t856 — inside the G91 body → G90-wrap the machine G53, restore G91
        // #53 = centre of the PRIMARY axis, #56 = centre of the SECONDARY — write each to ITS axis's WCS offset
        // (not hardcoded X=0/Y=1, which swapped them when the primary axis was Y).
        mkWcsWrite({ axis, wcs: wcsArgOf(wcs), offset: AX[axis].off, value: '#53', direct: true }), mkWcsWrite({ axis: second, wcs: wcsArgOf(wcs), offset: AX[second].off, value: '#56', direct: true }),
    ];
    const twoAxisOff = [
        safeZParkBlock(safeZFrame, '#17', 'inc'),   // SPATIAL-MODEL 1c: frame-aware final park; t856 — inside the G91 body → G90-wrap the machine G53, restore G91
        mkWcsWrite({ axis, wcs: wcsArgOf(wcs), offset: AX[axis].off, value: '#53', direct: true }),
    ];
    S.push(...twoAxisFork(twoAxisOn, twoAxisOff));

    // ── Circular (optional) ── round feature: the opposite-touch span IS the diameter (walls already radius-comped, so the old
    // ∓2#6 EVAPORATES). #58 = primary Ø; with 2-axis, #59 = perpendicular Ø, #60 the mean, #61 out-of-round. ABS → dir-agnostic.
    S.push(...circularOnly([
        mkA('#58', 'ABS[#51-#52]', 'Primary-axis diameter (walls already radius-comped)'),
        ...twoAxisOnly([
            mkA('#59', 'ABS[#54-#55]', 'Secondary-axis diameter (walls already radius-comped)'),
            mkA('#60', '[#58+#59]/2', 'Mean diameter'),
            mkA('#61', '[#58-#59]', 'Out-of-round (primary dia - secondary dia)'),   // roundness metric (same as the Circular wizard)
        ]),
        ...twoAxisFork([mkMSG('Centre #53/#56 - mean dia #60 - round #61')], [mkMSG('Centre #53 - dia #58')]),
    ]));

    // ── Dual-gantry sync (optional) ── a bool block-add guarded on syncA, gated ALSO by (axis==='Y' || twoAxis). axis is baked
    // here (a value swap, not a structural fork), so in the superset the (axis==='Y') half is a compile-time constant: axis 'Y'
    // → syncA-only; axis 'X' → syncA nested in twoAxis. Concrete matches the same condition. (slave stays baked — a value follow-on.)
    const slave = params.slave || '3';
    // Expert `#74=[#70+slave]`+`#[#74]=#883` (byte-identical); #883 has no cross-post equivalent → honest comment off-Expert.
    const syncKids = [mkWcsWrite({ axis: 'A', wcs: wcsArgOf(wcs), offset: Number(slave), addrVar: '#74', value: '#883', offComment: 'Dual-gantry A sync skipped — no #883 slave-DRO equivalent on this controller' })];
    if (superset) {
        const gated = (axis === 'Y') ? syncKids : [GUARD({ param: 'twoAxis', is: true }, syncKids)];
        S.push(GUARD({ param: 'syncA', is: true }, gated));
    } else if (params.syncA && (axis === 'Y' || twoAxis)) {
        S.push(...syncKids);
    }

    // ── Footer + error handler ── the bare #1505 success/fail codes via hmiline (Expert #1505=<v>; off-HMI nothing, no text).
    S.push(mkDM('abs'), mkHMI('-5000', ''), mkGO(2));
    S.push(mkLB(1), safeRetractNode(), mkHMI('1', ''), mkLB(2), mkEND());   // t822 — machine-frame G53 retract (was mkDM inc/mkMV Z#17/mkDM abs — incremental crash vector)
    return S;
}

export class MiddleWizard {
    generate(params) {
        recordOp('middle', params);   // let the Blocks tab open this op as its stack
        return emitMapped(middleStack(params), activeDialectOpts()).text;
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
