/**
 * blocks/dataOps/deriveBindings.js — derive a user-op `bindings` array from DECLARATIVE specs.
 *
 * The shipped corner break (defect #1) was a HAND-COUNTED blockIndex: the map skipped the
 * `=== CONFIGURATION ===` comment, so every binding shifted by one and `registerUserOp` threw /
 * mis-bound. The fix is valid-by-construction: a spec names its target block by IDENTITY
 * (its `type` + a stable matcher — for an `assign`, its macro `var` like `#23`), never by a
 * literal position, and this helper RE-FINDS the flat index by scanning the freshly-flattened
 * stack. Because it derives over the ALREADY-WRAPPED stack, the `user_root/panel/sim/param_group`
 * prefix (the old `WRAP_PREFIX_COUNT = 4` hand-count) falls out for free, and a conditional block
 * that shifts positions (corner's `probeZFirst` → `#21`/`#22`, which shift `#23`/`#24`) is handled —
 * the scan lands on the right block every time. A zero/ambiguous/keyless match THROWS loudly at
 * build time (a real authoring error) instead of failing silently like an off-by-one.
 *
 * Reusable across every data-op port (drill/surfacing/slot/text/atcWarmup can adopt it later); for
 * now only corner uses it (do NOT migrate the siblings here). Depends on nothing but flattenBlocks.
 *
 * A spec row: { param, type, key, match, default?, label?, section? }
 *   match — how to identify the target block among the flattened stack:
 *     { type, var: '#23' }        an `assign` block whose params.var === '#23'   (the natural corner key)
 *     { type, params: {k:v,…} }   a block of `type` whose params match every (k,v)   (general form)
 *     { type }                    the SOLE block of that type in the stack
 *   key — the socket key on that block the binding drives (assign → 'value').
 *   default — OPTIONAL. If omitted, the binding default is READ from the matched socket's baked value — so a socket that
 *     holds an EXPRESSION default (e.g. corner's reposition #23 = '#15') keeps that expression when the param is unset,
 *     instead of an instantiate() overwrite reintroducing a wrong literal. (declare-never-infer: the template IS the default.)
 */
import { flattenBlocks } from '../userOps.js';

/** Does flattened block `blk` satisfy `match`? */
function matches(blk, match) {
    if (!blk || blk.type !== match.type) return false;
    if ('var' in match) return !!blk.params && String(blk.params.var) === String(match.var);
    if (match.params) {
        if (!blk.params) return false;
        for (const k in match.params) if (String(blk.params[k]) !== String(match.params[k])) return false;
    }
    return true;   // { type } alone → any block of that type (caller guarantees it's the sole one)
}

/**
 * Derive concrete bindings (with correct flat blockIndex) from declarative specs.
 * @param {Array} flatStack  the ALREADY-WRAPPED, ALREADY-FLATTENED block array (flattenBlocks(stack))
 * @param {Array} specs      the declarative binding specs (identity, not position)
 * @returns {Array}          bindings for userOpFromStack — { param, type, default, key, blockIndex, label?, section? }
 * @throws  if a spec matches != 1 block, or the matched block lacks the socket key.
 */
export function deriveBindings(flatStack, specs) {
    return specs.map((s) => {
        const hits = [];
        for (let i = 0; i < flatStack.length; i++) if (matches(flatStack[i], s.match)) hits.push(i);
        if (hits.length !== 1) {
            const how = ('var' in s.match) ? `${s.match.type} ${s.match.var}` : (s.match.type || '?');
            throw new Error(`deriveBindings: spec "${s.param}" matched ${hits.length} blocks (${how}); need exactly 1`);
        }
        const blockIndex = hits[0];
        if (!(s.key in (flatStack[blockIndex].params || {})))
            throw new Error(`deriveBindings: spec "${s.param}" → block ${blockIndex} has no socket key "${s.key}"`);
        const dflt = (s.default !== undefined) ? s.default : (flatStack[blockIndex].params || {})[s.key];
        const out = { param: s.param, type: s.type, default: dflt, key: s.key, blockIndex };
        if (s.label) out.label = s.label;
        if (s.section) out.section = s.section;
        return out;
    });
}

/** Convenience: flatten the wrapped stack, then derive. */
export function deriveBindingsFor(stack, specs) {
    return deriveBindings(flattenBlocks(stack), specs);
}
