/**
 * DDCS Studio - G-code "words" emitter (atom layer)
 *
 * A G-code "word" = one address letter + its value: G0, X#9, F#3, M30, N1.
 * Lines are sequences of words; blocks are sequences of lines. This module
 * owns ONLY how words/lines/blocks are spelled — spacing, padding, comment
 * placement, line endings. The flaky "dialect" rules (GOTO/IF/G53 form) are
 * composed from these one layer up.
 *
 * DEFAULTS REPRODUCE THE CURRENT GENERATOR OUTPUT BYTE-FOR-BYTE.
 * Assume the syntax is correct as-is; the `fmt` object below is the back door.
 *
 * ── Back doors (in increasing bluntness) ──────────────────────────────────
 *   1. Global:    mutate `fmt` once → every wizard re-renders in the new style.
 *   2. Per-call:  pass an `f` override to line()/block() to bend a single spot.
 *   3. Escape:    raw('exact text')  bypasses word rendering entirely; and
 *                 fmt.transform = (line, ctx) => line  rewrites every emitted line.
 */

/** The back door. Defaults = current output. */
export const fmt = {
  padGM: false,             // false: G0 / M3 (current)   |  true: G00 / M03
  sep: ' ',                 // ' ': "G0 X#9" (current)    |  '': "G0X#9"
  eol: '\n',                // '\n' (current)             |  '\r\n' for USB/Windows .nc
  comment: 'inline',        // 'inline' (current) | 'line' (own line above) | 'none' (strip)
  blankBetweenBlocks: '\n', // extra EOL appended by block() (current: one blank line) | '' for none
  transform: null,          // (renderedLine: string, ctx) => string — applied to every line()
};

/** A word: { letter, value }. value is raw text passed straight through. */
export const w = (letter, value = '') => ({ letter, value });

// Address-letter constructors (add more as wizards need them)
export const G = v => w('G', v), M = v => w('M', v), N = v => w('N', v);
export const X = v => w('X', v), Y = v => w('Y', v), Z = v => w('Z', v), A = v => w('A', v);
export const F = v => w('F', v), P = v => w('P', v), L = v => w('L', v), Q = v => w('Q', v);
export const S = v => w('S', v), T = v => w('T', v);

/** Assignment token: set('#51', '#1925') → "#51=#1925". (Not a letter-word; rendered raw.) */
export const set = (target, value) => ({ raw: `${target}=${value}` });

/** Escape hatch: emit exact text, bypassing word spelling (still honors comment + transform). */
export const raw = text => ({ raw: text });

function renderToken(tok, f) {
  if (tok && tok.raw !== undefined) return tok.raw;
  const { letter, value } = tok;
  if ((letter === 'G' || letter === 'M') && f.padGM && /^\d$/.test(String(value))) {
    return `${letter}0${value}`; // single-digit G/M → zero-padded
  }
  return `${letter}${value}`;
}

/**
 * Render one line: words joined by `sep`, with optional inline/own-line comment.
 * @param parts  a token or array of tokens (words / set / raw)
 * @param comment optional comment text (without parens)
 * @param f      optional per-call format override (falls back to global fmt)
 */
export function line(parts, comment, f = fmt) {
  const toks = Array.isArray(parts) ? parts : [parts];
  let code = toks.map(t => renderToken(t, f)).join(f.sep);
  if (comment && f.comment !== 'none') {
    code = f.comment === 'line'
      ? `( ${comment} )${f.eol}${code}`
      : `${code} ( ${comment} )`;
  }
  if (typeof f.transform === 'function') code = f.transform(code, { parts: toks, comment });
  return code;
}

/** Comment-only line: "( text )", or '' when comments are stripped. */
export function comment(text, f = fmt) {
  return f.comment === 'none' ? '' : `( ${text} )`;
}

/**
 * Stack lines into a block: join by `eol`, then append eol + blankBetweenBlocks.
 * Empty/blank entries are dropped. Returns text ending in the block separator,
 * so blocks concatenate the same way the current generators expect.
 */
export function block(lines, f = fmt) {
  const body = (Array.isArray(lines) ? lines : [lines]).filter(l => l != null && l !== '').join(f.eol);
  return `${body}${f.eol}${f.blankBetweenBlocks}`;
}
