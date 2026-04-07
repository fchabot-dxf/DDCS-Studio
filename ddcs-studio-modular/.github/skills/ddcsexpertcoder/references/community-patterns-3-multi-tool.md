# Community Patterns from DDCS M350 Users
## Part 3: Multi-Tool Workflows

**📚 This is part of a 6-part series:**
- Part 1: [Core Patterns](community-patterns-1-core.md)
- Part 2: [Boolean & Dynamic G-code](community-patterns-2-boolean-dynamic.md)
- **Part 3: Multi-Tool Workflows** ← You are here
- Part 4: [Advanced Syntax Part 1](community-patterns-4-syntax-1.md)
- Part 5: [Advanced Syntax Part 2](community-patterns-5-syntax-2.md)
- Index: [Complete Series Guide](community-patterns.md)

---

## Multi-Tool Operation Patterns

**Source**: Rectangle_test.tap (post-processor output demonstrating practical patterns)

### 1. Computed GOTO for Operation Sequencing

**Pattern**: Use a variable to control which operation executes, enabling resume capability

**Why it matters**: 
- Allows resuming from specific tool/operation
- Handles multi-tool workflows elegantly
- Can recover from interruptions

```gcode
; Initialize operation counter
#step = 0

; Jump to current operation (N1, N2, N3...)
GOTO[#step+1]

N1  ; Operation 1 - First tool
#1300 = 1       ; Set tool number
; ... perform operation ...
#step = #step + 1
GOTO 99

N2  ; Operation 2 - Second tool
#1300 = 2       ; Set tool number
; ... perform operation ...
#step = #step + 1
GOTO 99

N3  ; Operation 3 - Third tool
#1300 = 3       ; Set tool number
; ... perform operation ...
#step = #step + 1
GOTO 99

N99  ; End of operations
M30
```

**With session persistence:**
```gcode
; Check if resuming from previous session
IF #1611 != 1 GOTO reset

; Continuing previous session - jump to saved step
GOTO[#310+1]

N reset
; Start new session
#310 = 0        ; Reset step counter
#1611 = 1       ; Mark session active
GOTO[#310+1]

; ... operations N1, N2, N3 as above ...

N99
#310 = 0        ; Clear for next run
#1611 = 0       ; Mark session complete
M30
```

**Use case - Manual tool changes:**
```gcode
; Operator can stop/restart at any tool
GOTO[#operation_step+1]

N1
G4P-1
;Insert 6mm endmill and press START
#1300 = 1
; ... cut with tool 1 ...
#operation_step = #operation_step + 1
GOTO 99

N2
G4P-1
;Insert 3mm endmill and press START
#1300 = 2
; ... cut with tool 2 ...
#operation_step = #operation_step + 1
GOTO 99

N99
M30
```

---

### 2. Tool Length Offset Calculation

**Pattern**: Calculate work surface Z-position accounting for tool length offset

**Why it matters**:
- Each tool has different length
- WCS Z-zero must be adjusted per tool
- Automatic compensation eliminates manual offset entry

**Tool offset storage (DDCS M350):**
- Tool 1 offset: #1430
- Tool 2 offset: #1431
- Tool 3 offset: #1432
- Tool N offset: #[1430 + N - 1]

**Basic calculation:**
```gcode
; Touch off surface with current tool
#current_tool = #1300      ; Active tool number
#touch_z = #882            ; Current Z machine position

; Calculate WCS Z-zero accounting for tool length
#807 = #touch_z - #[1430 + [#current_tool - 1]]

; Example:
; Tool 1 (20mm long, offset #1430=20)
; Touch at Z=-50mm machine
; #807 = -50 - 20 = -70mm (WCS Z-zero in machine coords)

; Tool 2 (15mm long, offset #1431=15)
; Touch at Z=-50mm machine  
; #807 = -50 - 15 = -65mm (WCS Z-zero adjusted for shorter tool)
```

**Interactive tool change with offset:**
```gcode
N tool_change
G4P-1
;Insert new tool, touch off surface, press START

; Get current tool number
#tool_num = #1300

; Calculate surface Z accounting for tool length
#wcs_z = #882 - #[1430 + [#tool_num - 1]]

; Update WCS Z-zero
#807 = #wcs_z

#1505 = -5000(Tool offset applied)
```

**Multi-tool workflow:**
```gcode
; First tool - establish surface
N tool1
G4P-1
;Insert Tool 1, touch surface, press START
#1300 = 1
#807 = #882 - #1430    ; Tool 1 offset

; ... cut with tool 1 ...

; Second tool - maintain same WCS
N tool2
G4P-1
;Insert Tool 2, touch surface, press START
#1300 = 2
#807 = #882 - #1431    ; Tool 2 offset (auto-adjusted)

; ... cut with tool 2 ...
```

**Why indirect addressing matters:**
```gcode
; WITHOUT indirect addressing (manual for each tool):
IF #1300 == 1 THEN #807 = #882 - #1430
IF #1300 == 2 THEN #807 = #882 - #1431
IF #1300 == 3 THEN #807 = #882 - #1432
; ... repeat for all tools ...

; WITH indirect addressing (automatic for any tool):
#807 = #882 - #[1430 + [#1300 - 1]]
; Works for tools 1-70 automatically!
```

**Store tool offsets:**
```gcode
; Measure and store tool lengths
#1430 = 20.0    ; Tool 1: 20mm
#1431 = 15.5    ; Tool 2: 15.5mm
#1432 = 12.0    ; Tool 3: 12mm
#1433 = 25.3    ; Tool 4: 25.3mm

; Now tool change workflow handles all automatically
#807 = #882 - #[1430 + [#1300 - 1]]
```

---

### 3. Manual WCS Setup via Interactive Jogging

**Pattern**: Operator jogs machine to reference features, macro saves positions as WCS

**Why it matters**:
- No probe required
- Works for any feature (edge, corner, hole center)
- Visual alignment by operator
- Simple and reliable

**Basic edge finding:**
```gcode
; X-axis edge
G4P-1
;Jog to X edge (left side) and press START
#805 = #880    ; Save current X machine position as WCS X-zero

; Y-axis edge
G4P-1
;Jog to Y edge (front side) and press START
#806 = #881    ; Save current Y machine position as WCS Y-zero

; Z-axis surface
G4P-1
;Jog to Z surface (top) and press START
#807 = #882    ; Save current Z machine position as WCS Z-zero

#1505 = -5000(WCS set by jogging)
```

**Corner reference:**
```gcode
; Set XY zero at part corner
G4P-1
;Jog to bottom-left corner (X/Y intersection) and press START

#805 = #880    ; X-zero at corner
#806 = #881    ; Y-zero at corner

; Then set Z separately
G4P-1
;Jog Z to top surface and press START
#807 = #882
```

**Center finding (visual):**
```gcode
; Find hole center by jogging
G4P-1
;Jog tool to center of hole and press START

#805 = #880    ; X-zero at center
#806 = #881    ; Y-zero at center
```

**With offset compensation:**
```gcode
; Account for tool radius when edge finding
#tool_radius = 3.0    ; 6mm tool = 3mm radius

; Jog to left edge
G4P-1
;Touch left edge with tool and press START
#805 = #880 + #tool_radius    ; Offset by radius

; Jog to front edge
G4P-1
;Touch front edge with tool and press START
#806 = #881 + #tool_radius    ; Offset by radius
```

**Full interactive setup:**
```gcode
O5000 (Interactive WCS Setup)

; Instructions
#1505 = -5000(WCS Setup: Follow instructions)
G04 P2000

; X-axis
G4P-1
;Jog to X-axis reference point and press START
#x_ref = #880

; Y-axis
G4P-1
;Jog to Y-axis reference point and press START
#y_ref = #881

; Z-axis
G4P-1
;Jog to Z-axis reference point (surface) and press START
#z_ref = #882

; Optional: Apply tool radius compensation
#1505 = 1(Apply tool radius offset? [1=Yes, 0=No])
IF #1505 == 1 GOTO apply_offset

; No offset
#805 = #x_ref
#806 = #y_ref
#807 = #z_ref
GOTO done

N apply_offset
#2070 = 100(Enter tool radius (mm): )
#radius = #100

#805 = #x_ref + #radius
#806 = #y_ref + #radius
#807 = #z_ref

N done
#1510 = #805
#1511 = #806
#1512 = #807
#1503 = 1(WCS: X[%.3f] Y[%.3f] Z[%.3f])
#2042 = 500
M30
```

**Advantages:**
- ✅ No probe hardware needed
- ✅ Works on any feature
- ✅ Operator visual verification
- ✅ Simple and fast

**Disadvantages:**
- ❌ Less repeatable than probe
- ❌ Operator skill dependent
- ❌ Time consuming for many parts

**Best used for:**
- One-off parts
- Complex features (hard to probe)
- Soft materials (where probe might mark)
- Parts with visual reference marks

---

### 4. Position Saving for Multi-Tool Returns

**Pattern**: Save position before tool change, return to same location with next tool

**Why it matters**:
- Maintains exact position between tools
- Enables precise multi-tool operations
- Reduces setup time

```gcode
; Before first tool change - save position
#1577 = #790    ; Save X work coordinate
#1578 = #791    ; Save Y work coordinate

; Perform tool change
G53 Z-5 F6000   ; Retract to safe height
M05             ; Stop spindle
G4P-1
;Change to next tool and press START

; Return to saved position with new tool
G0 X#1577 Y#1578    ; Return to saved XY
Z5                   ; Approach height
Z0                   ; Return to work Z
```

**With G31 return (more precise):**
```gcode
; Save position
#1577 = #790
#1578 = #791

; ... tool change sequence ...

; Return using G31 (rapid + probe verification)
G31 X#1577 Y#1578 F6000 P24 L0 K0 Q1

; Verify returned correctly
IF ABS[#880 - #1577] > 0.1 THEN #1505 = 1(ERROR: Position error!)
IF ABS[#881 - #1578] > 0.1 THEN #1505 = 1(ERROR: Position error!)
```

**Multi-tool operation with position tracking:**
```gcode
; Operation with 3 tools at same XY location

N tool1
G0 X50 Y50      ; Position for operation
#saved_x = #790
#saved_y = #791

; ... cut with tool 1 ...

; Change to tool 2
G53 Z-5 F6000
M05
G4P-1
;Insert Tool 2 and press START

; Return to saved position
G0 X#saved_x Y#saved_y

; ... cut with tool 2 ...

; Change to tool 3
G53 Z-5 F6000
M05
G4P-1
;Insert Tool 3 and press START

; Return again
G0 X#saved_x Y#saved_y

; ... cut with tool 3 ...
```

---


---

**Navigation**: [← Part 2: Boolean & Dynamic](community-patterns-2-boolean-dynamic.md) | [Part 4: Syntax 1 →](community-patterns-4-syntax-1.md)

**Part 3 of 6**
