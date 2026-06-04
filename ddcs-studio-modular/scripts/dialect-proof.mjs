/**
 * Proof for src/wizards/dialect.js
 *
 * 1. Defaults reproduce current grammatical forms exactly.
 * 2. The back door (rules) flips IF/GOTO/G53 syntax — including the G53 G0 fix.
 *
 * Run: node scripts/dialect-proof.mjs
 */
import { rules, ifGoto, goto, g53 } from '../src/wizards/dialect.js';

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = got === want;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) { console.log(`   want: ${JSON.stringify(want)}`); console.log(`   got:  ${JSON.stringify(got)}`); }
  ok ? pass++ : fail++;
};

console.log('── Defaults: reproduce current forms ──');
eq('ifGoto !=',     ifGoto('#1920', '!=', '2', 1),            'IF #1920!=2 GOTO1');
eq('ifGoto ==',     ifGoto('#1922', '==', '0', 1),            'IF #1922==0 GOTO1');
eq('goto',          goto(2),                                   'GOTO2');
eq('g53 (G0 form)', g53('Z', '#57', 'Restore to saved probe height'),
                                                               'G53 G0 Z#57 ( Restore to saved probe height )');

console.log('\n── Back door: flip the flaky rules ──');
rules.g53Rapid = false;
eq('g53 FIX (drop G0)', g53('Z', '#57', 'Restore to saved probe height'),
                                                               'G53 Z#57 ( Restore to saved probe height )');
rules.g53Rapid = true;

rules.gotoSpace = true;
eq('goto spaced',       goto(2),                               'GOTO 2');
eq('ifGoto spaced',     ifGoto('#1920', '!=', '2', 1),         'IF #1920!=2 GOTO 1');
rules.gotoSpace = false;

rules.ifBracket = true;
eq('ifGoto bracketed',  ifGoto('#1920', '!=', '2', 1),         'IF [#1920!=2] GOTO1');
rules.ifBracket = false;

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
