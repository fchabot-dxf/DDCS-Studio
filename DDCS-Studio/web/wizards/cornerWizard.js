/**
 * DDCS Studio - Corner Wizard — find an OUTSIDE corner (boss): probe two walls, set the WCS X & Y (+ optional Z).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `cornerStack(params)` — a snippet of
 * Comment / Set# / Probe / If Goto / Move / Distance / Label / Goto / Raw / End Program atoms. Form and Blocks
 * view are two editors of the same stack. Same probe logic as the old string builder: optional Z-surface probe,
 * then the two walls in the chosen order (XY/YX) with radius compensation, an N1/N2 error handler, and M30.
 *
 * Functional port (NOT byte-identical to the old generator, same as the edge/middle ports): the atom emitter
 * drops per-line inline comments + blank separators, fixes Q to Q1 (the probe atom's form), and splits the
 * combined `G91 G0 Z#17` into `G91` + `G0 Z#17`. Verified vs the captured old output — probe sequence, #var
 * math, WCS writes and control flow match — and against the M350 ground truth (see ddcs-ground-truth memory).
 *
 * DDCS M350: status #1920/#1921/#1922 (2=SUCCESS, check !=2), trigger pos #1925/#1926/#1927.
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { recordOp } from '../blocks/opRecord.js';
import { probeSurfaceStack, safeTraverseStack } from './ops/probeSurface.js';
import { num } from './ops/util.js';
import { toNum as toNumShared, srcVal, srcNote } from './probeBlocks.js';

const AX = {
    X: { status: '#1920', result: '#1925', off: 0 },
    Y: { status: '#1921', result: '#1926', off: 1 },
    Z: { status: '#1922', result: '#1927', off: 2 },
};
const WCS_BASE = { G54: 805, G55: 810, G56: 815, G57: 820, G58: 825, G59: 830 };

// corner → probe directions (FL=X+Y+ FR=X−Y+ BL=X+Y− BR=X−Y−). ONE source read by cornerStack's concrete xDir/yDir, the
// ③b superset forks (cornerFork/csFork/axesOf), AND the sim-marker reposition helper (cornerReposOffsets) — so a quadrant
// edit can't desync the emit and the preview. (Hoisted to module scope so the sim helper shares the SAME geometry.)
const dirsOf = (c) => ({ FL: ['+', '+'], FR: ['-', '+'], BL: ['+', '-'], BR: ['-', '-'] }[c] || ['+', '+']);
// The two walls in the chosen probe order (per corner×probeSeq): fA/fD = first-wall axis+dir, sA/sD = second-wall axis+dir.
const axesOf = (c, seq) => { const [xd, yd] = dirsOf(c); return seq === 'YX' ? { xd, yd, fA: 'Y', fD: yd, sA: 'X', sD: xd } : { xd, yd, fA: 'X', fD: xd, sA: 'Y', sD: yd }; };

/** The numeric reposition-DEFAULT deltas for the SIM preview marker positions — the SAME #21/#22 (Z→wall1) and #23/#24
 *  (wall1→wall2) defaults the emit uses (own/opp = ±travelDist), evaluated to NUMBERS via the SAME axesOf axis-order
 *  geometry. So the preview markers chain from their anchors exactly where the tool actually arrives, and a quadrant /
 *  probe-order / travelDist edit moves both together. Mirrors the emit's `params.<sock> || formula` (a set socket wins;
 *  an unset/0 socket falls to the formula). PREVIEW-ONLY — never emitted (byte-parity untouched). */
export function cornerReposOffsets(params = {}) {
    const corner = ({ 1: 'FL', 2: 'FR', 3: 'BL', 4: 'BR', FL: 'FL', FR: 'FR', BL: 'BL', BR: 'BR' }[params.corner]) || 'FL';
    const seq = ({ 0: 'YX', 1: 'XY', YX: 'YX', XY: 'XY' }[params.probeSeq]) || 'YX';
    const td = num(params.travelDist, 50) || 0;
    const ax = axesOf(corner, seq);
    const ownN = (d) => (d === '+' ? td : -td);   // #15 / #16 as numbers (own = signed by dir)
    const oppN = (d) => (d === '+' ? -td : td);   // opp = the opposite
    // mirror the emit's `params.<sock> || formula`: a SET NUMERIC socket wins; unset/0/EXPRESSION → the formula. An expression
    // string ('#16', '[0-#15]') can't be evaluated in JS → falls to the formula → the preview stays FINITE (never NaN).
    const useN = (raw, formula) => { const v = parseFloat(raw); return (raw && Number.isFinite(v)) ? v : formula; };
    // #21/#22 (Z→wall1): move along the FIRST wall axis in opp(fD); the perpendicular holds at 0.
    const w1x = useN(params.startX, ax.fA === 'X' ? oppN(ax.fD) : 0);
    const w1y = useN(params.startY, ax.fA === 'Y' ? oppN(ax.fD) : 0);
    // #23/#24 (wall1→wall2): #23 = fA==='X' ? own(xd) : opp(xd); #24 = fA==='Y' ? own(yd) : opp(yd).
    const w2x = useN(params.cross1_x, ax.fA === 'X' ? ownN(ax.xd) : oppN(ax.xd));
    const w2y = useN(params.cross1_y, ax.fA === 'Y' ? ownN(ax.yd) : oppN(ax.yd));
    return { wall1: { dx: w1x, dy: w1y }, wall2: { dx: w2x, dy: w2y } };
}

/** Corner params → its outside-corner probe-macro block stack. The one source of truth for both displays.
 *  `opts.superset` (② B4 step 4a) seeds the TWIN as an all-arms-present template: every probeZFirst-dependent piece
 *  emits BOTH arms wrapped in a `guard` block so instantiate() can prune to either concrete shape. Superset OFF
 *  (the built-in + every existing caller/test) is byte-identical to today. */
export function cornerStack(params = {}, opts = {}) {
    const corner = ({ 1: 'FL', 2: 'FR', 3: 'BL', 4: 'BR', FL: 'FL', FR: 'FR', BL: 'BL', BR: 'BR' }[params.corner]) || 'FL';
    const probeZ = !!(params.probeZ || params.probeZFirst);
    const probeSeq = ({ 0: 'YX', 1: 'XY', YX: 'YX', XY: 'XY' }[params.probeSeq]) || 'YX';
    const wcs = ({ 0: 'active', 1: 'G54', 2: 'G55', 3: 'G56', 4: 'G57', 5: 'G58', 6: 'G59', active: 'active', G54: 'G54', G55: 'G55', G56: 'G56', G57: 'G57', G58: 'G58', G59: 'G59' }[params.wcs]) || 'active', wcsLabel = wcs === 'active' ? 'Active WCS' : wcs;

    const dist = num(params.dist, 500), retract = num(params.retract, 5);
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
    const level = num(params.level, 0), safeZ = num(params.safeZ, 10);
    const travelDist = num(params.travelDist, 50), scanDepth = num(params.scanDepth, 5), radius = num(params.radius, 2.0);
    const src = params.sources || {};   // controller-resident probe fields (PROBE-CONFIG-SOURCE.md)
    // ① AUTO/MANUAL TRAVEL — ONE toggle governs BOTH travels (Z→wall1 + wall1→wall2). 'auto' (default) = the hands-free G0
    // seq move; 'manual' = an operator jog-and-wait via the shared safeTraverseStack (approach:'manual'), reusing each
    // travel's OWN lift/drop so the Z-state mirrors auto. Default 'auto' → BYTE-IDENTICAL to today.
    const travelApproach = params.travelApproach === 'manual' ? 'manual' : 'auto';

    // corner → probe directions via the module-level dirsOf (shared with the sim helper — see the header). The concrete
    // xDir/yDir AND the ③b superset forks (cornerFork/csFork/axesOf) all read it, so a quadrant edit can't desync the paths.
    const [xDir, yDir] = dirsOf(corner);
    const dirLabel = (d) => (d === '+' ? 'pos' : 'neg');
    const td = travelDist || 0;   // ② B4(c): #17 plunge is now DECLARED as [#19+#20] (safeZ+scanDepth) — the controller sums it, so both are single editable sockets (fan-out dissolved), no baked plungeDepth

    // The two walls in the chosen probe order (per corner×probeSeq) are now derived PER COMBO inside csFork (axesOf) so the
    // superset can emit all 8 — see the ③b fork helpers below; concrete uses axesOf(corner, probeSeq).

    // Signed-travelDist reposition (INTERIM — until a stock-datum default is wired; inc B1b GATE): #15=+travelDist, #16=−travelDist.
    // own(dir) = signed by dir (#15/#16); opp(dir) = the opposite. The reposition sockets #21-#24 default to these so the wall-to-wall
    // traverse is NON-DEGENERATE by default; a bound cross1_*/start* (or a B3 drag literal) still overrides the socket wholesale.
    const own = (d) => (d === '+' ? '#15' : '#16');
    const opp = (d) => (d === '+' ? '#16' : '#15');

    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const DM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; S.push(b); };
    const MOVE = (props) => { const b = newBlock('move'); b.params = { mode: 'rapid', ...props }; S.push(b); };
    const MV = (ax, v) => MOVE({ [ax.toLowerCase()]: v });
    const RAW = (text) => { const b = newBlock('raw'); b.params = { text }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));

    // ② B4 step 4a — SUPERSET MODE. The twin SEED (opts.superset) carries EVERY probeZFirst arm, each wrapped in a
    // `guard`, so instantiate() prunes it to either concrete shape. Off (the built-in + all existing callers) is byte-
    // identical to today. The KIND-B interpolated text (header "+ Z Surface", the #1505 Hover OVER/OUTSIDE prompt, the
    // Step-number labels) forks WITH the block-adds — a block-only superset would emit the ON shape with the OFF text.
    const superset = !!opts.superset;
    const GUARD = (when, kids) => { const b = newBlock('guard'); b.params = { when }; b.children = kids; return b; };
    const WHEN_Z = { param: 'probeZFirst', is: true }, WHEN_NZ = { param: 'probeZFirst', is: false };
    const mkC = (t) => { const b = newBlock('comment'); b.params = { text: t }; return b; };
    const mkA = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; return b; };
    const mkDM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; return b; };
    const mkRAW = (text) => { const b = newBlock('raw'); b.params = { text }; return b; };
    // zPair: a Z-varying fork with BOTH arms — superset guards each; concrete pushes the matching arm inline (today's shape).
    const zPair = (onKids, offKids) => { if (superset) S.push(GUARD(WHEN_Z, onKids), GUARD(WHEN_NZ, offKids)); else S.push(...(probeZ ? onKids : offKids)); };
    // zOnly: a Z-ONLY block-add (no off-arm) — superset guards it on; concrete emits it only when probeZ.
    const zOnly = (kids) => { if (superset) S.push(GUARD(WHEN_Z, kids)); else if (probeZ) S.push(...kids); };
    // ② B4 step 4b — travelApproach (auto|manual) is an ENUM structural fork: safeTraverseStack emits a DIFFERENT block shape
    // per arm (auto = the G0 seq move; manual = the #1505 jog prompt). taPair RETURNS the arm blocks (composed INSIDE a z-fork,
    // so it can nest): superset → BOTH arms guarded by value-equality when(travelApproach=='auto'|'manual'); concrete → only
    // the selected arm (LAZY thunks, so the unused shape is never built). whenOk matches enums by strict === (guard-prune.spec).
    const WHEN_TA = (v) => ({ param: 'travelApproach', is: v });
    const taPair = (autoFn, manualFn) => superset
        ? [GUARD(WHEN_TA('auto'), autoFn()), GUARD(WHEN_TA('manual'), manualFn())]
        : (travelApproach === 'manual' ? manualFn() : autoFn());
    // ② B4 step 4c — wcs is a 7-WAY enum structural fork: the WCS-base block (active reads #578 → computes #70; a fixed
    // G54..G59 uses the literal base) PLUS the derived `wcsLabel`, which bleeds into 4 comments (header + the X/Y/Z save
    // notes). wcsFork RETURNS one wcs value's arm blocks (composed inside the z-forks so it nests): superset → all 7 arms
    // guarded by when(wcs==value), each built with ITS resolved label; concrete → the selected arm. Inert DATA pruned per build.
    const WCS_VALUES = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'];
    const wcsLabelOf = (w) => (w === 'active' ? 'Active WCS' : w);
    const wcsFork = (fn) => superset
        ? WCS_VALUES.map((w) => GUARD({ param: 'wcs', is: w }, fn(w, wcsLabelOf(w))))
        : fn(wcs, wcsLabel);
    // ③b — corner + probeSeq are VALUE/ORDER swaps (not prune-add/remove): corner flips the probe DIRECTIONS (#7/#8, #9/#10,
    // radiuscomp dir) + reposition signs + text; probeSeq swaps the wall ORDER + text. They INTERACT (probeWall content =
    // f(corner, probeSeq)), so an 8-WAY guard (nested corner × probeSeq, reusing whenOk) like wcs — NOT a value-binding (the
    // swap is derived from the quadrant; the reorder is of differently-shaped blocks). Combinatorial-but-inert (pruned/build).
    const CORNERS = ['FL', 'FR', 'BL', 'BR'], SEQS = ['YX', 'XY'];
    // axesOf hoisted to module scope (shared with cornerReposOffsets — the sim helper — so emit + preview read one geometry).
    // cornerFork: 4-way (corner ONLY — header/prompt/footer text). RETURNS the arm blocks (composes inside the other forks).
    const cornerFork = (fn) => superset ? CORNERS.map((c) => { const [xd, yd] = dirsOf(c); return GUARD({ param: 'corner', is: c }, fn(c, xd, yd)); }) : fn(corner, xDir, yDir);
    // csFork: 8-way (corner × probeSeq, nested). RETURNS. fn(c, seq, axes) recomputes the combo's derived directions/axes.
    const csFork = (fn) => superset
        ? CORNERS.map((c) => GUARD({ param: 'corner', is: c }, SEQS.map((s) => GUARD({ param: 'probeSeq', is: s }, fn(c, s, axesOf(c, s))))))
        : fn(corner, probeSeq, axesOf(corner, probeSeq));
    // Returning variants of the push-forks (so a corner/cs fork can NEST them): same semantics as zPair/zOnly, but RETURN.
    const zPairR = (onKids, offKids) => superset ? [GUARD(WHEN_Z, onKids), GUARD(WHEN_NZ, offKids)] : (probeZ ? onKids : offKids);
    const zOnlyR = (kids) => superset ? [GUARD(WHEN_Z, kids)] : (probeZ ? kids : []);
    const mkMV = (ax, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [ax.toLowerCase()]: v }; return b; };

    // Probe one wall via the shared PROBE-SURFACE BLOCK (t127): touch+comp → the TRUE wall in a temp (#102/#101); the
    // corner keeps its own WCS write + retract + safe-Z (trailingRetract:false). Byte-identical to the old hand-rolled wall.
    // RETURNS one wall's probe blocks (composed inside the corner×probeSeq csFork so directions/order fork per combo).
    const probeWallR = (ax, dir) => {
        const av = AX[ax], probeVar = dir === '+' ? '#8' : '#7', retractVar = dir === '+' ? '#9' : '#10';
        const compOp = dir === '+' ? '+' : '-';   // boss: wall is at trigger ± stylus radius
        const out = [...probeSurfaceStack({
            axis: ax, dir: compOp, probeVar, retractVar, feedFast: '#3', feedSlow: '#4', port: '#5', level,
            twoPass: true, raw: av.result, result: ax === 'X' ? '#102' : '#101', radius: '#6',
            compEnable: true, trailingRetract: false, compNote: `Trigger Pos ${compOp} Radius`,
        })];
        if (ax === 'X') {
            out.push(...wcsFork((w, label) => [mkA('#[#70]', '#102', `Save to ${label} X`)]));   // note forks on wcs (value/target constant)
        } else {
            out.push(mkA('#73', '[#70+1]', 'WCS Y Address'));
            out.push(...wcsFork((w, label) => [mkA('#[#73]', '#101', `Save to ${label} Y`)]));
        }
        out.push(mkMV(ax, retractVar), mkMV('Z', '#17'));
        return out;
    };

    // ── Header ── KIND-B, 3-way: the corner NAME + dir labels fork on corner; "+ Z Surface" on probeZFirst; the WCS label on
    // wcs → cornerFork(zPairR(wcsFork)) (4×2×7 in the superset, inert; one leaf survives prune → byte-identical concrete).
    const hdr1 = (z, label, c, xd, yd) => `Corner | ${c} OUTSIDE | X ${dirLabel(xd)} Y ${dirLabel(yd)}${z ? ' + Z Surface' : ''} | ${label}`;
    S.push(...cornerFork((c, xd, yd) => zPairR(wcsFork((w, label) => [mkC(hdr1(true, label, c, xd, yd))]), wcsFork((w, label) => [mkC(hdr1(false, label, c, xd, yd))]))));
    C(`Probe dist: ${dist}mm | Retract: ${retract}mm`);
    C(`Fast: ${fFast} | Slow: ${fSlow} | SafeZ: ${safeZ}mm | ScanDepth: ${scanDepth}mm`);

    // ── Configuration ──
    C('=== CONFIGURATION ===');
    A('#1', dist, 'Max probe distance');
    A('#2', srcVal(src.retract, retract), srcNote(src.retract, 'Retract distance'));
    A('#3', srcVal(src.fastFeed, fFast), srcNote(src.fastFeed, 'Fast feedrate'));
    A('#4', fSlow, 'Slow feedrate');
    A('#5', srcVal(src.port, port), srcNote(src.port, 'Probe port'));
    A('#6', radius, 'Probe stylus radius');

    // ── Calculated motions ──
    C('=== CALCULATED MOTIONS ===');
    A('#7', '[0-#1]', 'Negative max probe'); A('#8', '#1', 'Positive max probe');
    A('#9', '[0-#2]', 'Negative retract'); A('#10', '#2', 'Positive retract');
    A('#15', td, 'Positive travel = travelDist'); A('#16', '[0-#15]', 'Negative travel');
    // #19 (safeZ) + #20 (scanDepth) precede #17 so the controller has them when it evaluates #17=[#19+#20] (top-down eval).
    A('#19', safeZ, 'Safe Z retract distance'); A('#20', scanDepth, 'Scan depth');
    A('#17', '[#19+#20]', 'Plunge depth = safeZ + scanDepth'); A('#18', '[0-#17]', 'Negative plunge');
    // Z→Wall1: only the first wall's axis repositions (opp of its probe dir); the perpendicular axis holds. probeZFirst-only,
    // AND the sign/axis fork on corner×probeSeq → csFork NESTED inside the zOnly (probeZ). (Bound socket → CORNER_BINDINGS is
    // derived over a canonical-pruned stack, so the 8× superset copies don't ambiguate; instantiate re-derives over the pruned.)
    S.push(...zOnlyR(csFork((c, s, ax) => [
        mkA('#21', params.startX || (ax.fA === 'X' ? opp(ax.fD) : '0'), 'Z to Wall 1 traverse (X)'),
        mkA('#22', params.startY || (ax.fA === 'Y' ? opp(ax.fD) : '0'), 'Z to Wall 1 traverse (Y)'),
    ])));
    // Wall1→Wall2: X moves own(xDir) when X is probed first (else opp); Y likewise. Sign forks on corner×probeSeq (csFork).
    S.push(...csFork((c, s, ax) => [
        mkA('#23', params.cross1_x || (ax.fA === 'X' ? own(ax.xd) : opp(ax.xd)), 'Wall 1 to Wall 2 traverse (X)'),
        mkA('#24', params.cross1_y || (ax.fA === 'Y' ? own(ax.yd) : opp(ax.yd)), 'Wall 1 to Wall 2 traverse (Y)'),
    ]));

    // ── WCS base address ── 7-way wcs fork: 'active' reads #578 → computes #70; a fixed G54..G59 uses the literal base.
    const wcsBaseBlocks = (w) => w === 'active'
        ? [mkC('Read Active WCS'), mkA('#71', '#578', 'Active WCS index: 1=G54 2=G55 etc'), mkA('#72', '[#71-1]', 'Zero-based index'), mkA('#70', '[805+[#72*5]]', 'Base WCS address')]
        : [mkC(`Target: ${w}`), mkA('#70', WCS_BASE[w], 'Base WCS address')];
    S.push(...wcsFork((w) => wcsBaseBlocks(w)));

    // ── Confirm + incremental ── KIND-B, 2-way: OVER/OUTSIDE forks on probeZFirst, the corner NAME on corner → cornerFork(zPairR).
    C('Confirm Start');
    const startPrompt = (z, c) => `${z ? 'Hover OVER the' : 'Hover OUTSIDE the'} ${c} corner material. Press Enter`;
    S.push(...cornerFork((c) => zPairR([mkA('#1505', '1', startPrompt(true, c))], [mkA('#1505', '1', startPrompt(false, c))])));
    DM('inc');

    // ── Z surface (optional) ── probeZFirst-only block-add: the Z-surface touch + the Z→wall1 reposition.
    // Z-surface touch via the shared block. The comp writes the WCS Z directly (#[#73]=[#1927-#6]); preComp sets the indirect
    // address #73 right before the comp (kept in place → byte-identical). trailingRetract:false → the corner does its own
    // safe-Z retract + the travel to the first wall.
    // The compNote carries the derived wcsLabel → forks on wcs (via wcsFork in the zOnly below); everything else is constant.
    const zSurfaceProbe = (label) => probeSurfaceStack({
        axis: 'Z', dir: '-', probeVar: '#7', retractVar: '#10', feedFast: '#3', feedSlow: '#4', port: '#5', level,
        twoPass: true, raw: '#1927', result: '#[#73]', radius: '#6', compEnable: true,
        trailingRetract: false, preComp: [{ var: '#73', value: '[#70+2]', note: 'WCS Z Address' }],
        compNote: `Save ${label} Z offset - machine coord (− stylus radius)`,
    });
    // ② B4 step 3 (anchor): the 'REPOSITION:' comment makes the engine count Z→wall1 as its own pass (3 passes = 3 markers
    // under probeZFirst). ② B4 step 4b: it forks on travelApproach (auto seq move vs #1505 jog prompt) → taPair NESTED inside
    // the probeZFirst guard. manual: lift #19, jog, no drop (the wall-1 step plunges) — mirrors auto's Z.
    // Z→wall1 stays a single simultaneous XY move (NO firstAxis): this traverse runs at safe-Z (lift #19, no drop — the
    // wall-1 step plunges) so it's ABOVE the stock and a diagonal can't collide; and by default only the first wall's axis
    // moves (the other is 0), so a dog-leg would only add a no-op leg. The SAFE dog-leg is the wall1→wall2 traverse below,
    // which runs at scan depth (crosses material). (It also isn't forked per-combo here, so a geometry-aware order would
    // desync the twin's superset from the built-in — another reason to keep it the un-split diagonal. Byte-identical.)
    const zWall1 = (approach) => safeTraverseStack({
        mode: 'seq', crossX: '#21', crossY: '#22', lift: '#19',
        comment: 'REPOSITION: Traverse to first wall',
        approach, promptNote: 'Jog clear, over to the first wall. Press Enter',
    });
    zOnly([...wcsFork((w, label) => zSurfaceProbe(label)), ...taPair(() => zWall1('auto'), () => zWall1('manual'))]);

    // ── Two walls, in the chosen order ──
    // Z-first shifts EVERY step number +1 (Z-surface takes Step 1) — a KIND-B fork, so each Step label is a guarded comment
    // PAIR in the superset. The wall1→wall2 reposition forks on BOTH probeZFirst (the step number in its comment) AND
    // travelApproach (auto move vs #1505 jog prompt) → the taPair (travelApproach) NESTS inside the zPair (probeZFirst). One
    // leaf survives prune → byte-identical to the concrete emit for any (probeZFirst × travelApproach) combination.
    // The two-wall sequence forks on corner×probeSeq (directions + ORDER + step-axis text) → csFork wraps the WHOLE region;
    // inside, probeZ (step number) / travelApproach (reposition shape) / wcs (save note) nest via the returning variants.
    const firstLbl = (z, fA) => `Step ${z ? 2 : 1}: ${fA} Probe`;
    const repoLbl = (z, sA) => `Step ${z ? 3 : 2}: REPOSITION: Traverse past corner and set up for ${sA}`;
    const secondLbl = (z, sA) => `Step ${z ? 4 : 3}: ${sA} Probe`;
    // SAFE DOG-LEG: this wall1→wall2 traverse runs at SCAN DEPTH (drop #18) → it crosses the material plane, so a diagonal
    // could clip the corner. firstAxis = the SECOND wall's axis (ax.sA) routes it AROUND the outside corner (see the
    // safeTraverseStack SAFE DOG-LEG note). Geometry-aware per corner×probeSeq (sA from axesOf), forked in csFork so the
    // twin's superset + the built-in pick the same order per combo → byte-parity holds. (manual ignores firstAxis.)
    const repoTraverse = (comment, approach, firstAxis) => safeTraverseStack({
        mode: 'seq', crossX: '#23', crossY: '#24', drop: '#18', comment, approach, firstAxis,
        promptNote: 'Jog clear, around to the next wall. Press Enter',   // manual: jog, drop #18 to scan depth (mirrors auto) — no lift (already at #17)
    });
    const repoArmR = (z, sA) => taPair(() => repoTraverse(repoLbl(z, sA), 'auto', sA), () => repoTraverse(repoLbl(z, sA), 'manual', sA));
    S.push(...csFork((c, s, ax) => [
        ...zPairR([mkC(firstLbl(true, ax.fA))], [mkC(firstLbl(false, ax.fA))]),
        mkMV('Z', '#18'),                          // plunge to scan depth
        ...probeWallR(ax.fA, ax.fD),
        ...zPairR(repoArmR(true, ax.sA), repoArmR(false, ax.sA)),
        ...zPairR([mkC(secondLbl(true, ax.sA))], [mkC(secondLbl(false, ax.sA))]),
        ...probeWallR(ax.sA, ax.sD),
    ]));

    // ── Dual-gantry sync (optional) ── ② B4 step 4d: a bool block-ADD guarded on syncA (the same shape as probeZFirst's
    // Z step, but VALUE-CARRYING — the slave offset #74=[#70+slave]). superset → the blocks wrapped in when(syncA); concrete
    // → emitted only when params.syncA (byte-identical to today). slave stays baked at its default (a value-binding follow-on).
    const slave = params.slave || '3';
    const syncBlocks = [
        mkC('Dual Gantry Sync'),
        mkDM('abs'), mkRAW('G1 A0 F#3'), mkDM('inc'),
        mkA('#74', `[#70+${slave}]`, 'Base WCS + Slave Offset'),
        mkA('#[#74]', '#883', 'Sync A offset with Y'),
    ];
    if (superset) S.push(GUARD({ param: 'syncA', is: true }, syncBlocks));
    else if (params.syncA) S.push(...syncBlocks);

    // ── Footer + error handler ──
    DM('abs');
    S.push(...cornerFork((c) => [mkA('#1505', '-5000', `Corner ${c} found`)]));   // KIND-B: the corner NAME forks on corner
    GO(2);
    C('=== ERROR HANDLER ===');
    LB(1);
    DM('inc'); MV('Z', '#17'); DM('abs');
    A('#1505', '1', 'ERROR: Probe failed to trigger');
    LB(2); END();
    return S;
}

export class CornerWizard {
    constructor() {}

    toNum(v, def = 0) {
        return toNumShared(v, def);
    }

    generate(params) {
        recordOp('corner', params);   // let the Blocks tab open this op as its stack
        return emitMapped(cornerStack(params)).text;
    }

    /**
     * Infer where the spindle should START for this corner/config, in the 3D-preview stock frame
     * (stock spans X[0..x] Y[0..y], top at Z=0). The macro is incremental, so this start positions the
     * whole probe path at the chosen corner. Uses the SAME corner→direction convention as cornerStack():
     *   - Z-first ("hover OVER the corner material") → just INSIDE the corner, above the top.
     *   - otherwise ("hover OUTSIDE the corner")     → just OUTSIDE the corner, within probe reach.
     * Purely a preview/sim hint — never written to the G-code, never touches the WCS.
     */
    inferStart(params, stock) {
        const n = (v, d) => this.toNum(v, d);
        const sx = n(stock && stock.x, 100), sy = n(stock && stock.y, 80);
        const corner = params.corner || 'FL';
        const zFirst = !!(params.probeZ || params.probeZFirst);
        const seq = params.probeSeq || 'YX';
        const safeZ = n(params.safeZ, 10), radius = n(params.radius, 2);
        const travel = n(params.travelDist, 50), dist = n(params.dist, 500);
        // corner XY in the stock frame + the probe direction (matches FL=X+Y+ … BR=X−Y−)
        const cornerXY = { FL: [0, 0], FR: [sx, 0], BL: [0, sy], BR: [sx, sy] }[corner] || [0, 0];
        const dir      = { FL: [1, 1], FR: [-1, 1], BL: [1, -1], BR: [-1, -1] }[corner] || [1, 1];
        // The FIRST-probed wall is approached from the open space IN FRONT of it (outside). The OTHER axis
        // sits JUST INSIDE the stock extent near the corner, so the first probe's ray actually crosses the
        // wall (else it runs off the end and never clamps); the macro's travel move then sets up the 2nd wall.
        const overMat  = radius + 5;                                       // Z-first: hover over the material
        const inFront  = Math.max(8, Math.min(travel, dist * 0.3));        // first wall: open space in front
        const nearEdge = Math.min(20, travel * 0.8);                       // perp axis: ~20 mm inside the edge (< travel for the reposition)
        const firstIsX = (seq !== 'YX');                                   // YX → Y first, else X first
        const kFor = (isX) => zFirst ? overMat : ((isX === firstIsX) ? -inFront : nearEdge);
        return { x: cornerXY[0] + dir[0] * kFor(true), y: cornerXY[1] + dir[1] * kFor(false), z: safeZ };
    }
}
