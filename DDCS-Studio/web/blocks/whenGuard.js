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

/** Does a `{param,is}` condition hold for these params? No condition → always true. Forms: `{param, in:[…]}` = set
 *  membership; `{param, not:v}` = negation; `{param, is:v}` = equality (boolean `is` coerces !!v, else strict ===). The
 *  in/not forms (t566) let a form gate express "method ∈ {firmware,generic,disk}" / "≠ manual" the single `is` can't. */
export function whenOk(when, params) {
    if (!when) return true;
    const v = (params || {})[when.param];
    if (Array.isArray(when.in)) return when.in.includes(v);
    if ('not' in when) return v !== when.not;
    return typeof when.is === 'boolean' ? !!v === when.is : v === when.is;
}

// ── DERIVE-GUARDS hook (t469) — a per-op DECLARED derive fn that COMPUTES guard value(s) from the resolved params and
// INJECTS them into the prune params BEFORE pruneGuards, so a GEOMETRY-DERIVED fork (not any single user param) can key a
// guard. ONE-SOURCE: the derive lives on the def (`def.deriveGuards`), computed once, injected before prune — NOT hand-rolled
// into the emit. A LIVE fn (dropped on persistence, re-attached from the seed, exactly like setUserSimStock/simStartsProvider).
// Origin: pocket's `tooSmall` (a pocket smaller than the tool → a drill-plunge instead of a stepover), keyed on `_tooSmall`.
const USER_DERIVE_GUARDS = new Map();
/** Register (fn) / clear (null) a user op's derive-guards hook: `(resolvedParams) => ({ _key: value, … })`. */
export function setUserDeriveGuards(opType, fn) { if (typeof fn === 'function') USER_DERIVE_GUARDS.set(opType, fn); else USER_DERIVE_GUARDS.delete(opType); }
export function getUserDeriveGuards(opType) { return USER_DERIVE_GUARDS.get(opType) || null; }

/** Prune a block tree for a param state: DROP a `guard` subtree whose `when` is false; UNWRAP a surviving guard (splice
 *  its children up in place). Recurses children + uiChildren; mutates in place (the caller passes a deep clone). After
 *  prune, NO `guard` blocks remain — the tree is the concrete shape for `params`. Returns the same (mutated) array —
 *  or, for a mouth-keyed OBJECT children value (t2319, BACKLOG #21's sweep: split_horizontal/tab_group's own shape),
 *  the same (mutated-in-place, per-key) object. `childrenOf` (userOps.js) isn't the right tool here — it FLATTENS an
 *  object into one array, which would lose the LEFT/RIGHT (or TABS) grouping this function would need to write back
 *  into; every EXTERNAL caller only ever passes a plain array anyway (a deep-cloned stack), so this object branch is
 *  reached exclusively through the function's OWN children/uiChildren recursion below, on the object shape a split
 *  node's own children carry — pruning each of its mouth arrays in place, not merging them into one. */
export function pruneGuards(blocks, params) {
    if (Array.isArray(blocks)) {
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
    if (blocks && typeof blocks === 'object') {
        for (const key of Object.keys(blocks)) pruneGuards(blocks[key], params);   // each mouth's own array, pruned in place
        return blocks;
    }
    return blocks;
}
