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
 *  params consumed by JS math (depth loops, stepover, geometry), which must stay numeric. */
export function val(v, d = 0, off = 0) {
    if (typeof v === 'string' && /[#[]/.test(v)) return v.trim();
    return r3(num(v, d) + off);
}
