/**
 * blocks/opEdits.js — DECLARED block edits, per op. The form-vs-blocks divergence (the editor chip, the word/line
 * glow, the Merge/Replace guard) reads what the user ACTUALLY edited in Blockly — recorded once, when the change
 * event fires — instead of INFERRING it by diffing a fresh re-derivation against the live stack.
 *
 * Why declare, not infer: the blocks round-trip NORMALISES atom params (empty move sockets → `0`, so `G0 X#9` →
 * `G0 X#9 Y0 Z0`; a `#var` string → a `variable` record) in ways the clean BUILDERS rebuild doesn't. A diff-based
 * "edited?" can't tell that representation drift from a real edit, so it false-glows on a NO-EDIT round-trip — and
 * chasing each normalisation is whack-a-mole. Declaring the edit makes every such normalisation invisible by
 * construction (it never fired a user change event).
 *
 * Keyed: opId → Map<atomId, { paramKey?, from?, to? }>. Atom ids are STABLE across the blocks round-trip (stackBridge
 * preserves them), so a recorded edit survives open-as-blocks. A wizard Replace regenerates the op's atoms with FRESH
 * ids, so the old records no longer match any live atom → the consumers (which count only edits whose atom still
 * exists) treat a clean regenerate as un-edited automatically — no explicit reset needed.
 *
 * v1 scope: field edits + injected/moved atoms (the cases that drove the false glow). A pure DELETION isn't flagged
 * (its atom id is gone, nothing to match) — a known, documented gap vs the old inference; revisit with a per-op
 * structural marker if the delete-then-Replace clobber resurfaces.
 */
const _edits = new Map();   // opId → Map<atomId, detail>

function _bag(opId) { let m = _edits.get(opId); if (!m) _edits.set(opId, m = new Map()); return m; }

/** Record (or update) a declared edit: the op it belongs to, the model atom touched, and (for a value edit) which
 *  param + old/new — used for the word-level token glow and the informed Merge/Replace summary. */
export function recordEdit(opId, atomId, detail) { if (opId && atomId) _bag(opId).set(atomId, detail || {}); }

/** The op's declared edits as Map<atomId, detail>, or null if none. Consumers intersect this with the op's CURRENT
 *  atom ids (so a regenerated/Replaced op, whose atoms have new ids, reads as un-edited). */
export function opEditMap(opId) { return _edits.get(opId) || null; }

/** Drop an op's record outright (e.g. when the op is removed). Replace/regenerate doesn't need this — see above. */
export function clearOpEdits(opId) { _edits.delete(opId); }

// ── persistence ──────────────────────────────────────────────────────────────
// A block-edit must survive save → reload: `.mjson` saves the full stack (atoms WITH ids) but a reload fires no
// change event, so without this a loaded program's edits would read un-edited (a Replace would clobber them). The
// record is keyed by atom id, which the saved/loaded stack preserves, so it re-attaches on load.
/** The declared edits as plain JSON `{ opId: { atomId: detail } }`, for serializeProject. */
export function serializeOpEdits() {
    const out = {};
    for (const [opId, m] of _edits) { const o = {}; for (const [atomId, d] of m) o[atomId] = d; out[opId] = o; }
    return out;
}
/** Replace the record from a loaded program (clears first, so opening a clean program leaves nothing flagged). */
export function restoreOpEdits(obj) {
    _edits.clear();
    for (const opId in (obj || {})) { const m = _bag(opId), o = obj[opId] || {}; for (const atomId in o) m.set(atomId, o[atomId]); }
}
