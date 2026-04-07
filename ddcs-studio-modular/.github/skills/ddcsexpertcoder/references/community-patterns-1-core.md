# Community Patterns from DDCS M350 Users
## Part 1: Core Patterns & Best Practices

**📚 This is part of a 6-part series:**
- **Part 1: Core Patterns** ← You are here
- Part 2: [Boolean & Dynamic G-code](community-patterns-2-boolean-dynamic.md)
- Part 3: [Multi-Tool Workflows](community-patterns-3-multi-tool.md)
- Part 4: [Advanced Syntax Part 1](community-patterns-4-syntax-1.md)
- Part 5: [Advanced Syntax Part 2](community-patterns-5-syntax-2.md)
- Index: [Complete Series Guide](community-patterns.md)

---

# Proven Community Macro Patterns

This document contains working macro patterns from the DDCS M350 community that have been tested and proven reliable across multiple machines.

## Core Patterns

### 1. G31 Probe Command - Extended Syntax

The DDCS M350 supports extended G31 parameters (official M350 specification):

```gcode
G31 X Y Z A B C P L K Q F
```

**Parameters (Official M350 Documentation):**
- `X, Y, Z, A, B, C`: Axis movement target position (scan distance/direction)
- `F`: Moving speed (feedrate)
- `P`: Input port number (sensor port)
- `L`: Effective level (0=Normally Open, 1=Normally Closed)
- `K`: Scanning method (scanning behavior mode)
- `Q`: Stop mode after signal is valid (0=slow down, 1=stop immediately)

**CRITICAL**: Parameter #76 MUST be "OPEN" for G31 to work

**Probe Result Variables (Official Macro Addresses):**
- `#1920`: X-axis hit flag (0=miss, 1=hit) - community documented
- `#1921`: Y-axis hit flag (0=miss, 1=hit) - community documented
- `#1922`: Z-axis hit flag (0=miss, 1=hit) - community documented
- `#1925`: X MACH Pos (machine coordinate when scan signal valid)
- `#1926`: Y MACH Pos (machine coordinate when scan signal valid)
- `#1927`: Z MACH Pos (machine coordinate when scan signal valid)
- `#1928`: 4th axis (A) MACH Pos (machine coordinate when scan signal valid)
- `#1929`: 5th axis (B) MACH Pos (machine coordinate when scan signal valid)

**Official documentation**: `M350_instruction_description-G31.pdf` in references folder.

### 2. Hole Center Finding (3D Probe)

**Pattern**: Two-pass probe sequence with fast/slow approach

```gcode
(Find hole center with 3D touch probe)

; Configuration
#1 = 50        ; max movement X
#2 = 50        ; max movement Y
#3 = 200       ; fast speed
#14 = 20       ; slow speed
#15 = 1        ; retract distance (отскок)
#30 = #1078    ; probe input port
#31 = #1080    ; probe active level

; Store starting position
#10 = #880     ; current X machine
#11 = #881     ; current Y machine

; Initialize result variables
#20 = 0        ; left position
#21 = 0        ; right position
#22 = 0        ; back position
#23 = 0        ; front position
#24 = 0        ; X center
#25 = 0        ; Y center

; Probe Y-axis (back)
G91 G31 Y-#2 F#3 P#30 L#31 Q1
IF #1921 == 0 GOTO 1         ; edge not found!
#22 = #1926                  ; store back position
G53 Y[#22 + #15]             ; retract
G91 G31 Y[-#15*2] F#14 P#30 L#31 Q1  ; slow probe
IF #1921 == 0 GOTO 1
#22 = #1926                  ; precise position
G53 Y#11                     ; return to start

; Probe Y-axis (front)
G91 G31 Y#2 F#3 P#30 L#31 Q1
IF #1921 == 0 GOTO 1
#23 = #1926
G53 Y[#23 - #15]
G91 G31 Y[#15*2] F#14 P#30 L#31 Q1
IF #1921 == 0 GOTO 1
#23 = #1926
#25 = [#22 + #23] / 2        ; calculate Y center
G53 Y#25                     ; move to Y center

; Probe X-axis (left)
G91 G31 X-#1 F#3 P#30 L#31 Q1
IF #1920 == 0 GOTO 1
#20 = #1925
G53 X[#20 + #15]
G91 G31 X[-#15*2] F#14 P#30 L#31 Q1
IF #1920 == 0 GOTO 1
#20 = #1925
G53 X#10                     ; return to start

; Probe X-axis (right)
G91 G31 X#1 F#3 P#30 L#31 Q1
IF #1920 == 0 GOTO 1
#21 = #1925
G53 X[#21 - #15]
G91 G31 X[#15*2] F#14 P#30 L#31 Q1
IF #1920 == 0 GOTO 1
#21 = #1925
#24 = [#20 + #21] / 2        ; calculate X center
G53 X#24                     ; move to X center

; Calculate WCS offset address (dynamic)
#17 = [#2607 - 54] * 5       ; WCS offset stride

; Set current WCS zero at hole center
#[805 + #17] = #880          ; set X offset
#[806 + #17] = #881          ; set Y offset

#1505 = 1(Center found!)
GOTO 2

N1
#1505 = 1(Edge not found!)
N2
M30
```

**Key insights:**
- Two-pass approach: fast then slow for precision
- Store starting position to return after probing
- Use G53 with variables (works reliably here)
- Dynamic WCS offset calculation
- Retract (отскок) prevents damage on approach

### 3. Surface Finding (Z-Probe)

```gcode
(Find surface with 3D touch probe)

#1 = 50        ; max stroke Z
#2 = 25        ; probe length/tool offset
#3 = 200       ; fast speed
#14 = 20       ; slow speed
#15 = 1        ; retract distance
#30 = #1078    ; probe port
#31 = #1080    ; probe level
#17 = [#2602 - 54] * 5  ; WCS offset

#10 = #882     ; current Z machine position
#20 = 0        ; Z trigger position

; Fast probe
G91 G31 Z-#1 F#3 P#30 L#31 Q1
IF #1922 == 0 GOTO 1
#20 = #1927

; Retract and slow probe
G53 Z[#20 + #15]
G91 G31 Z[-#15*2] F#14 P#30 L#31 Q1
IF #1922 == 0 GOTO 1
#20 = #1927

; Safe retract
G53 Z[#20 + 10]

; Set WCS Z offset (compensate for probe length)
#[807 + #17] = #20 - #2

#1505 = 1(Surface found!)
GOTO 2

N1
#1505 = 1(Probe failed!)
N2
M30
```

### 4. G4P-1 Interactive Pause

**Undocumented feature**: `G4P-1` creates interactive pause with on-screen instructions

```gcode
; Move cutter to table surface manually
G4P-1
G1
;Move Z to table
;and press START
#1577 = #882   ; Capture position after START pressed

; Continue with captured position
#807 = #882 - #[1430 + [#1300 - 1]]  ; Set Z zero
```

**How it works:**
- `G4P-1` pauses execution
- Comments immediately following appear on screen
- Operator performs manual action (jog, position, inspect)
- Press START to continue
- Next line executes and can capture current position

**Use cases:**
- Manual tool touch-off
- Visual alignment verification
- Interactive setup steps
- Position capture after manual adjustment

### 5. Dual-Gantry Y/A Synchronization

**Pattern**: Keep A-axis synchronized with Y-axis for dual-gantry systems

```gcode
; After homing Y-axis
M98P501X1              ; Home Y (has switch)

; Sync A machine position to Y
#883 = #881            ; Copy Y machine coord to A

; Mark A-axis as homed (green icon)
#1518 = 1              ; Set A-axis homed status

M30
```

**In startup macro (sysstart.nc):**
```gcode
M115               ; Execute standard homing
G04 P1.0           ; Wait for homing to complete

; Sync A to Y
#883 = #881
#1518 = 1          ; Mark A as homed

M30
```

**When setting WCS zero:**
```gcode
#810 = #880        ; G55 X offset
#811 = #881        ; G55 Y offset
#812 = #882        ; G55 Z offset
#813 = #881        ; G55 A = Y (cosmetic sync)
```

### 6. State Preservation Pattern

**Pattern**: Save and restore controller state

```gcode
; Save soft limits state
#22 = #655         ; Store current soft limit setting
#655 = 0           ; Disable soft limits

; ... do work that needs limits disabled ...

; Restore soft limits
#655 = #22         ; Restore previous setting
```

**Common state variables:**
- `#655`: Soft limits (0=disabled, 1=enabled)
- `#4003`: G90/G91 mode
- `#593`: Pause mode (0=PAUSE button, 1=G4P-1)
- `#584`: Spindle pause stop
- `#591`: Z-axis lift on pause

### 7. Loop-Based Position Memory

**Pattern**: Store and replay multiple positions

```gcode
; Memory mode - save positions
#1510 = 0          ; Point counter
WHILE [#1505 != 0] + [#1510 == 0] DO1
    #1510 = #1510 + 1
    #1503 = -3000(Move to point %.0f and press START.)
    G4P-1
    G1
    #1505 = -5000(Point %.0f saved. ENTER=next ESC=start)
    #[2200 + #1510] = #880   ; Save X
    #[2300 + #1510] = #881   ; Save Y
END1

; Playback mode - visit positions
#200 = #1510       ; Total points
#100 = 0           ; Counter
WHILE #100 < #200 DO2
    #100 = #100 + 1
    #1510 = #100
    #1505 = -5000(Going to point %.0f)
    G53 X#[2200 + #100] Y#[2300 + #100]
END2
```

**Use cases:**
- Multi-point inspection routines
- Repeated measurement sequences
- Manual teaching of robot-like paths

### 8. Display #1503 Debug Messages

**Pattern**: Persistent debug messages (requires #769=1)

```gcode
#769 = 1           ; Enable #1503 debug display
#2040 = 1          ; Make #1503 non-disappearing

#1510 = 123
#1503 = -3000(Current value: %.0f)

; ... do work ...

#2040 = 0          ; Disable non-disappearing before exit
```

**Difference from #1505:**
- `#1505`: Popup dialog at bottom, blocks execution
- `#1503`: Debug line at top, doesn't block (when #769=1)

### 9. Sensor Testing Pattern

**Pattern**: Interactive sensor verification

```gcode
; Get port numbers from user
#2070 = 60(Master sensor port:)
#2070 = 61(Slave sensor port:)
#2070 = 62(Common port:)

; Test master sensor
WHILE [#[1519 + #60] == 1] + [#[1519 + #62] == 1] DO1
    #1503 = -3000(Activate master sensor)
END1
#1505 = -5000(Master sensor operational!)

; Test slave sensor
WHILE [#[1519 + #61] == 1] + [#[1519 + #62] == 1] DO2
    #1503 = -3000(Activate slave sensor)
END2
#1505 = -5000(Slave sensor operational!)
```

**Input port reading**: `#[1519 + port_number]` (0=active, 1=inactive)

### 10. Average Error Tracking

**Pattern**: Calculate arithmetic mean of homing errors

```gcode
; Calculate average for axes 1-4
#1 = 0
WHILE #1 < 4 DO1
    IF #[2808 + #1] == 0 GOTO 1  ; Skip if no data
    #[1510 + #1] = #[2800 + #1] / #[2808 + #1]  ; Average
    GOTO 2
    N1
    #[1510 + #1] = 0
    N2
    #1 = #1 + 1
END1

#1505 = -5000(Axis1[%.3f] Axis2[%.3f] Axis3[%.3f] Axis4[%.3f])
```

**Variables used:**
- `#2800-#2803`: Cumulative error per axis
- `#2808-#2811`: Error count per axis

### 11. Snake Pattern Milling

**Pattern**: Bidirectional serpentine toolpath

```gcode
#20 = 0            ; Start X
#1 = 300           ; End X
#21 = 0            ; Start Y
#2 = 200           ; End Y
#5 = 15            ; Step size

; Calculate step direction
#10 = #5
IF #1 > 0 GOTO 1
#10 = #10 * -1
N1

#11 = #5
IF #2 > 0 GOTO 2
#11 = #11 * -1
N2

; Snake along Y, stepping X
#12 = #21
WHILE ABS[#12 + #11] <= ABS[#2] DO1
    G53 Y#12 F#6
    G53 X#1 F#6
    #12 = #12 + #11
    G53 Y#12 F#6
    G53 X#20 F#6
    #12 = #12 + #11
END1
```

## Best Practices from Community Macros

### 1. No Priming in Some Cases

**Observation**: Community macros often DON'T prime when:
- Directly assigning system vars to local vars: `#10 = #880`
- Using display variables with format codes
- Reading probe results immediately after G31

**When to prime**: When assigning system vars to persistent storage (#1153+)

### 2. G53 with Variables Works

Community macros successfully use `G53 X#var Y#var` throughout. The G53 bug appears limited to hardcoded constants.

**Safe pattern:**
```gcode
#100 = 500
#101 = 300
G53 X#100 Y#101  ; Works reliably
```

### 3. Comment Style

**Russian transliteration**: отскок = "otscok" (retract/bounce back)

Most community macros use:
- `//` for line comments
- `;` for inline comments
- Minimal comments inside conditional blocks

### 4. Error Handling Pattern

```gcode
; Probe operation
G31 Z-#1 F#3 P#30 L#31 Q1
IF #1922 == 0 GOTO 999

; ... success path ...

GOTO 1000

N999
#1505 = -5000(Operation failed!)
N1000
M30
```

Standard labels: N999 for error, N1000 for exit

### 5. Dynamic WCS Calculation

**Pattern**: Calculate WCS offset addresses dynamically

```gcode
; User parameter: which WCS to use (0=G54, 1=G55, etc.)
#17 = [#2607 - 54] * 5

; Set WCS zero
#[805 + #17] = #880  ; X offset
#[806 + #17] = #881  ; Y offset
#[807 + #17] = #882  ; Z offset
```

This allows user-selectable WCS through parameters.

## Advanced Techniques

### 1. Coordinate Display Hijacking

**Pattern**: Use unused axis displays for status

```gcode
#14 = 5            ; Use 5th axis display (or 4)
#[879 + #14] = #3  ; Show remaining cycles
```

Shows status in coordinate display for operator visibility.

### 2. WHILE Loop Conditional Combo

**Pattern**: Multiple conditions in WHILE

```gcode
; Continue while EITHER condition is true
WHILE [#1505 != 0] + [#1510 == 0] DO1
    ; Loop body
END1

; Continue while BOTH conditions are true (AND)
WHILE [condition1] * [condition2] DO1
    ; Loop body
END1
```

Uses arithmetic: `+` for OR, `*` for AND

### 3. Bidirectional Probe with Return

**Pattern**: Probe in direction, return to start, probe opposite

```gcode
#10 = #880         ; Save start position

; Probe left
G91 G31 X-#1 F#3 P#30 L#31 Q1
#20 = #1925        ; Store result
G53 X#10           ; Return to start

; Probe right  
G91 G31 X#1 F#3 P#30 L#31 Q1
#21 = #1925        ; Store result

; Calculate center
#24 = [#20 + #21] / 2
G53 X#24           ; Move to center
```

Ensures symmetric probing from known reference point.

## Variable Usage Patterns from Community

### Typical Local Variable Allocation

```gcode
#1-#5    = User-configured parameters
#10-#15  = Stored positions/states
#20-#29  = Probe results
#30-#39  = Port numbers, sensor config
#100+    = Loop counters, calculations
```

### Persistent Storage Usage

```gcode
#1153-#1154  = Safe park position
#1155-#1156  = Tool change position
#2200-#2299  = X position array
#2300-#2399  = Y position array
#2800-#2899  = Error tracking
```

## Debugging Patterns

### 1. Variable Inspector

```gcode
#2070 = 100(Enter variable # to read:)
#1510 = #100           ; The address
#1511 = #[#100]        ; Indirect read
#1505 = -5000(#[%.0f] = [%.3f])
```

### 2. Port Monitor

```gcode
#2070 = 60(Port number to monitor:)
WHILE 1 DO1
    #1510 = #[1519 + #60]
    #1503 = -3000(Port #60: %.0f)
    G4 P100
END1
```

## Common Mistakes to Avoid

### 1. Don't Use M30 in Complex Macros

Community macros note: "Do NOT write M30 at the end. Because this command is glitchy."

Instead, let the macro end naturally or use careful GOTO to exit point.

### 2. Parameter #76 Must Be Open

For G31 probing to work, parameter #76 must be set to "OPEN". This is documented in community macros.

### 3. Soft Limits During Special Operations

Always save/restore soft limit state when operations require moving beyond normal bounds:

```gcode
#22 = #655         ; Save
#655 = 0           ; Disable
; ... work ...
#655 = #22         ; Restore
```

---


---

## Continue Reading

**Next**: [Part 2: Boolean & Dynamic G-code →](community-patterns-2-boolean-dynamic.md)

**Part 1 of 6** | [Next: Boolean & Dynamic →](community-patterns-2-boolean-dynamic.md)
