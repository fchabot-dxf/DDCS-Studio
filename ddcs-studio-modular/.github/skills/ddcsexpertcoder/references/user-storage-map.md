# DDCS M350 User Storage Map - Complete Reference

**Quick reference for persistent variable allocation and usage**

This document provides a complete map of all available user storage on the DDCS M350/Expert controller, showing which variables are allocated, which are free, and which are system-reserved.

---

## Quick Summary

**Total Persistent Storage Available: 174 variables**

| Range | Count | Status | Purpose |
|-------|-------|--------|---------|
| #1153-#1193 | 41 vars | Mixed | Gap in system variables |
| #2039-#2071 | 33 vars | Free | User persistent storage |
| #2500-#2599 | 100 vars | Free | Large persistent block |
| **TOTAL** | **174 vars** | | |

**Non-Persistent (Temporary): #0-#499**

---

## Detailed Storage Map

### Range #1153-#1193 (41 Variables)

**Location**: Gap between system variables  
**Status**: Verified persistent (survives reboot)  
**Your Current Allocation**:

| Variables | Function | Status | Set By |
|-----------|----------|--------|--------|
| #1153 | Safe Park X | ✅ IN USE | SAVE_safe_park_position.nc |
| #1154 | Safe Park Y | ✅ IN USE | SAVE_safe_park_position.nc |
| #1155 | Tool Change X | ✅ IN USE | SAVE_tool_change_position.nc |
| #1156 | Tool Change Y | ✅ IN USE | SAVE_tool_change_position.nc |
| #1157-#1169 | Available | 🟢 FREE | 13 variables |
| #1170 | Probe Config 1 | 🟡 RESERVED | Reserved for probe settings |
| #1171 | Probe Config 2 | 🟡 RESERVED | Reserved for probe settings |
| #1172 | Probe Config 3 | 🟡 RESERVED | Reserved for probe settings |
| #1173 | Probe Config 4 | 🟡 RESERVED | Reserved for probe settings |
| #1174 | Probe Config 5 | 🟡 RESERVED | Reserved for probe settings |
| #1175 | Probe Config 6 | 🟡 RESERVED | Reserved for probe settings |
| #1176-#1193 | Available | 🟢 FREE | 18 variables |

**Total in this range:**
- In Use: 4 variables
- Reserved: 6 variables  
- Available: 31 variables

---

### Range #2039-#2071 (33 Variables)

**Location**: Persistent range between system variables  
**Status**: Verified working (community-tested)  
**Source**: DDCS_Variables_mapping_2025-01-04.xlsx (unmarked "S" range)

| Variables | Status | Notes |
|-----------|--------|-------|
| #2039-#2041 | 🟢 FREE | Available for any use |
| #2042 | 🟡 SYSTEM | Beep sound control (community-discovered) |
| #2043-#2071 | 🟢 FREE | Available for any use |

**Total in this range:**
- System: 1 variable (#2042 beep)
- Available: 32 variables

**Best uses:**
- Configuration settings
- Calibration values
- User preferences
- Moderate-size data sets

---

### Range #2500-#2599 (100 Variables)

**Location**: Large persistent block  
**Status**: ✅ **VERIFIED PERSISTENT** - Confirmed in DDCS_Variables_mapping_2025-01-04.xlsx (01-04-2025)  
**Note**: Earlier XLSX versions incorrectly marked as "does not work" - updated file confirms status 'B' (persisted after reboot)

| Variables | Status | Notes |
|-----------|--------|-------|
| #2500-#2599 | 🟢 FREE | All 100 variables - OFFICIALLY VERIFIED |

**Total in this range:**
- Available: 100 variables

**Official confirmation:**
- DDCS_Variables_mapping_2025-01-04.xlsx (01-04-2025): Status 'B' = "persisted after reboot"
- User testing: Confirmed working
- Production verified: Safe for use

**Best uses:**
- Lookup tables
- Large data arrays
- Position arrays
- Calibration matrices
- Multi-point measurements
- Tool offset tables

**Example - 10-point calibration:**
```gcode
; Store 10 XY calibration points
#2500 = X1  ; Point 1 X
#2501 = Y1  ; Point 1 Y
#2502 = X2  ; Point 2 X
#2503 = Y2  ; Point 2 Y
; ... up to Point 10
#2518 = X10
#2519 = Y10
```

---

## System Variables (Read-Only or Reserved)

**Do NOT use for storage** - these have specific controller functions:

| Range | Purpose |
|-------|---------|
| #0-#499 | Non-persistent user variables (reset on reboot) |
| #500-#999 | Parameter mirrors (Pr# + 500 = #variable) |
| #1000-#1152 | System variables (see DDCS_Variables_mapping_2025-01-04.xlsx) |
| #1194-#1509 | System variables (see DDCS_Variables_mapping_2025-01-04.xlsx) |
| #1510-#1513 | Display variables (for #1503/#1505 formatting) |
| #2000-#2038 | System variables (function keys, etc.) |
| #2037 | Virtual button control |
| #2042 | Beep sound control |
| #2072-#2079 | Function key indicators (K1-K8) |

---

## Recommended Allocation Strategy

### Small Projects (1-10 Variables)

**Use #1157-#1169** (13 available):
```gcode
#1157 = value1    ; Custom setting 1
#1158 = value2    ; Custom setting 2
#1159 = value3    ; Custom setting 3
```

**Advantages:**
- Close to your existing allocations (#1153-1156)
- Easy to remember
- Proven persistent range

---

### Medium Projects (10-30 Variables)

**Use #2039-#2071** (32 available, skip #2042):
```gcode
#2039 = config1   ; Configuration value 1
#2040 = config2   ; Configuration value 2
#2041 = config3   ; Configuration value 3
; Skip #2042 (beep sound)
#2043 = config4   ; Configuration value 4
```

**Advantages:**
- Contiguous block
- Separate from #1153+ range
- No conflicts with existing allocations

---

### Large Projects (30-100 Variables)

**Use #2500-#2599** (100 available):
```gcode
; Lookup table example
#2500 = entry1
#2501 = entry2
; ... up to
#2599 = entry100
```

**Advantages:**
- Largest single block
- Perfect for arrays
- Indexed access easy: #[2500 + index]

---

### Mixed Projects (100+ Variables)

**Use all three ranges:**

```gcode
; Critical settings (#1153-1193)
#1157 = master_enable
#1158 = safety_mode
#1159 = spindle_max

; Configuration (#2039-#2071)
#2039 = feedrate_profile
#2040 = acceleration_profile
#2043 = tool_library_version

; Large data (#2500-#2599)
#2500 = tool_offset_1
#2501 = tool_offset_2
; ... tool offset table
#2550 = position_array_start
; ... position array
```

---

## Variable Naming Best Practice

**Always comment your allocations!**

**Good practice:**
```gcode
;=== PERSISTENT STORAGE ALLOCATION ===
#1157 = 0    ; Material thickness
#1158 = 0    ; Spoilboard Z offset
#1159 = 0    ; Fixture height
#1160 = 0    ; Custom tool length
```

**Even better - create allocation macro:**
```gcode
O9000
;=== STORAGE MAP - DO NOT MODIFY ===
;
; #1153 - Safe park X (SAVE_safe_park_position.nc)
; #1154 - Safe park Y (SAVE_safe_park_position.nc)
; #1155 - Tool change X (SAVE_tool_change_position.nc)
; #1156 - Tool change Y (SAVE_tool_change_position.nc)
; #1157 - Material thickness (custom)
; #1158 - Spoilboard Z (custom)
; #1159 - Fixture height (custom)
;
; #2500-2549 - Tool offset table (50 tools)
; #2550-2599 - Position calibration array (50 points)
;
M30
```

---

## Access Patterns

### Direct Access
```gcode
#1157 = 42.5      ; Store value
#100 = #1157      ; Retrieve value
```

### Indexed Access (Arrays)
```gcode
; Store tool offsets
#tool_number = 5
#[2500 + #tool_number] = 0.125   ; Store offset for tool 5

; Retrieve tool offset
#offset = #[2500 + #tool_number]  ; Get offset for tool 5
```

### Computed Access
```gcode
; Store calibration points
#point = 3        ; Point number
#[2500 + #point*2] = X_value      ; X coordinate
#[2501 + #point*2] = Y_value      ; Y coordinate

; Retrieve point
#x = #[2500 + #point*2]
#y = #[2501 + #point*2]
```

---

## Collision Prevention

**Before allocating new variables:**

1. ✅ Check this storage map
2. ✅ Document your allocation
3. ✅ Avoid overlapping ranges
4. ✅ Comment your code
5. ✅ Test persistence (power cycle)
6. ✅ Update your storage map document

**Collision example (BAD):**
```gcode
; Macro A uses #1157-1160 for tool data
; Macro B uses #1158-1162 for position data
; #1158, #1159, #1160 CONFLICT!
```

**Proper allocation (GOOD):**
```gcode
; Macro A uses #1157-1160 for tool data
; Macro B uses #1161-1164 for position data
; No conflicts!
```

---

## Testing Persistence

**Always verify before production use:**

```gcode
;=== Test macro ===
O9999

; Write test values
#1157 = 123.456
#2043 = 789.012
#2500 = 42.42

; Display
#1510 = #1157
#1511 = #2043
#1512 = #2500
#1505 = -5000(Written: [%.3f] [%.3f] [%.2f])

; Power cycle controller here

; Read back
#1510 = #1157
#1511 = #2043
#1512 = #2500
#1505 = -5000(Read back: [%.3f] [%.3f] [%.2f])

M30
```

**Expected result:** Values match before and after power cycle

---

## Variable Priming Requirement

**CRITICAL**: Persistent variables may not need priming, but best practice is to prime anyway.

**Conservative approach (recommended):**
```gcode
#1157 = 0         ; Prime first
#1157 = #880      ; Then assign system variable
```

**Evidence suggests persistent vars are pre-zeroed** (see variable-priming-card.md), but always prime for safety until thoroughly tested.

---

## Storage Capacity Planning

**How many variables do you need?**

| Project Type | Variables Needed | Recommended Range |
|-------------|------------------|-------------------|
| Simple position save | 2-6 | #1157-1162 |
| Multi-tool setup | 10-20 | #1157-1176 |
| Calibration array | 20-50 | #2500-2549 |
| Tool library | 50-100 | #2500-2599 |
| Position matrix | 100+ | #2500-2599 + #2039-2071 |
| Full system | 174 max | All three ranges |

---

## Example Allocations

### Example 1: Multi-Material Setup

```gcode
; Material thickness storage
#1157 = aluminum_thickness
#1158 = brass_thickness  
#1159 = steel_thickness
#1160 = plastic_thickness

; Spoilboard offsets
#1161 = zone1_Z
#1162 = zone2_Z
#1163 = zone3_Z
#1164 = zone4_Z

; Fixture heights
#1165 = fixture_A_height
#1166 = fixture_B_height
```

### Example 2: Tool Offset Library

```gcode
; Tool offset table (50 tools)
; #2500 = Tool 1 offset
; #2501 = Tool 2 offset
; ...
; #2549 = Tool 50 offset

; Access pattern:
#tool_number = 5
#offset = #[2499 + #tool_number]  ; Get tool 5 offset
```

### Example 3: Workpiece Coordinate Storage

```gcode
; 25 saved workpiece origins (X, Y, Z)
; Origin 1: #2500 (X), #2501 (Y), #2502 (Z)
; Origin 2: #2503 (X), #2504 (Y), #2505 (Z)
; ...
; Origin 25: #2572 (X), #2573 (Y), #2574 (Z)

; Access pattern:
#origin_number = 5
#base = 2497 + #origin_number * 3
#X = #[#base]
#Y = #[#base + 1]
#Z = #[#base + 2]
```

---

## Backup and Recovery

**Best practice: Document your allocations externally**

Create a spreadsheet or text file:
```
DDCS M350 Storage Allocation - Ultimate Bee 1010
=================================================

RANGE #1153-1193:
#1153 - Safe park X (machine coordinates)
#1154 - Safe park Y (machine coordinates)
#1155 - Tool change X (machine coordinates)
#1156 - Tool change Y (machine coordinates)
#1157 - Aluminum plate thickness
#1158 - Brass plate thickness
...

RANGE #2500-2599:
#2500-2549 - Tool offset table (50 entries)
#2550-2574 - Workpiece origin table (25 origins, 3 coords each)
...
```

**Recovery procedure:**
1. Read values from controller (use READ_VAR.nc)
2. Record in spreadsheet
3. If controller reset, reprogram from spreadsheet

---

## Quick Reference Chart

```
PERSISTENT STORAGE MAP - DDCS M350
===================================

#1153 ████ Safe Park X
#1154 ████ Safe Park Y
#1155 ████ Tool Change X
#1156 ████ Tool Change Y
#1157 ░░░░ FREE (13 variables)
 ...
#1169 ░░░░
#1170 ▓▓▓▓ RESERVED Probe (6 variables)
 ...
#1175 ▓▓▓▓
#1176 ░░░░ FREE (18 variables)
 ...
#1193 ░░░░

#2039 ░░░░ FREE (3 variables)
 ...
#2041 ░░░░
#2042 ████ SYSTEM (Beep)
#2043 ░░░░ FREE (29 variables)
 ...
#2071 ░░░░

#2500 ░░░░ FREE (100 variables)
 ...
#2599 ░░░░

Legend:
████ In Use
▓▓▓▓ Reserved
░░░░ Available
```

---

## Storage Map Maintenance

**Update this map when you:**
- Allocate new persistent variables
- Change variable purposes
- Create new macros using storage
- Retire old functionality
- Find conflicts

**Keep in sync with:**
- Your macro library
- Setup documentation
- Machine-specific procedures
- Backup documentation

---

## Related Documents

- **variable-priming-card.md** - Variable initialization requirements
- **CORE_TRUTH.md** - Complete persistent storage rules
- **DDCS_Variables_mapping_2025-01-04.xlsx** - Official variable mapping
- **macrob-programming-rules.md** - MacroB syntax and best practices

---

**Last Updated**: January 2026  
**Controller**: DDCS M350 Expert V1.22  
**Machine**: Ultimate Bee 1010 Dual-Gantry

**Remember**: Always test persistence after allocation. Document everything. Avoid conflicts. Back up your data!
