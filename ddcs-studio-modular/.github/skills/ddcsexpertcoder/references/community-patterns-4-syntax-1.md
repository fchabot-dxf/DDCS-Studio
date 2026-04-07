# Community Patterns from DDCS M350 Users
## Part 4: Advanced Syntax Part 1

**📚 This is part of a 6-part series:**
- Part 1: [Core Patterns](community-patterns-1-core.md)
- Part 2: [Boolean & Dynamic G-code](community-patterns-2-boolean-dynamic.md)
- Part 3: [Multi-Tool Workflows](community-patterns-3-multi-tool.md)
- **Part 4: Advanced Syntax Part 1** ← You are here
- Part 5: [Advanced Syntax Part 2](community-patterns-5-syntax-2.md)
- Index: [Complete Series Guide](community-patterns.md)

---

## Advanced Syntax Patterns

**Source**: macro_DA_without_relay_advanced.nc (professional dual-axis homing, 348 lines)

These patterns demonstrate the extreme complexity possible with DDCS M350 MacroB programming.

### 1. Multi-Condition Validation

**Pattern**: Validate multiple variables in a single IF statement using boolean OR

**Source**: Line 41 of macro_DA_without_relay_advanced.nc

```gcode
; Validate 10 conditions at once
IF [#91<0]+[#91>4]+[#2<0]+[#2>4]+[#41==0]+[#43==0]+[#62==0]+[#50<0]+[#50>1]+[#19<0] GOTO711
```

**How it works:**
- Each bracketed expression evaluates to 0 (valid) or 1 (invalid)
- `+` operator sums results (boolean OR)
- Any non-zero sum means at least one condition failed
- Jump to error handler if sum > 0

**Pattern breakdown:**
```gcode
; Range validation
[#91 < 0] + [#91 > 4]        ; Axis number must be 0-4

; Zero-check validation
[#41 == 0] + [#43 == 0]      ; Ports must be configured (non-zero)

; Binary validation
[#50 < 0] + [#50 > 1]        ; Flag must be 0 or 1 only

; All chained with + (OR)
IF [condition1] + [condition2] + [condition3] GOTO error
```

**Practical examples:**

**Tool parameter validation:**
```gcode
; Validate tool diameter, speed, and depth
#tool_dia = 6.0
#rpm = 18000
#depth = 3.0

IF [#tool_dia <= 0] + [#tool_dia > 25] + [#rpm < 1000] + [#rpm > 24000] + [#depth <= 0] + [#depth > 10] GOTO invalid_params

; All valid - continue
GOTO start_cut

N invalid_params
#1505 = 1(ERROR: Invalid cutting parameters!)
M30

N start_cut
; ... cutting code
```

**Sensor configuration check:**
```gcode
; Verify all required sensors configured
#probe_port = 3
#tool_setter_port = 2
#limit_x_port = 10

IF [#probe_port == 0] + [#tool_setter_port == 0] + [#limit_x_port == 0] GOTO sensor_error

; All sensors configured
GOTO continue

N sensor_error
#1505 = 1(ERROR: Sensor ports not configured!)
M30
```

**Combined range and type validation:**
```gcode
; Validate homing parameters
#axis = 1          ; 0=X, 1=Y, 2=Z
#speed = 800       ; mm/min
#cycles = 3        ; number of approaches
#direction = 1     ; 0 or 1

IF [#axis < 0] + [#axis > 2] + [#speed < 10] + [#speed > 2000] + [#cycles < 1] + [#cycles > 10] + [#direction < 0] + [#direction > 1] GOTO homing_error

; Parameters valid
GOTO home_axis

N homing_error
#1510 = #axis
#1511 = #speed
#1503 = 1(Homing error: Axis[%.0f] Speed[%.0f])
M30
```

**Why this matters:**
- Consolidates validation into single statement
- Easier to read than multiple IF statements
- Reduces code size
- All checks happen atomically

---

### 2. Nested Indirect Addressing with Math

**Pattern**: Calculate variable address using nested indirection and arithmetic

**Source**: Line 62 of macro_DA_without_relay_advanced.nc

```gcode
IF #43 != #[15*#[612+#91]+1015+#91*3] GOTO581
```

**This is EXTREME complexity:**

**Step-by-step breakdown:**
```gcode
; Assume #91 = 1 (Y-axis)

; Step 1: Inner indirection
#[612+#91] = #[612+1] = #613
; Reads homing direction from #613

; Assume #613 = 1 (positive direction)

; Step 2: Math with inner result  
15 * #[612+#91] = 15 * 1 = 15

; Step 3: More math
+1015 + #91*3 = +1015 + 1*3 = +1018

; Step 4: Total calculation
15 + 1015 + 3 = 1018

; Step 5: Outer indirection
#[1018]
; Reads limit port from #1018

; Step 6: Compare
#43 != #1018
; Is slave sensor port different from limit port?
```

**Why it's complex:**
- **Nested indirection**: `#[...#[...]...]`
- **Math inside indirect**: `15*#[612+#91]`
- **Multiple operations**: Multiply, add, multiply again
- **Then outer indirect**: Wrap it all in `#[...]`

**Simpler examples building up to this:**

**Level 1: Basic indirect addressing**
```gcode
#100 = 50
#value = #[#100]    ; Reads #50
```

**Level 2: Indirect with offset**
```gcode
#base = 800         ; WCS base address
#offset = 5         ; X offset
#x_value = #[#base + #offset]    ; Reads #805 (G54 X)
```

**Level 3: Indirect with calculated offset**
```gcode
#wcs = 54           ; G54
#axis = 0           ; X-axis
#wcs_offset = [#wcs - 54] * 5    ; 0 * 5 = 0
#addr = 805 + #wcs_offset + #axis
#value = #[#addr]   ; Reads #805
```

**Level 4: Nested indirection (basic)**
```gcode
#ptr = 100          ; Pointer variable
#100 = 200          ; Points to #200
#value = #[#[#ptr]]  ; Reads #200 (double dereference)
```

**Level 5: Nested with math (ADVANCED)**
```gcode
; Like the DA macro pattern
#axis = 1
#base = #[600 + #axis]    ; Inner: reads #601
#offset = 10 * #base      ; Math with inner result
#final_addr = 1000 + #offset + #axis * 3
#value = #[#final_addr]   ; Outer: final address
```

**Practical use case:**
```gcode
; Dynamic parameter table lookup
; Access different parameter sets based on axis

#axis_num = 1        ; Y-axis
#param_type = 2      ; Speed parameter

; Each axis has 10 parameters starting at:
; X: #1000-#1009
; Y: #1010-#1019  
; Z: #1020-#1029

#base_addr = 1000 + #axis_num * 10
#param_addr = #base_addr + #param_type
#speed = #[#param_addr]    ; Reads #1012 (Y speed parameter)
```

**Why this matters:**
- Shows DDCS M350 can handle complex address calculations
- Enables sophisticated data structure access
- Allows building parameter lookup tables
- Essential for axis-agnostic code

---

### 3. Axis-Agnostic Variable Selection

**Pattern**: Write code that works for any axis (X/Y/Z/A/B) using letter number mapping

**Source**: Lines 67 and ~80s of macro_DA_without_relay_advanced.nc

```gcode
; Map axis number to letter number
#191 = #[940 + #91]

; Then use letter to select axis-specific variable
#[71 + #191] = [#32*2-1] * #53
```

**The mapping system:**

**Axis Numbers** (used for parameter addressing):
```
#91 = 0: X-axis
#91 = 1: Y-axis  
#91 = 2: Z-axis
#91 = 3: A-axis (4th axis)
#91 = 4: B-axis (5th axis)
```

**Letter Numbers** (used for variable arrays):
```
#191 = 0: X
#191 = 1: Y
#191 = 2: Z
#191 = 3: A
#191 = 4: B
#191 = 5: C
```

**Lookup table** (#940-#945):
```gcode
#940 = 0    ; Axis 0 (X) → Letter 0 (X)
#941 = 1    ; Axis 1 (Y) → Letter 1 (Y)
#942 = 2    ; Axis 2 (Z) → Letter 2 (Z)
#943 = 3    ; Axis 3 (A) → Letter 3 (A)
#944 = 4    ; Axis 4 (B) → Letter 4 (B)
#945 = 5    ; Axis 5 (C) → Letter 5 (C)
```

**Variable arrays accessed by letter:**
```gcode
; Direction/distance variables
#71: X direction/distance
#72: Y direction/distance
#73: Z direction/distance
#74: A direction/distance
#75: B direction/distance
#76: C direction/distance

; Access pattern:
#[71 + #191] = value
; If #191=1 (Y): Sets #72
; If #191=2 (Z): Sets #73
```

**Complete example - Generic axis homing:**

```gcode
O5000 (Generic Axis Homing)

; Input parameter
#axis_num = 1    ; Which axis to home (0=X, 1=Y, 2=Z, etc.)

; Map to letter number
#letter = #[940 + #axis_num]

; Get axis-specific parameters using letter
#speed = #[607 + #axis_num]        ; Homing speed from #607-#611
#direction = #[612 + #axis_num]    ; Homing direction from #612-#616

; Calculate distance with direction
#distance = [#direction*2-1] * 100  ; ±100mm

; Store in axis-specific variable using letter
#[71 + #letter] = #distance

; Execute homing move on correct axis
; The #[71+#letter] variable gets substituted correctly
IF #letter == 0 THEN G91 G31 X#[71+#letter] F#speed P10 L0 Q1
IF #letter == 1 THEN G91 G31 Y#[71+#letter] F#speed P11 L0 Q1
IF #letter == 2 THEN G91 G31 Z#[71+#letter] F#speed P12 L0 Q1

; Store result in axis-specific variable
#[80 + #letter] = #[1925 + #letter]  ; Save found position

#1510 = #axis_num
#1511 = #[80 + #letter]
#1503 = 1(Axis[%.0f] homed at [%.3f])

M30
```

**Practical use - Multi-axis configuration:**

```gcode
; Configure all axes in a loop
#axis = 0

WHILE #axis <= 2 DO1    ; X, Y, Z
    #letter = #[940 + #axis]
    
    ; Set axis-specific speeds
    #[607 + #axis] = 800           ; Fast speed
    
    ; Set axis-specific directions  
    #[612 + #axis] = 1             ; Positive direction
    
    ; Store in working variables
    #[71 + #letter] = 0            ; Zero distance variable
    
    #axis = #axis + 1
END1
```

**Why this matters:**
- Write once, works for any axis
- Reduces code duplication
- Makes maintenance easier
- Enables flexible axis assignment
- Critical for dual-axis systems (Y and A working as one)

---

### 4. Compact Direction Flag to Signed Distance

---

**Navigation**: [← Part 3: Multi-Tool](community-patterns-3-multi-tool.md) | [Part 5: Syntax 2 →](community-patterns-5-syntax-2.md)

**Part 4 of 6**
