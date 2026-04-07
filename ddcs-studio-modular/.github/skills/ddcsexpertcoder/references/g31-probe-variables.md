# G31 Probe System Variables (1900-1929)

**Complete reference** for G31 probe command variables on DDCS M350/Expert controllers.

**Source**: DDCS_Variables_mapping_2025-01-04.xlsx official mapping

**Note**: These are SYSTEM variables (marked "S") - read-only or automatically set by controller.

---

## CRITICAL: Probe Modes - What Gets Changed

The controller has **built-in probe routines** (O502 subroutine) with three modes controlled by **Pr1502**:

### **Mode 0: Floating Probe (Puck-Style)**
- **Changes**: ✅ WCS Z offset (G54/G55/etc)
- **Does NOT Change**: ❌ Tool offset
- **Use**: Find workpiece top surface
- **Storage**: Updates `#[807+[#578-1]*5]` (active WCS Z offset)
- **Calculation**: `WCS_Z = (Probe_Trigger - Puck_Thickness) - Tool_Offset`

### **Mode 1: Fixed Probe - First Use**
- **Changes**: ✅ WCS Z offset AND ✅ Tool offset
- **Use**: Establish work surface relative to fixed probe (run once per setup)
- **Storage**: Updates both WCS Z and `#[1430 + (Tool-1)]`
- **Calculation**: Sets reference tool length and work surface offset

### **Mode 2: Fixed Probe - Tool Change** ⭐ **(Most Common)**
- **Changes**: ✅ Tool offset ONLY
- **Does NOT Change**: ❌ WCS Z offset
- **Use**: Measure new tool lengths during tool changes
- **Storage**: Updates `#[1430 + (Current_Tool - 1)]` (tool offset array)
- **Calculation**: `Tool_Offset = Probe_Trigger_Position` (machine coordinate)

**Tool Offset Storage:**
- Real tools (T1-T20): `#[1430 + (Tool_Number - 1)]`
  - T1 → #1430, T2 → #1431, T5 → #1434, etc.
- Virtual tools (if configured): `#[1473 + (Tool_Number - Pr1301 - 1)]`

**Key Difference:**
- **Floating probe**: Moves your work zero to match the workpiece
- **Fixed probe (Mode 2)**: Keeps work zero, only updates tool lengths

---

## Homing vs Probing (Don't Confuse These!)

**Homing Routines** (fndZ.nc, fndzero.nc):
- Call `M98P501X#` (O501 subroutine)
- Find **limit switches** to establish machine zero
- Do NOT measure tools or workpieces
- Set axis homed flags (#1515-#1518)

**Probe Routines** (probe.nc, floating/fixed probe):
- Call `M98P502` (O502 subroutine)
- Measure tools or workpiece surfaces
- Use G31 command with probe input signals
- Update WCS offsets or tool offsets

**See Your Actual Firmware:**
- `firmware-backup-2025-12-31/SystemBak_19700101000156/nand1-1/slib-g.nc`
- Line 157: O501 (single-axis homing subroutine)
- Line 306: O502 (fixed/floating probe subroutine)
- Contains complete probe logic with all three modes (Pr1502: 0, 1, 2)

---

---

## G31 Configuration Variables (1900-1919)

### Probe Signal Port Assignment (1900-1904)

| Variable | Axis | Description |
|----------|------|-------------|
| #1900 | X | G31 X axis detecting signal number (port) |
| #1901 | Y | G31 Y axis detecting signal number (port) |
| #1902 | Z | G31 Z axis detecting signal number (port) |
| #1903 | A | G31 4th axis detecting signal number (port) |
| #1904 | B | G31 5th axis detecting signal number (port) |

**Example**: Set probe port for Z-axis
```gcode
#1902 = 12  ; Use input port 12 for Z-axis probing
```

### Stop Mode Configuration (1905-1909)

| Variable | Axis | Values |
|----------|------|--------|
| #1905 | X | 0 = Decelerate to stop, 1 = Emergency stop |
| #1906 | Y | 0 = Decelerate to stop, 1 = Emergency stop |
| #1907 | Z | 0 = Decelerate to stop, 1 = Emergency stop |
| #1908 | A | 0 = Decelerate to stop, 1 = Emergency stop |
| #1909 | B | 0 = Decelerate to stop, 1 = Emergency stop |

**Recommendation**: Use 0 (decelerate) for normal probing to avoid shock/damage.

### Signal Polarity (1910-1914)

| Variable | Axis | Values |
|----------|------|--------|
| #1910 | X | 0 = Normally Open (NO), 1 = Normally Closed (NC) |
| #1911 | Y | 0 = Normally Open (NO), 1 = Normally Closed (NC) |
| #1912 | Z | 0 = Normally Open (NO), 1 = Normally Closed (NC) |
| #1913 | A | 0 = Normally Open (NO), 1 = Normally Closed (NC) |
| #1914 | B | 0 = Normally Open (NO), 1 = Normally Closed (NC) |

**Match your probe type:**
- Touch probes (puck style): Usually NO (0)
- Tool setters: Check manufacturer specs

### Limit Behavior During Probing (1915-1919)

| Variable | Axis | Values |
|----------|------|--------|
| #1915 | X | 0=Ignore, 1=Enable negative (-), 2=Enable positive (+) |
| #1916 | Y | 0=Ignore, 1=Enable negative (-), 2=Enable positive (+) |
| #1917 | Z | 0=Ignore, 1=Enable negative (-), 2=Enable positive (+) |
| #1918 | A | 0=Ignore, 1=Enable negative (-), 2=Enable positive (+) |
| #1919 | B | 0=Ignore, 1=Enable negative (-), 2=Enable positive (+) |

**Safety modes:**
- **0 (Ignore)**: Probe can pass limit switches (dangerous!)
- **1 (Negative)**: Stop if negative limit triggered during probe
- **2 (Positive)**: Stop if positive limit triggered during probe

**Recommendation**: Always enable limit protection (1 or 2) in probe direction!

---

## G31 Result Variables (1920-1929)

### Probe Hit Status (1920-1924) - READ ONLY

| Variable | Axis | Values |
|----------|------|--------|
| #1920 | X | Probe result code |
| #1921 | Y | Probe result code |
| #1922 | Z | Probe result code |
| #1923 | A | Probe result code |
| #1924 | B | Probe result code |

**Result codes:**
- **0** = Did not probe (no G31 executed)
- **1** = Initialize (G31 started, waiting for signal)
- **2** = Detected signal (SUCCESS - probe triggered)
- **3** = Triggered negative limit signal (ERROR)
- **4** = Triggered positive limit signal (ERROR)

**Critical check after G31:**
```gcode
G31 Z-50 F200 P12 L0 Q0
IF #1922 == 0 GOTO 999   ; No probe executed
IF #1922 == 1 GOTO 999   ; Still initializing (shouldn't happen)
IF #1922 == 2 GOTO 10    ; SUCCESS!
IF #1922 == 3 GOTO 998   ; Hit negative limit
IF #1922 == 4 GOTO 997   ; Hit positive limit

N10
; Probe successful, continue...

N997
#1505 = 1(ERROR: Hit positive limit during probe!)
GOTO 999

N998
#1505 = 1(ERROR: Hit negative limit during probe!)
GOTO 999

N999
M30
```

### Probe Trigger Position (1925-1929) - READ ONLY

| Variable | Axis | Description |
|----------|------|-------------|
| #1925 | X | Machine coordinate when probe triggered |
| #1926 | Y | Machine coordinate when probe triggered |
| #1927 | Z | Machine coordinate when probe triggered |
| #1928 | A | Machine coordinate when probe triggered |
| #1929 | B | Machine coordinate when probe triggered |

**These are MACHINE coordinates, not WCS coordinates!**

**Example - Surface finding:**
```gcode
; Probe down to find surface
G31 Z-50 F200 P12 L0 Q0

IF #1922 != 2 GOTO 999   ; Check success

; Get trigger position
#100 = #1927             ; Z machine coordinate when triggered
#101 = #629              ; Probe puck thickness (Pr129)

; Calculate WCS Z offset
#102 = #100 - #101       ; Machine Z - thickness
#807 = #102              ; Set G54 Z offset

#1505 = -5000(Z zero set at [%.3f])
GOTO 1000

N999
#1505 = 1(Probe failed!)

N1000
M30
```

---

## Complete G31 Probe Example

**Two-pass precision probe with full error checking:**

```gcode
(=== G31 PROBE WITH FULL ERROR CHECKING ===)

;=== CONFIGURATION ===
#30 = 12        ; Probe port number
#31 = 0         ; Probe polarity (0=NO)
#32 = 200       ; Fast feedrate
#33 = 20        ; Slow feedrate
#34 = 50        ; Max probe distance
#35 = 0         ; Result position
#36 = 0         ; Puck thickness

;=== SETUP PROBE PARAMETERS ===
#1902 = #30     ; Z probe port
#1912 = #31     ; Z probe polarity
#1907 = 0       ; Z stop mode (decelerate)
#1917 = 1       ; Z enable negative limit

;=== FAST APPROACH ===
G91
G31 Z-[#34] F[#32] P[#30] L[#31] Q0

; Check result
IF #1922 == 0 GOTO 997   ; No probe
IF #1922 == 3 GOTO 996   ; Negative limit
IF #1922 == 4 GOTO 995   ; Positive limit
IF #1922 != 2 GOTO 997   ; Unknown error

#35 = #1927              ; Store position

;=== RETRACT ===
G0 Z2

;=== SLOW PRECISE PROBE ===
G31 Z-5 F[#33] P[#30] L[#31] Q0

; Check result
IF #1922 != 2 GOTO 997

#35 = #1927              ; Final trigger position
#36 = #629               ; Get puck thickness

;=== SET WCS Z ZERO ===
#100 = #35 - #36         ; Machine pos - thickness
#807 = #100              ; G54 Z offset

G0 Z10                   ; Retract safe
G90

#1505 = -5000(Z probe successful! Zero set.)
GOTO 1000

;=== ERROR HANDLING ===
N995
#1505 = 1(ERROR: Hit positive limit!)
GOTO 999

N996
#1505 = 1(ERROR: Hit negative limit!)
GOTO 999

N997
#1505 = 1(ERROR: Probe did not trigger!)
GOTO 999

N999
G90
M30

N1000
M30
```

---

## Probe Configuration Best Practices

**1. Always check probe result:**
```gcode
G31 ...
IF #1922 != 2 GOTO error
```

**2. Enable limit protection:**
```gcode
#1917 = 1  ; Enable negative limit for Z probing down
```

**3. Use decelerate stop mode:**
```gcode
#1907 = 0  ; Decelerate (safer than emergency stop)
```

**4. Two-pass for precision:**
```gcode
; Fast approach
G31 Z-50 F200 ...
; Retract
G0 Z2
; Slow precise
G31 Z-5 F20 ...
```

**5. Account for probe thickness:**
```gcode
#100 = #1927 - #629  ; Trigger position - puck thickness
```

---

## Common Probe Patterns

### Pattern 1: Simple Surface Finding

```gcode
G31 Z-50 F200 P12 L0
IF #1922 == 2 GOTO 10
#1505 = 1(Probe failed!)
M30

N10
#807 = #1927 - #629  ; Set Z zero
#1505 = -5000(Z zero set!)
M30
```

### Pattern 2: Hole Center (X-axis)

```gcode
; Probe left
G31 X-20 F100 P12 L0
IF #1922 != 2 GOTO 999
#10 = #1925  ; Left position

; Retract
G0 X5

; Probe right
G31 X20 F100 P12 L0
IF #1922 != 2 GOTO 999
#11 = #1925  ; Right position

; Calculate center
#12 = [#10 + #11] / 2

; Move to center
G53 X#12

N999
M30
```

### Pattern 3: Edge Finding

```gcode
; Approach from left
G31 X50 F100 P12 L0
IF #1922 != 2 GOTO 999

#100 = #1925  ; Edge position
#101 = 6.35   ; Probe radius

; Calculate edge
#102 = #100 - #101

; Set WCS X zero at edge
#805 = #102

N999
M30
```

---

## Troubleshooting

**Probe doesn't trigger:**
- Check #1920-#1924 result codes
- Verify port number (#1900-#1904)
- Check polarity (#1910-#1914)
- Test probe manually in IO screen

**Probe triggers immediately:**
- Wrong polarity (#1910-#1914)
- Check if NO/NC matches probe type
- Verify wiring

**Hits limit during probe:**
- Enable limit protection (#1915-#1919)
- Reduce probe distance
- Check start position

**Position incorrect:**
- Account for probe thickness (#629)
- Use machine coordinates (#1925-#1929)
- Check WCS offset calculation

---

## Summary

**Configuration (Setup once):**
- #1900-#1904: Probe port numbers
- #1905-#1909: Stop mode (0=decelerate)
- #1910-#1914: Polarity (0=NO, 1=NC)
- #1915-#1919: Limit behavior

**Results (Read after G31):**
- #1920-#1924: Hit status (2=success)
- #1925-#1929: Trigger position (machine coords)

**Always:**
- ✅ Check #1922 (or relevant axis) for success
- ✅ Use two-pass for precision
- ✅ Enable limit protection
- ✅ Account for probe geometry
- ✅ Handle errors gracefully

See also: `M350_instruction_description-G31.pdf` for official G31 command syntax.
