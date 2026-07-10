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
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { probeSurfaceStack } from './ops/probeSurface.js';   // the shared probe primitive (edge composes it — t125 inc1)

const AX = {
    X: { status: '#1920', result: '#1925', stop: '#1905', limit: '#1915', off: 0 },
    Y: { status: '#1921', result: '#1926', stop: '#1906', limit: '#1916', off: 1 },
};

/** Edge params → its probe-macro block stack. The one source of truth for both displays.
 *  `opts.superset` (EDGE-PORT E1) seeds the DATA TWIN as an all-arms template: the wcs base (7-way), the confirm+probe
 *  region (axis×dir, 4-way) and the WCS write (axis×wcs, address offset + target label) each emit EVERY structural arm
 *  wrapped in a `guard`, so instantiate() prunes to the concrete shape. Superset OFF (the built-in + every existing
 *  caller/test) is BYTE-IDENTICAL to today — the fork helpers return the concrete arm INLINE. Mirrors cornerStack. */
export function edgeStack(params = {}, opts = {}) {
    const axis = params.axis === 'Y' ? 'Y' : 'X';
    const dir = params.dir === 'neg' ? 'neg' : 'pos';
    const wcs = params.wcs || 'active', wcsLabel = wcs === 'active' ? 'Active WCS' : wcs;
    const dist = num(params.dist, 15), retract = num(params.retract, 2), radius = num(params.radius, 2);
    const fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
    const level = num(params.level, 0);

    const S = [];
    const C = (text) => { const b = newBlock('comment'); b.params = { text }; S.push(b); };
    const A = (v, value, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(value), note: note || '' }; S.push(b); };
    const DM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const END = () => { S.push(newBlock('endprogram')); };

    // ── EDGE-PORT E1 — the guarded superset (mirror cornerStack). Block-RETURNING makers + fork helpers; superset OFF
    // returns the concrete arm INLINE (byte-identical). axis/dir/wcs are the structural drivers instantiate() prunes.
    const superset = !!opts.superset;
    const GUARD = (when, kids) => { const b = newBlock('guard'); b.params = { when }; b.children = kids; return b; };
    const mkDM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; return b; };
    // F1/E2 — the profile-aware seams corner proved (+ the ruled additions): wcsbaseinto/wcswrite(direct) for the #70-idiom
    // WCS write, hmiconfirm for the spaced prompt+ESC gate, hmiline for the bare notes. Expert byte-identical; V4.1/DM500 fold.
    const mkWcsBase = (w) => { const b = newBlock('wcsbaseinto'); b.params = { wcs: w, base: '#70' }; return b; };
    const mkWcsWrite = (spec) => { const b = newBlock('wcswrite'); b.params = { ...spec }; return b; };
    const wcsArgOf = (w) => (w === 'active' ? '#578' : String(parseInt(String(w).replace('G', ''), 10) - 53));
    const mkHMI = (value, note) => { const b = newBlock('hmiline'); b.params = { value: String(value), note: note || '' }; return b; };
    const HMI = (value, note) => S.push(mkHMI(value, note));
    const mkConfirm = (value, note, cancel) => { const b = newBlock('hmiconfirm'); b.params = { value: String(value), note: note || '', cancel }; return b; };
    const AXES = ['X', 'Y'], DIRS = ['pos', 'neg'], WCS_VALUES = ['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'];
    const wcsLabelOf = (w) => (w === 'active' ? 'Active WCS' : w);
    // wcs BASE via the wcsbaseinto atom — Expert 'active' reads #578→#70 / a fixed G54..G59 uses the literal base
    // (byte-identical); posts with no WCS table (V4.1/DM500 G92) emit nothing here. 7-way wcsFork.
    const wcsFork = (fn) => (superset ? WCS_VALUES.map((w) => GUARD({ param: 'wcs', is: w }, fn(w, wcsLabelOf(w)))) : fn(wcs, wcsLabel));
    // the confirm + one-wall probe for a given axis×dir (its KIND-B prompt/comment + the per-combo vars/sign). 4-way adFork.
    // PROBE-SURFACE BLOCK (t125): composes the shared probe primitive; functional G-code byte-identical to the old touch.
    const probeArm = (a, d) => {
        const AV = AX[a], p = d === 'pos';
        return [
            mkConfirm(1, `Press Enter to probe ${a} ${d} - ESC=cancel`, 2),   // spaced prompt + ESC IF; both fold off-HMI (no mis-branch)
            mkDM('inc'),
            ...probeSurfaceStack({
                axis: a, dir: p ? '+' : '-', comment: `Probe ${a} ${d}`,
                stopVar: AV.stop, limitVar: AV.limit, limitVal: p ? '2' : '1',
                probeVar: p ? '#8' : '#7', retractVar: p ? '#9' : '#10', feedFast: '#3', feedSlow: '#4', port: '#5', level,
                twoPass: true, raw: AV.result, rawAxis: a, result: '#50', radius: '#6', compEnable: true,
                compNote: 'Edge = trigger +/- stylus radius',
            }),
        ];
    };
    const adFork = (fn) => (superset ? AXES.map((a) => GUARD({ param: 'axis', is: a }, DIRS.map((d) => GUARD({ param: 'dir', is: d }, fn(a, d))))) : fn(axis, dir));
    // the WCS write — the address OFFSET forks on axis (#[#70+0]/#[#70+1]); the target LABEL forks on wcs. axis×wcs.
    // DIRECT mode: Expert `#[#70+off]=#50` (byte-identical); V4.1/DM500 `G90 G92 <axis>#50` (via setWorkOffset).
    const wcsWriteArm = (a, w) => [mkWcsWrite({ axis: a, wcs: wcsArgOf(w), offset: AX[a].off, value: '#50', note: `Set ${wcsLabelOf(w)} ${a} to edge`, direct: true })];
    const wcsWriteFork = superset
        ? AXES.map((a) => GUARD({ param: 'axis', is: a }, WCS_VALUES.map((w) => GUARD({ param: 'wcs', is: w }, wcsWriteArm(a, w)))))
        : wcsWriteArm(axis, wcs);

    C('Motion Variables');
    A('#1', dist, 'Max probe distance'); A('#2', retract, 'Retract distance');
    A('#3', fFast, 'Fast feedrate'); A('#4', fSlow, 'Slow feedrate'); A('#5', port, 'Probe port');
    A('#6', radius, 'Probe stylus radius');
    C('Result storage'); A('#50', 0, 'Edge contact position');
    C('Pre-calculated motion values');
    A('#7', '[0-#1]', 'Negative max probe'); A('#8', '#1', 'Positive max probe');
    A('#9', '[0-#2]', 'Negative retract'); A('#10', '#2', 'Positive retract');
    S.push(...wcsFork((w) => [mkWcsBase(w)]));
    C('Confirm Start');
    S.push(...adFork((a, d) => probeArm(a, d)));
    C('Write to WCS');
    S.push(...wcsWriteFork);
    DM('abs'); HMI('-5000', 'Edge found'); GO(2);
    LB(1); DM('abs'); HMI(1, 'Probe failed - no contact');
    LB(2); END();
    return S;
}

export class EdgeWizard {
    generate(params) {
        recordOp('edge', params);   // let the Blocks tab open this op as its stack
        return emitMapped(edgeStack(params), activeDialectOpts()).text;   // a snippet: no Program Start/End blocks
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
