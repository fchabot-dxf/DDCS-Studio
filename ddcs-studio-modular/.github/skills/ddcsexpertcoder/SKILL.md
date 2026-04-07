---
name: ddcs-expert
description: Expert guidance for DDCS M350 CNC controller macro programming and G-code development (V1.22 VERIFIED). Use when troubleshooting G-code issues, building macros for DDCS controllers, debugging variable addressing, understanding parameter mappings, working around controller quirks (G53 verified syntax, G10 broken, G28 not configured, variable persistence), developing CNC automation for Ultimate Bee or similar machines using DDCS Expert controllers, or working with manual tool change workflows. Covers variable numbering systems, coordinate system offsets, dual-gantry synchronization, M350-specific workarounds, verified code patterns, and tested macros from real production machines.
---

# DDCS M350/Expert Controller - Macro Programming Skill

**Controller**: DDCS Expert M350 (V1.22 Verified)  
**Machine**: Ultimate Bee 1010 CNC  
**Last Updated**: January 2026  
**Authority**: 90%+ [CONFIRMED] Production Testing

---

## 1. Critical Starting Points

### 1.1. ALWAYS Read These First [REQUIRED]

**For ANY macro task, start here**:

1. **CORE_TRUTH.md** - Firmware quirks and workarounds
   - G10 broken, G28 not machine zero, G53 syntax rules
   - Variable priming bug, C-style operators required
   - [CONFIRMED] patterns only

2. **example-macros/** - 25 production-tested macros
   - Find similar example to your goal
   - Copy working code as template
   - Better than documentation (proven to work)

3. **Quick reference specs** (Agent-optimized):
   - `hardware-integration-spec.md` - I/O, power, troubleshooting trees
   - `software-technical-spec.md` - Core truths, execution model, firmware quirks

**See**: Section 4 for complete reference guide

---

## 2. The Seven Core Truths [CONFIRMED]

**Standard FANUC G-code WILL FAIL without these workarounds**:

| # | Truth | Workaround | Reference |
|---|-------|------------|-----------|
| 1 | **G10 is BROKEN** | Use direct #805+ writes | software-technical-spec.md §3.2 |
| 2 | **G28 ≠ machine zero** | Use G53 G0 with coordinates | CORE_TRUTH.md §3 |
| 3 | **G53 requires variables** | No hardcoded constants | CORE_TRUTH.md §2 |
| 4 | **Variable priming required** | Prime #1153+ from #880+ | variable-priming-card.md |
| 5 | **C-style operators only** | Use ==, !=, <, > (NOT EQ, NE) | software-technical-spec.md §3.4 |
| 6 | **WCS stride = 5** | Not 20 (G54=#805, G55=#810) | software-technical-spec.md §3.5 |
| 7 | **IF/GOTO syntax strict** | No brackets on simple IF, no space in GOTO | conditional-syntax-card.md |

**Machine-Specific (Ultimate Bee 1010)**:
- Y-axis: 0 to **-735mm** (NEGATIVE space)
- Z-axis: 0 to **-150mm** (NEGATIVE space)
- G28 back-off: X=5.0, Y=-5.0, Z=-5.0 (NOT machine zero!)

---

## 3. Quick Decision Tree

**"What should I read for X?"**

```
Task: Write new macro
├─ example-macros/corner_finder_FINAL.nc (perfect IF/GOTO syntax)
├─ example-macros/ (find similar)
├─ software-technical-spec.md §4 (3-phase execution model)
└─ macrob-programming-rules.md (syntax)

Task: Probe not triggering
├─ example-macros/corner_finder_FINAL.nc (working 3-axis probe)
├─ hardware-integration-spec.md §8 (troubleshooting tree)
├─ g31-probe-variables.md (G31 command)
└─ macro_cam*.nc (working examples)

Task: Set up 3D probe radius
├─ example-macros/set_probe_radius.nc (configure #1200)
├─ probe-radius-compensation-guide.md (inside vs outside logic)
├─ example-macros/corner_finder_FINAL.nc (inside corner - adds radius)
└─ example-macros/xy_fence_finder_FINAL.nc (outside fence - subtracts radius)

Task: Controller freeze
├─ variable-priming-card.md (priming bug)
├─ software-technical-spec.md §3.1 (priming requirement)
└─ example-macros/ (check priming patterns)

Task: Dual-gantry setup
├─ dual-gantry-advanced-1-overview.md (config)
├─ dual-gantry-advanced-3-usage.md (troubleshooting)
└─ macro_DA_without_relay_advanced.nc (example)

Task: WCS offset management
├─ software-technical-spec.md §3.2 (avoid G10)
└─ user-tested-patterns.md (working examples)

Task: I/O troubleshooting
├─ hardware-integration-spec.md §10 (quick ref)
└─ hardware-config.md (complete specs)
```

---

## 4. Reference File Guide

### 4.1. Start Here (Agent-Optimized Quick References)

| File | Lines | Purpose |
|------|-------|---------|
| **hardware-integration-spec.md** | 475 | I/O mapping, troubleshooting trees, power distribution |
| **software-technical-spec.md** | 480 | Core truths, 3-phase model, firmware quirks |
| **CORE_TRUTH.md** | 571 | Complete firmware workarounds reference |

**Authority**: All [CONFIRMED] - production-verified patterns only

---

### 4.2. Language & Syntax

**MacroB Programming**:
- `macrob-programming-rules.md` - Complete syntax reference
- `conditional-syntax-card.md` - IF/GOTO/label syntax (quick ref)
- `advanced-macro-mathematics.md` - Complex calculations
- `variable-priming-card.md` - Priming bug patterns

**Variable Reference**:
- `system-control-variables.md` - Variable addresses
- `community-discovered-variables.md` - Undocumented vars
- `user-storage-map.md` - Persistent storage

---

### 4.3. Hardware & I/O

**Machine Configuration**:
- `hardware-config.md` (864 lines) - Complete Ultimate Bee 1010 manifest
- `yunkia-v6-probe.md` (622 lines) - YunKia V6 probe specs
- `supplies-and-parts-list.md` - BOM

**Sensors & Probing**:
- `g31-probe-variables.md` - G31 command reference
- `probe-radius-compensation-guide.md` - Inside vs outside probing logic
- `pnp-to-npn-converter.md` - Signal conversion

---

### 4.4. Working Patterns (Split Series - All Under 650 Lines)

**Community Patterns** (6-part series):
- `community-patterns.md` - Index
- `community-patterns-1-core.md` (606) - **START HERE** for patterns
- Parts 2-5: Boolean/dynamic, multi-tool, advanced syntax

**Dual-Gantry** (3-part series):
- `dual-gantry-advanced.md` - Index
- `dual-gantry-advanced-1-overview.md` (400) - **START HERE** for dual-gantry
- Parts 2-3: Algorithm, troubleshooting

**Display Methods** (2-part series):
- `ddcs-display-methods.md` - Index
- `ddcs-display-methods-1-core.md` (417) - **START HERE** for dialogs
- Part 2: Advanced methods

**Why split?** Better navigation, all parts under 650 lines. Start with Part 1, follow links.

---

### 4.5. Your Machine (User-Specific)

- `user-tested-patterns.md` - Verified on Ultimate Bee 1010
- `fusion-post-processor.md` - Fusion 360 post-processor
- `squaring-macro-WIP-log.md` - Development log

**Calibration**:
- `gantry-squaring-calibration.md` - Manual procedures
- `dual-gantry-auto-squaring.md` - Basic overview

---

### 4.6. Controller Interface

**Virtual Controls**:
- `virtual-buttons-2037.md` (589 lines) - #2037 button simulation
- `k-button-assignments.md` (626 lines) - K-button programming

---

### 4.7. Example Macros (26 Files)

**Directory**: `references/example-macros/`

**⭐ START HERE for correct syntax**: `corner_finder_FINAL.nc` - Perfect IF/GOTO syntax example

**Categories**:
- **Probing**: corner_finder_FINAL.nc ⭐ (perfect syntax), macro_cam10-13.nc (4 methods)
- **Homing**: fndzero.nc, fndy.nc, Double_Y_*.nc
- **Tool Management**: O_Save_*.nc, PERSISTENCE_*.nc
- **Utilities**: SPINDLE_WARMUP.nc, READ_VAR.nc
- **Advanced**: macro_Adaptive_Pocket.nc, macro_DA_without_relay_advanced.nc (348 lines)

**See**: `example-macros/README.md` for complete catalog

---

### 4.8. Data Lookup (Spreadsheets)

1. **DDCS_Variables_mapping_2025-01-04.xlsx**
   - ENG# → Pr# → Macro Address mapping

2. **Virtual_button_function_codes_COMPLETE.xlsx**
   - 201 #2037 KeyValue codes

3. **DDCS_G-M-code_reference.xlsx**
   - Supported G/M codes

---

## 5. The Three Numbering Systems [CRITICAL]

**DDCS M350 uses three different numbering schemes - confusing them breaks code**:

| System | Example | Used Where | Notes |
|--------|---------|------------|-------|
| **ENG File** | #0, #129, #880 | .eng backup files | Parameter storage |
| **UI Display** | Pr0, Pr129 | Controller screen | What you see |
| **Macro Address** | #500, #629, #880 | G-code macros | **What you write** |

**Process**: Check `DDCS_Variables_mapping_2025-01-04.xlsx` → "Macro Var" column = correct address

**Common pattern**: Pr[N] → #[N+500]  
**Example**: Pr129 (probe thickness) → #629 in code

**Important ranges**:
- #1-#999: Local (no priming needed)
- #805-#834: WCS offsets (no priming needed)
- #880-#884: Machine positions (read-only)
- #1153-#5999: User persistent (**REQUIRES PRIMING**)

**See**: `system-control-variables.md` for complete map

---

## 6. Authority Levels [Data Reliability]

| Tag | Confidence | Source | Use For |
|-----|------------|--------|---------|
| **[CONFIRMED]** | 100% | Production testing + firmware analysis | Critical operations |
| **[OBSERVED]** | 90% | Consistent on Ultimate Bee 1010 | Standard operations |
| **[HYPOTHESIS]** | 50% | Theory under verification | Experimental only |

**Agent Instruction**: Prefer [CONFIRMED]. Flag [HYPOTHESIS] for user validation.

---

## 7. Best Practices (Quick Reference)

### 7.1. Three-Phase Execution Model

**Every macro follows this pattern**:

```gcode
O1000 (Macro Name)

; ═══ PHASE 1: Safety & Priming ═══
#100 = 0          ; Initialize
#100 = #880       ; Prime system vars
IF #880==0 GOTO1  ; Check if homed (no brackets, no space)

; ═══ PHASE 2: Execution ═══
#target = #100 + 50
#var = 0
G53 G0 X#target   ; Use G53 with variable
IF #target>500 GOTO2  ; C-style, no space in GOTO

; ═══ PHASE 3: Validation & Restore ═══
#1505=-5000(Success!)
GOTO3             ; Jump past errors

; Error handlers
N1
#1505=1(Not homed!)
GOTO3
N2
#1505=1(Target out of range!)

; End
N3
#2100 = 0         ; Prime persistent
#2100 = #result   ; Safe assignment
G90               ; Restore modal
M30
```

**See**: `software-technical-spec.md` §4 for complete explanation

---

### 7.2. Critical Rules (Quick Checklist)

```
❌ NEVER:
- #1153 = #880                (freeze bug)
- G10 L2 P1 X0 Y0 Z0          (broken)
- G28 Z0                      (not machine zero)
- IF #100 EQ 5 GOTO100        (unreliable)
- G53 G0 X0                   (needs variable)
- IF [#var!=2] GOTO1          (no brackets on simple IF)
- GOTO 1                      (no space before label)

✅ ALWAYS:
- #100 = #880, #1153 = #100   (prime first)
- #805 = #880                 (direct WCS write)
- #var = 0, G53 G0 Z#var      (use variable)
- IF #100 == 5 GOTO100        (C-style operators)
- IF #var!=2 GOTO1            (no brackets on simple IF)
- GOTO1                       (no space before label)
- Use N1-N99 labels           (single/double digit preferred)
- GOTO past errors            (success jumps to end)
- For popup `#1505` text, use `/` for line breaks (e.g. `#1505=1(Row1 /Row2 /Row3)`)
```

---

## 8. Getting Started Workflow

**For any new macro project**:

```
Step 1: Read CORE_TRUTH.md
   ↓
Step 2: Find similar example in example-macros/
   ↓
Step 3: Check software-technical-spec.md for execution model
   ↓
Step 4: Check hardware-integration-spec.md if using I/O
   ↓
Step 5: Copy example as template
   ↓
Step 6: Follow three-phase structure
   ↓
Step 7: Prime persistent variables
   ↓
Step 8: Use C-style operators only
   ↓
Step 9: Test on machine
   ↓
Step 10: Document in user-tested-patterns.md
```

---

## 9. Skill Statistics

**Documentation**: 27 guides (16 split into focused parts)  
**Example Macros**: 26 production-tested .nc files (including corner_finder_FINAL.nc ⭐)  
**Total Lines**: ~15,000 lines  
**Largest File**: 864 lines (hardware-config.md)  
**All Split Parts**: Under 650 lines  
**Authority**: 90%+ [CONFIRMED] on core content

**Complete Coverage**:
- ✅ Firmware V1.22 reference
- ✅ Ultimate Bee 1010 hardware
- ✅ All MacroB patterns
- ✅ Dual-gantry auto-squaring
- ✅ Probe routines (4 methods)
- ✅ WCS workarounds
- ✅ I/O troubleshooting
- ✅ Variable priming
- ✅ Virtual buttons
- ✅ Fusion post-processor

---

## 10. File Organization Summary

**Quick References** (Start here):
- hardware-integration-spec.md (475 lines) - [CONFIRMED]
- software-technical-spec.md (480 lines) - [CONFIRMED]
- CORE_TRUTH.md (571 lines) - [CONFIRMED]

**Split Series** (Organized by topic):
- Community Patterns: 6 parts, indexed
- Dual-Gantry: 3 parts, indexed
- Display Methods: 2 parts, indexed

**Everything Else** (Use as needed):
- Language reference (syntax, variables, priming)
- Hardware specs (machine config, probes, I/O)
- User-specific (your patterns, calibration, post-processor)
- Example macros (25 working .nc files)
- Lookup tables (spreadsheets for addresses/codes)

**Navigation**: All split series have index files with quick access links. Start with Part 1, follow links.

---

## 11. Quick Command Reference

**Correct patterns**:
```gcode
; WCS offset management (G10 broken)
#805 = #880   ; G54 X offset (direct write)

; Machine zero (G28 not machine zero)
#z = 0
G53 G0 Z#z    ; True machine zero (requires variable)

; Variable priming (prevents freeze)
#100 = #880
#1153 = #100  ; Safe assignment

; Operators (C-style only)
IF #100==5 GOTO1      ; No brackets on simple condition
IF #100!=0 GOTO2      ; No space before label
IF [#a+#b]>50 GOTO3   ; Brackets for expressions

; Program flow
#1505=-5000(Success!)
GOTO2          ; Jump past errors
N1             ; Error label
#1505=1(Failed!)
N2             ; End label
M30
```

**See**: `conditional-syntax-card.md` for complete IF/GOTO rules  
**See**: `software-technical-spec.md` for all patterns

---

## 12. Need Help?

**Can't find what you need?**

1. Check Section 3 (Quick Decision Tree)
2. Start with quick references (Section 4.1)
3. Browse example-macros/ directory
4. Search CORE_TRUTH.md for quirks
5. Check split series indexes for organized topics

**Remember**: Example macros are better than docs. Find similar example first, then consult references.

---

**Skill Version**: 2.0 (Agent-Optimized)  
**Last Updated**: January 2026  
**Firmware**: V1.22 Verified  
**Status**: ✅ Production-Ready
