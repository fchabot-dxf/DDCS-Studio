/**
 * blocks/opGlow.js — the form-vs-blocks DIFF surface: WHETHER an op is hand-edited, and WHERE.
 *
 * Three exports, one diff (the glow, the chip, and the Merge/Replace notice are the SAME diff at three surfaces):
 *   - isOpBlockEdited  → WHETHER an op's live blocks diverge from what its form params would rebuild (backs the
 *                        editor chip + the Merge/Replace gate that stops a form Replace from clobbering block edits).
 *   - editedLinesForOp → line-level glow: editor line indices owned by INJECTED atoms (back-compat).
 *   - editedRangesForOp → word-level glow: [{ line, range }] — the exact changed token, or whole-line.
 * All FORWARD-ONLY: they diff the clean BUILDERS(op.params) rebuild against the live block stack — never infer
 * intent from emitted motion (docs/archive/MULTI-OP-STACKING.md). Imports the BUILDERS leaf + the emitter; nothing imports back.
 */
import { BUILDERS, _builderAtoms } from './opBuilders.js';
import { emitMapped } from './blockEmitter.js';                               // emit a stack → { lines, map } (for word-level glow diff)
import { resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
const dialectOpts = () => { try { return { dialect: resolveActivePost(getActiveProfile().id) }; } catch (_) { return {}; } };

// Deep-strip BLOCK ids before a structural compare: drop `id` from any block-shaped object (one with a string
// `type`) anywhere in the tree — top-level atoms, their children, AND a block nested inside params (e.g.
// stepover.params.region). Block ids are counter-based and regenerated on every BUILDERS() call, so without this
// a fresh op looks hand-edited (false glow + false isOpBlockEdited on surfacing/pocket/contour). A value `id`
// (e.g. comm's destVar — a string on the params object, which has no `type`) is left intact.
function stripBlockIds(v) {
    if (Array.isArray(v)) return v.map(stripBlockIds);
    if (v && typeof v === 'object') {
        const o = {};
        for (const k in v) { if (k === 'id' && typeof v.type === 'string') continue; o[k] = stripBlockIds(v[k]); }
        return o;
    }
    return v;
}

// ── form-UNrepresentable edits → editor glow ──────────────────────────────────────────────────────────────
// editedLinesForOp(opId) → the projected editor line indices that come from atoms INJECTED in blocks: present in
// the op's live children but NOT producible by the form (BUILDERS(op.params)). Those are exactly the edits a form
// regenerate (Replace) would erase unseen, so the editor glows only them — never the whole op, never a
// form-settable change. Built on the projection map's per-line block ancestry (blockEmitter: `own = [...anc, id]`),
// so each injected atom's own id tags its own lines. SLICE A only (injections); a matched atom whose UNSURFACED
// param VALUE was edited is NOT flagged yet — that needs the reverse-synced baseline (see NEXT-TASKS).
const _structKeyGlow = (b) => {
    let k = b.type;
    if (b.type === 'assign') k += ':' + (b.params?.var || '');
    if (b.type === 'op') k += ':' + (b.opType || '');
    return k;
};
function _allBlockIds(b, into) { if (!b) return; if (b.id) into.add(b.id); (b.children || []).forEach((c) => _allBlockIds(c, into)); }
// Two matched blocks' OWN params differ (children/id excluded) → a value edited in Blocks (an override).
const _paramsDiffer = (a, b) => JSON.stringify(stripBlockIds((a && a.params) || {})) !== JSON.stringify(stripBlockIds((b && b.params) || {}));
// Walk the override-diff (base = clean form rebuild, actual = the live block stack). LCS-align by the merge's
// structural key, then classify each `actual` block:
//   - actual-only (no match in base) → INJECTED: the whole subtree is form-unrepresentable → acc.injected.
//   - matched but its OWN params were value-edited → an OVERRIDE: record BOTH sides (for the word-level diff);
//     recurse so an edit inside a kept container is caught.
// Both sides are forward emits (BUILDERS) — no inference.
function collectEdits(base, actual, acc = { injected: new Set(), overrides: [] }) {
    const bK = base.map(_structKeyGlow), aK = actual.map(_structKeyGlow);
    const L = Array.from({ length: base.length + 1 }, () => new Array(actual.length + 1).fill(0));
    for (let i = 1; i <= base.length; i++)
        for (let j = 1; j <= actual.length; j++)
            L[i][j] = bK[i - 1] === aK[j - 1] ? L[i - 1][j - 1] + 1 : Math.max(L[i - 1][j], L[i][j - 1]);
    let i = base.length, j = actual.length;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && bK[i - 1] === aK[j - 1]) {
            if (_paramsDiffer(base[i - 1], actual[j - 1])) acc.overrides.push({ id: actual[j - 1].id, base: base[i - 1], actual: actual[j - 1] });
            collectEdits(base[i - 1].children || [], actual[j - 1].children || [], acc);   // matched → recurse
            i--; j--;
        } else if (j > 0 && (i === 0 || L[i][j - 1] >= L[i - 1][j])) {
            _allBlockIds(actual[j - 1], acc.injected);   // actual-only → injected (with its subtree)
            j--;
        } else { i--; }                                  // base-only → a deletion (nothing in the editor to glow)
    }
    return acc;
}
// The injected ids PLUS the override ids — the set editedLinesForOp glows whole-line (line-level, back-compat).
function collectInjectedIds(base, actual) {
    const { injected, overrides } = collectEdits(base, actual);
    overrides.forEach((o) => injected.add(o.id));
    return injected;
}
function _findOpById(prog, id) {
    for (const b of (prog || [])) {
        if (!b) continue;
        if (b.type === 'op' && b.id === id) return b;
        if (b.children) { const f = _findOpById(b.children, id); if (f) return f; }
    }
    return null;
}

// Smallest changed [start, end) slice between two strings — trim the common prefix + suffix. start >= end ⇒ identical.
function diffRange(b, a) {
    const max = Math.min(a.length, b.length);
    let p = 0; while (p < max && a[p] === b[p]) p++;
    let s = 0; while (s < max - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    return [p, a.length - s];
}
// Line indices in an emit owned by block `id` — the own id is the LAST element of each line's ancestry (blockEmitter: own=[...anc,id]).
function _emitLinesOf(emit, id) {
    const out = [];
    (emit.map || []).forEach((anc, i) => { if (anc && anc[anc.length - 1] === id) out.push(i); });
    return out;
}

/** True if a top-level op's blocks were hand-edited away from what its form params would rebuild — so a
 *  form-driven Insert/replace would clobber them. Compares the live children to a fresh build, block ids stripped. */
export function isOpBlockEdited(opId) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const op = cur.find((b) => b && b.type === 'op' && b.id === opId);
    if (!op || !op.opType || !BUILDERS[op.opType]) return false;

    const sig = (a) => JSON.stringify((a || []).map(stripBlockIds));

    // 1. Check if it matches the last known form params (_builderAtoms unwraps a self-wrapping builder — homing —
    //    so an unedited homing op isn't falsely flagged as block-edited)
    const bare = _builderAtoms(op.opType, op.params);
    if (sig(op.children) === sig(bare)) return false; // Not edited at all

    // 2. It diverges structurally from the form rebuild → block-edited. We do NOT try to prove it "form-safe"
    // by reverse-syncing the blocks back to params: that's the banned inference (docs/archive/MULTI-OP-STACKING.md),
    // and the field-id↔param adapter never worked anyway (it always fell through to `return true`). The
    // override-diff glow + the Merge/Replace notice handle this forward-only.
    return true;
}

export function editedLinesForOp(opId) {
    if (typeof window === 'undefined' || !window.ddcsGetBlockProgram || !window.ddcsGetProjection) return [];
    const op = _findOpById(window.ddcsGetBlockProgram() || [], opId);
    if (!op || !op.opType || !BUILDERS[op.opType] || !Array.isArray(op.children)) return [];
    const injected = collectInjectedIds(_builderAtoms(op.opType, op.params), op.children);
    if (!injected.size) return [];
    const map = (window.ddcsGetProjection() || {}).map || [];
    const out = [];
    map.forEach((anc, i) => { if (anc && anc.some((id) => injected.has(id))) out.push(i); });
    return out;
}

/**
 * Like editedLinesForOp but WORD-LEVEL: the editor overlay data as [{ line, range }]. `range` = a [start, end)
 * char span within the line — glow just the value token a Blocks edit changed in an otherwise form-generated line
 * — or `null` = whole-line (an INJECTED atom is a wholly new line; a multi-line / container override can't localize
 * to one token). Forward-only: diffs the clean form rebuild's emit against the live stack's emit (no inference).
 */
export function editedRangesForOp(opId) {
    if (typeof window === 'undefined' || !window.ddcsGetBlockProgram || !window.ddcsGetProjection) return [];
    const op = _findOpById(window.ddcsGetBlockProgram() || [], opId);
    if (!op || !op.opType || !BUILDERS[op.opType] || !Array.isArray(op.children)) return [];
    const baseAtoms = _builderAtoms(op.opType, op.params);
    const { injected, overrides } = collectEdits(baseAtoms, op.children);
    if (!injected.size && !overrides.length) return [];
    const liveMap = (window.ddcsGetProjection() || {}).map || [];
    const seen = new Set(), out = [];
    const pushLine = (i, range) => { if (!seen.has(i)) { seen.add(i); out.push({ line: i, range }); } };
    // injected atoms → whole-line on every editor line they own (the subtree)
    liveMap.forEach((anc, i) => { if (anc && anc.some((id) => injected.has(id))) pushLine(i, null); });
    // overrides → word-level when the atom is a single-line leaf; else whole-line
    if (overrides.length) {
        const o = dialectOpts();
        const actualEmit = emitMapped(op.children, o), baseEmit = emitMapped(baseAtoms, o);
        for (const ov of overrides) {
            const liveLines = []; liveMap.forEach((anc, i) => { if (anc && anc[anc.length - 1] === ov.actual.id) liveLines.push(i); });
            const aLines = _emitLinesOf(actualEmit, ov.actual.id), bLines = _emitLinesOf(baseEmit, ov.base.id);
            if (liveLines.length === 1 && aLines.length === 1 && bLines.length === 1) {
                const r = diffRange(baseEmit.lines[bLines[0]], actualEmit.lines[aLines[0]]);
                pushLine(liveLines[0], r[1] > r[0] ? r : null);   // empty diff (e.g. only an id changed) → whole-line
            } else {                                              // container / multi-line override → whole-line under it
                liveMap.forEach((anc, i) => { if (anc && anc.some((id) => id === ov.actual.id)) pushLine(i, null); });
            }
        }
    }
    return out.sort((x, y) => x.line - y.line);
}
