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
import { replayReconcile } from './opSession.js';                            // the declared Replace rebuild — the shared baseline for "would Replace lose something?" (acyclic: opSession doesn't import opGlow)
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

    // 1. Matches the clean rebuild from its stored params (_builderAtoms unwraps a self-wrapping builder — homing —
    //    so an unedited homing op isn't falsely flagged) → not edited at all.
    if (sig(op.children) === sig(_builderAtoms(op.opType, op.params))) return false;

    // 2. It differs from the stored-params rebuild — but a SURFACED edit (a value the form CAN represent) is still
    //    form-reconstructable, so a Replace would NOT lose it. Replay the DECLARED Replace path
    //    (opSession.replayReconcile): reconcile the live blocks back to params (untouched values sourced from STORED
    //    state, not the DOM — runs wizard-closed) and rebuild. If that reproduces the live stack, a form Replace
    //    loses nothing → not edited; an injection / unrepresentable residue won't reproduce → edited. Declaration
    //    via the reconcilers, never motion-inference. Fail-safe: no reconciler (replay null) → the forward-only
    //    answer (differs ⇒ edited) — precision rides on reconciler coverage.
    const rebuilt = replayReconcile(opId);
    return rebuilt ? sig(op.children) !== sig(rebuilt) : true;
}

export function editedLinesForOp(opId) {
    if (typeof window === 'undefined' || !window.ddcsGetBlockProgram || !window.ddcsGetProjection) return [];
    const op = _findOpById(window.ddcsGetBlockProgram() || [], opId);
    if (!op || !op.opType || !BUILDERS[op.opType] || !Array.isArray(op.children)) return [];
    // Same baseline as isOpBlockEdited: the declared Replace rebuild (so a SURFACED edit, which Replace regenerates,
    // doesn't glow) — falling back to the stored-params rebuild where there's no reconciler.
    const injected = collectInjectedIds(replayReconcile(opId) || _builderAtoms(op.opType, op.params), op.children);
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
 * to one token). Diffs the declared Replace rebuild's emit against the live stack's emit (no motion-inference).
 */
export function editedRangesForOp(opId) {
    if (typeof window === 'undefined' || !window.ddcsGetBlockProgram || !window.ddcsGetProjection) return [];
    const op = _findOpById(window.ddcsGetBlockProgram() || [], opId);
    if (!op || !op.opType || !BUILDERS[op.opType] || !Array.isArray(op.children)) return [];
    // Same baseline as isOpBlockEdited: the declared Replace rebuild (so a SURFACED edit doesn't glow), falling back
    // to the stored-params rebuild where there's no reconciler — one diff, three surfaces.
    const baseAtoms = replayReconcile(opId) || _builderAtoms(op.opType, op.params);
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

/**
 * A human-readable summary of an op's BLOCK-only edits — the residue a form Replace would DISCARD (and "Keep both"
 * preserves) — for the informed Merge/Replace modal. The SAME MID #1 diff as the chip/glow: collectEdits against the
 * declared Replace rebuild (replayReconcile), then render via the emitter (no second engine). Returns
 *   { injected: [gcodeLine…], overrides: [{ from, to }…] }   (each side as emitted G-code)
 * or null when there's no block-only residue (a clean op, or every edit is form-surfaced).
 */
export function opEditSummary(opId) {
    if (typeof window === 'undefined' || !window.ddcsGetBlockProgram) return null;
    const op = _findOpById(window.ddcsGetBlockProgram() || [], opId);
    if (!op || !op.opType || !BUILDERS[op.opType] || !Array.isArray(op.children)) return null;
    const base = replayReconcile(opId) || _builderAtoms(op.opType, op.params);   // the declared Replace baseline
    const { injected, overrides } = collectEdits(base, op.children);
    if (!injected.size && !overrides.length) return null;
    const o = dialectOpts();
    const actualEmit = emitMapped(op.children, o), baseEmit = emitMapped(base, o);
    const injectedLines = [];
    (actualEmit.map || []).forEach((anc, i) => { if (anc && anc.some((id) => injected.has(id))) injectedLines.push(actualEmit.lines[i]); });
    const ovr = overrides.map((ov) => ({
        from: _emitLinesOf(baseEmit, ov.base.id).map((i) => baseEmit.lines[i]).join('  '),
        to: _emitLinesOf(actualEmit, ov.actual.id).map((i) => actualEmit.lines[i]).join('  '),
    })).filter((x) => x.from || x.to);
    return { injected: injectedLines, overrides: ovr };
}

// recursive find-by-id over the block tree (atoms live in children; value pills live in params, not searched here).
function _findById(blocks, id) {
    for (const b of (blocks || [])) {
        if (!b) continue;
        if (b.id === id) return b;
        const f = _findById(b.children, id);
        if (f) return f;
    }
    return null;
}

// Localize ONE socket value's emitted token span(s) against a PRECOMPUTED base emit (so a caller batching many
// values doesn't recompute the base each time). Perturb just that value to a sentinel, re-emit, diff each line.
function _localizeValue(prog, baseEmit, o, ownerBlockId, paramKey) {
    const clone = JSON.parse(JSON.stringify(prog));
    const owner = _findById(clone, ownerBlockId);
    if (!owner || !owner.params || !(paramKey in owner.params)) return [];
    owner.params[paramKey] = 987654.321;                 // sentinel → a distinct token; only this value's span differs
    const pEmit = emitMapped(clone, o);
    // A value SOCKET never changes the line count. If it did, the param gates STRUCTURE (a cond / loop count), not a
    // token — the index-aligned diff below can't localize that, so bail. (Known residual: if the real value's emitted
    // digits coincide with the sentinel's tail, diffRange over-trims to an empty span → that line is skipped — a
    // missed highlight, never a wrong one. Acceptable graceful-degrade for a learner aid.)
    if (pEmit.lines.length !== baseEmit.lines.length) return [];
    const out = [];
    for (let i = 0; i < baseEmit.lines.length; i++) {
        if (baseEmit.lines[i] === pEmit.lines[i]) continue;
        const r = diffRange(pEmit.lines[i], baseEmit.lines[i]);   // span in the ORIGINAL (current) line
        if (r[1] > r[0]) out.push({ line: i, range: r });
    }
    return out;
}

/**
 * The EXACT emitted-token span(s) ONE socket value occupies — for hover-highlighting that value in the projected
 * code at WORD level. Declared by the emit (perturb + diff), never regex-guessed.
 *   ownerBlockId = the statement/leaf block holding the socket; paramKey = which value socket.
 * → [{ line, range:[start,end) }] over the CURRENT program's emit (one entry per line the value lands on), or [].
 */
export function valueTokenRanges(ownerBlockId, paramKey) {
    if (typeof window === 'undefined' || !window.ddcsGetBlockProgram) return [];
    const prog = window.ddcsGetBlockProgram() || [];
    const o = dialectOpts();
    return _localizeValue(prog, emitMapped(prog, o), o, ownerBlockId, paramKey);
}

/**
 * EVERY value-token span the emit places for a block SUBTREE — for "select a block → box its value tokens." Walks
 * the block (by id) and its descendants; for each finite-numeric param, localizes its token(s). One base emit, one
 * perturbation per value. Op-level params (which don't drive the emit — children carry the baked values) localize to
 * nothing, so selecting an op container yields []; selecting a leaf atom yields its own values. Deduped by line+span.
 */
export function valueRangesForSubtree(rootBlockId) {
    if (typeof window === 'undefined' || !window.ddcsGetBlockProgram) return [];
    const prog = window.ddcsGetBlockProgram() || [];
    const root = _findById(prog, rootBlockId);
    if (!root) return [];
    const o = dialectOpts(), baseEmit = emitMapped(prog, o);
    const seen = new Set(), out = [];
    (function walk(b) {
        if (!b) return;
        if (b.params) for (const k in b.params) {
            if (typeof b.params[k] !== 'number' || !isFinite(b.params[k])) continue;
            for (const { line, range } of _localizeValue(prog, baseEmit, o, b.id, k)) {
                const sig = line + ':' + range[0] + ':' + range[1];
                if (!seen.has(sig)) { seen.add(sig); out.push({ line, range }); }
            }
        }
        (b.children || []).forEach(walk);
    })(root);
    return out.sort((a, b) => a.line - b.line || a.range[0] - b.range[0]);
}
