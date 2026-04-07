# K-Button Assignment Map

**Machine**: Ultimate Bee 1010  
**Controller**: DDCS Expert (M350)  
**Last Updated**: January 17, 2026

---

## Overview

The DDCS Expert controller has **7 programmable K-buttons (K1-K7)** that can be assigned to execute macros or control functions. This document tracks which buttons are assigned to which macros/functions.

---

## Current K-Button Assignments

| Button | Macro/Function | File Path | Description | Status |
|--------|----------------|-----------|-------------|--------|
| **K1** | *Unassigned* | - | Available for assignment | 🟢 Free |
| **K2** | *Unassigned* | - | Available for assignment | 🟢 Free |
| **K3** | *Unassigned* | - | Available for assignment | 🟢 Free |
| **K4** | *Unassigned* | - | Available for assignment | 🟢 Free |
| **K5** | *Unassigned* | - | Available for assignment | 🟢 Free |
| **K6** | *Unassigned* | - | Available for assignment | 🟢 Free |
| **K7** | *Unassigned* | - | Available for assignment | 🟢 Free |

---

## How to Assign K-Buttons

### Method 1: Controller Menu

```
1. Go to Settings → Key Settings
2. Select button (K1-K7)
3. Choose macro file from SD card
4. Save assignment
```

### Method 2: Via G-Code

K-buttons can execute macros using M98 calls or be mapped to specific functions through controller parameters.

---

## Suggested Assignments (Examples)

### Common Useful Functions

**Production Macros:**
- Tool change position (go to safe tool change location)
- Probe WCS Z-zero (run Z-probe puck routine)
- Tool length measurement (run tool setter routine)
- Spindle warmup sequence
- Safe park position

**Navigation Functions:**
- Jump to Coordinate page (view/edit positions)
- Jump to MDI page (manual G-code entry)
- Jump to File Manager page
- Jump to Monitor page (program running)
- Jump to Offsets page (WCS management)

**Convenience Functions:**
- Return to work zero (G54 X0 Y0)
- Return to machine zero (G53 Z0, then G53 X0 Y0)
- Clear all offsets (reset G54)
- Rotary home (B-axis)
- Emergency safe position

**Probe Operations:**
- Auto edge find X+
- Auto edge find Y+
- Auto corner find (X+Y+)
- Auto center find (bore/boss)

**Advanced Operations:**
- Cycle through WCS (G54→G55→G56...)
- Toggle spindle coolant on/off
- Save current position to memory
- Restore saved position
- Execute custom inspection routine

### Example Assignments by Workflow

**Manual Tool Change Workflow:**
```
K1: Go to tool change position
K2: Run tool setter (measure tool length)
K3: Run Z-probe puck (set WCS Z-zero)
K4: Return to work zero (G54 X0 Y0)
K5: Safe park position
K6: Spindle warmup
K7: Jump to MDI page
```

**Navigation & Setup Workflow:**
```
K1: Jump to Coordinate page (view positions)
K2: Jump to MDI page (manual commands)
K3: Jump to Offsets page (WCS management)
K4: Tool setter
K5: Z-probe (WCS)
K6: Return to work zero
K7: Return to machine zero
```

**Probe-Heavy Workflow:**
```
K1: Tool setter
K2: Z-probe puck (WCS Z-zero)
K3: Edge find X+
K4: Edge find Y+
K5: Corner find X+Y+
K6: Center find
K7: Return to work zero
```

**Operator Convenience Workflow:**
```
K1: Jump to MDI page (quick G-code)
K2: Jump to Coordinate page (check position)
K3: Tool change position
K4: Work zero (G54 X0 Y0)
K5: Machine zero (G53)
K6: Safe park
K7: Spindle warmup
```

**General Purpose:**
```
K1: Tool change position
K2: Tool setter
K3: Z-probe (WCS)
K4: Work zero (G54 X0 Y0)
K5: Machine zero (G53)
K6: Spindle warmup
K7: Safe park
```

---

## Available Macros for Assignment

### Your Production Macros (in example-macros/)

1. **SAVE_safe_park_position.nc** - Save current as park position
2. **SAVE_tool_change_position.nc** - Save current as tool change position
3. **SAVE_WCS_XY_AUTO.nc** - Auto-detect and save WCS offsets
4. **fndzero.nc** - Complete homing (Z→X→Y→B)
5. **fndy.nc** - Y-axis rehoming only
6. **SPINDLE_WARMUP.nc** - Progressive spindle warmup
7. **READ_VAR.nc** - Variable inspector

### Potential New Macros to Create

**GO_tool_change_position.nc**:
```gcode
(Go to saved tool change position)
G53 Z0              ; Safe Z first
G53 X[#1155] Y[#1156]  ; Saved tool change XY
M30
```

**GO_work_zero.nc**:
```gcode
(Return to current WCS zero)
G0 Z10              ; Safe Z clearance
G0 X0 Y0            ; Go to work zero XY
M30
```

**GO_machine_zero.nc**:
```gcode
(Return to machine home)
G53 Z0              ; Home Z first
G53 X0 Y0           ; Home XY
M30
```

**PROBE_Z_WCS.nc**:
```gcode
(Quick WCS Z-zero with puck probe)
; [Your Z-probe puck routine here]
M30
```

**TOOL_MEASURE.nc**:
```gcode
(Quick tool length measurement)
; [Your tool setter routine here]
M30
```

**NAVIGATE_to_coordinate_page.nc**:
```gcode
(Jump to Coordinate display page)
#2037 = 1260        ; Virtual button: Coordinate page
M30
```

**NAVIGATE_to_MDI_page.nc**:
```gcode
(Jump to MDI page for manual commands)
#2037 = 1261        ; Virtual button: MDI page
M30
```

**NAVIGATE_to_offsets_page.nc**:
```gcode
(Jump to Offsets/WCS page)
#2037 = 1265        ; Virtual button: Offsets page
M30
```

**NAVIGATE_to_monitor_page.nc**:
```gcode
(Jump to Monitor/Run page)
#2037 = 1262        ; Virtual button: Monitor page
M30
```

**CYCLE_WCS.nc**:
```gcode
(Cycle through work coordinate systems)
IF #578 == 1 GOTO wcs2
IF #578 == 2 GOTO wcs3
IF #578 == 3 GOTO wcs4
IF #578 == 4 GOTO wcs5
IF #578 == 5 GOTO wcs6
IF #578 == 6 GOTO wcs1

N wcs1
G54
#1505 = 1(Active: G54)
GOTO end

N wcs2
G55
#1505 = 1(Active: G55)
GOTO end

N wcs3
G56
#1505 = 1(Active: G56)
GOTO end

N wcs4
G57
#1505 = 1(Active: G57)
GOTO end

N wcs5
G58
#1505 = 1(Active: G58)
GOTO end

N wcs6
G59
#1505 = 1(Active: G59)

N end
M30
```

**SAVE_CURRENT_POSITION.nc**:
```gcode
(Save current position to user variables)
#1190 = #880        ; Save X to #1190
#1191 = #881        ; Save Y to #1191
#1192 = #882        ; Save Z to #1192
#1193 = #883        ; Save B to #1193
#1505 = 1(Position saved!)
G04 P1000
M30
```

**RESTORE_SAVED_POSITION.nc**:
```gcode
(Return to previously saved position)
G53 Z0              ; Safe Z first
G53 X[#1190] Y[#1191]  ; Saved XY
G53 Z[#1192]        ; Saved Z
G53 B[#1193]        ; Saved B
#1505 = 1(Position restored!)
G04 P1000
M30
```

**TOGGLE_COOLANT.nc**:
```gcode
(Toggle spindle coolant on/off)
IF #624 == 0 GOTO turn_on
M9                  ; Coolant off
#1505 = 1(Coolant OFF)
GOTO end

N turn_on
M8                  ; Coolant on
#1505 = 1(Coolant ON)

N end
M30
```

---

## K-Button Programming Notes

### Button Response

**Press and hold vs quick press:**
- Quick press: Execute assigned macro
- Long press: May have alternate function (controller dependent)

### Macro Execution

- K-button macros run from SD card
- Macros should be complete and end with M30
- Keep macros short and focused on one task
- Use error checking and safe movements

### Best Practices

1. **Most-used functions on K1-K3** (easiest to reach)
2. **Safety functions accessible** (park, home)
3. **Workflow-specific assignments** (tool change, probing)
4. **Consistent across similar machines** (muscle memory)
5. **Document assignments** (update this file!)

---

## Controller Button Layout

```
┌────────────────────────────────┐
│  DDCS Expert Front Panel       │
│                                │
│  [Display Screen]              │
│                                │
│  [K1] [K2] [K3] [K4]          │
│  [K5] [K6] [K7]                │
│                                │
│  [Other controls...]           │
└────────────────────────────────┘
```

**Tip**: K1-K4 are typically in a row, K5-K7 below. Exact layout may vary.

---

## Assignment History (Track Changes)

**Format**: Date | Button | Assignment | Reason

```
2026-01-17 | All | Unassigned | Initial map creation
```

---

## Planning Your Assignments

### Questions to Consider

1. **What operations do you do most often?**
   - Assign these to K1-K3

2. **What takes the most steps manually?**
   - Good candidates for K-button shortcuts

3. **What do you always forget?**
   - Spindle warmup, tool length check, etc.

4. **What's safety-critical?**
   - Safe park, emergency positions

5. **What's workflow-specific?**
   - Tool changes, probing sequences

### Workflow Analysis

**Manual Tool Change Workflow Steps:**
1. Pause or finish program
2. Spindle stop
3. Move to tool change position → **K1 candidate**
4. Change tool manually
5. Measure new tool length → **K2 candidate**
6. Set WCS Z-zero if needed → **K3 candidate**
7. Return to work zero → **K4 candidate**
8. Resume or start program

**Each step above could be a K-button!**

---

## Testing New Assignments

### Safe Testing Procedure

1. **Create test macro** with safe movements only
2. **Verify macro** runs correctly standalone (from file manager)
3. **Assign to K-button** (use K7 for testing)
4. **Test button** with hand near E-stop
5. **Verify behavior** matches expectation
6. **Document** in this file
7. **Reassign** to desired button if different

### Safety First

- **Test in air** (no tool, safe Z height) before production use
- **E-stop ready** when testing new assignments
- **Verify macro** has safe movements (G53 Z0 first, etc.)
- **Check soft limits** are enabled before testing
- **Dry run** with feed rate override low

---

## Related Documentation

- **Virtual Buttons (#2037)**: See `virtual-buttons-2037.md` for programmatic button control
- **Example Macros**: See `example-macros/` for ready-to-use macros
- **User Tested Patterns**: See `user-tested-patterns.md` for proven macro patterns
- **Hardware Config**: See `hardware-config.md` Section 12 for tool change workflow

---

## Creative K-Button Ideas

### Navigation Functions (Using Virtual Buttons)

**Jump to specific controller pages:**
- Coordinate page (#2037 = 1260) - View current position
- MDI page (#2037 = 1261) - Enter manual G-code
- Monitor page (#2037 = 1262) - Program running display
- File Manager (#2037 = 1263) - Browse NC files
- Offsets page (#2037 = 1265) - WCS management

**Why useful:**
- Quick access without menu navigation
- Workflow efficiency (less button pressing)
- Muscle memory for common tasks

### State Management

**WCS Cycling:**
- Cycle through G54→G55→G56→G57→G58→G59
- Useful when working multiple setups
- Display confirms which WCS is active

**Position Memory:**
- Save current position to variables
- Return to saved position later
- Useful for inspection points or reference locations

**Coolant Toggle:**
- Quick on/off without menu
- Useful during setup/testing
- Confirm via dialog message

### Multi-Function Buttons (Context Dependent)

**Smart Park Button:**
```gcode
(Park based on current state)
IF #624 == 0 GOTO spindle_off
M5                  ; Stop spindle
#1505 = 1(Spindle stopped)
G04 P2000

N spindle_off
G53 Z0              ; Safe Z
G53 X[#1153] Y[#1154]  ; Park position
#1505 = 1(Parked safely)
M30
```

**Smart Home Button:**
```gcode
(Home only unhomed axes)
IF #1516 == 0 GOTO home_x
IF #1518 == 0 GOTO home_y  
IF #1517 == 0 GOTO home_z
IF #1519 == 0 GOTO home_b
#1505 = 1(All axes homed)
GOTO end

N home_x
M98P501X0           ; Home X
N home_y  
M98P501X2           ; Home Y
N home_z
M98P501X1           ; Home Z
N home_b
M98P501X4           ; Home B

N end
M30
```

### Inspection & Quality

**Inspection Routine:**
- Move to pre-defined inspection points
- Pause at each point for measurement
- Log positions if needed

**Dimension Check:**
- Go to known dimension location
- Display expected vs actual
- Confirm within tolerance

### Setup Helpers

**Material Top Surface Finder:**
- Rapid to safe height over material
- Slow probe to find surface
- Set Z-zero
- Retract to safe height

**Corner Finder:**
- Probe X+ edge
- Probe Y+ edge
- Calculate corner
- Set WCS origin at corner

### Maintenance Functions

**Spindle Cooldown:**
```gcode
(Progressive spindle cooldown)
M3 S6000
#1505 = 1(Cooldown: 6000 RPM)
G04 P60000          ; 1 minute

M3 S3000  
#1505 = 1(Cooldown: 3000 RPM)
G04 P60000          ; 1 minute

M5
#1505 = 1(Spindle stopped)
M30
```

**Axis Exercise:**
- Move each axis through full travel
- Useful for warming up ballscrews
- Redistributes lubricant

### Emergency/Safety

**Emergency Park:**
- Immediate spindle stop
- Rapid Z to safe height
- Move to park position
- Display status

**Reset All Offsets:**
- Clear G54-G59 work offsets
- Reset tool offsets
- Return to known state
- Confirm action with dialog

### Production Efficiency

**Quick WCS Setup:**
- Combine edge finding + offset setting
- One button does complete setup
- Save operator steps

**Auto Part Count:**
- Increment counter variable
- Display parts completed
- Reset option via dialog

**Time Stamp:**
- Save start time to variable
- Calculate elapsed time
- Display on completion

---

## Quick Reference

**K-Button Capabilities:**
- Execute macros from SD card
- Can include complex sequences
- Run immediately on button press
- End with M30 to return control
- Can use all G-code and MacroB features

**Virtual Buttons for Navigation (#2037):**

| Button Code | Function | Usage |
|-------------|----------|-------|
| 1260 | Coordinate page | View/edit current position |
| 1261 | MDI page | Manual G-code entry |
| 1262 | Monitor page | Program running display |
| 1263 | File Manager | Browse NC files |
| 1264 | Settings page | Controller parameters |
| 1265 | Offsets page | WCS management (G54-G59) |
| 1266 | Tool page | Tool offset management |
| 1267 | Macro page | Macro variables |

**Example: Jump to MDI page**
```gcode
#2037 = 1261
M30
```

**See `virtual-buttons-2037.md` for complete list of 100+ virtual button codes**

**Current Status**: All 7 buttons available for assignment

**Next Steps**: 
1. Decide which operations you do most often
2. Create/identify appropriate macros
3. Assign to K-buttons
4. Test thoroughly
5. Update this document

---

**Document Status**: Initial template created, ready for assignments  
**Assignments**: 0/7 buttons assigned  
**Availability**: 7/7 buttons free
