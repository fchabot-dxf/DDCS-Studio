/**
 * wizards/lathe/facing.js — FACING, the lathe family's gated pilot (t1269).
 *
 * It faces the end of a bar: skim the raw material ahead of the finished face away, one pass at a time, until Z0 is
 * a clean face. The simplest turning operation there is — which is exactly why it is the pilot. Every mechanism the
 * family needs is proven HERE once (the frame, the one conversion, the parametric loop, the marker-derived handle),
 * and OD / parting / drilling inherit them rather than reinventing each.
 *
 * IT IS A READER. The frame, the diameter→radius conversion and the bar geometry are all decided in data/lathe.js;
 * nothing in this file re-derives any of them. If a number here disagrees with the canvas, that is a bug in one
 * consumer, not a difference of opinion between two.
 *
 * ── WHY THE LOOP LIVES ON THE CONTROLLER (user ruling) ────────────────────────────────────────────────────────────
 * The passes are NOT unrolled into a list of moves. The macro writes a `#var` config header and an IF/GOTO loop, the
 * same shape the corner probe uses, so the operator can change the allowance or the depth of cut ON THE MACHINE —
 * by editing a variable or through the CAM page's #2600+ mirrors — and the program adapts. An unrolled program is a
 * photograph of one set of numbers; this is the recipe.
 *
 * ── THE FRAME, restated where it is used ─────────────────────────────────────────────────────────────────────────
 * X is a RADIUS (the controller has no diameter mode), Z0 is the FINISHED FACE, and material sits in +Z ahead of it.
 * So facing steps DOWN in Z from the raw end toward Z0, and each pass cuts X from outside the bar to the centreline.
 */
import { radiusOf, normalizeBar } from '../../data/lathe.js';

/** The declared scratch variables this macro uses. Named here so the emit and the tests read the same table. */
export const FACING_VARS = {
    zCut: '#110',        // the Z this pass cuts at — the loop counter
    allowance: '#111',   // raw material ahead of Z0
    doc: '#112',         // depth of cut per pass
    xStart: '#113',      // X to start/retract to: bar radius + clearance
    feed: '#114',
};
export const FACING_LOOP_LABEL = 51;

export const FACING_DEFAULTS = {
    barDiameter: 20,
    stickOut: 60,
    allowance: 3,        // how much face to remove
    doc: 1,              // per pass
    finish: 0,           // an optional finishing skim at Z0; 0 = none
    clearance: 2,        // how far outside the bar to start/retract, in radius
    feed: 120,
    rpm: 900,
    tool: 1,
};

/**
 * THE PASS LIST — hand-derivable, and derived HERE so the emit and the tests cannot disagree about it.
 *
 * Facing removes `allowance` in steps of `doc`, cutting at each Z from the raw end DOWN to the finished face. The
 * last step is clamped to Z0 rather than overshooting into the part, and an exact division does not produce a
 * degenerate zero-depth pass at the end.
 * @returns {number[]} the Z of each pass, in cutting order, ending at 0 (the finished face)
 */
export function facingPasses({ allowance, doc, finish = 0 } = {}) {
    const a = Math.max(0, Number(allowance) || 0);
    const d = Math.max(0.001, Number(doc) || 0.001);
    const f = Math.max(0, Number(finish) || 0);
    // THE FLOOR is where ROUGHING STOPS: Z0 when there is no finish pass, or `finish` above it when there is —
    // that material is what the finishing skim removes. (First version read the floor as `allowance - finish`,
    // which is the amount removed, not the height stopped at; with no finish pass it made the floor the raw face
    // and the whole loop vanished. Caught by hand-deriving Ø20/3/1 and getting [3] instead of [2, 1, 0].)
    const floor = roughingFloor(f);
    // t1291 — A ZERO DEPTH OF CUT IS ONE SKIM AT THE FLOOR, matching the emit and the comment both. The loop below
    // steps by `d` (clamped to 0.001), so it would otherwise grind out thousands of passes for a zero step.
    if (!(Number(doc) > 0)) { const out0 = [round3(floor)]; if (f > 1e-9) out0.push(0); return out0; }
    // ANCHORED ON THE FLOOR, walking OUT to the raw end, then reversed — so when the material does not divide evenly
    // the LIGHT pass falls FIRST, through the sawn end, and every later pass is a full depth. (t1275: unified with OD
    // turning, which reasoned it out first. The two agree whenever the depth divides evenly, which is why the pilot's
    // hand-derived case — 3mm at 1mm/pass — is unchanged at [2, 1, 0].)
    const out = [];
    for (let z = round3(floor); z < a - 1e-9; z = round3(z + d)) out.push(z);
    out.reverse();
    if (!out.length) out.push(round3(floor));   // nothing to remove → one skim at the floor, never zero passes
    if (f > 1e-9) out.push(0);                  // …and the finishing pass lands on the finished face itself
    return out;
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/** Where ROUGHING STOPS in Z: the finished face, or `finish` above it when a finishing skim is declared. ONE notion,
 *  read by both the pass list and the emitted loop, so the trace and the macro cannot disagree about the last pass. */
export const roughingFloor = (finish) => Math.max(0, Number(finish) || 0);

/**
 * The facing macro as a block stack: a #var config header, a controller-side pass loop, a safe exit.
 * @param {object} p  FACING_DEFAULTS shape
 */
export function facingStack(p = {}) {
    const v = { ...FACING_DEFAULTS, ...p };
    const bar = normalizeBar({ diameter: v.barDiameter, stickOut: v.stickOut, allowance: v.allowance });
    const xStart = round3(radiusOf(bar.diameter) + Math.max(0, Number(v.clearance) || 0));   // ← the ONE conversion
    const V = FACING_VARS;
    const finish = Math.max(0, Number(v.finish) || 0);
    // THE SAME FLOOR facingPasses uses — where roughing stops. Reading it as "allowance − finish" was the bug the
    // hand-derived case caught, and it would have been worse here: the emitted loop would have exited immediately.
    const rough = round3(roughingFloor(finish));

    const s = [];
    s.push({ type: 'progstart', params: { clearance: 5, feed: v.feed } });
    // THE HEADER RESTATES NOTHING (t1275, the lesson OD learned by watching a drag): a comment is not a socket, and a
    // header claiming sizes the program no longer uses is a wrong operator message.
    s.push({ type: 'comment', params: { text: 'FACING — skim the raw end back to the finished face. Every size is a #var below.' } });
    // THE CONFIG HEADER: every number the operator might change, once, at the top where they can find it.
    s.push({ type: 'assign', params: { var: V.allowance, value: String(bar.allowance), note: 'material ahead of the face' } });
    s.push({ type: 'assign', params: { var: V.doc, value: String(v.doc), note: 'depth per pass' } });
    s.push({ type: 'assign', params: { var: V.xStart, value: String(xStart), note: 'bar radius + clearance (RADIUS)' } });
    s.push({ type: 'assign', params: { var: V.feed, value: String(v.feed), note: 'cutting feed' } });
    s.push({ type: 'spindle', params: { mode: 'cw', rpm: v.rpm } });
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xStart, z: String(bar.allowance) } });

    const L = FACING_LOOP_LABEL;
    // t1291 — A ZERO DEPTH OF CUT TAKES ONE SKIM, which is what this macro's own comment has always promised and
    // what the emit did not do: it jumped past the loop and the program silently cut NOTHING, with an allowance still
    // sitting on the face. "Just kiss the face" is a real thing to ask for, so it is what zero means — and the
    // alternative (greying the field) would refuse an operation rather than perform it. The comment and the emit
    // agree now, and a test pins the pair.
    //
    // It cannot fall into the loop below: that loop steps by #112, so a zero step would never terminate. One
    // explicit pass, then out.
    s.push({ type: 'ifgoto', params: { lhs: V.doc, op: '>', rhs: '0', goto: L } });
    s.push({ type: 'comment', params: { text: 'no depth per pass — one skim at the face' } });
    s.push({ type: 'move', params: { mode: 'rapid', z: String(rough) } });
    s.push({ type: 'move', params: { mode: 'cut', x: 0, feed: V.feed } });
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xStart } });
    s.push({ type: 'goto', params: { n: L + 3 } });
    s.push({ type: 'label', params: { n: L } });
    // COUNT THE PASSES BEFORE CUTTING ANY (no motion): stepping out from the floor finds the outermost pass, which is
    // what puts the light cut FIRST — through the sawn end, where an uneven bite belongs.
    s.push({ type: 'assign', params: { var: V.zCut, value: String(rough), note: 'count out from the roughing floor…' } });
    s.push({ type: 'label', params: { n: L + 1 } });
    s.push({ type: 'assign', params: { var: V.zCut, value: `[${V.zCut}+${V.doc}]` } });
    s.push({ type: 'ifgoto', params: { lhs: V.zCut, op: '<', rhs: V.allowance, goto: L + 1 } });
    s.push({ type: 'assign', params: { var: V.zCut, value: `[${V.zCut}-${V.doc}]`, note: '…and step back: the outermost pass' } });
    s.push({ type: 'ifgoto', params: { lhs: V.zCut, op: '>=', rhs: String(rough), goto: L + 2 } });
    s.push({ type: 'assign', params: { var: V.zCut, value: String(rough), note: 'nothing to remove — one skim at the face' } });
    s.push({ type: 'label', params: { n: L + 2 } });
    s.push({ type: 'move', params: { mode: 'rapid', z: V.zCut } });
    s.push({ type: 'move', params: { mode: 'cut', x: 0, feed: V.feed } });     // face to the centreline
    s.push({ type: 'move', params: { mode: 'rapid', x: V.xStart } });          // retract +X, clear of the bar
    s.push({ type: 'assign', params: { var: V.zCut, value: `[${V.zCut}-${V.doc}]`, note: 'step down' } });
    s.push({ type: 'ifgoto', params: { lhs: V.zCut, op: '>=', rhs: String(rough), goto: L + 2 } });
    s.push({ type: 'label', params: { n: L + 3 } });

    if (finish > 1e-9) {
        s.push({ type: 'comment', params: { text: `finish pass — ${finish} at the face` } });
        s.push({ type: 'move', params: { mode: 'rapid', z: '0' } });
        s.push({ type: 'move', params: { mode: 'cut', x: 0, feed: Math.max(1, Math.round(v.feed / 2)) } });
        s.push({ type: 'move', params: { mode: 'rapid', x: V.xStart } });
    }
    s.push({ type: 'move', params: { mode: 'rapid', z: String(round3(bar.allowance + 5)) } });   // clear of the part
    s.push({ type: 'progend', params: {} });
    return s;
}
