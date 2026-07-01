/**
 * wizards/ops/probeSurface.js — the PROBE-SURFACE BLOCK (a shared sub-builder, not an atom).
 *
 * ONE declared probe primitive that every probe wizard composes instead of hand-rolling its own G31 sequence:
 *   [setup] → fast G31 → check → retract → [slow G31 → check] → RADIUS-COMP(raw → result) → retract → @DDCS marker
 * It RETURNS the atom stack for one touch whose `result` var holds the TRUE (radius-compensated) surface, and emits a
 * self-describing `( @DDCS:1 {"op":"probe-surface", result, axis, dir} )` marker so the sim can read the declared
 * surface (next increment — replaces the dropped Part-2 macro scan). The radius-comp is bundled, ENABLE default ON
 * (correct-by-default, reversible by a flip — see radiuscomp.js).
 *
 * The 1576fee learnerLibrary `probe-surface(-2pass)` snippet is one baked instance of this shape.
 *
 * Order note: the read+comp comes BEFORE the final retract (the wizards' order), so a migration is byte-identical (the
 * trigger #1925 is latched at the probe, so reading it before/after the retract is the same value — functional-identical).
 *
 * params: axis · dir('+'/'-') · probeVar · retractVar · feedFast · feedSlow · port · level · twoPass(=true) ·
 *         raw · result · radius · compEnable(=true) · failGoto(=1) · comment · compNote · stopVar · limitVar · limitVal
 */
import { newBlock } from '../../blocks/blockEmitter.js';

export function probeSurfaceStack(p = {}) {
    const S = [];
    // REPLACE params (don't merge with the atom's defaults) — exactly like the wizards' own helpers, so e.g. a single-axis
    // `move` stays `G0 X#9` (a merge would leak the move atom's y:0/z:0 defaults → `G0 X#9 Y0 Z0`, breaking byte-identicalness).
    const push = (type, params) => { const b = newBlock(type); b.params = { ...params }; S.push(b); };
    const axis = p.axis === 'Y' ? 'Y' : (p.axis === 'Z' ? 'Z' : (p.axis || 'X'));
    const lc = axis.toLowerCase();
    const dir = p.dir === '-' ? '-' : '+';
    const port = p.port || '#5', level = p.level ?? 0, failGoto = p.failGoto ?? 1;

    if (p.comment) push('comment', { text: p.comment });
    if (p.stopVar) push('assign', { var: p.stopVar, value: '0', note: 'Stop mode: decelerate' });
    if (p.limitVar) push('assign', { var: p.limitVar, value: String(p.limitVal ?? ''), note: 'Limit protect' });

    push('probe', { axis, to: p.probeVar, feed: p.feedFast, port, level });   // fast find
    push('probecheck', { axis, goto: failGoto });
    push('move', { mode: 'rapid', [lc]: p.retractVar });                       // retract before the slow re-probe
    if (p.twoPass !== false) {                                                 // slow accurate re-probe
        push('probe', { axis, to: p.probeVar, feed: p.feedSlow, port, level });
        push('probecheck', { axis, goto: failGoto });
    }
    // optional pre-comp setup the wizard needs right before the comp (e.g. an indirect result address `#73=[#70+2]`)
    (p.preComp || []).forEach((a) => push('assign', { var: a.var, value: String(a.value), note: a.note || '' }));
    // READ + RADIUS-COMP → the TRUE surface (one line; byte-identical with the legacy assign #result=[#raw±#6])
    push('radiuscomp', { raw: p.raw, result: p.result, radius: p.radius || '#6', dir, enable: p.compEnable !== false, note: p.compNote || 'surface = trigger +/- stylus radius' });
    // final retract (after the read) — default ON (edge); a wizard that retracts AFTER its OWN WCS write sets trailingRetract:false
    if (p.trailingRetract !== false) push('move', { mode: 'rapid', [lc]: p.retractVar });

    // NOTE (t131): the surface DECLARATION for the sim must NOT live as a `( @DDCS … )` comment in the emitted G-code — that
    // lands in the EDITOR text and violates "Option B" (the editor stays clean; op info comes from the program model, not
    // editor markers — see editor-sim-real-insert.spec). So the inc2 sim-consumes-the-surface mechanism is SIM-SIDE (read the
    // op stack's radiuscomp result), not an editor marker. Marker emit removed; opSchema's `probe-surface` entry kept for inc2.
    return S;
}

/**
 * safeTraverseStack — a shared traverse block for moving between probe passes (in-axis or trans-axis).
 * Handles the standard sequence: [optional lift] → move → [optional drop]
 *
 * @param p.mode - 'in-axis' (1D jump), 'center' (2D dynamic re-center), or 'seq' (2D fixed dog-leg/diagonal)
 * @param p.axis, p.second - primary and secondary axes ('X' or 'Y')
 * @param p.lift, p.drop - variables/expressions for Z lift and drop (e.g. '#18', '[0-#18]')
 * @param p.comment - comment to emit before the traverse
 *
 * Mode 'in-axis' params: p.move (e.g. '#19')
 * Mode 'center' params: p.dir1Plus, p.dir2Plus, p.diagPrimary ('#22'), p.diagTravel ('#21'), p.wall2Var ('#52'), p.radiusVar ('#6'), p.lastRetract
 * Mode 'seq' params: p.crossX, p.crossY (e.g. '#23', '#24')
 */
export function safeTraverseStack(p = {}) {
    const S = [];
    const push = (type, params) => { const b = newBlock(type); b.params = { ...params }; S.push(b); };
    const axis = p.axis || 'X';
    const second = p.second || 'Y';
    const alc = axis.toLowerCase(), slc = second.toLowerCase();

    if (p.mode === 'center') {
        const lastRetract = p.lastRetract || (p.dir1Plus ? '#10' : '#9');
        push('assign', { var: '#22', value: String(p.diagPrimary), note: `Diag primary: the diagonal ${axis} target — #53 (re-centre, measured NOW) at rest, or ②.${axis} when the ② marker is placed` });
        const pmove = `[#22-${p.wall2Var}-${lastRetract}${p.dir1Plus ? '-'+p.radiusVar : '+'+p.radiusVar}]`;
        const smove = p.dir2Plus ? `[0-${p.diagTravel}]` : String(p.diagTravel); // travelOpp logic
        if (p.lift) push('move', { mode: 'rapid', z: p.lift });
        push('move', { mode: 'rapid', [alc]: pmove, [slc]: smove });
        if (p.drop) push('move', { mode: 'rapid', z: p.drop });
        if (p.comment) push('comment', { text: p.comment });
        push('distmode', { dist: 'inc' });
    } else if (p.mode === 'seq') {
        if (p.comment) push('comment', { text: p.comment });
        if (p.lift) push('move', { mode: 'rapid', z: p.lift });
        push('move', { mode: 'rapid', x: String(p.crossX), y: String(p.crossY) });
        if (p.drop) push('move', { mode: 'rapid', z: p.drop });
    } else if (p.mode === 'in-axis') {
        if (p.lift) push('move', { mode: 'rapid', z: p.lift });
        push('move', { mode: 'rapid', [alc]: String(p.move) });
        if (p.drop) push('move', { mode: 'rapid', z: p.drop });
        if (p.comment) push('comment', { text: p.comment });
        push('distmode', { dist: 'inc' });
    }
    return S;
}
