# Example Macros - Working .nc Files

**⭐ START HERE: These examples are your BEST learning resource for DDCS M350 programming ⭐**

## Why Start Here?

These are **real production macros** running on actual CNC machines. They show:
- ✅ Syntax that actually works (C-style operators: `==`, `!=`, `<`, `>`)
- ✅ Proper G53 usage (with variables, not constants)
- ✅ Variable priming patterns (prevents freeze bugs)
- ✅ Error handling and safety checks
- ✅ Real-world problem solving
- ✅ Quirk workarounds implemented correctly

**Learning workflow:**
1. **Find a similar example** to what you want to create
2. **Read and understand** the working code
3. **Copy as your template** - Don't start from scratch!
4. **Modify** for your specific needs
5. **Test incrementally** - Air tests first
6. **Consult documentation** only when you need to understand *why*

**Trust the examples over documentation** - If an example does it differently than docs say, the example is probably right.

---

This directory contains actual working macro files (.nc) tested on DDCS M350 systems. These are real production code examples that can be referenced when building new macros.

## Your Tested Macros (Fréderic's Ultimate Bee 1010)

### Position Saving

**SAVE_safe_park_position.nc**
- Saves current position to #1153-#1154 (safe park)
- Simple, proven pattern with priming
- Used by Fusion post-processor for end-of-job parking

**SAVE_tool_change_position.nc**
- Saves current position to #1155-#1156 (tool change)
- Optimized for manual tool access
- Alternative parking location

**SAVE_NATIVE_SYSTEM_FIXED_SENSOR_POSITION.nc**
- Saves current position to Pr135/Pr136 (#635-#636)
- Updates controller's built-in fixed probe parameters
- Uses buffer variables for safety

**SAVE_WCS_XY_AUTO.nc**
- Dynamically detects active WCS (G54-G59)
- Sets XY zero for currently active coordinate system
- Uses indirect addressing: `#[#103] = #101`
- Production-tested with all WCS

### Homing & Synchronization

**fndzero.nc**
- Complete homing sequence: Z→X→Y
- Syncs A-axis (Y2) after Y homing
- Sets A-axis homed flag (#1518)
- Production startup routine

**fndy.nc**
- Y-axis only rehoming
- Syncs A-axis without full homing sequence
- Quick re-sync after step loss

**sysstart.nc**
- Uses M115 built-in homing
- Alternative to manual M98P501 calls
- Includes A-axis sync after completion

### Spindle Control

**SPINDLE_WARMUP.nc**
- Progressive warmup: 6000→12000 RPM
- 30 seconds at each speed
- User confirmation dialog
- Prevents cold-start bearing damage

### Probing

**Note:** CAM macros (macro_cam10-13.nc) are configured for YunKia V6 probe on **IN03**. If using a different probe input, change line 9: `#16=3` to your probe input number.

**set_probe_radius.nc** ⭐ **RUN THIS FIRST**
- Sets persistent probe radius in #1170
- Used by both corner_finder and xy_fence_finder
- Configure once for your probe diameter
- Example: 2mm diameter probe = 1mm radius
- Survives power cycles (persistent storage)
- 15 lines - simple setup macro

**corner_finder_FINAL.nc** ⭐ **PERFECT SYNTAX EXAMPLE**
- Front-left corner finding with configurable probe radius
- Reads probe radius from #1170 (set by set_probe_radius.nc)
- Three-axis sequential probing: Z→X→Y
- **VERIFIED CORRECT IF/GOTO SYNTAX** - All 16 IF statements follow new rules
- **Correct radius compensation** - ADDS radius for inside corner probing
- **Dual-gantry sync** - Sets both Y (#806) and A (#808) offsets
- Two-pass approach (fast + slow) on each axis
- Safety checks after every move (probe trigger detection)
- Perfect error handling flow (GOTO past errors)
- Single-digit labels (N1, N2)
- Interactive user confirmation dialogs
- Sets G54 XYZ zero at found corner
- **USE THIS AS YOUR TEMPLATE for conditionals AND dual-gantry!**
- Production-tested on Ultimate Bee 1010 (January 2026)

**xy_fence_finder_FINAL.nc** ⭐ **FENCE REFERENCE SETUP**
- Finds X and Y fence positions for G54 reference
- Reads probe radius from #1170 (set by set_probe_radius.nc)
- Two-axis sequential probing: X→Y
- **Correct radius compensation** - SUBTRACTS radius for outside fence probing
- **Dual-gantry sync** - Sets both Y (#806) and A (#808) offsets
- Two-pass approach (fast + slow) on each axis
- Interactive user confirmation between axes
- Sets G54 XY fence reference positions
- Perfect for establishing machine reference points
- Production-tested on Ultimate Bee 1010 (January 2026)

**macro_cam10.nc**
- Surface finding with 3D touch probe
- Two-pass approach (fast + slow)
- Accounts for probe length offset
- Sets WCS Z zero automatically
- Configured for IN03 (YunKia V6)

**macro_cam11.nc**
- Hole center finding routine
- Four-direction probe (left, right, back, front)
- Optional double Y-scan for round features
- Calculates center, sets WCS XY zero
- Configured for IN03 (YunKia V6)

**macro_cam12.nc**
- Outer edge center finding with Z-scanning
- Advanced routine with collision detection
- Safe Z movements between probes
- X/Y axis enable/disable options
- Probes from outside-in approach
- Sets WCS XY zero to calculated center
- Configured for IN03 (YunKia V6)

**macro_cam13.nc**
- Single-edge finding with direction control
- Probe diameter compensation
- Bidirectional scanning (positive or negative direction)
- Useful for finding single edges or corners
- X/Y axis enable/disable options
- Sets calculated edge position to WCS
- Configured for IN03 (YunKia V6)

### Debugging & Testing

**READ_VAR.nc**
- Interactive variable inspector
- Uses #2070 for user input
- Displays variable address and value
- Indirect addressing: `#[#100]`

**PERSISTENCE_WRITE.nc**
- Tests which variable ranges survive reboot
- Writes unique values to 8 different ranges
- Run before power cycle

**PERSISTENCE_READ.nc**
- Reads values after power cycle
- Sequential display of all tested ranges
- Shows 0.00 for non-persistent ranges
- Comprehensive persistence verification

### Utility Macros

**Average_error.nc**
- Calculates arithmetic mean homing error
- Loops through axes 1-4
- Displays errors with format codes
- Identifies sensor problems

**Test_DA_with_relay.nc**
- Interactive dual-axis sensor testing
- Tests master, slave, and relay operation
- User input for port numbers
- Flashing relay test pattern

### Advanced Examples (Community)

**macro_Adaptive_Pocket.nc** ⭐ **ADVANCED TECHNIQUES**
- Adaptive rectangular pocket milling with corner radius support
- **Boolean OR operator**: Uses `+` to combine multiple conditions (line 58)
- **Dynamic G-code**: `G[53+#578]` saves active WCS, `G[3-#15]` for climb/conv
- **Advanced indirect addressing**: `#[21+#15]` runtime variable calculation
- **Complex expressions**: Multi-level nested math with brackets
- Automatic stepover calculation based on % overlap
- Climb (CCW) or conventional (CW) milling modes  
- Multi-pass Z-depth control with corner radius
- Optimizes by eliminating unnecessary movements
- **Study this macro to learn advanced MacroB patterns!**

**Table_leveling.nc**
- Surface milling with snake pattern
- G4P-1 interactive pause for setup
- Saves/restores soft limit state
- Complex coordinate calculation
- Progress display via #879+axis

**macro_through_a_pause.nc**
- Loop-based position memory
- G4P-1 for manual positioning
- Stores unlimited positions
- Playback with G53 machine coords

**macro_through_the_stop.nc**
- Alternative position memory method
- Uses M0 stops instead of G4P-1
- ESC/ENTER decision points
- Iterative position teaching

**Double_Y_double_zero_switch.nc**
- Basic dual-gantry homing (53 lines)
- Tests both Y-axis sensors separately
- Chinese comments (from community)
- Simple reference implementation

**macro_DA_without_relay_advanced.nc** ⭐ **PRODUCTION DUAL-GANTRY**
- Professional 348-line dual-axis auto-squaring system
- Three-stage alignment: Fast Feed → Pre-Alignment → Fine Alignment
- Multi-cycle averaging for precision (<0.01mm achievable)
- Error detection and statistics tracking
- Vibration settling, alignment correctors, safety checks
- Comprehensive configuration (20+ tunable parameters)
- **Requires firmware ≥30-03-2024**
- **See `dual-gantry-advanced.md` for complete documentation**
- **Best for**: Production CNC, precision work, badly-racked gantries

**Manual.nc**
- Documentation file (not executable)
- Describes other community macros
- Testing procedures
- Feature explanations

## Usage Patterns

### When to Reference These Macros

**Building position saving macro:**
→ Reference `SAVE_safe_park_position.nc` for pattern

**Setting up 3D probe:**
→ **FIRST: Run `set_probe_radius.nc`** to configure your probe radius in #1170
→ Modify the radius value for your specific probe diameter
→ This persistent value is used by all probe macros

**Creating probe routine:**
→ **START WITH `corner_finder_FINAL.nc`** for perfect IF/GOTO syntax and inside corner probing
→ **USE `xy_fence_finder_FINAL.nc`** for fence reference with outside probing
→ Both read radius from #1170 (set once, use everywhere)
→ Reference `macro_cam10.nc`, `macro_cam11.nc`, `macro_cam12.nc`, or `macro_cam13.nc`

**Learning correct conditional syntax:**
→ **Study `corner_finder_FINAL.nc`** - all 16 IF statements use correct format

**Need variable inspection:**
→ Copy pattern from `READ_VAR.nc`

**Dual-gantry sync issue:**
→ Check `fndzero.nc` and `fndy.nc` for correct pattern

**Testing persistence:**
→ Use `PERSISTENCE_WRITE.nc` and `PERSISTENCE_READ.nc`

**Interactive workflow:**
→ Reference `macro_through_a_pause.nc` for G4P-1 usage

**Spindle warmup:**
→ Copy `SPINDLE_WARMUP.nc` structure

## Key Patterns Found in These Macros

### 1. Correct IF/GOTO Syntax ⭐ NEW
```gcode
; From corner_finder_FINAL.nc
IF #1922!=2 GOTO1      ; ✅ No brackets on simple condition
IF #1505==0 GOTO2      ; ✅ No space before label
GOTO2                  ; ✅ Success jumps past errors
N1                     ; ✅ Single-digit error label
#1505=1(Probe failed)
N2                     ; ✅ Single-digit end label
M30
```

### 2. Dual-Gantry WCS Sync ⭐ NEW
```gcode
; From corner_finder_FINAL.nc - After finding Y edge
#806=#104        ; Set Y offset (G54)
#808=#104        ; Set A offset (G54) - sync dual gantry!
; Critical: Both Y and A must have same work coordinate zero
```

### 3. Variable Priming
```gcode
#1153 = 1      ; Prime with 1 (not 0 - also works!)
#1154 = 1
#1153 = #880   ; Safe to assign system variable
```

### 4. Active WCS Detection
```gcode
#100 = #578                    ; Get active WCS (1-6)
#103 = 805 + [#100 - 1] * 5    ; Calculate offset address
#[#103] = #880                 ; Indirect write
```

### 5. Dual-Gantry Homing Sync
```gcode
M98P501X1      ; Home Y
#883 = #881    ; Sync A to Y
#1518 = 1      ; Mark A as homed
```

### 6. Two-Pass Probe
```gcode
G31 Z-50 F200           ; Fast
IF #1922 == 0 GOTO 999
#20 = #1927             ; Store trigger
G53 Z[#20 + 1]          ; Retract
G31 Z-2 F20             ; Slow precise
```

### 7. G4P-1 Interactive Pause
```gcode
G4P-1
G1
;Move to position
;and press START
#1577 = #882   ; Capture position after START
```

### 8. User Input
```gcode
#2070 = 100(Enter variable #:)
#1510 = #100           ; The number entered
#1511 = #[#100]        ; Indirect read
#1505 = -5000(#[%.0f] = [%.3f])
```

### 9. Format Code Display
```gcode
#1510 = #880
#1511 = #881
#1512 = #882
#1505 = -5000(X=[%.3f] Y=[%.3f] Z=[%.3f])
```

### 10. Loop-Based Position Storage
```gcode
WHILE #100 < #200 DO1
    #100 = #100 + 1
    G53 X#[2200 + #100] Y#[2300 + #100]
END1
```

## File Organization

**Your macros** (Fréderic's tested on Ultimate Bee 1010):
- set_probe_radius.nc ⭐ (configure persistent probe radius - run this first!)
- corner_finder_FINAL.nc ⭐ (perfect IF/GOTO syntax example - 16 conditionals, all correct)
- xy_fence_finder_FINAL.nc ⭐ (fence reference setup with correct compensation)
- All SAVE_*.nc files
- fndzero.nc, fndy.nc, sysstart.nc
- SPINDLE_WARMUP.nc
- READ_VAR.nc
- PERSISTENCE_*.nc

**Community macros** (proven on other M350 systems):
- macro_Adaptive_Pocket.nc ⭐ (advanced patterns - boolean OR, dynamic G-code, indirect addressing)
- macro_DA_without_relay_advanced.nc ⭐ (production dual-gantry auto-squaring, 348 lines)
- macro_cam*.nc (probe routines)
- Table_leveling.nc (surface milling)
- macro_through_*.nc (position memory)
- Average_error.nc (diagnostics)
- Test_DA_*.nc (sensor testing)
- Double_Y_*.nc (dual-gantry basic)

## Integration with Skill

These macros are referenced throughout the skill documentation:

- **user-tested-patterns.md** - Documents your macros with explanations
- **community-patterns.md** - Documents community macros with patterns
- **SKILL.md** - Provides quick reference examples
- **fusion-post-processor.md** - Uses SAVE position patterns

## Testing Status

✅ **Production-tested**: All SAVE_*.nc, fndzero.nc, fndy.nc, SPINDLE_WARMUP.nc
✅ **Community-proven**: macro_Adaptive_Pocket.nc, macro_DA_without_relay_advanced.nc, macro_cam*.nc, Table_leveling.nc
✅ **Diagnostic tools**: READ_VAR.nc, PERSISTENCE_*.nc, Average_error.nc
✅ **Advanced examples**: macro_through_*.nc, Double_Y_*.nc
⚠️ **Work in Progress**: squaring-macro-WIP-log.md (development tracking)

## Important Notes

1. **Encoding**: All files use UTF-8 without BOM
2. **Line endings**: Mix of CRLF and LF (both work on M350)
3. **Comments**: Some use `//`, some use `;`, both work
4. **Language**: Some community macros have Chinese comments
5. **Tested**: Your macros tested on ballscrew/LGR Ultimate Bee 1010
6. **Community**: Other macros tested on various M350 systems

## How to Use

**Copy pattern directly:**
```gcode
; Copy the entire SAVE_safe_park_position.nc pattern
; Modify variable numbers if needed
```

**Extract technique:**
```gcode
; Take the G4P-1 pattern from Table_leveling.nc
; Apply to your own macro
```

**Learn from structure:**
```gcode
; Study SPINDLE_WARMUP.nc for user confirmation
; Study macro_cam11.nc for complex probe logic
```

**Debug reference:**
```gcode
; Compare your macro to working examples
; Check variable usage, priming, sync patterns
```

These are real, working files - not theoretical examples. They represent battle-tested solutions to common DDCS M350 programming challenges.

## Advanced Community Macro

21. **macro_Thread_milling.nc** - Cylindrical thread milling macro (by Nikolay Zvyagintsev)
    - Internal and external threads
    - Configurable thread parameters
    - Progressive depth cutting
    - Chamfering options
    - Finishing passes
    - Through-cutting support
    - Safety checks and simulation
    - Production-tested advanced example

