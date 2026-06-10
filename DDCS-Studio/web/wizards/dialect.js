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
import { w, G, line, raw, comment, set } from './words.js';

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

/** WCS base addresses (stride 5, the DDCS rule — not FANUC stride 20). */
const WCS_BASE = { G54: 805, G55: 810, G56: 815, G57: 820, G58: 825, G59: 830 };

/**
 * WCS base-address setup for a probe sequence.
 * wcsBase('active') reads #578 → #70 = 805+[index-1]*5 ; wcsBase('G55') → #70=810.
 * Returns { code, label } (code ends in a blank line, matching wizard blocks).
 */
export function wcsBase(wcs) {
  if (wcs === 'active') {
    const code = comment('Read Active WCS') + '\n'
      + line([set('#71', '#578')], 'Active WCS index: 1=G54 2=G55 etc') + '\n'
      + line([set('#72', '[#71-1]')], 'Zero-based index') + '\n'
      + line([set('#70', '[805+[#72*5]]')], 'Base WCS address') + '\n\n';
    return { code, label: 'Active WCS' };
  }
  const code = comment(`Target: ${wcs}`) + '\n'
    + line([set('#70', String(WCS_BASE[wcs]))], 'Base WCS address') + '\n\n';
  return { code, label: wcs };
}
