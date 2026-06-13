/** wizards/ops/util.js — shared numeric atoms for the op-block kernels. */
export function num(v, d) { return (v === '' || v == null || isNaN(Number(v))) ? d : Number(v); }
export const r3 = (n) => Math.round(n * 1000) / 1000;
