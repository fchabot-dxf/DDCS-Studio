/**
 * DDCS Studio - Rotary Clock Wizard (A0 to a feature) — datum the rotary axis off a FLAT.
 *
 * REWRITTEN AS A BLOCK STACK: `rotaryClockStack(params)` from granular, dialect-aware atoms. Native across
 * posts: probe form, status-check folding, the A-axis DRO read (Read Machine), the A work-offset write (Set
 * WCS Offset) and the confirm gate all come from the active dialect.
 *
 * Method (horizontal 4th axis, spin around X): probe down at point A, step +Y by the span, probe down at B.
 * tilt phi = ATAN[(Zb-Za)/span]. Datum A so the level orientation reads A0 (set / report / rotate).
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { srcVal, srcNote } from './probeBlocks.js';
import { safeZParkBlock, safeZFrameOf } from './ops/safeZframe.js';   // SPATIAL-MODEL 1c: the shared safe-Z FRAME primitive

export function rotaryClockStack(params = {}) {
    const level = num(params.level, 0), span = num(params.span, 20), dist = num(params.dist, 30);
    const retract = num(params.retract, 2), safeZ = num(params.safeZ, 10), fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
    const safeZFrame = safeZFrameOf(params.safeZFrame);   // relative (default, clearance lift) | machine (G53 park at the absolute Z)
    const src = params.sources || {};
    const action = ['set', 'report', 'rotate'].includes(params.action) ? params.action : 'set';
    const refAngle = params.reference === 'side' ? 90 : 0, refLabel = refAngle ? '+Y side (3 o clock)' : 'top (+Z)';
    const refTerm = refAngle ? `-${refAngle}` : '';
    const wcs = params.wcs || 'active', wcsLabel = wcs === 'active' ? 'Active WCS' : wcs;
    const wcsArg = wcs === 'active' ? '#578' : String(parseInt(String(wcs).replace('G', ''), 10) - 53);
    const actLabel = action === 'report' ? 'measure only' : action === 'rotate' ? 'rotate to 0' : 'set A0';

    const S = [];
    const C = (t) => { const b = newBlock('comment'); b.params = { text: t }; S.push(b); };
    const A = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; S.push(b); };
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const DM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; S.push(b); };
    const CF = (msg, cancel) => { const b = newBlock('confirm'); b.params = { msg, cancel }; S.push(b); };
    const PR = (axis, to, feed) => { const b = newBlock('probe'); b.params = { axis, to, feed, port: '#5', level }; S.push(b); };
    const CK = (axis, goto) => { const b = newBlock('probecheck'); b.params = { axis, goto }; S.push(b); };
    const RD = (axis, v) => { const b = newBlock('proberead'); b.params = { axis, var: v }; S.push(b); };
    const RM = (axis, v) => { const b = newBlock('readmachine'); b.params = { axis, var: v }; S.push(b); };
    const SWO = (axis, value) => { const b = newBlock('setworkoffset'); b.params = { wcs: wcsArg, axis, value }; S.push(b); };
    const MV = (axis, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [axis.toLowerCase()]: v }; S.push(b); };
    const MSG = (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));

    const ppZdown = (resultVar) => {   // two-pass probe down (Z-)
        PR('Z', '#7', '#3'); CK('Z', 1); MV('Z', '#10');
        PR('Z', '#7', '#4'); CK('Z', 1); RD('Z', resultVar); MV('Z', '#10');
    };

    C(`Rotary clock | ${actLabel} | ref ${refLabel} | span ${span}mm | ${wcsLabel}`);
    C('Indicate a flat: probe two points across it in Y, find tilt, datum A. No centreline needed.');
    C(`Max probe ${dist}mm | Retract ${retract}mm | Safe Z ${safeZ}mm | Fast ${fFast} | Slow ${fSlow}`);
    C('Motion Variables');
    A('#1', dist, 'Max probe distance'); A('#2', srcVal(src.retract, retract), srcNote(src.retract, 'Retract'));
    A('#3', srcVal(src.fastFeed, fFast), srcNote(src.fastFeed, 'Fast feed')); A('#4', fSlow, 'Slow feed');
    A('#5', srcVal(src.port, port), srcNote(src.port, 'Probe port')); A('#6', span, 'Y span between the two flat touches');
    A('#7', '[0-#1]', 'Neg max'); A('#8', '#1', 'Pos max'); A('#9', '[0-#2]', 'Neg retract'); A('#10', '#2', 'Pos retract');
    A('#17', Math.round(safeZ), 'Safe Z');

    C('Confirm Start');
    CF('Position over the flat, near A0. Enter to probe - ESC=cancel', 2);
    DM('inc');
    C('Point A: probe down onto the flat'); ppZdown('#51');
    MV('Z', '#17');                          // retract clear above the flat
    MV('Y', '#6');                           // step across the flat by the span (+Y)
    C('Point B: probe down onto the flat'); ppZdown('#52');
    C('Tilt of the flat (degrees) = atan( dZ / span )');
    // atan2(dZ, span): the TWO-OPERAND form atan[a]/[b] is REQUIRED — Fanuc/DDCS Macro-B and LinuxCNC/grblHAL
    // (interp_read.cc: "atan operation must be in the format atan[..]/[..]"). The `/[#6]` is the 2nd operand, not
    // a divide — do NOT collapse to a single bracket.
    A('#53', 'ATAN[[#52-#51]]/[#6]', 'phi = atan2(Zb-Za, span)');
    RM('A', '#54');                          // current A machine position (dialect DRO)

    if (action === 'report') {
        C('Measure only - A offset left unchanged');
    } else if (action === 'rotate') {
        C(`Rotate the flat to ${refLabel}, then zero A there - SPINS THE PART (verify direction)`);
        A('#58', `[0-#53${refTerm}]`, 'Rotation to reach the reference');
        MV('A', '#58');                      // rotate part to the reference orientation (incremental)
        RM('A', '#59');                      // read A machine pos after the rotate (dialect DRO)
        SWO('A', '#59');                     // set A0 at the reference
    } else {
        C(`Set A0 at ${refLabel} without rotating (verify direction on your machine)`);
        SWO('A', `[#54-#53${refTerm}]`);
    }

    C('Final retract'); S.push(safeZParkBlock(safeZFrame, '#17'));   // SPATIAL-MODEL 1c: frame-aware final park (relative byte-identical | machine G53)
    DM('abs');
    MSG(action === 'report' ? 'Flat tilt #53 deg (measured)' : 'Flat tilt #53 deg - A datum set');
    GO(2);
    LB(1); DM('inc'); MV('Z', '#17'); DM('abs'); A('#1505', '1', 'Probe failed - no contact');
    LB(2); END();
    return S;
}

export class RotaryClockWizard {
    generate(params) {
        recordOp('rotary_clock', params);
        return emitMapped(rotaryClockStack(params)).text;
    }

    /** Preview start (stock frame): above the flat near the top, offset to point A (-Y half of span). */
    inferStart(params, stock) {
        const n = (v, d) => num(v, d);
        const sy = n(stock && stock.y, 76), sz = n(stock && stock.z, 76), span = n(params.span, 20);
        return { x: n(stock && stock.x, 150) / 2, y: sy / 2 - span / 2, z: Math.min(5, sz * 0.5) };
    }
}
