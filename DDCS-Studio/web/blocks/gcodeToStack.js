/**
 * blocks/gcodeToStack.js — G-code text → a stack of LEAF atom-block records ({type, params}).
 *
 * The inverse of blockModel.emit for the LINE-LEVEL atoms: turns hand-written / pasted / round-tripped G-code
 * into proper, field-editable blocks instead of opaque text. Each recognized line maps to a typed leaf
 * (move/arc/spindle/feed/dwell/coolant/tool/wcs/distmode/comment/mcode/endprogram); anything unrecognized
 * becomes a `raw` block that emits verbatim, so the round-trip never loses a line.
 *
 * HIGH-LEVEL ops are NOT recovered. A Fill/Array/Step-Down emits many derived lines from a few params; those
 * params are gone in the expansion, so reverse-recognizing them is CAM feature-recognition (lossy). High-level
 * ops stay forward-only (wizard/palette create them). So: low-level G-code round-trips through blocks; the
 * structure of high-level ops does not.
 *
 * Dialect: most leaf emits are dialect-independent, so the parser is too. The few that differ (dwell P-units,
 * G53 machine-move, M30) are matched best-effort; pass { dwellSeconds:true } when the source used seconds (NGC)
 * rather than the DDCS default of milliseconds.
 */
import { BLOCKS } from '../wizards/ops/index.js';   // op kinds → detect high-level vs leaf programs

// A token value: a #var (#99 / #base), a [bracket expr], or a signed/decimal number. #vars and [exprs] stay
// strings (they emit verbatim); plain numbers become numbers so they round-trip through val()/r3().
const VAL = '(#[A-Za-z0-9_.]+|\\[[^\\]]*\\]|[-+]?\\d*\\.?\\d+)';
function word(letter, code) {
    const m = code.match(new RegExp(letter + VAL, 'i'));
    if (!m) return undefined;
    const v = m[1];
    if (/[#[]/.test(v)) return v;            // #var / [expr] → keep literal
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
}
// Drop keys whose value is undefined, so emit omits unset axes (a bare `G0 X#9` stays single-axis).
function pick(o) { const r = {}; for (const k in o) if (o[k] !== undefined) r[k] = o[k]; return r; }

/** Parse one physical line → a leaf record, or null for a blank/seam line. `opts.dialect` (active controller)
 *  decodes the dialect-specific ops via dialect.recognize; `opts.dialect.dwellUnits` sets the dwell P unit. */
export function parseLine(line, opts = {}) {
    const raw = String(line);
    const trimmed = raw.trim();
    if (!trimmed) return null;                                                  // blank / seam
    // Strip a whitespace-separated trailing comment ("   ( … )"). An ATTACHED "(x)" stays part of the code —
    // that's how DDCS HMI vars look (`#1505=1(Continue?)`) and how messages look, and keeping it round-trips.
    const cm = raw.match(/\s\(([^)]*)\)\s*$/);
    const comment = cm ? cm[1].trim() : null;
    const code = (cm ? raw.slice(0, cm.index) : raw).trim();
    if (!code) return comment != null ? { type: 'comment', params: { text: comment } } : null;

    const dialect = opts.dialect;
    // 1) dialect-specific forms first — the active controller's parse inverse (IF/GOTO/label/probe/HMI/WCS…),
    //    co-located with its emit. Some forms even look like comments (RS274 "(MSG,…)"), so this precedes the
    //    full-line-comment rule. Must also precede the generic assign/ifgoto/core below.
    if (dialect && typeof dialect.recognize === 'function') { const r = dialect.recognize(code, comment); if (r) return r; }
    // 2) a full-line ( comment )
    if (/^\([^)]*\)$/.test(code)) return { type: 'comment', params: { text: code.slice(1, -1).trim() } };
    // 3) Pause — the universal program stop (M00) across all controllers
    if (code === 'M00') return { type: 'pause', params: {} };

    const G = (n) => new RegExp('\\bG0*' + n + '\\b', 'i').test(code);   // G4 ≡ G04 (leading zeros)
    const M = (n) => new RegExp('\\bM0*' + n + '\\b', 'i').test(code);
    const w = (L) => word(L, code);

    // Machine-coordinate move (G53; may carry G0 on some dialects) — one axis.
    if (G(53)) {
        for (const ax of ['X', 'Y', 'Z', 'A']) { const v = w(ax); if (v !== undefined) return { type: 'machinemove', params: { axis: ax, to: v } }; }
        return { type: 'raw', params: { text: raw } };
    }

    // Motion + modal G-codes (order matters: G31 before G3/G1, G2 before nothing, etc.)
    if (G(31)) return { type: 'move', params: pick({ mode: 'probe', x: w('X'), y: w('Y'), z: w('Z'), feed: w('F') }) };
    if (G(2)) return { type: 'arc', params: pick({ arc: 'cw', x: w('X'), y: w('Y'), i: w('I'), j: w('J'), feed: w('F') }) };
    if (G(3)) return { type: 'arc', params: pick({ arc: 'ccw', x: w('X'), y: w('Y'), i: w('I'), j: w('J'), feed: w('F') }) };
    if (G(1)) return { type: 'move', params: pick({ mode: 'cut', x: w('X'), y: w('Y'), z: w('Z'), feed: w('F') }) };
    if (G(0)) return { type: 'move', params: pick({ mode: 'rapid', x: w('X'), y: w('Y'), z: w('Z') }) };
    if (G(4)) { const p = w('P'); const ms = !dialect || dialect.dwellUnits !== 's'; return { type: 'dwell', params: { sec: typeof p === 'number' ? (ms ? p / 1000 : p) : p } }; }
    for (let n = 54; n <= 59; n++) if (G(n)) return { type: 'wcs', params: { wcs: 'G' + n } };
    if (G(17)) return { type: 'plane', params: { plane: 'G17' } };
    if (G(18)) return { type: 'plane', params: { plane: 'G18' } };
    if (G(19)) return { type: 'plane', params: { plane: 'G19' } };
    if (G(90)) return { type: 'distmode', params: { dist: 'abs' } };
    if (G(91)) return { type: 'distmode', params: { dist: 'inc' } };
    if (G(94)) return { type: 'feedmode', params: { fmode: 'G94' } };
    if (G(95)) return { type: 'feedmode', params: { fmode: 'G95' } };
    if (G(28)) {   // reference return → Home; recover the referenced axes from their words
        const axes = (code.toUpperCase().match(/[XYZA](?=[-+.\d])/g) || []).filter((a, i, arr) => arr.indexOf(a) === i);
        return { type: 'home', params: { axes: axes.join('') || 'Z' } };
    }

    // M-codes
    if (M(3) || M(4)) return { type: 'spindle', params: pick({ rpm: w('S'), dir: M(4) ? 'ccw' : 'cw' }) };
    if (M(5)) return { type: 'spindle', params: { rpm: 0, dir: 'cw' } };
    if (M(6)) { const t = w('T'); return { type: 'tool', params: { n: t !== undefined ? t : 1 } }; }
    if (M(8)) return { type: 'coolant', params: { flow: 'flood' } };
    if (M(7)) return { type: 'coolant', params: { flow: 'mist' } };
    if (M(9)) return { type: 'coolant', params: { flow: 'off' } };
    if (M(30) || M(2)) return { type: 'endprogram', params: {} };
    if (code === 'M0') return { type: 'stop', params: { stop: 'M0' } };   // program stop atom (exact 'M00' → pause atom, above)
    if (code === 'M1') return { type: 'stop', params: { stop: 'M1' } };   // optional stop atom
    if (M(98)) { const p = w('P'); if (typeof p === 'number') return { type: 'call', params: { prog: p } }; }   // numeric P only (a #var P can't round-trip through call.emit)
    if (M(99)) return { type: 'return', params: {} };
    const mm = code.match(/\bM0*(\d+)\b/i);
    if (mm) return { type: 'mcode', params: { code: Number(mm[1]) } };

    // Feed-only line (F with no G/M word)
    if (/^F/i.test(code) && w('F') !== undefined) return { type: 'feed', params: { rate: w('F') } };

    // 2) macro-var write `#var = expr` (dialect-independent) — AFTER the dialect probe-reads (#x=#sys) so those win.
    if (/^#/.test(code) && code.includes('=')) {
        const i = code.indexOf('=');
        const v = code.slice(0, i).trim(), expr = code.slice(i + 1).trim();
        if (v) return { type: 'assign', params: comment ? { var: v, value: expr, note: comment } : { var: v, value: expr } };
    }

    return { type: 'raw', params: { text: raw } };   // unrecognized → verbatim (never loses a line)
}

/** Parse a G-code program → an array of leaf block records (blank/seam lines are dropped).
 *  Feedrate is modal (mirror of blockModel's applyModalFeed): a cut/probe/arc line with no F inherits the
 *  current feed, so a block emits the right F on re-projection and the round-trip stays byte-exact. Only an F
 *  attached to a motion line tracks modal — a standalone `F300` (feed op) is left as its own block. */
export function parseGcodeToStack(text, opts = {}) {
    const out = [];
    let modalFeed = null;
    for (const line of String(text || '').split('\n')) {
        const rec = parseLine(line, opts);
        if (!rec) continue;
        if (rec.type === 'arc' || (rec.type === 'move' && (rec.params.mode === 'cut' || rec.params.mode === 'probe'))) {
            if (typeof rec.params.feed === 'number') modalFeed = rec.params.feed;            // an F sets the modal feed
            else if (rec.params.feed === undefined && modalFeed !== null) rec.params.feed = modalFeed;  // no F → inherit
            else if (typeof rec.params.feed === 'string') modalFeed = null;                  // F#var/[expr] → modal unknown
        }
        out.push(rec);
    }
    return out;
}

// ── editor → stack reconciliation (the write direction) ───────────────────────────────────────────────
const WRAPPER_KINDS = new Set(['container', 'path', 'loop', 'cond', 'depth', 'fill']);
const isLeafRecord = (r) => { const d = BLOCKS[r.type]; return !!d && !WRAPPER_KINDS.has(d.kind) && !(r.children && r.children.length); };

/** Is every top-level record a plain leaf (no high-level wrapper, no children)? An empty stack counts as leaf. */
export const isAllLeaf = (stack) => (stack || []).every(isLeafRecord);

/**
 * Reconcile edited projected G-code back into the block stack. Returns the NEW stack, or null when it can't be
 * done as text. The block stack is the source of truth, so:
 *   - all-leaf (or empty) program → re-parse the edited text into leaf blocks (lossless: leaf G-code round-trips).
 *   - program contains a HIGH-LEVEL op (Fill / Array / Step Down …) → null. Those ops emit many *derived* lines
 *     from a few scoped params; an edited derived line can't be mapped back to a param, so text editing would
 *     destroy the parametric op. Edit those via the blocks/fields or the per-op form editor instead.
 */
export function reconcileGcodeToStack(editedText, currentStack, opts = {}) {
    if (!isAllLeaf(currentStack)) return null;
    return parseGcodeToStack(editedText, opts);
}
