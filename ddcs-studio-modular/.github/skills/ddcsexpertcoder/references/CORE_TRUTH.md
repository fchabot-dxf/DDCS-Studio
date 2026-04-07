# DDCS M350 Expert Controller - Core Truths Quick Reference

**Version**: V1.22 Verified  
**Authority**: [CONFIRMED] Production-tested  
**Last Updated**: January 2026

**Purpose**: Essential firmware quirks - READ FIRST before any macro work

**Complete details**: See full version (571 lines) or `software-technical-spec.md`

---

## The 7 Critical Truths [CONFIRMED]

**Standard FANUC rules DO NOT apply**

| # | Truth | Workaround | Reference |
|---|-------|------------|-----------|
| 1 | **G10 is BROKEN** | Use direct #805+ writes | software-technical-spec.md §3.2 |
| 2 | **G53 requires variables** | No hardcoded constants | software-technical-spec.md §3.3 |
| 3 | **G28 ≠ machine zero** | Goes to back-off positions | software-technical-spec.md §3.3 |
| 4 | **Variable priming required** | Prime #1153+ from #880+ | variable-priming-card.md |
| 5 | **C-style operators only** | Use ==, !=, <, > (NOT EQ) | software-technical-spec.md §3.4 |
| 6 | **WCS stride = 5** | Not 20 (G54=#805, G55=#810) | software-technical-spec.md §3.5 |
| 7 | **IF/GOTO syntax strict** | No brackets on simple IF, no space in GOTO | CORE_TRUTH.md §7, software-technical-spec.md §3.6 |

---

## 1. G10 is BROKEN

### Problem

```gcode
G10 L2 P1 X0 Y0 Z0   ; ❌ Causes unwanted motion
```

### Solution

**Direct parameter writing**:
```gcode
; Set G54 offsets
#805 = #880   ; G54 X offset
#806 = #881   ; G54 Y offset
#807 = #882   ; G54 Z offset
```

**Universal pattern** (any WCS):
```gcode
#wcs = #578                    ; Get active WCS (1-6)
#base = 805 + [#wcs - 1] * 5  ; Calculate base address
#[#base + 0] = #880           ; Set X
#[#base + 1] = #881           ; Set Y
#[#base + 2] = #882           ; Set Z
```

**WCS address table**:

| WCS | Index | X | Y | Z | A | B |
|-----|-------|---|---|---|---|---|
| G54 | 1 | 805 | 806 | 807 | 808 | 809 |
| G55 | 2 | 810 | 811 | 812 | 813 | 814 |
| G56 | 3 | 815 | 816 | 817 | 818 | 819 |
| G57 | 4 | 820 | 821 | 822 | 823 | 824 |
| G58 | 5 | 825 | 826 | 827 | 828 | 829 |
| G59 | 6 | 830 | 831 | 832 | 833 | 834 |

**Formula**: `Base + (WCS_Index - 1) × 5`

---

## 2. G53 Syntax Rules

### ✅ VALID (VERIFIED)

```gcode
; Method 1: Variables only
#x = 500
#y = -500
G53 X#x Y#y   ; ✅ Works

; Method 2: Expressions in brackets
G53 X[#100] Y[#101]   ; ✅ Works

; Method 3: Calculated on separate line
#target = 500 + 100
G53 X#target   ; ✅ Works
```

### ❌ INVALID (BROKEN)

```gcode
; Hardcoded constants
G53 X0 Y0 Z0   ; ❌ FAILS

; G0/G1 on same line
G53 G0 X#var   ; ❌ FAILS
G53 G1 X#var F500   ; ❌ FAILS

; Expressions without brackets
G53 X#100+50   ; ❌ FAILS
```

### Correct Pattern

```gcode
; ALWAYS use this pattern
#x = 0
#y = 0
#z = 0
G53 X#x Y#y Z#z   ; Move to machine zero
```

---

## 3. G28 Reference Point Behavior

### What G28 Actually Does

**G28 does NOT go to machine zero!**

**G28 goes to "back-off" positions**:
- Set by parameters Pr122-Pr126 (#622-#626)
- Ultimate Bee 1010: X=5.0, Y=-5.0, Z=-5.0
- This is **5mm away** from limit switches

### Machine Zero vs G28

| Command | Destination | Ultimate Bee 1010 |
|---------|-------------|-------------------|
| **G53 X0 Y0 Z0** | True machine zero | X=0, Y=0, Z=0 |
| **G28 X0 Y0 Z0** | Back-off positions | X=5.0, Y=-5.0, Z=-5.0 |

### Solution

**Use G53 for machine zero**:
```gcode
; Go to true machine zero
#x = 0
#y = 0
#z = 0
G53 X#x Y#y Z#z
```

**If you need back-off positions**:
```gcode
; Read back-off parameters
#x_backoff = #622
#y_backoff = #623
#z_backoff = #624
G53 X#x_backoff Y#y_backoff Z#z_backoff
```

---

## 4. Variable Priming Bug [CRITICAL]

### The Bug

**Direct assignment from system vars to persistent vars causes freeze**:

```gcode
#1153 = #880   ; ❌ CONTROLLER FREEZE
```

### Why It Happens

Firmware bug when assigning:
- **FROM**: System variables (#880+)
- **TO**: Persistent variables (#1153-#5999)

### Solution: Prime First

```gcode
; Method 1: Prime through local variable
#100 = #880    ; ✅ Prime in local var
#1153 = #100   ; ✅ Now safe

; Method 2: Arithmetic "wash"
#1153 = #880 + 0   ; ✅ Addition prevents freeze

; Method 3: Use intermediate calculation
#1153 = #880 * 1   ; ✅ Multiplication works too
```

### What Needs Priming

**Safe (no priming needed)**:
- Local variables (#1-#999)
- System parameters (#500-#999)
- WCS offsets (#805-#834)

**Requires priming**:
- Persistent storage (#1153-#5999)

**See**: `variable-priming-card.md` for complete patterns

---

## 5. C-Style Operators Only

### ❌ FANUC Style (UNRELIABLE)

```gcode
IF #100 EQ 5 GOTO100   ; ❌ Unreliable
IF #100 NE 0 GOTO200   ; ❌ Unreliable
IF #100 LT 10 GOTO300  ; ❌ Unreliable
IF #100 GT 5 GOTO400   ; ❌ Unreliable
IF #100 LE 10 GOTO500  ; ❌ Unreliable
IF #100 GE 5 GOTO600   ; ❌ Unreliable
```

### ✅ C-Style (REQUIRED)

```gcode
IF #100 == 5 GOTO100   ; ✅ Reliable
IF #100 != 0 GOTO200   ; ✅ Reliable
IF #100 < 10 GOTO300   ; ✅ Reliable
IF #100 > 5 GOTO400    ; ✅ Reliable
IF #100 <= 10 GOTO500  ; ✅ Reliable
IF #100 >= 5 GOTO600   ; ✅ Reliable
```

**Community data**: 99% of production macros use C-style exclusively

---

## 6. WCS Stride = 5 (Not 20)

### Standard FANUC

```
Stride = 20
G54 = Base + 0×20
G55 = Base + 1×20
```

### DDCS M350

```
Stride = 5 (Non-standard!)
G54 = 805 + 0×5 = 805
G55 = 805 + 1×5 = 810
G56 = 805 + 2×5 = 815
```

### Address Calculation

```gcode
; Calculate WCS address
#wcs_index = 2   ; G55
#axis_offset = 0 ; 0=X, 1=Y, 2=Z, 3=A, 4=B

#address = 805 + [#wcs_index - 1] * 5 + #axis_offset
; G55 Y = 805 + (2-1)*5 + 1 = 811
```

---

## 7. Control Flow and Conditionals [CONFIRMED]

### IF Statement Syntax

**Simple conditions - NO BRACKETS:**
```gcode
✅ CORRECT:
IF #1922!=2 GOTO1        ; Simple condition, no brackets
IF #100==5 GOTO100       ; Equality test
IF #value<50 GOTO3000    ; Comparison

❌ WRONG:
IF [#1922!=2] GOTO1      ; No brackets on simple conditions
IF [#100 == 5] GOTO100   ; No brackets on simple conditions
```

**Complex expressions - USE BRACKETS:**
```gcode
✅ CORRECT:
IF [#100+#200]>50 GOTO2  ; Brackets for arithmetic
IF [#14==5]+[#14==4] GOTO10  ; Brackets for boolean logic

❌ WRONG:
IF #100+#200>50 GOTO2    ; Need brackets for expressions
```

**Rule**: Brackets ONLY for complex expressions, NOT for simple variable comparisons

### GOTO Syntax

```gcode
✅ CORRECT:
GOTO1                    ; No space before label
GOTO99                   ; No space
GOTO999                  ; No space

❌ WRONG:
GOTO 1                   ; No space allowed
GO TO1                   ; GOTO is one word
```

**Rule**: No space between GOTO and label number

### Label Numbers

```gcode
✅ PREFERRED:
N1, N2, N9               ; Single digits most reliable

✅ ACCEPTABLE:
N10, N99                 ; Double digits work

⚠️ USE CAUTION:
N100, N999               ; Three+ digits may cause parser errors
```

**Rule**: Use lowest label numbers possible. Single-digit labels (N1-N9) are most reliable.

### Program Flow Pattern

**Critical structure to prevent "falling through" into error handlers:**

```gcode
; Main code execution
[code executes]
#1505=-5000(Success!)
GOTO2                    ; ✅ Jump to end, skip error handlers

; Error handlers (between success and end)
N1                       ; Error label
#1505=1(Failed!)

; Program end (after all error handlers)
N2                       ; End label
M30
```

**Rule**: Success path MUST use GOTO to jump past error handlers to end label

### Complete Verified Pattern

**From production macro_cam10.nc:**
```gcode
; Configuration variables
#30=3
#31=0

; Main execution
G91
G31 Z-50 F200 P#30 L#31 Q0
IF #1922!=2 GOTO1              ; No brackets, no space in GOTO
#100=#1927

; Success path
#1505=-5000(Success!)
GOTO2                          ; Jump to end

; Error handler
N1                             ; Single digit label
#1505=1(Failed!)

; Program end
N2                             ; Single digit label
M30
```

**Key points**:
1. IF conditions: `IF #var!=2 GOTO1` (no brackets for simple comparisons)
2. GOTO statements: `GOTOx` (no space before label)
3. Labels: `N1`, `N2` (prefer single digits)
4. Flow: success uses GOTO to skip errors
5. Structure: config → code → success+GOTO → errors → end

**Verification**: [CONFIRMED] Production testing, January 2026

---

## Quick Command Reference

### Set Work Offset (Replace G10)

```gcode
; Set current position as G54 X0 Y0 Z0
#805 = #880
#806 = #881
#807 = #882
```

### Go to Machine Zero (Replace G28)

```gcode
#x = 0
#y = 0
#z = 0
G53 X#x Y#y Z#z
```

### Safe Persistent Variable Assignment

```gcode
; ALWAYS prime when assigning from #880+
#100 = #880
#1153 = #100
```

### Reliable Comparisons

```gcode
; Use C-style operators
IF #value == 100 GOTO1000
IF #count != 0 GOTO2000
IF #position < 50 GOTO3000
```

---

## Coordinate System Summary (Ultimate Bee 1010)

### Machine Coordinates (G53)

**True machine zero**:
- X=0, Y=0, Z=0 (at limit switches)

**Axis orientations**:
- X: 0 to +1000mm (positive)
- Y: 0 to **-735mm** (NEGATIVE)
- Z: 0 to **-150mm** (NEGATIVE)

### G28 Back-Off Positions

**NOT machine zero!**
- X: +5.0mm (5mm from switch)
- Y: -5.0mm (5mm from switch)
- Z: -5.0mm (5mm from switch)

### Work Coordinates (G54-G59)

**User-defined offsets**:
- Set via direct #805+ writes
- G10 is broken, don't use it
- 6 systems available (G54-G59)

---

## Three Numbering Systems

**Critical understanding**:

| System | Example | Where Used |
|--------|---------|------------|
| ENG File | #0, #129, #880 | .eng backup files |
| UI Display | Pr0, Pr129, Pr500 | Controller screen |
| Macro Address | #500, #629, #880 | **What you write** |

**Common pattern**: Pr[N] → #[N+500]

**Example**: Pr129 (probe thickness) → #629 in code

---

## Related Documentation

**For complete explanations**:
- `software-technical-spec.md` - Complete firmware quirks with examples
- `variable-priming-card.md` - All priming patterns
- `macrob-programming-rules.md` - MacroB syntax reference
- `system-control-variables.md` - Variable address map

**For working examples**:
- `example-macros/` - 25 production-tested macros
- `community-patterns-1-core.md` - Proven patterns
- `user-tested-patterns.md` - Ultimate Bee 1010 patterns

---

## Quick Validation Checklist

**Before running any macro**:

- [ ] No G10 commands (use #805+ instead)
- [ ] G53 uses variables only (no hardcoded constants)
- [ ] G28 not used for machine zero (use G53 instead)
- [ ] Persistent vars primed from #880+ (use local var first)
- [ ] All comparisons use C-style (==, !=, <, >, <=, >=)
- [ ] WCS addresses use stride 5 (not 20)
- [ ] IF statements: no brackets on simple conditions (`IF #var!=2 GOTO1`)
- [ ] GOTO statements: no space before label (`GOTO1` not `GOTO 1`)
- [ ] Labels: single or double digit (N1-N99 preferred)
- [ ] Success path uses GOTO to skip error handlers

---

## Document Status

**Type**: Quick reference - critical quirks only  
**Authority**: [CONFIRMED] V1.22 Production-tested  
**Last Updated**: January 2026

**For complete details with all examples and edge cases**, see full 571-line version or `software-technical-spec.md`.
