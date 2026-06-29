/**
 * DDCS Studio - Rotary Centreline Wizard (4th-axis setup) — A-axis centreline + radius of a cylinder on a
 * horizontal 4th axis. Sets Y0 on the centreline, Z0 on the centreline OR the OD top.
 *
 * REWRITTEN AS A BLOCK STACK: `rotaryCenterStack(params)` from granular, dialect-aware atoms. Native across
 * posts: probe form, status-check folding, the Y/Z DRO reads (Read Machine), the WCS writes (Set WCS Offset)
 * and the confirm/reposition gates all come from the active dialect.
 *
 *   known — enter the blank diameter; probe top + ±Y. Yc = midpoint of flanks; Zc = top − R. 3 touches.
 *   fit   — no diameter: probe 3 points on the Y-Z circle and solve centre + R. ADVANCED — verify on machine.
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { srcVal, srcNote } from './probeBlocks.js';
import { opSimStarts } from '../viz/opSimStarts.js';

export function rotaryCenterStack(params = {}) {
    const method = params.method === 'fit' ? 'fit' : 'known';
    const approach = params.approach === 'guided' ? 'guided' : 'auto';   // known-method flanks: hands-free cycle vs operator-jogged
    const datum = params.datum === 'top' ? 'top' : 'center';
    const level = num(params.level, 0), diameter = num(params.diameter, 76.2), dist = num(params.dist, 30);
    const retract = num(params.retract, 2), safeZ = num(params.safeZ, 15), fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
    const radius = num(params.radius, 2);   // stylus tip radius (#6) — the Z-down top probe lands a radius high, so Zc subtracts it (Yc bisect cancels)
    const src = params.sources || {};
    const wcs = params.wcs || 'active', wcsLabel = wcs === 'active' ? 'Active WCS' : wcs;
    const wcsArg = wcs === 'active' ? '#578' : String(parseInt(String(wcs).replace('G', ''), 10) - 53);

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
    const MM = (axis, to) => { const b = newBlock('machinemove'); b.params = { axis, to }; S.push(b); };
    const SWO = (axis, value) => { const b = newBlock('setworkoffset'); b.params = { wcs: wcsArg, axis, value }; S.push(b); };
    const MV = (axis, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [axis.toLowerCase()]: v }; S.push(b); };
    const MSG = (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); };
    const END = () => S.push(newBlock('endprogram'));

    const pp = (axis, plus, resultVar) => {
        const pv = plus ? '#8' : '#7', rv = plus ? '#9' : '#10';
        PR(axis, pv, '#3'); CK(axis, 1); MV(axis, rv);
        PR(axis, pv, '#4'); CK(axis, 1); RD(axis, resultVar); MV(axis, rv);
    };
    const reposition = (msg) => {
        // Lift clear, operator jogs to the flank, then drop back the SAME amount — all INCREMENTAL (no G53).
        // Keeping the fit start-anchored lets the preview fan the 3 passes out to their own markers; a G53 here
        // would mark the whole trace absolute and the 3 probe paths would collapse onto the macro's machine coords.
        // Assumes the operator jogs in Y only (the "move clear to the +/-Y side" prompt), so the symmetric Z drop
        // returns to the prior height. (Was: RM #57 machine-Z save + G53 restore.)
        MV('Z', '#17');
        C(`REPOSITION: ${msg}`);
        CF('Press Enter when repositioned - ESC=cancel', 2);
        MV('Z', '[0-#17]'); DM('inc');
    };

    C(`Rotary centreline | ${method === 'fit' ? '3-point fit' : 'known dia ' + diameter} | Z0 at ${datum === 'top' ? 'OD top' : 'centreline'} | ${wcsLabel}`);
    C('Horizontal 4th axis: spin X -> probe top in Z, flanks in Y. Centreline runs along X.');
    C(`Max probe ${dist}mm | Retract ${retract}mm | Safe Z ${safeZ}mm | Fast ${fFast} | Slow ${fSlow}`);
    C('Motion Variables');
    A('#1', dist, 'Max probe distance'); A('#2', srcVal(src.retract, retract), srcNote(src.retract, 'Retract'));
    A('#3', srcVal(src.fastFeed, fFast), srcNote(src.fastFeed, 'Fast feed')); A('#4', fSlow, 'Slow feed');
    A('#5', srcVal(src.port, port), srcNote(src.port, 'Probe port'));
    A('#7', '[0-#1]', 'Neg max'); A('#8', '#1', 'Pos max'); A('#9', '[0-#2]', 'Neg retract'); A('#10', '#2', 'Pos retract');
    A('#17', Math.round(safeZ), 'Safe Z');

    C('Confirm Start');
    CF('Press Enter to probe - ESC=cancel', 2);
    DM('inc');

    if (method === 'known') {
        C(`=== Known diameter: top + two flanks (${approach === 'auto' ? 'auto-centring' : 'operator-guided'}) ===`);
        A('#55', `${diameter}/2`, 'R = known diameter / 2');
        A('#6', radius, 'Probe stylus radius');   // declared ONE source for the Z-surface comp
        A('#11', '[#55+#2+#6]', 'Flank approach = R + retract + stylus radius (the tool CENTRE must clear the OD by retract — the tip sticks out r)');
        // A solid bar can't be probed from its axis — approach each flank from OUTSIDE at the centreline.
        // Traverses run at a SAFE height clear above the bar (#17 over the top, so the rapid never skims the OD);
        // drops land beside the bar in free space. #11 = R+retract = lateral offset (clears the OD); #12 = safeZ+R
        // = the drop from the traverse height down to the centreline. GUIDED = the same motion + a confirm gate
        // before each touch (operator verifies / fine-jogs); AUTO runs hands-free. Both simulate identically.
        const gate = (msg) => { if (approach === 'guided') CF(msg, 2); };
        A('#12', '[#17+#55]', 'Traverse height -> centreline drop = safeZ + R');
        C('Probe top (Z down)'); pp('Z', false, '#50');
        MV('Z', '[#17-#2]');         // lift from the top (Ztop+retract) to the safe traverse height (Ztop+safeZ)
        C('+Y flank: cross clear to the +Y side, drop to the centreline, probe inward');
        MV('Y', '#11');              // over to the +Y side, beyond the OD (well above the top)
        MV('Z', '[0-#12]');          // drop to the centreline (Ztop - R), beside the bar
        gate('At the +Y side, centreline height - Enter to probe (jog to adjust), ESC=cancel');
        pp('Y', false, '#52');       // probe -Y -> the +Y OD surface
        C('-Y flank: raise clear, cross to the -Y side, drop, probe inward');
        MV('Z', '#12');              // raise back to the traverse height
        MV('Y', '[0-#11-#11]');      // cross to the -Y side, beyond the OD (well above the top)
        MV('Z', '[0-#12]');          // drop to the centreline
        gate('At the -Y side, centreline height - Enter to probe (jog to adjust), ESC=cancel');
        pp('Y', true, '#53');        // probe +Y -> the -Y OD surface
        MV('Z', '#12');              // raise clear of the bar before the final retract
        C('Centre + radius');
        A('#54', '[#52+#53]/2', 'Yc = midpoint of flanks');
        A('#56', '[#50-#6-#55]', 'Zc = top - R (− stylus radius: the Z-down top contact is the tool centre a radius above the OD)');
    } else {
        C('=== 3-point circle fit (no diameter) === ADVANCED: verify on machine');
        C('Point 1: top (capture Z trigger + current Y)'); pp('Z', false, '#51');
        RM('Y', '#52');                      // P1 Y (machine)
        reposition('move clear to the +Y side of the cylinder');
        C('Point 2: +Y flank (capture Y trigger + current Z)'); pp('Y', true, '#53');
        RM('Z', '#54');                      // P2 Z (machine)
        reposition('move clear to the -Y side of the cylinder');
        C('Point 3: -Y flank (capture Y trigger + current Z)'); pp('Y', false, '#55');
        RM('Z', '#56');                      // P3 Z (machine)
        C('Solve circle through P1(#52,#51) P2(#53,#54) P3(#55,#56) [a=Y b=Z]');
        A('#60', '[#52*#52]+[#51*#51]', '|P1|^2');
        A('#61', '[#53*#53]+[#54*#54]', '|P2|^2');
        A('#62', '[#55*#55]+[#56*#56]', '|P3|^2');
        A('#63', '2*[[#52*[#54-#56]]+[#53*[#56-#51]]+[#55*[#51-#54]]]', 'd (twice signed area)');
        A('#54', '[[#60*[#54-#56]]+[#61*[#56-#51]]+[#62*[#51-#54]]]/#63', 'Yc');
        A('#56', '[[#60*[#55-#53]]+[#61*[#52-#55]]+[#62*[#53-#52]]]/#63', 'Zc');
        A('#55', 'SQRT[[[#52-#54]*[#52-#54]]+[[#51-#56]*[#51-#56]]]', 'R');
        A('#50', '[#56+#55]', 'OD top = Zc + R');
    }

    C('Final retract'); MV('Z', '#17');
    C(`Write work origin (Z0 at ${datum === 'top' ? 'OD top' : 'centreline'})`);
    SWO('Y', '#54');                         // Y0 to centreline
    SWO('Z', datum === 'top' ? '#50' : '#56');

    DM('abs');
    MSG('Centreline Y#54 Z#56 - R#55');
    GO(2);
    LB(1); DM('inc'); MV('Z', '#17'); DM('abs'); A('#1505', '1', 'Probe failed - no contact');
    LB(2); END();
    return S;
}

export class RotaryCenterWizard {
    generate(params) {
        recordOp('rotary_center', params);
        return emitMapped(rotaryCenterStack(params)).text;
    }

    /** Preview start (stock frame): above the cylinder top, centred, ready to probe down. */
    inferStart(params, stock) {
        return this.inferStarts(params, stock)[0];
    }

    // Per-pass preview starts → the shared sim-start registry (viz/opSimStarts.js, BUILT_IN.rotary_center). Moved verbatim.
    inferStarts(params, stock) { return opSimStarts('rotary_center', params, stock); }
}
