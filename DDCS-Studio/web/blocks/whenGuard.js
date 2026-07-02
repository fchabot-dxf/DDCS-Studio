/**
 * blocks/whenGuard.js — the ONE `when` evaluator + the emit-side prune, shared by the SIM (viz/opSimStarts) and the
 * EMIT (blocks/userOps instantiate). A `when:{param,is}` guard includes a declared row/block only when params[param]
 * matches `is`.
 *
 * ② B4 M2 (the structural-toggle capability, built ONCE, corner-agnostic): pruneGuards lets a DATA template carry BOTH
 * arms of every structural fork — each arm wrapped in a `guard` block — and COLLAPSE to the chosen shape at build. So a
 * structural toggle (probeZFirst / travelApproach / wcs / syncA …) becomes a re-authorable, prune-selected branch of pure
 * data, NOT structure locked in a JS build function. `whenOk` lives here (moved from viz/opSimStarts) so emit + sim read
 * ONE evaluator — a probeZFirst Z-surface EMIT step and its Z-surface sim-start row are gated by the identical predicate.
 * (viz→blocks is the natural dependency direction; no blocks→viz edge.)
 */

/** Does a `{param,is}` guard hold for these params? No guard → always true. Boolean `is` coerces (!!v); else strict ===. */
export function whenOk(when, params) {
    if (!when) return true;
    const v = (params || {})[when.param];
    return typeof when.is === 'boolean' ? !!v === when.is : v === when.is;
}

/** Prune a block tree for a param state: DROP a `guard` subtree whose `when` is false; UNWRAP a surviving guard (splice
 *  its children up in place). Recurses children + uiChildren; mutates in place (the caller passes a deep clone). After
 *  prune, NO `guard` blocks remain — the tree is the concrete shape for `params`. Returns the same (mutated) array. */
export function pruneGuards(blocks, params) {
    if (!Array.isArray(blocks)) return blocks;
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (!b) { blocks.splice(i, 1); i--; continue; }
        if (b.type === 'guard') {
            if (!whenOk(b.params && b.params.when, params)) { blocks.splice(i, 1); i--; continue; }   // falsified → drop the whole subtree
            const kids = pruneGuards(b.children || [], params);   // satisfied → prune descendants first, then unwrap in place
            blocks.splice(i, 1, ...kids);
            i--;   // re-examine from the first spliced-in kid (a kid may itself be a guard — nested forks)
            continue;
        }
        if (b.children) pruneGuards(b.children, params);
        if (b.uiChildren) pruneGuards(b.uiChildren, params);
    }
    return blocks;
}
