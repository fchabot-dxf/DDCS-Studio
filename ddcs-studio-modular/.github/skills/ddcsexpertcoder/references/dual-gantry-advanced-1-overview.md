# Advanced Dual-Gantry Auto-Squaring System
## Part 1: Overview & Configuration

**📚 This is part of a 3-part series:**
- **Part 1: Overview & Configuration** ← You are here
- Part 2: [Algorithm & Math](dual-gantry-advanced-2-algorithm.md)
- Part 3: [Usage & Troubleshooting](dual-gantry-advanced-3-usage.md)

---

## Overview

Professional-grade dual-axis homing and auto-squaring macro for DDCS M350 controllers with **two separate limit switches** (no relay required). This is a production-tested, 348-line macro with three-stage alignment process.

**Source**: Community-developed system used in commercial DDCS installations

**Macro File**: `macro_DA_without_relay_advanced.nc`

**Firmware Required**: Version 30-03-2024 or newer

---

## System Requirements

### Hardware Configuration

**Required:**
- ✅ Dual-gantry axis (typically Y-axis with Y1/Y2 motors)
- ✅ Two separate NPN limit switches (one per gantry side)
- ✅ Two available controller inputs (e.g., IN20, IN21)
- ✅ DDCS M350 controller with axis combination configured

**Optional (for Pre-Alignment):**
- 🔶 Combined sensor port via diode circuit
- 🔶 Additional input for merged signal

### Example Configuration (Ultimate Bee 1010)

```
Machine: Ultimate Bee 1010
Dual Axis: Y-axis (gantry)
  - Y1 (Master/Left):  Motor 1, Limit switch on IN20
  - Y2 (Slave/Right):  Motor 2, Limit switch on IN21

Controller Setup:
  #488-#492: Axis combination enabled for Y
  Master sensor:  IN20
  Slave sensor:   IN21
  Combined port:  IN22 (optional, via diodes)
  Free port:      IN15 (unused, for G31 protection)
```

---

## Three-Stage Alignment Process

### Stage 1: Fast Feed (Optional)

**Purpose**: Rapid approach to sensor area to save time

**How it works:**
1. Uses last known home position from previous homing
2. Moves at G0 speed toward sensor area
3. Sharp brake when sensor detected
4. Skips if gantry position unknown or button pressed

**Settings:**
- `#27`: Distance to under-travel sensor (0 = disabled)
- `#59`: Cancel button port (0 = no button)
- `#63`: Stop type (0=smooth, 1=sharp)

**When to use:**
- ✅ Production environment (repeated homing cycles)
- ✅ Known good machine coordinates
- ❌ After crash or power loss (coordinates unknown)
- ❌ First-time setup

---

### Stage 2: Pre-Alignment (Optional)

**Purpose**: Rough gantry squaring to prevent sensor collision

**How it works:**
1. Uses **combined port** (both sensors via diode circuit)
2. Fast approach until ANY sensor triggers
3. Optional second slow approach for precision
4. Disconnects one motor, moves until both sensors trigger
5. Rough alignment complete

**Diode Circuit (Optional Hardware Mod):**
```
Master Sensor (IN20) ──┬──┤>├── Combined Port (IN22)
Slave Sensor (IN21)  ──┴──┤>├──
                           
Use 1N4148 or similar fast diodes
```

**Settings:**
- `#19`: Combined port number (0 = disabled, no diodes)
- `#25`: Pre-alignment enable (0=off, 1=on)
- `#57`: Two approaches (0=single pass, 1=dual pass)

**When to use:**
- ✅ Badly warped/racked gantry (>3mm out of square)
- ✅ After machine transport or disassembly
- ✅ Shaky/vibrating machines
- ❌ Well-aligned gantry (<1mm rack)
- ❌ If you don't have diode circuit

**Critical Note**: 
If Pre-Alignment is OFF, Fine Alignment MUST be ON. At least one alignment method required.

---

### Stage 3: Fine Alignment (Required)

**Purpose**: High-precision gantry squaring with error detection

**How it works:**
1. Finds exact coordinate of **master sensor** (multiple cycles)
2. Calculates arithmetic mean (anti-debounce)
3. Sets machine zero on master side
4. Finds exact coordinate of **slave sensor** (multiple cycles)
5. Calculates alignment distance
6. **Disconnects slave motor**
7. Moves **master side only** to align gantry
8. Alignment complete

**Multi-Cycle Averaging:**
```
Cycle 1: Master sensor at -0.015mm
Cycle 2: Master sensor at -0.012mm
Cycle 3: Master sensor at -0.018mm
Mean:    -0.015mm (used for alignment)
Error:   0.006mm max deviation (logged)
```

**Settings:**
- `#26`: Fine alignment enable (0=off, 1=on)
- `#54`: Disregard 1st approach (1=yes, 0=no)
- `#65`: Vibration settling pause (milliseconds)
- External `#106`: Number of cycles (≥3 recommended)
- External `#117`: Max error threshold (mm)

**When to use:**
- ✅ **ALWAYS** (unless Pre-Alignment is doing full squaring)
- ✅ Precision work requiring <0.05mm squaring
- ✅ Final alignment after Pre-Alignment
- ❌ Never disable if Pre-Alignment is also disabled

**Why Only Master Side Moves:**

```
WRONG APPROACH (slave moves):
  Master: 0.00mm (set to zero)
  Slave:  -3.00mm (racked)
  → Move slave +3mm
  → Result: Master position LOST (no longer at sensor!)

CORRECT APPROACH (master moves):
  Master: 0.00mm (at sensor, to be maintained)
  Slave:  -3.00mm (racked, used for calculation)
  → Disconnect slave motor
  → Move master +3mm (slave pushed along)
  → Result: Master still at 0, gantry squared
```

---

## Configuration Variables

### Internal Settings (Edit in macro)

**Axis Configuration:**
```gcode
#91 = 1     ; Master axis number (0=X, 1=Y, 2=Z, 3=A, 4=B)
#2  = 1     ; Slave axis number (same as master for dual-gantry)
```

**Sensor Ports:**
```gcode
#41 = 20    ; Master sensor port (IN20)
#43 = 21    ; Slave sensor port (IN21)
#19 = 22    ; Pre-alignment combined port (IN22, 0=disabled)
#62 = 15    ; Free port for G31 (any unused input)
```

**Feature Enables:**
```gcode
#27 = 0     ; Fast Feed: 0=off, or distance in mm
#25 = 1     ; Pre-Alignment: 0=off, 1=on
#57 = 1     ; Two PA approaches: 0=single, 1=dual
#26 = 1     ; Fine Alignment: 0=off, 1=on
```

**Safety Limits:**
```gcode
#31 = 5     ; Max gantry alignment distance (mm)
            ; Prevents bending gantry if sensor fails
            
#49 = 5000  ; Max 1st approach distance (mm, ~table length)
#53 = 3     ; Max subsequent approach distance (mm)
```

**Alignment Correctors:**
```gcode
#34 = 0     ; Master side corrector (mm) ⚠️ DANGER
#33 = 0     ; Slave side corrector (mm) ⚠️ DANGER
            ; Micro-adjustments after alignment
            ; Example: #34=0.1 moves master +0.1mm after squaring
```

**Quality Settings:**
```gcode
#50 = 0     ; Contact check: 0=off, 1=on (useless for inductive)
#16 = 0     ; Auto-restart on error: 0=manual, 1=auto
#54 = 1     ; Disregard 1st approach coords: 0=use, 1=discard
#65 = 0     ; Vibration settling pause (ms, recommend 1000)
#59 = 0     ; Fast feed cancel button (0=none, or port number)
#63 = 1     ; 1st approach stop type: 0=smooth, 1=sharp
```

### External Settings (Controller parameters)

**Homing Speeds:**
```gcode
#107-#111   ; 1st approach speed per axis (fast, mm/min)
#118        ; 2nd approach speed all axes (slow, ≤100mm/min)
            ; If #118=0, uses motor start speed
```

**Homing Control:**
```gcode
#546, #549, #552, #555, #558
            ; Enable/disable homing per axis (1=on, 0=off)
            
#106        ; Number of homing cycles (≥3 for error calc)

#117        ; Max error threshold (mm, 0=no check)
            ; If exceeded, alignment fails or auto-restarts
```

**Coordinate Offsets:**
```gcode
#235-#239   ; Homing offset per axis (mm)
            ; Machine zero = sensor position + offset
            ; Example: #236=2 → Y-axis zero is 2mm from sensor
            
#122-#126   ; Machine position after homing
            ; Where axis moves after alignment complete
```

**Axis Combination:**
```gcode
#488-#492   ; Dual-axis configuration
            ; Must be set correctly for gantry pairing
```

**Statistics (Read-Only):**
```gcode
#2111-#2115 ; Last homing max error per axis (mm)
#2800-#2815 ; Cumulative max error (for averaging)
#2808-#2816 ; Homing counter (for statistics)
```

---

## Installation Guide

### Step 1: Prepare Macro File

**Using Notepad++:**

1. Open `macro_DA_without_relay_advanced.nc`
2. Set encoding: **Encoding → Character Sets → Chinese Simplified**
3. Remove comment lines (optional, for firmware installation):
   - Search → Replace
   - Find: `;;.*` (enable Regular Expressions)
   - Replace with: (empty)
   - Click "Replace All"
4. Remove blank lines (optional):
   - Edit → Line Operations → Remove Empty Lines

### Step 2: Configure Internal Variables

Edit lines 4-25 in the macro:

```gcode
// Example for Ultimate Bee 1010 Y-axis
#91 = 1     ; Y-axis (0=X, 1=Y, 2=Z, 3=A, 4=B)
#2  = 1     ; Same as master for dual-gantry
#41 = 20    ; Master sensor on IN20
#43 = 21    ; Slave sensor on IN21
#19 = 0     ; No combined port (no diodes installed)
#62 = 15    ; IN15 unused (free for G31)

#27 = 0     ; Fast Feed disabled (first-time setup)
#25 = 0     ; Pre-Alignment disabled (no diode circuit)
#57 = 0     ; N/A (PA disabled)
#26 = 1     ; Fine Alignment ENABLED (required!)

#31 = 5     ; Max 5mm gantry bend
#34 = 0     ; No master corrector
#33 = 0     ; No slave corrector

#50 = 0     ; No contact check (inductive sensors)
#16 = 0     ; Manual restart (safer for testing)
#49 = 1200  ; Max 1200mm (table length)
#53 = 3     ; Max 3mm for fine approaches
#54 = 1     ; Discard 1st approach (speed >200mm/min)
#65 = 1000  ; 1 second settling (shaky machine)
#59 = 0     ; No cancel button
#63 = 1     ; Sharp stop on 1st approach
```

### Step 3: Configure External Parameters

**In controller settings or startup macro:**

```gcode
; Homing speeds
#107 = 500   ; X fast (not used for Y)
#108 = 800   ; Y fast (1st approach)
#109 = 500   ; Z fast (not used for Y)
#110 = 500   ; A fast (not used for Y)
#111 = 500   ; B fast (not used for Y)

#118 = 80    ; All axes slow (2nd+ approaches)

; Homing enables
#549 = 1     ; Y-axis homing enabled

; Quality
#106 = 3     ; 3 cycles minimum (5 recommended)
#117 = 0.1   ; 0.1mm max error threshold

; Offsets
#236 = 2     ; Y-axis home offset = 2mm from sensor

; Position after homing
#123 = 10    ; Move to Y=10mm after homing complete
```

### Step 4A: Standalone Testing (Recommended First)

**Test before firmware integration:**

1. Copy macro to USB stick as `TEST_DUAL_Y.nc`
2. Load on controller via USB
3. **Manually jog gantry to ~10mm from sensors**
4. Run program: `M98 P1234` (if saved as O1234)
5. Observe behavior:
   - Should probe master sensor
   - Calculate position
   - Probe slave sensor
   - Align gantry
   - Move to final position

**If successful → Proceed to firmware integration**
**If failed → Check Part 3: Troubleshooting**

### Step 4B: Firmware Integration (Production)

**Replace standard homing subroutine:**

1. Backup your firmware first!
2. Open `slib-g.nc` from firmware folder
3. Find subroutine `O503`
4. Replace entire O503 contents with macro (keep O503 header and M99 footer)
5. Save file
6. Open `fndY.nc` (or your dual-axis file)
7. Replace `M98P501` with `M98P503`
8. Save files
9. Flash firmware via:
   - V0-V1 firmware: `install` folder
   - V2 firmware: `psys` folder
10. Power cycle controller
11. Test homing via controller menu

**Example fndy.nc modification:**
```gcode
; OLD:
; M98P501X1    ; Call standard homing for Y

; NEW:
M98P503X1     ; Call advanced dual-gantry homing for Y
```

---

## Next Steps

**Continue to:**
- **Part 2**: [Algorithm & Math](dual-gantry-advanced-2-algorithm.md) - Understand the 85-step process
- **Part 3**: [Usage & Troubleshooting](dual-gantry-advanced-3-usage.md) - Configuration examples and problem solving

---

**Part 1 of 3** | [Next: Algorithm & Math →](dual-gantry-advanced-2-algorithm.md)
