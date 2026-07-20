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
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { num } from './ops/util.js';
import { probeSurfaceStack } from './ops/probeSurface.js';   // the shared probe primitive (rotary composes it — t129 inc1)
import { safeRetractNode } from './ops/safeZframe.js';   // t822 machine-frame safe-height retract; t951 park-sweep — the final park now also takes MAX safe height (retired the relative-frame crash class)
import { srcVal, srcNote } from './probeBlocks.js';
import { opSimStarts } from '../viz/opSimStarts.js';

/** The 3 interpolated SUMMARY comments (the 2 header lines + the write-origin line) — extracted to ONE format so the data-op
 *  twin's postInstantiate can RECOMPOSE them from the resolved params (cornerHeaderComments precedent), keeping twin==built-in
 *  byte-identical for ALL scalars + the datum/wcs value-swaps (E1). Must reproduce the inline text byte-for-byte (same num()+defaults). */
export function rotaryCenterHeaderComments(params = {}) {
    const method = params.method === 'fit' ? 'fit' : 'known';
    const approach = params.approach === 'guided' ? 'guided' : 'auto';
    const diameter = num(params.diameter, 76.2), dist = num(params.dist, 30);
    const retract = num(params.retract, 2), safeZ = num(params.safeZ, 15), fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50);
    const datum = params.datum === 'top' ? 'top' : 'center';
    const wcs = params.wcs || 'active', wcsLabel = wcs === 'active' ? 'Active WCS' : wcs;
    return {
        top1: `Rotary centreline | ${method === 'fit' ? '3-point fit' : 'known dia ' + diameter} | Z0 at ${datum === 'top' ? 'OD top' : 'centreline'} | ${wcsLabel}`,
        top3: `Max probe ${dist}mm | Retract ${retract}mm | Safe Z ${safeZ}mm | Fast ${fFast} | Slow ${fSlow}`,
        knownHeader: `=== Known diameter: top + two flanks (${approach === 'auto' ? 'auto-centring' : 'operator-guided'}) ===`,   // KNOWN arm only; interpolates approach
        writeOrigin: `Write work origin (Z0 at ${datum === 'top' ? 'OD top' : 'centreline'})`,
    };
}

export function rotaryCenterStack(params = {}, opts = {}) {
    const method = params.method === 'fit' ? 'fit' : 'known';
    const approach = params.approach === 'guided' ? 'guided' : 'auto';   // known-method flanks: hands-free cycle vs operator-jogged
    const datum = params.datum === 'top' ? 'top' : 'center';
    const level = num(params.level, 0), diameter = num(params.diameter, 76.2), dist = num(params.dist, 30);
    const retract = num(params.retract, 2), safeZ = num(params.safeZ, 15), fFast = num(params.f_fast, 200), fSlow = num(params.f_slow, 50), port = num(params.port, 3);
    const radius = num(params.radius, 2);   // stylus tip radius (#6) — the Z-down top probe lands a radius high, so Zc subtracts it (Yc bisect cancels)
    const src = params.sources || {};
    const wcs = params.wcs || 'active';   // wcsLabel moved into rotaryCenterHeaderComments (the shared header format)
    const wcsArg = wcs === 'active' ? '#578' : String(parseInt(String(wcs).replace('G', ''), 10) - 53);

    const superset = !!opts.superset;   // E0 — seed the data-TWIN with BOTH method/approach arms present (each guarded) so pruneGuards collapses to a concrete shape

    const S = [];
    // Returning block factories (return ONE block) — the FORK arms compose these; the LINEAR parts push via the C/A/… wrappers.
    const mkC = (t) => { const b = newBlock('comment'); b.params = { text: t }; return b; };
    const mkA = (v, val, note) => { const b = newBlock('assign'); b.params = { var: v, value: String(val), note: note || '' }; return b; };
    const mkDM = (m) => { const b = newBlock('distmode'); b.params = { dist: m }; return b; };
    const mkCF = (msg, cancel) => { const b = newBlock('confirm'); b.params = { msg, cancel }; return b; };
    const mkRM = (axis, v) => { const b = newBlock('readmachine'); b.params = { axis, var: v }; return b; };
    const mkSWO = (axis, value) => { const b = newBlock('setworkoffset'); b.params = { wcs: wcsArg, axis, value }; return b; };
    const mkMV = (axis, v) => { const b = newBlock('move'); b.params = { mode: 'rapid', [axis.toLowerCase()]: v }; return b; };
    // Push wrappers for the LINEAR (non-fork) sections.
    const C = (t) => S.push(mkC(t)), A = (v, val, note) => S.push(mkA(v, val, note)), DM = (m) => S.push(mkDM(m)), CF = (msg, c) => S.push(mkCF(msg, c));
    const SWO = (axis, value) => S.push(mkSWO(axis, value)), MV = (axis, v) => S.push(mkMV(axis, v));
    const GO = (n) => { const b = newBlock('goto'); b.params = { n }; S.push(b); };
    const LB = (n) => { const b = newBlock('label'); b.params = { n }; S.push(b); };
    const MSG = (text) => { const b = newBlock('message'); b.params = { text }; S.push(b); };
    const HMI = (value, note) => { const b = newBlock('hmiline'); b.params = { value: String(value), note: note || '', var: '#1505' }; S.push(b); };   // Expert #1505 note / off-HMI a comment
    const END = () => S.push(newBlock('endprogram'));

    // ── SUPERSET fork helpers (E0, mirroring middleStack) — each RETURNS the arm block(s): superset → guarded arms; concrete
    // → the selected arm. rotary has ONLY TWO structural forks (block-shape): method(known|fit) + the approach(auto|guided)
    // confirm gate NESTED in known. datum / wcs / safeZFrame are VALUE swaps (same block shape, different value) → NOT guarded.
    const GUARD = (when, kids) => { const b = newBlock('guard'); b.params = { when }; b.children = kids; return b; };
    const methodFork = (knownKids, fitKids) => superset ? [GUARD({ param: 'method', is: 'known' }, knownKids), GUARD({ param: 'method', is: 'fit' }, fitKids)] : (method === 'fit' ? fitKids : knownKids);
    const approachGuided = (kids) => superset ? [GUARD({ param: 'approach', is: 'guided' }, kids)] : (approach === 'guided' ? kids : []);

    // One probe touch via the shared PROBE-SURFACE BLOCK (t129). KNOWN: comp ON → the touch returns the TRUE surface
    // (top/flanks), so Zc drops its inline −#6 (value-identical) and datum='top' lands on the true OD top (the OD-top FIX).
    // FIT: comp OFF (raw) — the solver wants the tool-centre points unchanged (value-identical; the brackets are cosmetic).
    // RETURNS the touch blocks (the fork arms compose them).
    const TRIG = { X: '#1925', Y: '#1926', Z: '#1927' };
    const touchR = (axis, plus, resultVar, comp) => probeSurfaceStack({
        axis, dir: plus ? '+' : '-', probeVar: plus ? '#8' : '#7', retractVar: plus ? '#9' : '#10',
        feedFast: '#3', feedSlow: '#4', port: '#5', level, twoPass: true,
        raw: TRIG[axis], rawAxis: axis, result: resultVar, radius: '#6', compEnable: comp,   // rawAxis → trigger folds per post
    });
    const repositionR = (msg) => [
        // t824/t826 — the retreat-to-clear before the operator jogs was an incremental G0 Z#17 lift (compounds into the top
        // switch from a high start). It now retracts to the DECLARED MACHINE MARGIN (safeRetractNode → G53, limit-proof); the
        // sim preview MODELS this mid-program G53 (t826), so the 3 probe passes still fan out to their own start markers (each
        // pass stays anchored — the G53 is a local excursion, not a whole-trace absolute flip). The jog + the −#17 drop-back
        // (now descending from the margin) are unchanged.
        safeRetractNode({ restore: 'inc' }), mkC(`REPOSITION: ${msg}`), mkCF('Press Enter when repositioned - ESC=cancel', 2), mkMV('Z', '[0-#17]'), mkDM('inc'),   // t856 — reposition lift is inside the G91 body → G90-wrap, restore G91
    ];

    const _hdr = rotaryCenterHeaderComments(params);   // ONE format, shared with the twin's postInstantiate recompose
    C(_hdr.top1);
    C('Horizontal 4th axis: spin X -> probe top in Z, flanks in Y. Centreline runs along X.');
    C(_hdr.top3);
    C('Motion Variables');
    A('#1', dist, 'Max probe distance'); A('#2', srcVal(src.retract, retract), srcNote(src.retract, 'Retract'));
    A('#3', srcVal(src.fastFeed, fFast), srcNote(src.fastFeed, 'Fast feed')); A('#4', fSlow, 'Slow feed');
    A('#5', srcVal(src.port, port), srcNote(src.port, 'Probe port'));
    A('#7', '[0-#1]', 'Neg max'); A('#8', '#1', 'Pos max'); A('#9', '[0-#2]', 'Neg retract'); A('#10', '#2', 'Pos retract');
    A('#17', safeZ, 'Safe Z');   // E0 RESTRUCTURE #2 — drop the build-time Math.round(safeZ): a value binding on #17 must land the raw value (byte-identical at the integer default)

    C('Confirm Start');
    CF('Press Enter to probe - ESC=cancel', 2);
    DM('inc');

    A('#6', radius, 'Probe stylus radius — declared ONE source for the OD comp (both methods)');

    // ── KNOWN arm: top + two flanks (a solid bar can't be probed from its axis — approach each flank from OUTSIDE at the
    // centreline; traverses run clear above the bar). GUIDED adds a confirm gate before each touch; AUTO runs hands-free.
    const knownKids = [
        mkC(_hdr.knownHeader),   // interpolates approach — RECOMPOSED in the twin (value-swap)
        mkA('#57', diameter, 'Known diameter'),   // E0 RESTRUCTURE #1 — dissolve #55=dia/2 → diameter is a single socket (#57) for the E1 value binding
        mkA('#55', '[#57/2]', 'R = known diameter / 2'),
        mkA('#11', '[#55+#2+#6]', 'Flank approach = R + retract + stylus radius (the tool CENTRE must clear the OD by retract — the tip sticks out r)'),
        mkA('#12', '[#17+#55]', 'Traverse height -> centreline drop = safeZ + R'),
        mkC('Probe top (Z down)'), ...touchR('Z', false, '#50', true),   // comp ON → #50 = the TRUE OD top (was raw — the OD-top gap)
        mkMV('Z', '[#17-#2]'),         // lift from the top (Ztop+retract) to the safe traverse height (Ztop+safeZ)
        mkC('+Y flank: cross clear to the +Y side, drop to the centreline, probe inward'),
        mkMV('Y', '#11'),              // over to the +Y side, beyond the OD (well above the top)
        mkMV('Z', '[0-#12]'),          // drop to the centreline (Ztop - R), beside the bar
        ...approachGuided([mkCF('At the +Y side, centreline height - Enter to probe (jog to adjust), ESC=cancel', 2)]),
        ...touchR('Y', false, '#52', true),   // probe -Y -> the +Y OD surface (comped; the ∓#6 cancels in the Yc bisect)
        mkC('-Y flank: raise clear, cross to the -Y side, drop, probe inward'),
        mkMV('Z', '#12'),              // raise back to the traverse height
        mkMV('Y', '[0-#11-#11]'),      // cross to the -Y side, beyond the OD (well above the top)
        mkMV('Z', '[0-#12]'),          // drop to the centreline
        ...approachGuided([mkCF('At the -Y side, centreline height - Enter to probe (jog to adjust), ESC=cancel', 2)]),
        ...touchR('Y', true, '#53', true),    // probe +Y -> the -Y OD surface (comped; bisect cancels)
        mkMV('Z', '#12'),              // raise clear of the bar before the final retract
        mkC('Centre + radius'),
        mkA('#54', '[#52+#53]/2', 'Yc = midpoint of flanks'),
        mkA('#56', '[#50-#55]', 'Zc = top - R (top already radius-compensated by the block; the inline −#6 relocated → value-identical)'),
    ];
    // ── FIT arm: 3-point circle fit (no diameter) — probe 3 points on the Y-Z circle, solve centre + R. ADVANCED (Studio-
    // original, machine-UNVALIDATED — the ADVANCED banner STAYS). comp ON → the solver fits the TRUE OD circle.
    const fitKids = [
        mkC('=== 3-point circle fit (no diameter) === ADVANCED: verify on machine'),
        mkC('Point 1: top (capture Z trigger + current Y)'), ...touchR('Z', false, '#51', true),
        mkRM('Y', '#52'),                      // P1 Y (machine)
        ...repositionR('move clear to the +Y side of the cylinder'),
        mkC('Point 2: +Y flank (capture Y trigger + current Z)'), ...touchR('Y', true, '#53', true),
        mkRM('Z', '#54'),                      // P2 Z (machine)
        ...repositionR('move clear to the -Y side of the cylinder'),
        mkC('Point 3: -Y flank (capture Y trigger + current Z)'), ...touchR('Y', false, '#55', true),
        mkRM('Z', '#56'),                      // P3 Z (machine)
        mkC('Solve circle through the comped surface points P1(#52,#51) P2(#53,#54) P3(#55,#56) [a=Y b=Z]'),
        mkA('#60', '[#52*#52]+[#51*#51]', '|P1|^2'),
        mkA('#61', '[#53*#53]+[#54*#54]', '|P2|^2'),
        mkA('#62', '[#55*#55]+[#56*#56]', '|P3|^2'),
        mkA('#63', '2*[[#52*[#54-#56]]+[#53*[#56-#51]]+[#55*[#51-#54]]]', 'd (twice signed area)'),
        mkA('#54', '[[#60*[#54-#56]]+[#61*[#56-#51]]+[#62*[#51-#54]]]/#63', 'Yc'),
        mkA('#56', '[[#60*[#55-#53]]+[#61*[#52-#55]]+[#62*[#53-#52]]]/#63', 'Zc'),
        mkA('#55', 'SQRT[[[#52-#54]*[#52-#54]]+[[#51-#56]*[#51-#56]]]', 'R (the TRUE OD radius — the points are comped)'),
        mkA('#50', '[#56+#55]', 'OD top = Zc + R (the TRUE OD top — points comped, no stylus-radius gap)'),
    ];
    S.push(...methodFork(knownKids, fitKids));

    // FINAL retract/park via the DECLARED safe-Z frame: relative → MV('Z','#17') BYTE-IDENTICAL; machine → G53 Z#17 (park at
    // the absolute machine Z). #17 = the user's safe-Z value, interpreted per the frame (a clearance, or the absolute Z).
    C('Final retract'); S.push(safeRetractNode({ restore: 'inc' }));   // t951 park-sweep — final park to MAX safe height (per-post margin; DM500 work-frame #17). t856 — inside the G91 body → G90-wrap the G53, restore G91. Was safeZParkBlock relative = the crash class
    C(_hdr.writeOrigin);
    SWO('Y', '#54');                         // Y0 to centreline
    SWO('Z', datum === 'top' ? '#50' : '#56');

    DM('abs');
    MSG('Centreline Y#54 Z#56 - R#55');
    GO(2);
    LB(1); S.push(safeRetractNode()); HMI('1', 'Probe failed - no contact');   // t822 — machine-frame G53 retract (was G91/G0 Z#17/G90 — incremental crash vector)
    LB(2); END();
    return S;
}

export class RotaryCenterWizard {
    generate(params) {
        recordOp('rotary_center', params);
        return emitMapped(rotaryCenterStack(params), activeDialectOpts()).text;
    }

    /** Preview start (stock frame): above the cylinder top, centred, ready to probe down. */
    inferStart(params, stock) {
        return this.inferStarts(params, stock)[0];
    }

    // Per-pass preview starts → the shared sim-start registry (viz/opSimStarts.js, BUILT_IN.rotary_center). Moved verbatim.
    inferStarts(params, stock) { return opSimStarts('rotary_center', params, stock); }
}
