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
 *         raw · rawAxis(opt-in: dialect trigger reg per post) · result · radius · compEnable(=true) · failGoto(=1) · comment · compNote · stopVar · limitVar · limitVal
 */
import { newBlock } from '../../blocks/blockEmitter.js';
import { safeRetractNode, saveMachineZNode, safeZParkBlock, safeHopNode, planeLiftNodes } from './safeZframe.js';   // t826 — opt-in machine-frame safe-height lift (safeTraverseStack machineLift); t897 — the paired save/return for a machine-lift traverse; t913 — the hop/plane clearance modes

/**
 * t1085 — the scratch THIS composer injects, declared where the injection happens (it is a stack builder, not a palette
 * def, so it has no `def.scratch` to carry it). data/universalScratch.js aggregates this with the palette defs and the
 * active dialect so a UNIVERSAL slot's field vars can be minted AROUND it. Read off the assignments below, not prose:
 *   #5      the default probe port (`p.port || '#5'`)
 *   #6      the tool-radius var handed to radiuscomp (`p.radius || '#6'`)
 *   #9/#10  the default last-retract var (`p.dir1Plus ? '#10' : '#9'`)
 *   #22     WRITTEN outright — `push('assign', { var: '#22', … })` for the diagonal-primary travel
 */
export const PROBE_SURFACE_SCRATCH = [[5, 6], [9, 10], [22, 22]];

export function probeSurfaceStack(p = {}) {
    const S = [];
    // REPLACE params (don't merge with the atom's defaults) — exactly like the wizards' own helpers, so e.g. a single-axis
    // `move` stays `G0 X#9` (a merge would leak the move atom's y:0/z:0 defaults → `G0 X#9 Y0 Z0`, breaking byte-identicalness).
    const push = (type, params) => { const b = newBlock(type); b.params = { ...params }; S.push(b); };
    const axis = p.axis === 'Y' ? 'Y' : (p.axis === 'Z' ? 'Z' : (p.axis || 'X'));
    const lc = axis.toLowerCase();
    const dir = p.dir === '-' ? '-' : '+';
    const port = p.port || '#5', level = p.level ?? 0, failGoto = p.failGoto ?? 1;
    // t638 — the probe-MISS check. On STATUS-VAR posts (Expert) probecheck is `IF #192x!=2 GOTO<fail>`. On DRO-COMPARE posts
    // (V4.1/DM500 — no status var) a MISS is caught by capturing the pre-probe DRO (probestart) then testing whether the axis
    // reached the FULL commanded travel (start + seek) within `eps` → branch to the SAME <failGoto>. `eps` is a DECLARED
    // tolerance (default 0.05mm — a real touch inside the last eps of travel reads as a miss; inherent to DRO-compare). probestart
    // folds to [] on Expert, so Expert is byte-identical. dir + seek(=probeVar) drive the compare direction.
    const eps = p.eps ?? 0.05;

    if (p.comment) push('comment', { text: p.comment });
    // G31 stop-mode / limit-protection preamble via the profile-aware probeguard atom: Expert emits #1905=0/#1915=<v>
    // (byte-identical), posts whose probe form doesn't consume them (V4.1/DM500) fold to [].
    if (p.stopVar || p.limitVar) push('probeguard', { stopVar: p.stopVar || '', limitVar: p.limitVar || '', limitVal: p.limitVal ?? '' });

    push('probestart', { axis });                                             // capture the pre-probe DRO (V4.1/DM500; [] on Expert)
    push('probe', { axis, to: p.probeVar, feed: p.feedFast, port, level });   // fast find
    push('probecheck', { axis, goto: failGoto, dir, seek: p.probeVar, eps }); // miss → GOTO <fail>
    push('move', { mode: 'rapid', [lc]: p.retractVar });                       // retract before the slow re-probe
    if (p.twoPass !== false) {                                                 // slow accurate re-probe
        push('probestart', { axis });
        push('probe', { axis, to: p.probeVar, feed: p.feedSlow, port, level });
        push('probecheck', { axis, goto: failGoto, dir, seek: p.probeVar, eps });
    }
    // skipComp — the caller does the read+comp ITSELF (e.g. the corner Z-surface: the comp is FUSED into the WCS write, which
    // folds per post via the wcswrite atom). We still emit the probe+check above; the caller appends the comped WCS write.
    if (!p.skipComp) {
        // optional pre-comp setup the wizard needs right before the comp (e.g. an indirect result address `#73=[#70+2]`)
        (p.preComp || []).forEach((a) => push('assign', { var: a.var, value: String(a.value), note: a.note || '' }));
        // READ + RADIUS-COMP → the TRUE surface (one line; byte-identical with the legacy assign #result=[#raw±#6]). `rawAxis`
        // (opt-in) lets the comp ask the DIALECT for the trigger register per post (Expert = the same literal → byte-identical).
        push('radiuscomp', { raw: p.raw, rawAxis: p.rawAxis, result: p.result, radius: p.radius || '#6', dir, enable: p.compEnable !== false, note: p.compNote || 'surface = trigger +/- stylus radius' });
    }
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
 * @param p.returnZ - (t897, e.g. '#95') the scratch var for an HONEST machine-lift drop-back. When set, the drop returns
 *   the tool to the machine Z SAVED just before the lift (saveMachineZNode ↔ safeZParkBlock ret) instead of a relative
 *   drop off an absolute lift (which lands an arbitrary Z). Only meaningful where the lift is ABSOLUTE (machineLift here, or
 *   an out-of-band per-wall G53 lift as in corner). Omit → relative drop (byte-identical). Requires p.drop truthy (the drop point).
 *
 * @param p.approach - 'auto' (default) | 'manual'. AUTO emits the hands-free G0 XY move (the mode dispatch below).
 *   MANUAL emits an operator JOG-and-wait instead (NO XY move — the operator jogs): [lift] → [comment] → #1505 prompt →
 *   IF #1505==0 GOTO <failGoto> → [drop] → G91. It reuses this call's OWN lift/drop/comment, so the Z-state mirrors the
 *   auto travel it replaces. ONLY valid for the seq/in-axis JOG repositions — NOT 'center'/transTraverse, whose re-centre
 *   math the jog would silently discard. The CALLER owns the comment INCLUDING any 'REPOSITION:' prefix (the sim
 *   pass-counter keys on it — do NOT auto-prefix here). XY-only jogging during the pause is the operator's responsibility.
 * @param p.promptVar/p.promptVal/p.promptNote/p.failGoto - manual prompt knobs (defaults '#1505' / '1' /
 *   'Press Enter when repositioned' / 2 — middle's reposition() literals).
 *
 * Mode 'in-axis' params: p.move (e.g. '#19')
 * Mode 'center' params: p.dir1Plus, p.dir2Plus, p.diagPrimary ('#22'), p.diagTravel ('#21'), p.wall2Var ('#52'), p.radiusVar ('#6'), p.lastRetract;
 *   p.dogleg (bool) — DOGLEG vs diagonal: false (default) = one straight XY diagonal; true = route AROUND (secondary out FIRST, then re-centre the primary).
 * Mode 'seq' params: p.crossX, p.crossY (e.g. '#23', '#24'); p.firstAxis ('X'|'Y', optional) — see the SAFE DOG-LEG note below.
 */
export function safeTraverseStack(p = {}) {
    const S = [];
    const push = (type, params) => { const b = newBlock(type); b.params = { ...params }; S.push(b); };
    // t826 — the clearing LIFT before the traverse. Default = the incremental G0 Z<lift> (byte-identical to every existing
    // caller). `machineLift` (opt-in) retracts to the DECLARED MACHINE MARGIN instead (limit-proof; the sim models the
    // mid-program G53) — for a manual reposition whose auto lift could otherwise compound into the top switch from a high start.
    // t897 — when this traverse machine-lifts AND a returnZ is declared, RECORD the pre-lift machine Z first (saveMachineZNode)
    // so the drop-back below returns to THAT exact Z (honest pairing) instead of lift-to-margin + old-relative-drop = an
    // arbitrary Z. The save must precede the G53 lift (it reads the live Z). Corner saves out-of-band (in probeWallR, its lift
    // is the per-wall retract, not this doLift) so its repoTraverse passes returnZ WITHOUT machineLift → doLift is a no-op here.
    const doLift = () => {
        if (!p.lift) return;
        // t913 — the declared clearance MODE. 'plane' → a work-frame absolute lift to p.planeZ (universal); 'hop' → a capped
        // relative hop (safeHopNode, Expert-capped / degrade elsewhere). Both SAVE the pre-lift Z first so the paired G53 return
        // (emitDrop) nets back to the probe depth — the same honest pairing as 'max'. Default (max/machineLift) is unchanged.
        if (p.clearMode === 'plane') { if (p.returnZ) S.push(saveMachineZNode(p.returnZ)); planeLiftNodes(p.planeZ).forEach((b) => S.push(b)); }
        else if (p.clearMode === 'hop') { if (p.returnZ) S.push(saveMachineZNode(p.returnZ)); S.push(safeHopNode({ hopDist: p.hopDist, saveVar: p.returnZ || '#95' })); }
        else if (p.machineLift) { if (p.returnZ) S.push(saveMachineZNode(p.returnZ)); S.push(safeRetractNode({ restore: 'inc' })); }   // t856 — the machine-lift path fires inside the G91 traverse body → G90-wrap the G53, restore G91
        else push('move', { mode: 'rapid', z: p.lift });
    };
    // t897 — the drop-back. returnZ (declared) → the paired G53 RETURN to the saved machine Z (byte-honest: returns to the
    // probe depth, sim-exact via the marker); else the old relative drop (byte-identical for every caller that omits returnZ).
    // `restore` is PER-ARM (a wrong G90/G91 could make the G53 move incrementally): 'inc' where the arm has NO trailing
    // distmode (seq — the return restores G91), 'abs' where the arm's own trailing distmode restores G91 (manual/center/in-axis).
    const emitDrop = (restore) => {
        if (!p.drop) return;
        if (p.returnZ) S.push(safeZParkBlock('machine', p.returnZ, restore, { ret: true }));
        else push('move', { mode: 'rapid', z: p.drop });
    };
    const axis = p.axis || 'X';
    const second = p.second || 'Y';
    const alc = axis.toLowerCase(), slc = second.toLowerCase();

    // MANUAL approach — SHORT-CIRCUIT the mode dispatch (the mode only shapes the auto XY move, which manual omits).
    // Emits middle's proven reposition() shape verbatim; leaves the three auto arms below byte-identical for every
    // existing caller. See the @param p.approach note for the seq/in-axis-ONLY constraint + who owns the REPOSITION: prefix.
    if (p.approach === 'manual') {
        const promptVal = p.promptVal ?? '1';
        const promptNote = p.promptNote ?? 'Press Enter when repositioned';
        const failGoto = p.failGoto ?? 2;
        doLift();
        if (p.comment) push('comment', { text: p.comment });
        // the operator jog-and-wait gate via the profile-aware hmiconfirm atom: Expert = `#1505=1 ( note )` + `IF #1505==0
        // GOTO<fail>` (byte-identical to the old assign+ifgoto); off-HMI both fold to a comment (no ESC → no mis-branch).
        push('hmiconfirm', { value: String(promptVal), note: promptNote, cancel: failGoto });
        emitDrop('abs');   // trailing distmode below restores G91 → the return only needs its G90 wrap
        push('distmode', { dist: 'inc' });
        return S;
    }

    if (p.mode === 'center') {
        const lastRetract = p.lastRetract || (p.dir1Plus ? '#10' : '#9');
        push('assign', { var: '#22', value: String(p.diagPrimary), note: `Diag primary: the diagonal ${axis} target — #53 (re-centre, measured NOW) at rest, or ②.${axis} when the ② marker is placed` });
        const pmove = `[#22-${p.wall2Var}-${lastRetract}${p.dir1Plus ? '-'+p.radiusVar : '+'+p.radiusVar}]`;
        const smove = p.dir2Plus ? `[0-${p.diagTravel}]` : String(p.diagTravel); // travelOpp logic
        doLift();
        if (p.dogleg) {
            // SAFE DOG-LEG (mirrors mode:'seq' firstAxis): route AROUND the boss — travel the SECONDARY out FIRST (clears
            // the boss on that side), THEN re-centre the PRIMARY. A single diagonal (the else) could clip the boss corner.
            push('move', { mode: 'rapid', [slc]: smove });
            push('move', { mode: 'rapid', [alc]: pmove });
        } else {
            push('move', { mode: 'rapid', [alc]: pmove, [slc]: smove });   // one straight XY diagonal
        }
        emitDrop('abs');   // trailing distmode below restores G91
        if (p.comment) push('comment', { text: p.comment });
        push('distmode', { dist: 'inc' });
    } else if (p.mode === 'seq') {
        if (p.comment) push('comment', { text: p.comment });
        doLift();
        // SAFE DOG-LEG (safety): when the caller DECLARES a firstAxis, split the 2D reposition into two SEQUENTIAL single-axis
        // rapids so the tool routes AROUND the outside corner instead of diagonally THROUGH the stock. The order is caller-
        // declared + geometry-aware: pass the SECOND wall's axis (sA). After probing wall-1 the tool sits OUTSIDE the stock
        // along wall-1's axis (fA) but INSIDE its span along wall-2's (sA); moving sA FIRST clears past the corner (fA-out ·
        // sA-out) before fA brings it in — moving fA first would land fA-in · sA-in = INSIDE the stock. Topological → holds
        // for all 8 corner×probeSeq combos (only the signs flip). NO firstAxis → the original single simultaneous XY move
        // (byte-identical) — for callers that DON'T cross material at this Z, e.g. corner's Z→wall1 runs at safe-Z ABOVE the
        // stock so a diagonal there can't collide (and one of its axes is 0 by default → splitting would add a no-op leg).
        if (p.firstAxis === 'X' || p.firstAxis === 'Y') {
            const fLc = p.firstAxis.toLowerCase(), sLc = fLc === 'x' ? 'y' : 'x';
            push('move', { mode: 'rapid', [fLc]: String(fLc === 'x' ? p.crossX : p.crossY) });
            push('move', { mode: 'rapid', [sLc]: String(sLc === 'x' ? p.crossX : p.crossY) });
        } else {
            push('move', { mode: 'rapid', x: String(p.crossX), y: String(p.crossY) });
        }
        emitDrop('inc');   // seq has NO trailing distmode → the return itself restores G91
    } else if (p.mode === 'in-axis') {
        doLift();
        push('move', { mode: 'rapid', [alc]: String(p.move) });
        emitDrop('abs');   // trailing distmode below restores G91
        if (p.comment) push('comment', { text: p.comment });
        push('distmode', { dist: 'inc' });
    }
    return S;
}
