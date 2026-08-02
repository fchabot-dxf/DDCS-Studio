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
 * ── t1514 (C5) — 3. ONE MOVE, TWO FRAMES, **ROTATED**. The live frame turns, and the origin is the pivot ──────────
 * Until here a LIVE origin refused the rotation, for the mechanical reason 1. above states: `X.c` is the axis's
 * build-time constant and a live frame has none — the origin is a register the machine fills in, so the mix had
 * nothing to mix. That reason was never that the rotation is unbakeable; it was that the origin had no NUMBER.
 *
 * The lift is that a register is a perfectly good operand for the SAME affine form. Write the coordinate as the
 * frame's own origin plus a relative offset — which is exactly what `ax(rel)`/`axE()` already print on a live frame —
 * and the rotation is about the ORIGIN ITSELF:
 *
 *      P' = O + R(θ)·(P − O)          O = the live origin (a register expression), θ = the baked angle
 *
 * The generic mix above rotates the WHOLE absolute coordinate about a build-time pivot, so the origin comes back out
 * of it with one correction, and the correction is exact and pivot-agnostic:
 *
 *      P' = [Pv + R(θ)(P − Pv)]  +  [I − R(θ)]·(O − Pv)
 *
 * (expand: Pv + R(P−Pv) + O − Pv − R(O−Pv) = O + R(P−O) ✓). `[I − R]` is two build-time constants per axis exactly
 * like R itself, so the origin's registers land in the word beside the walk's — the CROSS-TERMS this act is about,
 * `X = [k + <origin regs> * <baked> − #47 * <baked>]`. NO RUNTIME TRIG: every trigonometric quantity here is still
 * evaluated at BUILD time and reaches the controller as a number (data/trigEvidence.js is untouched by this, and the
 * bridge asserts it) — what is live is only the operands those numbers multiply.
 *
 * ⚠ t1526 — AND THIS MODULE NEVER LOOKS INSIDE THE ORIGIN WORD, which is what lets the caller shorten it. `ORG` and
 * `pivotBack` treat it as an opaque operand, so `surfaceraster` may HOIST a long live origin into a scratch register
 * and hand `#62` where it used to hand `[[5 + [#1/2] * 0.498] - [#2/2] * 0.498]`; the printed constants are the same
 * numbers and the walk is identical move for move. Nothing here changed for it, and that is the proof rather than a
 * side effect — see `raster-origin-hoist-1526`.
 *
 * A form declares which frame its constant is measured in: `AX` is ABSOLUTE (its `c` is the coordinate) and `AXX`/
 * `AXY` are ANCHORED (its `c` is the offset from the frame's own origin, and on a live frame the origin word joins
 * its terms). On a build-time frame the two are the same function — `AXX` IS `AX`, same arguments, same arithmetic —
 * which is what makes every existing rotated program byte-identical by construction rather than by a rounding
 * argument. The one form that is genuinely ABSOLUTE on both frames is the raster's row coordinate `#47`, which the
 * body computes as a whole coordinate rather than an offset; it stays `AX`, and the correction above handles it
 * without knowing that (the pivot is subtracted from the printed word, not from the register's runtime value).
 *
 * ── WHY SIX DECIMALS HERE (derived t1371; re-derived for the live frame at t1514) ───────────────────────────────────
 * Per coordinate the rotation is two multiplies by a baked constant and one add, ONCE — no recurrence, so nothing
 * compounds. Rounding c,s to d decimals bounds the coordinate error by `(|ex|+|ey|)·5·10^−(d+1)`; at 500mm offsets,
 * far beyond any real work area, d=6 gives 5·10⁻⁴ mm — HALF the emit's own 0.001mm quantum, so it cannot tip a rounded
 * digit. A RECURRENCE is a different problem and needs its own derivation: constants that multiply a vector fed back
 * through itself need nine (surfacing's helix, t1343; the bolt circle, t1379). This module is only the one-shot mix.
 *
 * ⚠ AND THE LIVE FRAME ADDS NO RECURRENCE — checked rather than assumed, because that is the one thing that would
 * change the answer. The raster's per-row offset is `#47 = origin + i·step`, recomputed from the row INDEX every row;
 * the ring's is `origin + i·inset`. Neither feeds its own previous value back, so the rotation still multiplies each
 * offset exactly once, from a fresh sum. (The one true recurrence in this family is the helix's rotating vector, which
 * carries its own nine decimals in `surfaceraster` and is not printed by this module.) The correction's `[I − R]` is a
 * second pair of one-shot constants on the same operands, so the bound is 2× the above — still an order of magnitude
 * under the quantum.
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
 * @param {boolean} o.pivotAtOrigin  t1514 — the rotation turns about the FRAME'S OWN origin rather than about the
 *                                   build-time pivot. That is what a BEARING is (the walk turns about the op's own
 *                                   datum), and it is the only pivot a live origin can be, since the origin is not a
 *                                   number the caller could have folded into one.
 */
export function affineFrame({ x0 = 0, y0 = 0, zTop = 0, live = null, rotAngle = 0, rotPivotX = 0, rotPivotY = 0, absorbs = true, pivotAtOrigin = false } = {}) {
    const F = live ? { ...live, live: true } : { x: String(r3(x0)), y: String(r3(y0)), z: String(zTop), live: false };
    /**
     * t1425 — A LIVE FRAME MAY CARRY A PLAIN NUMBER ON ONE AXIS, and folding it is what keeps that emit readable.
     *
     * Until now a live frame meant SKIM, whose three axes are always registers (`#62/#63/#64`), so this never arose.
     * A live-GEOMETRY frame can be mixed: a slot's X/Y are registers while its Z surface is still the build-time 0.
     * Without this fold every Z word would come out `[0 + 5]` — correct, and noise on every line of the program.
     * Existing callers are untouched by construction: `#62` is not a number, so nothing folds that did not before.
     */
    const NUMWORD = /^-?\d*\.?\d+$/;
    const fold = (word, rel) => (NUMWORD.test(word)
        ? `${r3(Number(word) + rel)}`
        : (rel ? `[${word} + ${r3(rel)}]` : `${word}`));
    const ax = (rel = 0) => (F.live ? fold(F.x, rel) : `${r3(x0 + rel)}`);
    const ay = (rel = 0) => (F.live ? fold(F.y, rel) : `${r3(y0 + rel)}`);
    const az = (rel = 0) => (F.live ? fold(F.z, rel) : `${r3(Number(zTop) + rel)}`);
    // origin + a build-time offset + a RUNTIME term. The offset folds into the origin when the origin is a number,
    // so a placed body keeps writing `[103.6 + #49 * 0.8]` rather than growing a `0 +` nobody asked for.
    const foldE = (word, rel, expr) => (NUMWORD.test(word)
        ? `[${r3(Number(word) + rel)} + ${expr}]`
        : (rel ? `[${word} + ${r3(rel)} + ${expr}]` : `[${word} + ${expr}]`));
    const axE = (rel, expr) => (F.live ? foldE(F.x, rel, expr) : `[${r3(x0 + rel)} + ${expr}]`);
    const ayE = (rel, expr) => (F.live ? foldE(F.y, rel, expr) : `[${r3(y0 + rel)} + ${expr}]`);
    const azE = (expr) => `[${F.z} ${expr}]`;        // expr carries its own sign, e.g. '- #46'

    const rot = (rotAngle && absorbs === true)
        ? { c: d6(Math.cos(rotAngle * Math.PI / 180)), s: d6(Math.sin(rotAngle * Math.PI / 180)), px: rotPivotX || 0, py: rotPivotY || 0 }
        : null;

    const TM = (reg, k = 1) => ({ reg, k });                     // a runtime term: a register × a build-time coefficient
    const AX = (word, c, terms = []) => ({ word, c, terms });    // one axis of a move: today's word + its affine form
    /**
     * t1514 — THE SAME AXIS FORM, ANCHORED ON THE FRAME'S OWN ORIGIN. `c` is what it has always been on a build-time
     * frame (`AXX` IS `AX` there, same arguments, same arithmetic — nothing to round differently), and on a LIVE frame
     * it is the offset from an origin the machine supplies, so the origin's word joins the terms and the form is
     * absolute again. Every coordinate this body prints is one or the other; declaring which is what lets the rotation
     * find the pivot instead of inferring it from a NaN.
     */
    const ORG = {
        x: (F.live && !NUMWORD.test(F.x)) ? { n: 0, w: F.x } : { n: F.live ? Number(F.x) : x0, w: null },
        y: (F.live && !NUMWORD.test(F.y)) ? { n: 0, w: F.y } : { n: F.live ? Number(F.y) : y0, w: null },
    };
    const anchored = (o, word, c, terms) => AX(word, c, o.w ? [TM(o.w), ...terms] : terms);
    const AXX = (word, c, terms = []) => anchored(ORG.x, word, c, terms);
    const AXY = (word, c, terms = []) => anchored(ORG.y, word, c, terms);
    /**
     * t1514 — THE ORIGIN IS THE PIVOT, so it comes back OUT of the mix it was just put through: `[I − R]·(O − Pv)`,
     * derived in the header. The numeric half lands in the word's constant, the live half in its terms — where it
     * MERGES with the same register's generic coefficient (`c + (1−c) = 1`, so an unrotated origin prints as a bare
     * `+ <origin>` with no multiply, which is both the correct arithmetic and the readable one).
     */
    const pivotBack = (xAxis) => {
        if (!pivotAtOrigin || !F.live) return { k: 0, terms: [] };
        const vx = { n: ORG.x.n - rot.px, w: ORG.x.w }, vy = { n: ORG.y.n - rot.py, w: ORG.y.w };
        const kx = 1 - rot.c, ky = xAxis ? rot.s : -rot.s;       // (I−R) row: x → [1−c, +s] · y → [−s, 1−c]
        const [a, b] = xAxis ? [kx, ky] : [ky, kx];              // …applied to (vx, vy) in that order
        return { k: a * vx.n + b * vy.n,
                 terms: [vx.w ? TM(vx.w, a) : null, vy.w ? TM(vy.w, b) : null].filter(Boolean) };
    };
    const rotTerms = (X, Y, xAxis, extra = []) => {
        const order = [], seen = new Set(), px = new Map(), qy = new Map(), add = new Map();
        const bump = (m, t) => { if (!seen.has(t.reg)) { seen.add(t.reg); order.push(t.reg); } m.set(t.reg, (m.get(t.reg) || 0) + t.k); };
        X.terms.forEach((t) => bump(px, t)); Y.terms.forEach((t) => bump(qy, t));
        extra.forEach((t) => bump(add, t));
        return order.map((reg) => {
            const a = px.get(reg) || 0, b = qy.get(reg) || 0;
            return { reg, k: d6((xAxis ? rot.c * a - rot.s * b : rot.s * a + rot.c * b) + (add.get(reg) || 0)) };
        }).filter((t) => t.k !== 0);
    };
    const rotWord = (X, Y, xAxis) => {
        const cx = X.c - rot.px, cy = Y.c - rot.py;
        const back = pivotBack(xAxis);
        const k0 = (xAxis ? rot.px + cx * rot.c - cy * rot.s : rot.py + cx * rot.s + cy * rot.c) + back.k;
        const terms = rotTerms(X, Y, xAxis, back.terms);
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

    return { F, ax, ay, az, axE, ayE, azE, TM, AX, AXX, AXY, mv, rot };
}
