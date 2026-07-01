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

/** Corner params → its outside-corner probe-macro block stack. The one source of truth for both displays. */
export function cornerStack(params = {}) {
    const corner = ({ 1: 'FL', 2: 'FR', 3: 'BL', 4: 'BR', FL: 'FL', FR: 'FR', BL: 'BL', BR: 'BR' }[params.corner]) || 'FL';
    const probeZ = !!(params.probeZ || params.probeZFirst);
    const probeSeq = ({ 0: 'YX', 1: 'XY', YX: 'YX', XY: 'XY' }[params.probeSeq]) || 'YX';
    const wcs = ({ 0: 'active', 1: 'G54', 2: 'G55', 3: 'G56', 4: 'G57', 5: 'G58', 6: 'G59', active: 'active', G54: 'G54', G55: 'G55', G56: 'G56', G57: 'G57', G58: 'G58', G59: 'G59' }[params.wcs]) || 'active', wcsLabel = wcs === 'active' ? 'Active WCS' : wcs;

    const dist = num(params.dist, 500), retract = num(params.retract, 5);
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
    const level = num(params.level, 0), safeZ = num(params.safeZ, 10);
    const scanDepth = num(params.scanDepth, 5), radius = num(params.radius, 2.0);
    const src = params.sources || {};   // controller-resident probe fields (PROBE-CONFIG-SOURCE.md)

    // corner → probe directions (FL=X+Y+  FR=X−Y+  BL=X+Y−  BR=X−Y−)
    const [xDir, yDir] = { FL: ['+', '+'], FR: ['-', '+'], BL: ['+', '-'], BR: ['-', '-'] }[corner] || ['+', '+'];
    const dirLabel = (d) => (d === '+' ? 'pos' : 'neg');
    const plungeDepth = safeZ + scanDepth;

    // The two walls in the chosen probe order, each with its direction.
    const firstAx = probeSeq === 'YX' ? 'Y' : 'X', firstDir = probeSeq === 'YX' ? yDir : xDir;
    const secondAx = probeSeq === 'YX' ? 'X' : 'Y', secondDir = probeSeq === 'YX' ? xDir : yDir;

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
            A('#[#70]', '#102', `Save to ${wcsLabel} X`);
        } else {
            A('#73', '[#70+1]', 'WCS Y Address');
            A('#[#73]', '#101', `Save to ${wcsLabel} Y`);
        }
        MV(ax, retractVar); MV('Z', '#17');
    };

    // ── Header ──
    C(`Corner | ${corner} OUTSIDE | X ${dirLabel(xDir)} Y ${dirLabel(yDir)}${probeZ ? ' + Z Surface' : ''} | ${wcsLabel}`);
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
    A('#17', plungeDepth, 'Plunge depth = safeZ + scanDepth');
    A('#18', '[0-#17]', 'Negative plunge'); A('#19', safeZ, 'Safe Z retract distance');
    if (probeZ) {
        A('#21', params.startX || '0', 'Z to Wall 1 traverse (X)');
        A('#22', params.startY || '0', 'Z to Wall 1 traverse (Y)');
    }
    A('#23', params.cross1_x || '0', 'Wall 1 to Wall 2 traverse (X)');
    A('#24', params.cross1_y || '0', 'Wall 1 to Wall 2 traverse (Y)');

    // ── WCS base address ──
    if (wcs === 'active') {
        C('Read Active WCS');
        A('#71', '#578', 'Active WCS index: 1=G54 2=G55 etc');
        A('#72', '[#71-1]', 'Zero-based index');
        A('#70', '[805+[#72*5]]', 'Base WCS address');
    } else { C(`Target: ${wcs}`); A('#70', WCS_BASE[wcs], 'Base WCS address'); }

    // ── Confirm + incremental ──
    C('Confirm Start');
    A('#1505', '1', `${probeZ ? 'Hover OVER the' : 'Hover OUTSIDE the'} ${corner} corner material. Press Enter`);
    DM('inc');

    // ── Z surface (optional) ──
    if (probeZ) {
        // Z-surface touch via the shared block. The comp writes the WCS Z directly (#[#73]=[#1927-#6]); preComp sets the
        // indirect address #73 right before the comp (kept in place → byte-identical). trailingRetract:false → the corner
        // does its own safe-Z retract + the travel to the first wall.
        S.push(...probeSurfaceStack({
            axis: 'Z', dir: '-', probeVar: '#7', retractVar: '#10', feedFast: '#3', feedSlow: '#4', port: '#5', level,
            twoPass: true, raw: '#1927', result: '#[#73]', radius: '#6', compEnable: true,
            trailingRetract: false, preComp: [{ var: '#73', value: '[#70+2]', note: 'WCS Z Address' }],
            compNote: `Save ${wcsLabel} Z offset - machine coord (− stylus radius)`,
        }));
        S.push(...safeTraverseStack({
            mode: 'seq', crossX: '#21', crossY: '#22', lift: '#19',
            comment: 'Traverse to first wall'
        }));
    }

    // ── Two walls, in the chosen order ──
    let step = probeZ ? 2 : 1;
    C(`Step ${step++}: ${firstAx} Probe`);
    MV('Z', '#18');                          // plunge to scan depth
    probeWall(firstAx, firstDir);

    S.push(...safeTraverseStack({
        mode: 'seq', crossX: '#23', crossY: '#24', drop: '#18',
        comment: `Step ${step++}: REPOSITION: Traverse past corner and set up for ${secondAx}`
    }));

    C(`Step ${step++}: ${secondAx} Probe`);
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
