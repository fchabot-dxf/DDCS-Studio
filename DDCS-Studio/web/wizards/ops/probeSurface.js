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
    push('radiuscomp', { raw: p.raw, result: p.result, radius: p.radius || '#6', dir, enable: p.compEnable !== false, spaced: !!p.spaced, note: p.compNote || 'surface = trigger +/- stylus radius' });
    // final retract (after the read) — default ON (edge); a wizard that retracts AFTER its OWN WCS write sets trailingRetract:false
    if (p.trailingRetract !== false) push('move', { mode: 'rapid', [lc]: p.retractVar });

    // NOTE (t131): the surface DECLARATION for the sim must NOT live as a `( @DDCS … )` comment in the emitted G-code — that
    // lands in the EDITOR text and violates "Option B" (the editor stays clean; op info comes from the program model, not
    // editor markers — see editor-sim-real-insert.spec). So the inc2 sim-consumes-the-surface mechanism is SIM-SIDE (read the
    // op stack's radiuscomp result), not an editor marker. Marker emit removed; opSchema's `probe-surface` entry kept for inc2.
    return S;
}
