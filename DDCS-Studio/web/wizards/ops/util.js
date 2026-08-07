/** wizards/ops/util.js — shared numeric atoms for the op-block kernels. */
export function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }
export const r3 = (n) => Math.round(n * 1000) / 1000;

/** Shift every absolute Z word in emitted lines by dz — used to bake a path Z-offset INTO a kernel's output so
 *  it rides the block stack (survives commit/edit), not a post-translate the round-trip would drop. */
export function shiftZ(lines, dz) {
    const d = Number(dz) || 0;
    if (!d) return lines;
    return lines.map((ln) => ln.replace(/Z(-?\d*\.?\d+)/g, (_, z) => 'Z' + r3(parseFloat(z) + d)));
}

/** A value WORD that's emitted straight into G-code (a coordinate / feed / rpm / port). A `#var` or `[expr]`
 *  string passes through verbatim (so a probe can go to #8 at feed #3, a Move can rapid to #9, …); a literal
 *  is rounded (+ optional offset for stamped placement). Used only where a #var is meaningful — NOT for
 *  params consumed by JS math (depth loops, stepover, geometry), which must stay numeric.
 *
 *  t1575 — AND SO DOES A BROKEN EXPRESSION, ON PURPOSE. Anything that is not a number and not empty now rides
 *  out verbatim rather than collapsing to the declared default. `X position = widht / 2` used to emit `G0 X0`
 *  — a perfectly legal line the machine runs happily, at the wrong place, with the typo laundered away. It now
 *  emits `G0 Xwidht / 2`, which the V4.1 REFUSES by name and never executes (bench-confirmed 2026-08-07:
 *  `Unrecognized file format: L11[…]`, quoting the line back). Refusing at the right line beats moving to the
 *  wrong one.
 *
 *  The two callers this collapses already disagreed: `resolveParams` kept the raw string on a failed parse
 *  while `resolveValue` turned it into NaN. Keeping the string is the correct half, so the string reaching
 *  here is exactly the author's text — and it must survive INTACT, which is why nothing rounds or offsets it.
 *
 *  ⚠ AN UNRESOLVABLE RUNTIME VALUE IS NOT THIS. `#500`, a probe result, `#1512` after an alignment are
 *  unknowable at authoring time BY DESIGN and are handled by the `#`/`[` branch above, unchanged — the
 *  controller's read-as-0 is the correct semantic for those. This branch only ever sees a string that already
 *  failed to parse as an expression, i.e. malformed syntax or an identifier Studio's own declared parameter
 *  list does not contain.
 *
 *  KNOWN LIMIT (shared with the pre-existing `#var` branch): a verbatim word cannot carry the placement
 *  `off`set, because there is no number to add it to. A placed op whose coordinate is a broken expression
 *  therefore emits the author's text unplaced — which the machine rejects anyway, so the offset is moot. */
export function val(v, d = 0, off = 0) {
    if (typeof v === 'string' && /[#[]/.test(v)) return v.trim();
    if (typeof v === 'string' && v.trim() !== '' && !Number.isFinite(Number(v))) return v.trim();
    return r3(num(v, d) + off);
}
