# DDCS M350 Communication & Dialog Complete Reference

**Purpose**: Complete syntax and logic for all UI dialogs, messages, and user interaction  
**Controller**: DDCS Expert M350 V1.22  
**Use Case**: Communication Wizard generator and manual G-code writing

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Status Bar (#1503)](#2-status-bar-1503)
3. [Popup Dialog (#1505)](#3-popup-dialog-1505)
4. [Numeric Input (#2070)](#4-numeric-input-2070)
5. [System Beep (#2042)](#5-system-beep-2042)
6. [Alarm (#3000)](#6-alarm-3000)
7. [Dwell (G4)](#7-dwell-g4)
8. [Key Wait (#2038)](#8-key-wait-2038)
9. [Program Stop (M0)](#9-program-stop-m0)
10. [Data Slots (#1510-#1513)](#10-data-slots-1510-1513)
11. [Format Specifiers](#11-format-specifiers)
12. [Generator Patterns](#12-generator-patterns)
13. [Validation Rules](#13-validation-rules)

---

## 1. System Overview

### 1.1 Display Variables Summary

| Variable | Name | Function | Blocks Execution | Max Chars |
|----------|------|----------|------------------|-----------|
| #1503 | Status Bar | Persistent message at screen bottom | No | 68 |
| #1505 | Popup Dialog | Modal dialog with optional response | Yes (with M0) | 68 |
| #1510 | Data Slot 1 | Value for format specifier 1 | No | N/A |
| #1511 | Data Slot 2 | Value for format specifier 2 | No | N/A |
| #1512 | Data Slot 3 | Value for format specifier 3 | No | N/A |
| #1513 | Data Slot 4 | Value for format specifier 4 | No | N/A |
| #2038 | Key Monitor | Tracks button presses | Yes (with M0) | N/A |
| #2042 | Beep | Audio feedback (milliseconds) | No | N/A |
| #2070 | Input Dialog | Numeric input from operator | Yes | N/A |
| #3000 | Alarm | Trigger alarm state | Yes | 68 |

### 1.2 Which Supports Data Slots?

| Command | Supports #1510-#1513 |
|---------|---------------------|
| #1503 (Status) | ✅ Yes |
| #1505 (Popup) | ✅ Yes |
| #2070 (Input) | ❌ No |
| #3000 (Alarm) | ✅ Yes |

---

## 2. Status Bar (#1503)

### 2.1 Purpose
Display persistent text in the green status bar at bottom of controller screen. Does NOT pause execution.

### 2.2 Syntax

**Basic:**
```gcode
#1503=<message_id>(message text)
```

**With MSG prefix (equivalent):**
```gcode
#1503=<message_id>
(MSG,message text)
```

### 2.3 Message ID
- The message_id becomes internally: message_id + 3000
- Example: `#1503=1(...)` displays as message "3001"
- Typically use `1` for most messages

### 2.4 Examples

**Simple status:**
```gcode
#1503=1(Probing in progress...)
```

**Multi-line equivalent:**
```gcode
( Status Bar Update )
#1503=1
(MSG,Probing in progress...)
```

**With data slots:**
```gcode
#1510=#880           ( Machine X position )
#1511=#881           ( Machine Y position )
#1512=#882           ( Machine Z position )
#1503=1(Position: X=[%.3f] Y=[%.3f] Z=[%.3f])
```

**Progress indicator:**
```gcode
#1510=#current_step
#1511=#total_steps
#1503=1(Progress: [%.0f] of [%.0f] complete)
```

**Clearing status bar:**
```gcode
#1503=0(  )          ( Clear with empty message )
```

### 2.5 Characteristics

| Property | Value |
|----------|-------|
| Location | Green status bar at screen bottom |
| Duration | Until next #1503 or cleared |
| Execution | Does NOT pause |
| Max length | 68 characters |
| Data slots | ✅ Supports #1510-#1513 |
| Message offset | +3000 internally |

### 2.6 Generator Pattern

```javascript
generateStatus(slotsCode, msg) {
    let gcode = `${slotsCode}( Status Bar Update )\n`;
    gcode += `#1503=1\n`;
    gcode += `(MSG,${msg})`;
    return gcode;
}
```

---

## 3. Popup Dialog (#1505)

### 3.1 Purpose
Display modal popup dialog at bottom of screen. Can wait for user response.

### 3.2 Syntax

**Basic (uses confirm prompt to pause):**
```gcode
#1505=<mode>(message text)
M0
```

**Info only (negative = no pause):**
```gcode
#1505=-5000(message text)
```

### 3.3 Popup Modes

| Mode | Name | Behavior | User Action | Returns |
|------|------|----------|-------------|---------|
| 1 | Standard | Wait for cycle start | Press CYCLE START | Unchanged |
| 2 | Confirm | Wait with confirm/exit buttons | Press button | Unchanged |
| 3 | Binary | Yes/No choice | Enter or Esc | 1=Enter, 0=Esc |
| -5000 | Success | Display only, no wait | None needed | N/A |
| (negative) | Info | Display only, no wait | None needed | N/A |

### 3.4 Mode 1: Standard Popup

Displays message, waits for CYCLE START.

```gcode
( Confirm before starting )
#1505=1(Press CYCLE START to begin probing)
M0

( After operation )
#1505=1(Operation complete - press CYCLE START)
M0
```

### 3.5 Mode 2: Confirm Dialog

Similar to mode 1, with Confirm/Exit button labels.

```gcode
#1505=2(Ready to proceed? Confirm or Exit)
M0
```

### 3.6 Mode 3: Binary Choice

Returns user choice: 1 for Enter, 0 for Esc.

```gcode
( Ask binary question )
#1505=3(Continue? [Enter=Yes] [Esc=No])
M0

( Check response )
IF #1505==0 GOTO10        ( User pressed Esc )

( Enter path - user confirmed )
#1503=1(User confirmed - continuing...)
GOTO20

N10
( Esc path - user declined )
#1503=1(User cancelled operation)

N20
( Continue program )
```

**Direction choice example:**
```gcode
#1505=3(Move Right[Enter] or Left[Esc]?)
M0
IF #1505==0 GOTO1         ( Esc = Left )
G0 X10                    ( Enter = Right )
GOTO2
N1
G0 X-10                   ( Left path )
N2
```

### 3.7 Negative Modes: No Wait

Negative values display message without pausing. Use for success/info messages.

```gcode
( Success - no pause needed )
#1505=-5000(Corner found successfully!)

( Also works with other negative values )
#1505=-1(Quick info message)
```

### 3.8 With Data Slots

```gcode
( Load measurement values )
#1510=#measured_x
#1511=#measured_y
#1512=#measured_z

( Display in popup )
#1505=1(Found position: X=[%.3f] Y=[%.3f] Z=[%.3f])
M0
```

**Working example from community macros:**
```gcode
#1510=#2111
#1511=#2112
#1512=#2113
#1513=#2114
#1505=-5000(Axis1[%.3f]mm Axis2[%.3f]mm Axis3[%.3f]mm Axis4[%.3f]mm)
```

### 3.9 Characteristics

| Property | Value |
|----------|-------|
| Location | Bottom of screen (modal popup) |
| Duration | Until dismissed or operator confirms (CYCLE START) |
| Execution | Pauses with a confirm prompt (`#1505=1`), continues with negative mode |
| Max length | 68 characters |
| Data slots | ✅ Supports #1510-#1513 |
| Response | Mode 3 returns 0 or 1 in #1505 |

### 3.10 Generator Pattern

```javascript
generatePopup(slotsCode, mode, msg) {
    let gcode = `${slotsCode}( Popup Message )\n`;
    gcode += `#1505=${mode}\n`;
    gcode += `(MSG,${msg})`;
    return gcode;
}
```

---

## 4. Numeric Input (#2070)

### 4.1 Purpose
Display input dialog where operator types a numeric value.

### 4.2 Syntax

```gcode
#2070=<target_var>(prompt message)
```

The number entered by user is stored in variable `#<target_var>`.

### 4.3 CRITICAL LIMITATION

**#2070 can ONLY write to variables #50-#499!**

Attempting to write to other ranges (especially persistent #1153+) causes **silent failure** - the variable gets garbage or default value instead of user input.

### 4.4 Safe Two-Step Pattern

```gcode
( ❌ WRONG - Silent failure! )
#2070=1175(Enter probe speed...)

( ✅ CORRECT - Two-step pattern )
#2070=100(Enter probe speed mm/min)    ( Step 1: Write to temp #100 )
#1175=#100                              ( Step 2: Copy to persistent )
```

### 4.5 Valid Target Ranges

| Range | Can Use Directly | Notes |
|-------|------------------|-------|
| #50-#499 | ✅ Yes | Safe range for #2070 |
| #1-#49 | ⚠️ Maybe | May work but not guaranteed |
| #500-#999 | ❌ No | Parameter mirrors |
| #1153-#5999 | ❌ No | Persistent - use two-step |

### 4.6 Examples

**Simple input:**
```gcode
#2070=100(Enter probe distance mm)
( User types 50, stored in #100 )
```

**With persistent storage:**
```gcode
( Get user input safely )
#2070=100(Enter probe speed mm/min)
#2070=101(Enter retract distance mm)
#2070=102(Enter probe port number)

( Copy to persistent storage )
#1175=#100                    ( Speed to persistent )
#1176=#101                    ( Retract to persistent )
#1177=#102                    ( Port to persistent )

( Confirm to user )
#1510=#1175
#1511=#1176
#1512=#1177
#1505=-5000(Saved: Speed=[%.0f] Retract=[%.1f] Port=[%.0f])
```

**Input validation:**
```gcode
#2070=100(Enter tool diameter 1-25mm)

( Validate range )
IF #100<1 GOTO90
IF #100>25 GOTO90

( Valid - continue )
#1510=#100
#1505=-5000(Tool diameter set to [%.2f]mm)
GOTO99

N90
#1505=1(ERROR: Diameter must be 1-25mm!)
M0

N99
```

### 4.7 Characteristics

| Property | Value |
|----------|-------|
| Location | Dialog popup |
| Execution | Pauses until user presses Enter |
| Target range | #50-#499 only |
| Data slots | ❌ Does NOT support formatting |
| Input type | Numeric only |

### 4.8 Generator Pattern

```javascript
generateInput(slotsCode, id, dest, msg) {
    // id = temporary variable (#50-#499)
    // dest = final destination (can be persistent)
    let gcode = `${slotsCode}( Numeric Input - DDCS Safe )\n`;
    gcode += `#2070=${id}(${msg})\n`;
    gcode += `${dest}=#${id} (Copy to persistent)`;
    return gcode;
}
```

---

## 5. System Beep (#2042)

### 5.1 Purpose
Audio feedback - beep for specified duration in milliseconds.

### 5.2 Syntax

```gcode
#2042=<milliseconds>
```

### 5.3 Duration Guidelines

| Duration | Use Case |
|----------|----------|
| 50-150ms | Quick acknowledgment tap |
| 200-300ms | Short confirmation |
| 400-600ms | Standard confirmation |
| 800-1200ms | Important event |
| 1500-2000ms | Warning/error alert |
| >2000ms | Avoid (annoying) |

### 5.4 Examples

**Quick confirmation:**
```gcode
#2042=200              ( 0.2 second beep )
```

**Success beep:**
```gcode
#2042=500              ( 0.5 second beep )
#1505=-5000(Operation complete!)
```

**Error alert:**
```gcode
#2042=1500             ( 1.5 second warning beep )
#1505=1(ERROR: Probe failed!)
M0
```

**Attention-getting pattern:**
```gcode
#2042=200
G4 P500                ( Wait 0.5 sec )
#2042=200
G4 P500
#2042=500              ( Final longer beep )
#1505=1(WARNING: Spindle about to start!)
M0
```

**Countdown:**
```gcode
#1505=-5000(Starting in 3...)
#2042=200
G4 P1000

#1505=-5000(Starting in 2...)
#2042=200
G4 P1000

#1505=-5000(Starting in 1...)
#2042=200
G4 P1000

#2042=500
#1503=1(Operation started!)
```

### 5.5 Characteristics

| Property | Value |
|----------|-------|
| Execution | Does NOT pause |
| Parameter | Milliseconds |
| Range | 0-2000ms recommended |

### 5.6 Generator Pattern

```javascript
generateBeep(val) {
    return `( System Beep )\n#2042=${val}`;
}
```

---

## 6. Alarm (#3000)

### 6.1 Purpose
Trigger alarm state with message. Halts program execution.

### 6.2 Syntax

```gcode
#3000=1(MSG,alarm message)
```

### 6.3 Examples

**Simple alarm:**
```gcode
#3000=1(MSG,Probe contact failed!)
```

**With data:**
```gcode
#1510=#error_code
#3000=1(MSG,Error code [%.0f] - Check probe!)
```

**Conditional alarm:**
```gcode
IF #1922!=2 GOTO90

( Continue normal operation )
GOTO99

N90
#3000=1(MSG,Z Probe failed - no contact detected!)

N99
```

### 6.4 Characteristics

| Property | Value |
|----------|-------|
| Execution | Halts program, triggers alarm state |
| Recovery | Requires operator intervention |
| Data slots | ✅ Supports #1510-#1513 |
| Max length | 68 characters |

### 6.5 Generator Pattern

```javascript
generateAlarm(slotsCode, msg) {
    let gcode = `${slotsCode}( Trigger Alarm )\n`;
    gcode += `#3000=1(MSG,${msg})`;
    return gcode;
}
```

---

## 7. Dwell (G4)

### 7.1 Purpose
Pause program execution for specified time.

### 7.2 Syntax

```gcode
G4 P<milliseconds>
```

### 7.3 Examples

**1 second pause:**
```gcode
G4 P1000
```

**5 second pause:**
```gcode
G4 P5000
```

**Variable pause:**
```gcode
#delay=2000
G4 P#delay
```

**With message:**
```gcode
#1503=1(Waiting 3 seconds...)
G4 P3000
#1503=1(Done waiting)
```

### 7.4 Characteristics

| Property | Value |
|----------|-------|
| Execution | Pauses for specified time |
| Parameter | P = milliseconds |
| Max | No hard limit, but practical limit ~30000ms |

### 7.5 Generator Pattern

```javascript
generateDwell(val) {
    return `G4 P${val}`;
}
```

---

## 8. Key Wait (#2038)

### 8.1 Purpose
Monitor button/key presses. Used with a confirm prompt for "press any key to continue" behavior.

### 8.2 Syntax

```gcode
#2038=0                ( Clear before monitoring )
M0                     ( Wait for key press )
```

### 8.3 How It Works

1. Clear #2038 to 0
2. M0 pauses execution
3. When any key pressed, #2038 gets key code
4. Program continues

### 8.4 Key Code Format

```
Full value = (Press_Status × 65536) + Key_Code

Where:
- Key_Code = Button identifier
- Press_Status = 0 (released) or 1 (pressed)
```

### 8.5 Examples

**Wait for any key:**
```gcode
#1505=-5000(Press any key to continue...)
#2038=0
M0
( Continues after any key pressed )
```

**With message:**
```gcode
( Key Wait )
#2038=0
M0
```

**Detect specific key (advanced):**
```gcode
#2038=0
M0

( Check which key was pressed )
IF #2038==65864 GOTO10    ( START button )
IF #2038==65537 GOTO20    ( ENTER button )
GOTO30                     ( Other key )

N10
#1503=1(START pressed)
GOTO99

N20
#1503=1(ENTER pressed)
GOTO99

N30
#1503=1(Other key pressed)

N99
```

### 8.6 Finding Key Codes

Use this test program to discover your controller's key codes:

```gcode
O9999 (Key Code Finder)
#2038=0
#1505=-5000(Press buttons to see codes...)
G4 P2000

N1
#1510=#2038
#1503=1(Key code: [%.0f])
G4 P20
GOTO1
```

### 8.7 Characteristics

| Property | Value |
|----------|-------|
| Execution | Pauses with confirm prompt (`#1505=1`) until operator confirms |
| Return | Key code in #2038 |
| Clear | Must set #2038=0 before use |

### 8.8 Generator Pattern

```javascript
generateKeyWait() {
    let gcode = `( Key Wait )\n`;
    gcode += `#2038=0\n`;
    gcode += `( Confirm Start )\n#1505=1 (Press Enter to probe)`;
    return gcode;
}
```

---

## 9. Program Stop (M0)

### 9.1 Purpose
Halt execution until operator presses CYCLE START.

### 9.2 Syntax

```gcode
M0
```

### 9.3 Usage with Display Commands

Generators no longer emit `M0`; instead they use a `#1505` confirm prompt to instruct the operator and request CYCLE START (or press Enter) to continue.

```gcode
( Confirm Start )
#1505=1 (Press Enter to probe)
```

### 9.4 Examples

**Simple pause:**
```gcode
G0 Z10                 ( Retract )
M0                     ( Wait for operator )
( Operator presses CYCLE START to continue )
```

**With instruction:**
```gcode
#1505=1(Insert tool and press CYCLE START)
M0
```

### 9.5 Characteristics

| Property | Value |
|----------|-------|
| Display | Shows "PAUSE" on controller |
| Resume | CYCLE START button |
| Audio | Single beep (if #241=Yes) |

---

## 10. Data Slots (#1510-#1513)

### 10.1 Purpose
Provide numeric values for format specifiers in messages.

### 10.2 Slot Assignments

| Variable | Slot | Format Position |
|----------|------|-----------------|
| #1510 | Slot 1 | First `[%.Xf]` |
| #1511 | Slot 2 | Second `[%.Xf]` |
| #1512 | Slot 3 | Third `[%.Xf]` |
| #1513 | Slot 4 | Fourth `[%.Xf]` |

### 10.3 Usage

```gcode
( Load values )
#1510=123.456          ( First value )
#1511=78.9             ( Second value )
#1512=42               ( Third value )
#1513=7                ( Fourth value )

( Display - slots map to format specifiers in order )
#1505=1(A=[%.3f] B=[%.1f] C=[%.0f] D=[%.0f])
M0
```

**Output:** `A=123.456 B=78.9 C=42 D=7`

### 10.4 Priming Note

Some firmware versions work better WITHOUT priming data slots:

```gcode
( May work better - direct assignment )
#1510=#1925            ( Direct from probe result )

( Alternative - with priming )
#1510=0                ( Prime )
#1510=#1925            ( Then assign )
```

Test on your firmware to see which works better.

### 10.5 Supported Commands

| Command | Supports Slots |
|---------|---------------|
| #1503 | ✅ Yes |
| #1505 | ✅ Yes |
| #2070 | ❌ No |
| #3000 | ✅ Yes |

---

## 11. Format Specifiers

### 11.1 Syntax

**Use square brackets around format code:**
```
[%.Xf]
```

Where X = number of decimal places (0-3).

### 11.2 Format Codes

| Code | Decimals | Example Input | Output |
|------|----------|---------------|--------|
| `[%.0f]` | 0 | 123.456 | `123` |
| `[%.1f]` | 1 | 123.456 | `123.5` |
| `[%.2f]` | 2 | 123.456 | `123.46` |
| `[%.3f]` | 3 | 123.456 | `123.456` |

### 11.3 Important Notes

**Square brackets required for #1505:**
```gcode
#1505=1(Value: [%.3f])     ✅ Correct
#1505=1(Value: %.3f)       ❌ May not work
```

**No brackets for #1503 (both may work):**
```gcode
#1503=1(Value: [%.3f])     ✅ Works
#1503=1(Value: %.3f)       ✅ Also works
```

**Percent sign escaping:**
```gcode
#1503=1(Progress: [%.0f]%%)    ✅ Shows "Progress: 85%"
#1503=1(Progress: [%.0f]%)     ❌ May misinterpret
```

### 11.4 Multiple Values

Values are consumed in order:
```gcode
#1510=10
#1511=20
#1512=30
#1513=40
#1505=1(W=[%.0f] X=[%.0f] Y=[%.0f] Z=[%.0f])
```

**Output:** `W=10 X=20 Y=30 Z=40`

---

## 12. Generator Patterns

### 12.1 Communication Wizard Generator Logic

```javascript
class CommunicationWizard {
    
    generate(params) {
        const {
            type,       // popup, status, input, beep, alarm, dwell, keywait
            msg,        // Message text
            val,        // Value (for beep duration, dwell time)
            popupMode,  // 1, 2, 3, or -5000
            id,         // Target variable for input (#50-#499)
            dest,       // Final destination variable
            slot1,      // Data slot 1 value
            slot2,      // Data slot 2 value
            slot3,      // Data slot 3 value
            slot4       // Data slot 4 value
        } = params;

        // Generate data slots if type supports them
        const supportsSlots = ['popup', 'status', 'alarm', 'input'].includes(type);
        const slotsCode = this.generateSlotsCode(supportsSlots, slot1, slot2, slot3, slot4);

        switch (type) {
            case 'popup':
                return this.generatePopup(slotsCode, popupMode, msg);
            case 'status':
                return this.generateStatus(slotsCode, msg);
            case 'input':
                return this.generateInput(slotsCode, id, dest, msg);
            case 'beep':
                return this.generateBeep(val);
            case 'alarm':
                return this.generateAlarm(slotsCode, msg);
            case 'dwell':
                return this.generateDwell(val);
            case 'keywait':
                return this.generateKeyWait();
            default:
                return `( Unknown type: ${type} )`;
        }
    }

    generateSlotsCode(supportsSlots, slot1, slot2, slot3, slot4) {
        if (!supportsSlots) return '';
        
        let code = '';
        if (slot1) code += `#1510=${slot1}\n`;
        if (slot2) code += `#1511=${slot2}\n`;
        if (slot3) code += `#1512=${slot3}\n`;
        if (slot4) code += `#1513=${slot4}\n`;
        return code;
    }

    generatePopup(slotsCode, mode, msg) {
        let gcode = `${slotsCode}( Popup Message )\n`;
        gcode += `#1505=${mode}\n`;
        gcode += `(MSG,${msg})\n`;
        gcode += `( Confirm Start )\n#1505=1 (Press Enter to probe)`;
        return gcode;
    }

    generateStatus(slotsCode, msg) {
        let gcode = `${slotsCode}( Status Bar Update )\n`;
        gcode += `#1503=1\n`;
        gcode += `(MSG,${msg})`;
        return gcode;
    }

    generateInput(slotsCode, id, dest, msg) {
        let gcode = `${slotsCode}( Numeric Input - DDCS Safe )\n`;
        gcode += `#2070=${id}(${msg})\n`;
        gcode += `${dest}=#${id} (Copy to persistent)`;
        return gcode;
    }

    generateBeep(val) {
        return `( System Beep )\n#2042=${val}`;
    }

    generateAlarm(slotsCode, msg) {
        let gcode = `${slotsCode}( Trigger Alarm )\n`;
        gcode += `#3000=1(MSG,${msg})`;
        return gcode;
    }

    generateDwell(val) {
        return `G4 P${val}`;
    }

    generateKeyWait() {
        let gcode = `( Key Wait )\n`;
        gcode += `#2038=0\n`;
        gcode += `( Confirm Start )\n#1505=1 (Press Enter to probe)`;
        return gcode;
    }

    // UI helper - which fields to show for each type
    getFieldVisibility(type) {
        return {
            showMode: type === 'popup',
            showValue: type === 'beep' || type === 'dwell',
            showMessage: type !== 'dwell' && type !== 'keywait',
            showSlots: ['popup', 'status', 'alarm', 'input'].includes(type),
            showVar: type === 'input'
        };
    }
}
```

### 12.2 UI Field Visibility Matrix

| Type | Mode | Value | Message | Slots | VarID/Dest |
|------|------|-------|---------|-------|------------|
| popup | ✅ | ❌ | ✅ | ✅ | ❌ |
| status | ❌ | ❌ | ✅ | ✅ | ❌ |
| input | ❌ | ❌ | ✅ | ✅ | ✅ |
| beep | ❌ | ✅ | ❌ | ❌ | ❌ |
| alarm | ❌ | ❌ | ✅ | ✅ | ❌ |
| dwell | ❌ | ✅ | ❌ | ❌ | ❌ |
| keywait | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 13. Validation Rules

### 13.1 Message Length

```javascript
const MAX_MESSAGE_LENGTH = 68;

function validateMessageLength(msg) {
    if (msg.length > MAX_MESSAGE_LENGTH) {
        return {
            valid: false,
            error: `Message exceeds ${MAX_MESSAGE_LENGTH} characters (${msg.length})`
        };
    }
    return { valid: true };
}
```

### 13.2 Input Variable Range

```javascript
function validateInputTarget(varNum) {
    if (varNum < 50 || varNum > 499) {
        return {
            valid: false,
            error: `#2070 target must be #50-#499, got #${varNum}`,
            suggestion: `Use #2070=${varNum % 450 + 50}(...) then copy to #${varNum}`
        };
    }
    return { valid: true };
}
```

### 13.3 Popup Mode Validation

```javascript
const VALID_POPUP_MODES = [1, 2, 3, -5000];

function validatePopupMode(mode) {
    const modeNum = parseInt(mode);
    if (modeNum < 0 && modeNum !== -5000) {
        // Other negative values work as info-only
        return { valid: true, warning: 'Negative mode = info only (no wait)' };
    }
    if (!VALID_POPUP_MODES.includes(modeNum) && modeNum > 0) {
        return {
            valid: false,
            warning: `Mode ${mode} may not behave as expected. Use 1, 2, 3, or -5000`
        };
    }
    return { valid: true };
}
```

### 13.4 Format Specifier Validation

```javascript
function validateFormatSpecifiers(msg, slotCount) {
    const formatMatches = msg.match(/\[%\.\d+f\]/g) || [];
    const specifierCount = formatMatches.length;
    
    if (specifierCount > 4) {
        return {
            valid: false,
            error: `Too many format specifiers (${specifierCount}). Maximum is 4.`
        };
    }
    
    if (specifierCount > slotCount) {
        return {
            valid: false,
            error: `${specifierCount} format specifiers but only ${slotCount} data slots provided`
        };
    }
    
    return { valid: true };
}
```

### 13.5 Beep Duration Validation

```javascript
function validateBeepDuration(ms) {
    if (ms < 0) {
        return { valid: false, error: 'Beep duration cannot be negative' };
    }
    if (ms > 2000) {
        return { valid: true, warning: 'Beep >2 seconds may be annoying to operator' };
    }
    return { valid: true };
}
```

---

## 14. Complete Examples

### 14.1 Probe Confirmation Flow

```gcode
( Initial prompt )
#1505=1(Position probe over workpiece corner)
M0

( Ask to continue )
#1505=3(Ready to probe? [Enter=Yes] [Esc=Cancel])
M0
IF #1505==0 GOTO99

( Status during operation )
#1503=1(Probing Z surface...)

( Perform probe )
G91
G31 Z-50 F200 P3 L0 Q1
G90

( Check result )
IF #1922!=2 GOTO90

( Success )
#1510=#1927
#2042=500
#1505=-5000(Z surface found at [%.3f])
GOTO99

N90
( Error )
#2042=1500
#1505=1(ERROR: Probe failed - no contact!)
M0

N99
M30
```

### 14.2 User Input with Validation

```gcode
( Get speed from user )
#2070=100(Enter probe speed 50-500 mm/min)

( Validate )
IF #100<50 GOTO80
IF #100>500 GOTO80

( Save to persistent )
#1175=#100

( Confirm )
#1510=#1175
#2042=300
#1505=-5000(Speed set to [%.0f] mm/min)
GOTO99

N80
#2042=1000
#1505=1(Invalid speed - must be 50-500)
M0

N99
```

### 14.3 Multi-Step Progress Display

```gcode
#2042=200
#1503=1(Step 1: Homing X axis...)
G28 X
G4 P500

#2042=200
#1503=1(Step 2: Homing Y axis...)
G28 Y
G4 P500

#2042=200
#1503=1(Step 3: Homing Z axis...)
G28 Z
G4 P500

#2042=500
#1505=-5000(Homing complete!)
```

---

## Document Info

**Version**: 1.0  
**Last Updated**: February 2026  
**Based On**: DDCS Expert M350 V1.22, Community Macros, DDCS Studio V9.49
