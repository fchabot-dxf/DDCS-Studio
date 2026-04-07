# System Control Variables (1930-1999)

**Advanced system variables** for controlling panel LEDs, one-key probe, and system features.

**Source**: DDCS_Variables_mapping_2025-01-04.xlsx official mapping

**⚠️ WARNING**: These are system-level variables. Incorrect use may cause unexpected behavior!

---

## Key Indicator LED Control (1930-1961)

**Control front panel button LEDs programmatically.**

### LED Control Variables

| Variable | Button | Status |
|----------|--------|--------|
| #1930 | Key Indicator 1 | ⚠️ Not working |
| #1931 | Key Indicator 2 | Error LED |
| #1932 | Key Indicator 3 | Run LED |
| #1933 | Key Indicator 4 | USB LED |
| #1934 | Key Indicator 5 | ESC LED |
| #1935 | Key Indicator 6 | UP LED |
| #1936 | Key Indicator 7 | ENTER LED |
| #1937 | Key Indicator 8 | LEFT LED |
| #1938 | Key Indicator 9 | DOWN LED |
| #1939 | Key Indicator 10 | RIGHT LED |
| #1940 | Key Indicator 11 | High/Low Speed LED |
| #1941 | Key Indicator 12 | Axis 5- LED |
| #1942 | Key Indicator 13 | Brake Point Resume LED |
| #1943 | Key Indicator 14 | Axis 5+ LED |
| #1944 | Key Indicator 15 | K1 LED |
| #1945 | Key Indicator 16 | K2 LED |
| #1946 | Key Indicator 17 | K3 LED |
| #1947 | Key Indicator 18 | K4 LED |
| #1948 | Key Indicator 19 | K5 LED |
| #1949 | Key Indicator 20 | K6 LED |
| #1950 | Key Indicator 21 | K7 LED |
| #1951 | Key Indicator 22 | SPINDLE LED |
| #1952 | Key Indicator 23 | TruCut LED |
| #1953 | Key Indicator 24 | CONT STEP MPG LED |
| #1954 | Key Indicator 25 | START LED |
| #1955 | Key Indicator 26 | PAUSE LED |
| #1956 | Key Indicator 27 | RESET LED |
| #1957-1961 | Key Indicators 28-32 | ⚠️ Not working |

### LED Control Values

**Typical values** (may vary by controller version):
- `0` = LED off
- `1` = LED on
- Other values may control brightness or blink patterns (undocumented)

### Example Usage

**Flash K1 LED to indicate macro running:**
```gcode
(Flash K1 LED during operation)
#1944 = 1     ; Turn K1 LED on
G04 P500      ; Wait 0.5 seconds
#1944 = 0     ; Turn K1 LED off
G04 P500
#1944 = 1     ; Flash again
```

**Indicate error state:**
```gcode
(Turn on error LED)
#1931 = 1     ; Error LED on
#1505 = 1(ERROR: Check machine!)
```

**Custom status indicators:**
```gcode
(Use K2 to show probing active)
#1945 = 1     ; K2 LED on = probing
; ... probe routine ...
#1945 = 0     ; K2 LED off = probe complete
```

**⚠️ Note**: LED control may be limited during certain controller states. Test before relying on in production.

---

## Reserved Range (1962-1969)

**#1962-#1969** - System reserved, no documented function

---

## One-Key Probe Tool Numbers (1970-1989)

**Tool numbers for automated one-key probe routines.**

These variables store which tool number is associated with each one-key probe button/routine.

| Variable | Probe Routine | Description |
|----------|---------------|-------------|
| #1970 | One Key Probe 1 | Tool number for routine 1 |
| #1971 | One Key Probe 2 | Tool number for routine 2 |
| #1972 | One Key Probe 3 | Tool number for routine 3 |
| #1973 | One Key Probe 4 | Tool number for routine 4 |
| #1974 | One Key Probe 5 | Tool number for routine 5 |
| #1975 | One Key Probe 6 | Tool number for routine 6 |
| #1976 | One Key Probe 7 | Tool number for routine 7 |
| #1977 | One Key Probe 8 | Tool number for routine 8 |
| #1978 | One Key Probe 9 | Tool number for routine 9 |
| #1979 | One Key Probe 10 | Tool number for routine 10 |
| #1980 | One Key Probe 11 | Tool number for routine 11 |
| #1981 | One Key Probe 12 | Tool number for routine 12 |
| #1982 | One Key Probe 13 | Tool number for routine 13 |
| #1983 | One Key Probe 14 | Tool number for routine 14 |
| #1984 | One Key Probe 15 | Tool number for routine 15 |
| #1985 | One Key Probe 16 | Tool number for routine 16 |
| #1986 | One Key Probe 17 | Tool number for routine 17 |
| #1987 | One Key Probe 18 | Tool number for routine 18 |
| #1988 | One Key Probe 19 | Tool number for routine 19 |
| #1989 | One Key Probe 20 | Tool number for routine 20 |

**Purpose**: Associates tool numbers with automated probe routines for quick tool setting.

**Example:**
```gcode
; Set tool 5 to use one-key probe routine 3
#1972 = 5
```

**Note**: Functionality depends on having one-key probe feature configured in controller parameters.

---

## System Feature Control (1990-1999)

### Reserved (#1990)

**#1990** - System reserved

### System Mode (#1991) - READ ONLY

**#1991** - Current system operating mode

**Purpose**: Indicates what mode the controller is in

**⚠️ Read-only** - marked "N" (not writable)

### Homing Configuration (#1992)

**#1992** - Home function enabled

**Status**: ⚠️ Does not work anymore (deprecated in current firmware)

**Historical**: Previously enabled/disabled homing function

### Probe After Tool Change (#1993)

**#1993** - Probe enabled after tool change

**Values:**
- `0` = Disabled (no automatic probing after tool change)
- `1` = Enabled (automatically probe after tool change)

**Use case**: Automatic tool length measurement after manual tool changes

**Example:**
```gcode
; Enable auto-probe after tool change
#1993 = 1

; Change tool
M6 T2

; Controller automatically runs probe routine
; Tool length offset updated
```

### RTCP Control (#1994)

**#1994** - RTCP (Rotation Tool Center Point) Enable/Disable

**Values:**
- `0` = RTCP disabled
- `1` = RTCP enabled

**Purpose**: Enables/disables rotation tool center point compensation for 4/5-axis machining

**Advanced feature** - only relevant for multi-axis machines

### Maximum Axis Count (#1995)

**#1995** - Current Max Axis Number

**Purpose**: Indicates how many axes are configured on the controller

**Typical values:**
- `3` = 3-axis (X, Y, Z)
- `4` = 4-axis (X, Y, Z, A)
- `5` = 5-axis (X, Y, Z, A, B)

**⚠️ READ ONLY** - Reports configuration, do not modify

### Custom M-Code Variable (#1996)

**#1996** - Self-define M code Temporary variables

**Purpose**: Temporary storage for custom M-code numbers

**Description**: "Custom M code number temporary variable"

**Use**: May be used internally by controller when processing user-defined M-codes

### Manual Operation Custom Keys (1997-1999)

**Manual mode custom key status indicators:**

| Variable | Key | Description |
|----------|-----|-------------|
| #1997 | Key 1 | Manual operation self-define key 1 status |
| #1998 | Key 2 | Manual operation self-define key 2 status |
| #1999 | Key 3 | Manual operation self-define key 3 status |

**Purpose**: Track state of user-programmable keys in manual mode

**Possible values:**
- `0` = Key not pressed / inactive
- `1` = Key pressed / active

**Use case**: Create custom manual mode macros that respond to key presses

---

## Usage Guidelines

### LED Control Best Practices

**DO:**
- ✅ Use for visual feedback during long operations
- ✅ Flash LEDs to indicate status changes
- ✅ Turn on error LED when macro fails
- ✅ Test LED behavior on your specific controller

**DON'T:**
- ❌ Rely on LEDs for critical safety functions
- ❌ Assume LED behavior is identical across controller versions
- ❌ Modify system indicator LEDs (RUN, ERROR) during critical operations

### One-Key Probe Tool Numbers

**Configuration workflow:**
1. Set tool number in variable: `#1970 = 1` (Tool 1 uses routine 1)
2. Configure probe routine parameters in controller
3. Execute one-key probe from controller interface
4. Tool length offset automatically updated

### System Features

**Enable auto-probe after tool change (manual tool changing workflow):**
```gcode
(Auto-probe setup for manual tool changes)
#1993 = 1     ; Enable probe after tool change

; In your program:
M6 T1
; Controller automatically probes and sets tool offset
```

**Check axis configuration:**
```gcode
(Verify machine has 4th axis)
IF #1995 >= 4 GOTO 10
#1505 = 1(ERROR: 4th axis required!)
M30

N10
; Continue with 4-axis program
```

---

## Safety Warnings

**⚠️ CRITICAL:**
- Do NOT modify system mode variables unless you understand the implications
- LED control is for feedback only, not safety
- Auto-probe after tool change requires proper probe setup
- RTCP is advanced - incorrect configuration can cause crashes
- Always test new configurations on scrap material first

---

## Variable Summary by Function

**LED Control:** #1930-#1961 (32 indicators)  
**One-Key Probe:** #1970-#1989 (20 tool slots)  
**System Features:** #1991-#1999 (mode, probe, RTCP, custom keys)

**Total undocumented system variables in 1900s: 70 variables**

---

## See Also

- **G31 Probe Variables**: See `g31-probe-variables.md` for #1900-#1929
- **Variable Priming**: See `variable-priming-card.md` for initialization requirements
- **Display Methods**: See `ddcs-display-methods.md` for user feedback alternatives
- **Complete Variable Map**: See `DDCS_Variables_mapping_2025-01-04.xlsx` for all variables

---

**Remember**: These are system-level variables. When in doubt, read but don't write!
