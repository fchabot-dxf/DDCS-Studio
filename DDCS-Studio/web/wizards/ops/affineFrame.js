/**
 * wizards/ops/affineFrame.js — HOW A PARAMETRIC ATOM PRINTS A COORDINATE. One source, two atoms (t1381).
 *
 * ── WHY THIS IS A MODULE AND NOT A SECOND COPY ─────────────────────────────────────────────────────────────────────
 * `surfaceraster` grew this over four turns (t1351 the frame, t1355 the skim frame, t1375 the rotation mix). The drill
 * family needs the IDENTICAL mechanism for the identical reason: its pattern points are RUNTIME register values, so a
 * rotation cannot be applied to the emitted text afterwards — rotation COUPLES the axes, and a text rewrite that can
 * only find one of the two axis words leaves the other behind. t1353 measured what that produces: a move that gains a
 * second axis word, which is uncommanded motion on a cutting line.
 *
 * So the choice was between a second copy of `rotWord` and one shared printer. A second copy is the drift the
 * one-source rule exists for, and the thing that would drift is the arithmetic that decides where the tool goes.
 * Extracted rather than duplicated, with surfacing's emit asserted BYTE-IDENTICAL across the matrix that exercises
 * every path through it (plain / placed / rotated / skim / rotated+placed) — see the extraction bridge.
 *
 * ── THE TWO IDEAS IT CARRIES ───────────────────────────────────────────────────────────────────────────────────────
 * 1. ONE BODY, TWO FRAMES. Every coordinate is "the op's origin PLUS an offset". `ax(rel)` folds that sum at BUILD
 *    time when the origin is a number (so a placed op emits `X3.6`, byte-for-byte what an unframed one emitted), and
 *    leaves it as an expression when the origin is a REGISTER the machine fills in at run time (`X[#35 + 3.6]`).
 *    `axE()` is the same idea when the offset is itself a runtime term.
 *
 * 2. ONE MOVE, TWO FRAMES. `mv()` prints the X and Y words of one move. Each axis arrives declared TWICE: the word the
 *    body has always emitted, and the same coordinate as an AFFINE FORM — a build-time constant plus runtime terms,
 *    each a register times a build-time coefficient. Unrotated, the declared word is printed verbatim, so every
 *    existing config is byte-identical and this is a no-op. Rotated, only the affine form can say what happens:
 *
 *        X' = px + (Cx−px)·c − (Cy−py)·s   +   Σ (c·pᵢ − s·qᵢ)·tᵢ
 *        Y' = py + (Cx−px)·s + (Cy−py)·c   +   Σ (s·pᵢ + c·qᵢ)·tᵢ
 *
 *    The pivot moves the POINT, so it belongs to the constant; a runtime term is a VECTOR from that point, so it
 *    rotates WITHOUT the pivot and its two coefficients simply mix. The machine still evaluates the same SHAPE it
 *    already did — `[<number> + #reg * <number> - #reg * <number>]` — so nothing here reaches for an unproven form.
 *
 *    A term may be absent from one axis: a row's Y offset does not move X at 0°, its coefficient there is zero, and the
 *    rotation is what gives it one. That is why a SINGLE-AXIS move has to grow its partner — a straight step in the
 *    body's own frame is a diagonal in the rotated one — so every call passes both axes' forms even where only one word
 *    is emitted today.
 *
 * ── WHY SIX DECIMALS HERE (derived t1371) ──────────────────────────────────────────────────────────────────────────
 * Per coordinate the rotation is two multiplies by a baked constant and one add, ONCE — no recurrence, so nothing
 * compounds. Rounding c,s to d decimals bounds the coordinate error by `(|ex|+|ey|)·5·10^−(d+1)`; at 500mm offsets,
 * far beyond any real work area, d=6 gives 5·10⁻⁴ mm — HALF the emit's own 0.001mm quantum, so it cannot tip a rounded
 * digit. A RECURRENCE is a different problem and needs its own derivation: constants that multiply a vector fed back
 * through itself need nine (surfacing's helix, t1343; the bolt circle, t1379). This module is only the one-shot mix.
 */
import { r3 } from './util.js';

export const d6 = (n) => Number(n.toFixed(6));

/**
 * Build the coordinate printers for one atom body.
 *
 * @param {object}  o
 * @param {number}  o.x0 o.y0        the op's origin in work coords (the absorbed placement frame)
 * @param {number|string} o.zTop     the surface depths are measured down from — a number, or a register when live
 * @param {?object} o.live           a RUNTIME frame: { x, y, z } register names (the skim frame). null = build-time.
 * @param {number}  o.rotAngle       a declared program rotation, in degrees (0 = none)
 * @param {number}  o.rotPivotX o.rotPivotY   the rotation pivot
 * @param {boolean} o.absorbs        whether this body absorbs the rotation (an atom that refuses gets rot = null)
 */
export function affineFrame({ x0 = 0, y0 = 0, zTop = 0, live = null, rotAngle = 0, rotPivotX = 0, rotPivotY = 0, absorbs = true } = {}) {
    const F = live ? { ...live, live: true } : { x: String(r3(x0)), y: String(r3(y0)), z: String(zTop), live: false };
    const ax = (rel = 0) => (F.live ? (rel ? `[${F.x} + ${r3(rel)}]` : `${F.x}`) : `${r3(x0 + rel)}`);
    const ay = (rel = 0) => (F.live ? (rel ? `[${F.y} + ${r3(rel)}]` : `${F.y}`) : `${r3(y0 + rel)}`);
    const az = (rel = 0) => (F.live ? (rel ? `[${F.z} + ${r3(rel)}]` : `${F.z}`) : `${r3(Number(zTop) + rel)}`);
    // origin + a build-time offset + a RUNTIME term. The offset folds into the origin when the origin is a number,
    // so a placed body keeps writing `[103.6 + #49 * 0.8]` rather than growing a `0 +` nobody asked for.
    const axE = (rel, expr) => (F.live ? (rel ? `[${F.x} + ${r3(rel)} + ${expr}]` : `[${F.x} + ${expr}]`) : `[${r3(x0 + rel)} + ${expr}]`);
    const ayE = (rel, expr) => (F.live ? (rel ? `[${F.y} + ${r3(rel)} + ${expr}]` : `[${F.y} + ${expr}]`) : `[${r3(y0 + rel)} + ${expr}]`);
    const azE = (expr) => `[${F.z} ${expr}]`;        // expr carries its own sign, e.g. '- #46'

    const rot = (rotAngle && absorbs === true)
        ? { c: d6(Math.cos(rotAngle * Math.PI / 180)), s: d6(Math.sin(rotAngle * Math.PI / 180)), px: rotPivotX || 0, py: rotPivotY || 0 }
        : null;

    const TM = (reg, k = 1) => ({ reg, k });                     // a runtime term: a register × a build-time coefficient
    const AX = (word, c, terms = []) => ({ word, c, terms });    // one axis of a move: today's word + its affine form
    const rotTerms = (X, Y, xAxis) => {
        const order = [], seen = new Set(), px = new Map(), qy = new Map();
        const bump = (m, t) => { if (!seen.has(t.reg)) { seen.add(t.reg); order.push(t.reg); } m.set(t.reg, (m.get(t.reg) || 0) + t.k); };
        X.terms.forEach((t) => bump(px, t)); Y.terms.forEach((t) => bump(qy, t));
        return order.map((reg) => {
            const a = px.get(reg) || 0, b = qy.get(reg) || 0;
            return { reg, k: d6(xAxis ? rot.c * a - rot.s * b : rot.s * a + rot.c * b) };
        }).filter((t) => t.k !== 0);
    };
    const rotWord = (X, Y, xAxis) => {
        const cx = X.c - rot.px, cy = Y.c - rot.py;
        const k0 = xAxis ? rot.px + cx * rot.c - cy * rot.s : rot.py + cx * rot.s + cy * rot.c;
        const terms = rotTerms(X, Y, xAxis);
        // A ROTATED ORIGIN INSIDE AN EXPRESSION IS AN INTERMEDIATE, NOT A COORDINATE — the same distinction t1339 drew
        // for the ramp's direction cosine, caught the same way. Alone in an axis word it IS the coordinate the machine
        // moves to, so it takes the emit's own 0.001mm quantum. Inside brackets the machine adds a runtime term to it,
        // so rounding it first pushes that half-quantum into the SUM: measured on a pivot away from the datum, every
        // point landed one quantum off the literal truth until this carried six decimals like every other coefficient.
        if (!terms.length) return `${r3(k0)}`;
        return `[${d6(k0)}${terms.map((t) => (t.k === 1 ? ` + ${t.reg}` : t.k === -1 ? ` - ${t.reg}`
            : (t.k > 0 ? ` + ${t.reg} * ${t.k}` : ` - ${t.reg} * ${-t.k}`))).join('')}]`;
    };
    const mv = (X, Y) => (rot
        ? `X${rotWord(X, Y, true)} Y${rotWord(X, Y, false)}`
        : [X.word != null ? `X${X.word}` : null, Y.word != null ? `Y${Y.word}` : null].filter(Boolean).join(' '));

    return { F, ax, ay, az, axE, ayE, azE, TM, AX, mv, rot };
}
