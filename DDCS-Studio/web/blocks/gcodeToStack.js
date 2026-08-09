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
import { SAVE_PROBE_Z_MARK, RETURN_PROBE_Z_MARK } from '../data/simMarkers.js';   // t1207 — the DECLARED sim markers must SURVIVE the round-trip (see the machinemove branch)

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
// t1207 — is this trailing comment one of the DECLARED sim markers? Gated so every OTHER comment keeps today's
// byte-identical emit; only a declared marker is carried onto the block (and re-emitted) to close the round-trip.
const mark = (comment) => (comment === SAVE_PROBE_Z_MARK || comment === RETURN_PROBE_Z_MARK) ? comment : null;

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
    if (dialect && typeof dialect.recognize === 'function') {
        const r = dialect.recognize(code, comment);
        // t1207 — a DECLARED sim marker must survive whatever the dialect recognises the line as. The save line
        // `#95=#882 ( @saveProbeZ )` is claimed HERE (the Expert dialect reads it as a `readmachine`), and the
        // recognizer drops the trailing comment — so the editor's re-projection re-emitted a bare `#95=#882` and the
        // sim lost the save half of the declared save/return pair. Attaching it once, here, covers EVERY dialect
        // recognizer instead of patching each one (readmachine + machinemove both already emit `mark`).
        if (r) {
            if (mark(comment) && r.params && r.params.mark === undefined) r.params.mark = comment;
            return r;
        }
    }
    // 2) a full-line ( comment )
    if (/^\([^)]*\)$/.test(code)) return { type: 'comment', params: { text: code.slice(1, -1).trim() } };
    // 3) Pause — the universal program stop (M00) across all controllers
    if (code === 'M00') return { type: 'pause', params: {} };

    const G = (n) => new RegExp('\\bG0*' + n + '\\b', 'i').test(code);   // G4 ≡ G04 (leading zeros)
    const M = (n) => new RegExp('\\bM0*' + n + '\\b', 'i').test(code);
    const w = (L) => word(L, code);

    // t1650 — a G-word sharing its line with an M-word (e.g. "G21 G90 M3 S1000") packs more onto one physical
    // line than a single leaf atom's params can carry. Every branch below returns on its FIRST match, so without
    // this guard the M-word (spindle/coolant/tool/…) is silently DROPPED on re-projection — a production defect
    // (t838 SEND CONFIRM: a header line's M3 vanished, so a genuinely spindle-on program re-projected spindle-off
    // and the send gate's "green sends" path never fired). Bail to `raw` instead, same rule the M-code-with-args
    // case below already applies: can't fully reproduce the line → keep it verbatim, never lose data. Excludes
    // G53 (checked next), which deliberately carries a companion G0 — that combo already has its own home.
    if (!G(53) && /\bG0*\d+\b/i.test(code) && /\bM0*\d+\b/i.test(code)) return { type: 'raw', params: { text: raw } };

    // Machine-coordinate move (G53; may carry G0 on some dialects) — one axis.
    if (G(53)) {
        // t1207 — CARRY A DECLARED SIM MARKER through the round-trip. The trailing "( @returnProbeZ )" was stripped to the
        // side-channel `comment` and dropped here, so a re-emit (the editor is re-projected from the block model via
        // programModel setValue) produced a BARE `G53 Z#95`. The sim reads that marker off the raw line to restore the
        // saved probe depth, so losing it silently disabled the declared save/return pairing IN THE EDITOR HOST — the
        // G53 return degraded to the raw machine map and the next wall probed at the wrong height. The block already
        // emits `mark` (wizards/ops/macro.js), so preserving it here closes the loop. Gated to the DECLARED markers so
        // every other G53 comment keeps today's byte-identical emit.
        const mk = mark(comment);
        for (const ax of ['X', 'Y', 'Z', 'A']) {
            const v = w(ax);
            if (v !== undefined) return { type: 'machinemove', params: mk ? { axis: ax, to: v, mark: mk } : { axis: ax, to: v } };
        }
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
        const axes = (code.toUpperCase().match(/[XYZA](?=[-+.\d#[])/g) || []).filter((a, i, arr) => arr.indexOf(a) === i);   // include #var / [expr] axes (the probeAxis twin) so they survive the round-trip
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
    // Generic M-code → M-Code atom, but ONLY when the atom can reproduce the line: a bare `M<n>` (optionally
    // with a note). The atom emits just `M<code> ( note )`, so a line carrying ARGUMENTS (e.g. `M10 P4`,
    // `M31 P12`) would silently lose them on re-projection — fall through to the verbatim `raw` block instead so
    // the round-trip stays byte-exact and the sim still sees the P word.
    const mm = code.match(/^M0*(\d+)$/i);
    if (mm) return { type: 'mcode', params: comment ? { code: Number(mm[1]), note: comment } : { code: Number(mm[1]) } };

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
// Multi-line: collapse the DDCS-Expert wait-on-input poll (waitInputBlock's emit) back into ONE waitinput block —
// otherwise its WHILE/END lines fall to raw blocks. Matches: `WHILE [#[1520+N] != L] DO1` / `G04 P<ms>` / `END1`
// (L = 0|1). Gated to inputRead posts (the Expert) so it never collapses on a controller that can't re-emit it.
function matchWaitInputPoll(lines, i, opts) {
    const d = opts && opts.dialect;
    if (!(d && d.caps && d.caps.inputRead)) return null;
    const m = String(lines[i]).trim().match(/^WHILE\s*\[#\[1520\+(\d+)\]\s*!=\s*([01])\]\s*DO1\b/i);
    if (!m) return null;
    let j = i + 1; while (j < lines.length && !lines[j].trim()) j++;                          // next: the poll dwell
    if (j >= lines.length || !/^G0*4\s+P[\d.]+/i.test(lines[j].trim())) return null;
    let k = j + 1; while (k < lines.length && !lines[k].trim()) k++;                          // then: END1
    if (k >= lines.length || !/^END1\b/i.test(lines[k].trim())) return null;
    return { rec: { type: 'waitinput', params: { pin: Number(m[1]), mode: Number(m[2]) === 1 ? 'high' : 'low' } }, end: k };
}

export function parseGcodeToStack(text, opts = {}) {
    const out = [];
    let modalFeed = null;
    const lines = String(text || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
        const wi = matchWaitInputPoll(lines, i, opts);    // multi-line: WHILE-poll → one Wait Input block (else raw)
        if (wi) { out.push(wi.rec); i = wi.end; continue; }
        const rec = parseLine(lines[i], opts);
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
