// validate.js — DDCS Expert (M350) pre-submit quirk linter (shared core; no DOM, no deps).
//
// JS PORT of bridge/controllers/expert-m350/tools/ddcs_lint.py — keep them in lockstep (same anti-drift
// contract as instrument/ ↔ checkpoint_insert.py). The Python linter is the spec: it is grounded in the
// real parse.out grammar + CORE_TRUTH quirks + hazards confirmed live on the machine (2026-06-06), and
// was validated against ~70 production + factory macros (clean except one genuine bug it caught). When a
// rule changes, change it in BOTH files and keep selftest.mjs ⇄ ddcs_lint.py --self-test in parity.
//
// The Expert's parser reports `syntax error:Lnn` only on its own screen (never to a file we can read over
// SMB), so the only way to "see" a syntax error remotely is to catch it BEFORE the macro reaches the
// controller. Both faces consume this pre-submit (Studio Submit + the fairy local UI — fairy submits too).
//
// Severities: 'ERROR' = will fail to parse OR freeze/wedge the controller · 'WARN' = documented quirk / foot-gun.
// Result: { ok, errors, warnings, findings: [{ line, sev, code, msg }] }  (line is 1-based; ok = no ERRORs)

const FANUC_OPS = /(?<![A-Za-z0-9_])(EQ|NE|LT|GT|LE|GE)(?![A-Za-z0-9_])/;
const ASSIGN = /^#(\d+)\s*=\s*(.+?)\s*$/;
const HASH_REF = /#(\d+)/g;
const GOTO_SPACE = /\bGOTO\s+[0-9[]/;
const G53_BARE = /\bG53\b(.*)/;
const AXIS_BARE_CONST = /(?<![#[\d.])\b[XYZABCUVW]\s*[-+]?\d/;
const INPUT2070 = /#2070\s*=\s*(\d+)/g;
const MCALL = /\b(MSETDATA|MGETDATA)\s*\[([^\]]*)\]/g;
const LITERAL_ASSIGN = /^#(\d+)\s*=\s*[-+]?\d+(?:\.\d+)?\s*$/;   // '#n = <constant>'
const IF_WORD = /\bIF\b/;
const G10 = /\bG10\b/;
const STRAY_WORD = /[A-Za-z]{2,}/g;
const VALID_MACRO_WORDS = new Set([
  "IF", "THEN", "GOTO", "WHILE", "DO", "END",
  "EQ", "NE", "GT", "GE", "LT", "LE", "AND", "OR", "XOR", "MOD",
  "SIN", "COS", "TAN", "ATAN", "ASIN", "ACOS", "SQRT", "ABS", "ROUND", "FIX", "FUP", "LN", "EXP",
  "MSETDATA", "MGETDATA"
]);

// Documented persistent-storage ranges that need priming (CORE_TRUTH unsafe ranges).
const isPersistent = (n) => (n >= 1153 && n <= 1193) || (n >= 2039 && n <= 2071) || (n >= 2500 && n <= 2599);

// Walk a line tracking DDCS '(...)' comments (which DO NOT nest and DO NOT span lines).
// Returns { code, errors }: code blanks out comment spans; errors is [{ col, code, msg }].
function scanComments(line) {
  const code = [];
  const errors = [];
  let depth = 0;
  for (let col = 0; col < line.length; col++) {
    const ch = line[col];
    if (depth === 0 && ch === ";") break;   // ';' = to-end-of-line comment (DDCS "Style 3")
    if (ch === "(") {
      if (depth === 0) depth = 1;
      else errors.push({ col, code: "E-NESTPAREN",
        msg: "nested '(' inside a comment - DDCS comments cannot nest; this breaks the parser (flags the NEXT line as 'syntax error')" });
      code.push(" ");
    } else if (ch === ")") {
      if (depth > 0) depth -= 1;
      else errors.push({ col, code: "E-STRAYPAREN", msg: "')' with no matching '(' - stray close paren" });
      code.push(" ");
    } else {
      code.push(depth > 0 ? " " : ch);
    }
  }
  if (depth > 0) errors.push({ col: line.length, code: "E-OPENCOMMENT", msg: "comment '(' never closed on this line" });
  return { code: code.join(""), errors };
}

function lintLine(n, raw, findings, primed) {
  const { code, errors } = scanComments(raw);
  for (const e of errors) findings.push({ line: n, sev: "ERROR", code: e.code, msg: e.msg });

  // bracket balance on code (expression brackets [ ])
  const opens = (code.match(/\[/g) || []).length, closes = (code.match(/\]/g) || []).length;
  if (opens !== closes) {
    findings.push({ line: n, sev: "ERROR", code: "E-BRACKET", msg: `unbalanced [ ] (${opens} '[' vs ${closes} ']')` });
  }

  // GOTO with a space before the label
  if (GOTO_SPACE.test(code)) {
    findings.push({ line: n, sev: "ERROR", code: "E-GOTOSPACE", msg: "space after GOTO - must be 'GOTO1' / 'GOTO[expr]', not 'GOTO 1'" });
  }

  // stray words (invalid alphabetical sequences)
  for (const match of code.matchAll(STRAY_WORD)) {
    if (!VALID_MACRO_WORDS.has(match[0].toUpperCase())) {
      findings.push({ line: n, sev: "ERROR", code: "E-STRAYWORD", msg: `unrecognized word '${match[0]}' outside of a comment` });
    }
  }

  // FANUC comparison words instead of C-style operators
  const fo = FANUC_OPS.exec(code);
  if (fo && IF_WORD.test(code)) {
    findings.push({ line: n, sev: "WARN", code: "W-FANUCOP", msg: `FANUC operator '${fo[1]}' is unreliable - use C-style ==, !=, <, >, <=, >=` });
  }

  // G10 (broken on DDCS - but factory key-5/key-6 macros use it, so WARN not ERROR)
  if (G10.test(code)) {
    findings.push({ line: n, sev: "WARN", code: "W-G10", msg: "G10 is broken on DDCS (causes unwanted motion) - write #805+ offsets directly" });
  }

  // G53 with a bare constant operand (must contain a variable)
  const g = G53_BARE.exec(code);
  if (g && AXIS_BARE_CONST.test(g[1])) {
    findings.push({ line: n, sev: "WARN", code: "W-G53CONST", msg: "G53 with a bare constant fails - operand must include a #var (e.g. 'G53 X#x', not 'G53 X0')" });
  }

  // #2070 input dialog writing to PERSISTENT storage fails silently (factory code DOES use
  // non-persistent targets like #800, so only flag the documented-unsafe persistent ranges).
  for (const im of code.matchAll(INPUT2070)) {
    const dest = Number(im[1]);
    if (isPersistent(dest)) {
      findings.push({ line: n, sev: "WARN", code: "W-2070RANGE", msg: `#2070 -> #${dest} (persistent) fails silently - input to #50-#499 then copy to persistent` });
    }
  }

  // MSETDATA/MGETDATA must have 6 args (the real Modbus I/O convention on this machine)
  for (const mm of code.matchAll(MCALL)) {
    const args = mm[2].split(",").filter((a) => a.trim() !== "");
    if (args.length !== 6) {
      findings.push({ line: n, sev: "ERROR", code: "E-MARGS", msg: `${mm[1]} needs 6 args [X1..X6], got ${args.length}` });
    }
  }

  // assignment-based checks
  const am = ASSIGN.exec(code.trim());
  if (am) {
    const target = Number(am[1]);
    const rhs = am[2];
    const refs = [...rhs.matchAll(HASH_REF)].map((x) => Number(x[1]));

    // priming freeze: writing a PERSISTENT-storage var directly FROM a system var (#880-#999) without a
    // 'wash' AND without having primed the target with a constant earlier. (Mechanism disputed - CORE_TRUTH
    // says wash the RHS with +0; production macros instead prime the target with a constant first - both
    // are claimed to work, so this is a WARN.)
    if (isPersistent(target) && refs.some((r) => r >= 880 && r <= 999)) {
      if (!/[+\-*/]/.test(rhs) && !primed.has(target)) {
        findings.push({ line: n, sev: "WARN", code: "W-PRIME",
          msg: `#${target} = #${refs[0]} can freeze (priming bug) - prime #${target} with a constant earlier, or wash the RHS ('#${target} = #${refs[0]} + 0')` });
      }
    }

    // reading analyze-channel STATUS internals wedges the analyzer (confirmed live 2026-06-06)
    for (const r of refs) {
      if (r >= 1630 && r <= 1636) {
        findings.push({ line: n, sev: "ERROR", code: "E-CH1630", msg: `reading #${r} (analyze-channel status) WEDGES the analyzer (needs reboot). Do not read #1630-#1636 from a running job` });
      }
    }
    // writing channel execution-method vars pauses/commands a channel - usually unintended
    if (target >= 1620 && target <= 1626) {
      findings.push({ line: n, sev: "WARN", code: "W-CH1620", msg: `writing #${target} commands analyze-channel exec (1=pause). Intentional? (this is what M47/feed-hold use)` });
    }
  }
}

export function validate(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  // pre-pass: collect targets primed with a literal constant anywhere (suppresses W-PRIME)
  const primed = new Set();
  for (const raw of lines) {
    const { code } = scanComments(raw);
    const m = LITERAL_ASSIGN.exec(code.trim());
    if (m) primed.add(Number(m[1]));
  }
  const findings = [];
  lines.forEach((raw, i) => lintLine(i + 1, raw, findings, primed));
  const errors = findings.filter((f) => f.sev === "ERROR").length;
  return { ok: errors === 0, errors, warnings: findings.length - errors, findings };
}

// Convenience: one-line human summary (for a status bar / toast).
export function summarize(result) {
  if (result.ok && result.warnings === 0) return "DDCS check: clean";
  const parts = [];
  if (result.errors) parts.push(`${result.errors} error${result.errors === 1 ? "" : "s"}`);
  if (result.warnings) parts.push(`${result.warnings} warning${result.warnings === 1 ? "" : "s"}`);
  return `DDCS check: ${parts.join(", ")}`;
}
