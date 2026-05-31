/**
 * Proof for src/wizards/words.js
 *
 * 1. With DEFAULT fmt, words.js reproduces current middle-wizard lines byte-for-byte.
 * 2. The back door (fmt overrides + transform + raw) bends syntax on demand.
 *
 * Run: node scripts/words-proof.mjs
 */
import { fmt, G, X, Z, F, P, L, Q, set, raw, line, comment } from '../src/wizards/words.js';

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = got === want;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) { console.log(`   want: ${JSON.stringify(want)}`); console.log(`   got:  ${JSON.stringify(got)}`); }
  ok ? pass++ : fail++;
};

// ── 1. Byte-for-byte reproduction of CURRENT output (default fmt) ──
console.log('── Default fmt: reproduce current middle-wizard lines ──');
eq('G91 modal',        line([G(91)], 'Incremental mode'),                         'G91 ( Incremental mode )');
eq('G31 fast probe',   line([G(31), X('#8'), F('#3'), P('#5'), L('0'), Q('1')], 'Fast probe'),
                                                                                  'G31 X#8 F#3 P#5 L0 Q1 ( Fast probe )');
eq('G0 retract',       line([G(0), X('#9')], 'Retract'),                          'G0 X#9 ( Retract )');
eq('save edge',        line([set('#51', '#1925')], 'Save edge'),                  '#51=#1925 ( Save edge )');
eq('center calc',      line([set('#53', '[#51+#52]/2')], 'Average of two edges'), '#53=[#51+#52]/2 ( Average of two edges )');
eq('G53 restore',      line([G(53), G(0), Z('#57')], 'Restore to saved probe height'),
                                                                                  'G53 G0 Z#57 ( Restore to saved probe height )');
eq('WCS write',        line([set('#[#70+0]', '#53')], 'Set Active WCS X to center'),
                                                                                  '#[#70+0]=#53 ( Set Active WCS X to center )');
eq('comment only',     comment('=== BOSS: Probe from outside each side ==='),     '( === BOSS: Probe from outside each side === )');

// ── 2. Back door: bend syntax without touching wizards ──
console.log('\n── Back door demonstrations ──');

// 2a. global override: zero-pad G/M
fmt.padGM = true;
eq('padGM → G00',      line([G(0), X('#9')], 'Retract'),                          'G00 X#9 ( Retract )');
fmt.padGM = false;

// 2b. per-call override: drop word spacing for one line
eq('per-call sep="" ', line([G(0), X('#9')], 'Retract', { ...fmt, sep: '', comment: 'none' }), 'G0X#9');

// 2c. transform hook: rewrite every line (e.g. force uppercase + CRLF marker)
fmt.transform = (l) => l.toUpperCase();
eq('transform upper',  line([G(0), X('#9')], 'go'),                               'G0 X#9 ( GO )');
fmt.transform = null;

// 2d. raw escape hatch
eq('raw passthrough',  line([raw('M98 P9000')], 'call sub'),                      'M98 P9000 ( call sub )');

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
