/**
 * wizards/lathe/odTurn.js — OD TURNING, the lathe family's FIRST INHERITOR (t1273).
 *
 * Turn the bar down to a target diameter over a length of Z, from the finished face toward the chuck. Where facing
 * proved the mechanisms, this one USES them: the frame and the one conversion come from data/lathe.js, the parametric
 * IF/GOTO shape comes from facing, the twin/canvas/gating patterns come from the pilot. Nothing here is re-invented —
 * if a number in this file disagrees with the canvas or the model, that is a bug in one consumer, not two opinions.
 *
 * ── THE IDENTITY IS REAL THIS TIME ───────────────────────────────────────────────────────────────────────────────
 * Facing had none (a facing pass is a facing pass). An OD turn does: STRAIGHT or TAPER. That is not a cosmetic
 * toggle — a taper's far end is a different diameter, so it is one more declared number and one interpolated pass.
 * It sits at the TOP of the form because it decides what the rest of the fields MEAN.
 *
 * ── THE PASS ANCHOR (hand-derived, and the reason it is anchored where it is) ────────────────────────────────────
 * Roughing steps inward from the bar to the roughing floor (the finished radius plus the finish allowance). When the
 * material to remove is not a whole number of cuts, ONE pass is lighter than the rest — and this anchors on the
 * FLOOR, so the light pass falls FIRST. Two reasons: the first cut is the one going through the sawn/scaled skin,
 * which is where a light cut belongs; and the alternative puts a light pass immediately before the finish pass, two
 * feather cuts back to back for nothing. Ø20 → Ø14 at 1mm/pass leaving 0.5: 9.5, 8.5, 7.5 — then finish at 7.0.
 * (facing.js anchors the other way — its light pass falls last. They agree whenever the depth divides evenly, which
 * is why the pilot never saw the difference. Unifying them is a 3-line change and is FLAGGED, not done here.)
 *
 * ── WHY THE LOOP STILL LIVES ON THE CONTROLLER ──────────────────────────────────────────────────────────────────
 * Same user ruling as facing: a #var config header plus IF/GOTO, never an unrolled list of moves, so the operator can
 * change the target diameter or the depth of cut AT THE MACHINE and the program adapts. That is why the emitted macro
 * COUNTS its passes before it cuts any — the count is not knowable at post time if the numbers can change after it.
 *
 * ── THE FRAME, restated where it is used ────────────────────────────────────────────────────────────────────────
 * X is a RADIUS. Z0 is the FINISHED FACE, and the cut runs −Z toward the chuck. A turner says DIAMETER; the emit
 * writes RADIUS, through radiusOf() and nowhere else.
 */
import { radiusOf, normalizeBar } from '../../data/lathe.js';

/**
 * THE IDENTITY. Declared, because it decides the shape of the op rather than one of its numbers — and because the
 * form, the canvas (one corner handle or two) and the emit all have to agree on what the choice MEANS.
 */
export const OD_KINDS = {
    straight: {
        id: 'straight',
        label: 'Straight',
        why: 'One diameter along the whole length — the everyday turn. The far end equals the face end.',
    },
    taper: {
        id: 'taper',
        label: 'Taper',
        why: 'The far end is a different diameter. The finish pass interpolates X across the Z travel.',
    },
};

/**
 * The declared scratch variables. #120–#136, clear of facing's #110–#114 so one program can hold both ops.
 *
 * ── THE HEADER SPEAKS DIAMETER; THE CONTROLLER DERIVES THE RADIUS ────────────────────────────────────────────────
 * Every number a person TYPES is a diameter (#131–#133), and the radius the machine actually moves to is derived
 * from it by the controller ([#132/2]). That is not decoration:
 *   · the form binds the socket that holds the number the FIELD SAYS. A field labelled Ø bound to a radius socket
 *     round-trips wrong the moment someone edits the block — the form would read 7 back into a Ø field and the next
 *     emit would halve it again, silently, every time.
 *   · the operator editing the macro at the machine types the diameter off the drawing, like they think.
 * radiusOf() stays the ONE conversion in JS (the pass list, the canvas); this is that same rule written once more in
 * G-code, where the operator can see it — not a second opinion about it.
 */
export const OD_VARS = {
    xCut: '#120',        // the radius THIS pass cuts at — the loop counter
    xBar: '#121',        // derived: the bar's radius
    xTarget: '#122',     // derived: the finished radius at the FACE end
    xFloor: '#123',      // derived: where roughing stops — the finished radius plus the allowance
    doc: '#124',         // radial depth of cut per pass
    depth: '#125',       // how far along the bar the turn runs
    xClear: '#126',      // derived: retract radius
    feed: '#127',        // roughing feed
    xEnd: '#128',        // derived: the radius at the FAR end
    zEnd: '#129',        // derived: the Z each pass cuts to (negative — toward the chuck)
    zSafe: '#130',       // clear Z, ahead of ALL raw material
    dBar: '#131',        // ← the bar DIAMETER, as a turner says it
    dTarget: '#132',     // ← the target DIAMETER at the face
    dEnd: '#133',        // ← the DIAMETER at the far end (a taper); equal to the target on a straight turn
    finish: '#134',      // the finish allowance, on the RADIUS — the same terms as the depth of cut
    clearance: '#135',   // how far outside the bar to retract, on the RADIUS
    feedFinish: '#136',  // the finishing feed — a real turning knob, so it is a variable and not a baked number
    zCross: '#137',      // derived, taper only: the Z where the finished cone reaches THIS pass's radius
    xStartFin: '#138',   // derived, taper only: the cone extrapolated back to the approach Z, so the finish pass
                         //                     passes through the face at exactly the target radius
};

/** Label base. 60 = the depth-of-cut guard, 61 = the pass count, 62 = the roughing loop, 63 = the finish pass;
 *  64/65 the crossing clamps, 66 the floor join, 67 straight, 68 fat-face, 69 the retract all three arms rejoin at. */
export const OD_LOOP_LABEL = 60;

export const OD_DEFAULTS = {
    kind: 'straight',
    barDiameter: 20,
    stickOut: 60,
    barAllowance: 1,      // raw material still ahead of the finished face (the approach has to clear it)
    targetDiameter: 14,   // what a turner says: a DIAMETER
    endDiameter: 14,      // the far end — only meaningful for a taper
    depth: 25,            // along the bar, from the face
    doc: 1,               // radial, per pass
    finish: 0.5,          // left on the radius for the finishing pass
    clearance: 2,         // how far outside the bar to retract, in radius
    feed: 120,
    feedFinish: 60,
    rpm: 900,
};

const round3 = (n) => Math.round(n * 1000) / 1000;

/** The kind, normalized — an unknown value is a straight turn, never a crash. */
export const odKind = (kind) => (OD_KINDS[kind] ? kind : 'straight');

/**
 * THE RADII THIS OP CUTS AT — hand-derivable, and derived HERE so the emit and the tests cannot disagree.
 *
 * @param {object} p  OD_DEFAULTS shape (diameters as a person says them)
 * @returns {{rough:number[], finish:{start:number,end:number}, floor:number, barR:number}}
 *          rough: the roughing radii, outermost first. finish: the final pass, from the face end to the far end
 *          (the two are equal unless this is a taper). floor: where roughing stops. All RADII.
 */
export function odPasses(p = {}) {
    const v = { ...OD_DEFAULTS, ...p };
    const kind = odKind(v.kind);
    const barR = radiusOf(normalizeBar({ diameter: v.barDiameter }).diameter);
    const targetR = radiusOf(Math.max(0, Number(v.targetDiameter) || 0));
    const endR = kind === 'taper' ? radiusOf(Math.max(0, Number(v.endDiameter) || 0)) : targetR;
    const d = Math.max(0.001, Number(v.doc) || 0.001);
    // THE FLOOR is the SMALLER of the two finished radii plus the allowance. On a taper, roughing at a constant
    // radius must not dip below the tightest point of the finished surface, or it gouges the part it is meant to
    // leave. (That does leave more for the finish pass at the big end — see the note on `odTurnStack`.)
    const floor = round3(Math.min(targetR, endR) + Math.max(0, Number(v.finish) || 0));

    const rough = [];
    // …anchored on the FLOOR, walking OUT to the bar, then reversed: the light pass ends up FIRST (see the header).
    for (let r = floor; r < barR - 1e-9; r = round3(r + d)) rough.push(r);
    rough.reverse();
    return { rough, finish: { start: targetR, end: endR }, floor, barR };
}

/**
 * The OD-turning macro as a block stack: a #var config header, a controller-side pass loop, one finishing pass.
 * @param {object} p  OD_DEFAULTS shape
 */
export function odTurnStack(p = {}) {
    const v = { ...OD_DEFAULTS, ...p };
    const kind = odKind(v.kind);
    const bar = normalizeBar({ diameter: v.barDiameter, stickOut: v.stickOut, allowance: v.barAllowance });
    const V = OD_VARS;
    const L = OD_LOOP_LABEL;
    const pass = odPasses(v);
    const targetR = round3(pass.finish.start);
    const endR = round3(pass.finish.end);
    // the DIAMETERS the header carries — the far end equals the target unless this really is a taper
    const dBar = round3(bar.diameter);
    const dTarget = round3(Math.max(0, Number(v.targetDiameter) || 0));
    // A STRAIGHT turn's far end is not a COPY of the target, it IS the target: the socket holds the REFERENCE, so
    // the macro says so out loud and the operator changing the target at the machine keeps the turn straight.
    const dEnd = kind === 'taper' ? String(round3(Math.max(0, Number(v.endDiameter) || 0))) : V.dTarget;
    const clearance = Math.max(0, Number(v.clearance) || 0);
    const finish = Math.max(0, Number(v.finish) || 0);
    // t1305 — nothing about the SHAPE is decided here any more. Which end the floor comes from, which roughing arm
    // runs, where the finish pass starts: all three used to be build-time branches, and all three are now IF/GOTO on
    // the controller (below). `kind` survives only to decide what the far-end SOCKET holds — a number for a taper,
    // the reference `#132` for a straight turn — which is a fact about the header, not about the program's shape.
    const taper = kind === 'taper' && Math.abs(endR - targetR) > 1e-9;

    const s = [];
    s.push({ type: 'progstart', params: { clearance: 5, feed: v.feed } });
    // THE HEADER COMMENT RESTATES NOTHING. A first version read "bar Ø20 → Ø14 over 25mm", and dragging the shoulder
    // handle left it saying exactly that while the variables below it said 2.353 and 38.86 — the sizes live in the
    // sockets, and a comment is not a socket. An operator reading a header that contradicts the program is worse off
    // than one reading no header at all, so it says what the op IS and points at the numbers.
    s.push({ type: 'comment', params: { text: 'OD TURN — turn the bar down between the face and the shoulder. Every size is a #var below.' } });

    // ── THE CONFIG HEADER ───────────────────────────────────────────────────────────────────────────────────────
    // What a person TYPES, in the units they say it in…
    s.push({ type: 'assign', params: { var: V.dBar, value: String(dBar), note: 'bar DIAMETER' } });
    s.push({ type: 'assign', params: { var: V.dTarget, value: String(dTarget), note: 'target DIAMETER at the face' } });
    s.push({ type: 'assign', params: { var: V.dEnd, value: String(dEnd), note: 'DIAMETER at the far end — equal to the target on a straight turn, and the macro follows whichever it is' } });
    s.push({ type: 'assign', params: { var: V.doc, value: String(v.doc), note: 'radial depth per pass' } });
    s.push({ type: 'assign', params: { var: V.depth, value: String(v.depth), note: 'how far along the bar the turn runs' } });
    s.push({ type: 'assign', params: { var: V.finish, value: String(finish), note: 'finish allowance left on the RADIUS (the depth-of-cut terms)' } });
    s.push({ type: 'assign', params: { var: V.clearance, value: String(clearance), note: 'how far outside the bar to retract, on the RADIUS' } });
    s.push({ type: 'assign', params: { var: V.feed, value: String(v.feed), note: 'roughing feed' } });
    s.push({ type: 'assign', params: { var: V.feedFinish, value: String(v.feedFinish), note: 'finishing feed' } });
    // …and what the CONTROLLER works out from it. The tool moves in radius; the drawing is in diameter; the halving
    // happens here, once, in front of the operator instead of behind them.
    s.push({ type: 'assign', params: { var: V.xBar, value: `[${V.dBar}/2]`, note: 'bar RADIUS' } });
    s.push({ type: 'assign', params: { var: V.xTarget, value: `[${V.dTarget}/2]`, note: 'target RADIUS' } });
    s.push({ type: 'assign', params: { var: V.xEnd, value: `[${V.dEnd}/2]`, note: 'far-end RADIUS' } });
    // t1305 — THE FLOOR IS THE THINNER END, decided on the controller. It used to be picked here, at build time, from
    // the two radii JS could see — which was correct for the program as built and wrong the moment the operator
    // retuned the far end at the machine.
    s.push({ type: 'assign', params: { var: V.xFloor, value: `[${V.xTarget}+${V.finish}]`, note: 'roughing stops here — the finished radius plus the allowance' } });
    s.push({ type: 'ifgoto', params: { lhs: V.xEnd, op: '>=', rhs: V.xTarget, goto: L + 6 } });
    s.push({ type: 'assign', params: { var: V.xFloor, value: `[${V.xEnd}+${V.finish}]`, note: '…the far end is the thinner one' } });
    s.push({ type: 'label', params: { n: L + 6 } });
    s.push({ type: 'assign', params: { var: V.xClear, value: `[${V.xBar}+${V.clearance}]`, note: 'retract radius — clear of the bar' } });
    s.push({ type: 'assign', params: { var: V.zEnd, value: `[0-${V.depth}]`, note: 'the Z each pass cuts to (toward the chuck)' } });
    s.push({ type: 'assign', params: { var: V.zSafe, value: String(round3(bar.allowance + clearance)), note: 'clear Z — ahead of all raw material' } });

    // …no toolsel here. The declared tool is a MARKER the TWIN appends (appendToolSel), UNSET by default, exactly
    // like every ported mill op: baking one in armed the manual tool-change confirm on every emit — a mill tool-table
    // prompt on a lathe program, before anyone had chosen a tool.
    s.push({ type: 'spindle', params: { mode: 'cw', rpm: v.rpm } });
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xClear, z: V.zSafe } });

    // …a zero depth of cut would spin the counting loop below forever. The operator can edit #124 at the machine, so
    // the macro defends itself — by doing NO ROUGHING, not by inventing a depth of cut nobody asked for. The
    // finishing pass still runs, which is exactly what "take no roughing passes" should mean.
    s.push({ type: 'ifgoto', params: { lhs: V.doc, op: '>', rhs: '0', goto: L } });
    s.push({ type: 'goto', params: { n: L + 3 } });
    s.push({ type: 'label', params: { n: L } });

    // ── COUNT THE PASSES BEFORE CUTTING ANY (no motion) ─────────────────────────────────────────────────────────
    // Stepping from the floor OUTWARD finds the outermost roughing radius, which is what puts the light pass FIRST.
    // It costs a handful of no-motion iterations and keeps every cut a full depth except the one through the skin.
    s.push({ type: 'assign', params: { var: V.xCut, value: V.xFloor, note: 'count out from the roughing floor…' } });
    s.push({ type: 'label', params: { n: L + 1 } });
    s.push({ type: 'assign', params: { var: V.xCut, value: `[${V.xCut}+${V.doc}]` } });
    s.push({ type: 'ifgoto', params: { lhs: V.xCut, op: '<', rhs: V.xBar, goto: L + 1 } });
    s.push({ type: 'assign', params: { var: V.xCut, value: `[${V.xCut}-${V.doc}]`, note: '…and step back in: the outermost pass' } });
    // nothing to rough (the finished size is already outside the bar) → straight to the finishing pass
    s.push({ type: 'ifgoto', params: { lhs: V.xCut, op: '>=', rhs: V.xBar, goto: L + 3 } });

    // ── THE ROUGHING LOOP ───────────────────────────────────────────────────────────────────────────────────────
    s.push({ type: 'label', params: { n: L + 2 } });
    // t1305 — THE SHAPE IS DECIDED HERE, AT RUN TIME, not when the program was posted. The three routes below are the
    // same three t1291/t1293 derived; what changed is WHO picks. A program built straight used to carry only the
    // straight route, so an operator who retuned the far-end diameter at the machine got full-length passes down a
    // cone: safe (it cuts less than it should) but not re-planned, and the finish pass then had a ridge to take off
    // in one bite. The comparison is a bare IF — no trig, and the crossing itself was already pure ratio.
    //
    // ORDER MATTERS: the straight test comes FIRST because the crossing formula divides by [#128−#122], which is
    // exactly zero on a straight turn. The controller must never reach that division; it jumps over it.
    s.push({ type: 'ifgoto', params: { lhs: V.xEnd, op: '==', rhs: V.xTarget, goto: L + 7, note: 'straight — no cone to follow' } });
    // …a taper: where does the finished cone reach THIS pass's radius? A pure ratio, clamped into the turned length
    // (a pass wider than the whole cone still runs the full length).
    s.push({ type: 'assign', params: { var: V.zCross, value: `[0-[${V.depth}*[${V.xCut}-${V.xTarget}]/[${V.xEnd}-${V.xTarget}]]]`, note: 'where the cone reaches this pass' } });
    s.push({ type: 'ifgoto', params: { lhs: V.zCross, op: '<=', rhs: '0', goto: L + 4 } });
    s.push({ type: 'assign', params: { var: V.zCross, value: '0', note: 'clamp: not past the face' } });
    s.push({ type: 'label', params: { n: L + 4 } });
    s.push({ type: 'ifgoto', params: { lhs: V.zCross, op: '>=', rhs: V.zEnd, goto: L + 5 } });
    s.push({ type: 'assign', params: { var: V.zCross, value: V.zEnd, note: 'clamp: not past the far end' } });
    s.push({ type: 'label', params: { n: L + 5 } });
    s.push({ type: 'ifgoto', params: { lhs: V.xEnd, op: '<', rhs: V.xTarget, goto: L + 8, note: 'fat face — come in at the crossing' } });
    // FAT FAR END: the thin material is near the face, so cut from the face TO the crossing.
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xCut } });
    s.push({ type: 'move', params: { mode: 'cut', z: V.zCross, feed: V.feed } });
    s.push({ type: 'goto', params: { n: L + 9 } });
    // FAT FACE: the thin material is deep, so come in AT the crossing — where the cone is exactly this radius, so the
    // approach touches the surface rather than cutting into it — and run to the far end.
    s.push({ type: 'label', params: { n: L + 8 } });
    s.push({ type: 'move', params: { mode: 'rapid', z: V.zCross } });
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xCut } });
    s.push({ type: 'move', params: { mode: 'cut', z: V.zEnd, feed: V.feed } });
    s.push({ type: 'goto', params: { n: L + 9 } });
    // STRAIGHT: in to this pass's radius ahead of the face, then cut the whole length.
    s.push({ type: 'label', params: { n: L + 7 } });
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xCut } });
    s.push({ type: 'move', params: { mode: 'cut', z: V.zEnd, feed: V.feed } });
    s.push({ type: 'label', params: { n: L + 9 } });
    // THE TURNING RETRACT, in this order and not the other: OFF the part in +X first, THEN back out in +Z. Pulling
    // back in Z while still at depth drags the tool along the surface it just cut.
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xClear } });
    s.push({ type: 'move', params: { mode: 'rapid', z: V.zSafe } });
    s.push({ type: 'assign', params: { var: V.xCut, value: `[${V.xCut}-${V.doc}]`, note: 'step in' } });
    s.push({ type: 'ifgoto', params: { lhs: V.xCut, op: '>=', rhs: V.xFloor, goto: L + 2 } });

    // ── THE FINISHING PASS ──────────────────────────────────────────────────────────────────────────────────────
    // ONE interpolated move does both shapes: a straight turn is the case where the far-end radius happens to equal
    // the target, so there is no taper branch here — the geometry falls out of the numbers.
    s.push({ type: 'label', params: { n: L + 3 } });
    s.push({ type: 'comment', params: { text: 'finish pass — X interpolates to the far end, which is the final size on a straight turn' } });
    // t1291 — THE FINISH PASS STARTS ON THE CONE, NOT BESIDE IT. It began at the target radius while the tool was
    // still at the SAFE Z, so the interpolated line ran from (rFace, +zSafe) to (rFar, −depth) — a cone shifted by
    // the approach, and the finished face came out at r 4.46 where the drawing said 4.
    //
    // t1305 — AND IT NEEDS NO BRANCH AT ALL. When the two ends are equal the extrapolation term is zero, so this
    // lands on exactly the target radius: the straight arm that used to sit here was the same two moves with the
    // same numbers. One route, both shapes, and nothing to keep in step.
    s.push({ type: 'assign', params: { var: V.xStartFin, value: `[${V.xTarget}-[[${V.xEnd}-${V.xTarget}]*${V.zSafe}/${V.depth}]]`, note: 'the cone, extrapolated to the approach — the target itself when the ends are equal' } });
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xStartFin } });
    s.push({ type: 'move', params: { mode: 'cut', x: V.xEnd, z: V.zEnd, feed: V.feedFinish } });
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xClear } });
    s.push({ type: 'move', params: { mode: 'rapid', z: V.zSafe } });
    s.push({ type: 'progend', params: {} });
    return s;
}
