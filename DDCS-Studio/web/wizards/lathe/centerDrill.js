/**
 * wizards/lathe/centerDrill.js — CENTER DRILLING (t1275). The simplest inheritor, and the only lathe op with no X.
 *
 * The drill is in the tailstock (or a holder on the cross-slide, set on centre); the work spins; the hole goes down
 * the axis. So the tool sits AT THE CENTRELINE — X0, not a radius — and the only motion that cuts is Z. That is worth
 * saying out loud because every other op in this family is about a radius, and the one that is not is exactly where a
 * "helpful" X would drill a hole off centre.
 *
 * ── STRAIGHT OR PECK ────────────────────────────────────────────────────────────────────────────────────────────
 * A short centre hole goes in one go. A deeper one packs chips, so the drill comes out to let them go — full retract
 * to clear, not a chip-break twitch, because on a lathe the chips have nowhere to go but back down the flute. The
 * peck is a controller-side IF/GOTO loop for the same reason every other lathe macro is one: the operator can change
 * the depth or the step at the machine and the program adapts.
 *
 * THE FRAME: Z0 is the FINISHED FACE and the hole runs −Z into the work, so a depth of 15 means the drill reaches
 * Z −15. The depth a person types is positive, because nobody says "drill minus fifteen deep".
 */
import { normalizeBar } from '../../data/lathe.js';

/** THE IDENTITY: one plunge, or several with the swarf let out between them. */
export const DRILL_KINDS = {
    straight: { id: 'straight', label: 'Straight', why: 'One plunge to depth. Right for a short centre hole.' },
    peck: { id: 'peck', label: 'Peck', why: 'Advance, retract fully to clear the swarf, go back down. Right for anything deep enough to pack chips.' },
};

/** The declared scratch variables. #160–#166, clear of the other three lathe ops. */
export const CDRILL_VARS = {
    zCut: '#160',     // how deep the drill has reached — the loop counter (a POSITIVE depth)
    depth: '#161',    // ← how deep the hole goes, from the finished face
    peck: '#162',     // ← how far to advance between full retracts
    feed: '#163',
    zSafe: '#164',    // clear Z, ahead of all material
    zEnd: '#165',     // derived: the Z of the bottom of the hole (negative)
    zNow: '#166',     // derived: the Z of the current peck bottom (negative)
};

/** 80 = the straight/peck fork, 81 = the peck loop, 82 = done. */
export const CDRILL_LOOP_LABEL = 80;

export const CDRILL_DEFAULTS = {
    kind: 'peck',
    barDiameter: 20,
    barAllowance: 1,
    depth: 15,        // from the finished face, positive
    peck: 5,
    clearance: 2,
    feed: 60,
    rpm: 1200,
};

const round3 = (n) => Math.round(n * 1000) / 1000;

/** The kind, normalized — an unknown value drills straight. */
export const drillKind = (kind) => (DRILL_KINDS[kind] ? kind : 'straight');

/**
 * THE PLUNGE BOTTOMS — hand-derivable, and derived HERE so the emit and the tests cannot disagree.
 *
 * Depth 15 pecking 5: the drill bottoms at −5, then −10, then −15. Straight: one bottom, at −15. An uneven step never
 * overshoots — the last peck lands exactly on depth.
 * @returns {number[]} the Z each plunge reaches, in order, all negative
 */
export function drillDepths(p = {}) {
    const v = { ...CDRILL_DEFAULTS, ...p };
    const depth = Math.max(0, Number(v.depth) || 0);
    const peck = Math.max(0, Number(v.peck) || 0);
    if (drillKind(v.kind) !== 'peck' || !(peck > 0)) return [round3(-depth)];
    const out = [];
    for (let d = round3(peck); d < depth - 1e-9; d = round3(d + peck)) out.push(round3(-d));
    out.push(round3(-depth));      // the last peck lands ON depth, never past it
    return out;
}

/**
 * The centre-drilling macro as a block stack.
 * @param {object} p  CDRILL_DEFAULTS shape
 */
export function centerDrillStack(p = {}) {
    const v = { ...CDRILL_DEFAULTS, ...p };
    const kind = drillKind(v.kind);
    const bar = normalizeBar({ diameter: v.barDiameter, stickOut: 60, allowance: v.barAllowance });
    const V = CDRILL_VARS;
    const L = CDRILL_LOOP_LABEL;
    const clearance = Math.max(0, Number(v.clearance) || 0);
    const peck = kind === 'peck' ? Math.max(0, Number(v.peck) || 0) : 0;

    const s = [];
    s.push({ type: 'progstart', params: { clearance: 5, feed: v.feed } });
    s.push({ type: 'comment', params: { text: 'CENTRE DRILL — down the axis, on centre. Every size is a #var below.' } });

    s.push({ type: 'assign', params: { var: V.depth, value: String(round3(Math.max(0, Number(v.depth) || 0))), note: 'hole DEPTH from the finished face' } });
    s.push({ type: 'assign', params: { var: V.peck, value: String(round3(peck)), note: 'advance between full retracts (0 = one plunge)' } });
    s.push({ type: 'assign', params: { var: V.feed, value: String(v.feed), note: 'drilling feed' } });
    s.push({ type: 'assign', params: { var: V.zSafe, value: String(round3(bar.allowance + clearance)), note: 'clear Z — ahead of all material' } });
    s.push({ type: 'assign', params: { var: V.zEnd, value: `[0-${V.depth}]`, note: 'the Z of the bottom of the hole' } });

    s.push({ type: 'spindle', params: { mode: 'cw', rpm: v.rpm } });
    // X0 — ON THE CENTRELINE. This is the one lathe op with no radius, and putting the drill anywhere else bores a
    // circle instead of drilling a hole.
    s.push({ type: 'move', params: { mode: 'rapid', x: 0, z: V.zSafe } });

    // NO PECK → one plunge. A zero step is not "peck a little", it is "go straight in", which is a real answer.
    s.push({ type: 'ifgoto', params: { lhs: V.peck, op: '>', rhs: '0', goto: L } });
    s.push({ type: 'move', params: { mode: 'cut', z: V.zEnd, feed: V.feed } });
    s.push({ type: 'goto', params: { n: L + 2 } });

    s.push({ type: 'label', params: { n: L } });
    s.push({ type: 'assign', params: { var: V.zCut, value: '0', note: 'how deep we are (a positive depth)' } });
    s.push({ type: 'label', params: { n: L + 1 } });
    s.push({ type: 'assign', params: { var: V.zCut, value: `[${V.zCut}+${V.peck}]`, note: 'advance one peck' } });
    // …never past depth: clamp before cutting, so an uneven peck still bottoms exactly on size
    s.push({ type: 'ifgoto', params: { lhs: V.zCut, op: '<', rhs: V.depth, goto: L + 3 } });
    s.push({ type: 'assign', params: { var: V.zCut, value: V.depth, note: 'clamp — the last peck lands ON depth' } });
    s.push({ type: 'label', params: { n: L + 3 } });
    s.push({ type: 'assign', params: { var: V.zNow, value: `[0-${V.zCut}]`, note: 'this peck bottoms here' } });
    s.push({ type: 'move', params: { mode: 'cut', z: V.zNow, feed: V.feed } });
    s.push({ type: 'move', params: { mode: 'rapid', z: V.zSafe } });          // ALL THE WAY OUT — that is what clears the flutes
    s.push({ type: 'move', params: { mode: 'rapid', z: V.zNow } });           // …back down to where it left off
    s.push({ type: 'ifgoto', params: { lhs: V.zCut, op: '<', rhs: V.depth, goto: L + 1 } });

    s.push({ type: 'label', params: { n: L + 2 } });
    s.push({ type: 'move', params: { mode: 'rapid', z: V.zSafe } });
    s.push({ type: 'progend', params: {} });
    return s;
}
