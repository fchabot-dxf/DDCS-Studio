# Community Patterns from DDCS M350 Users
## Part 2: Boolean & Dynamic G-code

**📚 This is part of a 6-part series:**
- Part 1: [Core Patterns](community-patterns-1-core.md)
- **Part 2: Boolean & Dynamic G-code** ← You are here
- Part 3: [Multi-Tool Workflows](community-patterns-3-multi-tool.md)
- Part 4: [Advanced Syntax Part 1](community-patterns-4-syntax-1.md)
- Part 5: [Advanced Syntax Part 2](community-patterns-5-syntax-2.md)
- Index: [Complete Series Guide](community-patterns.md)

---

## Advanced Patterns from macro_Adaptive_Pocket.nc

### 1. Boolean OR Operator (Multiple Conditions)

**Pattern**: Use `+` (addition) as boolean OR to combine multiple conditions in IF statements

**Source**: macro_Adaptive_Pocket.nc, line 58

```gcode
; Check if BOTH expressions are zero (skip unnecessary moves)
IF [#23+#16*#30+#33==0] + [#[21+#15]+#16*#30*[1-#15*2]+#33*[1-#15*2]==0] GOTO51
```

**How it works:**
- Each bracketed expression evaluates to 0 (false) or 1 (true)
- `+` adds the boolean results: 0+0=0 (both false), 0+1=1 (one true), 1+1=2 (both true)
- IF statement triggers if result is non-zero (any condition true)

**Simplified example:**
```gcode
; Jump if EITHER X is negative OR Y is zero
IF [#X < 0] + [#Y == 0] GOTO error

; Jump if ANY of three conditions are true
IF [#depth > 100] + [#speed < 10] + [#tool == 0] GOTO problem
```

**Boolean AND operator**: Use `*` (multiplication)
```gcode
; Jump only if BOTH conditions are true
IF [#X > 0] * [#Y > 0] GOTO quadrant_1

; All three must be true
IF [#ready == 1] * [#homed == 1] * [#tool != 0] GOTO start_cut
```

**Complex logic:**
```gcode
; (A OR B) AND C
IF [[#A == 1] + [#B == 1]] * [#C == 1] GOTO proceed

; A AND (B OR C)
IF [#A == 1] * [[#B == 1] + [#C == 1]] GOTO proceed
```

**Why this matters:**
- DDCS M350 doesn't have explicit AND/OR keywords
- Use math operators: `+` for OR, `*` for AND
- Enables complex decision logic in single IF statement

---

### 2. Dynamic G-Code Generation

**Pattern**: Calculate G-code numbers at runtime using variables

**Source**: macro_Adaptive_Pocket.nc, lines 17 and 60

#### Save Active Work Coordinate System
```gcode
; #578 contains active WCS number (54=G54, 55=G55, etc.)
G[53+#578]    ; Saves current WCS

; Example: If G55 is active (#578=55)
; G[53+55] = G108 = Save G55 offsets
```

**How #578 works:**
- G54 active → #578 = 54 → G[53+54] = G107
- G55 active → #578 = 55 → G[53+55] = G108  
- G56 active → #578 = 56 → G[53+56] = G109
- G57 active → #578 = 57 → G[53+57] = G110
- G58 active → #578 = 58 → G[53+58] = G111
- G59 active → #578 = 59 → G[53+59] = G112

#### Conditional Arc Direction (Climb vs Conventional)
```gcode
#15 = 0       ; 0 = Climb (CCW), 1 = Conventional (CW)

G[3-#15]X... Y... R...    ; G3 or G2 based on #15

; If #15=0 (climb):   G[3-0] = G3 (CCW arc)
; If #15=1 (conv):    G[3-1] = G2 (CW arc)
```

**Real-world usage:**
```gcode
; Adaptive toolpath direction
#climb_mode = 0    ; User sets milling mode

; Generate correct arc command
G[3-#climb_mode]X10 Y10 R5

; Or for full circle:
G[3-#climb_mode]I5 J0
```

#### Dynamic Plane Selection
```gcode
#plane = 17    ; 17=G17 (XY), 18=G18 (XZ), 19=G19 (YZ)
G#plane        ; Select plane dynamically
```

#### Dynamic Tool Call
```gcode
#current_tool = 5
T#current_tool     ; Call tool T5

; Or calculated:
#next_tool = #current_tool + 1
T#next_tool
```

**Limitations:**
- Cannot use with modal groups requiring separate lines
- Some commands may not support variable substitution
- Always test dynamic G-code on your controller

---

### 3. Advanced Indirect Addressing

**Pattern**: Variable number calculated at runtime

**Source**: macro_Adaptive_Pocket.nc, line 59

```gcode
; Variable address calculated on-the-fly
X#[21+#15]+#16*#30*[1-#15*2]+#33*[1-#15*2]

; Breakdown:
; #[21+#15] reads from variable #21 or #22 depending on #15
; If #15=0: reads #21
; If #15=1: reads #22
```

**Simple indirect addressing:**
```gcode
; Read from variable whose number is in #100
#value = #[#100]

; If #100=50, this reads #50
; If #100=150, this reads #150
```

**Calculated variable access:**
```gcode
; Access WCS offsets dynamically
#wcs = 54              ; G54
#offset = 5            ; X offset position in WCS table

; Read X offset for active WCS
#x_offset = #[805 + [#wcs-54]*5 + 0]   ; X is at +0
#y_offset = #[805 + [#wcs-54]*5 + 1]   ; Y is at +1
#z_offset = #[805 + [#wcs-54]*5 + 2]   ; Z is at +2
```

**Loop through variables:**
```gcode
; Sum values in #100-#110
#sum = 0
#i = 100

WHILE #i <= 110 DO1
    #sum = #sum + #[#i]
    #i = #i + 1
END1

#1510 = #sum
#1503 = 1(Total: %.2f)
```

**Array-like access:**
```gcode
; Store tool diameters in #200-#209
#200 = 6.0     ; Tool 1: 6mm
#201 = 3.0     ; Tool 2: 3mm
#202 = 12.0    ; Tool 3: 12mm
; ...

; Access by tool number
#tool_num = 2
#diameter = #[199 + #tool_num]    ; Reads #201 = 3.0
```

**Conditional variable selection:**
```gcode
; Choose between two variable sets based on condition
#use_set_a = 1     ; 1=use set A, 0=use set B

; Set A stored in #100-#105
; Set B stored in #200-#205

#base = 100 + [#use_set_a * 100]   ; #base = 100 or 200

#value1 = #[#base + 0]
#value2 = #[#base + 1]
#value3 = #[#base + 2]
```

**Why this matters:**
- Enables flexible, reusable macros
- Reduces code duplication
- Allows data-driven programming
- Essential for advanced automation

---

### 4. Complex Nested Expressions

**Pattern**: Multi-level mathematical expressions with brackets

**Source**: macro_Adaptive_Pocket.nc, throughout

```gcode
; Complex calculation in single line
#result = #[22-#15]-#16*#30*[1-#15*2]-#33*[1-#15*2]

; Nested bracket evaluation:
; 1. [1-#15*2] calculates first (innermost)
; 2. Results used in multiplication
; 3. [22-#15] evaluates for indirect addressing
; 4. All combined for final result
```

**Order of operations** (DDCS M350 follows standard math rules):
1. Brackets `[]` - innermost first
2. Functions (SIN, COS, SQRT, etc.)
3. Multiplication `*` and Division `/`
4. Addition `+` and Subtraction `-`
5. Comparisons (`<`, `>`, `==`, etc.)
6. Boolean operations (`*` for AND, `+` for OR)

**Examples by complexity:**

**Level 1 - Simple:**
```gcode
#result = #width / 2 + #offset
```

**Level 2 - Nested:**
```gcode
#steps = FIX[[#total - #min] / [#stepover * 2]]
```

**Level 3 - Conditional math:**
```gcode
; Different calculation based on flag
#value = #base + #offset * [1 - #reverse * 2]
; If #reverse=0: #base + #offset * 1
; If #reverse=1: #base + #offset * -1
```

**Level 4 - Multiple indirection:**
```gcode
; Nested variable lookup with calculation
#coord = #[#[100 + #axis] + #offset * [#dir * 2 - 1]]
```

**Practical pattern - Bidirectional offset:**
```gcode
; Add or subtract based on direction flag
#15 = 0    ; 0=positive direction, 1=negative direction

; This pattern: [1-#15*2] produces:
; If #15=0: [1-0*2] = 1  (positive multiplier)
; If #15=1: [1-1*2] = -1 (negative multiplier)

X#center + #offset * [1-#15*2]
; Climb (0):  X = center + offset
; Conv (1):   X = center - offset
```

---


---

**Navigation**: [← Part 1: Core](community-patterns-1-core.md) | [Part 3: Multi-Tool →](community-patterns-3-multi-tool.md)

**Part 2 of 6**
