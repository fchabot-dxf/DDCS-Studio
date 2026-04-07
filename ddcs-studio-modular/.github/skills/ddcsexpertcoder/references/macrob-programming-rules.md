# MacroB Programming Rules for DDCS M350/Expert

**Community-compiled guide** - Essential rules and best practices for MacroB programming on FOINNC M350 controllers.

**Contributors**: Николай Звягинцев and community members

**⭐ BEFORE READING THIS DOCUMENT ⭐**

**Learn from working code FIRST:**
1. Browse `example-macros/` directory (22 production-tested files)
2. Find a macro similar to what you want to create
3. Study the working code - see actual syntax in practice
4. Copy and modify the example as your starting point
5. **Then** use this document to understand the rules

**Why?** Example macros show the syntax that actually works on real machines. This document explains the rules, but examples show real implementation. When in doubt, **trust the examples over the documentation**.

**IMPORTANT NOTE ON COMPARISON OPERATORS:**
This guide originally documented FANUC-style operators (`EQ`, `NE`, `LT`, `GT`, `LE`, `GE`) as the standard. However, analysis of actual production macros reveals that **C-style operators (`==`, `!=`, `<`, `>`, `<=`, `>=`) are overwhelmingly preferred in practice** (90+ uses vs 2 uses in example macro library). While the controller supports both styles, **use C-style operators for consistency with real-world code**.

---

## CRITICAL: Enable Macro Execution

**Before ANY macros will work:**

**Parameter #0076 (Pr76) must be set to "OPEN"**

```
Menu → Parameters → Pr76
Set value to: OPEN
```

Without this setting, macros will not execute!

---

## M350-Specific Syntax Rules

### 1. Program Start - No Percent Sign

**WRONG (FANUC style):**
```gcode
%
O0001
G0 X0 Y0
M30
%
```

**CORRECT (M350 style):**
```gcode
O0001
G0 X0 Y0
M30
```

**Rule**: Do NOT use `%` at start of program

---

### 2. Subprogram Naming

**Subprograms must use O-number format:**
```gcode
O0001  ; Subprogram 1
O0002  ; Subprogram 2
O9999  ; Subprogram 9999
```

Called with:
```gcode
M98 P0001  ; Call subprogram O0001
```

---

### 3. Comment Styles (Three Options)

**Style 1: Parentheses (inline or standalone)**
```gcode
G0 X0 (move to origin)
(This is a full line comment)
```

**Style 2: Double slash**
```gcode
G0 X0 //move to origin
//This is a full line comment
```

**Style 3: Semicolon (RECOMMENDED)**
```gcode
G0 X0 ;move to origin
;This is a full line comment
```

**Best practice**: Use `;` for comments - most compatible with simulation software

**WARNING**: Some simulation software treats `/` as division OR comment, which can cause confusion. Avoid `//` if using simulation.

---

### 4. Variable Assignment

**Syntax**: `#number = value`

**Variable ranges:**
- `#0 - #49` - User variables (verified working range)
- `#100+` - See DDCS_Variables_mapping_2025-01-04.xlsx for system variables

**Best practice:**
```gcode
;=== VARIABLE INITIALIZATION ===
#0 = 0      ; Wash variable first
#1 = 0
#2 = 0

;=== VARIABLE ASSIGNMENTS ===
#0 = 10     ; Width
#1 = 20     ; Length  
#2 = #0*2   ; Calculated value
```

**Rules:**
- Always comment what each variable is for
- Initialize at beginning of macro
- Only numbers or calculations allowed in variables
- Prime variables before assigning system variables (see variable-priming-card.md)

---

### 5. Control Statements MUST Be UPPERCASE

**WRONG:**
```gcode
if #1 le 0 goto 20
while #1 lt 10 do 1
```

**CORRECT:**
```gcode
IF #1 <= 0 GOTO 20
WHILE #1 < 10 DO 1
```

**Comparison Operators (C-style - STANDARD IN PRACTICE):**

The M350 controller supports **both** FANUC-style and C-style comparison operators, but **C-style operators (`==`, `!=`, `<`, `>`, `<=`, `>=`) are overwhelmingly preferred** in actual production macros.

**C-Style Operators (RECOMMENDED - Used in 99% of real macros):**
- `==` (equal)
- `!=` (not equal)
- `<` (less than)
- `>` (greater than)
- `<=` (less than or equal)
- `>=` (greater than or equal)

**FANUC-Style Operators (Supported but rarely used):**
- `EQ` (equal)
- `NE` (not equal)
- `LT` (less than)
- `GT` (greater than)
- `LE` (less than or equal)
- `GE` (greater than or equal)

**Evidence from actual macros:**
- Analysis of example macros shows C-style operators used 90+ times
- FANUC-style operators found only 2 times in entire macro library
- Even macros that use FANUC-style mix it with C-style (18:2 ratio in one file)

**Recommendation:** **Use C-style operators (`==`, `!=`, `<`, `>`, `<=`, `>=`)** for consistency with actual practice.

**Required UPPERCASE keywords (still mandatory):**
- `GOTO`
- `IF`
- `WHILE`
- `DO`
- `END`

---

### 6. Brackets and Conditional Syntax

**CRITICAL UPDATES (January 2026)**: Production testing revealed strict parser rules for IF/GOTO syntax.

#### IF Statement Bracket Rules

**Simple conditions - NO BRACKETS:**
```gcode
✅ CORRECT:
IF #1<=0 GOTO20          ; Simple comparison, no brackets
IF #100==5 GOTO100       ; Equality test
IF #var!=2 GOTO1         ; Not-equal test

❌ WRONG:
IF [#1<=0] GOTO20        ; No brackets on simple conditions
IF [#100==5] GOTO100     ; Parser error
IF [#var!=2] GOTO1       ; Causes syntax error
```

**Complex expressions - USE BRACKETS:**
```gcode
✅ CORRECT:
IF [#a+#b]>0 GOTO1       ; Brackets for arithmetic
IF [#100*2]<200 GOTO2    ; Brackets for expressions

❌ WRONG:
IF #a+#b>0 GOTO1         ; Need brackets for expressions
```

**Rule discovered**: Parser treats bracketed simple conditions as syntax errors. Only use brackets for arithmetic/logical expressions.

#### GOTO Spacing Rule

**GOTO must have NO SPACE before label:**

```gcode
✅ CORRECT:
GOTO1                    ; No space
GOTO20                   ; No space
GOTO999                  ; No space
IF #1==0 GOTO100         ; No space in IF statement

❌ WRONG:
GOTO 1                   ; Space causes "[N]was not found" error
GOTO 20                  ; Parser error
IF #1==0 GOTO 100        ; Space before label fails
```

**Error encountered**: `[N]was not found:L124[GOTO999]` when space used

#### Label Number Reliability

**Parser sensitivity to label digit count:**

```gcode
✅ MOST RELIABLE:
N1, N2, N9               ; Single digits preferred

✅ ACCEPTABLE:
N10, N20, N99            ; Double digits work

⚠️ LESS RELIABLE:
N100, N990, N999         ; Three+ digits may cause parser errors
```

**Production data**: Three-digit labels caused parser failures in testing. Use lowest numbers possible.

#### Program Flow Pattern

**CRITICAL**: Success must GOTO past error handlers

```gcode
❌ WRONG (falls through):
; Success code
#1503=1(Success!)
M30

; This error handler will execute!
N1
#1505=1(Error!)
M30

✅ CORRECT:
; Success code
#1503=1(Success!)
GOTO2                    ; Jump past errors

; Error handler
N1
#1505=1(Error!)

; End label
N2
M30
```

#### Complete Verified Pattern

**From production macro_cam10.nc (January 2026):**

```gcode
; Init
#30=3
#31=0

; Execute
G91
G31 Z-50 F200 P#30 L#31 Q0
IF #1922!=2 GOTO1        ; No brackets, no space

; Success
#1505=-5000(Success!)
GOTO2                    ; Jump to end

; Error
N1
#1505=1(Failed!)

; End
N2
M30
```

---

### 7. Simulation Software Compatibility

**When writing macros in external software (Fusion 360, etc):**

1. **Remove unnecessary brackets** - `[#1]` → `#1`
2. **Remove verbose comments** - keep only essential `;comments`
3. **Keep macro as short as possible**
4. **Test on actual M350 controller**

**Why?** Simulation software often has different:
- IF/LOOP syntax requirements
- Bracket handling
- Comment parsing
- Variable ranges

**ALWAYS test on real controller before production use!**

---

### 8. Macro Safety Disclaimer

**⚠️ CRITICAL SAFETY NOTICE ⚠️**

When using macros from forums/community:

1. ✅ **Verify** all parameters match your machine
2. ✅ **Test** in simulation mode first (Pr245 = "line")
3. ✅ **Understand** what the macro does before running
4. ✅ **Check** distances, speeds, positions
5. ✅ **Be ready** to E-stop during first test

**You are responsible for:**
- Crashes caused by incorrect parameters
- Machine damage from untested macros
- Understanding macro functionality

**Original poster is NOT responsible for damage to your machine!**

---

## Testing & Debugging Workflow

### Step 1: Enable Simulation Mode

**Parameter #0245 (Pr245):**
```
Set to: "line"
```

This enables line-by-line simulation on controller.

### Step 2: Run Simulation

1. **Menu → PROGRAM**
2. Use ↑↓ arrows to select your macro
3. **Right menu → SIMULATION**

**If simulation doesn't run:**
- There are errors in the program
- Check line numbers for position
- Previous calculations may be wrong

**Simulation modes (Pr245):**
- `line` - Line by line (RECOMMENDED for testing)
- `3D` - 3D graphical simulation
- `Statue` - Static view
- Other modes may prevent simulation

### Step 3: Dry Run with Pauses

**Add debug pauses:**
```gcode
#1503 = 1(Reached step 1)  ; Show progress
G04 P5000                   ; Pause 5 seconds

; ... critical section ...

#1503 = 1(Reached step 2)
G04 P5000
```

**Benefits:**
- See where program is in execution
- Verify calculations at each step
- Stop before crashes

### Step 4: Machine-Level Test

**During first real run:**
- Keep finger on E-stop
- Run at reduced feedrate override (50%)
- Watch for unexpected movements
- Stop immediately if anything looks wrong

**Line numbers** in error messages show position, but error may come from earlier calculation.

---

## Display System for Testing

### #1503 - Status Bar (68 char max)

**Show program position:**
```gcode
#1503 = 1(Step 1: Homing axes)
; ... homing code ...

#1503 = 1(Step 2: Probing workpiece)
; ... probe code ...

#1503 = 1(Step 3: Complete!)
```

**Show values (max 4 variables):**
```gcode
#0 = 0
#0 = 123.456

#1510 = #0      ; Variable 1
#1511 = 10.5    ; Variable 2
#1512 = 789     ; Variable 3
#1513 = 55      ; Variable 4

#1503 = 1(Values: [%.3f] [%.1f] [%.0f] [%.0f])
; Shows: "Values: 123.456 10.5 789 55"
```

**Limits:**
- Maximum 68 characters total
- Maximum 4 variables (#1510-#1513)
- Green text at bottom of screen
- Message number = input + 3000

### #1505 - Dialog Popup (68 char max)

**Pause with message:**
```gcode
#1505 = 1(Move to position /Press ENTER when ready)
; Program stops until ENTER pressed
```

**Binary choice:**
```gcode
#1505 = 3(Move Right[Enter] or Left[Esc]?)
IF #1505 = 0 GOTO 1   ; ESC = 0
G01 X10 F200          ; ENTER = 1
GOTO 2
N1
G01 X-10 F200         ; ESC path
N2
```

**Using variables in dialogs:**
```gcode
#1 = 0
#1 = 42.123

#1510 = #1
#1511 = 100
#1512 = #1*2

#1505 = 1(Test: [%.3f] [%.0f] [%.1f])
; Shows: "Test: 42.123 100 84.2"
```

---

## Critical Parameters Reference

### Macro Execution
| Parameter | Name | Value | Purpose |
|-----------|------|-------|---------|
| Pr76 | #0076 | OPEN | **REQUIRED** - Enables macro execution |
| Pr245 | #0245 | line | Simulation mode (for testing) |

### System Access (Use with CAUTION)
| Level | Password | Access |
|-------|----------|--------|
| Operator | 666666 | Basic parameters |
| Admin | 777777 | Advanced parameters |
| Super Admin | 888888 | All parameters (DANGER) |

**⚠️ WARNING**: Changing parameters can damage machine! **Always backup to USB first!**

---

## Best Practices Summary

**✅ DO:**
1. Set Pr76 to OPEN before running macros
2. Comment all variables at start
3. Use `;` for comments
4. Write control statements in UPPERCASE
5. Test in simulation first
6. Add #1503 progress indicators
7. Use G04 pauses during testing
8. Backup parameters before changes
9. Verify all distances/speeds
10. Keep E-stop accessible

**❌ DON'T:**
1. Start programs with `%`
2. Use lowercase for IF/GOTO/WHILE
3. Run untested macros at full speed
4. Skip simulation testing
5. Trust macros from unknown sources
6. Change parameters without backup
7. Use macros you don't understand
8. Forget variable priming (see variable-priming-card.md)

---

## Syntax Quick Reference

```gcode
;=== PROGRAM START (no %) ===
O0001

;=== VARIABLE INIT ===
#0=0 ;width
#1=0 ;length
#2=0 ;depth

;=== ASSIGNMENTS ===
#0=10
#1=20
#2=#0*2

;=== CONTROL FLOW (NO BRACKETS ON SIMPLE IF) ===
IF #0>5 GOTO10           ; No brackets for simple condition
IF #0!=0 GOTO20          ; No space before label
WHILE #1<100 DO1
#1=#1+1
END1

;=== COMPLEX EXPRESSIONS (USE BRACKETS) ===
IF [#0+#1]>50 GOTO30     ; Brackets for arithmetic

N10
;=== DISPLAY ===
#1503=1(Position: X[%.3f] Y[%.3f])

;=== USER PROMPT ===
#1505=1(Continue?)
IF #1505==0 GOTO999      ; Error path

;=== SUCCESS PATH ===
#1503=1(Complete!)
GOTO2                    ; Jump past errors

;=== ERROR EXIT ===
N999
#1505=1(Operation cancelled!)

;=== PROGRAM END ===
N2
M30
```

---

## Additional Resources

- **Variable priming**: See `variable-priming-card.md`
- **Variable mapping**: See `DDCS_Variables_mapping_2025-01-04.xlsx`
- **Display methods**: See `ddcs-display-methods.md`
- **Controller quirks**: See `CORE_TRUTH.md`
- **Example macros**: See `example-macros/` directory

---

**Remember**: These rules were learned "the hard way" by the community. Following them will save you crashes, damaged tools, and wasted time!

**Community knowledge > Documentation**

Test everything. Trust nothing. Verify results.
