/**
 * blocks/opGlow.js — the form-vs-blocks DIFF surface: WHETHER an op is hand-edited, and WHERE.
 *
 * Four exports over the user's DECLARED edits (opEdits) — NOT inferred by re-derivation:
 *   - isOpBlockEdited  → WHETHER an op has a live declared block edit (backs the editor chip + the Merge/Replace gate
 *                        that stops a form Replace from clobbering block edits).
 *   - editedLinesForOp → line-level glow: editor line indices owned by edited atoms.
 *   - editedRangesForOp → word-level glow: [{ line, range }] — the exact changed token (old→new emit diff), or whole-line.
 *   - opEditSummary    → the residue a form Replace would discard (for the informed Merge/Replace modal).
 * Declaring the edit (a recorded change event) — instead of diffing a re-derivation against the live stack — means a
 * blocks round-trip's representation drift (empty move sockets → 0, #var → record) can never read as a FALSE edit.
 * Also home to the value-token localizers (valueTokenRanges / valueRangesForSubtree) for hover/select highlighting.
 */
import { emitMapped } from './blockEmitter.js';                               // emit a stack → { lines, map } (for word-level glow diff)
import { opEditMap } from './opEdits.js';                                     // the user's DECLARED edits per op (replaces inferring "edited" by re-derivation)
import { findOpById as _findOpById } from './programModel.js';                // t1958 — the ONE recursive by-id lookup (was a private duplicate here, drifted from wizardManager's own broken shallow one)
import { resolveActivePost } from '../wizards/dialects/index.js';
import { getActiveProfile } from '../shared/js/profiles/controllerProfiles.js';
const dialectOpts = () => { try { return { dialect: resolveActivePost(getActiveProfile().id) }; } catch (_) { return {}; } };

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

/** True if a top-level op has a DECLARED block edit still live in it — so a form-driven Insert/Replace would clobber
 *  it. "Declared" = the user changed a block and the change event was recorded (opEdits); we count only edits whose
 *  atom STILL EXISTS in the op (a Replace regenerates atom ids, so its old records match nothing → auto un-edited).
 *  No re-derivation: a round-trip's representation drift never fired a change event, so it can never read as edited. */
export function isOpBlockEdited(opId) {
    const cur = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    const op = _findOpById(cur, opId);
    const em = op && opEditMap(opId);
    if (!em || !em.size) return false;
    for (const atomId of em.keys()) if (_findById(op.children, atomId)) return true;
    return false;
}

export function editedLinesForOp(opId) {
    if (typeof window === 'undefined' || !window.ddcsGetBlockProgram || !window.ddcsGetProjection) return [];
    const op = _findOpById(window.ddcsGetBlockProgram() || [], opId);
    const em = op && opEditMap(opId);
    if (!em || !em.size) return [];
    const live = new Set([...em.keys()].filter((id) => _findById(op.children, id)));   // declared edits whose atom still exists
    if (!live.size) return [];
    const map = (window.ddcsGetProjection() || {}).map || [];
    const out = [];
    map.forEach((anc, i) => { if (anc && anc.some((id) => live.has(id))) out.push(i); });
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
    const prog = window.ddcsGetBlockProgram() || [];
    const op = _findOpById(prog, opId);
    const em = op && opEditMap(opId);
    if (!em || !em.size) return [];
    const o = dialectOpts(), baseEmit = emitMapped(prog, o);
    const liveMap = (window.ddcsGetProjection() || {}).map || [];
    const seen = new Set(), out = [];
    const pushLine = (i, range) => { if (!seen.has(i)) { seen.add(i); out.push({ line: i, range }); } };
    for (const [atomId, detail] of em) {
        if (!_findById(op.children, atomId)) continue;            // atom gone (Replace) → not edited
        // a recorded VALUE edit with its prior value → word-level: the exact changed token (old→new emit diff)
        if (detail && detail.paramKey && detail.from !== undefined) {
            const ranges = _localizeEdit(prog, baseEmit, o, atomId, detail.paramKey, detail.from);
            if (ranges.length) { ranges.forEach((r) => pushLine(r.line, r.range)); continue; }
        }
        // a structural / non-localizable edit → whole-line on every line the atom owns
        liveMap.forEach((anc, i) => { if (anc && anc[anc.length - 1] === atomId) pushLine(i, null); });
    }
    return out.sort((x, y) => x.line - y.line);
}

/**
 * A human-readable summary of an op's BLOCK-only edits — the residue a form Replace would DISCARD (and "Keep both"
 * preserves) — for the informed Merge/Replace modal. Reads the SAME declared edit source as the chip/glow
 * (`opEditMap`, above), then renders each edit via the emitter (no second engine). Returns
 *   { injected: [gcodeLine…], overrides: [{ from, to }…] }   (each side as emitted G-code)
 * or null when there's no block-only residue (a clean op, or every edit is form-surfaced).
 *
 * t2004 — this used to claim a `collectEdits` step diffing against "the declared Replace rebuild (replayReconcile)".
 * Neither is true today: there is no `collectEdits` function anywhere in the codebase (grepped), and `replayReconcile`
 * (opSession.js) has zero live callers (t1992, independently reconfirmed t1998) — this function, like its three
 * siblings above, reads `opEditMap` directly. Named, not silently re-pointed: whether the comment described an
 * earlier, since-refactored mechanism or was simply never true is unverified — a stale claim that vouched for a
 * mechanism nobody was running is exactly what let `replayReconcile`'s own dead-caller state go unnoticed this long.
 */
export function opEditSummary(opId) {
    if (typeof window === 'undefined' || !window.ddcsGetBlockProgram) return null;
    const op = _findOpById(window.ddcsGetBlockProgram() || [], opId);
    const em = op && opEditMap(opId);
    if (!em || !em.size) return null;
    const o = dialectOpts(), emit = emitMapped(op.children, o);
    const injected = [], ovr = [];
    for (const [atomId, detail] of em) {
        if (!_findById(op.children, atomId)) continue;            // atom gone (Replace) → nothing to discard
        if (detail && detail.paramKey && (detail.from !== undefined || detail.to !== undefined)) {
            ovr.push({ from: String(detail.from ?? ''), to: String(detail.to ?? '') });   // a value override: old → new
        } else {
            _emitLinesOf(emit, atomId).forEach((i) => injected.push(emit.lines[i]));        // an injected atom: its emitted G-code
        }
    }
    if (!injected.length && !ovr.length) return null;
    return { injected, overrides: ovr };
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
    // A geometry param (a fill's height) multiplies the toolpath: at the huge sentinel the row count explodes and emit
    // can overflow (push(...bigArray)). Such a param gates STRUCTURE, not a token — bail, exactly like the line-count
    // guard below. (It would fail that guard anyway; catching the throw just gets there without crashing the caller.)
    let pEmit; try { pEmit = emitMapped(clone, o); } catch { return []; }
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

// Localize the token a recorded value edit CHANGED: emit a clone with the param at its OLD value, diff vs current
// (which holds the new value) → the [start,end) span in the CURRENT line where new differs from old. Uses the real
// from→to delta (no sentinel), so it can't collide with the value's own digits the way the hover localizer can.
function _localizeEdit(prog, baseEmit, o, atomId, paramKey, fromVal) {
    const clone = JSON.parse(JSON.stringify(prog));
    const atom = _findById(clone, atomId);
    if (!atom || !atom.params || !(paramKey in atom.params)) return [];
    atom.params[paramKey] = fromVal;
    const oldEmit = emitMapped(clone, o);
    if (oldEmit.lines.length !== baseEmit.lines.length) return [];
    const out = [];
    for (let i = 0; i < baseEmit.lines.length; i++) {
        if (baseEmit.lines[i] === oldEmit.lines[i]) continue;
        const r = diffRange(oldEmit.lines[i], baseEmit.lines[i]);   // span in the CURRENT (new) line
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
