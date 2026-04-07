# User-Tested Macro Patterns

This document contains macros that have been tested and verified on a specific DDCS M350 system (Fréderic's Ultimate Bee dual-gantry machine). These represent practical, working solutions for common CNC tasks with manual tool changing workflow.

## System Configuration Notes

- **Dual-axis gantry**: Y-axis (master) with A-axis (slave)
- **Manual tool changing**: No automatic tool changer (ATC)
- **Workflow focus**: Position saving, WCS management, spindle warmup
- **Persistence testing**: Extensive validation of which variable ranges survive reboot

## Core Utility Macros

### 1. Save Safe Park Position

**Use case**: Teach the machine where to park for safe access

```gcode
(SAVE TOOL CHANGE POS)

#1153 = 1
#1154 = 1

#1153 = #880    ; Save Machine X to #1153
#1154 = #881    ; Save Machine Y to #1154

#1505 = 1(Tool Change XY Saved to #1153/54)
M30
```

**Pattern notes:**
- Uses `#1153-#1154` gap addresses for persistence
- Simple priming with `= 1` (community observation: not always `= 0`)
- Clean confirmation dialog
- No M30 issues (simple macro)

### 2. Save Tool Change Position (Alternative)

**Use case**: Separate position for manual tool changes

```gcode
( TEACH TOOL CHANGE MACRO )
( Saves Current Machine Position to Variables #1155 & #1156 )

#1155 = 1 (Priming)
#1156 = 1

#1155 = #880  (Save Current Machine X)
#1156 = #881  (Save Current Machine Y)

( Display Confirmation Message )
#1505 = 1 (Tool Change Position Saved OK)

M30
```

**Storage allocation:**
- `#1153-#1154` = Safe park position (general access)
- `#1155-#1156` = Tool change position (specific task)

**Design pattern**: Separate positions for different workflows

### 3. Save Active WCS XY Zero (Dynamic)

**Use case**: Zero the currently active work coordinate system (G54-G59)

```gcode
(SAVE ACTIVE WCS XY ZERO - Auto-detects which coordinate system)
(Based on working park position macro pattern with variable priming)

(Prime ALL variables first to prevent freeze - CRITICAL!)
#100 = 1
#101 = 1
#102 = 1
#103 = 1
#104 = 1

(Get active WCS number: 1=G54, 2=G55, 3=G56, etc.)
#100 = #578

(Read current machine positions - now safe after priming)
#101 = #880  (Current X machine position)
#102 = #881  (Current Y machine position)

(Calculate WCS offset addresses)
(G54=#805-809, G55=#810-814, G56=#815-819)
#103 = 805 + [#100 - 1] * 5  (X offset address)
#104 = 806 + [#100 - 1] * 5  (Y offset address)

(Write to WCS offsets using indexed parameters)
#[#103] = #101  (Set WCS X offset = current machine X)
#[#104] = #102  (Set WCS Y offset = current machine Y)

(Display confirmation)
#1510 = #101
#1511 = #1105
#1505=-5000(WCS XY zero saved at machine: X=%.1f Y=%.1f)

M30
```

**Key features:**
- Works with ANY active WCS (operator doesn't need to specify)
- Uses indirect addressing: `#[#103]` to write to calculated address
- Stride calculation: `805 + [#578 - 1] * 5` gives correct offset
- Shows machine coordinates in confirmation (helpful for verification)

**Comment note**: Has documentation comment with incorrect base address (says 810 for G54, but code correctly uses 805). The CODE is correct, comment is outdated.

### 4. Save Native System Fixed Sensor Position

**Use case**: Update controller's built-in fixed probe parameters

```gcode
(SAVE NATIVE SYSTEM FIXED SENSOR POSITION)
(Jog probe over sensor, then run this to save position to System Settings)

(Safety: Prime User Variables to prevent M350 freeze bug)
(We use volatile user vars #100/#101 as buffers)
#100 = 0
#101 = 0

(Action: Save Machine Coordinates to System Parameters Pr135/Pr136)
(NOTE: This updates the internal settings for the Native Fixed Probe button)

(Step 1: Read Machine Coordinates into Buffer)
#100 = #880  (Read Machine X)
#101 = #881  (Read Machine Y)

(Step 2: Write Buffer to System Parameters)
#635 = #100  (Update Pr135 [Fixed Probe X])
#636 = #101  (Update Pr136 [Fixed Probe Y])

(Display confirmation)
#1510 = #635
#1511 = #636
#1505 = -5000(System Sensor Updated: X=%.3f Y=%.3f)

M30
```

**Important parameters:**
- `#635` = Pr135 = Fixed Probe X machine position
- `#636` = Pr136 = Fixed Probe Y machine position

**Use case**: After physically moving the fixed probe sensor, run this macro to update the controller's stored position. This affects the behavior of the controller's built-in probe buttons.

**Pattern**: Buffer through user variables before writing to parameters (defensive programming)

### 5. Spindle Warmup Routine

**Use case**: Warm up spindle bearings before cutting

```gcode
(KEY-7: SPINDLE WARMUP - 60 SECOND)
(2024 Edition - FIXED: Safe variable addresses)

(=== CONFIGURATION ===)
#140 = 6000      (Step 1: Low speed RPM)
#141 = 12000     (Step 2: Working speed RPM)
#142 = 30        (30 seconds at each speed)

(Single confirmation)
#1505=1(Warm up spindle?)
IF #1505==0 GOTO999

(Initialize - stop spindle if running)
M05 M09

(=== 60-SECOND WARMUP ===)
#1510 = #140
#1505=-5000(Starting at %.0f RPM...)

M03 S[#140]      (Start at 6,000 RPM)
G04 P[#142]      (Run for 30 seconds)

(Ramp to working speed - no stop)
#1510 = #141
#1505=-5000(Ramping to %.0f RPM...)

M03 S[#141]      (Increase to 12,000 RPM)
G04 P[#142]      (Run for 30 seconds)

(Stop)
M05

(Complete)
#1505=-5000(Warmup complete - Spindle ready!)

(Normal end)
N999
M30
```

**Design features:**
- User confirmation before start
- Progressive speed ramping (low → high)
- Visual feedback at each step
- Clean abort path (GOTO999)
- Uses `S[#variable]` syntax for spindle speed

**Best practice**: Ramp speed without stopping spindle between steps (reduces bearing wear)

## Dual-Gantry Y/A Synchronization

### 6. Home Y-Axis Only (with A-sync)

**Use case**: Rehome Y-axis during job without full homing sequence

```gcode
M98P501X1     (Home Y - Has Switch, A follows as slave)

(Sync A machine position to match Y)
#883 = #881   (Copy Y machine coordinate to A machine coordinate)

(Mark A-axis as homed - turn home icon green)
#1518 = 1     (Set A-axis homed status)

(MSG, Y HOMED - A SYNCED)
M30
```

**System calls:**
- `M98P501X1` = Built-in homing routine for axis 1 (Y-axis)
- After homing, Y is at known position
- Copy Y machine coord to A to keep gantry synchronized

**Critical**: `#1518 = 1` marks A-axis as homed (green icon in UI)

### 7. Full Homing Sequence (All Axes)

**Use case**: Complete homing at machine startup

```gcode
M98P501X2     (Home Z - Has Switch)
M98P501X0     (Home X - Has Switch)
M98P501X1     (Home Y - Has Switch, A follows as slave)

(Sync A machine position to match Y)
#883 = #881   (Copy Y machine coordinate to A machine coordinate)

(Mark A-axis as homed - turn home icon green)
#1518 = 1     (Set A-axis homed status)

(MSG, HOMING COMPLETE - A SYNCED TO Y)
M30
```

**Homing order**: Z → X → Y (with A-sync)

**Why Z first**: Safe retract before lateral moves

**System subroutine calls:**
- `M98P501X0` = Home X-axis
- `M98P501X1` = Home Y-axis
- `M98P501X2` = Home Z-axis

## Debugging and Testing Macros

### 8. Variable Inspector (Interactive)

**Use case**: Read any variable address on-demand

```gcode
(Variable Reader - Enter address to display value)

#2070 = 100(Enter variable # to read:)

#1510 = #100
#1511 = #[#100]
#1505 = -5000(#%.0f = %.3f)

M30
```

**How it works:**
1. Prompts user to enter variable number
2. Stores entered value in `#100`
3. Uses indirect addressing `#[#100]` to read that variable
4. Displays both address and value

**Example session:**
- User runs macro
- Enters "880" (for X machine position)
- Display shows: `#880 = 325.750`

**Community pattern**: User input + indirect addressing

### 9. Persistence Write Test

**Use case**: Verify which variable ranges survive reboot

```gcode
(PERSISTENCE TEST - WRITE)
(Run this, power cycle, then run PERSISTENCE_READ.nc)

#1505 = 1(Writing test values to free ranges...)

(Range #56-#499 - User variables)
#56 = 111.111
#250 = 222.222
#499 = 333.333

(Range #1153-#1193 - Documented gap)
#1153 = 444.444
#1175 = 555.555
#1193 = 666.666

(Range #1577-#1615 - Good for axis coords)
#1577 = 777.777
#1600 = 888.888
#1615 = 999.999

(Range #1637-#1699 - Large gap)
#1637 = 1111.11
#1670 = 2222.22
#1699 = 3333.33

(Range #1719-#1749)
#1719 = 4444.44
#1735 = 5555.55
#1749 = 6666.66

(Range #1805-#1894 - Large gap)
#1805 = 7777.77
#1850 = 8888.88
#1894 = 9999.99

(Range #2039-#2071)
#2039 = 1234.56
#2055 = 2345.67
#2071 = 3456.78

(Range #2106-#2499 - Huge gap)
#2106 = 4567.89
#2300 = 5678.90
#2499 = 6789.01

#1505 = -5000(DONE! Power OFF then ON then run READ)

M30
```

**Testing methodology:**
1. Write unique values to candidate ranges
2. Power cycle controller (full shutdown)
3. Run PERSISTENCE_READ.nc to check which values survived
4. Any value showing 0.00 means that range is NOT persistent

**Tested ranges** (gaps in system variable space):
- `#56-#499` - Non-persistent (as expected)
- `#1153-#1193` - **Confirmed persistent** (documented gap)
- `#1577-#1615` - Test for persistence
- `#1637-#1699` - Test for persistence
- `#1719-#1749` - Test for persistence
- `#1805-#1894` - Test for persistence
- `#2039-#2071` - Test for persistence
- `#2106-#2499` - Test for persistence (large gap)

### 10. Persistence Read Test

**Use case**: Verify persistence after reboot

```gcode
(PERSISTENCE TEST - READ)
(Run after power cycle to check which values survived)

#1505 = 1(Checking persistence...)

(Range #56-#499 - expect 111.111, 222.222, 333.333)
#1510 = #56
#1511 = #250
#1512 = #499
#1505 = -5000(#56-499: %.2f  %.2f  %.2f)

(Range #1153-#1193 - expect 444.444, 555.555, 666.666)
#1510 = #1153
#1511 = #1175
#1512 = #1193
#1505 = -5000(#1153-93: %.2f  %.2f  %.2f)

(Range #1577-#1615 - expect 777.777, 888.888, 999.999)
#1510 = #1577
#1511 = #1600
#1512 = #1615
#1505 = -5000(#1577-1615: %.2f  %.2f  %.2f)

(Range #1637-#1699 - expect 1111.11, 2222.22, 3333.33)
#1510 = #1637
#1511 = #1670
#1512 = #1699
#1505 = -5000(#1637-99: %.2f  %.2f  %.2f)

(Range #1719-#1749 - expect 4444.44, 5555.55, 6666.66)
#1510 = #1719
#1511 = #1735
#1512 = #1749
#1505 = -5000(#1719-49: %.2f  %.2f  %.2f)

(Range #1805-#1894 - expect 7777.77, 8888.88, 9999.99)
#1510 = #1805
#1511 = #1850
#1512 = #1894
#1505 = -5000(#1805-94: %.2f  %.2f  %.2f)

(Range #2039-#2071 - expect 1234.56, 2345.67, 3456.78)
#1510 = #2039
#1511 = #2055
#1512 = #2071
#1505 = -5000(#2039-71: %.2f  %.2f  %.2f)

(Range #2106-#2499 - expect 4567.89, 5678.90, 6789.01)
#1510 = #2106
#1511 = #2300
#1512 = #2499
#1505 = -5000(#2106-2499: %.2f  %.2f  %.2f)

#1505 = -5000(TEST COMPLETE - 0.00 means NOT persistent)

M30
```

**Pattern**: Sequential display of multiple ranges

**Expected results**: If value shows 0.00, that range resets on reboot

## Design Patterns Observed

### 1. Minimal Priming Strategy

**Observation**: Macros prime with `= 1` instead of `= 0`

```gcode
#1153 = 1    ; Not = 0
#1154 = 1

#1153 = #880
#1154 = #881
```

**Community validation**: This works. Priming value doesn't matter (just needs initialization).

### 2. Comment Style

**Characteristics:**
- Extensive in-line documentation
- Clear section headers with `(=== TITLE ===)`
- Inline explanations: `(Get active WCS number: 1=G54...)`
- Notes about fixes: `(2024 Edition - FIXED: Safe variable addresses)`

**Best practice**: Heavy commenting for maintainability (esp. for complex addressing)

### 3. User Confirmation Pattern

```gcode
#1505=1(Warm up spindle?)
IF #1505==0 GOTO999

; ... main work ...

N999
M30
```

**Benefits:**
- Prevents accidental execution
- Clean abort path
- Consistent exit point

### 4. Buffer Variables for Safety

```gcode
(We use volatile user vars #100/#101 as buffers)
#100 = 0
#101 = 0

(Step 1: Read Machine Coordinates into Buffer)
#100 = #880  (Read Machine X)
#101 = #881  (Read Machine Y)

(Step 2: Write Buffer to System Parameters)
#635 = #100  (Update Pr135)
#636 = #101  (Update Pr136)
```

**Defensive programming**: Read → buffer → write (easier to debug, safer)

### 5. Progressive Feedback

```gcode
#1510 = #140
#1505=-5000(Starting at %.0f RPM...)

M03 S[#140]
G04 P[#142]

#1510 = #141
#1505=-5000(Ramping to %.0f RPM...)

M03 S[#141]
```

**Pattern**: Update display between each operation step

**Benefits**: Operator knows exactly what's happening in real-time

### 6. Configuration at Top

```gcode
(=== CONFIGURATION ===)
#140 = 6000      (Step 1: Low speed RPM)
#141 = 12000     (Step 2: Working speed RPM)
#142 = 30        (30 seconds at each speed)
```

**Design principle**: All tunable parameters at top of file for easy adjustment

## Persistent Storage Allocation Strategy

**Fréderic's allocation:**
- `#1153-#1154` = Safe park position
- `#1155-#1156` = Tool change position
- `#1157-#1193` = Available for future expansion

**Community allocations seen:**
- `#1170-#1175` = Probe configuration (community standard)

**Recommendation**: Document your allocation in a central reference file to avoid conflicts

## Manual Tool Change Workflow

**No ATC**: All tool changes are manual

**Implications for macro design:**
1. Need clear "tool change position" separate from park position
2. WCS management more important (no automatic tool length compensation)
3. Operator interaction patterns (confirmation dialogs)
4. Spindle warmup after manual tool change

**Typical sequence:**
1. Job runs, tool change needed
2. Machine moves to tool change position (#1155/#1156)
3. Operator changes tool manually
4. Optional: Run spindle warmup
5. Optional: Re-zero Z with probe
6. Resume job

## System-Specific Notes

**M98 subroutine calls:**
- `M98P501X0` through `M98P501X3` = Built-in homing routines
- X parameter selects axis (0=X, 1=Y, 2=Z, 3=A)

**Dual-gantry specifics:**
- Y-axis has physical home switch
- A-axis has NO physical switch (synchronized from Y)
- After any Y homing: MUST sync A with `#883 = #881`
- After sync: MUST set `#1518 = 1` for UI status icon

## Key Takeaways for DDCS Macro Development

1. **Priming flexibility**: `= 1` works fine, doesn't have to be `= 0`
2. **Buffer pattern**: Read → temp variable → write (safer for parameters)
3. **Comment heavily**: Future you will thank you
4. **Configuration sections**: Make adjustments easy
5. **User confirmation**: Prevent accidents on critical operations
6. **Progressive feedback**: Keep operator informed
7. **Test persistence**: Don't assume - verify with WRITE/READ test
8. **Document allocation**: Keep track of which variables are in use
9. **Dual-gantry sync**: Always sync A after Y operations
10. **Clean exits**: Use consistent GOTO labels for abort paths

These macros represent battle-tested patterns on a real production machine.
