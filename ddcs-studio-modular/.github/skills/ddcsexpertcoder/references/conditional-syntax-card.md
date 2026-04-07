# DDCS M350 Conditional Syntax - Quick Reference Card

**Version**: V1.22 Verified  
**Authority**: [CONFIRMED] Production Testing  
**Date**: January 2026

**Purpose**: Fast lookup for IF/GOTO/label syntax rules discovered through production macro debugging

---

## IF Statements

### Simple Conditions (NO BRACKETS)

```gcode
✅ CORRECT:
IF #var!=value GOTOlabel     ; Simple variable comparison
IF #1922==1 GOTO1            ; Equality test
IF #100<50 GOTO2             ; Less than
IF #value>=0 GOTO3           ; Greater than or equal

❌ WRONG:
IF [#var!=value] GOTOlabel   ; No brackets on simple conditions
IF [#1922==1] GOTO1          ; Parser syntax error
IF [#100 < 50] GOTO2         ; Spaces don't help
```

**Rule**: Simple variable comparisons must NOT use brackets

**Parser error**: `syntax error!:L34[#temp=#34]` when brackets used incorrectly

---

### Complex Expressions (USE BRACKETS)

```gcode
✅ CORRECT:
IF [#a+#b]>value GOTOlabel   ; Arithmetic expression
IF [#100*2]<50 GOTO1         ; Calculation
IF [#x+#y]!=0 GOTO2          ; Addition

❌ WRONG:
IF #a+#b>value GOTOlabel     ; Need brackets for expressions
IF #100*2<50 GOTO1           ; Parser error without brackets
```

**Rule**: Arithmetic and logical expressions REQUIRE brackets

---

## GOTO Statements

### No Space Before Label

```gcode
✅ CORRECT:
GOTO1                        ; No space
GOTO99                       ; No space
GOTO999                      ; No space
IF #value==0 GOTO1           ; No space in IF statement

❌ WRONG:
GOTO 1                       ; Space causes error
GOTO 99                      ; Parser fails
IF #value==0 GOTO 1          ; Space before label fails
```

**Rule**: Format is `GOTOxxx` where xxx is label number (no space)

**Parser error**: `[N]was not found:L124[GOTO999]` when space used

---

## Label Numbers

### Reliability by Digit Count

```gcode
✅ MOST RELIABLE (Preferred):
N1, N2, N9                   ; Single digits

✅ ACCEPTABLE:
N10, N20, N99                ; Double digits work

⚠️ LESS RELIABLE (Use Caution):
N100, N990, N999             ; Three+ digits may fail
```

**Rule**: Use lowest label numbers possible. Parser most reliable with 1-2 digit labels.

**Production evidence**: Three-digit labels caused `[N]was not found` errors

---

## Program Flow Pattern

### Success Must Jump Past Errors

```gcode
❌ WRONG (falls through into error handler):
; Main code
[code executes]
#1505=-5000(Success!)
M30

; Error handler (executes after success!)
N1
#1505=1(Error!)
M30

✅ CORRECT (jumps to end, skips errors):
; Main code
[code executes]
#1505=-5000(Success!)
GOTO2          ; Jump to end

; Error handler (skipped on success)
N1
#1505=1(Error!)

; Program end
N2
M30
```

**Rule**: Success path MUST use GOTO to jump past error handlers to end label

**Structure**:
1. Main code execution
2. Success message + GOTO end
3. Error handlers (labels N1, N10, etc.)
4. End label (N2, N99, etc.)
5. M30

---

## Complete Verified Example

**From production macro_cam10.nc:**

```gcode
O0001 (Working Example)

; Configuration
#30=3
#31=0

; Execution
G91
G31 Z-50 F200 P#30 L#31 Q0
IF #1922!=2 GOTO1              ; ✅ No brackets, no space

; Main result processing
#100=#1927
#1510=#100
#1503=1(Probe Z: [%.3f])

; Success path
#1505=-5000(Probe successful!)
GOTO2                          ; ✅ Jump to end

; Error handler
N1                             ; ✅ Single digit
#1505=1(Probe failed - no contact!)

; Program end
N2                             ; ✅ Single digit
M30
```

**Key points**:
1. IF condition: `IF #1922!=2 GOTO1` (no brackets, no space)
2. GOTO: `GOTO2` (no space before label)
3. Labels: `N1`, `N2` (single digits)
4. Success uses GOTO to skip error handler
5. Error handler between success and end
6. M30 at very end after end label

---

## Perfect Production Example ⭐

**See**: `example-macros/corner_finder_FINAL.nc` for the **gold standard** macro with:
- **16 IF statements** - all using correct syntax (no brackets on simple conditions)
- **15 GOTO statements** - all with no space before labels
- **Single-digit labels** - N1 (error), N2 (end)
- **Perfect flow control** - success GOTOs past errors
- Three-axis sequential probing (Z→X→Y)
- Two-pass probing on each axis
- Safety checks after every move
- Interactive user dialogs
- 106 lines of perfectly-formatted code

**This is THE template** - use it as your reference for correct conditional syntax!

---

## Comparison Operators

**Use C-style operators (REQUIRED):**

| Operator | Meaning | Example |
|----------|---------|---------|
| `==` | Equal | `IF #var==5 GOTO1` |
| `!=` | Not equal | `IF #var!=0 GOTO2` |
| `<` | Less than | `IF #var<10 GOTO3` |
| `>` | Greater than | `IF #var>5 GOTO4` |
| `<=` | Less than or equal | `IF #var<=10 GOTO5` |
| `>=` | Greater than or equal | `IF #var>=0 GOTO6` |

**Do NOT use FANUC-style**: EQ, NE, LT, GT, LE, GE (unreliable on M350)

---

## Testing Checklist

**Before running any macro with conditionals:**

```
Syntax Validation:
[ ] IF statements with simple conditions: no brackets
[ ] IF statements with complex expressions: use brackets
[ ] GOTO statements: no space before label
[ ] Labels: single or double digit (prefer N1-N99)
[ ] Success path: uses GOTO to jump to end
[ ] Error handlers: between success and end label
[ ] End label: after all error handlers, before M30
[ ] Operators: C-style (!=, ==, <, >) not FANUC (NE, EQ)
```

---

## Common Parser Errors

| Error Message | Cause | Fix |
|---------------|-------|-----|
| `syntax error!:L34[#temp=#34]` | Brackets on simple IF | Remove brackets: `IF #var!=2 GOTO1` |
| `[N]was not found:L124[GOTO999]` | Space in GOTO or 3-digit label | Remove space: `GOTO1` or use lower label |
| Program runs error handler after success | No GOTO after success | Add `GOTO2` before error labels |

---

## Quick Decision Tree

**When writing an IF statement:**

1. Is it a simple variable comparison? (`#var != value`)
   - YES → No brackets: `IF #var!=value GOTO1`
   - NO → Go to step 2

2. Is it an arithmetic expression? (`#a + #b > value`)
   - YES → Use brackets: `IF [#a+#b]>value GOTO1`

**When writing a GOTO:**
- Always: `GOTOx` (no space)
- Never: `GOTO x` (with space)

**When choosing label numbers:**
- First choice: N1-N9 (single digit)
- Second choice: N10-N99 (double digit)
- Avoid: N100+ (three+ digits)

**When structuring flow:**
- Main code → Success + GOTO → Errors → End + M30

---

## Related Documentation

**For complete explanations:**
- `CORE_TRUTH.md` Section 7 - Control Flow and Conditionals
- `software-technical-spec.md` Section 3.6 - Conditional and Flow Control Quirks
- `macrob-programming-rules.md` Section 6 - Brackets and Conditional Syntax

**For working examples:**
- `example-macros/corner_finder_FINAL.nc` - **THE PERFECT EXAMPLE** (16 IF, 15 GOTO, all correct)
- `example-macros/macro_cam10.nc` - Verified working pattern
- `user-tested-patterns.md` - Production macro patterns

---

## Document Status

**Type**: Quick reference card  
**Authority**: [CONFIRMED] Production testing on Ultimate Bee 1010  
**Controller**: DDCS Expert M350 V1.22  
**Testing Date**: January 2026  
**Source**: Actual parser errors encountered and resolved in production macro development

These syntax rules are based on real parser errors, not documentation. Pattern verified against working macro_cam10.nc.
