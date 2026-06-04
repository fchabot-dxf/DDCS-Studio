/**
 * DDCS Studio - G-code "dialect" layer (grammatical post)
 *
 * Sits on top of words.js. Where words.js owns *how a line is spelled*
 * (spacing, padding, EOL), this owns the controller's *grammar rules* — the
 * constructs whose correct form on DDCS M350 is least certain and most likely
 * to change: IF/GOTO syntax and the G53 machine-move form.
 *
 * DEFAULTS REPRODUCE CURRENT OUTPUT BYTE-FOR-BYTE. Assume the syntax is right
 * now; the `rules` object below is the back door for when controller testing
 * proves a rule wrong. Together, words.fmt (lexical) + dialect.rules
 * (grammatical) are the editable "post profile".
 */
import { w, G, line, raw } from './words.js';

/** The grammatical back door. Defaults = current output. */
export const rules = {
  ifBracket: false, // false: "IF #x!=2 GOTO1" (current) | true: "IF [#x!=2] GOTO1"
  gotoSpace: false, // false: "GOTO1" (current)          | true: "GOTO 1"
  g53Rapid: false,  // false: "G53 Z#v" (DDCS-correct)    | true: "G53 G0 Z#v" (FANUC form, fails on M350)
};

/** "GOTO" + label, honoring the spacing rule. Internal string helper. */
function gotoLabel(label, r) {
  return `GOTO${r.gotoSpace ? ' ' : ''}${label}`;
}

/** Bare jump: goto(2) → "GOTO2". */
export function goto(label, r = rules) {
  return line([raw(gotoLabel(label, r))]);
}

/**
 * Conditional jump: ifGoto('#1920', '!=', '2', 1) → "IF #1920!=2 GOTO1".
 * Honors bracket policy (simple vs [bracketed] condition) and GOTO spacing.
 */
export function ifGoto(lhs, op, rhs, label, r = rules) {
  const cond = `${lhs}${op}${rhs}`;
  const test = r.ifBracket ? `[${cond}]` : cond;
  return line([raw(`IF ${test} ${gotoLabel(label, r)}`)]);
}

/**
 * G53 machine-coordinate move: g53('Z', '#57', 'comment') → "G53 G0 Z#57 ( comment )".
 * With rules.g53Rapid=false it drops the (DDCS-incompatible) G0 → "G53 Z#57".
 */
export function g53(axis, value, comment, r = rules) {
  const words = r.g53Rapid ? [G(53), G(0), w(axis, value)] : [G(53), w(axis, value)];
  return line(words, comment);
}
