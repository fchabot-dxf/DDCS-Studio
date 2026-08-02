# DDCS V4.1 macro language — three things I can't figure out (WHILE, arctangent, IF spacing)

Firmware **2025-04-04-012-NOR**, V4.1 on the bench with no motors or drives attached, so
everything below is pure variable arithmetic — nothing moves.

Method: `.nc` files copied to `\\<controller>\cncdisk`, run one at a time from the panel, results
written to `#190` and read back from `sysdisk\uservar`. Each file tests exactly **one** thing,
because a rejected line stops the file and hides anything after it.

First, the things that **do** work, so it's clear the basics are fine:

| Form | Result |
|---|---|
| `#190 = -99999` (spaces around `=`) | works |
| `#190 = [SQRT[9] * 100]` | works — returns `300` |
| `IF #191==0GOTO1` … `N1` | works, branches correctly |
| `#191=#191+1` | works |
| `G92 Z[#1508+0]` | accepted |

---

## 1. `WHILE` is recognised but never opens a loop

Every variant I try fails at the **`END`**, with:

```
The loop instruction WHILE is incomplete: L8[END1]
```

The error names `WHILE`, so the instruction clearly exists in the parser — but the `WHILE` line
itself is never flagged, and the loop body runs **once** before `END1` reports there's nothing to
close. Minimal case:

```gcode
#190 = 0
#191 = 3
WHILE #190<#191 DO1
#190=#190+1
END1
M30
```

After this, `#190` reads **1** — so the increment executed once and fell straight through.

I've tried four variants, all with the same result:

- `WHILE#190<#191DO1` — no spaces (the form the factory macros use)
- `WHILE #190<#191DO1` — space after `WHILE`
- `WHILE #190<#191 DO1` — spaces both sides
- `WHILE#191<3DO1` — literal instead of a variable (this one **froze the controller** rather than
  erroring — see question 3)

What's confusing is that the **factory's own macros use `WHILE` freely** —
`ddcsv4/macroMillCylinder.nc` has:

```gcode
WHILE#11<#1DO1
IF#4==1GOTO11
G91G1X[#11-#12]*#3
GOTO12
N11G91G1Y[#11-#12]*#3
N12#12=#11
#11=#11+#2
G91G1A360
END1
```

**Question:** is `WHILE` only valid inside a firmware macro / `M98` subprogram, and not in an
ordinary program run from the disk? Or is there something else about the block structure I'm
missing? If it's context-dependent, is that documented anywhere?

---

## 2. Is there an arctangent function at all?

`SQRT` works perfectly. I cannot find **any** inverse trig function. All of these are rejected with
`Unrecognized file format` naming the line:

```gcode
#190 = [ATAN[1] / [1] * 100]    (two-operand Fanuc form)
#190 = [ATAN[1] * 100]
#190 = [ATN[1] * 100]
#190 = [ATAN2[1] * 100]
#190 = [atan[1] * 100]
#190 = [ACOS[1] * 100]          (control — is ANY inverse trig present?)
```

Every one of those is structurally identical to the `SQRT` line that works, so the bracket syntax
isn't the problem — it's the name, or the function genuinely isn't there.

**Question:** does V4.1 have an arctangent under some other name or calling form? Or is `SQRT` the
only transcendental in the parser? (`COS`/`SIN` I haven't tested yet.)

I ask because computing an angle from two endpoints — `atan2(dy, dx)` — is the one thing that would
let an angle be a live pendant variable instead of baked into the program at generation time.

---

## 3. A malformed `IF` **freezes** the controller instead of erroring

This one is a safety note as much as a question.

```gcode
IF#191==0GOTO1      ← no space after IF: controller HANGS, no error, needs a power cycle
IF #191==0GOTO1     ← with the space: works correctly
```

The unspaced version produced no error message and no way to recover except powering the unit off
and on. Reset had no effect. Everything else I got wrong today produced a clean, helpful error with
a line number — this was the one exception.

**Questions:** is the space after `IF` required and documented? And is the hang a known issue? The
factory macros are inconsistent about this — they write `IF #116>0 GOTO1` with spaces but
`WHILE#11<#1DO1` without, which is what led me to try the unspaced form in the first place.

---

Happy to run further tests and post results — the unit has nothing attached, so I can try anything
that doesn't require motion. If anyone has a working `WHILE` loop in a plain disk program, seeing it
verbatim would settle question 1 immediately.
