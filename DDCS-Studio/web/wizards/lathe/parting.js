/**
 * wizards/lathe/parting.js — PARTING & GROOVING (t1275). An inheritor: nothing here is invented.
 *
 * One tool, one plunge, straight in toward the centreline at a fixed Z. Part-off runs it all the way (or to a declared
 * spigot); a groove stops at a diameter and leaves the bar whole. That is genuinely one operation with two ends, which
 * is why the identity is where it is and the rest of the form is shared.
 *
 * ── THE KERF IS DECLARED, because the tool has WIDTH and the part does not care about the tool ──────────────────
 * A parting blade cuts a slot as wide as it is. The Z a person types is the FACE of the finished feature — the
 * shoulder they measured off the drawing — and the blade sits on the side of it the material is on. Declaring the
 * width lets the macro put the blade where the operator meant, instead of asking them to do the offset in their head
 * and get it wrong by a kerf. A groove wider than the blade is not modelled here (that is a second pass, and it is
 * not this op).
 *
 * ── THE PECK IS A RETRACT, NOT A DEPTH ─────────────────────────────────────────────────────────────────────────
 * Parting chips pack the slot; the answer is to come out and let them go, not to cut shallower. So a peck step is how
 * far the blade advances between full retracts to the clearance radius — the same shape as the drilling peck, and
 * both are IF/GOTO loops on the controller for the same reason the other lathe ops are.
 *
 * THE FRAME, again where it is used: X is a RADIUS, Z0 is the FINISHED FACE, the cut runs −Z toward the chuck. A
 * turner says DIAMETER; the emit writes RADIUS, through radiusOf() and nowhere else.
 */
import { radiusOf, normalizeBar } from '../../data/lathe.js';

/** THE IDENTITY: the same plunge, stopped at two different places. */
export const PART_KINDS = {
    part: {
        id: 'part',
        label: 'Part off',
        why: 'Cut the work free. The blade runs to the centreline, or to a declared spigot diameter if you want to snap it off.',
    },
    groove: {
        id: 'groove',
        label: 'Groove',
        why: 'Cut a slot to a diameter and stop. The bar stays whole.',
    },
};

/** The declared scratch variables. #140–#149, clear of facing (#110s) and OD turning (#120s). */
export const PART_VARS = {
    xCut: '#140',        // the radius the blade has reached — the loop counter
    dBar: '#141',        // ← the bar DIAMETER, as a turner says it
    dFloor: '#142',      // ← where the plunge stops, as a DIAMETER (0 = right through the centre)
    zFace: '#143',       // ← the Z of the feature's face, off the drawing
    width: '#144',       // ← the blade width (the kerf)
    peck: '#145',        // ← how far to advance between retracts; 0 = straight in
    feed: '#146',
    xBar: '#147',        // derived: the bar radius
    xFloor: '#148',      // derived: the radius the plunge stops at
    xClear: '#149',      // derived: retract radius
    zCut: '#150',        // derived: the Z the blade actually sits at (the face, offset by the kerf)
};

/** 70 = the peck guard, 71 = the plunge loop, 72 = done. */
export const PART_LOOP_LABEL = 70;

export const PART_DEFAULTS = {
    kind: 'groove',
    barDiameter: 20,
    barAllowance: 1,
    zFace: -10,          // where the feature's face is, measured from the finished face
    targetDiameter: 12,  // groove: the diameter at the bottom of the slot
    spigotDiameter: 0,   // part-off: 0 = run right through the centre
    width: 3,            // the blade
    peck: 0,             // 0 = straight in, no pecking
    clearance: 2,
    feed: 40,            // parting is slow
    rpm: 700,
};

const round3 = (n) => Math.round(n * 1000) / 1000;

/** The kind, normalized — an unknown value grooves (the one that does not cut the part free). */
export const partKind = (kind) => (PART_KINDS[kind] ? kind : 'groove');

/**
 * WHERE THE BLADE STOPS, as a RADIUS. A groove stops at its target diameter; a part-off runs to the centreline
 * unless a spigot is declared, in which case it stops there and the operator snaps the part off.
 */
export function partFloorRadius(p = {}) {
    const v = { ...PART_DEFAULTS, ...p };
    if (partKind(v.kind) === 'groove') return round3(radiusOf(Math.max(0, Number(v.targetDiameter) || 0)));
    return round3(radiusOf(Math.max(0, Number(v.spigotDiameter) || 0)));
}

/**
 * WHERE THE BLADE SITS IN Z. The typed Z is the FACE of the feature; the blade occupies its own width on the far
 * side of that face — the side the material is on — so the finished face lands where the drawing says.
 */
export function partBladeZ(p = {}) {
    const v = { ...PART_DEFAULTS, ...p };
    return round3(Number(v.zFace) - Math.max(0, Number(v.width) || 0));
}

/**
 * THE PLUNGE STEPS — hand-derivable, and derived HERE so the emit and the tests cannot disagree.
 *
 * With no peck it is one move: bar radius straight to the floor. With a peck it is the radii the blade reaches
 * between retracts, ending exactly on the floor (never past it — past the floor of a groove is into the part).
 * @returns {number[]} the radii the blade reaches, in cutting order
 */
export function partSteps(p = {}) {
    const v = { ...PART_DEFAULTS, ...p };
    const barR = radiusOf(normalizeBar({ diameter: v.barDiameter }).diameter);
    const floor = partFloorRadius(v);
    const peck = Math.max(0, Number(v.peck) || 0);
    if (!(peck > 0) || floor >= barR) return [floor];
    const out = [];
    for (let r = round3(barR - peck); r > floor + 1e-9; r = round3(r - peck)) out.push(r);
    out.push(floor);                       // the last advance lands ON the floor, never past it
    return out;
}

/**
 * The parting / grooving macro as a block stack.
 * @param {object} p  PART_DEFAULTS shape
 */
export function partingStack(p = {}) {
    const v = { ...PART_DEFAULTS, ...p };
    const kind = partKind(v.kind);
    const bar = normalizeBar({ diameter: v.barDiameter, stickOut: 60, allowance: v.barAllowance });
    const V = PART_VARS;
    const L = PART_LOOP_LABEL;
    const clearance = Math.max(0, Number(v.clearance) || 0);
    const dFloor = round3(kind === 'groove' ? Math.max(0, Number(v.targetDiameter) || 0) : Math.max(0, Number(v.spigotDiameter) || 0));
    const peck = Math.max(0, Number(v.peck) || 0);

    const s = [];
    s.push({ type: 'progstart', params: { clearance: 5, feed: v.feed } });
    // the header restates no size — the lesson from OD, applied on the way in rather than after a drag exposed it
    s.push({ type: 'comment', params: { text: kind === 'groove'
        ? 'GROOVE — plunge to a diameter and come out. Every size is a #var below.'
        : 'PART OFF — plunge until the work comes free. Every size is a #var below.' } });

    // what a person types…
    s.push({ type: 'assign', params: { var: V.dBar, value: String(round3(bar.diameter)), note: 'bar DIAMETER' } });
    s.push({ type: 'assign', params: { var: V.dFloor, value: String(dFloor), note: kind === 'groove' ? 'groove DIAMETER at the bottom of the slot' : 'spigot DIAMETER to stop at (0 = right through the centre)' } });
    s.push({ type: 'assign', params: { var: V.zFace, value: String(round3(Number(v.zFace) || 0)), note: 'the Z of the feature FACE, off the drawing' } });
    s.push({ type: 'assign', params: { var: V.width, value: String(round3(Math.max(0, Number(v.width) || 0))), note: 'blade width — the kerf' } });
    s.push({ type: 'assign', params: { var: V.peck, value: String(peck), note: 'advance between full retracts (0 = straight in)' } });
    s.push({ type: 'assign', params: { var: V.feed, value: String(v.feed), note: 'plunge feed' } });
    // …and what the controller works out
    s.push({ type: 'assign', params: { var: V.xBar, value: `[${V.dBar}/2]`, note: 'bar RADIUS' } });
    s.push({ type: 'assign', params: { var: V.xFloor, value: `[${V.dFloor}/2]`, note: 'the RADIUS the plunge stops at' } });
    s.push({ type: 'assign', params: { var: V.xClear, value: `[${V.xBar}+${String(clearance)}]`, note: 'retract radius — clear of the bar' } });
    // THE KERF OFFSET, done by the controller: the blade sits its own width on the material side of the typed face,
    // so the finished face lands where the drawing says instead of a blade-width away from it.
    s.push({ type: 'assign', params: { var: V.zCut, value: `[${V.zFace}-${V.width}]`, note: 'where the BLADE sits — the face, less the kerf' } });

    s.push({ type: 'spindle', params: { mode: 'cw', rpm: v.rpm } });
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xClear, z: String(round3(bar.allowance + clearance)) } });
    s.push({ type: 'move', params: { mode: 'rapid', z: V.zCut } });          // …into position in Z, still clear in X
    s.push({ type: 'assign', params: { var: V.xCut, value: V.xBar, note: 'the blade starts at the bar' } });

    // NO PECK → one plunge. The guard is not "peck a bit anyway": a zero peck means the operator asked for a
    // continuous cut, and the loop below would never advance, so the macro takes the one move it was asked for.
    s.push({ type: 'ifgoto', params: { lhs: V.peck, op: '>', rhs: '0', goto: L } });
    s.push({ type: 'move', params: { mode: 'cut', x: V.xFloor, feed: V.feed } });
    s.push({ type: 'goto', params: { n: L + 2 } });

    s.push({ type: 'label', params: { n: L } });
    s.push({ type: 'label', params: { n: L + 1 } });
    s.push({ type: 'assign', params: { var: V.xCut, value: `[${V.xCut}-${V.peck}]`, note: 'advance one peck' } });
    // …never past the floor: clamp before cutting, so a peck that does not divide evenly still stops on size
    s.push({ type: 'ifgoto', params: { lhs: V.xCut, op: '>', rhs: V.xFloor, goto: L + 3 } });
    s.push({ type: 'assign', params: { var: V.xCut, value: V.xFloor, note: 'clamp — the last advance lands ON the floor' } });
    s.push({ type: 'label', params: { n: L + 3 } });
    s.push({ type: 'move', params: { mode: 'cut', x: V.xCut, feed: V.feed } });
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xClear } });        // OUT, all the way — that is what clears the chips
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xCut } });          // …and back down to where it left off
    s.push({ type: 'ifgoto', params: { lhs: V.xCut, op: '>', rhs: V.xFloor, goto: L + 1 } });

    s.push({ type: 'label', params: { n: L + 2 } });
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xClear } });        // off the part first, always
    s.push({ type: 'move', params: { mode: 'rapid', z: String(round3(bar.allowance + clearance)) } });
    s.push({ type: 'progend', params: {} });
    return s;
}
