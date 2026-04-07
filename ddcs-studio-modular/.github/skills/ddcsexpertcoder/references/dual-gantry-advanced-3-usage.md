# Advanced Dual-Gantry Auto-Squaring System
## Part 3: Usage & Troubleshooting

**📚 This is part of a 3-part series:**
- Part 1: [Overview & Configuration](dual-gantry-advanced-1-overview.md)
- Part 2: [Algorithm & Math](dual-gantry-advanced-2-algorithm.md)
- **Part 3: Usage & Troubleshooting** ← You are here

---

## Troubleshooting Guide

### Error: "Error in program settings!"

**Possible Causes:**
1. Axis numbers out of range (#91 or #2 not 0-4)
2. Sensor ports set to zero (#41, #43, or #62 = 0)
3. Both PA and FA disabled (#25=0 AND #26=0)
4. PA enabled but no combined port (#25=1 AND #19=0)
5. Invalid enable values (not 0 or 1)

**Solution:**
- Review lines 4-25 in macro
- Verify all settings within valid ranges
- Ensure at least one alignment method enabled

---

### Error: "Axis homing is off"

**Cause:**
Controller parameter for this axis homing is disabled

**Solution:**
```gcode
; For Y-axis
#549 = 1    ; Enable Y-axis homing
```

---

### Error: "Double axis setting error!"

**Cause:**
Slave axis not configured in axis combination settings

**Solution:**
- Check controller axis combination parameters (#488-#492)
- Verify both motors assigned to same axis
- Example for Y-axis: #489 should link Y and A motors

---

### Error: "Limit sensor is set incorrectly!"

**Cause:**
Slave sensor port (#43) is the same as the limit switch port

**Solution:**
- Slave sensor MUST be different from homing limit
- Use separate input port
- Check limit switch configuration (#1015-#1020 range)

---

### Gantry Bends During Alignment

**Symptom:**
Gantry flexes excessively, motors skip steps, loud grinding

**Cause:**
Max alignment distance (#31) set too high for gantry stiffness

**Solution:**
```gcode
#31 = 3     ; Reduce from 5mm to 3mm
            ; Adjust based on your gantry rigidity
```

---

### Alignment Fails with "Distance Exceeded"

**Symptom:**
Program stops, reports gantry alignment distance too large

**Possible Causes:**
1. Gantry severely racked (>5mm)
2. Wrong sensor triggered
3. Sensors mounted incorrectly
4. Pre-alignment skipped when needed

**Solutions:**
1. Manually square gantry before homing
2. Enable Pre-Alignment (#25 = 1)
3. Verify sensor mounting positions
4. Check sensor wiring (master vs slave)
5. Increase #31 cautiously (only if gantry can handle it)

---

### Vibration Causes Inconsistent Results

**Symptom:**
Error values >0.05mm, alignment varies between cycles

**Cause:**
Machine vibrates after 1st approach, affects subsequent readings

**Solution:**
```gcode
#65 = 1000  ; Add 1 second settling pause
#65 = 2000  ; Or 2 seconds for very shaky machines
```

Also consider:
- Reduce 1st approach speed (#107-#111)
- Verify machine leveling and rigidity
- Check for loose components

---

### First Approach Coordinates Inaccurate

**Symptom:**
Large error reported, but gantry squares correctly

**Cause:**
DDCS M350 doesn't correctly determine coordinates at speeds >200mm/min

**Solution:**
```gcode
#54 = 1     ; Disregard 1st approach coordinates
            ; Only use cycles 2+ for error calculation
```

This is already the default setting.

---

### Contact Check Failures

**Symptom:**
Program reports sensor contact issues

**Cause:**
Mechanical sensor with dirty/worn contacts

**Solution:**
```gcode
#50 = 0     ; Disable contact check
            ; Not needed for inductive sensors
```

Or clean/replace mechanical sensors

---

### Statistics Show Increasing Error

**Symptom:**
Average error increases over time

**Possible Causes:**
1. Sensor mounting loosening
2. Gantry wear/play developing
3. Belt/ballscrew backlash
4. V-wheel wear (linear rail systems)

**Diagnostic:**
```gcode
; Check statistics variables
#1510 = #2112     ; Last Y-axis error
#1503 = 1(Last error: %.3f mm)

#1510 = #2802 / #2810    ; Average Y-axis error
#1503 = 1(Average error: %.3f mm)
```

**Solutions:**
- Inspect and tighten sensor mounts
- Check gantry rigidity
- Measure and adjust mechanical play
- Replace worn components

---

## Advanced Configuration Examples

### Example 1: Production CNC (Fast Cycle Time)

**Goal**: Minimize homing time for production environment

```gcode
; Enable all speed features
#27 = 50      ; Fast Feed: Stop 50mm before sensor
#25 = 1       ; Pre-Alignment ON (rough squaring)
#57 = 0       ; Single PA approach (faster)
#26 = 1       ; Fine Alignment ON (precision)

; Reduce quality checks (known good machine)
#106 = 3      ; 3 cycles only (minimum for stats)
#54 = 1       ; Disregard 1st approach
#65 = 500     ; Short 500ms settling
#50 = 0       ; No contact check

; Speeds
#108 = 1200   ; Y fast approach (1200mm/min)
#118 = 100    ; Slow precision (100mm/min)
```

**Result**: ~15-20 second homing cycle

---

### Example 2: Precision Workshop (Maximum Accuracy)

**Goal**: Best possible alignment for precision work

```gcode
; Skip fast feed (not needed, accuracy focus)
#27 = 0       ; Fast Feed OFF
#25 = 1       ; Pre-Alignment ON (eliminates gross error)
#57 = 1       ; Dual PA approach (better accuracy)
#26 = 1       ; Fine Alignment ON

; Maximum quality
#106 = 5      ; 5 cycles for best averaging
#54 = 1       ; Disregard 1st approach
#65 = 2000    ; Full 2 second settling
#50 = 0       ; No contact check (inductive)
#117 = 0.02   ; Strict 0.02mm error threshold

; Conservative speeds
#108 = 600    ; Y moderate speed
#118 = 50     ; Very slow precision (50mm/min)
```

**Result**: ~45-60 second homing, <0.02mm squaring

---

### Example 3: Hobby Router (Simple Setup)

**Goal**: Reliable homing without complex hardware

```gcode
; No diode circuit installed
#19 = 0       ; No combined port
#25 = 0       ; Pre-Alignment OFF
#26 = 1       ; Fine Alignment ON (only method)

; No fast feed
#27 = 0       ; Fast Feed OFF

; Simple reliable settings
#106 = 3      ; 3 cycles
#54 = 1       ; Disregard 1st
#65 = 1000    ; 1 second settling
#50 = 0       ; No contact check
#117 = 0      ; No error checking (manual review)

; Moderate speeds
#108 = 800    ; Y moderate
#118 = 80     ; Slow precision
```

**Result**: ~30-40 second homing, good reliability

---

### Example 4: Shaky/Flexible Machine

**Goal**: Compensate for machine vibration and flex

```gcode
; Use Pre-Alignment to reduce stress
#25 = 1       ; Pre-Alignment ON
#57 = 1       ; Dual PA approach
#26 = 1       ; Fine Alignment ON

; Extra settling time
#65 = 3000    ; 3 second pause (vibration damping)

; Soft stops to reduce vibration
#63 = 0       ; Smooth stop on 1st approach

; Multiple cycles for consistency
#106 = 5      ; 5 cycles, average out vibration

; Slow speeds throughout
#108 = 400    ; Y slow approach
#118 = 40     ; Very slow precision

; Generous error allowance
#117 = 0.1    ; 0.1mm threshold (machine capability)
```

**Result**: Long cycle (~60s), but reliable on shaky machine

---

## Statistics and Diagnostics

### Error Tracking Variables

**Per-Axis Last Error:**
```gcode
#2111  ; X-axis last homing max error (mm)
#2112  ; Y-axis last homing max error (mm)
#2113  ; Z-axis last homing max error (mm)
#2114  ; A-axis last homing max error (mm)
#2115  ; B-axis last homing max error (mm)

; Display last Y-axis error
#1510 = #2112
#1503 = 1(Last Y error: %.3f mm)
```

**Cumulative Error (for averaging):**
```gcode
#2800-#2807  ; Cumulative sum of max errors per axis
#2808-#2816  ; Homing counter per axis

; Calculate average Y-axis error
#avg_y_error = #2802 / #2810

#1510 = #avg_y_error
#1503 = 1(Avg Y error: %.3f mm)
```

### Viewing Current Error

Create diagnostic macro:

```gcode
O9001 (Current Homing Error)

; Display last errors
#1510 = #2111
#1511 = #2112
#1512 = #2113
#1505 = -5000(Last Errors: X[%.3f] Y[%.3f] Z[%.3f])

G04 P3000

; Display cycle counts
#1510 = #2808
#1511 = #2810
#1512 = #2812
#1505 = -5000(Cycles: X[%.0f] Y[%.0f] Z[%.0f])

M30
```

### Viewing Average Error

```gcode
O9002 (Average Homing Error)

; Calculate and display averages
IF #2808 > 0 THEN #1510 = #2800 / #2808
IF #2810 > 0 THEN #1511 = #2802 / #2810
IF #2812 > 0 THEN #1512 = #2804 / #2812

#1505 = -5000(Avg Errors: X[%.3f] Y[%.3f] Z[%.3f])

M30
```

### Resetting Statistics

```gcode
O9003 (Reset Average Error)

#2800 = 0  ; X cumulative error
#2801 = 0  ; X counter
#2802 = 0  ; Y cumulative error
#2803 = 0  ; Y counter
#2804 = 0  ; Z cumulative error
#2805 = 0  ; Z counter

#1505 = -5000(Statistics reset)
M30
```

---

## Comparison: Basic vs Advanced

| Feature | Basic (53 lines) | Advanced (348 lines) |
|---------|------------------|----------------------|
| **Complexity** | Simple | Professional |
| **Fast Feed** | No | Yes (optional) |
| **Pre-Alignment** | No | Yes (with diodes) |
| **Fine Alignment** | Basic single-pass | Multi-cycle averaging |
| **Error Detection** | None | Comprehensive |
| **Statistics** | No | Full tracking |
| **Vibration Handling** | No | Settling pause |
| **Correctors** | No | Master/slave adjust |
| **Safety Checks** | Minimal | Extensive |
| **Configuration** | 5 variables | 20+ variables |
| **Homing Time** | ~20 seconds | 15-60s (configurable) |
| **Accuracy** | ±0.05mm typical | ±0.01mm achievable |
| **Best For** | Simple setup | Production/precision |

---

## Your Machine Configuration (Ultimate Bee 1010)

### Current Setup

```gcode
Machine: Ultimate Bee 1010
Table: 1010mm × 610mm
Dual Axis: Y-axis (1200mm travel)
  - Y1 (Master/Left):  NPN proximity, IN20
  - Y2 (Slave/Right):  NPN proximity, IN21
  - Combined port:     Not installed (no diodes)
  - Free port:         IN15 (available)

Rail System: LGR20 linear rails
Drive: Ballscrews
Gantry: Aluminum extrusion beam
Typical rack: <2mm (well-built machine)
```

### Recommended Settings for Your Machine

```gcode
//───────────────────────────────────
// ULTIMATE BEE 1010 CONFIGURATION
//───────────────────────────────────

// Axis configuration
#91 = 1      ; Y-axis master
#2  = 1      ; Y-axis slave (same number for dual-gantry)

// Sensor ports
#41 = 20     ; Master (Y1 left) on IN20
#43 = 21     ; Slave (Y2 right) on IN21
#19 = 0      ; No combined port (no diode circuit)
#62 = 15     ; IN15 free (for G31 protection)

// Feature enables
#27 = 0      ; Fast Feed OFF (not needed, manual testing phase)
#25 = 0      ; Pre-Alignment OFF (gantry usually square, no diodes)
#57 = 0      ; N/A (PA disabled)
#26 = 1      ; Fine Alignment ON (primary method)

// Safety limits
#31 = 3      ; Max 3mm gantry bend (conservative for aluminum beam)
#49 = 1200   ; Max 1200mm (Y-axis travel length)
#53 = 3      ; Max 3mm for fine approaches

// Correctors (start at zero)
#34 = 0      ; Master corrector (tune after testing)
#33 = 0      ; Slave corrector (tune after testing)

// Quality settings
#50 = 0      ; Contact check OFF (NPN inductive sensors)
#16 = 0      ; Manual restart (safer during development)
#54 = 1      ; Disregard 1st approach (speed >200mm/min)
#65 = 1000   ; 1 second settling (ballscrew machine, moderate)
#59 = 0      ; No cancel button
#63 = 1      ; Sharp stop on 1st approach
```

**External Parameters:**
```gcode
#108 = 800   ; Y-axis 1st approach: 800mm/min
#118 = 80    ; 2nd+ approaches: 80mm/min
#106 = 3     ; 3 homing cycles (increase to 5 for production)
#117 = 0.05  ; 0.05mm error threshold
#236 = 2     ; Y-axis offset: 2mm from sensor
#123 = 10    ; Move to Y=10mm after homing
#549 = 1     ; Y-axis homing enabled
```

### Testing Procedure for Your Machine

**Phase 1: Initial Test (Standalone)**
1. Save macro as `TEST_Y_SQUARE.nc`
2. Manually jog Y1 and Y2 to ~10mm from sensors
3. Verify both sensors OFF (not triggered)
4. Run macro manually
5. Observe:
   - Master side probes (Y1/IN20)
   - Sets zero
   - Slave side probes (Y2/IN21)
   - Calculates distance
   - Aligns gantry (master moves)
   - Moves to final position (Y=10mm)

**Phase 2: Tuning**
1. Check #2112 (last Y-axis error)
   - If >0.05mm → Increase #106 to 5 cycles
   - If >0.1mm → Check sensor mounting
2. Test multiple times, verify consistency
3. If consistent <0.03mm → Ready for production

**Phase 3: Optimization (Optional)**
1. Enable Fast Feed:
   - #27 = 50 (stop 50mm before sensor)
   - Test, verify reliable
2. Add corrector if needed:
   - If gantry drifts to one side
   - #34 = 0.1 (example, tune as needed)

**Phase 4: Firmware Integration**
1. Backup firmware
2. Install as O503 in slib-g.nc
3. Modify fndY.nc to call M98P503
4. Flash firmware
5. Test from controller menu

---

## Future Enhancements

### Work in Progress Features

- [ ] Automatic sensor position learning
- [ ] Dynamic speed adjustment based on error
- [ ] Multi-gantry support (X and Y dual)
- [ ] Touchscreen configuration interface
- [ ] Real-time alignment monitoring
- [ ] Auto-tuning of vibration settling time

---

## Safety Warnings

⚠️ **CRITICAL SAFETY NOTES:**

1. **Alignment Correctors (#34, #33)**
   - Can damage sensors if set too large
   - Start at 0, tune incrementally (±0.1mm steps)
   - Verify safe before enabling

2. **Max Gantry Distance (#31)**
   - Prevents gantry from bending excessively
   - Set conservatively (3-5mm maximum)
   - Exceeding can damage frame or motors

3. **Slave Motor Disconnect**
   - ONLY master side moves during alignment
   - Slave is pushed along by gantry beam
   - NEVER reverse this (slave movement loses master position)

4. **Sharp Stop (#63 = 1)**
   - Can cause step loss at high speeds
   - Use only if soft stop is too slow
   - Not critical since machine zero is reset anyway

5. **Firmware Integration**
   - ALWAYS backup firmware before modification
   - Test standalone before integration
   - Wrong configuration can crash into limits

6. **Sensor Verification**
   - Test sensors individually before auto-squaring
   - Verify correct port assignments
   - Wrong assignment can rack gantry WORSE

---

## Reference Links

**Macro File**: `example-macros/macro_DA_without_relay_advanced.nc`
**Algorithm**: See "Detailed Algorithm" section above
**Basic Macro**: `example-macros/Double_Y_double_zero_switch.nc`
**Community Patterns**: `community-patterns.md` (dual-gantry section)

---

## Credits

**Macro Developer**: DDCS M350 Community
**Documentation**: Compiled from Russian/Chinese source materials
**Algorithm Analysis**: Translated from PDF specification
**Testing**: Multiple commercial installations
**Skill Integration**: Frédéric (Ultimate Bee 1010)

---

## Changelog

**2025-01-19**: Initial documentation added to skill
- 348-line macro added
- Complete configuration guide
- Algorithm translation
- Ultimate Bee 1010 example config
- Troubleshooting section
- Statistics tracking guide

---

## Series Complete

**Navigation:**
- **Part 1**: [Overview & Configuration](dual-gantry-advanced-1-overview.md)
- **Part 2**: [Algorithm & Math](dual-gantry-advanced-2-algorithm.md)
- **Part 3**: Usage & Troubleshooting (current)

---

**Part 3 of 3** | [← Previous: Algorithm & Math](dual-gantry-advanced-2-algorithm.md) | [↑ Back to Part 1](dual-gantry-advanced-1-overview.md)
