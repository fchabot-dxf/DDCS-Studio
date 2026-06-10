// selftest.mjs — parity guard for validate.js. Run: node shared/js/validate/selftest.mjs
//
// These cases are a 1:1 port of ddcs_lint.py's self_test() — validate.js MUST agree with the Python
// linter case-for-case (the Python is the spec). If you change a rule, change both files and both tests.

import { validate, summarize } from "./validate.js";

// (text, wantCode) — wantCode === null means "clean of ERRORs" (mirrors the Python `want is None` rule).
const cases = [
  ["(ok comment)\n#250 = 1\nMSETDATA[250,1,0,2,16,300]\nM30\n", null],
  ["( try X5=4 (input regs) )\nM30\n", "E-NESTPAREN"],
  ["IF #1!=2 GOTO 5\nM30\n", "E-GOTOSPACE"],
  ["IF #1 EQ 5 GOTO1\nM30\n", "W-FANUCOP"],
  ["#1153 = #880\nM30\n", "W-PRIME"],
  ["#1153 = #880 + 0\nM30\n", null],
  ["#1153 = 1\n#1153 = #880\nM30\n", null],            // primed with a constant first -> suppressed
  ["#100=FUP[[#53-#52]/2] ;;cmt with [#x]\nM30\n", null], // ; comment brackets ignored; code balanced
  ["#250 = #1630 + 10\nMSETDATA[250,1,0,2,16,300]\nM30\n", "E-CH1630"],
  ["#2070 = 1175(Enter speed)\nM30\n", "W-2070RANGE"],
  ["G53 X0 Y0\nM30\n", "W-G53CONST"],
  ["MSETDATA[200,1,0,4,16]\nM30\n", "E-MARGS"],
  ["#100 = [#1 + 2\nM30\n", "E-BRACKET"],
];

let failures = 0;
console.log("DDCS validator self-test (parity with ddcs_lint.py)\n");
for (const [text, want] of cases) {
  const codes = new Set(validate(text).findings.map((f) => f.code));
  const hit = want === null ? ![...codes].some((c) => c.startsWith("E-")) : codes.has(want);
  if (!hit) failures++;
  console.log(`  [${hit ? "ok" : "FAIL"}] want=${String(want).padEnd(14)} got=${JSON.stringify([...codes].sort())}`);
}

// a couple of structural checks on the result shape
const r = validate("MSETDATA[200,1,0,4,16]\nM30\n");
if (!(r.errors === 1 && r.ok === false)) { failures++; console.log("  [FAIL] result shape: errors/ok"); }
console.log(`  [ok] summary line: "${summarize(validate("IF #1 EQ 5 GOTO1\nM30\n"))}"`);

console.log(`\nvalidator self-test: ${failures === 0 ? "PASS" : "FAIL (" + failures + ")"}`);
process.exit(failures === 0 ? 0 : 1);
