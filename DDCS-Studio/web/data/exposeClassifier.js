/**
 * data/exposeClassifier.js — Universal CAM U1 classifier: which of a user-op's value bindings can be EXPOSED as a pendant
 * knob (a #var-carrying field) vs must be BAKED into the macro. A PURE function of TWO DECLARED facts — it NEVER re-reads
 * the emit output at runtime (declare, never infer; the emit-probe lives only in cam-expose-classify.spec.js as a guard):
 *
 *   1. the atom param ROLE (atomRoles.js) — 'value' rides a #var through emit; 'geometry' / 'other' destroy it.
 *   2. the op STACK STRUCTURE — a binding whose socket sits UNDER a coordinate-transforming fold is geometry-blocked. The
 *      fold's emit applies a NUMERIC-REGEX transform to its child output (blockEmitter.js): place → translateProgram (225),
 *      rotate → rotateProgram (234), skim → relativizeProgram (242); depth/fill/loop re-emit per level/pass/iteration and
 *      container(array)/path(helix) offset per stamp. The regex needs a digit after the letter (`X(-?\d*\.?\d+)`), so `X#n`
 *      never matches → the intended translate/rotate/relativize is SILENTLY DROPPED → the exposed coordinate is wrong. So
 *      even a role='value' coordinate is BAKE-ONLY beneath such a fold.
 *
 *   exposable = (role === 'value') AND (no blocking fold above the socket) AND (no program-level transform present).
 */
import { flattenBlocks } from '../blocks/userOps.js';
import { BLOCKS } from '../wizards/ops/index.js';
import { paramRole } from './atomRoles.js';

// Folds whose emit applies a coordinate transform / per-instance offset to child output → a #var beneath them is mangled.
// (loop is included per the F2 ruling: a socket under a loop may reference the loop index — a #var can't carry it — so the
// SAFE call is bake. Under-exposing only bakes; over-exposing emits wrong G-code.) cond/xform/flip are NOT here: cond
// re-emits once with no transform (a #var rides through fine); xform/flip transform by LINE RANGE, handled separately below.
export const BLOCKING_FOLD_KINDS = new Set(['place', 'rotate', 'skim', 'loop', 'depth', 'fill', 'container', 'path']);

// Program-level transform markers: emit nothing at their position, but applyProgramTransform / applySetupFlips rewrite a
// LINE RANGE of the whole program in emitMapped — so they can't be caught by tree ancestry. If any is present we
// conservatively block ALL exposure (a program rotation would mangle every coordinate #var). Rare in a single-op CAM stack.
const PROGRAM_TRANSFORM_KINDS = new Set(['xform', 'flip']);

const foldKindOf = (b) => (b && BLOCKS[b.type] ? BLOCKS[b.type].kind : null);
const DEFAULT_UNKNOWN = 'geometry';   // an unresolved socket (blk missing / atomType unknown) → geometry (safe, bake-only)

/**
 * The set of flat block indices (flattenBlocks / binding.blockIndex order) that sit UNDER a blocking fold. Walks the
 * template in the SAME pre-order flattenBlocks uses (block, then uiChildren, then children) so `idx` stays aligned, while
 * carrying a fold-ancestor flag down. A block's OWN fold-ness never blocks ITSELF — only its descendants.
 */
export function blockedIndices(template) {
    const blocked = new Set();
    let idx = 0;
    const walk = (blocks, underFold) => {
        for (const b of (blocks || [])) {
            if (!b) continue;                                   // flattenBlocks skips falsy the same way → indices align
            const myIndex = idx++;
            if (underFold) blocked.add(myIndex);
            const childUnderFold = underFold || BLOCKING_FOLD_KINDS.has(foldKindOf(b));
            walk(b.uiChildren, childUnderFold);                 // MUST be uiChildren before children (flattenBlocks order)
            walk(b.children, childUnderFold);
        }
    };
    walk(template, false);
    return blocked;
}

/**
 * Classify each VALUE binding of a user-op def as exposable or bake-only.
 * @param {object} def  a user-op def (userOpFromStack): { template, bindings, … }
 * @returns {object}    { [param]: { exposable:boolean, role:string, reason:string } } — one entry per value binding.
 */
export function classifyExposable(def) {
    const out = {};
    const template = (def && def.template) || [];
    // SAFETY (fail-closed) — a def carrying `bindingSpecs` (a guarded, hand-authored port: corner/pocket/edge/middle) has
    // FROZEN blockIndex computed over a CANONICAL-PRUNED stack, NOT over def.template (the guarded superset flattened here),
    // so flat[blockIndex] would MISALIGN and could misread fold-membership in the dangerous direction. instantiate() re-derives
    // indices per build (deriveBindings over the pruned clone) and validateUserOp skips the same lookup for exactly this reason
    // (userOps.js:488-495). Until this classifier mirrors that prune (exposability of a guarded def is guard-STATE-dependent —
    // a proper follow-on), expose NOTHING from such a def rather than risk a mis-aligned false-negative.
    const guardedUnreliable = !!(def && def.bindingSpecs);
    const flat = flattenBlocks(template);
    const blocked = blockedIndices(template);
    const hasProgramXform = flat.some((b) => PROGRAM_TRANSFORM_KINDS.has(foldKindOf(b)));
    for (const b of ((def && def.bindings) || [])) {
        if (!b || b.blockIndex == null) continue;               // structural bindings drive guards, not an emit socket
        if (guardedUnreliable) { out[b.param] = { exposable: false, role: 'unknown', reason: 'guarded/bindingSpecs def — socket index alignment not yet supported → bake-only (fail-closed)' }; continue; }
        const blk = flat[b.blockIndex];
        const atomType = blk && blk.type;
        const role = atomType ? paramRole(atomType, b.key) : DEFAULT_UNKNOWN;
        let exposable = false, reason = '';
        if (role !== 'value') reason = `${atomType || '?'}.${b.key} is ${role} (num()/enum-driven) — bake-only`;
        else if (blocked.has(b.blockIndex)) reason = `${atomType}.${b.key} sits under a coordinate-transforming fold — a #var would be mangled → bake-only`;
        else if (hasProgramXform) reason = `${atomType}.${b.key}: a program-level rotation/flip is present — a #var would be mangled → bake-only`;
        else { exposable = true; reason = `${atomType}.${b.key} rides through emit (val()) — exposable`; }
        out[b.param] = { exposable, role, reason };
    }
    return out;
}

/** Convenience: is a single binding exposable for this def? (delegates to classifyExposable — one source of truth) */
export function isExposable(def, param) {
    const c = classifyExposable(def)[param];
    return !!(c && c.exposable);
}
