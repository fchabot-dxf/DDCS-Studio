# DDCS M350 Display & Feedback Methods
## Part 2: Advanced Methods & Examples

**📚 This is part of a 2-part series:**
- Part 1: [Core Display Methods](ddcs-display-methods-1-core.md)
- **Part 2: Advanced Methods & Examples** ← You are here
- Index: [Complete Series Guide](ddcs-display-methods.md)

---


1. **Format code syntax:** Use square brackets `[%.3f]` not bare `%.3f`
1. **Priming paradox:** Format displays may work WITHOUT priming (see Current_error.nc)
1. **Indirect addressing works:** `#[#var]` pattern proven in READ_VAR.nc
1. **G4P-1 interactive pause** enables manual steps within macros
1. **#1505 = -5000** displays message only (no response needed)
1. **#1505 = 1 or 2** waits for operator response
1. Comments inside dialog strings work: `#1505 = 1(message)`
1. **Sequential displays** update operator on multi-step progress

**Firmware variance:** These patterns are from working community macros (2022-2024 firmware). Test on your specific firmware version.

-----

## Summary

Your main display tools are:

- **#1505** for popup messages and confirmations
- **#2070** for user input (newer firmware) with indirect addressing
- **M0** for program pauses
- **G4P-1** for interactive manual steps (undocumented but proven)
- **Output ports** for external lights/buzzers
- **Persistent variables** for post-job data review

**Key discovery:** Format codes `[%.3f]` work reliably when syntax is correct, even with multiple values displayed simultaneously.

## Reference Macros

Working examples demonstrating these patterns:

- **Current_error.nc** - Multi-value display without priming
- **READ_VAR.nc** - User input + indirect addressing + formatted output
- **PERSISTENCE_READ.nc** - Sequential progress displays
- **Table_leveling.nc** - G4P-1 interactive pause
- **macro_cam10.nc, macro-cam12.nc** - Simple success/error messages
---

## Method 3: Audio Feedback (#2042)

**Beep/buzzer sound control** - Audio feedback for operator alerts and confirmations.

**Duration**: Value in **milliseconds**

**Basic syntax:**
```gcode
#2042 = 500    ; Beep for 500 milliseconds (0.5 seconds)
```

**Example - Confirmation beep:**
```gcode
#1153 = #880     ; Save position
#1154 = #881
#2042 = 500      ; Beep for 0.5 seconds to confirm
#1505 = -5000(Position saved!)
```

**Example - Pre-alert beep:**
```gcode
#2042 = 1000     ; Long beep (1 second warning)
#1505 = 1(Tool change required - Press ENTER when ready)
```

**Example - Multi-step feedback:**
```gcode
#2042 = 100      ; Short beep (0.1 seconds)
#1503 = 1(Step 1 complete)
G04 P1000

#2042 = 100      ; Short beep (0.1 seconds)
#1503 = 1(Step 2 complete)
G04 P1000

#2042 = 800      ; Long beep (0.8 seconds)
#1503 = 1(All steps complete!)
```

### Duration Guidelines

**Value = milliseconds of beep duration**

```gcode
#2042 = 100      ; Quick tap (0.1 sec) - routine confirmation
#2042 = 300      ; Short beep (0.3 sec) - step complete
#2042 = 500      ; Medium beep (0.5 sec) - save/load operation
#2042 = 1000     ; Long beep (1.0 sec) - important event
#2042 = 1500     ; Very long (1.5 sec) - warning/error
#2042 = 0        ; Silent (no beep)
```

**Recommended durations:**
- **50-150ms**: Quick acknowledgment taps
- **300-500ms**: Standard confirmations
- **800-1200ms**: Important events
- **1500-2000ms**: Warnings and errors
- **>2000ms**: Avoid (annoying to operator)

### Use Cases

**Operation confirmation:**
```gcode
; Save park position with short beep
#1153 = #880
#1154 = #881
#2042 = 300      ; Quick confirmation (0.3 seconds)
#1505 = -5000(Park position saved)
```

**Error alerts:**
```gcode
; Probe contact failure with long warning beep
IF #probe_failed == 1 GOTO error
; ... normal operation ...
GOTO done

N error
#2042 = 1500     ; Long alert beep (1.5 seconds)
#1505 = 1(ERROR: Probe contact failed!)
M30

N done
```

**Multi-step progress:**
```gcode
#2042 = 200      ; Quick beep (0.2 sec)
#1503 = 1(Homing X...)
M98 P1001

#2042 = 200      ; Quick beep (0.2 sec)
#1503 = 1(Homing Y...)
M98 P1002

#2042 = 500      ; Success beep (0.5 sec)
#1503 = 1(Homing complete!)
```

**Attention grabber:**
```gcode
; Before critical operation - series of beeps
#2042 = 300
G04 P0.5
#2042 = 300
G04 P0.5
#2042 = 800      ; Final longer beep
#1505 = 1(WARNING: Spindle about to start!)
G04 P2000
M03 S12000
```

**Countdown warning:**
```gcode
; 3-2-1 countdown with beeps
#1505 = -5000(Starting in 3...)
#2042 = 200
G04 P1000

#1505 = -5000(Starting in 2...)
#2042 = 200
G04 P1000

#1505 = -5000(Starting in 1...)
#2042 = 200
G04 P1000

#2042 = 500      ; Start beep
#1503 = 1(Operation started!)
```

---

## Method 4: Numeric Input Dialog (#2070)

**User input dialog** - Shows a dialog box where the operator can enter a numeric value.

**Unlike #1505** (which only has ENTER/ESC), this allows the user to **type a number** which gets stored in a variable.

**Storage range**: Values entered are stored in **#50-#499**

**Basic syntax:**
```gcode
#2070 = 100(Dialog Box Title: )
```

**Result**: 
- Dialog appears with title "Dialog Box Title:"
- User types a number
- Value is stored in **#100**
- Program continues after user presses ENTER

**Cannot display variables**: Unlike #1505, #2070 does **not** support `#1510-#1513` variable display in the prompt.

### Use Cases

**Ask for tool diameter:**
```gcode
#2070 = 50(Enter tool diameter in mm: )
#tool_diameter = #50     ; Store in descriptive variable
#1510 = #tool_diameter
#1503 = 1(Tool diameter set to: %.2f mm)
```

**Runtime depth setting:**
```gcode
#2070 = 51(Enter pocket depth: )
#depth = #51
#1510 = #depth
#1505 = -5000(Cutting to depth: %.1f mm)

; Use the depth value
G91
G01 Z-#depth F100
G90
```

**Custom offset entry:**
```gcode
#2070 = 100(Enter X offset for fixture: )
#2070 = 101(Enter Y offset for fixture: )

#fixture_x = #100
#fixture_y = #101

; Apply offsets
G10 L2 P1 X#fixture_x Y#fixture_y
#1505 = -5000(Fixture offset applied)
```

**Interactive calibration:**
```gcode
; Measure actual part size
#2070 = 200(Measure part X dimension and enter: )
#measured_x = #200

; Calculate error
#expected_x = 50.0
#error = #measured_x - #expected_x

#1510 = #error
#1503 = 1(Calibration error: %.3f mm)

; Store for future compensation
#1157 = #error     ; Save to persistent variable
```

**Tool length manual entry:**
```gcode
; Alternative to probe - manual tool length entry
#2070 = 150(Enter tool length (mm): )
#tool_length = #150

; Set tool offset
#629 = #tool_length     ; Pr129 - probe thickness parameter
#1510 = #tool_length
#1505 = -5000(Tool length set to: %.2f mm)
```

**Multi-value setup:**
```gcode
; Collect multiple parameters from operator
#2070 = 60(Enter part thickness: )
#2070 = 61(Enter material hardness (1-10): )
#2070 = 62(Enter desired finish pass depth: )

#thickness = #60
#hardness = #61
#finish_depth = #62

; Validate inputs
IF #thickness <= 0 THEN #1505 = 1(ERROR: Invalid thickness!)
IF #hardness < 1 THEN #1505 = 1(ERROR: Hardness too low!)
IF #hardness > 10 THEN #1505 = 1(ERROR: Hardness too high!)

; Use values in operation
#1510 = #thickness
#1511 = #hardness
#1512 = #finish_depth
#1503 = 1(Setup: T=%.1f H=%.0f F=%.2f)
```

**Safety check with numeric confirmation:**
```gcode
; Ask operator to confirm by entering a specific number
#1505 = -5000(To continue, enter 1234 in next dialog)
G04 P2000

#2070 = 80(Enter confirmation code: )
#code = #80

IF #code != 1234 GOTO abort

; Continue with operation
#1505 = -5000(Confirmed - continuing...)
GOTO continue

N abort
#1505 = 1(Operation cancelled - incorrect code)
M30

N continue
; ... rest of program
```

### Important Notes

**Variable range limitation:**
- Only variables **#50-#499** receive input values
- The variable number matches the message number: `#2070 = 150(...)` → stores in `#150`

**No format codes:**
- Cannot use `%.0f`, `%.2f` etc. in the prompt
- Cannot display variable values from #1510-#1513
- Prompt is text-only

**Input validation:**
- Always validate user input with IF statements
- Check for out-of-range values
- Provide clear error messages

**User experience:**
- Keep prompts short and clear
- Tell user what units to use (mm, inches, etc.)
- Explain what the number will be used for

---

## Method 5: Key Press Monitoring (#2038)

**Real-time keyboard/button monitoring** - Tracks button presses and releases during program execution.

**Returns**: Key code + press/release state (combined value)

**Must be cleared before use**: `#2038 = 0`

### How It Works

**Key code format:**
```
Full value = (Press_Status × 65536) + Key_Code

Where:
- Key_Code = (Button_Number - 1000)
- Press_Status = 0 (released) or 1 (pressed)
```

**Reading key presses:**
```gcode
#2038 = 0           ; Clear before monitoring
; ... wait for key press ...
#key_value = #2038  ; Read pressed key

; Extract key code and status:
; Bit 0-15: Key code (Button_Number - 1000)
; Bit 16: Press status (0=released, 1=pressed)
```

### Display Key Codes (Debugging Tool)

**Show any button press in real-time:**
```gcode
; Continuous key code display
#2038 = 0
N1
#1510 = #2038       ; Copy key code to display variable
#1503 = 1(Key code: %.0f)
G04 P0.02           ; 20ms delay
GOTO 1
```

**Use this to find any button's code on your controller**

### Use Cases

**Custom pause mechanism:**
```gcode
; Alternative pause - resumes when START button pressed
#2038 = 0           ; Clear
WHILE #2038 != 65864 DO1    ; Wait for START press (65864)
    G04 P0.001      ; 1ms delay
END1
; Program continues after START pressed
```

**Wait for any key press:**
```gcode
; Display message until operator presses any key
#1510 = 0.3456
#1511 = 10.5
#2038 = 0

WHILE #2038 == 0 DO30    ; Loop until any key pressed
    #1503 = -3000(Dimensions: X=[%.3f] || Y=[%.3f])
    G04 P0.1
END30

; Continue after key press
```

**Specific button detection:**
```gcode
; Wait for ENTER or ESC
#2038 = 0

N wait_key
#key = #2038

; Check for ENTER (code will vary by controller)
IF #key == 65537 GOTO enter_pressed

; Check for ESC  
IF #key == 65538 GOTO esc_pressed

; Still waiting
G04 P0.01
GOTO wait_key

N enter_pressed
#1505 = -5000(ENTER pressed - continuing...)
GOTO continue

N esc_pressed
#1505 = -5000(ESC pressed - aborting...)
M30

N continue
; ... rest of program
```

**Interactive display with exit:**
```gcode
; Show live coordinates until any key pressed
#2038 = 0

WHILE #2038 == 0 DO1
    #1510 = #880    ; Current X
    #1511 = #881    ; Current Y
    #1512 = #882    ; Current Z
    #1503 = -3000(Position: X[%.3f] Y[%.3f] Z[%.3f])
    G04 P0.1
END1

#1505 = -5000(Monitoring stopped)
```

**Button state detection:**
```gcode
; Detect press vs release
#2038 = 0

N check
#key = #2038

IF #key == 0 GOTO check    ; No key activity

; Extract press/release status
#is_pressed = INT[#key / 65536]    ; Bit 16

IF #is_pressed == 1 THEN #1503 = 1(Button PRESSED)
IF #is_pressed == 0 THEN #1503 = 1(Button RELEASED)

#2038 = 0    ; Clear for next detection
GOTO check
```

### Finding Button Codes

**Each controller may have different codes.** Use this test macro to find your button codes:

```gcode
O9999 (Button Code Finder)
; Press any button to see its code
#2038 = 0
#1505 = -5000(Press buttons to see their codes...)
G04 P2000

N loop
#1510 = #2038
#1503 = 1(Last key code: %.0f)
G04 P0.02
GOTO loop
```

**Record the codes for buttons you want to use:**
- START button
- STOP button  
- ENTER button
- ESC button
- Any custom buttons

### Important Notes

**Always clear before use:**
```gcode
#2038 = 0    ; MUST clear before monitoring
```

**Press and release are different codes:**
- Pressing a button gives one code
- Releasing gives a different code
- Usually you only care about press codes

**Polling required:**
- #2038 doesn't interrupt - you must check it in a loop
- Use short G04 delays for responsive detection
- Don't check too fast (wastes CPU) or too slow (misses presses)

**Controller-specific:**
- Button codes vary between controller versions
- Always test on YOUR controller first
- Document the codes you find

**Combining with other methods:**
```gcode
; Show message and wait for key
#1505 = -5000(Press any key to continue...)
#2038 = 0
WHILE #2038 == 0 DO1
    G04 P0.01
END1
#1505 = -5000(Continuing...)
```

---

## Comparison: Dialog Methods

| Feature | #1505 | #2070 | #2038 |
|---------|-------|-------|-------|
| **Purpose** | Simple OK/Cancel dialog | Numeric input dialog | Monitor button presses |
| **User Input** | ENTER or ESC only | Type a number | Any button press |
| **Return Value** | 1 (ENTER) or 0 (ESC) | Stores in #50-#499 | Key code in #2038 |
| **Displays Variables** | ✅ Yes (#1510-#1513) | ❌ No | N/A |
| **Pauses Program** | ✅ Yes (until key) | ✅ Yes (until ENTER) | ❌ No (polling loop) |
| **Use Case** | Simple confirmations | Asking for numbers | Custom button logic |

---

## Complete Example: Interactive Probing Setup

```gcode
O2000 (Interactive Probe Setup)

; Ask for probe diameter
#2070 = 50(Enter probe ball diameter (mm): )
#probe_dia = #50

; Validate input
IF #probe_dia <= 0 GOTO error
IF #probe_dia > 10 GOTO error

; Ask for probe depth
#2070 = 51(Enter probing depth (mm): )
#probe_depth = #51

IF #probe_depth <= 0 GOTO error

; Display configuration
#1510 = #probe_dia
#1511 = #probe_depth
#1505 = -5000(Probe: Ø[%.2f]mm Depth:[%.1f]mm - Press ENTER)

IF #1505 == 0 GOTO cancelled

; Show ready message  
#1503 = 1(Starting probe routine...)
#2042 = 300    ; Confirmation beep

; Perform probing with entered parameters
G91
G31 Z-#probe_depth F50 P3 L0 Q1

IF #1922 != 1 GOTO probe_failed

; Success
#probed_z = #1927
#actual_z = #probed_z - [#probe_dia / 2]

#1510 = #actual_z
#1503 = 1(Surface found at Z=[%.3f])
#2042 = 500
GOTO done

N error
#1505 = 1(ERROR: Invalid input values!)
#2042 = 1500
M30

N cancelled  
#1505 = 1(Operation cancelled by user)
M30

N probe_failed
#1505 = 1(ERROR: Probe did not trigger!)
#2042 = 1500
M30

N done
M30
```

This example combines all methods:
- `#2070` for numeric input
- `#1505` for confirmation
- `#1503` for status display
- `#2042` for audio feedback

---


---

**Series complete!** [← Back to Part 1](ddcs-display-methods-1-core.md) | [↑ Index](ddcs-display-methods.md)

**Part 2 of 2**
