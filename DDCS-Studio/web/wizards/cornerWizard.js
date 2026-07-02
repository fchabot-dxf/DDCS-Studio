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

    // corner → probe directions (FL=X+Y+  FR=X−Y+  BL=X+Y−  BR=X−Y−)
    const [xDir, yDir] = { FL: ['+', '+'], FR: ['-', '+'], BL: ['+', '-'], BR: ['-', '-'] }[corner] || ['+', '+'];
    const dirLabel = (d) => (d === '+' ? 'pos' : 'neg');
    const td = travelDist || 0;   // ② B4(c): #17 plunge is now DECLARED as [#19+#20] (safeZ+scanDepth) — the controller sums it, so both are single editable sockets (fan-out dissolved), no baked plungeDepth

    // The two walls in the chosen probe order, each with its direction.
    const firstAx = probeSeq === 'YX' ? 'Y' : 'X', firstDir = probeSeq === 'YX' ? yDir : xDir;
    const secondAx = probeSeq === 'YX' ? 'X' : 'Y', secondDir = probeSeq === 'YX' ? xDir : yDir;

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

    // Probe one wall via the shared PROBE-SURFACE BLOCK (t127): touch+comp → the TRUE wall in a temp (#102/#101); the
    // corner keeps its own WCS write + retract + safe-Z (trailingRetract:false). Byte-identical to the old hand-rolled wall.
    const probeWall = (ax, dir) => {
        const av = AX[ax], probeVar = dir === '+' ? '#8' : '#7', retractVar = dir === '+' ? '#9' : '#10';
        const compOp = dir === '+' ? '+' : '-';   // boss: wall is at trigger ± stylus radius
        S.push(...probeSurfaceStack({
            axis: ax, dir: compOp, probeVar, retractVar, feedFast: '#3', feedSlow: '#4', port: '#5', level,
            twoPass: true, raw: av.result, result: ax === 'X' ? '#102' : '#101', radius: '#6',
            compEnable: true, trailingRetract: false, compNote: `Trigger Pos ${compOp} Radius`,
        }));
        if (ax === 'X') {
            S.push(...wcsFork((w, label) => [mkA('#[#70]', '#102', `Save to ${label} X`)]));   // note forks on wcs (value/target constant)
        } else {
            A('#73', '[#70+1]', 'WCS Y Address');
            S.push(...wcsFork((w, label) => [mkA('#[#73]', '#101', `Save to ${label} Y`)]));
        }
        MV(ax, retractVar); MV('Z', '#17');
    };

    // ── Header ── KIND-B: "+ Z Surface" forks on probeZFirst, the WCS label on wcs → the two nest (zPair over wcsFork).
    const hdr1 = (z, label) => `Corner | ${corner} OUTSIDE | X ${dirLabel(xDir)} Y ${dirLabel(yDir)}${z ? ' + Z Surface' : ''} | ${label}`;
    zPair(wcsFork((w, label) => [mkC(hdr1(true, label))]), wcsFork((w, label) => [mkC(hdr1(false, label))]));
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
    // Z→Wall1: only the first wall's axis repositions (opp of its probe dir); the perpendicular axis holds. probeZFirst-only.
    zOnly([
        mkA('#21', params.startX || (firstAx === 'X' ? opp(firstDir) : '0'), 'Z to Wall 1 traverse (X)'),
        mkA('#22', params.startY || (firstAx === 'Y' ? opp(firstDir) : '0'), 'Z to Wall 1 traverse (Y)'),
    ]);
    // Wall1→Wall2: X moves own(xDir) when X is probed first (else opp); Y likewise. Default = signed travelDist (non-degenerate).
    A('#23', params.cross1_x || (firstAx === 'X' ? own(xDir) : opp(xDir)), 'Wall 1 to Wall 2 traverse (X)');
    A('#24', params.cross1_y || (firstAx === 'Y' ? own(yDir) : opp(yDir)), 'Wall 1 to Wall 2 traverse (Y)');

    // ── WCS base address ── 7-way wcs fork: 'active' reads #578 → computes #70; a fixed G54..G59 uses the literal base.
    const wcsBaseBlocks = (w) => w === 'active'
        ? [mkC('Read Active WCS'), mkA('#71', '#578', 'Active WCS index: 1=G54 2=G55 etc'), mkA('#72', '[#71-1]', 'Zero-based index'), mkA('#70', '[805+[#72*5]]', 'Base WCS address')]
        : [mkC(`Target: ${w}`), mkA('#70', WCS_BASE[w], 'Base WCS address')];
    S.push(...wcsFork((w) => wcsBaseBlocks(w)));

    // ── Confirm + incremental ──
    C('Confirm Start');
    const startPrompt = (z) => `${z ? 'Hover OVER the' : 'Hover OUTSIDE the'} ${corner} corner material. Press Enter`;
    zPair([mkA('#1505', '1', startPrompt(true))], [mkA('#1505', '1', startPrompt(false))]);   // KIND-B: OVER vs OUTSIDE
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
    const firstLbl = (z) => `Step ${z ? 2 : 1}: ${firstAx} Probe`;
    const repoLbl = (z) => `Step ${z ? 3 : 2}: REPOSITION: Traverse past corner and set up for ${secondAx}`;
    const secondLbl = (z) => `Step ${z ? 4 : 3}: ${secondAx} Probe`;
    const repoTraverse = (comment, approach) => safeTraverseStack({
        mode: 'seq', crossX: '#23', crossY: '#24', drop: '#18', comment, approach,
        promptNote: 'Jog clear, around to the next wall. Press Enter',   // manual: jog, drop #18 to scan depth (mirrors auto) — no lift (already at #17)
    });
    const repoArm = (z) => taPair(() => repoTraverse(repoLbl(z), 'auto'), () => repoTraverse(repoLbl(z), 'manual'));
    zPair([mkC(firstLbl(true))], [mkC(firstLbl(false))]);
    MV('Z', '#18');                          // plunge to scan depth
    probeWall(firstAx, firstDir);
    zPair(repoArm(true), repoArm(false));
    zPair([mkC(secondLbl(true))], [mkC(secondLbl(false))]);
    probeWall(secondAx, secondDir);

    // ── Dual-gantry sync (optional) ──
    if (params.syncA) {
        const s = params.slave || '3';
        C('Dual Gantry Sync');
        DM('abs'); RAW('G1 A0 F#3'); DM('inc');
        A('#74', `[#70+${s}]`, 'Base WCS + Slave Offset');
        A('#[#74]', '#883', 'Sync A offset with Y');
    }

    // ── Footer + error handler ──
    DM('abs');
    A('#1505', '-5000', `Corner ${corner} found`);
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
