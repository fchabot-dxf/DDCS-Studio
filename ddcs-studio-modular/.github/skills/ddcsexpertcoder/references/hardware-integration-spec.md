# DDCS Expert Hardware Integration Specification
## Ultimate Bee 1010 CNC Machine

**Controller**: DDCS Expert M350 (V1.22)  
**Machine**: Bulkman 3D Ultimate Bee 1000×1000mm  
**Last Updated**: January 2026

**Purpose**: Agent-optimized hardware reference for I/O troubleshooting and accessory integration

---

## 1. System Architecture Overview

### Hybrid Wiring Topology

**The Ultimate Bee 1010 uses a DUAL-BUS power distribution:**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   BUS A (Legacy)          BUS B (Direct)        │
│   DB37 → Magic Cube       Wago Hub → Sensors    │
│                                                 │
│   ┌──────────┐            ┌──────────┐         │
│   │ DDCS     │            │ 5-Port   │         │
│   │ COM+/COM-│───────────▶│ Wago Hub │         │
│   │          │            │ (24V DC) │         │
│   └────┬─────┘            └────┬─────┘         │
│        │                       │                │
│        │ DB37 Cable            │ Direct Wiring  │
│        ▼                       ▼                │
│   ┌──────────┐            ┌──────────┐         │
│   │ Magic    │            │ Probes & │         │
│   │ Cube     │            │ Sensors  │         │
│   │ Breakout │            │ (Front)  │         │
│   └──────────┘            └──────────┘         │
│                                                 │
│   Common Ground Reference ────────────────────  │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Key Architectural Decision:**
- **Bus A**: Powers legacy limit switches via DB37 cable (X/Y/Z home)
- **Bus B**: Powers direct-wired precision accessories (probes, rotary)
- **Common Ground**: Ensures signal integrity across opto-isolated inputs

---

## 2. Power Distribution [CONFIRMED]

### Bus A: Legacy/DB37 System

**Power Source**: DDCS `COM+` / `COM-` screw terminals  
**Path**: Controller → DB37 cable → Magic Cube breakout board  
**Voltage**: 24V DC  
**Load**: Limit switches (X, Y, Z axes)

### Bus B: Direct/Wago Hub

**Power Source**: 5-port Wago hub (front panel console)  
**Path**: Wago hub → Direct-wired sensors  
**Voltage**: 24V DC (localized distribution)  
**Load**: 
- YunKia V6 3D probe
- Tool setter (fixed)
- Z-probe puck (mobile)
- B-axis rotary home sensor

### Ground Reference

**CRITICAL**: Both buses share **common ground** to prevent ground loops and ensure proper opto-isolator operation.

**Shield Grounding**: Cable shield mesh MUST tie to machine chassis ground (prevents VFD EMI false triggers).

---

## 3. Input Mapping & Logic [CONFIRMED]

**Controller Specification**: All DDCS Expert inputs are **NPN-compatible (Sinking/Active-Low)**

### 3.1. Direct-Wired Accessories (Bus B)

| Input | Device | Type | Logic | Parameter | Status |
|-------|--------|------|-------|-----------|---------|
| **IN01** | B-Axis Rotary Home | NPN Proximity | Active-Low | #043=0 | ✅ Working |
| **IN02** | Tool Setter (Fixed) | Passive Touch | Normally Open | #043=0 | ✅ Working |
| **IN03** | YunKia V6 3D Probe | NPN (NO) | Active-Low | #043=0 | ✅ Working |
| **IN10** | Z-Probe Puck (Mobile) | Passive Touch | Normally Open | #043=0 | ✅ Working |

**Key Points:**
- All configured for **Active-Low** (parameter #043 = 0)
- NPN sensors pull signal to ground upon trigger
- Passive touch probes: Normally Open, complete circuit on contact

### 3.2. Legacy DB37 Sensors (Bus A)

| Input | Device | Path | Logic | Status |
|-------|--------|------|-------|---------|
| **IN20** | X-Axis Home | DB37 → Magic Cube | Active-Low | ✅ Working |
| **IN21** | Z-Axis Home | DB37 → Magic Cube | Active-Low | ✅ Working |
| **IN23** | Y-Axis Home (Y1/Master) | DB37 → Magic Cube | Active-Low | ✅ Working |

**Note**: Y-axis uses IN23 for master (Y1/left) gantry side. Slave side (Y2/right) handled by dual-axis configuration.

---

## 4. YunKia V6 (TP06) 3D Probe Specification [CONFIRMED]

**Model**: YunKia V6 Anti-roll 3D Touch Probe (TP06)  
**Type**: NPN Normally Open  
**Input**: IN03  
**Repeatability**: <0.01mm @ 50-200mm/min

### Electrical Configuration

```gcode
#043 = 0      ; Active-Low configuration for IN03
```

### Wiring (4-conductor cable)

| Wire Color | Connection | Purpose |
|------------|------------|---------|
| **RED** | 24V+ (Wago) | Power supply |
| **BLACK** | COM- (Common ground) | Ground return |
| **YELLOW** | IN03 (DDCS) | Signal (NPN output) |
| **Shield** | Chassis GND | EMI protection |

### Visual Feedback

- **Green LED**: Idle / Ready
- **Red LED**: Triggered / Contact detected

### Critical Requirements

1. **Shield Grounding**: Cable shield MUST tie to chassis ground
2. **EMI Protection**: Keep probe cable away from VFD/spindle power lines
3. **Over-Travel Limits**:
   - X/Y: ±4mm maximum deflection
   - Z: 2mm maximum over-travel
4. **Speed Limits**:
   - Approach: 50-200mm/min maximum
   - Retract: No limit (500mm/min typical)

**See**: `yunkia-v6-probe.md` for complete technical documentation

---

## 5. Motion Control & Axis Mapping [CONFIRMED]

### 5.1. Linear Axes (X/Y/Z)

**Motors**: Closed-loop PFDE 57HSE 3.0N  
**Microstepping**: 5000 pulses/rev  
**Drive Type**: Pulse + Direction (Step/Dir)

**Axis Orientations:**
- **X-Axis**: 0mm (left/home) to +1000mm (right)
- **Y-Axis**: 0mm (back/home) to **-735mm** (front/operator) ⚠️ **NEGATIVE SPACE**
- **Z-Axis**: 0mm (top/home) to -150mm (down/cutting)

### Y-Axis Dual-Gantry Configuration

**Master**: Y1 (Left gantry)  
**Slave**: Y2 (Right gantry) mapped to A-axis  

**Synchronization Logic**:
```gcode
; Normal operation (synchronized)
#991 = 1      ; A-axis slaved to Y-axis

; Squaring calibration (independent)
#991 = 3      ; A-axis independent control
```

**Homing Strategy**:
- IN23: Y1/Master limit switch
- IN24 (or separate): Y2/Slave limit switch
- See `dual-gantry-advanced.md` for auto-squaring macro

### 5.2. Rotary Axis (B-Axis)

**Motor**: NEMA 23 Stepper  
**Transmission**: 6:1 Synchronous Belt  
**Microstepping**: 3200 pulses/rev  
**DDCS Setting**: 53.333 pulses/degree  

**Signal Path**: Direct-wired to DDCS green terminal blocks
- B-PUL (Pulse)
- B-DIR (Direction)
- B-EN (Enable)

**Homing**: NPN proximity sensor on IN01

---

## 6. Tool Management Workflow [CONFIRMED]

### ⚠️ **NO AUTOMATIC TOOL CHANGER**

**This machine is strictly Manual Tool Change (MTC)**

**Workflow**:
1. One tool per G-code file
2. Tool change happens **between files** (not during)
3. Tool length measurement **before** file execution (not during)
4. No M6 commands in production files

**Example Multi-Tool Project**:
```
Project_Roughing_6mmEM.nc      ; Tool 1 - all roughing ops
Project_Finishing_2mmBN.nc     ; Tool 2 - all finishing ops
Project_Engraving_VBit.nc      ; Tool 3 - all engraving ops
```

**Tool Length Measurement**:
- Use IN02 (Tool Setter) before each file
- Store in WCS Z-offset (#807 for G54)
- Never measure mid-file

---

## 7. Wiring Standards & Maintenance [CONFIRMED]

### Termination Requirements

**CRITICAL**: All stranded wires in screw terminals MUST use **wire ferrules**

**Why**:
- Prevents wire fraying
- Eliminates high-resistance connections
- Stops loose strands from shorting

**Wire Sizes**:
- 24V power: 18-22 AWG (use ferrules)
- Signal wires: 22-24 AWG (use ferrules)
- Ground/shield: 18 AWG (use ferrules)

### Signal Integrity

**Separation Requirements**:
```
Bus B Probe Cables          VFD/Spindle Power
       │                           │
       │  ← Minimum 100mm →        │
       │     Separation            │
       ▼                           ▼
```

**DO NOT**:
- Run probe cables parallel to VFD power
- Bundle signal and power cables together
- Cross probe cables over VFD at 90° (if unavoidable, use shielded cable)

### Testing Protocol

**Before ANY G31 probe operation**:

1. Open controller I/O diagnostic screen
2. Manually trigger each sensor
3. Verify state change: 0 → 1 (or 1 → 0 depending on #043 setting)
4. Test both trigger and release
5. Document any sensors that don't respond

**Never assume a sensor works without testing!**

---

## 8. Troubleshooting Decision Tree

### Problem: Probe Not Triggering

```
Probe doesn't trigger during G31
    │
    ├─ Check I/O screen: Does input change when manually triggered?
    │   │
    │   ├─ NO → Hardware issue
    │   │   ├─ Check 24V at probe (multimeter)
    │   │   ├─ Check continuity of signal wire
    │   │   ├─ Check ferrule connections (wiggle test)
    │   │   └─ Check shield ground connection
    │   │
    │   └─ YES → Software/parameter issue
    │       ├─ Verify #043 setting (should be 0 for NPN)
    │       ├─ Verify G31 command uses correct port (P3 for IN03)
    │       ├─ Check probe speed (too fast >200mm/min?)
    │       └─ Verify L0 Q1 parameters in G31 command
```

### Problem: False Triggers (VFD Running)

```
Probe triggers randomly when spindle is on
    │
    └─ EMI from VFD → Shield not grounded
        │
        ├─ Check shield connection to chassis ground
        ├─ Verify probe cable routing (away from VFD)
        ├─ Add ferrite bead to probe cable (if needed)
        └─ Check common ground between Bus A and Bus B
```

---

## 9. Reference Documentation

**In this skill:**
- `yunkia-v6-probe.md` - Complete 3D probe technical specs
- `dual-gantry-advanced-1-overview.md` - Y-axis dual-gantry configuration
- `hardware-config.md` - Complete machine manifest
- `g31-probe-variables.md` - G31 command reference

**External:**
- YunKia V6 TP06 Datasheet (PDF)
- DDCS Expert User Manual (Chinese)
- PFDE 57HSE Motor Specifications

---

## 10. Quick Reference Tables

### Input Assignment Summary

| Input | Device | Bus | Type | #043 |
|-------|--------|-----|------|------|
| IN01 | B-Axis Home | B | NPN | 0 |
| IN02 | Tool Setter | B | Touch | 0 |
| IN03 | 3D Probe | B | NPN | 0 |
| IN10 | Z-Probe Puck | B | Touch | 0 |
| IN20 | X-Home | A | NPN | 0 |
| IN21 | Z-Home | A | NPN | 0 |
| IN23 | Y1-Home | A | NPN | 0 |

### Power Bus Quick Reference

| Bus | Source | Location | Devices |
|-----|--------|----------|---------|
| A | DDCS COM+/COM- | Controller | X/Y/Z limits (via DB37) |
| B | Wago Hub | Front panel | Probes, rotary home |

### Critical Parameters

```gcode
#043 = 0      ; All inputs Active-Low (NPN)
#578 = 1      ; Active WCS (1=G54, 2=G55, etc.)
#991 = 1      ; A-axis slaved to Y (dual-gantry)
#805-#809     ; G54 offsets (X, Y, Z, A, B)
```

---

**Document Status**: ✅ Production-Verified  
**Authority**: [CONFIRMED] - Ultimate Bee 1010 Hardware  
**Last Validated**: January 2026
