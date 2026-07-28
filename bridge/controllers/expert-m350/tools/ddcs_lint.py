#!/usr/bin/env python3
r"""
ddcs_lint.py - a PC-side syntax/quirk linter for DDCS Expert (M350) G-code & macros.

WHY: the Expert's parser (parse.out, a Berkeley-yacc grammar) reports `syntax error:Lnn`
ONLY on its own screen - it is not written to any file we can read over SMB. So instead of
capturing the error after the fact, catch it BEFORE the macro ever reaches the controller.

Grounded in, and ONLY in, evidence of three declared kinds (t1279 - see THE EXPRESSION VOCABULARY below):
  * DEMONSTRATED  - the construct appears in the 59 captured factory macros (CNCDISK/SYSDISK, 2026-06-10)
  * VERIFIED      - we ran it on the machine and recorded the result (the V-series in verify/)
  * ABSENT        - neither of the above. Not "forbidden", but not something to emit and hope.

WHAT THIS HEADER USED TO CLAIM, AND WHY IT WAS WRONG (t1279):
  it said the accepted vocabulary was "the parser's real vocabulary mined from parse.out (math fns ASIN/ACOS/ATAN/
  SQRT/ROUND/LN, etc.)". Those lowercase names DO appear in parse.out - at offset ~3300, immediately after the string
  `libm.so.6`, in the binary's ELF DYNAMIC-SYMBOL IMPORT TABLE. They are the C functions the FIRMWARE LINKS AGAINST,
  not tokens the macro language exposes. Two things give it away: parse.out contains no UPPERCASE grammar tokens at
  all - not even ABS, which demonstrably works - so nothing about the vocabulary can be read out of that file; and
  `cos`/`sin` are not in the list at all while `asin`/`acos` are, which is the shape of a maths-library import table,
  not of a G-code grammar. A linter that blesses COS[...] passes a macro the controller rejects with a syntax error
  it only ever prints on its own screen - the exact failure this tool exists to prevent.

THE EXPRESSION VOCABULARY, as the evidence actually supports it:
  MATH FUNCTIONS   ABS[...]                        DEMONSTRATED (10 uses, e.g. `#24=ABS[#22-#23]`)
                   everything else                 ABSENT - no trig, no SQRT, no FUP/FIX/ROUND/LN in the corpus
  CONTROL FLOW     IF [...] GOTO<n>                DEMONSTRATED
                   WHILE [...] DO<n>               DEMONSTRATED (35 uses)
  WORD OPERATORS   EQ                              VERIFIED on machine (V10_operators.nc, 2026-06-23)
                   NE                              DEMONSTRATED (25 uses, `WHILE [#[...] NE 0] DO14`)
                   LT / GT / LE / GE               ABSENT
  ARITHMETIC       + - * / , [ ] nesting, #n, #[n]  DEMONSTRATED throughout

  * plus the documented firmware quirks in the ddcs-expert skill CORE_TRUTH.md
  * plus hazards we confirmed live on the machine 2026-06-06 (reading #1630 wedges the analyzer)

Severities:
  ERROR   - will fail to parse OR will freeze/wedge the controller (fix before running)
  WARN    - documented quirk / likely-wrong / semantic foot-gun

Usage:
  python ddcs_lint.py macro.nc            # lint a file
  python ddcs_lint.py a.nc b.nc           # lint several
  python ddcs_lint.py --self-test         # run built-in checks
  type macro.nc | python ddcs_lint.py -   # lint stdin
Exit code = number of ERROR findings (0 = clean).
"""
import re
import sys
from collections import namedtuple

Finding = namedtuple("Finding", "line sev code msg")


# --------------------------------------------------------------------------- comment scan
def scan_comments(line):
    """Walk a line tracking DDCS '(...)' comments (which DO NOT nest and DO NOT span lines).
    Returns (code_only, errors) where code_only blanks out comment spans (so other checks
    ignore comment text) and errors is a list of (col, code, msg)."""
    code = []
    errors = []
    depth = 0
    for col, ch in enumerate(line):
        if depth == 0 and ch == ";":
            break  # ';' starts a to-end-of-line comment (DDCS "Style 3", widely used)
        if ch == "(":
            if depth == 0:
                depth = 1
            else:
                errors.append((col, "E-NESTPAREN",
                               "nested '(' inside a comment - DDCS comments cannot nest; "
                               "this breaks the parser (flags the NEXT line as 'syntax error')"))
            code.append(" ")
        elif ch == ")":
            if depth > 0:
                depth -= 1
            else:
                errors.append((col, "E-STRAYPAREN", "')' with no matching '(' - stray close paren"))
            code.append(" ")
        else:
            code.append(" " if depth > 0 else ch)
    if depth > 0:
        errors.append((len(line), "E-OPENCOMMENT", "comment '(' never closed on this line"))
    return "".join(code), errors


# --------------------------------------------------------------------------- checks
FANUC_OPS = re.compile(r"(?<![A-Za-z0-9_])(LT|GT|LE|GE)(?![A-Za-z0-9_])")   # EQ VERIFIED (V10); NE DEMONSTRATED (25 factory uses, t1279); LT/GT/LE/GE ABSENT
ASSIGN = re.compile(r"#(\d+)\s*=\s*(.+?)\s*$")
HASH_REF = re.compile(r"#(\d+)")
GOTO_SPACE = re.compile(r"\bGOTO\s+([0-9\[])")
G53_BARE = re.compile(r"\bG53\b(.*)")
AXIS_BARE_CONST = re.compile(r"(?<![#\[\d.])\b([XYZABCUVW])\s*[-+]?\d")
INPUT2070 = re.compile(r"#2070\s*=\s*(\d+)")
MCALL = re.compile(r"\b(MSETDATA|MGETDATA)\s*\[([^\]]*)\]")
MSG_FMT = re.compile(r"#(1503|1505)\s*=\s*-?\d+\s*\(")
LITERAL_ASSIGN = re.compile(r"#(\d+)\s*=\s*[-+]?\d+(?:\.\d+)?\s*$")  # '#n = <constant>'
DWELL_DECIMAL = re.compile(r"\bG0*4\s+P(\d*\.\d+)")                  # 'G04 P3.0' - decimal dwell (NOT seconds)

# t1279 - THE FUNCTION VOCABULARY, split by the evidence that supports it (see the header).
DEMONSTRATED_FNS = {"ABS"}                                         # real code in the captured factory macros
TRIG_FNS = {"COS", "SIN", "TAN", "ASIN", "ACOS", "ATAN", "ATAN2"}  # ABSENT - and geometry is where it bites
OTHER_ABSENT_FNS = {"SQRT", "ROUND", "FUP", "FIX", "LN", "EXP", "POW", "MOD"}
FN_CALL = re.compile(r"(?<![A-Za-z0-9_#])([A-Za-z]{2,6})\s*\[")
FLOW_WORDS = {"IF", "WHILE", "DO", "GOTO", "THEN", "AND", "OR", "XOR"}   # control flow, not functions


def _is_persistent(n):
    # documented persistent-storage ranges that need priming (CORE_TRUTH rule 8 unsafe ranges)
    return (1153 <= n <= 1193) or (2039 <= n <= 2071) or (2500 <= n <= 2599)


def lint_line(n, raw, findings, primed=frozenset()):
    code, cerrs = scan_comments(raw)
    for _col, ccode, cmsg in cerrs:
        findings.append(Finding(n, "ERROR", ccode, cmsg))

    # bracket balance on code (expression brackets [ ])
    if code.count("[") != code.count("]"):
        findings.append(Finding(n, "ERROR", "E-BRACKET",
                                f"unbalanced [ ] ({code.count('[')} '[' vs {code.count(']')} ']')"))

    # GOTO with a space before the label - ACCEPTED on the Expert (CONFIRMED V11 2026-06-23) -> warning, not error
    if GOTO_SPACE.search(code):
        findings.append(Finding(n, "WARN", "W-GOTOSPACE",
                                "space after GOTO ('GOTO 1') is accepted on the DDCS Expert - emit 'GOTO1' / "
                                "'GOTO[expr]' for portability"))

    # t1279 - FUNCTION VOCABULARY. Trig is an ERROR: no captured factory macro uses one, none is verified, and the
    # names an earlier version of this file cited are the firmware's libm imports, not the grammar. A macro that needs
    # a cosine must have it computed at POST time (that is what Studio's polygon turning does).
    for m in FN_CALL.finditer(code):
        fn = m.group(1).upper()
        if fn in FLOW_WORDS or fn in DEMONSTRATED_FNS:
            continue
        if fn in TRIG_FNS:
            findings.append(Finding(n, "ERROR", "E-NOTRIG",
                                    f"'{fn}[...]' - the DDCS macro language has NO TRIG. No captured factory macro "
                                    "uses one, none is verified on the machine, and the names in parse.out are the "
                                    "firmware's libm imports, not grammar. Compute the value at post time instead."))
        elif fn in OTHER_ABSENT_FNS:
            findings.append(Finding(n, "WARN", "W-UNDEMONSTRATED",
                                    f"'{fn}[...]' is not demonstrated in any captured factory macro and is not "
                                    "verified on the machine. ABS is the only math function with evidence - verify "
                                    "this one on the controller before relying on it."))

    # FANUC comparison words (EQ excluded - confirmed working; others untested)
    m = FANUC_OPS.search(code)
    if m and re.search(r"\bIF\b", code):
        findings.append(Finding(n, "WARN", "W-FANUCOP",
                                f"FANUC operator '{m.group(1)}' is untested on the DDCS - prefer C-style "
                                "==, !=, <, >, <=, >= (EQ is confirmed working)"))

    # G10 is broken; the L2/L20 + axis-word form is DANGEROUS - the axis word runs as a MOVE (CONFIRMED V1 2026-06-19)
    if re.search(r"\bG10\b", code):
        if re.search(r"\bL(?:20|2)\b", code) and re.search(r"[XYZABCUVW]\s*[-+]?[\d.#\[]", code):
            findings.append(Finding(n, "ERROR", "E-G10MOVE",
                                    "G10 L2/L20 with an axis word sets NO offset and MOVES the axis "
                                    "(confirmed dangerous) - write #805+ offsets directly"))
        else:
            findings.append(Finding(n, "WARN", "W-G10",
                                    "G10 is broken on DDCS (causes unwanted motion) - write #805+ offsets directly"))

    # G53 with a bare constant operand (must contain a variable)
    g = G53_BARE.search(code)
    if g and AXIS_BARE_CONST.search(g.group(1)):
        findings.append(Finding(n, "WARN", "W-G53CONST",
                                "G53 with a bare constant fails - operand must include a #var "
                                "(e.g. 'G53 X#x', not 'G53 X0')"))

    # G04 dwell with a DECIMAL P is NOT seconds on the Expert (on-machine 2026-06-23):
    # P is always milliseconds; 'G04 P3.0' truncates to ~3 ms (near-instant), not 3 seconds.
    md = DWELL_DECIMAL.search(code)
    if md:
        findings.append(Finding(n, "WARN", "W-DWELLDEC",
                                f"decimal 'G04 P{md.group(1)}' is ~ms / near-instant, NOT seconds - "
                                "P is always milliseconds; for N seconds use integer 'G04 P<N*1000>'"))

    # #2070 input dialog writing to PERSISTENT storage fails silently (factory code DOES use
    # non-persistent targets like #800, so only flag the documented-unsafe persistent ranges).
    for im in INPUT2070.finditer(code):
        dest = int(im.group(1))
        if _is_persistent(dest):
            findings.append(Finding(n, "WARN", "W-2070RANGE",
                                    f"#2070 -> #{dest} (persistent) fails silently - input to #50-#499 "
                                    "then copy to persistent"))

    # MSETDATA/MGETDATA must have 6 args
    for mm in MCALL.finditer(code):
        args = [a for a in mm.group(2).split(",") if a.strip() != ""]
        if len(args) != 6:
            findings.append(Finding(n, "ERROR", "E-MARGS",
                                    f"{mm.group(1)} needs 6 args [X1..X6], got {len(args)}"))

    # assignment-based checks
    am = ASSIGN.match(code.strip())
    if am:
        target = int(am.group(1))
        rhs = am.group(2)
        refs = [int(x) for x in HASH_REF.findall(rhs)]

        # priming freeze: writing a PERSISTENT-storage var directly FROM a system var (#880-#999)
        # without a 'wash' AND without having primed the target with a constant earlier.
        # (Mechanism is disputed: CORE_TRUTH says wash the RHS with +0; production macros instead
        #  prime the target with a constant first - both are claimed to work. So this is a WARN.)
        if _is_persistent(target) and any(880 <= r <= 999 for r in refs):
            if not re.search(r"[+\-*/]", rhs) and target not in primed:
                findings.append(Finding(n, "WARN", "W-PRIME",
                                        f"#{target} = #{refs[0]} can freeze (priming bug) - prime "
                                        f"#{target} with a constant earlier, or wash the RHS ('#{target} "
                                        f"= #{refs[0]} + 0')"))

        # reading analyze-channel STATUS internals wedges the analyzer (confirmed live 2026-06-06)
        for r in refs:
            if 1630 <= r <= 1636:
                findings.append(Finding(n, "ERROR", "E-CH1630",
                                        f"reading #{r} (analyze-channel status) WEDGES the analyzer "
                                        "(needs reboot). Do not read #1630-#1636 from a running job"))
        # writing channel execution-method vars pauses/commands a channel - usually unintended
        if 1620 <= target <= 1626:
            findings.append(Finding(n, "WARN", "W-CH1620",
                                    f"writing #{target} commands analyze-channel exec (1=pause). "
                                    "Intentional? (this is what M47/feed-hold use)"))


def lint(text):
    lines = text.splitlines()
    # pre-pass: collect targets primed with a literal constant anywhere (suppresses W-PRIME)
    primed = set()
    for raw in lines:
        code, _ = scan_comments(raw)
        m = LITERAL_ASSIGN.match(code.strip())
        if m:
            primed.add(int(m.group(1)))
    findings = []
    for i, raw in enumerate(lines, 1):
        lint_line(i, raw, findings, primed)
    return findings


# --------------------------------------------------------------------------- runner
def lint_text_report(name, text):
    findings = lint(text)
    errs = sum(1 for f in findings if f.sev == "ERROR")
    if not findings:
        print(f"{name}: clean")
    else:
        for f in findings:
            print(f"{name}:{f.line}: {f.sev} {f.code}: {f.msg}")
        print(f"{name}: {errs} error(s), {len(findings) - errs} warning(s)")
    return errs


def self_test():
    cases = [
        # (text, expected_code_substring or None for clean)
        ("(ok comment)\n#250 = 1\nMSETDATA[250,1,0,2,16,300]\nM30\n", None),
        ("( try X5=4 (input regs) )\nM30\n", "E-NESTPAREN"),
        ("IF #1!=2 GOTO 5\nM30\n", "W-GOTOSPACE"),   # GOTO-space accepted on Expert -> warning, not error
        ("IF #1 EQ 5 GOTO1\nM30\n", None),           # EQ confirmed working -> no W-FANUCOP
        ("IF #1 NE 5 GOTO1\nM30\n", None),          # t1279 - NE is DEMONSTRATED in the corpus -> no warn
        ("IF #1 LT 5 GOTO1\nM30\n", "W-FANUCOP"),   # LT/GT/LE/GE remain ABSENT -> warns
        ("#100=COS[#5]\nM30\n", "E-NOTRIG"),        # t1279 - trig is REJECTED: the language has none
        ("#100=SIN[[#5]/2]\nM30\n", "E-NOTRIG"),
        ("#100=SQRT[#5]\nM30\n", "W-UNDEMONSTRATED"),
        ("#24=ABS[#22-#23]\nM30\n", None),          # the ONE math function with evidence
        ("WHILE [#100 NE 0] DO1\nM30\n", None),     # demonstrated control flow, not a function call
        ("G10 L20 P6 X25\nM30\n", "E-G10MOVE"),       # G10 L20 + axis word = confirmed-dangerous move -> ERROR
        ("#1153 = #880\nM30\n", "W-PRIME"),
        ("#1153 = #880 + 0\nM30\n", None),
        ("#1153 = 1\n#1153 = #880\nM30\n", None),   # primed with constant first -> suppressed
        ("#100=FUP[[#53-#52]/2] ;;cmt with [#x]\nM30\n", "W-UNDEMONSTRATED"),  # brackets balance, but FUP has no evidence (t1279)
        ("#250 = #1630 + 10\nMSETDATA[250,1,0,2,16,300]\nM30\n", "E-CH1630"),
        ("#2070 = 1175(Enter speed)\nM30\n", "W-2070RANGE"),
        ("G53 X0 Y0\nM30\n", "W-G53CONST"),
        ("G04 P3.0\nM30\n", "W-DWELLDEC"),
        ("G04 P3000\nM30\n", None),
        ("MSETDATA[200,1,0,4,16]\nM30\n", "E-MARGS"),
        ("#100 = [#1 + 2\nM30\n", "E-BRACKET"),
    ]
    ok = True
    for text, want in cases:
        codes = {f.code for f in lint(text)}
        hit = (want is None and not any(c.startswith("E-") for c in codes)) or (want in codes)
        status = "ok" if hit else "FAIL"
        if not hit:
            ok = False
        print(f"  [{status}] want={want!r:16} got={sorted(codes)}")
    print("self-test:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


def main(argv):
    if "--self-test" in argv:
        return self_test()
    args = [a for a in argv if not a.startswith("-")]
    if not args:
        print(__doc__.strip().splitlines()[0])
        print("usage: python ddcs_lint.py <file.nc> [...]  |  --self-test  |  -")
        return 0
    total = 0
    for a in args:
        if a == "-":
            total += lint_text_report("<stdin>", sys.stdin.read())
        else:
            with open(a, "r", encoding="utf-8", errors="replace") as f:
                total += lint_text_report(a, f.read())
    return total


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
