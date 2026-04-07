# Ultimate Bee 1010 CNC - Hardware Reference Hub

**Machine**: Bulkman 3D Ultimate Bee 1000×1000mm  
**Controller**: DDCS Expert M350  
**Last Updated**: January 2026

**Purpose**: Quick navigation to hardware specifications and detailed reference docs

---

## Navigation

**For quick technical specs** → Use `hardware-integration-spec.md` (475 lines)  
- I/O mapping with authority tags  
- Power distribution (Bus A/Bus B)  
- Troubleshooting decision trees  
- Quick reference tables

**For complete machine manifest** → Continue reading this document

---

## 1. Critical Machine Characteristics

### 1.1. Manual Tool Change Only [CRITICAL]

**This machine uses MANUAL TOOL CHANGES ONLY**:
- ❌ NO tool carousel, ATC, tool changer equipment
- ✅ Separate G-code files per tool
- ✅ Operator changes tools **between files**
- ✅ Tool length measured **before each file**

**Workflow**: One tool per file → Change tool → Measure → Next file

**See**: Section 12 for complete tool change strategy

---

### 1.2. Hybrid Wiring Architecture

**History**:
- Upgraded from DDCS v4.1 → DDCS Expert M350
- **Kept**: Magic Cube cabinet, DB37 cable, original limit switches
- **Added**: Rotary B-axis, 3D probe, Z-puck (direct-wired via Wago hub)

**Result**: Legacy DB37 system + direct-wired additions

**See**: `hardware-integration-spec.md` for complete power distribution topology

---

### 1.3. Axis Orientations [CONFIRMED]

| Axis | Direction | Travel | Home Position |
|------|-----------|--------|---------------|
| X | Positive | 0 to +1000mm | 0mm (left) |
| Y | **NEGATIVE** | 0 to **-735mm** | 0mm (back) |
| Z | **NEGATIVE** | 0 to **-150mm** | 0mm (top) |
| B | Rotary | ±180° | 0° (reference) |

**Critical**: Y and Z travel in NEGATIVE space!

---

## 2. Quick Reference Tables

### 2.1. Motor Specifications

| Component | Model | Specs | Pulse Setting |
|-----------|-------|-------|---------------|
| **Linear Motors** (X/Y/Z) | PFDE 57HSE 3.0N | 3.0Nm, 3.5A, 1.8° | 5000 microsteps |
| **Rotary Motor** (B) | NEMA 23 | Via 6:1 belt | 3200 microsteps |

---

### 2.2. Ball Screw Specifications

| Axis | Part Number | Pitch | Pulse Setting |
|------|-------------|-------|---------------|
| X, Y | SFS1210 | 10mm | 500.000 |
| Z | SFU1204 | 4mm | 1250.000 |

---

### 2.3. Sensor Configuration

| Input | Device | Type | Logic | Bus |
|-------|--------|------|-------|-----|
| IN01 | B-Axis Home | NPN Proximity | Active-Low | B (Direct) |
| IN02 | Tool Setter (Fixed) | Passive Touch | NO | B (Direct) |
| IN03 | YunKia V6 3D Probe | NPN | Active-Low | B (Direct) |
| IN10 | Z-Probe Puck (Mobile) | Passive Touch | NO | B (Direct) |
| IN20 | X-Axis Home | NPN Proximity | Active-Low | A (DB37) |
| IN21 | Z-Axis Home | NPN Proximity | Active-Low | A (DB37) |
| IN23 | Y-Axis Home (Y1/Master) | NPN Proximity | Active-Low | A (DB37) |

**See**: `hardware-integration-spec.md` Section 3 for complete I/O mapping

---

### 2.4. Spindle Specifications

| Parameter | Value |
|-----------|-------|
| Model | 2.2kW Water-Cooled |
| Max Speed | 24,000 RPM |
| Control | VFD via RS485 |
| Collet | ER20 |

---

## 3. Section Quick Links

**Click section number to jump**:

- [§4: Physical Control Architecture](#4-physical-control-architecture)
- [§5: Spindle Details](#5-spindle-specifications)
- [§6: Construction Hardware](#6-construction-hardware)
- [§7: Accessories](#7-accessories--external-equipment)
- [§8: Rotary Axis Mechanics](#8-rotary-axis-mechanical-specifications)
- [§9: Soft Limits](#9-configuration--calibration-data)
- [§10: Coordinate System](#10-coordinate-system-behavior)
- [§11: Dual-Gantry Y-Axis](#11-dual-gantry-y-axis-synchronization)
- [§12: Tool Change Strategy](#12-tool-change-strategy)
- [§13: Probe Summary](#13-probe-configuration-summary)
- [§14: Key Characteristics](#14-key-machine-characteristics)
- [§15: Related Documentation](#15-related-documentation)
- [§16: NPN Input Logic](#16-ddcs-expert-input-logic)

---

## 4. Physical Control Architecture

**Split System Configuration**:

**Bus A (Legacy/DB37)**:
- Power: DDCS COM+/COM- → DB37 cable → Magic Cube
- Devices: X/Y/Z limit switches
- Distribution: Through DB37 connector

**Bus B (Direct/Wago)**:
- Power: 5-port Wago hub at front console
- Devices: 3D probe, Z-puck, B-axis home, tool setter
- Distribution: Direct-wired to controller

**Common Ground**: Shared between both buses

**See**: `hardware-integration-spec.md` Section 2 for complete topology with diagrams

---

## 5. Spindle Specifications

**Model**: 2.2kW Water-Cooled Spindle  
**Max Speed**: 24,000 RPM  
**Control**: VFD via RS485 Modbus  
**Collet**: ER20  
**Cooling**: Closed-loop water cooling system

---

## 6. Construction Hardware

**Frame**: Extruded aluminum (8020 style)  
**Bed**: Aluminum T-slot wasteboard  
**Gantry**: Dual Y-axis synchronized configuration  
**Linear Rails**: MGN15 on all axes

---

## 7. Accessories & External Equipment

**Probes**:
- YunKia V6 TP06 3D Touch Probe (NPN, IN03)
- Z-Probe Puck (Passive touch, IN10)
- Fixed Tool Setter (Passive touch, IN02)

**Rotary**:
- B-axis rotary table (6:1 belt drive)
- NPN proximity home sensor (IN01)

**See**: `yunkia-v6-probe.md` for complete 3D probe specifications

---

## 8. Rotary Axis Mechanical Specifications

**Transmission**: 6:1 Synchronous Belt  
**Microstepping**: 3200 pulses/rev  
**DDCS Setting**: 53.333 pulses/degree  
**Homing**: NPN proximity sensor (IN01)  
**Signal**: Direct-wired to DDCS B-axis green terminals

**Calculation**:
```
Motor: 200 steps/rev × 16 microsteps = 3200 steps/rev
Reduction: 3200 × 6 = 19200 steps/360°
Per Degree: 19200 / 360 = 53.333 steps/degree
```

---

## 9. Configuration & Calibration Data

**Soft Limits** (Controller Parameters):

| Axis | Min (#) | Max (#) | Travel |
|------|---------|---------|--------|
| X | #551 = 0 | #552 = 1000 | 1000mm |
| Y | #553 = -735 | #554 = 0 | 735mm (NEGATIVE) |
| Z | #555 = -150 | #556 = 0 | 150mm (NEGATIVE) |
| B | #559 = -180 | #560 = 180 | 360° |

**Homing Speeds**:
- 1st approach: 500-800 mm/min (fast)
- 2nd approach: 50-100 mm/min (slow, #118)

---

## 10. Coordinate System Behavior

**Machine Zero** (G53):
- X=0, Y=0, Z=0 (absolute machine position)
- Located at back-left-top corner

**G28 Back-Off** (NOT machine zero!):
- X: +5.0mm from switch
- Y: -5.0mm from switch  
- Z: -5.0mm from switch

**WCS (G54-G59)**:
- User-defined work coordinate systems
- Set via direct parameter writing (#805+)
- G10 is broken, use direct writes

**See**: `software-technical-spec.md` Section 3.2 for WCS management

---

## 11. Dual-Gantry Y-Axis Synchronization

**Configuration**:
- Master: Y1 (Left gantry)
- Slave: Y2 (Right gantry, mapped to A-axis)
- Synchronization: #991=1 (normal operation)

**Homing**:
- IN23: Y1/Master limit switch
- Auto-squaring via dual-axis macro

**See**: `dual-gantry-advanced-1-overview.md` for complete dual-gantry documentation

---

## 12. Tool Change Strategy

### Manual Tool Change Workflow

**CRITICAL**: This machine uses **separate G-code files per tool**

**Workflow**:
```
1. Load Tool 1 manually
2. Measure tool length (Z-probe on IN02 or IN10)
3. Load and run complete file (all Tool 1 operations)
4. File ends (M30)
5. Manually change to Tool 2
6. Measure Tool 2 length
7. Load and run complete file (all Tool 2 operations)
8. Repeat for additional tools
```

**File Naming Convention**:
```
Project_Roughing_6mmEM.nc
Project_Finishing_3mmEM.nc
Project_Engraving_VBit.nc
```

**Do NOT**:
- ❌ Combine multiple tools in one file with M0 pauses
- ❌ Expect automatic tool changing
- ❌ Use M6 expecting ATC behavior
- ❌ Reference tool library/carousel

**User separates multi-tool operations into individual files**

---

## 13. Probe Configuration Summary

| Device | Input | Type | Usage |
|--------|-------|------|-------|
| **YunKia V6 3D** | IN03 | NPN NO | XYZ surface finding, digitizing |
| **Z-Probe Puck** | IN10 | Touch NO | Tool length measurement (mobile) |
| **Tool Setter** | IN02 | Touch NO | Tool length measurement (fixed) |

**All configured**: Active-Low (#043=0)

**See**: `g31-probe-variables.md` for G31 command reference

---

## 14. Key Machine Characteristics

**Travel Distances**:
- X: 1000mm (positive space)
- Y: 735mm (**negative space**)
- Z: 150mm (**negative space**)
- B: ±180° (rotary)

**Critical Warnings**:
- ⚠️ Y and Z travel in NEGATIVE space
- ⚠️ G28 ≠ Machine zero (goes to back-off positions)
- ⚠️ Manual tool change only (no ATC)
- ⚠️ Dual-gantry requires squaring (Y/A axis sync)

**Strengths**:
- ✅ Hybrid wiring (legacy + direct)
- ✅ Dual probe system (3D + Z-puck + tool setter)
- ✅ Rotary 4th axis capability
- ✅ Production-tested configuration

---

## 15. Related Documentation

**For detailed specs**:
- `hardware-integration-spec.md` - I/O mapping, troubleshooting, power distribution
- `yunkia-v6-probe.md` - Complete YunKia V6 specifications
- `dual-gantry-advanced-1-overview.md` - Dual-gantry configuration
- `g31-probe-variables.md` - G31 probing command reference
- `supplies-and-parts-list.md` - BOM and part numbers

**For software/firmware**:
- `software-technical-spec.md` - Firmware quirks and core truths
- `CORE_TRUTH.md` - Controller workarounds
- `macrob-programming-rules.md` - MacroB syntax

**For patterns**:
- `user-tested-patterns.md` - Verified patterns on this machine
- `community-patterns-1-core.md` - Production patterns

---

## 16. DDCS Expert Input Logic

**All inputs configured as NPN (Sinking/Active-Low)**:

**Parameter #043 = 0** for all sensor inputs

**NPN Logic**:
- Sensor inactive: Signal pulled high (24V)
- Sensor active: Signal pulled to ground (0V)
- Controller sees: LOW = triggered, HIGH = idle

**Wiring** (NPN sensors):
- Brown: 24V+
- Blue: Signal to controller input
- Black: Ground (COM-)

**See**: `hardware-integration-spec.md` Section 3 for complete wiring

---

## Document Status

**Type**: Navigation hub + quick reference  
**Authority**: [CONFIRMED] Production hardware  
**Last Updated**: January 2026  
**Machine**: Ultimate Bee 1010

**For complete detailed specifications**, see referenced documents above.

**For troubleshooting**, use `hardware-integration-spec.md` Section 8 (decision trees).
