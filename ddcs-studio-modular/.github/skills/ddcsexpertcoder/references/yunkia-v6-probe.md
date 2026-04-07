# YunKia V6 (TP06) 3D Touch Probe - Quick Reference

**Model**: V6 Anti-roll 3D Touch Probe (TP06)  
**Type**: NPN Normally Open (NO)  
**Use**: XYZ surface probing, edge/center finding

**Complete specs**: See full version of this document (623 lines) for detailed integration guide

---

## Quick Specs

| Parameter | Value |
|-----------|-------|
| **Output** | NPN Normally Open |
| **Voltage** | DC 5-24V |
| **Repeatability** | < 0.01mm @ 50-200mm/min |
| **Shank** | 6mm (router collet) |
| **Input** | IN03 (DDCS parameter #043=0) |

---

## Critical Safety Limits

⚠️ **DO NOT EXCEED**:
- XY Over-travel: **±4mm max** before damage
- Z Over-travel: **2mm max** compression
- Approach speed: **50-200 mm/min max**

---

## Wiring (4-Conductor Cable)

| Wire Color | Connection | Purpose |
|------------|------------|---------|
| **RED** | 24V+ (Wago hub) | Power supply |
| **BLACK** | COM- (Common ground) | Ground return |
| **YELLOW** | IN03 (DDCS input) | Signal (NPN output) |
| **Shield** | Chassis GND | EMI protection |

**CRITICAL**: Shield MUST tie to chassis ground (prevents VFD false triggers)

---

## LED Indicators

| Color | State | Meaning |
|-------|-------|---------|
| **Green** | Steady | Ready / Not triggered |
| **Red** | Steady | Triggered / Contact |

**Troubleshooting**:
- No LEDs: Check power (RED/BLACK wires)
- Always red: Check YELLOW wire, may be shorted
- No signal to controller: Check IN03 connection

---

## DDCS Configuration

```gcode
; Controller parameter
#043 = 0      ; Active-Low for IN03 (NPN)

; Verify probe working
; Check controller I/O screen: IN03 should be:
; - OFF (0) when not touching
; - ON (1) when manually triggered
```

---

## G31 Probe Commands

### Basic Probe (Single Axis)

```gcode
; Probe Z-axis down
G91 G31 Z-50 F100 P3 L0 Q1
```

**Parameters**:
- `G91`: Incremental mode
- `Z-50`: Max travel 50mm down
- `F100`: Feed rate 100mm/min
- `P3`: Use IN03 input
- `L0`: Skip distance = 0
- `Q1`: Error if no trigger

### Multi-Axis Probe (XYZ Simultaneously)

```gcode
; Probe at 45° angle
G91 G31 X10 Y10 Z-20 F80 P3 L0 Q1
```

### Result Variables

```gcode
#1925   ; X position when triggered
#1926   ; Y position when triggered
#1927   ; Z position when triggered
#1922   ; Z-axis hit flag (1=triggered, 0=miss)
```

---

## Probe Speed Recommendations

| Stage | Speed | Use |
|-------|-------|-----|
| **Rapid Approach** | 500mm/min | Get close to surface |
| **1st Probe** | 200mm/min | Initial contact |
| **Retract** | 500mm/min | Back off |
| **2nd Probe** | 50mm/min | Precision measurement |

**Best Practice**: Always use two-stage probing for accuracy

---

## Common Probe Operations

### 1. Find Surface (Z-Height)

```gcode
O1000 (Find Surface)
G90 G0 X50 Y50      ; Move to probe location
G43 H1 Z10          ; Safe height with tool offset
G91 G31 Z-50 F100 P3 L0 Q1   ; Probe down
#100 = #1927        ; Save Z contact position
G90 G0 Z10          ; Retract to safe height
M30
```

### 2. Find Edge (X or Y)

```gcode
O2000 (Find X Edge - Approach from left)
G90 G0 Z-5          ; Position above workpiece
G91 G31 X50 F80 P3 L0 Q1     ; Probe right until contact
#100 = #1925        ; Save X edge position
G90 G0 X[#100-10]   ; Retract 10mm
M30
```

### 3. Find Center (Inside Bore)

```gcode
O3000 (Find Bore Center - X)
; Probe from left
G91 G31 X20 F80 P3 L0 Q1
#left = #1925

; Retract and move to other side
G91 G0 X-25
; Probe from right
G91 G31 X-20 F80 P3 L0 Q1
#right = #1925

; Calculate center
#center = [#left + #right] / 2
G90 G0 X#center     ; Move to center
M30
```

---

## Typical Macro Pattern

```gcode
O1000 (2-Stage Precision Probe)

; ═══ PHASE 1: Fast Approach ═══
G91 G31 Z-50 F200 P3 L0 Q1
IF #1922 != 1 THEN #1505=1(No contact!)

; ═══ PHASE 2: Retract ═══
G91 G0 Z2           ; Back off 2mm

; ═══ PHASE 3: Slow Precision ═══
G91 G31 Z-5 F50 P3 L0 Q1
#z_surface = #1927  ; Save precise position

; ═══ PHASE 4: Safe Retract ═══
G90 G0 Z10
M30
```

---

## Troubleshooting

### Probe Not Triggering

```
Problem: G31 completes but #1922 = 0
    ↓
Check I/O screen: Does IN03 change when touched?
    ├─ NO → Hardware issue
    │   ├─ Check 24V at probe (RED wire)
    │   ├─ Check signal continuity (YELLOW wire)
    │   └─ Check shield ground
    └─ YES → Software issue
        ├─ Verify #043 = 0
        ├─ Check G31 P3 parameter
        └─ Check probe speed (not too fast)
```

### False Triggers (VFD Running)

```
Problem: Probe triggers randomly with spindle on
    ↓
EMI from VFD
    ├─ Verify shield connected to chassis ground
    ├─ Check probe cable routing (away from VFD)
    ├─ Add ferrite bead to probe cable
    └─ Check common ground (Bus A & Bus B)
```

### Poor Repeatability

```
Problem: Inconsistent measurements (>0.02mm variation)
    ↓
Check these factors:
    ├─ Speed too fast (>200mm/min)
    ├─ Approach angle too steep (>30°)
    ├─ Probe tip dirty/damaged
    ├─ Machine not rigid (loose gantry)
    └─ Electrical noise (shield not grounded)
```

---

## Maintenance

**Weekly**:
- Clean probe tip with isopropyl alcohol
- Inspect stylus for damage/wear
- Check LED operation

**Monthly**:
- Verify repeatability test (5 measurements same point)
- Check cable for wear/damage
- Clean collet/shank interface

**Replace tip if**:
- Tungsten ball shows wear/flat spots
- Repeatability degrades (>0.02mm)
- Physical damage visible

---

## Integration Checklist

- [ ] Probe secured in 6mm collet
- [ ] RED wire → 24V+ (Wago hub)
- [ ] BLACK wire → COM- (ground)
- [ ] YELLOW wire → IN03 (DDCS)
- [ ] Shield → Chassis ground
- [ ] Parameter #043 = 0 (Active-Low)
- [ ] LEDs working (Green when idle)
- [ ] IN03 changes on I/O screen when touched
- [ ] Test G31 probe command
- [ ] Verify repeatability (<0.01mm)

---

## Related Documentation

**For complete specifications** (623 lines):
- Full wiring diagrams
- Advanced probe patterns
- Calibration procedures
- Troubleshooting decision trees
- G31 parameter reference

**Other references**:
- `hardware-integration-spec.md` - I/O configuration and troubleshooting
- `g31-probe-variables.md` - Complete G31 command reference
- `macro_cam10-13.nc` - Working probe macro examples
- `community-patterns-1-core.md` - G31 extended syntax patterns

---

## Document Status

**Type**: Quick reference  
**Authority**: [CONFIRMED] Production hardware  
**Input**: IN03  
**Last Updated**: January 2026

**For detailed integration guide, calibration, and advanced patterns**, see full 623-line version.
